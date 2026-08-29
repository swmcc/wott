#!/usr/bin/env bash
# Build the web app, sync it into the iOS project, and (re)launch on the
# simulator — the full exact cycle in one command: `npm run ios`.
# Targets the already-booted simulator when there is one; otherwise
# Capacitor prompts for a device.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

target=$(xcrun simctl list devices booted | grep -oE '[A-F0-9-]{36}' | head -1 || true)
if [ -n "$target" ]; then
	exec npx cap run ios --target "$target"
fi
exec npx cap run ios
