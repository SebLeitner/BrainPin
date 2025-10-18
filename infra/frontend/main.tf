terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "selected" {
  name         = var.hosted_zone_name
  private_zone = false
}

locals {
  domain_name = var.subdomain != "" ? "${var.subdomain}.${trimsuffix(var.hosted_zone_name, ".")}" : trimsuffix(var.hosted_zone_name, ".")
  tags = merge({
    Project     = var.project_name
    Environment = var.environment
  }, var.tags)
}

resource "aws_s3_bucket" "frontend" {
  bucket        = var.s3_bucket_name != "" ? var.s3_bucket_name : lower(replace("${var.project_name}-${var.environment}-${data.aws_caller_identity.current.account_id}", " ", "-"))
  force_destroy = var.force_destroy

  tags = local.tags
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.domain_name}-oac"
  description                       = "OAC for ${local.domain_name} static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "frontend" {
  provider          = aws.us_east_1
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.frontend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.selected.zone_id
}

resource "aws_acm_certificate_validation" "frontend" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "frontend" {
  depends_on = [aws_acm_certificate_validation.frontend]

  enabled         = true
  price_class     = var.cloudfront_price_class
  is_ipv6_enabled = true
  aliases         = [local.domain_name]
  comment         = "CDN for ${local.domain_name}"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-${aws_s3_bucket.frontend.id}"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.add_trailing_slash.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate_validation.frontend.certificate_arn
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

  default_root_object = "index.html"

  tags = local.tags
}

resource "aws_cloudfront_function" "add_trailing_slash" {
  name    = replace("${local.domain_name}-trailing-slash", ".", "-")
  comment = "Redirect extensionless paths to a trailing slash"
  runtime = "cloudfront-js-1.0"
  publish = true

  code = <<-EOF
function handler(event) {
  var request = event.request;
  var uri = request.uri || '';

  if (!uri || uri === '/') {
    request.uri = '/index.html';
    return request;
  }

  if (uri.includes('.') || uri.startsWith('/_next') || uri.startsWith('/api/')) {
    return request;
  }

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  var querystring = request.querystring || {};
  var queryKeys = Object.keys(querystring);
  var location = uri + '/';

  if (queryKeys.length > 0) {
    var params = [];
    for (var i = 0; i < queryKeys.length; i++) {
      var key = queryKeys[i];
      var entry = querystring[key];
      if (!entry) {
        continue;
      }

      if (entry.multiValue && entry.multiValue.length > 0) {
        for (var j = 0; j < entry.multiValue.length; j++) {
          var mv = entry.multiValue[j];
          params.push(key + '=' + mv.value);
        }
      } else if (entry.value !== undefined) {
        params.push(key + '=' + entry.value);
      } else {
        params.push(key);
      }
    }

    if (params.length > 0) {
      location += '?' + params.join('&');
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: location }
    }
  };
}
EOF
}

data "aws_iam_policy_document" "frontend" {
  statement {
    sid = "AllowCloudFrontServicePrincipalRead"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.frontend.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend.json
}

resource "aws_route53_record" "frontend" {
  name    = local.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.selected.zone_id

  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
  }
}

output "bucket_name" {
  description = "Name of the S3 bucket hosting the static assets"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "Identifier of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "Domain name assigned to the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "route53_record_fqdn" {
  description = "FQDN created for the frontend"
  value       = aws_route53_record.frontend.fqdn
}
