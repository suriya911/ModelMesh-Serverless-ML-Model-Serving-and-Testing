# ModelMesh Development Plan

## 1. Purpose

This plan converts the design document and the current frontend into an implementation roadmap for a production-ready ModelMesh platform:

- Frontend hosted on Vercel
- Backend and data services hosted on AWS
- ML models sourced from Hugging Face
- One stable API that supports model comparison, live inference, monitoring, and future multi-model routing

The current repository contains a frontend-only dashboard. The file [frontend/src/lib/ml-api.ts](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/lib/ml-api.ts) is a mock in-memory service and should be replaced by real HTTP calls to the backend.

## 2. Current State Assessment

### Existing frontend capabilities

The UI already has usable screens for:

- Dataset upload and model comparison
- Live inference submission
- Prediction result rendering
- Metrics summary cards
- Prediction logs / monitoring views

Relevant frontend entry points:

- [frontend/src/pages/Dashboard.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/pages/Dashboard.tsx)
- [frontend/src/components/dashboard/DataUploadPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/DataUploadPanel.tsx)
- [frontend/src/components/dashboard/PredictionPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/PredictionPanel.tsx)
- [frontend/src/components/dashboard/MetricsPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/MetricsPanel.tsx)
- [frontend/src/components/dashboard/MonitoringPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/MonitoringPanel.tsx)

### Gaps

- No backend application exists in the repo yet
- No persistent storage exists for models, tenants, logs, or metrics
- No production API contract exists
- No AWS infrastructure code exists
- No Hugging Face model integration exists
- The frontend uses simulated model outputs instead of real inference

## 3. Recommended Production Architecture

### Baseline architecture

Use a low-cost modular architecture that preserves the document’s control-plane and data-plane split without introducing Kubernetes on day one.

#### Frontend

- Vercel hosts the React app
- Vercel environment variable `VITE_API_BASE_URL` points to AWS API domain
- Frontend calls backend over HTTPS only

#### Edge and API

- AWS API Gateway as the public API entrypoint
- AWS WAF attached to API Gateway
- Route 53 + ACM for domain and TLS
- Optional CloudFront later if file delivery or caching becomes important

#### Backend services

- FastAPI application for control plane and public API
- Deployed on AWS ECS Fargate for the first production version
- One service initially, split later into:
  - API/control plane
  - async worker
  - dedicated router service if traffic justifies it

#### Data and state

- Amazon RDS PostgreSQL for registry, tenant, request, and rollout metadata
- Amazon ElastiCache Redis for cache, warm-state tracking, rate limiting, and job coordination
- Amazon S3 for uploaded datasets, manifests, and cached artifacts metadata

#### Model execution

- Hugging Face models as the initial source of truth for model artifacts
- CPU-first inference containers by default
- Optional GPU service introduced only for models that require it
- Model runtime downloads artifacts from Hugging Face and stores them in local ephemeral cache plus S3-backed metadata

#### Async and observability

- SQS for background jobs
- ECS worker service for warmup, prefetch, evaluation, and comparison jobs
- CloudWatch logs and metrics from day one
- OpenTelemetry tracing exported to CloudWatch or Grafana stack later

## 4. Why ECS Fargate First

The source document mentions FastAPI on one VM as the cheapest starting point. Given your target is AWS backend plus Vercel frontend and you want a production path, ECS Fargate is the better first production choice because it removes VM patching and keeps deployment simple.

Use this sequence:

1. `Phase 1`: One FastAPI ECS service, one worker ECS service, one Redis, one Postgres, one S3 bucket.
2. `Phase 2`: Add autoscaling, canary release support, and dedicated model runtimes.
3. `Phase 3`: Add GPU-backed inference only where needed.

## 5. Frontend-to-Backend Contract

Replace the mock `ml-api.ts` interface with a typed API client that calls these endpoints.

### Inference APIs

`POST /v1/predictions`

Request:

```json
{
  "input": "sample text",
  "model_id": "sentiment-model-v1",
  "routing_mode": "auto",
  "tenant_id": "tenant_123",
  "request_id": "optional-client-id"
}
```

Response:

```json
{
  "id": "pred_123",
  "prediction": "positive",
  "model": "sentiment-model-v1",
  "confidence": 0.94,
  "latency_ms": 132,
  "timestamp": "2026-03-10T18:30:00Z",
  "cached": false,
  "backend": "cpu-runtime-a"
}
```

### Model comparison APIs

`POST /v1/comparisons`

Purpose:

- Accept dataset upload metadata or S3 object reference
- Run comparison job asynchronously
- Return a job ID

`GET /v1/comparisons/{job_id}`

Purpose:

- Return comparison status and final metrics payload
- Match the current `ComparisonResult` shape used by the frontend

### Monitoring APIs

`GET /v1/system/metrics`

Purpose:

- Return request volume, latency, cache hit rate, success rate, and model usage

`GET /v1/system/logs`

Purpose:

- Return latest prediction events for the monitoring table

### Model registry APIs

`GET /v1/models`
`POST /v1/models`
`PATCH /v1/models/{model_id}`
`POST /v1/models/{model_id}/activate`
`POST /v1/models/{model_id}/deactivate`

Purpose:

- Register Hugging Face-backed models
- Store task type, revision, hardware requirements, activation status, and rollout policy

## 6. Frontend Integration Plan

### Immediate frontend changes

1. Replace [frontend/src/lib/ml-api.ts](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/lib/ml-api.ts) with a real API client module.
2. Add environment-based API base URL handling for Vercel.
3. Convert comparison flow from synchronous fake results to async job polling.
4. Add loading, error, and empty states for failed backend calls.
5. Add auth token support once tenant auth is added.

### Component mapping

- [frontend/src/components/dashboard/PredictionPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/PredictionPanel.tsx)
  - Call `POST /v1/predictions`
  - Replace `model_a` / `model_b` with backend `model_id` values or A/B aliases

- [frontend/src/components/dashboard/DataUploadPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/DataUploadPanel.tsx)
  - Upload file to S3 using pre-signed URL
  - Submit comparison job with uploaded file reference

- [frontend/src/components/dashboard/MetricsPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/MetricsPanel.tsx)
  - Fetch from `GET /v1/system/metrics`

- [frontend/src/components/dashboard/MonitoringPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/MonitoringPanel.tsx)
  - Fetch from `GET /v1/system/logs`

- [frontend/src/components/dashboard/ModelComparisonPanel.tsx](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/components/dashboard/ModelComparisonPanel.tsx)
  - Keep current rendering structure
  - Back it with real comparison payloads from backend evaluation jobs

## 7. Backend Service Design

### Initial services

Create these backend folders:

```text
apps/api/
apps/worker/
shared/schemas/
infra/terraform/
docs/
```

### `apps/api` responsibilities

- Expose public REST API
- Validate requests with Pydantic
- Authenticate tenants
- Route prediction requests
- Read and write registry metadata
- Publish async jobs to SQS
- Emit structured logs and traces

### `apps/worker` responsibilities

- Process comparison jobs
- Pull datasets from S3
- Warm models on schedule
- Prefetch popular Hugging Face models
- Recompute periodic health and cost metrics

### Model router logic

Start simple:

- Resolve `model_id` to active model version in Postgres
- Check Redis for warm instance metadata
- If warm instance exists, route immediately
- If not warm, load the model in the runtime container and mark warm state in Redis
- Record latency, cache, and model usage metrics

## 8. Hugging Face Integration Plan

### Model source strategy

Use Hugging Face as the initial model registry source, but do not make the public API directly dependent on Hugging Face availability.

Store per model:

- `model_id`
- `hf_repo_id`
- `hf_revision`
- `task_type`
- `framework`
- `hardware_class`
- `max_concurrency`
- `warm_pool_min`
- `status`

### Runtime behavior

1. Backend receives a request for a model.
2. Registry returns the Hugging Face repo and revision.
3. Runtime checks local cache.
4. If missing, runtime downloads model artifacts from Hugging Face.
5. Runtime loads pipeline or model class into memory.
6. Runtime serves inference and emits metrics.

### Recommended initial model types

Start with CPU-friendly Hugging Face tasks:

- text classification
- zero-shot classification
- sentence similarity / embeddings
- summarization for smaller models

Avoid GPU-heavy LLM hosting in the first release unless you already know the specific business case.

## 9. AWS Infrastructure Plan

### Phase 1 stack

- API Gateway
- WAF
- ECS cluster
- ECS service for API
- ECS service for worker
- ECR repositories
- RDS PostgreSQL
- ElastiCache Redis
- S3 bucket for datasets and manifests
- SQS queue
- IAM roles and secrets in Secrets Manager
- CloudWatch dashboards and alarms

### Networking

- One VPC
- Public subnets for load balancer or API-facing components
- Private subnets for ECS, RDS, Redis
- NAT gateway only if strictly required for outbound traffic

Cost note:

- NAT gateways can become a hidden baseline cost. If cost is critical, design the network to minimize or defer NAT usage where practical.

## 10. Security Plan

- JWT-based tenant authentication
- API keys only for internal service-to-service paths if needed
- Secrets in AWS Secrets Manager
- PII-safe logging with request body redaction
- S3 bucket policies locked to application roles
- Per-tenant quotas and request throttling
- WAF rules for abuse protection
- Signed upload URLs for datasets

## 11. CI/CD Plan

### Frontend

- GitHub Actions builds and tests frontend
- Deploy to Vercel on main branch
- Preview deployments for pull requests

### Backend

- GitHub Actions builds Docker images
- Push images to ECR
- Run database migrations
- Deploy ECS task definitions
- Promote through `dev`, `staging`, and `prod`

### Model rollout

Separate application deployment from model rollout:

- App release changes code
- Model release changes registry metadata and rollout policy
- Support canary percentages and instant rollback to previous revision

## 12. Observability Plan

Track these from the first backend release:

- request count
- latency p50/p95/p99
- cache hit rate
- cold start count
- model load duration
- per-model traffic
- per-tenant traffic
- error rate
- comparison job duration
- Hugging Face download failures

Minimum dashboards:

- API health
- inference performance
- model popularity
- worker queue depth
- cost signals

## 13. Development Phases

### Phase 0: Foundation

Goal:

- Prepare repo and contracts

Deliverables:

- Backend folder structure
- OpenAPI schema
- Shared request/response contracts
- Terraform skeleton
- Environment variable conventions for Vercel and AWS

Exit criteria:

- Frontend can compile against typed API interfaces without mocks

### Phase 1: End-to-End MVP

Goal:

- Real inference from frontend through AWS backend to Hugging Face-backed models

Deliverables:

- FastAPI service on ECS
- `POST /v1/predictions`
- Model registry tables in Postgres
- Redis cache
- One or two Hugging Face CPU models
- Metrics and logs endpoints
- Vercel frontend connected to AWS API

Exit criteria:

- User can submit inference from Vercel UI and receive real predictions from AWS

### Phase 2: Comparison Jobs

Goal:

- Replace simulated model comparison with real async evaluation

Deliverables:

- S3 upload flow
- `POST /v1/comparisons`
- `GET /v1/comparisons/{job_id}`
- Worker job processing
- Result persistence

Exit criteria:

- Uploaded dataset produces real comparison metrics in dashboard

### Phase 3: Production Hardening

Goal:

- Make the system safe for external users

Deliverables:

- authentication
- tenant quotas
- alarms
- retry and timeout policies
- WAF rules
- CI/CD pipelines
- canary model rollout

Exit criteria:

- Staging and production environments are repeatable and observable

### Phase 4: Cost and Scale Optimization

Goal:

- Reduce spend and improve latency under mixed traffic

Deliverables:

- warm-pool policy
- popularity-based prefetch
- model lifecycle rules
- response caching policy
- autoscaling rules
- optional GPU runtime path

Exit criteria:

- measurable reduction in cold starts and infrastructure cost per request

## 14. Suggested 8-Week Execution Schedule

### Weeks 1-2

- Create backend repo structure
- Define OpenAPI schema
- Implement FastAPI skeleton
- Create Terraform base modules
- Replace frontend mock client with HTTP client abstraction

### Weeks 3-4

- Add Postgres schema and migrations
- Add Redis caching
- Implement Hugging Face model registry and inference path
- Deploy first API service to AWS dev environment

### Weeks 5-6

- Connect Vercel frontend to dev API
- Add metrics/logs endpoints
- Implement S3 upload and async comparison jobs
- Add worker service

### Weeks 7-8

- Add auth, quotas, alarms, and deployment pipeline
- Run load and failure testing
- Prepare staging and production rollout

## 15. Risks and Mitigations

- Cold starts are too visible
  - Mitigation: keep top models warm in Redis-tracked warm pool

- Hugging Face artifact pulls are slow or fail
  - Mitigation: pin revisions, cache artifacts, retry downloads, mirror metadata in Postgres

- Frontend contract drift breaks the dashboard
  - Mitigation: generate typed client from OpenAPI and add contract tests

- AWS cost grows unexpectedly
  - Mitigation: start CPU-only, monitor NAT and Redis costs, avoid premature GPU usage

- Comparison jobs block the API
  - Mitigation: run all heavy evaluation asynchronously through SQS + worker

## 16. Immediate Next Actions

The next implementation steps should be:

1. Create `apps/api`, `apps/worker`, `shared/schemas`, and `infra/terraform`.
2. Define OpenAPI contracts matching the current frontend result shapes.
3. Replace the mock [frontend/src/lib/ml-api.ts](/D:/ModelMesh-Serverless-ML-Model-Serving-and-Testing/frontend/src/lib/ml-api.ts) with a real fetch-based client.
4. Stand up AWS dev infrastructure for ECS, RDS, Redis, S3, and SQS.
5. Implement `POST /v1/predictions` with one Hugging Face text classification model.
6. Point the Vercel frontend at the AWS dev API and test end-to-end.

## 17. Final Recommendation

Do not build the first release as a complex multi-service mesh. Build a strong, small production core:

- Vercel for frontend
- FastAPI on ECS Fargate for API
- Postgres + Redis + S3 on AWS
- SQS + worker for async jobs
- Hugging Face for model sourcing

That gives you a low-cost but production-capable path, and it fits the current frontend with minimal redesign.
