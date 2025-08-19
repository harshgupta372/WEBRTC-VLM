import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MetricsPanelProps {
  metrics: {
    latency: { median: number; p95: number };
    fps: number;
    bandwidth: { uplink: number; downlink: number };
  };
  isVisible: boolean;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, isVisible }) => {
  if (!isVisible) return null;

  const formatLatency = (ms: number) => `${ms.toFixed(1)}ms`;
  const formatBandwidth = (kbps: number) => `${(kbps / 1000).toFixed(1)} Mbps`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Performance Metrics
          <Badge variant="outline">Real-time</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Latency Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">LATENCY</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Median (E2E):</span>
                <Badge variant={metrics.latency.median < 100 ? "default" : "destructive"}>
                  {formatLatency(metrics.latency.median)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">P95 (E2E):</span>
                <Badge variant={metrics.latency.p95 < 200 ? "default" : "destructive"}>
                  {formatLatency(metrics.latency.p95)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Processing Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">PROCESSING</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Processed FPS:</span>
                <Badge variant={metrics.fps >= 10 ? "default" : "secondary"}>
                  {metrics.fps.toFixed(1)} fps
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Target FPS:</span>
                <Badge variant="outline">10-15 fps</Badge>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Bandwidth Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">BANDWIDTH</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Uplink:</span>
                <Badge variant="outline">
                  {formatBandwidth(metrics.bandwidth.uplink)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Downlink:</span>
                <Badge variant="outline">
                  {formatBandwidth(metrics.bandwidth.downlink)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Indicators */}
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          <Badge variant={metrics.latency.median < 100 ? "default" : "destructive"}>
            {metrics.latency.median < 100 ? "Low Latency" : "High Latency"}
          </Badge>
          <Badge variant={metrics.fps >= 10 ? "default" : "secondary"}>
            {metrics.fps >= 10 ? "Good FPS" : "Low FPS"}
          </Badge>
          <Badge variant="outline">
            Real-time Processing
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};