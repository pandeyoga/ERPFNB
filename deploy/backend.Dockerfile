# Backend FastAPI. Dibangun dari root repo: `docker compose build backend` (lihat docs/DEPLOY.md).
FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libmagic1: deteksi tipe file upload (python-magic)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/erp/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# scripts/ dipakai seed_reset.sh dan skrip pemeliharaan (dijalankan dari /srv/erp)
COPY scripts/ /srv/erp/scripts/

# Data yang harus bertahan antar-deploy ada di /data (volume): upload & kunci enkripsi secret.
ENV UPLOAD_DIR=/data/uploads \
    SECRETS_KEY_FILE=/data/secrets/.app_secret
RUN useradd --system --create-home --uid 10001 erp \
    && mkdir -p /data/uploads /data/secrets \
    && chown -R erp:erp /data
USER erp

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/api/health', timeout=4).status == 200 else 1)"

# Satu proses: scheduler (job terjadwal & otomasi AI) jalan di proses backend — jangan pakai --workers > 1.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
