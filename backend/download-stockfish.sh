#!/bin/bash
# download-stockfish.sh
# Downloads Stockfish chess engine during Render deployment if not already present
set -e

ENGINE_DIR="$(dirname "$0")/../chessengines"
ENGINE_PATH="$ENGINE_DIR/stockfish-ubuntu-x86-64-avx2"

if [ -x "$ENGINE_PATH" ]; then
    echo "[Stockfish] Already present at $ENGINE_PATH"
    exit 0
fi

echo "[Stockfish] Not found at $ENGINE_PATH, downloading..."

mkdir -p "$ENGINE_DIR"

# Download latest Stockfish Linux x86-64 AVX2 binary
# Official source: https://github.com/official-stockfish/Stockfish/releases
ARCHIVE_NAME="stockfish-ubuntu-x86-64-avx2.tar"
DOWNLOAD_URL="https://github.com/official-stockfish/Stockfish/releases/latest/download/${ARCHIVE_NAME}"

echo "[Stockfish] Downloading from $DOWNLOAD_URL ..."
if command -v curl &> /dev/null; then
    curl -L --fail -o "/tmp/$ARCHIVE_NAME" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget --no-check-certificate -O "/tmp/$ARCHIVE_NAME" "$DOWNLOAD_URL"
else
    echo "[Stockfish] ERROR: Neither curl nor wget found. Cannot download Stockfish."
    exit 1
fi

echo "[Stockfish] Extracting..."
tar -xf "/tmp/$ARCHIVE_NAME" -C "$ENGINE_DIR"

# The tar extracts into a directory named after the version, e.g. stockfish/stockfish-ubuntu-x86-64-avx2
# Find the binary and copy it to the expected path
EXTRACTED_BIN=$(find "$ENGINE_DIR" -name "stockfish-ubuntu-x86-64-avx2" -type f 2>/dev/null | head -1)
if [ -n "$EXTRACTED_BIN" ] && [ "$EXTRACTED_BIN" != "$ENGINE_PATH" ]; then
    mv "$EXTRACTED_BIN" "$ENGINE_PATH"
    # Clean up only the subdirectory the tar extracted into
    EXTRACTED_DIR=$(dirname "$EXTRACTED_BIN")
    rm -rf "$EXTRACTED_DIR"
fi

chmod +x "$ENGINE_PATH"
rm -f "/tmp/$ARCHIVE_NAME"

echo "[Stockfish] Downloaded and installed at $ENGINE_PATH"
