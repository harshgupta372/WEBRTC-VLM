#!/bin/bash

# WebRTC VLM Multi-Object Detection Demo Startup Script
# Usage: ./start.sh [--mode server|wasm] [--ngrok]

set -e

MODE="wasm"
USE_NGROK=false
BUILD_FRONTEND=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --ngrok)
      USE_NGROK=true
      shift
      ;;
    --no-build)
      BUILD_FRONTEND=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--mode server|wasm] [--ngrok] [--no-build]"
      echo ""
      echo "Options:"
      echo "  --mode server|wasm  Set inference mode (default: wasm)"
      echo "  --ngrok             Enable ngrok for external access"
      echo "  --no-build          Skip frontend build"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🚀 Starting WebRTC VLM Multi-Object Detection Demo"
echo "Mode: $MODE"
echo "Use ngrok: $USE_NGROK"

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "📦 Using Docker deployment"
    
    # Set environment variables
    export MODE=$MODE
    
    if [ "$USE_NGROK" = true ]; then
        echo "🌐 Starting with ngrok support"
        docker-compose --profile ngrok up --build
    else
        echo "🏠 Starting locally"
        docker-compose up --build
    fi
    
else
    echo "📱 Using local development setup"
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed"
        echo "Please install Node.js 16+ and try again"
        exit 1
    fi
    
    # Check if pnpm is available
    if ! command -v pnpm &> /dev/null; then
        echo "📦 Installing pnpm..."
        npm install -g pnpm
    fi
    
    # Install frontend dependencies
    if [ "$BUILD_FRONTEND" = true ]; then
        echo "📦 Installing frontend dependencies..."
        pnpm install
        
        echo "🏗️  Building frontend..."
        pnpm run build
    fi
    
    # Install server dependencies
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
    
    # Start server
    echo "🚀 Starting server..."
    export MODE=$MODE
    node server/index.js &
    SERVER_PID=$!
    
    # Setup cleanup
    cleanup() {
        echo "🛑 Shutting down..."
        kill $SERVER_PID 2>/dev/null || true
        exit 0
    }
    trap cleanup SIGINT SIGTERM
    
    echo ""
    echo "✅ Demo is running!"
    echo "📱 Open http://localhost:3000 on your computer"
    echo "📱 Scan QR code with your phone to start streaming"
    echo ""
    echo "Press Ctrl+C to stop"
    
    # Keep script running
    wait $SERVER_PID
fi