# backend/Dockerfile
# Fly.io deployment for ChessWeb backend (Node.js + Socket.IO + Stockfish)

FROM node:20-slim AS base

# Install dependencies needed to download Stockfish
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and install dependencies first (for Docker layer caching)
COPY package.json ./
RUN npm install --production

# Download Stockfish chess engine to the expected path (../chessengines/ relative to server.js)
# server.js uses:  ENGINES_DIR = path.join(__dirname, '../chessengines')
# Since WORKDIR is /app and server.js is at /app/server.js, Stockfish needs to be at /chessengines/
RUN mkdir -p /chessengines && \
    curl -L --fail -o /tmp/stockfish.tar \
    "https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64-avx2.tar" && \
    tar -xf /tmp/stockfish.tar -C /chessengines && \
    STOCKFISH_BIN=$(find /chessengines -name "stockfish-ubuntu-x86-64-avx2" -type f | head -1) && \
    if [ -n "$STOCKFISH_BIN" ] && [ "$STOCKFISH_BIN" != "/chessengines/stockfish-ubuntu-x86-64-avx2" ]; then \
      mv "$STOCKFISH_BIN" /chessengines/stockfish-ubuntu-x86-64-avx2; \
    fi && \
    chmod +x /chessengines/stockfish-ubuntu-x86-64-avx2 && \
    find /chessengines -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} + 2>/dev/null; \
    rm -f /tmp/stockfish.tar

# Verify Stockfish is installed
RUN test -x /chessengines/stockfish-ubuntu-x86-64-avx2 || (echo "Stockfish NOT found" && exit 1)

# Copy application code
COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
