#!/bin/bash
set -e

echo "Starting Synchrio..."

# Start backend
cd /app/backend
node dist/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 3

# Start frontend
cd /app/frontend
npm start &
FRONTEND_PID=$!

echo "Synchrio started!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" SIGTERM SIGINT

# Wait for processes
wait
