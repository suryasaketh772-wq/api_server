# ==========================================
# STAGE 1: Builder Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY dashboard/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy dashboard frontend files
COPY dashboard/ ./

# Set build-time variables (queries relative routes in Nginx proxy setups)
ENV NEXT_PUBLIC_BACKEND_URL=""

# Compile standard production static/dynamic NextJS bundles
RUN npm run build

# ==========================================
# STAGE 2: Secure Production Runner
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create a secure, non-privileged system user for container execution
RUN addgroup --system --gid 10002 nodejs && \
    adduser --system --uid 10002 -G nodejs nextjs

# Copy built code layers
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Apply permissions ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to the non-root execution context
USER nextjs

EXPOSE 3000

# Launch production NextJS server on port 3000
CMD ["npm", "run", "start"]
