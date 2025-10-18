# BrainPin Frontend Infrastructure (Terraform)

This Terraform configuration provisions the AWS infrastructure required to host the BrainPin frontend with a secure custom domain.

## Architecture Overview

The stack deploys:

- **Amazon S3 bucket** for storing the static build artifacts of the Next.js frontend.
- **AWS CloudFront distribution** configured with an origin access control so only CloudFront can read from the bucket.
- **AWS Certificate Manager (ACM)** certificate (issued in `us-east-1`) used by CloudFront for TLS termination.
- **Amazon Route 53 DNS records** for validating the certificate and routing `brainpin.leitnersoft.com` to the CloudFront distribution.

```
User → Route 53 (brainpin.leitnersoft.com) → CloudFront → S3 bucket (static assets)
```

## Prerequisites

- Terraform ≥ 1.5
- An AWS account with permissions to manage S3, CloudFront, ACM, and Route 53
- A public Route 53 hosted zone for `leitnersoft.com`
- AWS credentials exported in your shell (`AWS_PROFILE`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, or AWS SSO)

## Configuration

Default values in `variables.tf` set up the production domain `brainpin.leitnersoft.com`. Adjust them as needed via a `terraform.tfvars` file or CLI flags.

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | Region for regional services (S3) | `eu-central-1` |
| `hosted_zone_name` | Hosted zone name with trailing dot | `leitnersoft.com.` |
| `subdomain` | Subdomain to bind to CloudFront | `brainpin` |
| `project_name` | Tagging / naming prefix | `brainpin-frontend` |
| `environment` | Environment tag | `prod` |
| `s3_bucket_name` | Optional explicit bucket name | generated |
| `force_destroy` | Allow bucket deletion with objects | `false` |
| `enable_versioning` | Enable S3 versioning | `true` |
| `cloudfront_price_class` | CloudFront price class | `PriceClass_100` |
| `tags` | Extra resource tags | `{}` |

Example `terraform.tfvars`:

```hcl
aws_region        = "eu-central-1"
project_name      = "brainpin-frontend"
environment       = "prod"
cloudfront_price_class = "PriceClass_All"
```

## Usage

```bash
cd infra/frontend
terraform init
terraform plan
terraform apply
```

Once Terraform finishes, upload the built Next.js assets to the generated S3 bucket (see the `bucket_name` output). For example, after running `npm run build:static` in the `frontend/` project, sync the `out/` directory:

```bash
aws s3 sync ../frontend/out s3://$(terraform output -raw bucket_name) --delete
```

CloudFront may take several minutes to deploy or pick up new files; invalidations can be triggered via the AWS console or CLI when deploying updates.

### Production Outputs

For the current production environment, the stack was applied manually and produced the following outputs:

| Output | Value |
|--------|-------|
| `bucket_name` | `brainpin-frontend-prod-140023375269` |
| `cloudfront_distribution_id` | `E2N7KMOABLKE5P` |
| `cloudfront_domain_name` | `d1fv73t015hmo1.cloudfront.net` |
| `route53_record_fqdn` | `brainpin.leitnersoft.com` |

These values are referenced by the automated deployment workflow to sync assets and issue cache invalidations.

## Cleanup

Destroy the stack when it is no longer needed:

```bash
terraform destroy
```

If `force_destroy` is `false`, empty the S3 bucket before destroying the resources.
