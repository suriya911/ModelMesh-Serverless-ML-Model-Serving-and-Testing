# Observability and Load Testing

## CloudWatch alarms

The Terraform stack now creates alarms for:

- EC2 status check failures
- EC2 high CPU
- RDS high CPU
- RDS low free storage
- ElastiCache high CPU
- CloudFront elevated 5xx error rate

Optional email notifications:

1. Set `alert_email` in `infra/terraform/terraform.tfvars`
2. Run `terraform apply -auto-approve`
3. Confirm the SNS email subscription from your inbox

If `alert_email` is blank, alarms are still created, but no email notifications are sent.

## Recommended SLO targets

- `p95 latency < 1500 ms`
- `error rate < 2%`
- `health endpoint success = 100%`
- `CloudFront 5xx error rate < 1%`

## k6 load test

Install `k6`, then run:

```powershell
k6 run -e BASE_URL=https://d1lpodsrx5kui4.cloudfront.net docs/load-test-k6.js
```

For a stronger run:

```powershell
k6 run --vus 25 --duration 5m -e BASE_URL=https://d1lpodsrx5kui4.cloudfront.net docs/load-test-k6.js
```

What it checks:

- `GET /health`
- `GET /v1/models`
- `POST /v1/predictions`

Thresholds are currently defined inside the script:

- `http_req_failed < 2%`
- `p95 http_req_duration < 1500 ms`
