FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home softgraph && mkdir /data && chown softgraph /data
COPY app ./app
COPY evaluation ./evaluation
USER softgraph
ENV SOFTGRAPH_ENV=production SOFTGRAPH_INGESTION_DB=/data/course.sqlite3 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3)"
# One process owns recovery/queues; scaling needs an external worker coordinator.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
