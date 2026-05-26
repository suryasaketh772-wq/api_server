#!/bin/bash

# Ensure background processes are terminated if the script exits
trap 'kill $(jobs -p)' EXIT

# 1. Start the Next.js Dashboard Frontend in the background
echo "🚀 Starting Next.js Admin Dashboard on port 3000..."
cd /app/dashboard && npm run start &
FRONTEND_PID=$!

# 2. Start the FastAPI pricing backend in the foreground
echo "🚀 Starting FastAPI backend on port 8000..."
cd /app
export PYTHONPATH=.
gunicorn -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 backend.app.main:app &
BACKEND_PID=$!

# Wait for both processes
wait -n $FRONTEND_PID $BACKEND_PID

# Exit with the status of the process that terminated
exit $?
