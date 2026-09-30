#!/bin/bash
# `expo start --tunnel` uses @expo/ngrok, a JS wrapper built for ngrok's old v2
# local API — incompatible with modern ngrok v3 accounts, no matter the token.
# ngrok itself (even used standalone) also shows a "you're about to visit..."
# interstitial page to browser-like clients on the free tier, which Expo Go
# hits and misreports as an account/sign-in error.
# Cloudflare's free quick tunnels (`cloudflared`) have neither problem: no
# account, no token, no interstitial. This script runs one pointed at Metro's
# port and tells Expo about the public URL via EXPO_PACKAGER_PROXY_URL so it
# writes the bare tunnel host into the manifest instead of `<host>:8081`
# (unreachable — the tunnel only serves 443).
set -euo pipefail

PORT="${1:-8081}"
CLOUDFLARED_BIN="$(which -a cloudflared 2>/dev/null | grep -v node_modules | head -1 || true)"

if [ -z "$CLOUDFLARED_BIN" ]; then
  echo "cloudflared not found. Install it with: brew install cloudflared" >&2
  exit 1
fi

LOG="$(mktemp)"
"$CLOUDFLARED_BIN" tunnel --url "http://localhost:$PORT" > "$LOG" 2>&1 &
CF_PID=$!
trap 'kill "$CF_PID" 2>/dev/null' EXIT

echo "Starting Cloudflare tunnel on port $PORT..."
URL=""
for _ in $(seq 1 30); do
  URL="$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  if [ -n "$URL" ]; then break; fi
  sleep 0.5
done

if [ -z "$URL" ]; then
  echo "Timed out waiting for the Cloudflare tunnel URL. Log:" >&2
  cat "$LOG" >&2
  exit 1
fi

echo "Tunnel ready: $URL"
EXPO_PACKAGER_PROXY_URL="$URL" npx expo start
