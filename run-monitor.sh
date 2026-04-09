#!/bin/bash
# Call Render's monitor endpoint
curl -s -X POST 'https://ai-intel-hub.onrender.com/api/monitor' \
  -H 'Content-Type: application/json' \
  -d '{"action":"run"}' >> /Users/elainewang/Downloads/content-monitor/data/monitor.log 2>&1

echo "" >> /Users/elainewang/Downloads/content-monitor/data/monitor.log
date >> /Users/elainewang/Downloads/content-monitor/data/monitor.log
