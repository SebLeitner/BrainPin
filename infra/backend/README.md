# BrainPin Backend Infrastructure (Terraform)

This Terraform stack provisions the AWS resources for the BrainPin backend API that manages link entries (create, update, delete, list).

## Architecture Overview

The configuration deploys the following components:

- **Amazon DynamoDB** table for persisting link metadata.
- **AWS Lambda** function that exposes CRUD operations against the table.
- **Amazon API Gateway HTTP API** that fronts the Lambda function and enforces CORS.
- **CloudWatch Log Groups** for both Lambda and API Gateway access logs.
- **IAM Roles and Policies** granting the Lambda permission to interact with DynamoDB and publish logs.

```
Client → API Gateway (HTTP API) → Lambda → DynamoDB
```

The API is designed with production-ready defaults derived from our internal CORS guidelines:

- CORS headers allow `Authorization`, `Content-Type`, `X-Amz-Date`, `X-Amz-Security-Token`, and `X-Api-Key` by default.
- Both Terraform (`allowed_cors_origin`) and the Lambda environment (`ALLOWED_ORIGIN`) must be configured with the same origin to avoid mismatches.
- Error handling must stay within the Lambda function so that even failures return responses with the correct CORS headers (see the KM "CORS Guidelines").

## Prerequisites

- Terraform ≥ 1.5
- AWS credentials with permissions to manage Lambda, API Gateway, DynamoDB, IAM, and CloudWatch Logs
- A deployment-ready Lambda artifact uploaded to S3

## Configuration

Key variables are exposed in `variables.tf`:

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | Region for all resources | `eu-central-1` |
| `project_name` | Naming prefix & tagging | `brainpin-backend` |
| `environment` | Environment suffix | `prod` |
| `allowed_cors_origin` | Origin allowed by CORS and passed to the Lambda | `https://brainpin.leitnersoft.com` |
| `lambda_package_s3_bucket` | S3 bucket that stores the Lambda deployment package | _(required)_ |
| `lambda_package_s3_key` | S3 key of the Lambda package | _(required)_ |
| `lambda_package_s3_object_version` | Optional S3 object version for immutable deployments | `null` |
| `lambda_runtime` | Lambda runtime | `python3.11` |
| `lambda_handler` | Entry point in the Lambda package | `app.handler` |
| `lambda_memory_size` | Lambda memory allocation | `512` |
| `lambda_timeout` | Lambda timeout (seconds) | `10` |
| `log_retention_in_days` | Retention for CloudWatch logs | `30` |
| `lambda_environment` | Additional environment variables for the Lambda | `{}` |
| `tags` | Extra resource tags | `{}` |

Example `terraform.tfvars`:

```hcl
aws_region                   = "eu-central-1"
project_name                 = "brainpin-backend"
environment                  = "prod"
allowed_cors_origin          = "https://brainpin.leitnersoft.com"
lambda_package_s3_bucket     = "brainpin-artifacts"
lambda_package_s3_key        = "backend/links-handler.zip"
lambda_package_s3_object_version = "3Lc4P2Yvh6h4.."
```

## Usage

```bash
cd infra/backend
terraform init
terraform plan
terraform apply
```

After a successful apply, the outputs provide the API endpoint, Lambda function name, and DynamoDB table name. Deploy the frontend with the returned API URL, and make sure the Lambda implementation adheres to the error-handling and CORS guidance from KM.

## Cleanup

Destroy the stack when it is no longer required:

```bash
terraform destroy
```

If you store production data in DynamoDB, create a backup before destroying the table.
