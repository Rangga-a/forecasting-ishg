FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code + artifacts
COPY main.py .
COPY data/ ./data/
COPY model/ ./model/
COPY static/ ./static/

# Most PaaS providers (Render, Railway, Fly.io, Cloud Run) inject $PORT at runtime.
# Default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
