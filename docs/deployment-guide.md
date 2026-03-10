# Deployment Guide

## Goal

Deploy the current app now:

- frontend to Vercel
- backend to AWS as a container

This is valid for a demo or active development environment. It is not the final production architecture yet because the backend still uses SQLite by default.

## Current Deployment Recommendation

### Frontend

- Host the `frontend/` app on Vercel
- Set `VITE_API_BASE_URL` to your AWS backend URL

### Backend

- Build and deploy the root `Dockerfile` to AWS App Runner or ECS Fargate
- For the fastest path, App Runner is simpler
- For longer-term control, ECS Fargate is better

## Important Limitation Right Now

If you deploy the backend exactly as-is with:

`DATABASE_URL=sqlite:///./modelmesh.db`

then:

- logs and seeded data live inside the container filesystem
- data can disappear on container replacement/redeploy
- this is acceptable for demo/dev hosting only

To make it durable, the next step is:

- move `DATABASE_URL` to Postgres on AWS RDS

## Backend Environment Variables

Set these in AWS:

```text
HF_API_TOKEN=your_hugging_face_token
HF_PROVIDER=auto
HF_TIMEOUT_SECONDS=45
DATABASE_URL=sqlite:///./modelmesh.db
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

For a real persistent deployment, replace `DATABASE_URL` with Postgres.

## Vercel Setup

Project root:

```text
frontend
```

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

Environment variable:

```text
VITE_API_BASE_URL=https://your-aws-backend-url
```

## AWS App Runner Setup

### Source

- connect the GitHub repo or push the Docker image to ECR

### Container

- Port: `8000`

### Health check

- Path: `/health`

### Runtime env vars

- set all env vars listed above

## Smoke Test After Deployment

### Backend

1. Open `/health`
2. Open `/v1/models`
3. Send one `POST /v1/predictions`

### Frontend

1. Open the deployed Vercel URL
2. Go to `Dashboard`
3. Run one live inference request
4. Confirm:
   - result card is shown
   - metrics update
   - log row appears

## Recommended Next Infrastructure Step

Before calling this production-ready, do these:

1. Move backend database to AWS RDS Postgres
2. Move metrics/cache state to Redis
3. Restrict `ALLOWED_ORIGINS` to the Vercel domain
4. Store `HF_API_TOKEN` in AWS Secrets Manager
