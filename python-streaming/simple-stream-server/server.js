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
 * room structure:
 * {
 *   publishers: Map<string, {
 *     socket: WebSocket,
 *     displayName: string,
 *     frame: string | null,
 *     connectedAt: number,
 *     lastFrameAt: number | null
 *   }>,
 *   viewersByStreamer: Map<string, Set<WebSocket>>,
 *   lobby: Set<WebSocket>
 * }
 */
const rooms = new Map();

function sanitizeName(value, fallback = 'Streamer') {
  if (!value) return fallback;
  return String(value).trim().slice(0, 50) || fallback;
}

function getRoom(roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, {
      publishers: new Map(),
      viewersByStreamer: new Map(),
      lobby: new Set(),
    });
  }
  return rooms.get(roomName);
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to send ws message', err);
    }
  }
}

function buildRoomSummary(roomName) {
  const room = rooms.get(roomName);
  if (!room) {
    return { room: roomName, streamers: [] };
  }
  const streamers = Array.from(room.publishers.entries()).map(([username, info]) => ({
    username,
    displayName: info.displayName,
    connectedAt: info.connectedAt,
    lastFrameAt: info.lastFrameAt,
    viewers: room.viewersByStreamer.get(username)?.size || 0,
  }));
  return { room: roomName, streamers };
}

function broadcastSummary(roomName) {
  const summary = buildRoomSummary(roomName);
  const payload = { type: 'summary', room: roomName, streamers: summary.streamers };
  const room = rooms.get(roomName);
  if (!room) return;
  room.lobby.forEach((viewer) => sendJson(viewer, payload));
  room.viewersByStreamer.forEach((viewers) => {
    viewers.forEach((viewer) => sendJson(viewer, payload));
  });
}

function cleanupRoom(roomName) {
  const room = rooms.get(roomName);
  if (!room) return;
  if (room.publishers.size === 0 && room.viewersByStreamer.size === 0 && room.lobby.size === 0) {
    rooms.delete(roomName);
    console.log(`Room ${roomName} cleaned up`);
  }
}

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'ws://localhost');
  const room = url.searchParams.get('room');
  const role = url.searchParams.get('role') || 'viewer';
  const nameParam = url.searchParams.get('name');
  const viewerTarget = url.searchParams.get('user');
  const normalizedName = sanitizeName(nameParam, `Streamer_${Math.floor(Math.random() * 1_000_000)}`);

  if (!room) {
    ws.close(1008, 'room parameter is required');
    return;
  }

  const roomData = getRoom(room);
  console.log(`New connection: room=${room}, role=${role}, name=${normalizedName}${viewerTarget ? `, target=${viewerTarget}` : ''}`);

  if (role === 'publisher') {
    const existing = roomData.publishers.get(normalizedName);
    if (existing && existing.socket.readyState === WebSocket.OPEN) {
      console.log(`Replacing existing publisher in room ${room} with username=${normalizedName}`);
      try {
        existing.socket.close(1000, 'replaced');
      } catch (err) {
        console.error('Failed to close previous publisher socket', err);
      }
    }

    const publisher = {
      socket: ws,
      displayName: normalizedName,
      frame: null,
      connectedAt: Date.now(),
      lastFrameAt: null,
    };
    roomData.publishers.set(normalizedName, publisher);
    broadcastSummary(room);
    console.log(`Publisher registered: room=${room}, username=${normalizedName}`);

    ws.on('message', (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (err) {
        console.error(`Invalid JSON from publisher in room ${room}:`, err);
        return;
      }

      if (message.type === 'register') {
        publisher.displayName = sanitizeName(message.username, publisher.displayName);
        console.log(`Publisher info updated: room=${room}, username=${normalizedName}, display=${publisher.displayName}`);
        broadcastSummary(room);
        return;
      }

      if (message.type === 'frame' && message.data) {
        publisher.frame = message.data;
        publisher.lastFrameAt = Date.now();

        const viewersSet = roomData.viewersByStreamer.get(normalizedName);
        if (viewersSet) {
          viewersSet.forEach((viewer) => sendJson(viewer, {
            type: 'frame',
            data: message.data,
            username: publisher.displayName,
            timestamp: publisher.lastFrameAt,
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log(`Publisher disconnected: room=${room}, username=${normalizedName}`);
      roomData.publishers.delete(normalizedName);
      const viewersSet = roomData.viewersByStreamer.get(normalizedName);
      if (viewersSet) {
        viewersSet.forEach((viewer) => sendJson(viewer, { type: 'stream_ended', username: publisher.displayName }));
        roomData.viewersByStreamer.delete(normalizedName);
      }
      broadcastSummary(room);
      cleanupRoom(room);
    });
  } else {
    if (viewerTarget) {
      const viewersSet = roomData.viewersByStreamer.get(viewerTarget) || new Set();
      viewersSet.add(ws);
      roomData.viewersByStreamer.set(viewerTarget, viewersSet);
      console.log(`Viewer joined room=${room}, target=${viewerTarget}. Total viewers for target=${viewersSet.size}`);

      sendJson(ws, { type: 'summary', room, streamers: buildRoomSummary(room).streamers });

      const publisher = roomData.publishers.get(viewerTarget);
      if (publisher?.frame) {
        sendJson(ws, {
          type: 'frame',
          data: publisher.frame,
          username: publisher.displayName,
          timestamp: publisher.lastFrameAt,
        });
      }

      ws.on('close', () => {
        viewersSet.delete(ws);
        if (viewersSet.size === 0) {
          roomData.viewersByStreamer.delete(viewerTarget);
        }
        console.log(`Viewer left room=${room}, target=${viewerTarget}. Remaining viewers=${viewersSet.size}`);
        cleanupRoom(room);
      });
    } else {
      roomData.lobby.add(ws);
      console.log(`Viewer joined lobby for room ${room}. Lobby size=${roomData.lobby.size}`);
      sendJson(ws, { type: 'summary', room, streamers: buildRoomSummary(room).streamers });

      ws.on('close', () => {
        roomData.lobby.delete(ws);
        console.log(`Viewer left lobby for room ${room}. Lobby size=${roomData.lobby.size}`);
        cleanupRoom(room);
      });
    }
  }

  ws.on('error', (error) => {
    console.error(`WebSocket error in room ${room} (${role}):`, error);
  });
});

app.get('/api/rooms', (_req, res) => {
  const payload = Array.from(rooms.keys()).map((roomName) => buildRoomSummary(roomName));
  res.json(payload);
});

app.get('/api/latest-frame/:room/:user', (req, res) => {
  const { room, user } = req.params;
  const roomData = rooms.get(room);
  if (!roomData) {
    res.status(404).send('Room not found');
    return;
  }
  const publisher = roomData.publishers.get(user);
  if (!publisher || !publisher.frame) {
    res.status(404).send('No frame available for this stream');
    return;
  }
  res.json({
    frame: publisher.frame,
    timestamp: publisher.lastFrameAt,
    username: publisher.displayName,
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

