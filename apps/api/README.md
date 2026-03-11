# ModelMesh API

Local development:

```bash
python -m uvicorn apps.api.main:app --reload
```

The frontend should point `VITE_API_BASE_URL` at `http://localhost:8000`.

Optional environment variables:

- `HF_API_TOKEN` or `HUGGINGFACEHUB_API_TOKEN`: token for Hugging Face inference API
- `HF_TIMEOUT_SECONDS`: request timeout for Hugging Face calls
- `DATABASE_URL`: defaults to `sqlite:///./modelmesh.db`; set this to Postgres in AWS
- `REDIS_URL`: Redis endpoint used for runtime cache/metrics state
- `ALLOWED_ORIGINS`: comma-separated list of frontend origins allowed by CORS

Schema migrations:

```bash
python -m alembic upgrade head
```

The API startup also runs migrations automatically before serving requests.
