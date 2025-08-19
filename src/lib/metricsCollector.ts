export interface DetectionResult {
  frame_id: string;
  capture_ts: number;
  recv_ts: number;
  inference_ts: number;
  detections?: any[];
}

export interface FrameMetrics {
  frame_id: string;
  capture_ts: number;
  recv_ts: number;
  inference_ts: number;
  display_ts: number;
  e2e_latency: number;
  server_latency: number;
  network_latency: number;
}

export interface MetricsExport {
  timestamp: string;
  duration_seconds: number;
  total_frames: number;
  processed_fps: number;
  latency: {
    median_ms: number;
    p95_ms: number;
  };
  bandwidth: {
    uplink_kbps: number;
    downlink_kbps: number;
  };
  frame_details: FrameMetrics[];
}

export class MetricsCollector {
  private frameMetrics: FrameMetrics[] = [];
  private startTime: number;
  private processedFrames = 0;
  private bandwidthStats = { uplink: 0, downlink: 0 };

  constructor() {
    this.startTime = Date.now();
  }

  recordFrame(detectionResult: DetectionResult): void {
    const displayTs = Date.now();
    const e2eLatency = displayTs - detectionResult.capture_ts;
    const serverLatency = detectionResult.inference_ts - detectionResult.recv_ts;
    const networkLatency = detectionResult.recv_ts - detectionResult.capture_ts;

    const metrics: FrameMetrics = {
      frame_id: detectionResult.frame_id,
      capture_ts: detectionResult.capture_ts,
      recv_ts: detectionResult.recv_ts,
      inference_ts: detectionResult.inference_ts,
      display_ts: displayTs,
      e2e_latency: e2eLatency,
      server_latency: serverLatency,
      network_latency: networkLatency
    };

    this.frameMetrics.push(metrics);
    this.processedFrames++;

    // Keep only last 100 frames for memory efficiency
    if (this.frameMetrics.length > 100) {
      this.frameMetrics.shift();
    }
  }

  getMetrics() {
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;
    
    // Calculate latency statistics
    const latencies = this.frameMetrics.map(f => f.e2e_latency);
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    
    const median = this.calculatePercentile(sortedLatencies, 50);
    const p95 = this.calculatePercentile(sortedLatencies, 95);
    
    // Calculate FPS
    const fps = this.processedFrames / elapsedSeconds;

    return {
      latency: { median, p95 },
      fps: fps || 0,
      bandwidth: this.bandwidthStats,
      totalFrames: this.processedFrames,
      elapsedTime: elapsedSeconds
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  setBandwidthStats(uplink: number, downlink: number): void {
    this.bandwidthStats = { uplink, downlink };
  }

  reset(): void {
    this.frameMetrics = [];
    this.startTime = Date.now();
    this.processedFrames = 0;
    this.bandwidthStats = { uplink: 0, downlink: 0 };
  }

  exportMetrics(): MetricsExport {
    const metrics = this.getMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      duration_seconds: metrics.elapsedTime,
      total_frames: metrics.totalFrames,
      processed_fps: metrics.fps,
      latency: {
        median_ms: metrics.latency.median,
        p95_ms: metrics.latency.p95
      },
      bandwidth: {
        uplink_kbps: metrics.bandwidth.uplink,
        downlink_kbps: metrics.bandwidth.downlink
      },
      frame_details: this.frameMetrics.slice(-10) // Last 10 frames
    };
  }
}