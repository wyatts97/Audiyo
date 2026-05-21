#!/bin/sh
set -e

echo "Starting audiyo..."

# Ensure data directories exist and are writable (volume mounts may create as root)
mkdir -p /data/incoming /data/processing /data/library /config
chown -R audiyo:audiyo /data /config

# Start backend as audiyo user
cd /app/backend
su audiyo -s /bin/sh -c "node dist/index.js" &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 3

# Start frontend as audiyo user on port 3000
cd /app/frontend
su audiyo -s /bin/sh -c "PORT=3000 npm start" &
FRONTEND_PID=$!

echo "audiyo started!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" SIGTERM SIGINT

# Wait for processes
wait
