FROM node:20-slim

# Install system dependencies for Python and GDAL (required for geopandas/fiona)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python geospatial dependencies
RUN pip install --no-cache-dir fiona geopandas

# Set working directory for Node.jsapp
WORKDIR /usr/src/app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Ensure the Python script is executable
RUN chmod +x extract_fgdb.py

# Expose the Cloud Run port (Cloud Run sets PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]
