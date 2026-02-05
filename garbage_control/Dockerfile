FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev \
    libgeos-dev \
    gcc \
    && pip install --no-cache-dir --retries 10 --timeout 120 -r /app/requirements.txt \
    && pip uninstall -y opencv-python \
    && pip install --no-cache-dir opencv-python-headless \
    && apt-get purge -y --auto-remove gcc \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
