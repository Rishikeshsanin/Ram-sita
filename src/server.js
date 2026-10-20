'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {WebSocketServer, WebSocket} = require('ws');
const {Game} = require('./game');

const PUBLIC = path.resolve(__dirname, '..', 'public');
const ASSETS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};
const MAX_WS_BYTES = 2048;

function startServer(port = Number(process.env.PORT ?? 3000), game = new Game()) {
  const createLimits = new Map();
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, {'Content-Type': 'text/plain'}).end('Method not allowed');
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
      res.end(JSON.stringify({status: 'ok', app: 'ram-sita', rooms: game.rooms.size}));
      return;
    }
    const asset = ASSETS[(req.url || '').split('?')[0]];
    if (!asset) {
      res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found');
      return;
    }
    const filename = path.join(PUBLIC, asset[0]);
    fs.readFile(filename, (err, content) => {
      if (err) { res.writeHead(500).end('Unable to load game'); return; }
      res.writeHead(200, {
        'Content-Type': asset[1],
        'Cache-Control': asset[0] === 'index.html' ? 'no-cache' : 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      res.end(content);
    });
  });

  const wss = new WebSocketServer({noServer: true, maxPayload: MAX_WS_BYTES, perMessageDeflate: false});
  function send(ws, packet) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
  }
  function broadcast(room) {
    for (const p of room.players) if (p.ws) send(p.ws, game.snapshot(room, p));
  }
  function allowedCreate(ip) {
    const now = Date.now();
    const recent = (createLimits.get(ip) || []).filter(t => now - t < 3600000);
    if (recent.length >= 15) {
      createLimits.set(ip, recent);
      return false;
    }
    recent.push(now);
    createLimits.set(ip, recent);
    return true;
  }
  server.on('upgrade', (req, socket, head) => {
    let originAllowed = true;
    try {
      const origin = req.headers.origin;
      if (origin) originAllowed = new URL(origin).host === req.headers.host;
    } catch (_) { originAllowed = false; }
    if (req.url !== '/ws' || !originAllowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    let room = null;
    let player = null;
    let rate = [];
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', raw => {
      try {
        const now = Date.now();
        rate = rate.filter(t => now - t < 5000);
        if (rate.length >= 25) throw new Error('Too many actions. Slow down for a moment.');
        rate.push(now);
        const msg = JSON.parse(raw.toString('utf8'));
        if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') {
          throw new Error('Invalid message.');
        }
        if (!player) {
          let joined;
          if (msg.type === 'create') {
            if (!allowedCreate(req.socket.remoteAddress || 'unknown')) throw new Error('Too many rooms created from this connection.');
            joined = game.create(msg.name, msg.config);
          } else if (msg.type === 'join') joined = game.join(msg.code, msg.name);
          else if (msg.type === 'resume') joined = game.resume(msg.code, msg.token);
          else throw new Error('Join or create a room first.');
          room = joined.room;
          player = joined.player;
          game.attach(room, player, ws);
          send(ws, {type: 'session', code: room.code, token: player.token});
          broadcast(room);
        } else {
          if (['create', 'join', 'resume'].includes(msg.type)) throw new Error('You already have a seat.');
          game.act(room, player, msg.type, msg);
          broadcast(room);
        }
      } catch (err) {
        send(ws, {type: 'error', message: err instanceof SyntaxError ? 'Invalid message format.' : err.message});
      }
    });
    ws.on('close', () => {
      if (room && player) {
        game.detach(room, player, ws);
        if (game.rooms.has(room.code)) broadcast(room);
      }
    });
    ws.on('error', () => {});
  });

  let lastPing = 0;
  const timer = setInterval(() => {
    for (const room of game.tick()) broadcast(room);
    if (Date.now() - lastPing >= 25000) {
      lastPing = Date.now();
      for (const ws of wss.clients) {
        if (!ws.alive) { ws.terminate(); continue; }
        ws.alive = false;
        try { ws.ping(); } catch (_) {}
      }
    }
    if (createLimits.size > 5000) {
      for (const [ip, times] of createLimits) {
        if (!times.some(t => Date.now() - t < 3600000)) createLimits.delete(ip);
      }
    }
  }, 1000);
  timer.unref();

  server.listen(port, '0.0.0.0');
  server.on('listening', () => {
    if (require.main === module) process.stdout.write('Ram–Sita running on port ' + server.address().port + '\n');
  });
  function close() {
    clearInterval(timer);
    for (const ws of wss.clients) ws.terminate();
    return new Promise(resolve => {
      wss.close(() => server.close(resolve));
    });
  }
  return {server, wss, game, close};
}
if (require.main === module) {
  const app = startServer();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => { await app.close(); process.exit(0); });
  }
}
module.exports = {startServer};
