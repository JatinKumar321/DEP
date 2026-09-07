FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY src ./src
COPY SPYUS500.rda ./SPYUS500.rda
COPY Train_Dst_NoAuction_ZScore_CF_1.csv ./Train_Dst_NoAuction_ZScore_CF_1.csv
COPY spy_data.npy ./spy_data.npy
COPY spy_returns_normalized.npy ./spy_returns_normalized.npy
COPY sp_math_metadata.json ./sp_math_metadata.json
COPY lob_scan_cache.json ./lob_scan_cache.json
COPY lob_cache ./lob_cache

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
