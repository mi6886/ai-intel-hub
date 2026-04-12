#!/bin/bash
# Content Monitor - periodic fetch + sync to Render
# Runs the local Next.js server temporarily, triggers monitor, then stops.

# Ensure nvm node is in PATH (cron doesn't load shell profile)
export PATH="/Users/elainewang/.nvm/versions/node/v22.19.0/bin:$PATH"

PROJECT_DIR="/Users/elainewang/Downloads/content-monitor"
LOG_FILE="$PROJECT_DIR/data/monitor.log"
PORT=3098

echo "========================================" >> "$LOG_FILE"
date >> "$LOG_FILE"

# Check if server is already running on the port
if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "[monitor] Server already running on port $PORT" >> "$LOG_FILE"
else
  echo "[monitor] Starting Next.js server on port $PORT..." >> "$LOG_FILE"
  cd "$PROJECT_DIR" && npx next start -p $PORT >> "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  # Wait for server to be ready
  for i in $(seq 1 15); do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" | grep -q "200\|404"; then
      break
    fi
    sleep 2
  done
  echo "[monitor] Server started (PID=$SERVER_PID)" >> "$LOG_FILE"
fi

# Trigger monitor run
echo "[monitor] Triggering monitor run..." >> "$LOG_FILE"
RESULT=$(curl -s -m 300 -X POST "http://localhost:$PORT/api/monitor" \
  -H 'Content-Type: application/json' \
  -d '{"action":"run"}')
echo "$RESULT" >> "$LOG_FILE"

# If we started the server, stop it
if [ -n "$SERVER_PID" ]; then
  echo "[monitor] Stopping server (PID=$SERVER_PID)..." >> "$LOG_FILE"
  kill "$SERVER_PID" 2>/dev/null
fi

echo "[monitor] Done." >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
