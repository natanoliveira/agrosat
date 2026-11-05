FROM python:3.12-slim
WORKDIR /app
# rasterio usa wheels manylinux (GDAL embutido): sem GDAL de sistema (arm64/amd64)
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY app app
COPY scripts scripts
COPY fixtures/demo-plots.geojson fixtures/demo-plots.geojson
RUN python scripts/gen_fixtures.py fixtures/data
ENV DATA_DIR=/data FIXTURES_DIR=/app/fixtures DATA_MODE=auto
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
