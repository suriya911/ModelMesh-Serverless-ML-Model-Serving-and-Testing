# Terraform: Demo-Budget EC2 + S3 + SQS Deployment

This Terraform config supports:

- `deployment_target = "ec2"` (default): EC2 backend, optional RDS Postgres, optional CloudFront HTTPS
- `deployment_target = "apprunner"`: App Runner backend
- managed ElastiCache Redis on EC2 (`enable_managed_redis = true`) for runtime cache/metrics state
- local Redis sidecar (`enable_local_redis = true`) for the low-cost mode
- S3 dataset uploads and SQS comparison jobs
- API key auth + per-tenant daily quotas

For your account and budget target, use the EC2 path with:

- `ec2_instance_type = "t3.micro"`
- `enable_rds = false`
- `enable_managed_redis = false`
- `enable_local_redis = true`
- `enable_cloudfront_https = true`

That keeps the live demo around a single micro instance plus low-traffic S3/SQS/CloudFront costs.

## Prerequisites

- AWS CLI configured
- Docker running
- Terraform installed

## 1. Verify AWS identity

```powershell
aws sts get-caller-identity
```

## 2. Prepare tfvars

```powershell
cd D:\ModelMesh-Serverless-ML-Model-Serving-and-Testing\infra\terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

Set at minimum in `terraform.tfvars`:

- `deployment_target = "ec2"`
- `ec2_instance_type = "t3.micro"`
- `allowed_origins = "https://model-mesh-serverless-ml-model-serv.vercel.app"`
- `hf_api_token = "..."`
- `api_keys = "demo:modelmesh-demo-key:1000:50:100"`
- `enable_rds = false`
- `enable_cloudfront_https = true`
- `enable_managed_redis = false`
- `enable_local_redis = true`
- `enable_cloudwatch_alarms = true`
- `alert_email = "you@example.com"` if you want SNS email notifications

If you later need managed persistence:

- set `enable_rds = true`
- set `enable_managed_redis = true`
- set `enable_local_redis = false`

## 3. Init Terraform and create ECR first

```powershell
terraform init
terraform apply -auto-approve --% -target=aws_ecr_repository.api
```

## 4. Build and push backend image

From repo root:

```powershell
cd D:\ModelMesh-Serverless-ML-Model-Serving-and-Testing

$AWS_REGION = "us-east-1"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_REPO   = "modelmesh-api"
$IMAGE_TAG  = "latest"
$ECR_URI    = "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build -t "${ECR_REPO}:${IMAGE_TAG}" .
docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"
```

## 5. Apply full infrastructure

```powershell
cd D:\ModelMesh-Serverless-ML-Model-Serving-and-Testing\infra\terraform
terraform apply -auto-approve
terraform output backend_url
```

When `enable_cloudfront_https = true`, `backend_url` will be:

`https://<cloudfront-domain>`

## 6. Connect Vercel

Set in Vercel:

- `VITE_API_BASE_URL = <terraform output backend_url>`
- `VITE_API_KEY = modelmesh-demo-key` or your custom frontend key

If you still use the temporary Vercel proxy:

- `BACKEND_URL = <terraform output backend_url>`

Redeploy Vercel.

## 7. Validate

- `GET <backend_url>/health`
- `GET <backend_url>/v1/models` with `X-API-Key`
- Run one live inference from the Vercel dashboard
- Confirm logs in `GET <backend_url>/v1/system/logs`
- Open `System` in the frontend and confirm tenant quota counters are visible

## Every Rebuild Checklist

Run this after any Terraform apply or backend image update:

1. `terraform output backend_url`
2. Update Vercel `VITE_API_BASE_URL` to that value
3. Redeploy Vercel
4. Re-test `/health`, `/v1/models`, and one live inference
