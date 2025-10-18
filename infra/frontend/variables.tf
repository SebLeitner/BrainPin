variable "aws_region" {
  description = "AWS region to deploy regional resources (S3, CloudFront origin)"
  type        = string
  default     = "eu-central-1"
}

variable "hosted_zone_name" {
  description = "Public Route53 hosted zone (with trailing dot) where the record should be created"
  type        = string
  default     = "leitnersoft.com."
}

variable "subdomain" {
  description = "Subdomain to map to the CloudFront distribution"
  type        = string
  default     = "brainpin"
}

variable "project_name" {
  description = "Name used for tagging and default resource naming"
  type        = string
  default     = "brainpin-frontend"
}

variable "environment" {
  description = "Deployment environment label used for tagging"
  type        = string
  default     = "prod"
}

variable "s3_bucket_name" {
  description = "Optional override for the S3 bucket name (must be globally unique)"
  type        = string
  default     = ""
}

variable "force_destroy" {
  description = "Allow Terraform to delete the bucket even when it contains objects"
  type        = bool
  default     = false
}

variable "enable_versioning" {
  description = "Enable versioning on the S3 bucket to protect static assets"
  type        = bool
  default     = true
}

variable "cloudfront_price_class" {
  description = "Price class for the CloudFront distribution"
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
