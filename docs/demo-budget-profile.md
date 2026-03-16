# Demo-Budget Production Profile

This profile is tuned for a live portfolio/demo deployment that stays close to the AWS free tier and generally below $10/month at light traffic.

## Keep

- Vercel for the frontend
- one EC2 `t3.micro` instance for API + worker
- CloudFront in front of EC2 for HTTPS
- S3 for uploaded datasets
- SQS for async comparison jobs
- local Redis sidecar on EC2
- host-mounted SQLite on EC2 at `/opt/modelmesh/data/modelmesh.db`
- Hugging Face hosted inference for live prediction routing

## Remove or disable

- RDS Postgres
- ElastiCache Redis
- App Runner
- extra managed compute unless traffic justifies it

## Why this works

- the app still has async jobs, queueing, uploads, auth, quotas, and monitoring
- the only always-on compute is one micro EC2 instance
- S3, SQS, and CloudFront cost very little at demo traffic

## Current demo auth model

- API keys are configured through `API_KEYS`
- default demo key format:

```text
demo:modelmesh-demo-key:1000:50:100
```

That means:

- tenant id: `demo`
- API key: `modelmesh-demo-key`
- daily prediction quota: `1000`
- daily comparison quota: `50`
- daily upload quota: `100`

## Upgrade path later

When the project needs real production scale:

1. re-enable RDS
2. re-enable managed Redis
3. move worker from EC2 container to Lambda or ECS
4. add WAF and stronger tenant admin controls
5. run k6 load testing and scale from measured bottlenecks
