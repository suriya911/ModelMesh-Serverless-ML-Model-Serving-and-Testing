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
- `ALLOWED_ORIGINS`: comma-separated list of frontend origins allowed by CORS
