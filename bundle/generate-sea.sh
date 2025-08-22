#!/bin/sh

BIN="$1"

# Checking that the path to the binary file is passed as an argument
if [ -z "$BIN" ]; then
  echo "Usage: $0 <path_to_binary_file>"
  exit 1
fi

# Generate binary
rm -rf "$BIN" && rm -rf sea-prep.blob && \
mkdir -p "$(dirname "$BIN")" && \
echo '{ "main": "dist/bundle/main.cjs", "output": "sea-prep.blob" }' > sea-config.json && \
node --experimental-sea-config sea-config.json && \
cp "$(command -v node)" "$BIN" && \
npx -y postject "$BIN" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 && \
strip --strip-unneeded "$BIN"
