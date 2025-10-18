variable "aws_region" {
  description = "AWS region where all backend resources are created"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "brainpin-backend"
}

variable "environment" {
  description = "Environment tag/identifier (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "allowed_cors_origin" {
  description = "Origin allowed to call the HTTP API. Must match the Lambda ALLOWED_ORIGIN environment variable."
  type        = string
  default     = "https://brainpin.leitnersoft.com"
}

variable "lambda_package_s3_bucket" {
  description = "Name of the S3 bucket that stores the Lambda deployment package"
  type        = string
}

variable "lambda_package_s3_key" {
  description = "S3 key of the Lambda deployment package"
  type        = string
}

variable "lambda_package_s3_object_version" {
  description = "Optional S3 object version for the Lambda package to ensure immutable deployments"
  type        = string
  default     = null
}

variable "lambda_runtime" {
  description = "Runtime for the Lambda function"
  type        = string
  default     = "python3.11"
}

variable "lambda_handler" {
  description = "Handler entry point of the Lambda function"
  type        = string
  default     = "app.handler"
}

variable "lambda_memory_size" {
  description = "Memory size for the Lambda function"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout in seconds for the Lambda function"
  type        = number
  default     = 10
}

variable "lambda_environment" {
  description = "Additional environment variables to merge into the Lambda configuration"
  type        = map(string)
  default     = {}
}

variable "log_retention_in_days" {
  description = "Retention period (days) for CloudWatch log groups"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
