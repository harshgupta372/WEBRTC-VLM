const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

class ObjectDetectionServer {
  constructor() {
    this.isInitialized = false;
    this.pythonProcess = null;
    this.modelLoaded = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if Python detection script exists
      const scriptPath = path.join(__dirname, 'detect.py');
      await fs.access(scriptPath);
      
      console.log('Object detection server initialized with Python script');
      this.modelLoaded = true;
    } catch (error) {
      console.log('Python detection script not found, using enhanced mock detection');
    }
    
    this.isInitialized = true;
  }

  async detectObjects(imageData, metadata) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const inference_ts = Date.now();
    
    try {
      let detections;
      
      if (this.modelLoaded) {
        // Use Python script for real inference
        detections = await this.runPythonInference(imageData);
      } else {
        // Enhanced mock detection with image processing
        detections = await this.processImageAndDetect(imageData);
      }
      
      return {
        frame_id: metadata.frame_id,
        capture_ts: metadata.capture_ts,
        recv_ts: metadata.recv_ts,
        inference_ts,
        detections
      };
    } catch (error) {
      console.error('Detection failed:', error);
      return {
        frame_id: metadata.frame_id,
        capture_ts: metadata.capture_ts,
        recv_ts: metadata.recv_ts,
        inference_ts,
        detections: []
      };
    }
  }

  async processImageAndDetect(imageData) {
    try {
      // Process base64 image data
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Use sharp to get image dimensions for better mock detection
      const metadata = await sharp(buffer).metadata();
      const { width, height } = metadata;
      
      // Generate more realistic mock detections based on image properties
      return this.generateEnhancedMockDetections(width, height);
    } catch (error) {
      console.error('Image processing error:', error);
      return this.generateMockDetections();
    }
  }

  async runPythonInference(imageData) {
    // This would run actual Python inference script
    // For now, return enhanced mock data
    return this.generateMockDetections();
  }

  generateEnhancedMockDetections(width = 640, height = 480) {
    const mockObjects = [
      { label: 'person', prob: 0.2 },
      { label: 'phone', prob: 0.3 },
      { label: 'cup', prob: 0.25 },
      { label: 'book', prob: 0.2 },
      { label: 'laptop', prob: 0.15 },
      { label: 'bottle', prob: 0.2 },
      { label: 'chair', prob: 0.15 }
    ];

    const detections = [];
    
    mockObjects.forEach(obj => {
      if (Math.random() < obj.prob) {
        // Generate more realistic bounding boxes based on object type
        let centerX, centerY, objWidth, objHeight;
        
        switch (obj.label) {
          case 'person':
            centerX = 0.3 + Math.random() * 0.4;
            centerY = 0.2 + Math.random() * 0.3;
            objWidth = 0.15 + Math.random() * 0.2;
            objHeight = 0.3 + Math.random() * 0.4;
            break;
          case 'phone':
            centerX = 0.4 + Math.random() * 0.2;
            centerY = 0.4 + Math.random() * 0.2;
            objWidth = 0.08 + Math.random() * 0.1;
            objHeight = 0.12 + Math.random() * 0.15;
            break;
          default:
            centerX = 0.2 + Math.random() * 0.6;
            centerY = 0.2 + Math.random() * 0.6;
            objWidth = 0.1 + Math.random() * 0.25;
            objHeight = 0.1 + Math.random() * 0.25;
        }
        
        detections.push({
          label: obj.label,
          score: 0.65 + Math.random() * 0.35, // 65-100% confidence
          xmin: Math.max(0, centerX - objWidth/2),
          ymin: Math.max(0, centerY - objHeight/2),
          xmax: Math.min(1, centerX + objWidth/2),
          ymax: Math.min(1, centerY + objHeight/2)
        });
      }
    });

    return detections;
  }

  generateMockDetections() {
    return this.generateEnhancedMockDetections();
  }

  cleanup() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}

module.exports = { ObjectDetectionServer };