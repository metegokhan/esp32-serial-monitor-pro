#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/v2/src-tauri/target/release/v2"
APPIMAGE="$DIR/v2/src-tauri/target/release/bundle/appimage/ESP32 Serial Capture & Monitor Pro_2.0.0_amd64.AppImage"

if [ -f "$BIN" ]; then
    exec "$BIN" "$@"
elif [ -f "$APPIMAGE" ]; then
    exec "$APPIMAGE" "$@"
else
    echo "ESP32 Serial Monitor V2 derleniyor..."
    cd "$DIR/v2"
    pnpm build
    cargo build --release --manifest-path src-tauri/Cargo.toml
    exec "$BIN" "$@"
fi
