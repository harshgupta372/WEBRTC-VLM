import React, { useEffect, useRef } from 'react';

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
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const ObjectDetectionOverlay: React.FC<ObjectDetectionOverlayProps> = ({
  detections,
  videoRef
}) => {
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawOverlays();
  }, [detections]);

  const drawOverlays = () => {
    if (!overlayRef.current || !videoRef.current) return;

    const canvas = overlayRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas size to match video
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear previous overlays
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes and labels
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

  const getColorForLabel = (label: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
    
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <canvas
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};