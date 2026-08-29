#!/bin/bash
# Start the whatisonthe.tv backend for local WOTT development, with the CORS
# origins a device/emulator dev build needs. Requires local Postgres + Redis.
set -euo pipefail

cd "${WOTT_BACKEND_DIR:-$HOME/Code/whatisonthe.tv/backend}"

export CORS_ORIGINS="http://localhost:5173,http://localhost:5174,http://localhost:3000,capacitor://localhost,https://localhost,http://localhost"

exec env PYENV_VERSION=tv-env python3 -m uvicorn app.main:app --port 8000 "$@"
