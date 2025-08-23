import React, { useEffect, useRef, useCallback } from 'react';

interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface ObjectDetectionOverlayProps {
  detections: Detection[];
  videoRef: React.RefObject<HTMLVideoElement & { cleanup?: () => void }>;
}

export const ObjectDetectionOverlay: React.FC<ObjectDetectionOverlayProps> = ({
  detections,
  videoRef
}) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const getColorForLabel = useCallback((label: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
    
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }, []);

  useEffect(() => {
    const drawOverlays = () => {
      if (!overlayRef.current || !videoRef?.current) return;

      const canvas = overlayRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to video - use client dimensions for proper scaling
      canvas.width = video.clientWidth || 640;
      canvas.height = video.clientHeight || 480;
      
      // Set canvas style to match video exactly
      canvas.style.width = (video.clientWidth || 640) + 'px';
      canvas.style.height = (video.clientHeight || 480) + 'px';

      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Debug logging
      if (detections.length > 0) {
        console.log('Drawing', detections.length, 'detections on overlay');
        console.log('Canvas size:', canvas.width, 'x', canvas.height);
        console.log('Video size:', video.clientWidth, 'x', video.clientHeight);
      }

      // Always draw a test box to verify overlay is working
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 50, 100, 100);
      ctx.fillStyle = '#FF0000';
      ctx.font = '14px Arial';
      ctx.fillText('TEST OVERLAY', 55, 45);

      // Draw detections
      detections.forEach((detection) => {
        const x = detection.xmin * canvas.width;
        const y = detection.ymin * canvas.height;
        const width = (detection.xmax - detection.xmin) * canvas.width;
        const height = (detection.ymax - detection.ymin) * canvas.height;

        // Draw bounding box
        ctx.strokeStyle = getColorForLabel(detection.label);
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        const label = `${detection.label} (${(detection.score * 100).toFixed(1)}%)`;
        ctx.font = '16px Arial';
        const textMetrics = ctx.measureText(label);
        const textHeight = 20;
        
        ctx.fillStyle = getColorForLabel(detection.label);
        ctx.fillRect(x, y - textHeight, textMetrics.width + 10, textHeight);

        // Draw label text
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 5, y - 5);
      });
    };
    
    drawOverlays();
  }, [detections, videoRef, getColorForLabel]);

  return (
    <canvas
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ 
        zIndex: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    />
  );
};