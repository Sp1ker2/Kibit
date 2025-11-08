const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const HTTPS_PORT = 8443;
const HTTP_PORT = 8080;

const CERT_PATH = '/etc/letsencrypt/live/kibitkostreamappv.pp.ua/fullchain.pem';
const KEY_PATH = '/etc/letsencrypt/live/kibitkostreamappv.pp.ua/privkey.pem';

const useHttps = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);
const server = useHttps
  ? https.createServer(
      {
        cert: fs.readFileSync(CERT_PATH),
        key: fs.readFileSync(KEY_PATH),
      },
      app,
    )
  : http.createServer(app);

const wss = new WebSocket.Server({ server });

/**
 * rooms = Map<string, {
 *   publisher: WebSocket | null,
 *   frame: string | null,
 *   timestamp: number | null,
 *   username: string | null,
 *   connectedAt: number | null,
 *   viewers: Set<WebSocket>
 * }>
 */
const rooms = new Map();

function ensureRoom(room) {
  if (!rooms.has(room)) {
    rooms.set(room, {
      publisher: null,
      frame: null,
      timestamp: null,
      username: null,
      connectedAt: null,
      viewers: new Set(),
    });
  }
  return rooms.get(room);
}

function broadcastRoomInfo(room, roomData) {
  if (!roomData) {
    return;
  }
  const payload = JSON.stringify({
    type: 'info',
    room,
    username: roomData.username,
    connectedAt: roomData.connectedAt,
    viewers: roomData.viewers.size,
  });
  roomData.viewers.forEach((viewer) => {
    if (viewer.readyState === WebSocket.OPEN) {
      viewer.send(payload);
    }
  });
}

function disconnectPublisher(roomData) {
  if (!roomData) {
    return;
  }
  roomData.publisher = null;
  roomData.frame = null;
  roomData.timestamp = null;
  roomData.username = null;
  roomData.connectedAt = null;
}

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'ws://localhost');
  const room = url.searchParams.get('room');
  const role = url.searchParams.get('role') || 'viewer';
  const nameParam = url.searchParams.get('name');
  const normalizedName = nameParam ? nameParam.trim().slice(0, 50) : null;

  if (!room) {
    ws.close(1008, 'room parameter is required');
    return;
  }

  const roomData = ensureRoom(room);
  console.log(`New connection: room=${room}, role=${role}`);

  if (role === 'publisher') {
    if (roomData.publisher && roomData.publisher.readyState === WebSocket.OPEN) {
      console.log(`Replacing previous publisher in room ${room}`);
      try {
        roomData.publisher.close(1000, 'replaced');
      } catch (err) {
        console.error(`Failed to close previous publisher:`, err);
      }
    }

    roomData.publisher = ws;
    roomData.connectedAt = Date.now();
    if (normalizedName) {
      roomData.username = normalizedName;
      console.log(`Publisher name from URL: room=${room}, user=${roomData.username}`);
    }
    broadcastRoomInfo(room, roomData);
    console.log(`Publisher registered for room ${room}`);

    ws.on('message', (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (err) {
        console.error(`Invalid JSON from publisher in room ${room}:`, err);
        return;
      }

      if (message.type === 'register') {
        roomData.username = String(message.username || 'Unknown').trim() || 'Unknown';
        roomData.connectedAt = Date.now();
        console.log(`Publisher info updated: room=${room}, user=${roomData.username}`);
        broadcastRoomInfo(room, roomData);
        return;
      }

      if (message.type === 'frame' && message.data) {
        roomData.frame = message.data;
        roomData.timestamp = Date.now();

        roomData.viewers.forEach((viewer) => {
          if (viewer.readyState === WebSocket.OPEN) {
            viewer.send(
              JSON.stringify({
                type: 'frame',
                data: message.data,
                username: roomData.username,
                timestamp: roomData.timestamp,
              }),
            );
          }
        });
      }
    });

    ws.on('close', () => {
      console.log(`Publisher disconnected from room ${room}`);
      disconnectPublisher(roomData);
      roomData.viewers.forEach((viewer) => {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(JSON.stringify({ type: 'stream_ended' }));
        }
      });
      broadcastRoomInfo(room, roomData);
    });
  } else {
    roomData.viewers.add(ws);
    console.log(`Viewer joined room ${room}. Total viewers: ${roomData.viewers.size}`);

    // Надсилаємо інформацію про стрімера
    ws.send(
      JSON.stringify({
        type: 'info',
        room,
        username: roomData.username,
        connectedAt: roomData.connectedAt,
        viewers: roomData.viewers.size,
      }),
    );

    if (roomData.frame) {
      ws.send(JSON.stringify({ type: 'frame', data: roomData.frame }));
    }

    ws.on('close', () => {
      roomData.viewers.delete(ws);
      console.log(`Viewer left room ${room}. Remaining: ${roomData.viewers.size}`);
      if (!roomData.publisher && roomData.viewers.size === 0) {
        rooms.delete(room);
        console.log(`Room ${room} cleaned up`);
      }
    });
  }

  ws.on('error', (error) => {
    console.error(`WebSocket error in room ${room} (${role}):`, error);
  });
});

app.get('/api/rooms', (req, res) => {
  const payload = Array.from(rooms.entries())
    .filter(([, info]) => info.publisher && info.publisher.readyState === WebSocket.OPEN)
    .map(([room, info]) => ({
      room,
      username: info.username || 'Unknown',
      connectedAt: info.connectedAt,
      lastFrame: info.timestamp,
      viewers: info.viewers.size,
    }));
  res.json(payload);
});

app.get('/api/latest-frame/:room', (req, res) => {
  const roomData = rooms.get(req.params.room);
  if (!roomData || !roomData.frame) {
    res.status(404).send('No frame available for this room');
    return;
  }
  res.json({
    frame: roomData.frame,
    timestamp: roomData.timestamp,
    username: roomData.username || 'Unknown',
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/viewer.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.get('/admin.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const listenPort = useHttps ? HTTPS_PORT : HTTP_PORT;
server.listen(listenPort, () => {
  console.log('============================================================');
  console.log('Simple Stream Server started!');
  if (useHttps) {
    console.log(`Listening on https://kibitkostreamappv.pp.ua:${HTTPS_PORT}`);
  } else {
    console.log(`Listening on http://localhost:${HTTP_PORT}`);
  }
  console.log('============================================================');
});

process.on('SIGTERM', () => {
  console.log('Gracefully shutting down server...');
  wss.close();
  server.close();
});

