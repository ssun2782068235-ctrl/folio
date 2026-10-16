FROM python:3.12-slim
WORKDIR /app
COPY index.html server.py ./
COPY js ./js
COPY css ./css
ENV PYTHONUNBUFFERED=1
ENV PORT=7860
EXPOSE 7860
CMD ["python3", "server.py"]
