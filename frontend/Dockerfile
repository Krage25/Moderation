FROM python:3.12.3-slim

WORKDIR /app

# Copy all files into the container
# COPY . .
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 80

# Run Streamlit app
CMD ["streamlit", "run", "app.py", "--server.port=80", "--server.address=0.0.0.0"]
