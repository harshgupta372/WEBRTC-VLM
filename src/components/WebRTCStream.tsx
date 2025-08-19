import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ObjectDetectionEngine, DetectionResult } from '../lib/objectDetection';
import { MetricsCollector } from '../lib/metricsCollector';

interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface Metrics {
  latency: { median: number; p95: number };
  fps: number;
  bandwidth: { uplink: number; downlink: number };
}

interface WebRTCStreamProps {
  isServerMode: boolean;
  onConnectionChange: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onDetections: (detections: Detection[]) => void;
  onMetricsUpdate: (metrics: Metrics) => void;
}

export const WebRTCStream = forwardRef<HTMLVideoElement, WebRTCStreamProps>(
  ({ isServerMode, onConnectionChange, onDetections, onMetricsUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const detectionEngineRef = useRef<ObjectDetectionEngine | null>(null);
    const metricsCollectorRef = useRef<MetricsCollector | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);

    useImperativeHandle(ref, () => videoRef.current!);

    useEffect(() => {
      const init = async () => {
        await initializeWebRTC();
        await initializeDetectionEngine();
        initializeMetricsCollector();
      };
      
      init();

      return () => {
        cleanup();
      };
    }, [isServerMode]);

    const initializeWebRTC = async () => {
      try {
        onConnectionChange('connecting');

        // Create peer connection
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        peerConnectionRef.current = peerConnection;

        // Handle incoming stream
        peerConnection.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            onConnectionChange('connected');
            startProcessing();
          }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && websocketRef.current) {
            websocketRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate
            }));
          }
        };

        // Initialize WebSocket connection for signaling
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const websocket = new WebSocket(`${wsProtocol}//${wsHost}:3000/ws`);
        websocketRef.current = websocket;

        websocket.onopen = () => {
          console.log('Browser WebSocket connected');
          // Register as browser client
          websocket.send(JSON.stringify({
            type: 'start-stream',
            role: 'browser'
          }));
        };

        websocket.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'create-offer': {
              // Browser creates offer for phone
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);
              websocket.send(JSON.stringify({
                type: 'offer',
                offer: offer
              }));
              break;
            }

            case 'answer': {
              await peerConnection.setRemoteDescription(message.answer);
              break;
            }
              
            case 'ice-candidate':
              if (message.candidate) {
                await peerConnection.addIceCandidate(message.candidate);
              }
              break;
              
            case 'detection-result':
              handleDetectionResult(message.data);
              break;
          }
        };

        websocket.onerror = (error) => {
          console.error('Browser WebSocket error:', error);
          onConnectionChange('disconnected');
        };

        websocket.onclose = () => {
          console.log('Browser WebSocket closed');
          onConnectionChange('disconnected');
        };

      } catch (error) {
        console.error('WebRTC initialization failed:', error);
        onConnectionChange('disconnected');
      }
    };

    const initializeDetectionEngine = async () => {
      try {
        detectionEngineRef.current = new ObjectDetectionEngine(isServerMode);
        await detectionEngineRef.current.initialize();
      } catch (error) {
        console.error('Detection engine initialization failed:', error);
      }
    };

    const initializeMetricsCollector = () => {
      metricsCollectorRef.current = new MetricsCollector();
      
      // Update metrics every second
      setInterval(() => {
        if (metricsCollectorRef.current) {
          const metrics = metricsCollectorRef.current.getMetrics();
          onMetricsUpdate(metrics);
        }
      }, 1000);
    };

    const startProcessing = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const processFrame = async () => {
        if (!videoRef.current || !detectionEngineRef.current) return;

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        
        // Capture frame
        const captureTs = Date.now();
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        try {
          let detections;
          
          if (isServerMode) {
            // Send frame to server for inference
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            detections = await sendFrameToServer(imageData, captureTs);
          } else {
            // Process frame locally with WASM
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            detections = await detectionEngineRef.current.detectObjects(imageData, captureTs);
          }

          if (detections) {
            onDetections(detections.detections || []);
            
            // Record metrics
            if (metricsCollectorRef.current) {
              metricsCollectorRef.current.recordFrame(detections);
            }
          }
        } catch (error) {
          console.error('Frame processing error:', error);
        }

        // Process next frame
        requestAnimationFrame(processFrame);
      };

      requestAnimationFrame(processFrame);
    };

    const sendFrameToServer = async (imageData: string, captureTs: number): Promise<DetectionResult | null> => {
      try {
        const response = await fetch('/api/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageData,
            capture_ts: captureTs,
            frame_id: `frame_${captureTs}`
          })
        });

        return await response.json();
      } catch (error) {
        console.error('Server detection request failed:', error);
        return null;
      }
    };

    const handleDetectionResult = (result: DetectionResult) => {
      onDetections(result.detections || []);
      
      if (metricsCollectorRef.current) {
        metricsCollectorRef.current.recordFrame(result);
      }
    };

    const cleanup = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (detectionEngineRef.current) {
        detectionEngineRef.current.cleanup();
      }
    };

    return (
      <>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
      </>
    );
  }
);

WebRTCStream.displayName = 'WebRTCStream';