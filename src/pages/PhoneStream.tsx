import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function PhoneStreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const initializePhoneStream = useCallback(async () => {
    try {
      // Check if we're on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        throw new Error('Camera access requires HTTPS. Please access this page via HTTPS or use a local tunnel service like ngrok.');
      }

      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser. Please use Chrome, Safari, or Firefox.');
      }

      // Try different constraint configurations for better compatibility
      const constraintOptions = [
        // Modern constraints
        {
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
            frameRate: { ideal: 15, min: 10 },
            facingMode: 'environment'
          },
          audio: false
        },
        // Fallback constraints
        {
          video: {
            width: 640,
            height: 480,
            facingMode: 'environment'
          },
          audio: false
        },
        // Basic constraints
        {
          video: true,
          audio: false
        }
      ];

      let stream = null;
      let lastError = null;

      for (const constraints of constraintOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
          console.warn('Failed with constraints:', constraints, err);
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access camera with all constraint options');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize WebRTC connection
      await setupWebRTCConnection(stream);
      
    } catch (err) {
      console.error('Camera access error:', err);
      
      // Provide helpful error messages and solutions
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please:\n1. Allow camera permissions\n2. Try using Chrome or Safari\n3. Access via HTTPS if possible');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError' || err.message.includes('not supported')) {
        setError('Camera not supported. Please:\n1. Use Chrome, Safari, or Firefox\n2. Enable camera permissions in browser settings\n3. Try accessing via HTTPS');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another app. Please close other camera apps and refresh.');
      } else {
        setError(`Camera error: ${err.message || err}\n\nTry:\n1. Refreshing the page\n2. Using Chrome or Safari\n3. Checking camera permissions`);
      }
    }
  }, []);

  useEffect(() => {
    initializePhoneStream();
    
    return () => {
      cleanup();
    };
  }, [initializePhoneStream]);

  const setupWebRTCConnection = async (stream: MediaStream) => {
    try {
      setConnectionStatus('connecting');

      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;

      // Add local stream
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && websocketRef.current) {
          websocketRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      // Initialize WebSocket connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      const wsUrl = `${wsProtocol}//${wsHost}:3000/ws`;
      const websocket = new WebSocket(wsUrl);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('WebSocket connected');
        // Request to start streaming
        websocket.send(JSON.stringify({
          type: 'start-stream',
          role: 'phone'
        }));
      };

      websocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'offer': {
            await peerConnection.setRemoteDescription(message.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            websocket.send(JSON.stringify({
              type: 'answer',
              answer: answer
            }));
            setConnectionStatus('connected');
            setIsStreaming(true);
            break;
          }
            
          case 'ice-candidate':
            await peerConnection.addIceCandidate(message.candidate);
            break;
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection failed. Please check your network.');
        setConnectionStatus('disconnected');
      };

      websocket.onclose = () => {
        setConnectionStatus('disconnected');
        setIsStreaming(false);
      };

    } catch (error) {
      console.error('WebRTC setup failed:', error);
      setError(`Connection setup failed: ${error}`);
      setConnectionStatus('disconnected');
    }
  };

  const stopStreaming = () => {
    cleanup();
    setIsStreaming(false);
    setConnectionStatus('disconnected');
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Phone Camera Stream</h1>
          <Badge variant={
            connectionStatus === 'connected' ? 'default' : 
            connectionStatus === 'connecting' ? 'secondary' : 'outline'
          }>
            {connectionStatus}
          </Badge>
        </div>

        {/* Video Stream */}
        <Card>
          <CardHeader>
            <CardTitle>Live Camera Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white text-center">
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Camera not active'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Point your camera at objects to detect them in real-time
                </p>
                <p className="text-xs text-muted-foreground">
                  Detection results will appear on the main browser screen
                </p>
              </div>
              
              <Button 
                onClick={stopStreaming}
                variant="destructive"
                className="w-full"
                disabled={!isStreaming}
              >
                Stop Streaming
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p>• Keep this tab open while streaming</p>
            <p>• Ensure good lighting for better detection</p>
            <p>• Move objects slowly for accurate tracking</p>
            <p>• Check the main screen for detection overlays</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}