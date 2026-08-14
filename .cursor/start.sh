#!/usr/bin/env bash
#
# FF-IVY Cloud Agent start script.
#
# Brings up the runtime services, then runs the Next.js dev server in the
# foreground (attached) as the primary process:
#   1. PostgreSQL (self-daemonizing)
#   2. Neon-over-HTTP proxy on https://localhost:443 (supporting daemon)
#   3. `next dev` on http://localhost:3000 (foreground)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROXY_DIR="$ROOT/.cursor/neon-proxy"
CERT="$PROXY_DIR/certs/localhost-cert.pem"

echo "[start] Starting PostgreSQL..."
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "[start] Ensuring the Neon HTTP proxy is running on :443..."
if ! curl -sk https://localhost/health >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  # Supporting daemon: must bind privileged port 443 and outlive this shell.
  sudo NEON_PROXY_PORT=443 "$NODE_BIN" "$PROXY_DIR/server.js" >/tmp/neon-proxy.log 2>&1 &
  for _ in $(seq 1 30); do
    if curl -sk https://localhost/health >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

if curl -sk https://localhost/health >/dev/null 2>&1; then
  echo "[start] Neon proxy healthy."
else
  echo "[start] WARNING: Neon proxy did not become healthy; see /tmp/neon-proxy.log" >&2
fi

# Must be a real OS env var before node starts so its TLS store trusts the proxy.
export NODE_EXTRA_CA_CERTS="$CERT"

echo "[start] Launching Next.js dev server on http://localhost:3000 ..."
exec npm run dev
