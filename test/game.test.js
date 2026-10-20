'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {Game, ROLES, scoreFor} = require('../src/game');

function lobby({mode='classic', totalRounds=7, maxPlayers=6} = {}) {
  let now = 100000;
  const game = new Game(() => now);
  const {room, player: host} = game.create('Host', {mode, totalRounds, maxPlayers, guessSeconds:30});
  const b = game.join(room.code,'Friend B').player;
  const c = game.join(room.code,'Friend C').player;
  for (const p of [host,b,c]) p.connected = true;
  game.act(room,b,'ready',{ready:true});
  game.act(room,c,'ready',{ready:true});
  return {game,room,host,b,c,forward:ms => {now+=ms;}};
}
test('game creates six-character unique-looking codes and rejects invalid settings',()=>{
  const game = new Game();
  const {room} = game.create('Host',{maxPlayers:3,totalRounds:7,guessSeconds:45,mode:'classic'});
  assert.match(room.code,/^[A-HJ-NP-Z2-9]{6}$/);
  assert.throws(()=>game.create('Host',{maxPlayers:2}),/Players/);
  assert.throws(()=>game.create('Host',{totalRounds:99}),/Rounds/);
  assert.throws(()=>game.create('<script>',{}),/Names/);
  assert.throws(()=>game.create('Host',{mode:'mystery'}),/Only Classic/);
});
test('lobbies reject duplicate names, capacity overflow and nonhost starts',()=>{
  const {game,room,host,b,c} = lobby({maxPlayers:4});
  assert.throws(()=>game.join(room.code,'FRIEND B'),/already/);
  const extra=game.join(room.code,'Another').player;
  assert.throws(()=>game.join(room.code,'Too many'),/full/);
  extra.connected=true;
  game.act(room,extra,'ready',{ready:true});
  assert.throws(()=>game.act(room,b,'start'),/Only the host/);
  game.act(room,c,'ready',{ready:false});
  assert.throws(()=>game.act(room,host,'start'),/ready/);
  game.act(room,c,'ready',{ready:true});
  game.act(room,host,'start');
  assert.equal(room.status,'discussion');
  assert.equal(room.round,1);
});
test('classic roles are exclusive and snapshots never leak another identity',()=>{
  const {game,room,host,b,c} = lobby();
  game.act(room,host,'start');
  assert.equal(room.config.mode,'classic');
  assert.deepEqual(Object.values(room.roles).sort(),ROLES.slice(0,3).sort());
  for (const p of [host,b,c]) {
    const state = game.snapshot(room,p);
    assert.equal(state.you.role,room.roles[p.id]);
    assert.equal(state.result,null);
    assert.ok(!JSON.stringify(state).includes(b.token));
    assert.ok(!JSON.stringify(state).includes(c.token));
    assert.ok(!JSON.stringify(state).includes(host.token));
    assert.equal(Object.hasOwn(state.you,'secretSigil'),false);
    for (const other of state.players) {
      assert.equal(Object.hasOwn(other,'role'),false);
      assert.equal(Object.hasOwn(other,'token'),false);
    }
  }
});
test('the public release has no symbols, mystery mode or sigil actions',()=>{
  const {game,room,host} = lobby({maxPlayers:5});
  for (const name of ['Fourth','Fifth']) {
    const p=game.join(room.code,name).player;
    p.connected=true;
    game.act(room,p,'ready',{ready:true});
  }
  game.act(room,host,'start');
  assert.equal(Object.hasOwn(room,'trueSigil'),false);
  assert.equal(Object.hasOwn(room,'challenge'),false);
  for (const p of room.players) {
    const state=game.snapshot(room,p);
    assert.equal(Object.hasOwn(state.you,'secretSigil'),false);
    assert.ok(state.players.every(x=>!Object.hasOwn(x,'claim')));
    assert.throws(()=>game.act(room,p,'claim',{sigil:'moon'}),/Unknown action/);
  }
});
test('only Rama guesses and the server awards fixed role scores',()=>{
  const {game,room,host,b,c}=lobby();
  game.act(room,host,'start');
  const players=[host,b,c];
  const rama=players.find(p=>room.roles[p.id]==='Rama');
  const sita=players.find(p=>room.roles[p.id]==='Sita');
  const ravana=players.find(p=>room.roles[p.id]==='Ravana');
  assert.throws(()=>game.act(room,sita,'guess',{id:ravana.id}),/Only Rama/);
  game.act(room,rama,'guess',{id:sita.id});
  assert.equal(room.status,'reveal');
  assert.equal(room.result.correct,true);
  assert.deepEqual([rama.score,sita.score,ravana.score],[1000,200,100]);
  assert.throws(()=>game.act(room,rama,'guess',{id:sita.id}),/No active/);
  assert.equal(scoreFor('Hanuman',true),200);
});
test('host can pause timer and expiry is server-authoritative',()=>{
  const {game,room,host,forward}=lobby();
  game.act(room,host,'start');
  forward(10000);
  game.act(room,host,'pause');
  assert.equal(room.pausedRemaining,20000);
  forward(100000);
  assert.deepEqual(game.tick(),[]);
  assert.equal(room.status,'discussion');
  game.act(room,host,'pause');
  forward(20001);
  assert.equal(game.tick()[0],room);
  assert.equal(room.status,'reveal');
  assert.equal(room.result.timedOut,true);
});
test('Rama rotates before repeating, host advances and rematch clears scores',()=>{
  const {game,room,host}=lobby({totalRounds:3});
  game.act(room,host,'start');
  const ramaHistory=[];
  for(let n=0;n<3;n++){
    ramaHistory.push(Object.keys(room.roles).find(id=>room.roles[id]==='Rama'));
    const rama=room.players.find(p=>room.roles[p.id]==='Rama');
    const sita=room.players.find(p=>room.roles[p.id]==='Sita');
    game.act(room,rama,'guess',{id:sita.id});
    game.act(room,host,'next');
  }
  assert.equal(new Set(ramaHistory).size,3);
  assert.equal(room.status,'finished');
  game.act(room,host,'rematch');
  assert.equal(room.status,'lobby');
  assert.equal(room.round,0);
  assert.ok(room.players.every(p=>p.score===0 && p.ramaCount===0));
});
test('host transfer, reconnection and room expiry do not grant unauthorized access',()=>{
  const {game,room,host,b,forward}=lobby();
  assert.throws(()=>game.resume(room.code,'wrong'),/not found/);
  assert.equal(game.resume(room.code,b.token).player,b);
  host.connected=false;
  host.disconnectedAt=100000;
  forward(46000);
  assert.ok(game.tick().includes(room));
  assert.equal(room.hostId,b.id);
  forward(4*3600000+1);
  game.tick();
  assert.equal(game.rooms.has(room.code),false);
});

test('leaving during an active match cannot erase the Sita seat or corrupt points',()=>{
  const {game,room,host,b,c}=lobby();
  game.act(room,host,'start');
  const before=room.players.length;
  assert.throws(()=>game.act(room,b,'leave'),/cannot abandon/);
  assert.equal(room.players.length,before);
  assert.equal(room.status,'discussion');
  assert.ok(room.players.some(p=>room.roles[p.id]==='Sita'));
});

test('ten-player court completes thirty rounds with balanced Rama assignments',()=>{
  const game=new Game();
  const {room,player:host}=game.create('Host',{maxPlayers:10,totalRounds:30,guessSeconds:20,mode:'classic'});
  host.connected=true;
  for(let i=1;i<10;i++){
    const p=game.join(room.code,'Player '+i).player;
    p.connected=true;
    game.act(room,p,'ready',{ready:true});
  }
  assert.equal(room.players.length,10);
  assert.throws(()=>game.join(room.code,'Eleventh'),/full/);
  game.act(room,host,'start');
  for(let i=1;i<=30;i++){
    assert.equal(room.round,i);
    assert.deepEqual(Object.values(room.roles).sort(),ROLES.slice().sort());
    const rama=room.players.find(p=>room.roles[p.id]==='Rama');
    const sita=room.players.find(p=>room.roles[p.id]==='Sita');
    game.act(room,rama,'guess',{id:sita.id});
    game.act(room,host,'next');
  }
  assert.equal(room.status,'finished');
  assert.ok(room.players.every(p=>p.ramaCount===3));
  assert.ok(room.players.every(p=>Number.isInteger(p.score) && p.score>=0));
});
