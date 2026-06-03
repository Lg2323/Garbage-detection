FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN (sed -ri 's|http://deb.debian.org/debian|http://mirror.yandex.ru/debian|g; s|http://security.debian.org/debian-security|http://mirror.yandex.ru/debian-security|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources || true) \
    && printf 'Acquire::ForceIPv4 "true";\nAcquire::Retries "10";\nAcquire::http::Timeout "60";\nAcquire::https::Timeout "60";\n' > /etc/apt/apt.conf.d/99network \
    && apt-get update \
    && apt-get install -y --no-install-recommends --fix-missing \
    gdal-bin libgdal-dev \
    libgeos-dev \
    libglib2.0-0 \
    libgl1 \
    libxext6 \
    libxrender1 \
    libsm6 \
    libxcb1 \
    gcc \
    && pip install --no-cache-dir --retries 10 --timeout 120 -r /app/requirements.txt \
    && pip uninstall -y opencv-python \
    && pip install --no-cache-dir --no-deps opencv-python-headless \
    && pip install --no-cache-dir numpy==1.26.4 \
    && apt-get purge -y --auto-remove gcc \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
