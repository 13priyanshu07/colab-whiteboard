// server.js
const { v4: uuidv4 } = require('uuid');
const { createCanvas, loadImage } = require('canvas');

const express = require('express');
const expressWs = require('express-ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const Room = require('./models/Room'); 
require('dotenv').config();

const app = express();
expressWs(app);
connectDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Add the rooms Map and WebSocket endpoint here
const rooms = new Map();

// WebSocket heartbeat setup
function setupHeartbeat(ws) {
  let isAlive = true;
  
  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('pong', () => { isAlive = true; });
  return heartbeatInterval;
}

function broadcastUserCount(room) {
  const count = room.connections.size;
  console.log(`[WS] Broadcasting user count: ${count}`);
  const countMessage = JSON.stringify({
    type: 'USER_COUNT_UPDATE',
    count: room.connections.size
  });

  room.connections.forEach((client) => {
    if (client.readyState === 1) {
      client.send(countMessage);
    }
  });
}

// WebSocket endpoint
app.ws('/whiteboard/:roomId', (ws, req) => {
  const { roomId } = req.params;
  const userId = uuidv4(); // Generate unique user ID
  const heartbeatInterval = setupHeartbeat(ws);

  // Initialize room data
  let room;

  (async () => {
    try {
      room = rooms.get(roomId);
      // Initialize or get room
      if (!room) {
        // Try to load from database if it exists
        const dbRoom = await Room.findById(roomId);
        if (!dbRoom) {
          ws.close(1008, 'Room not found');
          return;
        }

        room = {
          connections: new Map(),
          canvasState: dbRoom.canvasState,
          owner: dbRoom.owner.toString(),
          lastActivity: Date.now()
        };
        rooms.set(roomId, room);
      }
      
      // Add connection to room
      room.connections.set(userId, ws);
      room.lastActivity = Date.now();
      ws.roomRef = room;

      // Set owner if first connection
      if (room.connections.size === 1) {
        room.owner = userId;
      }

      // Send initial state
      ws.send(JSON.stringify({
        type: 'INITIAL_STATE',
        payload: {
          canvasState: room.canvasState,
          roomInfo: {
            roomId,
            userCount: room.connections.size,
            isOwner: userId === room.owner
          }
        }
      }));

      // Notify others about new user
      const notifyUserJoined = () => {
        broadcast(room, ws, JSON.stringify({
          type: 'USER_JOINED',
          payload: { 
            userId,
            userCount: room.connections.size,
            timestamp: Date.now()
          }
        }));
      };

      const updateUserCount = () => {
        console.log("updating user count to: ", room.connections.size);
        broadcast(room, ws, JSON.stringify({
          type: 'USER_COUNT_UPDATE',
          count: room.connections.size
        }));
      };
      
      // Send current canvas state to new connection
      if (room.canvasState) {
        ws.send(JSON.stringify({
          type: 'INITIAL_STATE',
          payload: {
            canvasState: room.canvasState,
            roomInfo: {
              userCount: room.connections.size,
              isOwner: userId === room.owner
            }
          }
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'ROOM_INFO',
          payload: {
            userCount: room.connections.size,
            isOwner: userId === room.owner
          }
        }));
      }

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          room.lastActivity = Date.now();
          
          switch (data.type) {
            case 'DRAW_START':
              broadcast(room, ws, data);
              break;
            case 'DRAW':
              // Optimized drawing data structure
              const drawData = {
                type: 'DRAW',
                payload: {
                  tool: data.payload.tool,
                  shape: data.payload.shape,
                  color: data.payload.color,
                  lineWidth: data.payload.lineWidth,
                  startPos: data.payload.startPos,
                  currentPos: data.payload.currentPos,
                  userId
                }
              };
              broadcast(room, ws, drawData);
              break;

            case 'SAVE_CANVAS':
              room.canvasState = data.payload;
              break;

            case 'REQUEST_STATE':
              if (room.canvasState) {
                ws.send(JSON.stringify({
                  type: 'INITIAL_STATE',
                  payload: {
                    canvasState: room.canvasState,
                    roomInfo: {
                      userCount: room.connections.size,
                      isOwner: userId === room.owner
                    }
                  }
                }));
              }
              break;

            case 'CLEAR_CANVAS': {
              broadcast(room, ws, { type: 'CLEAR_CANVAS' });
              break;
            } 

            case 'UNDO': {
              broadcast(room, ws, { type: 'UNDO' });
              break;
            }

            case 'CANVAS_SNAPSHOT': {
              broadcast(room, ws, data); 
              break;
            }

            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });
      
      notifyUserJoined();
      broadcastUserCount(room);
      updateUserCount();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Server error');
    }
  })();

  // Handle connection close
  ws.on('close', () => {
    clearInterval(heartbeatInterval);
    const room = ws.roomRef;
    if (!room) {
      console.warn('Room not found during close. Possibly already cleaned up.');
      return;
    }
    room.connections.delete(userId);

    Room.findByIdAndUpdate(
      roomId,
      { $pull: { users: userId } },     
      { new: false }                    
    ).catch(console.error);

    broadcast(room, ws, JSON.stringify({
      type: 'USER_LEFT',
      payload: { 
        userId,
        userCount: room.connections.size,
        timestamp: Date.now()
      }
    }));
    broadcastUserCount(room);

    try {
      // Optional: delay cleanup if desired (e.g., 5 seconds instead of 1 hour)
      setTimeout(async () => {
        const stillEmpty = rooms.get(roomId)?.connections.size === 0;
        if (stillEmpty) {
          rooms.delete(roomId);
          await Room.findByIdAndDelete(roomId);
          console.log(`✅ Room ${roomId} deleted from DB`);
        }
      }, 5000); // 5 seconds grace period
    } catch (err) {
      console.error(`❌ Error deleting room ${roomId}:`, err);
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  });
});

// Add HTTP endpoint for room creation
app.post('/create-room', (req, res) => {
  try {
    const roomId = uuidv4().split('-')[0];
    rooms.set(roomId, {
      connections: new Map(),
      canvasState: null,
      owner: null,
      lastActivity: Date.now()
    });
    res.json({ 
      roomId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Room creation failed:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Helper function to broadcast messages
function broadcast(room, sender, message) {
  const messageString = JSON.stringify(message);
  room.connections.forEach((client, clientId) => {
    if (client !== sender && client.readyState === 1) { // 1 = OPEN
      try {
        client.send(messageString);
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        client.close();
      }
    }
  });
}

const PORT = 5000;

const saveDir = path.join(__dirname, 'saved');
if (!fs.existsSync(saveDir)) {
  fs.mkdirSync(saveDir);
}

app.post('/save', async (req, res) => {
  const base64Image = req.body.image.replace(/^data:image\/png;base64,/, '');
  const imgBuffer = Buffer.from(base64Image, 'base64');
  
  // Load the image
  const img = await loadImage(imgBuffer);

  // Create a canvas
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw the original image on top
  ctx.drawImage(img, 0, 0);

  const filePath = path.join(saveDir, 'canvas.png');
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();

  stream.pipe(out);
  out.on('finish', () => res.send('Image saved'));
});

app.get('/load', (req, res) => {
  const filePath = path.join(saveDir, 'canvas.png');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('No saved image');
  }
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
