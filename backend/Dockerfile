# ==========================================
# STAGE 1: Builder Stage
# ==========================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install compilation tools needed for potential native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies into a localized wheel folder
RUN pip install --no-cache-dir --user -r requirements.txt

# ==========================================
# STAGE 2: Secure Production Runtime
# ==========================================
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/home/appuser/.local/bin:${PATH}"

# Create a secure, non-privileged system user for process isolation
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /sbin/nologin appuser

# Copy installed site-packages from Builder Stage
COPY --from=builder --chown=appuser:appgroup /root/.local /home/appuser/.local
COPY --chown=appuser:appgroup app/ ./app/

# Switch to the non-root application user
USER appuser

EXPOSE 8000

# Health check configuration to ensure container status is monitored
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Run Gunicorn with a single Uvicorn worker to maintain a single upstream polling source
CMD ["gunicorn", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
