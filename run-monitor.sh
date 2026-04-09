#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Check if dev server is running
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q 200; then
  cd /Users/elainewang/Downloads/content-monitor
  npm run dev -- -p 3001 &
  sleep 8
fi

# Run monitor
curl -s -X POST http://localhost:3001/api/monitor \
  -H 'Content-Type: application/json' \
  -d '{"action":"run"}' >> /Users/elainewang/Downloads/content-monitor/data/monitor.log 2>&1

echo "" >> /Users/elainewang/Downloads/content-monitor/data/monitor.log
date >> /Users/elainewang/Downloads/content-monitor/data/monitor.log
