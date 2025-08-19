#!/bin/bash

# Benchmarking script for WebRTC VLM Detection Demo
# Usage: ./bench/run_bench.sh [--duration 30] [--mode server|wasm] [--output metrics.json]

set -e

DURATION=30
MODE="wasm"
OUTPUT_FILE="metrics.json"
SERVER_URL="http://localhost:3000"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --duration)
      DURATION="$2"
      shift 2
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --url)
      SERVER_URL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--duration 30] [--mode server|wasm] [--output metrics.json]"
      echo ""
      echo "Options:"
      echo "  --duration N        Benchmark duration in seconds (default: 30)"
      echo "  --mode server|wasm  Inference mode to benchmark (default: wasm)"
      echo "  --output FILE       Output metrics file (default: metrics.json)"
      echo "  --url URL           Server URL (default: http://localhost:3000)"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🔬 Starting benchmark run"
echo "Duration: ${DURATION}s"
echo "Mode: $MODE"
echo "Output: $OUTPUT_FILE"

# Check if server is running
if ! curl -s "$SERVER_URL" > /dev/null; then
    echo "❌ Server not accessible at $SERVER_URL"
    echo "Please start the server first with ./start.sh"
    exit 1
fi

# Create benchmark script
cat > /tmp/benchmark.js << 'EOF'
const puppeteer = require('puppeteer');
const fs = require('fs');

async function runBenchmark(duration, mode, outputFile, serverUrl) {
    console.log('🚀 Launching browser for benchmark...');
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to demo
    await page.goto(serverUrl);
    
    // Set mode
    if (mode === 'server') {
        await page.click('[data-testid="mode-switch"]');
    }
    
    // Collect metrics
    const metrics = {
        start_time: new Date().toISOString(),
        duration_seconds: duration,
        mode: mode,
        frames: [],
        summary: {}
    };
    
    // Start monitoring
    console.log(`📊 Monitoring for ${duration} seconds...`);
    
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    // Monitor network activity
    await page.setRequestInterception(true);
    
    let frameCount = 0;
    let totalLatency = 0;
    const latencies = [];
    
    page.on('request', (request) => {
        if (request.url().includes('/api/detect')) {
            const timestamp = Date.now();
            request.startTime = timestamp;
        }
        request.continue();
    });
    
    page.on('response', (response) => {
        if (response.url().includes('/api/detect')) {
            const endTimestamp = Date.now();
            const latency = endTimestamp - response.request().startTime;
            
            frameCount++;
            totalLatency += latency;
            latencies.push(latency);
            
            console.log(`Frame ${frameCount}: ${latency}ms latency`);
        }
    });
    
    // Wait for benchmark duration
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
    // Calculate final metrics
    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(latencies.length / 2)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const fps = frameCount / duration;
    
    metrics.summary = {
        total_frames: frameCount,
        processed_fps: fps,
        latency: {
            median_ms: median,
            p95_ms: p95,
            average_ms: totalLatency / frameCount || 0
        },
        bandwidth: {
            uplink_kbps: 0, // Would need actual measurement
            downlink_kbps: 0
        }
    };
    
    // Save metrics
    fs.writeFileSync(outputFile, JSON.stringify(metrics, null, 2));
    
    console.log('✅ Benchmark completed');
    console.log(`📊 Results saved to ${outputFile}`);
    console.log(`📈 Processed FPS: ${fps.toFixed(2)}`);
    console.log(`⏱️  Median latency: ${median}ms`);
    console.log(`⏱️  P95 latency: ${p95}ms`);
    
    await browser.close();
}

const args = process.argv.slice(2);
const duration = parseInt(args[0]) || 30;
const mode = args[1] || 'wasm';
const outputFile = args[2] || 'metrics.json';
const serverUrl = args[3] || 'http://localhost:3000';

runBenchmark(duration, mode, outputFile, serverUrl).catch(console.error);
EOF

# Check if puppeteer is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required for benchmarking"
    exit 1
fi

# Install puppeteer if needed
if ! npm list puppeteer &> /dev/null; then
    echo "📦 Installing puppeteer for benchmarking..."
    npm install puppeteer
fi

# Run benchmark
echo "🎯 Starting benchmark..."
node /tmp/benchmark.js "$DURATION" "$MODE" "$OUTPUT_FILE" "$SERVER_URL"

# Clean up
rm -f /tmp/benchmark.js

echo ""
echo "🎉 Benchmark completed!"
echo "📄 Results available in: $OUTPUT_FILE"

# Display summary
if command -v jq &> /dev/null; then
    echo ""
    echo "📊 Quick Summary:"
    jq '.summary' "$OUTPUT_FILE"
else
    echo "Install 'jq' to see formatted results"
fi