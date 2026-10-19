# ========================================================
# AgentFlow - Production Multi-Stage Dockerfile
# ========================================================

# Stage 1: Build the React + Vite frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime serving unified FastAPI backend & frontend SPA
FROM python:3.11-slim AS runtime
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure workspace directory exists for sandboxed tools
RUN mkdir -p /app/workspace

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    WORKSPACE_DIR=/app/workspace \
    PORT=8000 \
    HOST=0.0.0.0

EXPOSE 8000

# Start FastAPI application
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
