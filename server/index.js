const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { ObjectDetectionServer } = require('./objectDetectionServer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory for development
app.use('/models', express.static(path.join(__dirname, '../public/models')));
app.use(express.static(path.join(__dirname, '../public')));

// Try to serve from dist first, fallback to development setup
try {
  app.use(express.static(path.join(__dirname, '../dist')));
} catch (error) {
  console.log('Dist directory not found, using development mode');
}

// Multer for handling file uploads
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Initialize object detection server
const detectionServer = new ObjectDetectionServer();

// WebRTC signaling and detection results WebSocket
const clients = new Map();
let roomConnections = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'start-stream':
          handleStartStream(ws, data);
          break;
          
        case 'offer':
          handleOffer(ws, data);
          break;
          
        case 'answer':
          handleAnswer(ws, data);
          break;
          
        case 'ice-candidate':
          handleIceCandidate(ws, data);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Clean up client from rooms
    for (let [roomId, connections] of roomConnections) {
      const index = connections.indexOf(ws);
      if (index > -1) {
        connections.splice(index, 1);
        if (connections.length === 0) {
          roomConnections.delete(roomId);
        }
      }
    }
  });
});

function handleStartStream(ws, data) {
  const roomId = 'main-room';
  
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, []);
  }
  
  roomConnections.get(roomId).push(ws);
  ws.roomId = roomId;
  ws.role = data.role;
  
  console.log(`Client joined room ${roomId} as ${data.role}`);
  
  // If we have both phone and browser, start WebRTC negotiation
  const connections = roomConnections.get(roomId);
  const phoneClient = connections.find(client => client.role === 'phone');
  const browserClient = connections.find(client => client.role === 'browser');
  
  if (phoneClient && browserClient && phoneClient !== browserClient) {
    // Browser creates offer
    if (ws.role === 'browser') {
      ws.send(JSON.stringify({ type: 'create-offer' }));
    }
  }
}

function handleOffer(ws, data) {
  // Forward offer to phone client
  const connections = roomConnections.get(ws.roomId) || [];
  const phoneClient = connections.find(client => client.role === 'phone');
  
  if (phoneClient) {
    phoneClient.send(JSON.stringify({
      type: 'offer',
      offer: data.offer
    }));
  }
}

function handleAnswer(ws, data) {
  // Forward answer to browser client
  const connections = roomConnections.get(ws.roomId) || [];
  const browserClient = connections.find(client => client.role === 'browser');
  
  if (browserClient) {
    browserClient.send(JSON.stringify({
      type: 'answer',
      answer: data.answer
    }));
  }
}

function handleIceCandidate(ws, data) {
  // Forward ICE candidate to the other peer
  const connections = roomConnections.get(ws.roomId) || [];
  const otherClient = connections.find(client => client !== ws);
  
  if (otherClient) {
    otherClient.send(JSON.stringify({
      type: 'ice-candidate',
      candidate: data.candidate
    }));
  }
}

// REST API for object detection
app.post('/api/detect', upload.single('image'), async (req, res) => {
  try {
    const { image, capture_ts, frame_id } = req.body;
    const recv_ts = Date.now();
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    // Process the image for object detection
    const detections = await detectionServer.detectObjects(image, {
      frame_id,
      capture_ts: parseInt(capture_ts),
      recv_ts
    });
    
    res.json(detections);
  } catch (error) {
    console.error('Detection error:', error);
    res.status(500).json({ error: 'Detection failed' });
  }
});

// Serve React app for all routes
app.get('*', (req, res) => {
  const distPath = path.join(__dirname, '../dist/index.html');
  const publicPath = path.join(__dirname, '../index.html');
  
  // Try dist first, fallback to development
  if (require('fs').existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    // Create a simple HTML file for development
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>WebRTC VLM Detection</title>
        </head>
        <body>
          <div id="root">
            <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
              <h1>WebRTC VLM Multi-Object Detection</h1>
              <p>Server is running on port 3000</p>
              <p>Please run the frontend development server:</p>
              <code>npm run dev</code>
              <br><br>
              <p>Or build the project first:</p>
              <code>npm run build</code>
              <br><br>
              <p><strong>WebSocket Server:</strong> ✅ Ready</p>
              <p><strong>Object Detection API:</strong> ✅ Ready</p>
              <p><strong>Models Directory:</strong> ✅ Available</p>
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

module.exports = { app, server };