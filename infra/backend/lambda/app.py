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
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
TABLE_NAME = os.environ["TABLE_NAME"]
CATEGORIES_TABLE_NAME = os.environ["CATEGORIES_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
categories_table = dynamodb.Table(CATEGORIES_TABLE_NAME)


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


def _normalize_phone_number(raw: str, field: str) -> str:
    digits = re.sub(r"[\s().-]", "", raw)
    if digits == "":
        raise HttpError(400, f"'{field}' cannot be empty")

    plus_count = digits.count("+")
    if plus_count > 1:
        raise HttpError(400, f"'{field}' contains too many '+' characters")

    if plus_count == 1 and not digits.startswith("+"):
        raise HttpError(400, f"'{field}' must start with '+' if it contains one")

    number = digits[1:] if digits.startswith("+") else digits
    if not number.isdigit():
        raise HttpError(400, f"'{field}' may only contain digits aside from a leading '+'")

    return f"+{number}" if digits.startswith("+") else number


def _validate_url(url: Any, field: str = "url") -> str:
    trimmed = _validate_string(url, field, max_length=2048)
    lower_trimmed = trimmed.lower()

    if lower_trimmed.startswith("tel:"):
        phone = trimmed[4:]
        normalized = _normalize_phone_number(phone, field)
        return f"tel:{normalized}"

    if not re.match(r"^https?://", trimmed):
        raise HttpError(400, f"'{field}' must start with http:// or https://")
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


def _generate_sublink_id() -> str:
    return f"sln-{uuid.uuid4().hex[:12]}"


def _validate_sublinks(
    value: Any,
    *,
    allow_autogenerated_ids: bool = True,
) -> List[Dict[str, Any]]:
    if value is None:
        return []

    if not isinstance(value, list):
        raise HttpError(400, "'sublinks' must be a list")

    sanitized: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    for index, candidate in enumerate(value):
        if not isinstance(candidate, dict):
            raise HttpError(400, f"sublinks[{index}] must be an object")

        raw_id = candidate.get("id")
        if raw_id is None:
            if not allow_autogenerated_ids:
                raise HttpError(400, f"sublinks[{index}].id is required")
            sublink_id = _generate_sublink_id()
        else:
            sublink_id = _validate_string(raw_id, f"sublinks[{index}].id", max_length=64)

        if sublink_id in seen_ids:
            raise HttpError(400, "Sublink identifiers must be unique")
        seen_ids.add(sublink_id)

        name = _validate_string(candidate.get("name"), f"sublinks[{index}].name", max_length=128)
        url = _validate_url(candidate.get("url"), f"sublinks[{index}].url")
        description = _validate_description(candidate.get("description"))

        item: Dict[str, Any] = {
            "id": sublink_id,
            "name": name,
            "url": url,
        }
        if description is not None:
            item["description"] = description
        sanitized.append(item)

    return sanitized


def _extract_sublinks(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = item.get("sublinks")
    if not isinstance(raw, list):
        return []

    sublinks: List[Dict[str, Any]] = []
    for candidate in raw:
        if not isinstance(candidate, dict):
            continue
        sublink_id = candidate.get("id")
        name = candidate.get("name")
        url = candidate.get("url")
        if not isinstance(sublink_id, str) or not isinstance(name, str) or not isinstance(url, str):
            continue
        entry: Dict[str, Any] = {
            "id": sublink_id,
            "name": name,
            "url": url,
        }
        description = candidate.get("description")
        if isinstance(description, str):
            entry["description"] = description
        sublinks.append(entry)
    return sublinks


def _serialize(item: Dict[str, Any]) -> Dict[str, Any]:
    raw_category_ids = item.get("category_ids")
    category_ids: List[str] = []

    if isinstance(raw_category_ids, list):
        seen: set[str] = set()
        for candidate in raw_category_ids:
            if not isinstance(candidate, str):
                continue
            trimmed = candidate.strip()
            if trimmed and trimmed not in seen:
                category_ids.append(trimmed)
                seen.add(trimmed)

    legacy_category_id = item.get("category_id")
    if isinstance(legacy_category_id, str):
        trimmed = legacy_category_id.strip()
        if trimmed and trimmed not in category_ids:
            category_ids.insert(0, trimmed)

    payload: Dict[str, Any] = {
        "id": item["link_id"],
        "name": item["name"],
        "url": item["url"],
        "categoryIds": category_ids,
    }
    if category_ids:
        payload["categoryId"] = category_ids[0]
    if "description" in item:
        payload["description"] = item["description"]
    payload["sublinks"] = _extract_sublinks(item)
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


def _serialize_category(item: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": item["category_id"],
        "name": item["name"],
    }
    if "description" in item:
        payload["description"] = item["description"]
    return payload


def _generate_category_id() -> str:
    return f"cat-{uuid.uuid4().hex[:12]}"


def _list_categories() -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    start_key = None
    while True:
        kwargs: Dict[str, Any] = {}
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        result = categories_table.scan(**kwargs)
        items.extend(result.get("Items", []))
        start_key = result.get("LastEvaluatedKey")
        if not start_key:
            break
    return response(200, {"categories": [_serialize_category(item) for item in items]})


def _assert_category_exists(category_id: str) -> None:
    try:
        result = categories_table.get_item(
            Key={"category_id": category_id},
            ProjectionExpression="category_id",
        )
    except ClientError:  # pragma: no cover - defensive branch
        LOGGER.exception("Failed to validate category existence")
        raise

    if not result.get("Item"):
        raise HttpError(400, "categoryId must reference an existing category")


def _category_has_links(category_id: str) -> bool:
    start_key = None
    while True:
        scan_kwargs: Dict[str, Any] = {
            "FilterExpression": Attr("category_ids").contains(category_id)
            | Attr("category_id").eq(category_id),
            "ProjectionExpression": "link_id",
        }
        if start_key:
            scan_kwargs["ExclusiveStartKey"] = start_key

        result = table.scan(**scan_kwargs)
        if result.get("Items"):
            return True

        start_key = result.get("LastEvaluatedKey")
        if not start_key:
            return False


def _create_category(event_body: Dict[str, Any]) -> Dict[str, Any]:
    name = _validate_string(event_body.get("name"), "name", max_length=128)
    description = _validate_description(event_body.get("description"))

    category_id = _generate_category_id()
    item: Dict[str, Any] = {
        "category_id": category_id,
        "name": name,
    }
    if description is not None:
        item["description"] = description

    try:
        categories_table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(category_id)",
        )
    except ClientError as exc:  # pragma: no cover - defensive branch
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(409, "Category already exists") from exc
        LOGGER.exception("Failed to create category")
        raise

    return response(201, {"category": _serialize_category(item)})


def _get_category(category_id: str) -> Dict[str, Any]:
    result = categories_table.get_item(Key={"category_id": category_id})
    item = result.get("Item")
    if not item:
        raise HttpError(404, "Category not found")
    return response(200, {"category": _serialize_category(item)})


def _update_category(category_id: str, event_body: Dict[str, Any]) -> Dict[str, Any]:
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

    if "description" in event_body:
        description = _validate_description(event_body["description"])
        names["#d"] = "description"
        if description is None:
            remove_statements.append("#d")
        else:
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
        result = categories_table.update_item(
            Key={"category_id": category_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=names or None,
            ExpressionAttributeValues=values or None,
            ConditionExpression="attribute_exists(category_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Category not found") from exc
        LOGGER.exception("Failed to update category")
        raise

    attributes = result.get("Attributes", {})
    return response(200, {"category": _serialize_category(attributes)})


def _delete_category(category_id: str) -> Dict[str, Any]:
    if _category_has_links(category_id):
        raise HttpError(409, "Category cannot be deleted while links reference it")

    try:
        categories_table.delete_item(
            Key={"category_id": category_id},
            ConditionExpression="attribute_exists(category_id)",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Category not found") from exc
        LOGGER.exception("Failed to delete category")
        raise

    return response(204, None)


def _sanitize_category_ids(value: Any, *, field: str) -> List[str]:
    if value is None:
        raise HttpError(400, f"'{field}' must contain at least one category identifier")

    if isinstance(value, list):
        raw_items = value
    elif isinstance(value, str):
        raw_items = [value]
    else:
        raise HttpError(400, f"'{field}' must be a list of category identifiers")

    sanitized: List[str] = []
    seen: set[str] = set()
    for index, candidate in enumerate(raw_items):
        label = f"{field}[{index}]" if isinstance(value, list) else field
        category_id = _validate_string(candidate, label, max_length=64)
        if category_id not in seen:
            sanitized.append(category_id)
            seen.add(category_id)

    if not sanitized:
        raise HttpError(400, f"'{field}' must contain at least one category identifier")

    return sanitized


def _extract_category_ids_from_body(event_body: Dict[str, Any]) -> List[str]:
    if "categoryIds" in event_body:
        category_ids = _sanitize_category_ids(event_body.get("categoryIds"), field="categoryIds")
    elif "categoryId" in event_body:
        category_ids = _sanitize_category_ids(event_body.get("categoryId"), field="categoryId")
    else:
        raise HttpError(400, "At least one category must be provided")

    for category_id in category_ids:
        _assert_category_exists(category_id)

    return category_ids


def _create_link(event_body: Dict[str, Any]) -> Dict[str, Any]:
    name = _validate_string(event_body.get("name"), "name", max_length=128)
    url = _validate_url(event_body.get("url"))
    category_ids = _extract_category_ids_from_body(event_body)
    description = _validate_description(event_body.get("description"))
    raw_sublinks = event_body.get("sublinks")
    sublinks = _validate_sublinks(raw_sublinks) if raw_sublinks is not None else []

    link_id = _generate_link_id()
    item: Dict[str, Any] = {
        "link_id": link_id,
        "name": name,
        "url": url,
        "category_id": category_ids[0],
        "category_ids": category_ids,
    }
    if description is not None:
        item["description"] = description
    if sublinks:
        item["sublinks"] = sublinks

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
    item = _fetch_link_item(link_id)
    return response(200, {"link": _serialize(item)})


def _fetch_link_item(link_id: str) -> Dict[str, Any]:
    result = table.get_item(Key={"link_id": link_id})
    item = result.get("Item")
    if not item:
        raise HttpError(404, "Link not found")
    return item


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

    category_ids_to_set: Optional[List[str]] = None
    if "categoryIds" in event_body:
        category_ids_to_set = _sanitize_category_ids(event_body.get("categoryIds"), field="categoryIds")
    elif "categoryId" in event_body:
        category_ids_to_set = _sanitize_category_ids(event_body.get("categoryId"), field="categoryId")

    if category_ids_to_set is not None:
        for category_id in category_ids_to_set:
            _assert_category_exists(category_id)
        names["#ci"] = "category_ids"
        values[":ci"] = category_ids_to_set
        set_statements.append("#ci = :ci")
        names["#c"] = "category_id"
        values[":c"] = category_ids_to_set[0]
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

    if "sublinks" in event_body:
        sublinks_value = event_body["sublinks"]
        names["#s"] = "sublinks"
        if sublinks_value is None:
            remove_statements.append("#s")
        else:
            validated_sublinks = _validate_sublinks(sublinks_value)
            values[":s"] = validated_sublinks
            set_statements.append("#s = :s")

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


def _create_sublink(link_id: str, event_body: Dict[str, Any]) -> Dict[str, Any]:
    name = _validate_string(event_body.get("name"), "name", max_length=128)
    url = _validate_url(event_body.get("url"))
    description = _validate_description(event_body.get("description"))

    raw_id = event_body.get("id")
    sublink_id = (
        _validate_string(raw_id, "id", max_length=64) if raw_id is not None else _generate_sublink_id()
    )

    item = _fetch_link_item(link_id)
    current_sublinks = _extract_sublinks(item)

    if any(existing.get("id") == sublink_id for existing in current_sublinks):
        raise HttpError(409, "Sublink already exists")

    new_entry: Dict[str, Any] = {
        "id": sublink_id,
        "name": name,
        "url": url,
    }
    if description is not None:
        new_entry["description"] = description

    updated_sublinks = current_sublinks + [new_entry]

    try:
        result = table.update_item(
            Key={"link_id": link_id},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "sublinks"},
            ExpressionAttributeValues={":s": updated_sublinks},
            ConditionExpression="attribute_exists(link_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Link not found") from exc
        LOGGER.exception("Failed to create sublink")
        raise

    attributes = result.get("Attributes", {})
    return response(201, {"link": _serialize(attributes)})


def _update_sublink(link_id: str, sublink_id: str, event_body: Dict[str, Any]) -> Dict[str, Any]:
    if not event_body:
        raise HttpError(400, "Request body must contain at least one field to update")

    updates: Dict[str, Any] = {}
    description_provided = False
    remove_description = False

    if "name" in event_body:
        updates["name"] = _validate_string(event_body["name"], "name", max_length=128)

    if "url" in event_body:
        updates["url"] = _validate_url(event_body["url"])

    if "description" in event_body:
        description_provided = True
        description = _validate_description(event_body["description"])
        if description is None:
            remove_description = True
        else:
            updates["description"] = description

    if not updates and not description_provided:
        raise HttpError(400, "No updatable fields provided")

    item = _fetch_link_item(link_id)
    current_sublinks = _extract_sublinks(item)

    for index, sublink in enumerate(current_sublinks):
        if sublink.get("id") == sublink_id:
            updated = dict(sublink)
            if "name" in updates:
                updated["name"] = updates["name"]
            if "url" in updates:
                updated["url"] = updates["url"]
            if "description" in updates:
                updated["description"] = updates["description"]
            elif description_provided and remove_description:
                updated.pop("description", None)
            current_sublinks[index] = updated
            break
    else:
        raise HttpError(404, "Sublink not found")

    try:
        result = table.update_item(
            Key={"link_id": link_id},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "sublinks"},
            ExpressionAttributeValues={":s": current_sublinks},
            ConditionExpression="attribute_exists(link_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Link not found") from exc
        LOGGER.exception("Failed to update sublink")
        raise

    attributes = result.get("Attributes", {})
    return response(200, {"link": _serialize(attributes)})


def _delete_sublink(link_id: str, sublink_id: str) -> Dict[str, Any]:
    item = _fetch_link_item(link_id)
    current_sublinks = _extract_sublinks(item)

    next_sublinks = [entry for entry in current_sublinks if entry.get("id") != sublink_id]
    if len(next_sublinks) == len(current_sublinks):
        raise HttpError(404, "Sublink not found")

    update_kwargs: Dict[str, Any] = {
        "Key": {"link_id": link_id},
        "ExpressionAttributeNames": {"#s": "sublinks"},
        "ConditionExpression": "attribute_exists(link_id)",
        "ReturnValues": "ALL_NEW",
    }

    if next_sublinks:
        update_kwargs["UpdateExpression"] = "SET #s = :s"
        update_kwargs["ExpressionAttributeValues"] = {":s": next_sublinks}
    else:
        update_kwargs["UpdateExpression"] = "REMOVE #s"

    try:
        result = table.update_item(**update_kwargs)
    except ClientError as exc:
        if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
            raise HttpError(404, "Link not found") from exc
        LOGGER.exception("Failed to delete sublink")
        raise

    attributes = result.get("Attributes", {})
    return response(200, {"link": _serialize(attributes)})


def _extract_resource_id(event: Dict[str, Any], collection: str, *, parameter_name: str) -> Optional[str]:
    path_parameters = event.get("pathParameters") or {}
    candidate = path_parameters.get(parameter_name)
    if candidate:
        return candidate

    raw_path = event.get("rawPath", "")
    segments = [segment for segment in raw_path.split("/") if segment]
    if len(segments) >= 2 and segments[0] == collection:
        return segments[1]
    return None


def _extract_link_id(event: Dict[str, Any]) -> Optional[str]:
    return _extract_resource_id(event, "links", parameter_name="linkId")


def _extract_category_id(event: Dict[str, Any]) -> Optional[str]:
    return _extract_resource_id(event, "categories", parameter_name="categoryId")


def _extract_sublink_id(event: Dict[str, Any]) -> Optional[str]:
    path_parameters = event.get("pathParameters") or {}
    candidate = path_parameters.get("sublinkId")
    if candidate:
        return candidate

    raw_path = event.get("rawPath", "")
    segments = [segment for segment in raw_path.split("/") if segment]
    if len(segments) >= 4 and segments[0] == "links" and segments[2] == "sublinks":
        return segments[3]
    return None


@with_error_handling
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:  # noqa: ANN401
    LOGGER.debug("Received event: %s", event)

    http_context = (event.get("requestContext") or {}).get("http") or {}
    method = http_context.get("method", "").upper()

    if method == "OPTIONS":
        return response(204, None)

    raw_path = event.get("rawPath", "")
    if raw_path.startswith("/links"):
        if method == "GET" and raw_path == "/links":
            return _list_links()
        if method == "POST" and raw_path == "/links":
            body = _parse_json_body(event)
            return _create_link(body)

        link_id = _extract_link_id(event)
        if not link_id:
            raise HttpError(404, "Route not found")

        segments = [segment for segment in raw_path.split("/") if segment]
        if len(segments) >= 3 and segments[2] == "sublinks":
            if method == "POST" and len(segments) == 3:
                body = _parse_json_body(event)
                return _create_sublink(link_id, body)

            sublink_id = _extract_sublink_id(event)
            if not sublink_id:
                raise HttpError(404, "Route not found")

            if method == "PUT":
                body = _parse_json_body(event)
                return _update_sublink(link_id, sublink_id, body)
            if method == "DELETE":
                return _delete_sublink(link_id, sublink_id)
            raise HttpError(405, "Method not allowed")

        if method == "GET":
            return _get_link(link_id)
        if method == "PUT":
            body = _parse_json_body(event)
            return _update_link(link_id, body)
        if method == "DELETE":
            return _delete_link(link_id)
        raise HttpError(405, "Method not allowed")

    if raw_path.startswith("/categories"):
        if method == "GET" and raw_path == "/categories":
            return _list_categories()
        if method == "POST" and raw_path == "/categories":
            body = _parse_json_body(event)
            return _create_category(body)

        category_id = _extract_category_id(event)
        if not category_id:
            raise HttpError(404, "Route not found")

        if method == "GET":
            return _get_category(category_id)
        if method == "PUT":
            body = _parse_json_body(event)
            return _update_category(category_id, body)
        if method == "DELETE":
            return _delete_category(category_id)
        raise HttpError(405, "Method not allowed")

    raise HttpError(404, "Route not found")
