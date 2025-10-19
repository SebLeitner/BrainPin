terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  name_prefix            = lower(replace("${var.project_name}-${var.environment}", " ", "-"))
  lambda_function_name   = "${local.name_prefix}-links-handler"
  api_name               = "${local.name_prefix}-links-api"
  log_group_api_name     = "/aws/apigateway/${local.api_name}"
  tags = merge({
    Project     = var.project_name
    Environment = var.environment
  }, var.tags)

  routes = {
    "GET /links"                 = { method = "GET",    path = "/links" }
    "POST /links"                = { method = "POST",   path = "/links" }
    "GET /links/{linkId}"        = { method = "GET",    path = "/links/{linkId}" }
    "PUT /links/{linkId}"        = { method = "PUT",    path = "/links/{linkId}" }
    "DELETE /links/{linkId}"     = { method = "DELETE", path = "/links/{linkId}" }
    "POST /links/{linkId}/sublinks" = {
      method = "POST"
      path   = "/links/{linkId}/sublinks"
    }
    "PUT /links/{linkId}/sublinks/{sublinkId}" = {
      method = "PUT"
      path   = "/links/{linkId}/sublinks/{sublinkId}"
    }
    "DELETE /links/{linkId}/sublinks/{sublinkId}" = {
      method = "DELETE"
      path   = "/links/{linkId}/sublinks/{sublinkId}"
    }
    "GET /categories"            = { method = "GET",    path = "/categories" }
    "POST /categories"           = { method = "POST",   path = "/categories" }
    "GET /categories/{categoryId}"    = { method = "GET",    path = "/categories/{categoryId}" }
    "PUT /categories/{categoryId}"    = { method = "PUT",    path = "/categories/{categoryId}" }
    "DELETE /categories/{categoryId}" = { method = "DELETE", path = "/categories/{categoryId}" }
  }
}

data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/build/links-handler.zip"
}

resource "aws_dynamodb_table" "links" {
  name         = "${local.name_prefix}-links"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "link_id"

  attribute {
    name = "link_id"
    type = "S"
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "categories" {
  name         = "${local.name_prefix}-categories"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "category_id"

  attribute {
    name = "category_id"
    type = "S"
  }

  tags = local.tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.lambda_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_dynamodb" {
  statement {
    sid = "AllowLinksTableAccess"

    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]

    resources = [
      aws_dynamodb_table.links.arn,
      "${aws_dynamodb_table.links.arn}/index/*",
      aws_dynamodb_table.categories.arn,
      "${aws_dynamodb_table.categories.arn}/index/*"
    ]
  }
}

resource "aws_iam_policy" "lambda_dynamodb" {
  name   = "${local.lambda_function_name}-ddb"
  policy = data.aws_iam_policy_document.lambda_dynamodb.json
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.lambda_function_name}"
  retention_in_days = var.log_retention_in_days

  tags = local.tags
}

resource "aws_lambda_function" "links" {
  function_name = local.lambda_function_name
  role          = aws_iam_role.lambda.arn
  runtime       = var.lambda_runtime
  handler       = var.lambda_handler
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256

  environment {
    variables = merge({
      TABLE_NAME             = aws_dynamodb_table.links.name
      CATEGORIES_TABLE_NAME  = aws_dynamodb_table.categories.name
      ALLOWED_ORIGIN         = var.allowed_cors_origin
    }, var.lambda_environment)
  }

  tags = local.tags

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_logs,
    aws_iam_role_policy_attachment.lambda_dynamodb,
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = local.log_group_api_name
  retention_in_days = var.log_retention_in_days

  tags = local.tags
}

resource "aws_apigatewayv2_api" "links" {
  name          = local.api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = [
      "Authorization",
      "Content-Type",
      "X-Amz-Date",
      "X-Amz-Security-Token",
      "X-Api-Key"
    ]
    allow_methods = ["OPTIONS", "GET", "POST", "PUT", "DELETE"]
    allow_origins = [var.allowed_cors_origin]
    expose_headers = [
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Headers",
      "Access-Control-Allow-Methods"
    ]
    max_age = 3600
  }

  tags = local.tags
}

resource "aws_apigatewayv2_integration" "links" {
  api_id             = aws_apigatewayv2_api.links.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.links.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "links" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.links.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.links.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.links.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId               = "$context.requestId",
      ip                      = "$context.identity.sourceIp",
      requestTime             = "$context.requestTime",
      httpMethod              = "$context.httpMethod",
      routeKey                = "$context.routeKey",
      status                  = "$context.status",
      protocol                = "$context.protocol",
      responseLatency         = "$context.responseLatency",
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = 1000
    throttling_rate_limit  = 500
  }

  stage_variables = {
    allowed_cors_origin = var.allowed_cors_origin
  }

  tags = local.tags
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowExecutionFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.links.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.links.execution_arn}/*/*"
}

output "api_endpoint" {
  description = "Invoke URL of the HTTP API"
  value       = aws_apigatewayv2_api.links.api_endpoint
}

output "lambda_function_name" {
  description = "Name of the Lambda function handling link operations"
  value       = aws_lambda_function.links.function_name
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table storing links"
  value       = aws_dynamodb_table.links.name
}

output "dynamodb_categories_table_name" {
  description = "Name of the DynamoDB table storing categories"
  value       = aws_dynamodb_table.categories.name
}
