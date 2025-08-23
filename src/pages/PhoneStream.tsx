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
  const [cameraInitialized, setCameraInitialized] = useState(false);
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
      setCameraInitialized(true);
      
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

  // Remove auto-initialization - require user interaction
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

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
          console.log('Phone sending ICE candidate');
          websocketRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Phone connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          console.log('Phone WebRTC connection established successfully');
          setConnectionStatus('connected');
          setIsStreaming(true);
        } else if (peerConnection.connectionState === 'failed') {
          console.error('Phone WebRTC connection failed');
          setConnectionStatus('disconnected');
          setIsStreaming(false);
        } else if (peerConnection.connectionState === 'disconnected') {
          console.log('Phone WebRTC connection disconnected');
          setConnectionStatus('disconnected');
          setIsStreaming(false);
        } else if (peerConnection.connectionState === 'connecting') {
          console.log('Phone WebRTC connection attempting to connect');
          setConnectionStatus('connecting');
        }
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log('Phone ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
          console.log('Phone ICE connection established');
        } else if (peerConnection.iceConnectionState === 'failed') {
          console.error('Phone ICE connection failed');
          // Try to restart ICE
          peerConnection.restartIce();
        }
      };

      // Initialize WebSocket connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host; // Use host instead of hostname to include port
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;
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
            console.log('Phone received offer from browser');
            try {
              await peerConnection.setRemoteDescription(message.offer);
              console.log('Phone set remote description (offer)');
              console.log('Phone creating answer');
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              console.log('Phone set local description (answer)');
              console.log('Phone sending answer to server');
              websocket.send(JSON.stringify({
                type: 'answer',
                answer: answer
              }));
            } catch (error) {
              console.error('Phone failed to handle offer:', error);
              setError(`Failed to establish connection: ${error.message}`);
            }
            break;
          }
            
          case 'ice-candidate':
            if (message.candidate) {
              console.log('Phone received ICE candidate from browser');
              try {
                await peerConnection.addIceCandidate(message.candidate);
                console.log('Phone added ICE candidate successfully');
              } catch (error) {
                console.error('Phone failed to add ICE candidate:', error);
              }
            }
            break;
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection failed. Please check your network.');
        setConnectionStatus('disconnected');
      };

      websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsStreaming(false);
      };

    } catch (error) {
      console.error('WebRTC setup failed:', error);
      setError(`Connection setup failed: ${error}`);
      setConnectionStatus('disconnected');
    }
  };

  const startCamera = async () => {
    setError('');
    await initializePhoneStream();
  };

  const stopStreaming = () => {
    cleanup();
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    setCameraInitialized(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            📱 Phone Camera Stream
          </h1>
          <p className="text-gray-300 text-lg font-medium">
            Point your camera at objects for real-time detection
          </p>
        </div>

        {/* Video Stream */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              📹 Camera Status
              <Badge className={`${
                connectionStatus === 'connected' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}>
                {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'connecting' ? '🟡' : '🔴'} {connectionStatus}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden relative border border-white/10 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {!cameraInitialized && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/50 to-black/50">
                  <div className="text-6xl mb-4 animate-pulse">📹</div>
                  <p className="text-white text-center px-4 text-lg font-medium mb-2">
                    Ready to stream!
                  </p>
                  <p className="text-gray-400 text-sm text-center px-4">
                    Tap "Start Camera" to begin
                  </p>
                </div>
              )}
              
              {connectionStatus === 'connected' && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-400 text-sm font-medium">LIVE</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-300">
                  Point your camera at objects to detect them in real-time
                </p>
                <p className="text-xs text-gray-400">
                  Detection results will appear on the main browser screen
                </p>
              </div>
              
              {!cameraInitialized ? (
                <Button 
                  onClick={initializePhoneStream}
                  disabled={isStreaming}
                  className={`w-full font-semibold transition-all duration-200 ${
                    isStreaming 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  }`}
                >
                  {isStreaming ? '✅ Camera Active' : '📹 Start Camera'}
                </Button>
              ) : (
                <Button 
                  onClick={stopStreaming}
                  className="w-full font-semibold bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25"
                >
                  ⏹️ Stop Streaming
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert className="bg-red-500/10 border-red-500/30 backdrop-blur-sm">
            <AlertDescription className="text-red-300 flex items-center gap-2">
              <span className="text-red-400">⚠️</span>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              💡 Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="text-gray-300 flex items-center gap-2">
              <span className="text-cyan-400">•</span> Keep this tab open while streaming
            </p>
            <p className="text-gray-300 flex items-center gap-2">
              <span className="text-purple-400">•</span> Make sure you have a stable internet connection
            </p>
            <p className="text-gray-300 flex items-center gap-2">
              <span className="text-pink-400">•</span> Point camera at different objects to test detection
            </p>
            <p className="text-gray-300 flex items-center gap-2">
              <span className="text-green-400">•</span> Detection results appear on the browser screen
            </p>
          </CardContent>
        </Card>

        {/* Status Alerts */}
        {connectionStatus === 'connecting' && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30 backdrop-blur-sm">
            <AlertDescription className="text-yellow-300 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              Connecting to browser... Make sure the browser is ready to receive the stream.
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus === 'connected' && (
          <Alert className="bg-green-500/10 border-green-500/30 backdrop-blur-sm">
            <AlertDescription className="text-green-300 flex items-center gap-2">
              <span className="text-green-400">🎉</span>
              Successfully connected! Your camera stream is being sent to the browser for real-time object detection.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}