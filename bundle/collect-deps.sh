#!/bin/ash
set -o pipefail
set -e

BIN="$1"

# Checking that the path to the binary file is passed as an argument
if [ -z "$BIN" ]; then
  echo "Usage: $0 <path_to_binary_file>"
  exit 1
fi

mkdir -p /deps/lib /deps/usr/lib

ldd "$BIN" | awk '{print $3}' | grep -vE '^$' | while read -r lib; do
  if [ -f "$lib" ]; then
    if [ "${lib#/usr/lib/}" != "$lib" ]; then
      cp "$lib" /deps/usr/lib/
    elif [ "${lib#/lib/}" != "$lib" ]; then
      cp "$lib" /deps/lib/
    fi
  fi
done
