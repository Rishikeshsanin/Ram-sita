'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const WebSocket = require('ws');
const {startServer} = require('../src/server');

function packet(ws,predicate,timeoutMs=5000) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{clear();reject(new Error('Timed out waiting for packet'));},timeoutMs);
    function clear(){clearTimeout(timer);ws.off('message',onMessage);ws.off('close',onClose);}
    function onClose(){clear();reject(new Error('Socket closed while waiting for packet'));}
    function onMessage(raw){
      const msg=JSON.parse(raw.toString());
      if(predicate(msg)){clear();resolve(msg);}
    }
    ws.on('message',onMessage);
    ws.on('close',onClose);
  });
}
async function socketAt(port) {
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws',{headers:{Origin:'http://127.0.0.1:'+port}});
  await once(ws,'open');
  return ws;
}
test('three real WebSocket clients complete a classic match with private role snapshots',async()=>{
  const app=startServer(0);
  const clients=[];
  try {
    await once(app.server,'listening');
    const port=app.server.address().port;
    const health=await fetch('http://127.0.0.1:'+port+'/health');
    assert.equal(health.status,200);
    assert.equal((await health.json()).app,'ram-sita');
    assert.equal((await fetch('http://127.0.0.1:'+port+'/../../etc/passwd')).status,404);
    const host=await socketAt(port);clients.push(host);
    const hostSession=packet(host,p=>p.type==='session');
    host.send(JSON.stringify({type:'create',name:'Host',config:{maxPlayers:3,totalRounds:3,guessSeconds:30,mode:'classic'}}));
    const {code,token}=await hostSession;
    assert.equal(typeof token,'string');
    assert.equal(code.length,6);
    const b=await socketAt(port);clients.push(b);
    const joinB=packet(b,p=>p.type==='session');
    b.send(JSON.stringify({type:'join',code,name:'B'}));
    await joinB;
    const c=await socketAt(port);clients.push(c);
    const joinC=packet(c,p=>p.type==='session');
    c.send(JSON.stringify({type:'join',code,name:'C'}));
    await joinC;
    const allReady=packet(host,p=>p.type==='snapshot' && p.players.length===3 && p.players.every(x=>x.ready));
    b.send(JSON.stringify({type:'ready',ready:true}));
    c.send(JSON.stringify({type:'ready',ready:true}));
    await allReady;
    const dealWait=clients.map(ws=>packet(ws,p=>p.type==='snapshot' && p.status==='dealing'));
    host.send(JSON.stringify({type:'start'}));
    const dealt=await Promise.all(dealWait);
    assert.ok(dealt.every(s=>s.deadline===null));
    assert.ok(dealt.every(s=>s.you.role && !s.players.some(p=>'role' in p)));
    const statesWait=clients.map(ws=>packet(ws,p=>p.type==='snapshot' && p.status==='discussion'));
    clients.forEach(ws=>ws.send(JSON.stringify({type:'role_ready',ready:true})));
    const states=await Promise.all(statesWait);
    const roles=states.map(s=>s.you.role);
    assert.deepEqual(roles.slice().sort(),['Rama','Ravana','Sita'].sort());
    for(const s of states){
      assert.ok(!JSON.stringify(s).includes(token));
      assert.ok(s.players.every(p=>!('role' in p)));
      assert.equal(Object.hasOwn(s.you,'secretSigil'),false);
    }
    const ramaIdx=states.findIndex(s=>s.you.role==='Rama');
    const sita=states.find(s=>s.you.role==='Sita');
    const reveal=packet(host,p=>p.type==='snapshot' && p.status==='reveal');
    clients[ramaIdx].send(JSON.stringify({type:'guess',id:sita.you.id}));
    const result=await reveal;
    assert.equal(result.result.correct,true);
    assert.equal(result.result.roles[sita.you.id],'Sita');
    assert.equal(result.players.reduce((sum,p)=>sum+p.score,0),1300);
  } finally {
    for(const ws of clients) ws.terminate();
    await app.close();
  }
});
