# GitHub Actions CI/CD Setup

This repo now includes:

- [deploy-backend-and-vercel.yml](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/.github/workflows/deploy-backend-and-vercel.yml)

It automates:

1. Deploy backend infrastructure and container image via Terraform + AWS CLI.
2. Read `backend_url` from Terraform outputs.
3. Update Vercel env vars and trigger a production deploy.

## 1. Required GitHub Secrets

Set these in `GitHub -> Settings -> Secrets and variables -> Actions -> Secrets`.

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `HF_API_TOKEN`
- `DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## 2. Required GitHub Variables

Set these in `GitHub -> Settings -> Secrets and variables -> Actions -> Variables`.

- `AWS_REGION` = `us-east-1`
- `SERVICE_NAME` = `modelmesh-api`
- `ECR_REPOSITORY_NAME` = `modelmesh-api`
- `IMAGE_TAG` = `latest`
- `DEPLOYMENT_TARGET` = `ec2`
- `ALLOWED_ORIGINS` = `https://model-mesh-serverless-ml-model-serv.vercel.app`
- `ENABLE_RDS` = `true`
- `ENABLE_CLOUDFRONT_HTTPS` = `true`
- `DB_NAME` = `modelmesh`
- `DB_USERNAME` = `modelmesh_admin`
- `DB_INSTANCE_CLASS` = `db.t4g.micro`
- `DB_ALLOCATED_STORAGE` = `20`
- `HF_PROVIDER` = `auto`
- `HF_TIMEOUT_SECONDS` = `45`
- `DATABASE_URL` = `sqlite:///./modelmesh.db`
- `TF_STATE_BUCKET` = `<your-terraform-state-bucket>`
- `TF_STATE_KEY` = `modelmesh/prod/terraform.tfstate`
- `TF_LOCK_TABLE` = `<your-terraform-lock-table>`

## 3. One-time Terraform remote state setup

Create backend resources once (example):

```powershell
$AWS_REGION = "us-east-1"
$TF_STATE_BUCKET = "modelmesh-terraform-state-<unique-suffix>"
$TF_LOCK_TABLE = "modelmesh-terraform-locks"

aws s3api create-bucket --bucket $TF_STATE_BUCKET --region $AWS_REGION
aws s3api put-bucket-versioning --bucket $TF_STATE_BUCKET --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name $TF_LOCK_TABLE --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --region $AWS_REGION
```

Migrate your existing local Terraform state to S3:

```powershell
cd D:\ModelMesh-Serverless-ML-Model-Serving-and-Testing\infra\terraform
terraform init -migrate-state `
  -backend-config="bucket=<your-terraform-state-bucket>" `
  -backend-config="key=modelmesh/prod/terraform.tfstate" `
  -backend-config="region=us-east-1" `
  -backend-config="dynamodb_table=<your-terraform-lock-table>"
```

## 4. Triggering CI/CD

### Manual trigger

1. Open `GitHub -> Actions -> Deploy Backend And Update Vercel`.
2. Click `Run workflow`.

### Automatic trigger

The workflow runs on `push` to `main` when these paths change:

- `apps/**`
- `shared/**`
- `infra/terraform/**`
- `Dockerfile`
- `pyproject.toml`

## 5. Post-run checks

After the workflow succeeds:

1. Open your Vercel app.
2. Run one live inference.
3. Confirm logs and metrics update.

You can also verify backend URL from Terraform logs in the workflow run.
