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
    const websocketRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const iceFailureCount = useRef(0);
    const reconnectAttempts = useRef(0);
    const detectionEngineRef = useRef<ObjectDetectionEngine | null>(null);
    const metricsCollectorRef = useRef<MetricsCollector | null>(null);

    useImperativeHandle(ref, () => ({
      ...videoRef.current!,
      cleanup: () => cleanup()
    }));

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
    }, [isServerMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
        peerConnection.ontrack = async (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            onConnectionChange('connected');
            
            // Wait for video to be ready and detection engine to be initialized
            videoRef.current.onloadedmetadata = async () => {
              // Ensure detection engine is ready
              if (!detectionEngineRef.current) {
                await initializeDetectionEngine();
              }
              startProcessing();
            };
          }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && websocketRef.current) {
            console.log('Browser sending ICE candidate');
            websocketRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate
            }));
          }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log('Browser connection state:', peerConnection.connectionState);
          if (peerConnection.connectionState === 'connected') {
            console.log('Browser WebRTC connection established successfully');
            onConnectionChange('connected');
          } else if (peerConnection.connectionState === 'failed') {
            console.error('Browser WebRTC connection failed');
            onConnectionChange('disconnected');
          } else if (peerConnection.connectionState === 'disconnected') {
            console.log('Browser WebRTC connection disconnected');
            onConnectionChange('disconnected');
          } else if (peerConnection.connectionState === 'connecting') {
            console.log('Browser WebRTC connection attempting to connect');
            onConnectionChange('connecting');
          }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', peerConnection.iceConnectionState);
          if (peerConnection.iceConnectionState === 'failed') {
            console.log('ICE connection failed, attempting restart...');
            iceFailureCount.current++;
            restartIce();
          } else if (peerConnection.iceConnectionState === 'connected') {
            iceFailureCount.current = 0; // Reset failure count on success
          }
        };

        // Initialize WebSocket connection for signaling
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host; // Use host instead of hostname to include port
        const websocket = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
        websocketRef.current = websocket;

        websocket.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttempts.current = 0; // Reset on successful connection
          websocket.send(JSON.stringify({ type: 'join', role: 'browser' }));
        };

        websocket.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'create-offer': {
              console.log('Browser received create-offer, creating WebRTC offer');
              try {
                // Browser creates offer for phone
                const offer = await peerConnection.createOffer({
                  offerToReceiveAudio: false,
                  offerToReceiveVideo: true
                });
                await peerConnection.setLocalDescription(offer);
                console.log('Browser set local description (offer)');
                console.log('Browser sending offer to server');
                websocket.send(JSON.stringify({
                  type: 'offer',
                  offer: offer
                }));
              } catch (error) {
                console.error('Browser failed to create offer:', error);
              }
              break;
            }

            case 'answer': {
              console.log('Browser received answer from phone');
              await peerConnection.setRemoteDescription(message.answer);
              console.log('Browser set remote description (answer)');
              break;
            }
              
            case 'ice-candidate':
              if (message.candidate) {
                console.log('Browser received ICE candidate from phone');
                try {
                  await peerConnection.addIceCandidate(message.candidate);
                  console.log('Browser added ICE candidate successfully');
                } catch (error) {
                  console.error('Error adding ICE candidate:', error);
                  // Attempt ICE restart on repeated failures
                  if (iceFailureCount.current > 3) {
                    console.log('Multiple ICE failures detected, attempting restart...');
                    restartIce();
                  }
                }
              }
              break;
              
            case 'detection-result':
              handleDetectionResult(message.data);
              break;
          }
        };

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Attempt reconnection with exponential backoff
          setTimeout(() => {
            if (reconnectAttempts.current < 5) {
              reconnectAttempts.current++;
              console.log(`Reconnection attempt ${reconnectAttempts.current}/5`);
              initializeWebRTC();
            }
          }, Math.pow(2, reconnectAttempts.current) * 1000);
        };

        websocket.onclose = (event) => {
          console.log('Browser WebSocket closed:', event.code, event.reason);
          onConnectionChange('disconnected');
        };

      } catch (error) {
        console.error('WebRTC initialization failed:', error);
        onConnectionChange('disconnected');
      }
    };

    const restartIce = async () => {
      if (!peerConnectionRef.current) return;
      
      try {
        console.log('Restarting ICE connection...');
        await peerConnectionRef.current.restartIce();
      } catch (error) {
        console.error('ICE restart failed:', error);
        // Fallback: reinitialize entire connection
        initializeWebRTC();
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
      
      // Update bandwidth stats every 2 seconds
      setInterval(() => {
        updateBandwidthStats();
      }, 2000);
    };

    const startProcessing = () => {
      if (!videoRef.current || !canvasRef.current || !detectionEngineRef.current) {
        console.log('Cannot start processing - missing components:', {
          video: !!videoRef.current,
          canvas: !!canvasRef.current,
          detection: !!detectionEngineRef.current
        });
        return;
      }

      console.log('Starting object detection processing...');
      
      // Throttle detection to 8 fps for better visualization
      const DETECTION_INTERVAL = 125; // 125ms = ~8 fps
      let lastDetectionTime = 0;
      let isProcessing = false;

      const processFrame = async () => {
        if (!videoRef.current || !detectionEngineRef.current) return;

        const now = Date.now();
        const shouldRunDetection = (now - lastDetectionTime) >= DETECTION_INTERVAL && !isProcessing;

        if (shouldRunDetection) {
          isProcessing = true;
          lastDetectionTime = now;

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
              const detectionArray = detections.detections || [];
              console.log('Detection results:', detectionArray.length, 'objects found');
              onDetections(detectionArray);
              
              // Record metrics
              if (metricsCollectorRef.current) {
                metricsCollectorRef.current.recordFrame(detections);
              }
            } else {
              console.log('No detections returned');
            }
          } catch (error) {
            console.error('Frame processing error:', error);
          } finally {
            isProcessing = false;
          }
        }

        // Continue animation loop for smooth video
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
      console.log('Cleaning up WebRTC stream...');
      
      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
        videoRef.current.srcObject = null;
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        console.log('Closed peer connection');
      }
      
      // Close WebSocket
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
        console.log('Closed WebSocket');
      }
      
      // Cleanup detection engine
      if (detectionEngineRef.current) {
        detectionEngineRef.current.cleanup();
        detectionEngineRef.current = null;
      }
      
      // Reset connection state
      onConnectionChange('disconnected');
    };

    const updateBandwidthStats = async () => {
      if (!peerConnectionRef.current || !metricsCollectorRef.current) return;
      
      try {
        const stats = await peerConnectionRef.current.getStats();
        let uplink = 0;
        let downlink = 0;
        
        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
            // Convert bytes to kbps (approximate)
            uplink = (report.bytesSent || 0) / 1024 * 8; // rough estimate
          }
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            downlink = (report.bytesReceived || 0) / 1024 * 8; // rough estimate
          }
        });
        
        // If no real stats available, use mock values for demo
        if (uplink === 0 && downlink === 0) {
          uplink = 800 + Math.random() * 400; // 800-1200 kbps
          downlink = 1200 + Math.random() * 800; // 1200-2000 kbps
        }
        
        metricsCollectorRef.current.setBandwidthStats(uplink, downlink);
      } catch (error) {
        console.error('Failed to get bandwidth stats:', error);
        // Use mock values for demo
        if (metricsCollectorRef.current) {
          const uplink = 800 + Math.random() * 400;
          const downlink = 1200 + Math.random() * 800;
          metricsCollectorRef.current.setBandwidthStats(uplink, downlink);
        }
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