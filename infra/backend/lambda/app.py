"""BrainPin backend Lambda function.

This handler implements CRUD operations for link items stored in DynamoDB and
returns CORS-safe responses that comply with the internal KM guidelines.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
TABLE_NAME = os.environ["TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


class HttpError(Exception):
    """Represents an HTTP error that should be propagated to the caller."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def response(status_code: int, body: Optional[Dict[str, Any]] = None, *, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Return a JSON response with mandatory CORS headers."""

    base_headers = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Amz-Date,X-Amz-Security-Token,X-Api-Key",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
        "Access-Control-Allow-Credentials": "false",
        "Content-Type": "application/json",
    }
    if headers:
        base_headers.update(headers)

    payload = "" if body is None else json.dumps(body)
    return {
        "statusCode": status_code,
        "headers": base_headers,
        "body": payload,
        "isBase64Encoded": False,
    }


def with_error_handling(handler):
    """Decorator that wraps the handler with structured error responses."""

    def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:  # noqa: ANN401
        try:
            return handler(event, context)
        except HttpError as err:
            LOGGER.info("Client error: %s", err)
            return response(err.status_code, {"message": err.message})
        except Exception:  # noqa: BLE001
            LOGGER.exception("Unhandled error")
            return response(500, {"message": "Internal server error"})

    return wrapper


def _decode_body(event: Dict[str, Any]) -> str:
    """Decode the raw request body, taking base64 encoding into account."""

    raw_body = event.get("body")
    if raw_body in (None, ""):
        return ""

    if event.get("isBase64Encoded"):
        try:
            return base64.b64decode(raw_body).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise HttpError(400, "Request body could not be decoded") from exc

    return raw_body


def _parse_json_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse the incoming request body as JSON and validate the result."""

    raw = _decode_body(event)
    if raw == "":
        return {}

    try:
        body = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HttpError(400, "Request body must be valid JSON") from exc

    if not isinstance(body, dict):
        raise HttpError(400, "Request body must be a JSON object")

    return body


def _validate_string(value: Any, field: str, *, max_length: int, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise HttpError(400, f"'{field}' must be a string")

    trimmed = value.strip()
    if not trimmed and not allow_empty:
        raise HttpError(400, f"'{field}' cannot be empty")
    if len(trimmed) > max_length:
        raise HttpError(400, f"'{field}' must not exceed {max_length} characters")

    return trimmed


def _validate_url(url: Any) -> str:
    trimmed = _validate_string(url, "url", max_length=2048)
    if not re.match(r"^https?://", trimmed):
        raise HttpError(400, "'url' must start with http:// or https://")
    return trimmed


def _validate_description(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HttpError(400, "'description' must be a string")
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > 512:
        raise HttpError(400, "'description' must not exceed 512 characters")
    return trimmed


def _generate_link_id() -> str:
    return f"lnk-{uuid.uuid4().hex[:12]}"


def _serialize(item: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": item["link_id"],
        "name": item["name"],
        "url": item["url"],
        "categoryId": item["category_id"],
    }
    if "description" in item:
        payload["description"] = item["description"]
    return payload


def _list_links() -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    start_key = None
    while True:
        kwargs: Dict[str, Any] = {}
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        result = table.scan(**kwargs)
        items.extend(result.get("Items", []))
        start_key = result.get("LastEvaluatedKey")
        if not start_key:
            break
    return response(200, {"links": [_serialize(item) for item in items]})


def _create_link(event_body: Dict[str, Any]) -> Dict[str, Any]:
    name = _validate_string(event_body.get("name"), "name", max_length=128)
    url = _validate_url(event_body.get("url"))
    category_id = _validate_string(event_body.get("categoryId"), "categoryId", max_length=64)
    description = _validate_description(event_body.get("description"))

    link_id = _generate_link_id()
    item: Dict[str, Any] = {
        "link_id": link_id,
        "name": name,
        "url": url,
        "category_id": category_id,
    }
    if description is not None:
        item["description"] = description

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(link_id)",
        )
    except ClientError as exc:  # pragma: no cover - defensive branch
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(409, "Link already exists") from exc
        LOGGER.exception("Failed to create link")
        raise

    return response(201, {"link": _serialize(item)})


def _get_link(link_id: str) -> Dict[str, Any]:
    result = table.get_item(Key={"link_id": link_id})
    item = result.get("Item")
    if not item:
        raise HttpError(404, "Link not found")
    return response(200, {"link": _serialize(item)})


def _update_link(link_id: str, event_body: Dict[str, Any]) -> Dict[str, Any]:
    if not event_body:
        raise HttpError(400, "Request body must contain at least one field to update")

    set_statements: List[str] = []
    remove_statements: List[str] = []
    names: Dict[str, str] = {}
    values: Dict[str, Any] = {}

    if "name" in event_body:
        name = _validate_string(event_body["name"], "name", max_length=128)
        names["#n"] = "name"
        values[":n"] = name
        set_statements.append("#n = :n")

    if "url" in event_body:
        url = _validate_url(event_body["url"])
        names["#u"] = "url"
        values[":u"] = url
        set_statements.append("#u = :u")

    if "categoryId" in event_body:
        category_id = _validate_string(event_body["categoryId"], "categoryId", max_length=64)
        names["#c"] = "category_id"
        values[":c"] = category_id
        set_statements.append("#c = :c")

    if "description" in event_body:
        description = _validate_description(event_body["description"])
        if description is None:
            remove_statements.append("#d")
            names["#d"] = "description"
        else:
            names["#d"] = "description"
            values[":d"] = description
            set_statements.append("#d = :d")

    if not set_statements and not remove_statements:
        raise HttpError(400, "No updatable fields provided")

    update_expr_parts: List[str] = []
    if set_statements:
        update_expr_parts.append("SET " + ", ".join(set_statements))
    if remove_statements:
        update_expr_parts.append("REMOVE " + ", ".join(remove_statements))

    update_expression = " ".join(update_expr_parts)

    try:
        result = table.update_item(
            Key={"link_id": link_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=names or None,
            ExpressionAttributeValues=values or None,
            ConditionExpression="attribute_exists(link_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Link not found") from exc
        LOGGER.exception("Failed to update link")
        raise

    attributes = result.get("Attributes", {})
    return response(200, {"link": _serialize(attributes)})


def _delete_link(link_id: str) -> Dict[str, Any]:
    try:
        table.delete_item(
            Key={"link_id": link_id},
            ConditionExpression="attribute_exists(link_id)",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Link not found") from exc
        LOGGER.exception("Failed to delete link")
        raise

    return response(204, None)


def _extract_link_id(event: Dict[str, Any]) -> Optional[str]:
    path_parameters = event.get("pathParameters") or {}
    link_id = path_parameters.get("linkId")
    if link_id:
        return link_id

    raw_path = event.get("rawPath", "")
    segments = [segment for segment in raw_path.split("/") if segment]
    if len(segments) >= 2 and segments[0] == "links":
        return segments[1]
    return None


@with_error_handling
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:  # noqa: ANN401
    LOGGER.debug("Received event: %s", event)

    http_context = (event.get("requestContext") or {}).get("http") or {}
    method = http_context.get("method", "").upper()

    if method == "OPTIONS":
        return response(204, None)

    raw_path = event.get("rawPath", "")
    if method == "GET" and raw_path == "/links":
        return _list_links()

    if method == "POST" and raw_path == "/links":
        body = _parse_json_body(event)
        return _create_link(body)

    link_id = _extract_link_id(event)
    if not link_id:
        raise HttpError(404, "Route not found")

    if method == "GET":
        return _get_link(link_id)
    if method == "PUT":
        body = _parse_json_body(event)
        return _update_link(link_id, body)
    if method == "DELETE":
        return _delete_link(link_id)

    raise HttpError(405, "Method not allowed")
