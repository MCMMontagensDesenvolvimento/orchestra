FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system bridge && useradd --system --gid bridge --home-dir /app bridge

COPY requirements.txt ./
RUN python -m pip install --requirement requirements.txt

COPY app.py bridge.py contract.py healthcheck.py ./

USER bridge
EXPOSE 8091

CMD ["python", "app.py"]

