FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (ci uses lockfile for reproducible builds)
COPY package*.json ./
RUN npm ci --omit=dev=false

# Copy source code and build
COPY . .
RUN npm run build

# ── Final stage: Nginx ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Non-root: nginx master still needs root for port 80, but we drop worker privileges
# via nginx.conf (worker_processes run as nginx user by default in the alpine image)

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health.txt 2>/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
