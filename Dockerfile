# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend ./
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY app/backend/package*.json ./
RUN npm ci
COPY app/backend ./
RUN npm run build

# Production image
FROM python:3.11-slim

# Install system dependencies (non-AVX compatible)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from requirements.txt
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Create app user
RUN useradd -m -s /bin/bash synchrio

# Set up directories
RUN mkdir -p /app /data/incoming /data/processing /data/library /config \
    && chown -R synchrio:synchrio /app /data /config

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Copy frontend
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Set ownership
RUN chown -R synchrio:synchrio /app

USER synchrio

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_URL=http://localhost:3000
ENV DATA_DIR=/data
ENV LIBRARY_DIR=/data/library
ENV YT_DLP_PATH=yt-dlp

# Expose ports
EXPOSE 3000 3001

# Start script
COPY --chown=synchrio:synchrio docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
