#!/bin/sh
# Start API server in the background, then start frontend
cd "$(dirname "$0")/.."
pnpm --filter @workspace/api-server run build &
pnpm --filter @workspace/api-server run start &
sleep 4
pnpm --filter @workspace/focusarx run dev
