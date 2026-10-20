'use strict';

const crypto = require('node:crypto');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const ROLES = ['Rama', 'Sita', 'Ravana', 'Lakshmana', 'Hanuman', 'Bharata', 'Shatrughna', 'Sugriva', 'Vibhishana', 'Jatayu'];
const SIGILS = [
  { id: 'lotus', symbol: '🪷', name: 'Lotus' },
  { id: 'moon', symbol: '🌙', name: 'Moon' },
  { id: 'flame', symbol: '🔥', name: 'Flame' },
  { id: 'bow', symbol: '🏹', name: 'Bow' },
  { id: 'sun', symbol: '☀️', name: 'Sun' },
  { id: 'star', symbol: '⭐', name: 'Star' }
];

const COURT_CHALLENGES = [
  'Who in this room has the worst poker face?',
  'Who would betray the group chat for a plate of biryani?',
  'Who here looks suspicious even while telling the truth?',
  'Who is most likely to win an argument they started by mistake?',
  'If there was a secret alliance in the room, who would lead it?',
  'Who would crack first under ten seconds of questioning?',
  'Who could keep a giant secret for a whole year?',
  'Who here would absolutely fake being innocent?',
  'Who would make the best detective in a mystery film?',
  'Who is most likely to confuse everyone with one sentence?',
  'Who would sell out their teammate to win a board game?',
  'Who here gives the most believable fake excuses?',
  'Who always looks guilty when somebody asks a serious question?',
  'Who would get caught bluffing in the first five seconds?',
  'Who is most likely to invent a completely ridiculous alibi?',
  'Who in this room is secretly the best strategist?',
  'Who would volunteer to be questioned just to distract everyone?',
  'Who gives away secrets by smiling at the wrong moment?',
  'Who in this room would win a lie-detector challenge?',
  'Who would make the most dramatic courtroom confession?'
];

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
      status: 'lobby', round: 0, roles: {}, claims: {}, trueSigil: null, challenge: null,
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
    } else if (type === 'claim') {
      if (!playing || room.paused || room.config.mode !== 'mystery') fail('Sigil claims are available only during an active mystery round.');
      if (room.roles[player.id] === 'Rama') fail('Rama does not submit a claim.');
      if (!SIGILS.some(s => s.id === data.sigil)) fail('Unknown sigil.');
      room.claims[player.id] = data.sigil;
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
      room.claims = {};
      room.result = null;
      room.trueSigil = null;
      room.challenge = null;
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
      if (playing && room.roles[player.id] === 'Rama') this.resolve(room, null, true);
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
    room.trueSigil = room.config.mode === 'mystery' ? SIGILS[crypto.randomInt(SIGILS.length)].id : null;
    room.challenge = room.config.mode === 'mystery' ? COURT_CHALLENGES[crypto.randomInt(COURT_CHALLENGES.length)] : null;
    room.claims = {};
    room.status = 'discussion';
    room.result = null;
    room.paused = false;
    room.pausedRemaining = 0;
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
      roles: {...room.roles},
      trueSigil: room.trueSigil
    };
    room.deadline = null;
    room.paused = false;
    room.status = 'reveal';
    this.touch(room);
  }
  snapshot(room, player) {
    const isHost = room.hostId === player.id;
    const role = room.status === 'discussion' ? room.roles[player.id] : null;
    const canKnowSigil = role === 'Rama' || role === 'Sita' || role === 'Ravana';
    return {
      type: 'snapshot',
      code: room.code, status: room.status, round: room.round, config: room.config,
      hostId: room.hostId, you: {id: player.id, name: player.name, host: isHost, role, secretSigil: canKnowSigil ? room.trueSigil : null},
      players: room.players.map(p => ({
        id: p.id, name: p.name, score: p.score, connected: p.connected, ready: p.ready,
        claim: room.status === 'discussion' && room.config.mode === 'mystery' ? room.claims[p.id] || null : null
      })),
      ramaId: room.status === 'discussion' ? room.players.find(p => room.roles[p.id] === 'Rama')?.id || null : null,
      paused: room.paused, deadline: room.deadline, pausedRemaining: room.pausedRemaining,
      challenge: room.status === 'discussion' ? room.challenge : null,
      result: ['reveal', 'finished'].includes(room.status) ? room.result : null,
      serverNow: this.now(), sigils: SIGILS
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
module.exports = {Game, SIGILS, ROLES, settings, scoreFor, MIN_PLAYERS, MAX_PLAYERS};
