# Multi-stage build for optimal size
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy frontend source
COPY . .

# Build frontend
RUN pnpm run build

# Backend stage
FROM node:18-alpine AS backend-builder

WORKDIR /app/server

# Copy server package files
COPY server/package.json ./
RUN npm install --production

# Final stage
FROM node:18-alpine

WORKDIR /app

# Install Python for optional ML inference
RUN apk add --no-cache python3 py3-pip

# Copy server files
COPY --from=backend-builder /app/server ./server
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Create models directory for ONNX models
RUN mkdir -p ./dist/models

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "server/index.js"]