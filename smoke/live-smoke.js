'use strict';
// Isolated live smoke: creates one disposable room; never touches other players' rooms.
const assert=require('node:assert/strict');
const WebSocket=require('ws');
const base='https://ram-sita-classic.onrender.com';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitForHealth(){
  let last;
  for(let i=0;i<12;i++){
    try {
      const response=await fetch(base+'/health',{signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      assert.equal(data.app,'ram-sita');
      assert.equal(data.status,'ok');
      return;
    }catch(error){last=error;await sleep(6000);}
  }
  throw Error('Public health check did not succeed: '+last.message);
}
function packet(ws,predicate,timeout=18000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{clean();reject(Error('Timed out waiting for public WebSocket packet'));},timeout);
    function clean(){clearTimeout(timer);ws.off('message',onMessage);ws.off('close',onClose);ws.off('error',onError);}
    function onClose(){clean();reject(Error('Socket closed before expected packet'));}
    function onError(err){clean();reject(err);}
    function onMessage(raw){
      const msg=JSON.parse(raw.toString());
      if(msg.type==='error'){clean();reject(Error('Public WebSocket rejected action: '+msg.message));return;}
      if(predicate(msg)){clean();resolve(msg);}
    }
    ws.on('message',onMessage);ws.on('close',onClose);ws.on('error',onError);
  });
}
function openSocket(){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(base.replace(/^https/,'wss')+'/ws',{headers:{Origin:base},handshakeTimeout:25000});
    const timeout=setTimeout(()=>{ws.terminate();reject(Error('WebSocket open timed out'));},30000);
    ws.once('open',()=>{clearTimeout(timeout);resolve(ws);});
    ws.once('error',err=>{clearTimeout(timeout);reject(err);});
  });
}
(async()=>{
  const clients=[];
  try{
    await waitForHealth();
    const host=await openSocket();clients.push(host);
    let pending=packet(host,m=>m.type==='session');
    host.send(JSON.stringify({type:'create',name:'Smoke Host',config:{maxPlayers:3,totalRounds:3,guessSeconds:30,mode:'classic'}}));
    const session=await pending;
    assert.match(session.code,/^[A-HJ-NP-Z2-9]{6}$/);
    for(const name of ['Smoke Guest A','Smoke Guest B']){
      const ws=await openSocket();clients.push(ws);
      pending=packet(ws,m=>m.type==='session');
      ws.send(JSON.stringify({type:'join',name,code:session.code}));
      await pending;
    }
    pending=packet(host,m=>m.type==='snapshot'&&m.status==='lobby'&&m.players.every(p=>p.ready));
    clients[1].send(JSON.stringify({type:'ready',ready:true}));
    clients[2].send(JSON.stringify({type:'ready',ready:true}));
    await pending;
    let snapshots=clients.map(ws=>packet(ws,m=>m.type==='snapshot'&&m.status==='dealing'));
    host.send(JSON.stringify({type:'start'}));
    const dealt=await Promise.all(snapshots);
    assert.ok(dealt.every(m=>m.deadline===null));
    assert.deepEqual(dealt.map(m=>m.you.role).sort(),['Rama','Sita','Ravana'].sort());
    assert.ok(dealt.every(m=>m.players.every(p=>!('role' in p))));
    snapshots=clients.map(ws=>packet(ws,m=>m.type==='snapshot'&&m.status==='discussion'));
    clients.forEach(ws=>ws.send(JSON.stringify({type:'role_ready',ready:true})));
    const playing=await Promise.all(snapshots);
    assert.ok(playing.every(m=>m.deadline>m.serverNow));
    const ramaIndex=playing.findIndex(m=>m.you.role==='Rama');
    const sita=playing.find(m=>m.you.role==='Sita');
    pending=packet(host,m=>m.type==='snapshot'&&m.status==='reveal');
    clients[ramaIndex].send(JSON.stringify({type:'guess',id:sita.you.id}));
    const final=await pending;
    assert.equal(final.result.correct,true);
    assert.equal(final.players.reduce((sum,p)=>sum+p.score,0),1300);
    process.stdout.write('PASS public HTTP health and 3-client Classic WebSocket round with ready stage and scoring\n');
  }finally{
    for(const ws of clients){try{ws.terminate();}catch{}}
  }
})().catch(error=>{process.stderr.write('Public smoke failed: '+error.message+'\n');process.exitCode=1;});
