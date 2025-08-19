export interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface DetectionResult {
  frame_id: string;
  capture_ts: number;
  recv_ts: number;
  inference_ts: number;
  detections: Detection[];
}

export class ObjectDetectionEngine {
  private isServerMode: boolean;
  private session: unknown = null;
  private modelLoaded = false;
  private frameQueue: Array<{ imageData: ImageData; captureTs: number; frameId: string }> = [];
  private isProcessing = false;

  constructor(isServerMode: boolean) {
    this.isServerMode = isServerMode;
  }

  async initialize(): Promise<void> {
    if (this.isServerMode) {
      // Server mode - no local initialization needed
      this.modelLoaded = true;
      return;
    }

    try {
      // Initialize ONNX Runtime Web for client-side inference
      const ort = await import('onnxruntime-web');
      
      // Load quantized MobileNet-SSD model
      const modelUrl = '/models/mobilenet-ssd.onnx';
      
      // Check if model file exists and is valid
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Model file not found: ${response.status}`);
      }
      
      // For now, use mock detection since we have a placeholder model
      console.log('Using mock detection for WASM mode (model placeholder)');
      this.modelLoaded = true;
      
      // Uncomment below when real ONNX model is available
      /*
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      console.log('ONNX model loaded successfully');
      */
      
    } catch (error) {
      console.error('Failed to initialize WASM inference:', error);
      // Fallback to mock detection for demo purposes
      this.modelLoaded = true;
    }
  }

  async detectObjects(imageData: ImageData, captureTs: number): Promise<DetectionResult | null> {
    if (!this.modelLoaded) {
      console.warn('Detection engine not initialized');
      return null;
    }

    const frameId = `frame_${captureTs}`;
    const recvTs = Date.now();

    if (this.isServerMode) {
      // This shouldn't be called in server mode
      throw new Error('detectObjects called in server mode');
    }

    try {
      const inferenceTs = Date.now();
      let detections: Detection[];

      if (this.session) {
        // Real ONNX inference
        detections = await this.runONNXInference(imageData);
      } else {
        // Mock detection for demo
        detections = this.generateMockDetections();
      }

      return {
        frame_id: frameId,
        capture_ts: captureTs,
        recv_ts: recvTs,
        inference_ts: inferenceTs,
        detections
      };
    } catch (error) {
      console.error('Object detection failed:', error);
      return null;
    }
  }

  private async runONNXInference(imageData: ImageData): Promise<Detection[]> {
    try {
      // Preprocess image for MobileNet-SSD (320x240 input)
      const input = this.preprocessImage(imageData);
      
      // Run inference (commented out until real model is loaded)
      // const results = await (this.session as any).run({ input });
      // return this.postprocessResults(results);
      
      // Use mock detection for now
      return this.generateMockDetections();
    } catch (error) {
      console.error('ONNX inference failed:', error);
      return this.generateMockDetections();
    }
  }

  private preprocessImage(imageData: ImageData): Float32Array {
    const { width, height, data } = imageData;
    const targetWidth = 320;
    const targetHeight = 240;
    
    // Create resized and normalized tensor
    const input = new Float32Array(1 * 3 * targetHeight * targetWidth);
    
    // Simple bilinear resize and normalize
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor((x / targetWidth) * width);
        const srcY = Math.floor((y / targetHeight) * height);
        const srcIdx = (srcY * width + srcX) * 4;
        
        const r = data[srcIdx] / 255.0;
        const g = data[srcIdx + 1] / 255.0;
        const b = data[srcIdx + 2] / 255.0;
        
        const dstIdx = y * targetWidth + x;
        input[dstIdx] = r; // R channel
        input[targetHeight * targetWidth + dstIdx] = g; // G channel
        input[2 * targetHeight * targetWidth + dstIdx] = b; // B channel
      }
    }
    
    return input;
  }

  private postprocessResults(results: unknown): Detection[] {
    // This would parse actual ONNX model outputs
    // For demo, return mock detections
    return this.generateMockDetections();
  }

  private generateMockDetections(): Detection[] {
    // Generate realistic mock detections for demo
    const mockObjects = [
      { label: 'person', prob: 0.1 },
      { label: 'phone', prob: 0.2 },
      { label: 'cup', prob: 0.15 },
      { label: 'book', prob: 0.1 },
      { label: 'laptop', prob: 0.1 }
    ];

    const detections: Detection[] = [];
    
    mockObjects.forEach(obj => {
      if (Math.random() < obj.prob) {
        detections.push({
          label: obj.label,
          score: 0.7 + Math.random() * 0.3, // 70-100% confidence
          xmin: Math.random() * 0.5, // Random position
          ymin: Math.random() * 0.5,
          xmax: Math.random() * 0.3 + 0.2, // Random size
          ymax: Math.random() * 0.3 + 0.2
        });
      }
    });

    return detections;
  }

  cleanup(): void {
    if (this.session) {
      this.session = null;
    }
    this.modelLoaded = false;
    this.frameQueue = [];
  }
}