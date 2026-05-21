# Build stage for frontend
FROM node:20-alpine AS frontend-builder
ARG NEXT_PUBLIC_BACKEND_PORT=4873
ENV NEXT_PUBLIC_BACKEND_PORT=${NEXT_PUBLIC_BACKEND_PORT}
WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend ./
RUN npm run build
RUN npm prune --production

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY app/backend/package*.json ./
RUN npm ci
COPY app/backend ./
RUN npm run build
RUN npm prune --production

# Production image
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    libstdc++ \
    && ln -sf python3 /usr/local/bin/python

# Install Python dependencies from requirements.txt
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# Create app user (Alpine syntax)
RUN adduser -D -s /bin/sh audiyo

# Set up directories
RUN mkdir -p /app /data/incoming /data/processing /data/library /config \
    && chown -R audiyo:audiyo /app /data /config

WORKDIR /app

# Copy backend (production only)
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Copy frontend (production only)
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Set ownership
RUN chown -R audiyo:audiyo /app

USER audiyo

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
COPY --chown=audiyo:audiyo docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
