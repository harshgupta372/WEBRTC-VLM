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
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          📊 Performance Metrics
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
            ⚡ Real-time
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Latency Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-cyan-400">🚀 LATENCY</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Median (E2E):</span>
                <Badge className={metrics.latency.median < 100 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
                  {formatLatency(metrics.latency.median)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">P95 (E2E):</span>
                <Badge className={metrics.latency.p95 < 200 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
                  {formatLatency(metrics.latency.p95)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Processing Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-purple-400">⚙️ PROCESSING</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Processed FPS:</span>
                <Badge className={metrics.fps >= 10 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                  {metrics.fps.toFixed(1)} fps
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Target FPS:</span>
                <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30">10-15 fps</Badge>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Bandwidth Metrics */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-pink-400">📡 BANDWIDTH</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Uplink:</span>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {formatBandwidth(metrics.bandwidth.uplink)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Downlink:</span>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {formatBandwidth(metrics.bandwidth.downlink)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Indicators */}
        <Separator className="my-4 bg-white/20" />
        <div className="flex flex-wrap gap-2">
          <Badge className={metrics.latency.median < 100 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
            {metrics.latency.median < 100 ? "🟢 Low Latency" : "🔴 High Latency"}
          </Badge>
          <Badge className={metrics.fps >= 10 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
            {metrics.fps >= 10 ? "🟢 Good FPS" : "🟡 Low FPS"}
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            ⚡ Real-time Processing
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};