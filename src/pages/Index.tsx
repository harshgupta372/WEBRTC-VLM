import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WebRTCStream } from '../components/WebRTCStream';
import { MetricsPanel } from '../components/MetricsPanel';
import { QRCodeGenerator } from '../components/QRCodeGenerator';
import { ObjectDetectionOverlay } from '../components/ObjectDetectionOverlay';

interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export default function RealTimeDetectionDemo() {
  const [isServerMode, setIsServerMode] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [metrics, setMetrics] = useState<{
    latency: { median: number; p95: number };
    fps: number;
    bandwidth: { uplink: number; downlink: number };
  }>({
    latency: { median: 0, p95: 0 },
    fps: 0,
    bandwidth: { uplink: 0, downlink: 0 }
  });

  const videoRef = useRef<HTMLVideoElement & { cleanup?: () => void }>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Real-time WebRTC VLM Multi-Object Detection
          </h1>
          <p className="text-xl text-gray-300 font-medium">
            Phone → Browser → Inference → Overlay Pipeline
          </p>
          
          {/* Mode Switch */}
          <div className="flex items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <span className={`text-white transition-all ${!isServerMode ? 'font-semibold text-cyan-400' : 'text-gray-300'}`}>WASM Mode</span>
            <Switch 
              checked={isServerMode} 
              onCheckedChange={setIsServerMode}
              disabled={isStreaming}
              className="data-[state=checked]:bg-purple-600"
            />
            <span className={`text-white transition-all ${isServerMode ? 'font-semibold text-purple-400' : 'text-gray-300'}`}>Server Mode</span>
          </div>
          
          <Badge className={`px-4 py-2 text-sm font-medium ${isServerMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'}`}>
            {isServerMode ? "🚀 Server-side Inference" : "⚡ Client-side WASM Inference"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Panel */}
          <Card className="lg:col-span-1 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                📱 Phone Connection
                <Badge className={`${
                  connectionStatus === 'connected' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}>
                  {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'connecting' ? '🟡' : '🔴'} {connectionStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRCodeGenerator 
                url={`https://da0853474abb.ngrok-free.app/phone`}
                isVisible={!isStreaming}
              />
              
              <div className="space-y-2">
                <div className="space-y-2 bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-cyan-400">1.</span> Scan QR code with your phone
                  </p>
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-purple-400">2.</span> Allow camera access
                  </p>
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-pink-400">3.</span> Point camera at objects
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => {
                  if (isStreaming) {
                    // Stop streaming - cleanup WebRTC connection
                    if (videoRef.current?.cleanup) {
                      videoRef.current.cleanup();
                    }
                    setDetections([]);
                  }
                  setIsStreaming(!isStreaming);
                }}
                className={`w-full font-semibold transition-all duration-200 ${
                  isStreaming 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25' 
                    : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg shadow-purple-500/25'
                }`}
              >
                {isStreaming ? "⏹️ Stop Stream" : "▶️ Start Stream"}
              </Button>
            </CardContent>
          </Card>

          {/* Video Stream with Overlays */}
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                🎥 Live Video Stream
                {connectionStatus === 'connected' && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-red-400 font-normal">LIVE</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <WebRTCStream
                  ref={videoRef}
                  isServerMode={isServerMode}
                  onConnectionChange={setConnectionStatus}
                  onDetections={setDetections}
                  onMetricsUpdate={setMetrics}
                />
                
                <ObjectDetectionOverlay
                  detections={detections}
                  videoRef={videoRef}
                />
                
                {!isStreaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/50 to-black/50">
                    <div className="text-6xl mb-4 animate-pulse">📱</div>
                    <p className="text-white text-xl font-medium mb-2">Waiting for phone connection...</p>
                    <p className="text-gray-400 text-sm">Scan the QR code to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics Panel */}
        <MetricsPanel metrics={metrics} isVisible={isStreaming} />

        {/* Status Alerts */}
        {connectionStatus === 'connecting' && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30 backdrop-blur-sm">
            <AlertDescription className="text-yellow-300 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              Establishing WebRTC connection with phone...
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus === 'connected' && detections.length === 0 && (
          <Alert className="bg-green-500/10 border-green-500/30 backdrop-blur-sm">
            <AlertDescription className="text-green-300 flex items-center gap-2">
              <span className="text-green-400">✨</span>
              Connected! Point your phone camera at objects to see detection overlays.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}