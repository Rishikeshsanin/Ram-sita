'use strict';

const crypto = require('node:crypto');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const ROLES = ['Rama', 'Sita', 'Ravana', 'Lakshmana', 'Hanuman', 'Bharata', 'Shatrughna', 'Sugriva', 'Vibhishana', 'Jatayu'];
function fail(message) { throw new Error(message); }
function nameOf(value) {
  if (typeof value !== 'string') fail('Enter your name first.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 20 || /[\u0000-\u001f\u007f<>]/.test(name)) fail('Names must be 1–20 safe characters.');
  return name;
}
function intBetween(value, lo, hi, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < lo || n > hi) fail(label + ' must be between ' + lo + ' and ' + hi + '.');
  return n;
}
function settings(input) {
  input = input || {};
  if (input.mode !== undefined && input.mode !== 'classic') fail('Only Classic Ram–Sita is available in this release.');
  return {
    maxPlayers: intBetween(input.maxPlayers == null ? 6 : input.maxPlayers, MIN_PLAYERS, MAX_PLAYERS, 'Players'),
    totalRounds: intBetween(input.totalRounds == null ? 7 : input.totalRounds, 3, 30, 'Rounds'),
    guessSeconds: intBetween(input.guessSeconds == null ? 45 : input.guessSeconds, 20, 90, 'Timer'),
    mode: 'classic'
  };
}
function randomId(size = 16) { return crypto.randomBytes(size).toString('hex'); }
function shuffled(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function playerFor(name, host) {
  return { id: randomId(8), token: randomId(24), name: nameOf(name), score: 0, ready: !!host, connected: false, disconnectedAt: null, ramaCount: 0, ws: null };
}
function scoreFor(role, correct) {
  if (role === 'Rama') return correct ? 1000 : 0;
  if (role === 'Sita') return correct ? 200 : 800;
  if (role === 'Ravana') return correct ? 100 : 500;
  return 200;
}
class Game {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.rooms = new Map();
  }
  create(name, config) {
    const options = settings(config);
    let code;
    do { code = Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join(''); }
    while (this.rooms.has(code));
    const player = playerFor(name, true);
    const room = {
      code, config: options, players: [player], hostId: player.id,
      status: 'lobby', round: 0, roles: {}, roleReady: {},
      result: null, deadline: null, paused: false, pausedRemaining: 0,
      lastActivity: this.now()
    };
    this.rooms.set(code, room);
    return {room, player};
  }
  join(code, name) {
    const room = this.requireRoom(code);
    if (room.status !== 'lobby') fail('This game has already started. Ask the host to start a new room.');
    if (room.players.length >= room.config.maxPlayers) fail('This room is full.');
    name = nameOf(name);
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) fail('Someone already has that name. Pick another.');
    const player = playerFor(name, false);
    room.players.push(player);
    this.touch(room);
    return {room, player};
  }
  resume(code, token) {
    const room = this.requireRoom(code);
    if (typeof token !== 'string') fail('Missing session token.');
    const player = room.players.find(p => p.token === token);
    if (!player) fail('Your seat was not found. Join a new lobby.');
    this.touch(room);
    return {room, player};
  }
  requireRoom(code) {
    if (typeof code !== 'string') fail('Enter a six-character room code.');
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room) fail('Room not found or expired. Double-check the code.');
    return room;
  }
  touch(room) { room.lastActivity = this.now(); }
  attach(room, player, ws) {
    if (player.ws && player.ws !== ws) {
      try { player.ws.close(4001, 'Reconnected on another tab'); } catch (_) {}
    }
    player.ws = ws;
    player.connected = true;
    player.disconnectedAt = null;
    // When the last disconnected ready player returns, the round can begin safely.
    if (room.status === 'dealing' && room.players.every(p => p.connected && room.roleReady[p.id])) {
      this.startDiscussion(room);
    }
    this.touch(room);
  }
  detach(room, player, ws) {
    if (player.ws !== ws) return;
    player.ws = null;
    player.connected = false;
    player.disconnectedAt = this.now();
    this.touch(room);
  }
  act(room, player, type, data = {}) {
    const host = player.id === room.hostId;
    const lobby = room.status === 'lobby';
    const playing = room.status === 'discussion';
    if (type === 'ready') {
      if (!lobby) fail('Ready is available only before a game.');
      player.ready = !!data.ready;
    } else if (type === 'config') {
      if (!host || !lobby) fail('Only the host can edit lobby settings.');
      const updated = settings(data);
      if (updated.maxPlayers < room.players.length) fail('Capacity cannot be smaller than the current lobby.');
      room.config = updated;
    } else if (type === 'kick') {
      if (!host || !lobby) fail('Only the host can remove players before a match.');
      if (data.id === room.hostId) fail('Cannot remove the host.');
      const victim = room.players.find(p => p.id === data.id);
      if (!victim) fail('Player not found.');
      room.players = room.players.filter(p => p !== victim);
      if (victim.ws) {
        try { victim.ws.send(JSON.stringify({type: 'kicked', message: 'The host removed you from this room.'})); victim.ws.close(4002, 'Removed from room'); } catch (_) {}
      }
    } else if (type === 'start') {
      if (!host || !lobby) fail('Only the host can start a lobby.');
      if (room.players.length < MIN_PLAYERS) fail('At least three friends must join.');
      if (room.players.some(p => !p.connected || !p.ready)) fail('All players must be connected and ready.');
      this.nextRound(room);
    } else if (type === 'role_ready') {
      if (room.status !== 'dealing') fail('You can confirm your character only before guessing starts.');
      room.roleReady[player.id] = !!data.ready;
      if (room.players.every(p => p.connected && room.roleReady[p.id])) this.startDiscussion(room);
    } else if (type === 'guess') {
      if (!playing || room.paused) fail('No active guessing round.');
      if (room.roles[player.id] !== 'Rama') fail('Only Rama can make the final guess.');
      if (this.now() >= room.deadline) {
        this.resolve(room, null, true);
      } else if (!room.players.some(p => p.id === data.id && p.id !== player.id)) {
        fail('Choose a player from the list.');
      } else {
        this.resolve(room, data.id, false);
      }
    } else if (type === 'pause') {
      if (!host || !playing) fail('Only the host can pause an active round.');
      if (!room.paused) {
        room.pausedRemaining = Math.max(0, room.deadline - this.now());
        room.deadline = null;
        room.paused = true;
      } else {
        room.deadline = this.now() + room.pausedRemaining;
        room.paused = false;
      }
    } else if (type === 'next') {
      if (!host || room.status !== 'reveal') fail('Only the host can move past the reveal.');
      if (room.round === room.config.totalRounds) room.status = 'finished';
      else this.nextRound(room);
    } else if (type === 'rematch') {
      if (!host || room.status !== 'finished') fail('Only the host can set up a rematch.');
      room.status = 'lobby';
      room.round = 0;
      room.roles = {};
      room.roleReady = {};
      room.result = null;
      room.deadline = null;
      room.players.forEach(p => { p.score = 0; p.ramaCount = 0; p.ready = p.id === room.hostId; });
    } else if (type === 'leave') {
      if (playing || room.status === 'reveal') fail('You cannot abandon a seat during a match. Close the tab and return with the same link to reconnect.');
      room.players = room.players.filter(p => p !== player);
      if (player.ws) {
        try { player.ws.send(JSON.stringify({type: 'left'})); player.ws.close(4003, 'Left room'); } catch (_) {}
      }
      if (!room.players.length) this.rooms.delete(room.code);
      else if (host) {
        room.hostId = (room.players.find(p => p.connected) || room.players[0]).id;
        room.players.find(p => p.id === room.hostId).ready = true;
      }
    } else fail('Unknown action.');
    this.touch(room);
  }
  nextRound(room) {
    if (room.players.length < MIN_PLAYERS) fail('At least three players are required.');
    room.round++;
    const least = Math.min(...room.players.map(p => p.ramaCount));
    const rama = shuffled(room.players.filter(p => p.ramaCount === least))[0];
    rama.ramaCount++;
    const others = shuffled(room.players.filter(p => p !== rama));
    room.roles = {[rama.id]: 'Rama'};
    const remaining = ROLES.slice(1, room.players.length);
    for (let i = 0; i < others.length; i++) room.roles[others[i].id] = remaining[i];
    room.roleReady = {};
    room.status = 'dealing';
    room.result = null;
    room.paused = false;
    room.pausedRemaining = 0;
    room.deadline = null;
  }
  startDiscussion(room) {
    if (room.status !== 'dealing') return;
    room.status = 'discussion';
    room.deadline = this.now() + room.config.guessSeconds * 1000;
  }
  resolve(room, guessedId, timedOut) {
    if (room.status !== 'discussion') return;
    const correct = !!guessedId && room.roles[guessedId] === 'Sita';
    const deltas = {};
    for (const player of room.players) {
      const points = scoreFor(room.roles[player.id], correct);
      deltas[player.id] = points;
      player.score += points;
    }
    room.result = {
      guessedId, correct, timedOut,
      ramaId: room.players.find(p => room.roles[p.id] === 'Rama')?.id || null,
      sitaId: room.players.find(p => room.roles[p.id] === 'Sita')?.id || null,
      deltas,
      roles: {...room.roles}
    };
    room.deadline = null;
    room.paused = false;
    room.status = 'reveal';
    this.touch(room);
  }
  snapshot(room, player) {
    const isHost = room.hostId === player.id;
    const role = ['dealing', 'discussion'].includes(room.status) ? room.roles[player.id] : null;
    return {
      type: 'snapshot',
      code: room.code, status: room.status, round: room.round, config: room.config,
      hostId: room.hostId, you: {id: player.id, name: player.name, host: isHost, role},
      players: room.players.map(p => ({
        id: p.id, name: p.name, score: p.score, connected: p.connected, ready: p.ready,
        roleReady: room.status === 'dealing' ? !!room.roleReady[p.id] : null
      })),
      ramaId: ['dealing', 'discussion'].includes(room.status) ? room.players.find(p => room.roles[p.id] === 'Rama')?.id || null : null,
      paused: room.paused, deadline: room.deadline, pausedRemaining: room.pausedRemaining,
      result: ['reveal', 'finished'].includes(room.status) ? room.result : null,
      serverNow: this.now()
    };
  }
  tick() {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (this.now() - room.lastActivity > 4 * 60 * 60 * 1000) {
        this.rooms.delete(room.code);
        for (const p of room.players) {
          try { p.ws?.close(4004, 'Room expired'); } catch (_) {}
        }
        continue;
      }
      if (room.status === 'discussion' && !room.paused && this.now() >= room.deadline) {
        this.resolve(room, null, true);
        changed.push(room);
      }
      const host = room.players.find(p => p.id === room.hostId);
      if (host && !host.connected && this.now() - host.disconnectedAt > 45000) {
        const newHost = room.players.find(p => p.connected);
        if (newHost) {
          room.hostId = newHost.id;
          newHost.ready = true;
          changed.push(room);
        }
      }
    }
    return changed;
  }
}
module.exports = {Game, ROLES, settings, scoreFor, MIN_PLAYERS, MAX_PLAYERS};
