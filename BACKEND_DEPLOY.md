# Backend Deploy

This repo is set up so the FastAPI backend can be deployed with Docker on Render, Railway, or Fly.io.

## Files added

- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `requirements.txt`

## Environment variables

- `PORT`
  Usually provided by the host platform.
- `FRONTEND_ORIGINS`
  Comma-separated allowed frontend origins for CORS.
  Example:
  `https://your-app.vercel.app,https://your-custom-domain.com`

If `FRONTEND_ORIGINS` is omitted, the backend falls back to `*`.

## Render

1. Push the repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. If using the Blueprint flow, Render will detect `render.yaml`.
4. Set `FRONTEND_ORIGINS` to your Vercel frontend URL.
5. Deploy.

Render will build from the root `Dockerfile` and expose:

`uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Railway

1. Create a new project from the GitHub repo.
2. Railway should detect the root `Dockerfile`.
3. Add:
   - `FRONTEND_ORIGINS=https://your-app.vercel.app`
4. Deploy.

## Fly.io

1. Create an app linked to this repo.
2. Use the root `Dockerfile`.
3. Set:
   - `FRONTEND_ORIGINS=https://your-app.vercel.app`
4. Expose the HTTP service.

## Notes

- The image includes the current local dataset artifacts:
  - `Train_Dst_NoAuction_ZScore_CF_1.csv`
  - `spy_returns_normalized.npy`
  - `spy_data.npy`
  - `sp_math_metadata.json`
  - `lob_scan_cache.json`
  - `lob_cache/`
- WebSocket routes are part of the FastAPI app, so choose a backend platform that supports long-lived connections well.
- For Vercel frontend deployment, keep `client/` as the Vercel root directory and set:
  - `VITE_API_BASE_URL`
  - `VITE_WS_BASE_URL`
