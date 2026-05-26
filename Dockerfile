# =========================================================
# STAGE 1: Compile Next.js Admin Dashboard Frontend
# =========================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci --legacy-peer-deps

COPY dashboard/ ./
ENV NEXT_PUBLIC_BACKEND_URL=""
RUN npm run build

# =========================================================
# STAGE 2: Compile Python Backend Dependencies
# =========================================================
FROM python:3.12-slim AS backend-builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# =========================================================
# STAGE 3: Unified Production Container Runner (Python + Node)
# =========================================================
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/home/appuser/.local/bin:${PATH}" \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# 1. Install Node.js runtime inside the Debian/Python image
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Create secure non-root system user for sandbox isolation
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /sbin/nologin appuser

# 3. Copy python packages from Stage 2 builder
COPY --from=backend-builder --chown=appuser:appgroup /root/.local /home/appuser/.local

# 4. Copy backend module files into the unified root
COPY --chown=appuser:appgroup backend/app/ ./backend/app/
COPY --chown=appuser:appgroup admin_api/ ./admin_api/
COPY --chown=appuser:appgroup websocket/ ./websocket/
COPY --chown=appuser:appgroup metrics/ ./metrics/
COPY --chown=appuser:appgroup monitoring/ ./monitoring/

# 5. Copy built Next.js Dashboard layers from Stage 1 builder
COPY --from=frontend-builder --chown=appuser:appgroup /app/dashboard/package*.json ./dashboard/
COPY --from=frontend-builder --chown=appuser:appgroup /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=frontend-builder --chown=appuser:appgroup /app/dashboard/.next ./dashboard/.next
COPY --from=frontend-builder --chown=appuser:appgroup /app/dashboard/public ./dashboard/public

# 6. Copy and configure process manager entrypoint script
COPY --chown=appuser:appgroup docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Apply final folder permissions ownership
RUN chown -R appuser:appgroup /app

# Switch process execution to secure system user
USER appuser

# Ports: 8000 (FastAPI Backend), 3000 (Next.js Frontend)
EXPOSE 8000 3000

# Health check verifies the backend is responsive
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
