import importlib.util
import json
import os
import sys
from pathlib import Path

import boto3
from moto import mock_aws


MODULE_NAME = "brainpin_lambda_app"
LAMBDA_APP_PATH = Path(__file__).resolve().parents[1] / "lambda" / "app.py"


def load_lambda_app():
    if MODULE_NAME in sys.modules:
        del sys.modules[MODULE_NAME]
    spec = importlib.util.spec_from_file_location(MODULE_NAME, LAMBDA_APP_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


@mock_aws()
def test_category_crud_flow():
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["TABLE_NAME"] = "test-links"
    os.environ["CATEGORIES_TABLE_NAME"] = "test-categories"
    os.environ["ALLOWED_ORIGIN"] = "https://example.org"

    app = load_lambda_app()
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

    dynamodb.create_table(
        TableName=os.environ["TABLE_NAME"],
        KeySchema=[{"AttributeName": "link_id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "link_id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )

    dynamodb.create_table(
        TableName=os.environ["CATEGORIES_TABLE_NAME"],
        KeySchema=[{"AttributeName": "category_id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "category_id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )

    create_event = {
        "rawPath": "/categories",
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({"name": "Bookmarks", "description": "My favs"}),
        "isBase64Encoded": False,
    }

    create_response = app.handler(create_event, None)
    assert create_response["statusCode"] == 201
    assert create_response["headers"]["Access-Control-Allow-Origin"] == "https://example.org"

    created_body = json.loads(create_response["body"])
    category = created_body["category"]
    category_id = category["id"]
    assert category["name"] == "Bookmarks"
    assert category["description"] == "My favs"

    list_event = {
        "rawPath": "/categories",
        "requestContext": {"http": {"method": "GET"}},
    }
    list_response = app.handler(list_event, None)
    assert list_response["statusCode"] == 200
    listed = json.loads(list_response["body"]).get("categories", [])
    assert any(item["id"] == category_id for item in listed)

    update_event = {
        "rawPath": f"/categories/{category_id}",
        "pathParameters": {"categoryId": category_id},
        "requestContext": {"http": {"method": "PUT"}},
        "body": json.dumps({"name": "Reading", "description": None}),
        "isBase64Encoded": False,
    }
    update_response = app.handler(update_event, None)
    assert update_response["statusCode"] == 200
    updated_body = json.loads(update_response["body"])["category"]
    assert updated_body["name"] == "Reading"
    assert "description" not in updated_body

    get_event = {
        "rawPath": f"/categories/{category_id}",
        "pathParameters": {"categoryId": category_id},
        "requestContext": {"http": {"method": "GET"}},
    }
    get_response = app.handler(get_event, None)
    assert get_response["statusCode"] == 200
    fetched = json.loads(get_response["body"])["category"]
    assert fetched["name"] == "Reading"
    assert "description" not in fetched

    delete_event = {
        "rawPath": f"/categories/{category_id}",
        "pathParameters": {"categoryId": category_id},
        "requestContext": {"http": {"method": "DELETE"}},
    }
    delete_response = app.handler(delete_event, None)
    assert delete_response["statusCode"] == 204
    assert delete_response["body"] == ""

    missing_response = app.handler(get_event, None)
    assert missing_response["statusCode"] == 404


@mock_aws()
def test_links_require_existing_categories_and_block_category_deletion():
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["TABLE_NAME"] = "test-links"
    os.environ["CATEGORIES_TABLE_NAME"] = "test-categories"
    os.environ["ALLOWED_ORIGIN"] = "https://example.org"

    app = load_lambda_app()
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

    dynamodb.create_table(
        TableName=os.environ["TABLE_NAME"],
        KeySchema=[{"AttributeName": "link_id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "link_id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )

    dynamodb.create_table(
        TableName=os.environ["CATEGORIES_TABLE_NAME"],
        KeySchema=[{"AttributeName": "category_id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "category_id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )

    create_category_event = {
        "rawPath": "/categories",
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({"name": "Reading"}),
        "isBase64Encoded": False,
    }

    category_response = app.handler(create_category_event, None)
    category_id = json.loads(category_response["body"])["category"]["id"]

    link_event = {
        "rawPath": "/links",
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({
            "name": "Example",
            "url": "https://example.org",
            "categoryId": category_id,
        }),
        "isBase64Encoded": False,
    }

    link_response = app.handler(link_event, None)
    assert link_response["statusCode"] == 201
    link_id = json.loads(link_response["body"])["link"]["id"]

    invalid_link_event = {
        **link_event,
        "body": json.dumps({
            "name": "Bad",
            "url": "https://invalid.example",
            "categoryId": "cat-missing",
        }),
    }

    invalid_link_response = app.handler(invalid_link_event, None)
    assert invalid_link_response["statusCode"] == 400

    update_event = {
        "rawPath": f"/links/{link_id}",
        "pathParameters": {"linkId": link_id},
        "requestContext": {"http": {"method": "PUT"}},
        "body": json.dumps({"categoryId": "cat-missing"}),
        "isBase64Encoded": False,
    }

    update_response = app.handler(update_event, None)
    assert update_response["statusCode"] == 400

    delete_category_event = {
        "rawPath": f"/categories/{category_id}",
        "pathParameters": {"categoryId": category_id},
        "requestContext": {"http": {"method": "DELETE"}},
    }

    blocked_delete = app.handler(delete_category_event, None)
    assert blocked_delete["statusCode"] == 409

    delete_link_event = {
        "rawPath": f"/links/{link_id}",
        "pathParameters": {"linkId": link_id},
        "requestContext": {"http": {"method": "DELETE"}},
    }

    delete_link_response = app.handler(delete_link_event, None)
    assert delete_link_response["statusCode"] == 204

    allowed_delete = app.handler(delete_category_event, None)
    assert allowed_delete["statusCode"] == 204
