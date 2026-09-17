FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY backend ./backend
COPY ai ./ai
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir ./backend './ai[vision]'
COPY data/samples ./data/samples
COPY models/registry.json ./models/registry.json
COPY scripts/cloud-start.py ./scripts/cloud-start.py
ENV PYTHONPATH=/app/backend/src:/app/ai/src
CMD ["python", "scripts/cloud-start.py"]
