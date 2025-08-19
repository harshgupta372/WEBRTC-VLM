# WebRTC VLM Multi-Object Detection Demo

A real-time multi-object detection system that streams video from a phone camera via WebRTC, performs inference (server-side or client-side WASM), and overlays detection results in near real-time.

## Features

- 📱 **Phone Camera Streaming**: Connect via QR code, no app installation required
- 🔍 **Real-time Object Detection**: MobileNet-SSD based detection with bounding boxes
- ⚡ **Dual Processing Modes**: Server-side inference or client-side WASM
- 📊 **Performance Metrics**: End-to-end latency, FPS, and bandwidth monitoring
- 🐋 **Docker Support**: One-command deployment with Docker Compose
- 📈 **Benchmarking**: Automated performance measurement tools

## Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- OR Node.js 16+ and pnpm
- Phone with Chrome (Android) or Safari (iOS)

### One-Command Start

```bash
# Clone and start (WASM mode by default)
git clone <repo>
cd webrtc-vlm-detection
./start.sh
```

### Mode Selection

```bash
# Server-side inference mode
./start.sh --mode server

# Client-side WASM mode (default)
./start.sh --mode wasm

# With ngrok for external access
./start.sh --ngrok
```

### Using the Demo

1. **Start the server**: `./start.sh`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Connect phone**: Scan QR code with phone camera
4. **Allow camera**: Grant camera permissions on phone
5. **Point and detect**: Aim phone at objects to see real-time detection overlays

## Architecture

```
Phone Camera → WebRTC → Browser → [WASM/Server] → Object Detection → Overlay Display
```

### Server Mode
- Phone streams via WebRTC to browser
- Browser sends frames to server API endpoint
- Server runs MobileNet-SSD inference
- Results sent back for overlay rendering

### WASM Mode  
- Phone streams via WebRTC to browser
- Browser processes frames locally with ONNX Runtime Web
- Client-side inference with quantized models
- Direct overlay rendering without server round-trip

## Performance Benchmarking

Run automated benchmarks to measure system performance:

```bash
# 30-second benchmark in WASM mode
./bench/run_bench.sh --duration 30 --mode wasm

# Server mode benchmark with custom output
./bench/run_bench.sh --duration 60 --mode server --output my-metrics.json

# View results
cat metrics.json
```

### Metrics Collected

- **End-to-end Latency**: `overlay_display_ts - capture_ts`
- **Server Latency**: `inference_ts - recv_ts`  
- **Network Latency**: `recv_ts - capture_ts`
- **Processed FPS**: Frames with detections per second
- **Bandwidth**: Uplink/downlink usage estimation

## API Contract

Detection results follow this JSON structure:

```json
{
  "frame_id": "frame_1690000000000",
  "capture_ts": 1690000000000,
  "recv_ts": 1690000000100,
  "inference_ts": 1690000000120,
  "detections": [
    {
      "label": "person",
      "score": 0.93,
      "xmin": 0.12,
      "ymin": 0.08,
      "xmax": 0.34,
      "ymax": 0.67
    }
  ]
}
```

Coordinates are normalized [0..1] for resolution independence.

## Low-Resource Mode

The system is designed to run on modest hardware:

### WASM Mode Optimizations
- Quantized MobileNet-SSD model
- Input downscaling to 320×240
- Frame thinning with 10-15 FPS target
- Fixed-length frame queue with drop policy

### Resource Requirements
- **CPU**: Intel i5 or equivalent
- **RAM**: 4GB minimum, 8GB recommended  
- **Network**: 1-5 Mbps for video streaming

## Configuration

### Environment Variables

```bash
MODE=wasm|server          # Inference mode
NODE_ENV=development|production
NGROK_AUTHTOKEN=your_token # For external access
```

### Docker Compose

```bash
# Basic deployment
docker-compose up --build

# With ngrok support  
docker-compose --profile ngrok up --build
```

## Troubleshooting

### Phone Connection Issues

1. **Same Network**: Ensure phone and laptop are on same Wi-Fi
2. **Firewall**: Check if port 3000 is accessible
3. **HTTPS**: Some browsers require HTTPS for camera access
4. **Alternative**: Use `./start.sh --ngrok` for external tunnel

### Performance Issues

1. **High CPU**: Switch to WASM mode or reduce resolution
2. **High Latency**: Check network quality and server resources
3. **Low FPS**: Verify model loading and inference pipeline

### Debug Tools

- Chrome DevTools → `chrome://webrtc-internals/`
- Network tab for bandwidth monitoring  
- Console logs for WebRTC and detection errors

## Development

### Frontend Development

```bash
pnpm install
pnpm run dev    # Development server
pnpm run build  # Production build
pnpm run lint   # Code linting
```

### Backend Development

```bash
cd server
npm install
npm run dev     # Development with nodemon
```

### Adding Models

1. Place ONNX models in `public/models/`
2. Update model path in `src/lib/objectDetection.ts`
3. Ensure model input/output format compatibility

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + shadcn/ui components
- **WebRTC APIs** for video streaming
- **ONNX Runtime Web** for client-side inference

### Backend  
- **Node.js** with Express
- **WebSocket** for signaling
- **Optional Python** for ML inference

### Infrastructure
- **Docker** & Docker Compose
- **ngrok** for external access (optional)

## Design Choices & Tradeoffs

### WebRTC vs HTTP Streaming
- **Chosen**: WebRTC for low-latency bidirectional communication
- **Tradeoff**: More complex setup vs better real-time performance

### WASM vs Server Inference
- **WASM**: Lower latency, privacy-preserving, scales with clients
- **Server**: Better accuracy, GPU acceleration, centralized updates
- **Tradeoff**: Client resources vs server resources

### Frame Processing Strategy
- **Chosen**: Frame thinning with latest-frame priority
- **Tradeoff**: Potential frame drops vs consistent performance

## Backpressure Policy

The system handles overload through:

1. **Frame Queue Limiting**: Max 5 frames in processing queue
2. **Drop Strategy**: Drop oldest frames when queue is full
3. **Adaptive Sampling**: Reduce FPS when latency exceeds thresholds
4. **Resource Monitoring**: CPU/memory usage feedback loops

## Future Improvements

1. **Model Optimization**: Custom quantized models for specific use cases
2. **Adaptive Quality**: Dynamic resolution/FPS based on network conditions  
3. **Multi-device Support**: Handle multiple phone connections
4. **Edge Deployment**: Optimize for edge computing scenarios
5. **Analytics Dashboard**: Real-time performance monitoring UI

## License

MIT License - see LICENSE file for details.

---

**Demo Video**: [Will be provided after implementation]

**Live Demo**: Available when server is running at `http://localhost:3000`