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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Real-time WebRTC VLM Multi-Object Detection
          </h1>
          <p className="text-lg text-muted-foreground">
            Phone → Browser → Inference → Overlay Pipeline
          </p>
          
          {/* Mode Switch */}
          <div className="flex items-center justify-center gap-4">
            <span className={!isServerMode ? 'font-semibold' : ''}>WASM Mode</span>
            <Switch 
              checked={isServerMode} 
              onCheckedChange={setIsServerMode}
              disabled={isStreaming}
            />
            <span className={isServerMode ? 'font-semibold' : ''}>Server Mode</span>
          </div>
          
          <Badge variant={isServerMode ? "default" : "secondary"}>
            {isServerMode ? "Server-side Inference" : "Client-side WASM Inference"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Phone Connection
                <Badge variant={
                  connectionStatus === 'connected' ? 'default' : 
                  connectionStatus === 'connecting' ? 'secondary' : 'outline'
                }>
                  {connectionStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRCodeGenerator 
                url={`http://192.168.1.25:5173/phone`}
                isVisible={!isStreaming}
              />
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  1. Scan QR code with your phone
                </p>
                <p className="text-sm text-muted-foreground">
                  2. Allow camera access
                </p>
                <p className="text-sm text-muted-foreground">
                  3. Point camera at objects
                </p>
              </div>

              <Button 
                onClick={() => setIsStreaming(!isStreaming)}
                variant={isStreaming ? "destructive" : "default"}
                className="w-full"
              >
                {isStreaming ? "Stop Stream" : "Start Stream"}
              </Button>
            </CardContent>
          </Card>

          {/* Video Stream with Overlays */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Live Video Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white text-lg">Waiting for phone connection...</p>
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
          <Alert>
            <AlertDescription>
              Establishing WebRTC connection with phone...
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus === 'connected' && detections.length === 0 && (
          <Alert>
            <AlertDescription>
              Connected! Point your phone camera at objects to see detection overlays.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}