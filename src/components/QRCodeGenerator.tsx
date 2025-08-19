import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface QRCodeGeneratorProps {
  url: string;
  isVisible: boolean;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ url, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isVisible && canvasRef.current) {
      generateQRCode(url);
    }
  }, [url, isVisible]);

  const generateQRCode = async (text: string) => {
    try {
      // Using qrcode library (we'll install it)
      const QRCode = await import('qrcode');
      const canvas = canvasRef.current;
      
      if (canvas) {
        await QRCode.toCanvas(canvas, text, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      }
    } catch (error) {
      console.error('QR Code generation failed:', error);
      // Fallback: draw a simple placeholder
      drawPlaceholder();
    }
  };

  const drawPlaceholder = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    // Draw placeholder
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 200, 200);
    
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', 100, 90);
    ctx.fillText('Placeholder', 100, 110);
    
    // Draw border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 200, 200);
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col items-center space-y-3">
      <canvas
        ref={canvasRef}
        className="border rounded-lg"
      />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">Scan with phone camera</p>
        <p className="text-xs text-muted-foreground">
          Or visit: {url}
        </p>
      </div>
    </div>
  );
};