'use strict';

(function () {
  const view = document.getElementById('view');
  const connection = document.getElementById('connection');
  const toastEl = document.getElementById('toast');
  const STORE = 'ram-sita-session-v1';
  const NAME_STORE = 'ram-sita-display-name';
  const FACES = {
    Rama: ['🏹', 'The seeker. Find Sita among your friends.'],
    Sita: ['🪷', 'Stay hidden. Convince Rama you are someone else.'],
    Ravana: ['👑', 'The trickster. Make Rama choose the wrong player.'],
    Lakshmana: ['🛡️', 'A loyal ally. Your identity is your secret.'],
    Hanuman: ['🐒', 'A fearless helper. Keep your card secret.'],
    Bharata: ['🌿', 'A noble soul. Keep your card secret.'],
    Shatrughna: ['⚔️', 'A steadfast ally. Keep your card secret.'],
    Sugriva: ['🦁', 'A jungle king. Keep your card secret.'],
    Vibhishana: ['✨', 'The wise counselor. Keep your card secret.'],
    Jatayu: ['🦅', 'The great guardian. Keep your card secret.']
  };
  let socket = null;
  let snap = null;
  let saved = load();
  let pending = null;
  let tab = new URLSearchParams(location.search).get('room') ? 'join' : 'create';
  let selected = null;
  let cardOpen = false;
  let lastRoundKey = null;
  let timeOffset = 0;
  let toastTimer = null;
  let reconnectTimer = null;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) { return null; } }
  function persist(value) {
    saved = value;
    if (value) localStorage.setItem(STORE, JSON.stringify(value));
    else localStorage.removeItem(STORE);
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function getName(id) { return snap && snap.players.find(function (p) { return p.id === id; })?.name || 'Unknown player'; }
  function sigil(id) { return snap?.sigils?.find(function (item) { return item.id === id; }); }
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 4000);
  }
  function setConnection(status) {
    connection.className = 'connection ' + status;
    connection.querySelector('span:last-child').textContent = status === 'online' ? 'Connected' : status === 'offline' ? 'Reconnecting' : 'Connecting';
  }
  function send(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) { toast('Connection is not ready. Reconnecting…'); return; }
    socket.send(JSON.stringify(data));
  }
  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(reconnectTimer);
    setConnection('connecting');
    socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    const thisSocket = socket;
    socket.onopen = function () {
      if (socket !== thisSocket) return;
      setConnection('online');
      if (saved) send({type:'resume', code: saved.code, token: saved.token});
      else if (pending) { send(pending); pending = null; }
    };
    socket.onmessage = function (event) {
      if (socket !== thisSocket) return;
      let packet;
      try { packet = JSON.parse(event.data); } catch (_) { return; }
      if (packet.type === 'session') {
        persist({code:packet.code, token:packet.token});
      } else if (packet.type === 'snapshot') {
        const key = packet.code + ':' + packet.round + ':' + packet.status;
        if (packet.status === 'discussion' && key !== lastRoundKey) {
          selected = null;
          cardOpen = false;
        }
        lastRoundKey = key;
        snap = packet;
        timeOffset = packet.serverNow - Date.now();
        if (packet.code && new URLSearchParams(location.search).get('room') !== packet.code) {
          const url = new URL(location.href);
          url.searchParams.set('room', packet.code);
          history.replaceState({}, '', url.pathname + url.search);
        }
        render();
      } else if (packet.type === 'error') {
        if (saved && (/seat was not found|Room not found or expired|Missing session token/i).test(packet.message)) {
          persist(null); snap = null; lastRoundKey = null; render();
        }
        toast(packet.message || 'Something went wrong.');
      } else if (packet.type === 'kicked' || packet.type === 'left') {
        persist(null); snap = null; lastRoundKey = null;
        toast(packet.message || 'You left the room.');
        render();
      }
    };
    socket.onerror = function () {};
    socket.onclose = function () {
      if (socket !== thisSocket) return;
      socket = null;
      setConnection('offline');
      cardOpen = false;
      if (saved) {
        render();
        reconnectTimer = setTimeout(connect, 1600);
      }
    };
  }
  function doEntry(packet) {
    if (saved) return toast('Leave your current game before joining another.');
    pending = packet;
    if (socket?.readyState === WebSocket.OPEN) { send(pending); pending = null; }
    else connect();
  }
  function scoreList(players) {
    const sorted = players.slice().sort(function(a,b) {return b.score-a.score || a.name.localeCompare(b.name);});
    return '<div class="scores">' + sorted.map(function(p, i) {
      const rank = sorted.findIndex(function(x) { return x.score === p.score; }) + 1;
      return '<div class="score-row"><span class="rank">' + rank + '</span><span class="score-name">' + esc(p.name) + (p.id === snap.you.id ? ' <span class="highlight">(you)</span>' : '') + '</span><span class="score-value">' + fmt(p.score) + '</span></div>';
    }).join('') + '</div>';
  }
  function settingsFields(config) {
    return '<div class="field-grid">' +
      '<div class="field"><label for="maxPlayers">Max players</label><select id="maxPlayers" name="maxPlayers">' +
      [3,4,5,6,7,8,9,10].map(function(n){return '<option value="'+n+'"'+(config.maxPlayers === n?' selected':'')+'>'+n+' friends</option>';}).join('') +
      '</select></div>' +
      '<div class="field"><label for="totalRounds">Rounds</label><select id="totalRounds" name="totalRounds">' +
      [3,5,7,10,12,15,20,30].map(function(n){return '<option value="'+n+'"'+(config.totalRounds === n?' selected':'')+'>'+n+' rounds</option>';}).join('') +
      '</select></div>' +
      '<div class="field"><label for="guessSeconds">Guess timer</label><select id="guessSeconds" name="guessSeconds">' +
      [20,30,45,60,75,90].map(function(n){return '<option value="'+n+'"'+(config.guessSeconds === n?' selected':'')+'>'+n+' seconds</option>';}).join('') +
      '</select></div>' +
      '<div class="field"><label for="mode">Game mode</label><select id="mode" name="mode">' +
      '<option value="classic"'+(config.mode === 'classic'?' selected':'')+'>Classic</option>' +
      '<option value="mystery"'+(config.mode === 'mystery'?' selected':'')+'>Court of Whispers</option>' +
      '</select></div></div>';
  }
  function renderHome() {
    const roomFromLink = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    const name = localStorage.getItem(NAME_STORE) || '';
    return '<section class="hero"><div class="hero-text"><div class="eyebrow">The childhood classic, reborn</div>' +
      '<h1>One secret.<br>One guess.<br><span class="highlight">Endless drama.</span></h1>' +
      '<p class="muted">The paper-chit game your whole gang remembers. Sit together, hide your character, bluff like a legend, and find Sita before the timer runs out.</p>' +
      '<div class="hero-actions"><button class="btn primary" data-action="tab-create">Create a room →</button><button class="btn outline" data-action="tab-join">Join friends</button></div>' +
      '<div class="info-line" style="margin-top:20px"><span>✦ 3–10 friends</span><span>✦ One physical room</span><span>✦ No login</span></div></div>' +
      '<div class="art-board" aria-label="Three illustrated playing cards"><div class="art-card"><small>The guardian</small><span class="emblem">🏹</span><small>Rama</small></div>' +
      '<div class="art-card"><small>The mystery</small><span class="emblem">🪷</span><small>Sita</small></div>' +
      '<div class="art-card"><small>The trickster</small><span class="emblem">👑</span><small>Ravana</small></div></div></section>' +
      '<section class="card" id="entry"><div class="section-head"><div><div class="eyebrow">Your adventure starts here</div><h2>'+(tab==='create'?'Gather the court':'Enter the court')+'</h2></div><span class="pill">Play in person</span></div>' +
      '<div class="tabbar"><button type="button" class="'+(tab==='create'?'active':'')+'" data-action="tab-create">Create room</button><button type="button" class="'+(tab==='join'?'active':'')+'" data-action="tab-join">Join room</button></div>' +
      (tab==='create' ?
        '<form id="createForm"><div class="field"><label for="playerName">Your display name</label><input required maxlength="20" id="playerName" name="name" autocomplete="nickname" placeholder="e.g. Rishi" value="'+esc(name)+'"></div>' +
        settingsFields({maxPlayers:6,totalRounds:7,guessSeconds:45,mode:'classic'}) +
        '<div class="mode-note">Classic = pure paper-chit guessing. Court of Whispers = secret sigil, public bluffing, and the same classic point rules.</div>' +
        '<button type="submit" class="btn primary wide">Create my room ✦</button></form>' :
        '<form id="joinForm"><div class="field"><label for="joinName">Your display name</label><input required maxlength="20" id="joinName" name="name" autocomplete="nickname" placeholder="e.g. Rishi" value="'+esc(name)+'"></div>' +
        '<div class="field"><label for="roomCode">Six-character room code</label><input required minlength="6" maxlength="6" id="roomCode" name="code" autocapitalize="characters" spellcheck="false" placeholder="ABC234" value="'+esc(roomFromLink)+'"></div>' +
        '<button type="submit" class="btn primary wide">Enter room →</button></form>') +
      '</section><div class="divider-label">THE RULES OF THE COURT</div><section class="features">' +
      '<div class="mini-feature"><div class="icon">🎭</div><b>Keep your identity secret</b><p>Only you see your character. Everyone else has to read your face.</p></div>' +
      '<div class="mini-feature"><div class="icon">🕵️</div><b>Find the real Sita</b><p>Rama questions the court and chooses one final suspect.</p></div>' +
      '<div class="mini-feature"><div class="icon">🏆</div><b>Rule the scoreboard</b><p>Reveal roles, earn points, and crown a champion.</p></div></section>';
  }
  function renderLobby() {
    const host = snap.you.host;
    const ready = snap.players.every(function(p) { return p.connected && p.ready; });
    return '<div class="section-head"><div><div class="eyebrow">The gathering</div><h2>The royal court</h2><div class="info-line">Invite friends sitting around you. All players need their own phone.</div></div><span class="pill">'+snap.players.length+' / '+snap.config.maxPlayers+' players</span></div>' +
      '<div class="columns"><div>' +
      '<section class="card"><div class="eyebrow">Your private room code</div><div class="code">'+esc(snap.code)+'</div><div class="actions" style="margin-top:8px">' +
      '<button class="btn small primary" data-action="copy-code">Copy code</button><button class="btn small outline" data-action="share">Share invite ↗</button></div>' +
      '<div class="spacer16"></div><h3>Friends in the room</h3><div class="players-grid">' +
      snap.players.map(function(p) {
        return '<div class="player-tile"><div class="avatar">'+esc(p.name.charAt(0).toUpperCase())+'</div><div><b>'+esc(p.name)+(p.id === snap.hostId?' 👑':'')+'</b><small>' +
          (p.connected ? p.ready?'✓ Ready':'Waiting for ready':'Offline — reconnecting')+'</small></div>' +
          (host && p.id !== snap.hostId?'<button class="kick" title="Remove '+esc(p.name)+'" aria-label="Remove '+esc(p.name)+'" data-action="kick" data-id="'+esc(p.id)+'">×</button>':'') +
          '</div>';
      }).join('')+'</div><div class="actions">' +
      (host ? '<button class="btn primary" data-action="start"'+(!ready||snap.players.length<3?' disabled':'')+'>Start game →</button>' :
        '<button class="btn '+(snap.players.find(function(p){return p.id===snap.you.id;})?.ready?'outline':'primary')+'" data-action="ready">' +
        (snap.players.find(function(p){return p.id===snap.you.id;})?.ready?'✓ Ready — tap to undo':'I’m ready!')+'</button>') +
      '<button class="btn ghost" data-action="leave">Leave room</button></div>' +
      '<p class="muted" style="font-size:12px;margin:13px 0 0">'+(host? (snap.players.length<3?'At least 3 players are needed.':ready?'Your court is ready to go.':'Everyone must be online and ready before starting.'):'The host will start the game when everyone is ready.')+'</p></section></div>' +
      '<aside class="card"><div class="eyebrow">Game setup</div>' +
      (host ? '<form id="configForm">'+settingsFields(snap.config)+'<button class="btn outline wide" type="submit">Save settings</button></form>' :
        '<p><b>'+esc(snap.config.mode==='classic'?'Classic':'Court of Whispers')+'</b></p><p class="muted">'+snap.config.totalRounds+' rounds · '+snap.config.guessSeconds+' seconds per round</p><p class="muted" style="font-size:12px">The host decides all settings.</p>') +
      '<div class="mode-note" style="margin-top:19px">Keep your screens private. Talk to your friends, not the app. In Mystery Mode, your sigil claims are public — your actual role never is.</div></aside></div>';
  }
  function roleMarkup() {
    const role = snap.you.role;
    if (!role) return '<p class="muted">Preparing your role…</p>';
    const info = FACES[role] || ['🃏','Keep your identity hidden.'];
    if (!cardOpen) return '<div class="role-card sealed"><div class="card-caption">Your sealed character</div><span class="glyph">🂠</span><div class="role-title">Secret Role</div><p>Make sure only you can see your phone.</p><div class="spacer16"></div><button class="btn primary" data-action="flip">Reveal my card</button></div>';
    return '<div class="role-card"><div class="card-caption">For your eyes only</div><span class="glyph">'+info[0]+'</span><div class="role-title">'+esc(role)+'</div><p>'+esc(info[1])+'</p><div class="spacer16"></div><button class="btn small outline" data-action="flip">Hide card</button></div>';
  }
  function mysteryArea() {
    if (snap.config.mode !== 'mystery') return '';
    const role = snap.you.role;
    const actual = sigil(snap.you.secretSigil);
    const intro = actual ? '<div class="clue-box"><strong>Your private royal sigil: '+actual.symbol+' '+esc(actual.name)+'</strong><p>Only Rama, Sita and Ravana know the actual symbol. Nobody can tell whether you are telling the truth. Do not show this screen!</p></div>' :
      '<div class="clue-box"><strong>🕵️ No sigil revealed to you</strong><p>You can make up any claim. Try to bluff Rama and protect your identity.</p></div>';
    if (role === 'Rama') return intro+'<p class="muted" style="font-size:12px;margin-top:10px">Watch the public claims below. Sita and Ravana both know the true sigil, so a matching claim is not proof.</p>';
    const myClaim = snap.players.find(function(p){return p.id===snap.you.id;})?.claim;
    return intro + '<h3 style="margin-top:20px">Your public sigil claim</h3><p class="muted" style="font-size:12px">Pick one symbol. You may change it until Rama locks a guess.</p><div class="sigils">' +
      snap.sigils.map(function(item) {
        return '<button class="sigil-choice '+(myClaim===item.id?'chosen':'')+'" data-action="claim" data-sigil="'+esc(item.id)+'"'+(snap.paused?' disabled':'')+'><span class="sigil-emoji">'+item.symbol+'</span><span class="sigil-label">'+esc(item.name)+'</span></button>';
      }).join('')+'</div>';
  }
  function ramaControls() {
    if (snap.you.role !== 'Rama') {
      return '<div class="mode-note">🎭 Talk face-to-face. Convince Rama you are not Sita. Bluffing is completely allowed.</div>';
    }
    const candidates = snap.players.filter(function(p) { return p.id !== snap.you.id; });
    return '<h3>Who is really Sita?</h3><p class="muted" style="font-size:12px">Question your friends aloud, then select one final suspect. You only get one guess.</p>' +
      '<div class="candidates">' + candidates.map(function(p) {
        const claim = sigil(p.claim);
        return '<button class="candidate '+(selected===p.id?'selected':'')+'" data-action="select" data-id="'+esc(p.id)+'"'+(snap.paused?' disabled':'')+'>' +
          '<span class="avatar">'+esc(p.name.charAt(0).toUpperCase())+'</span><span>'+esc(p.name)+'</span>' +
          (snap.config.mode==='mystery'?'<span class="sigil-claim" title="Public claim">'+(claim?claim.symbol:'❔')+'</span>':'') +
          '</button>';
      }).join('')+'</div><button class="btn primary wide" data-action="guess"'+(!selected||snap.paused?' disabled':'')+'>Lock my final guess →</button>' +
      '<p class="muted center" style="font-size:11px;margin-top:9px">Once you lock it, there is no going back.</p>';
  }
  function renderDiscussion() {
    const rama = getName(snap.ramaId);
    return '<div class="round-banner"><div><div class="eyebrow">Round '+snap.round+' of '+snap.config.totalRounds+' · '+(snap.config.mode==='classic'?'Classic':'Court of Whispers')+'</div><h2>The search for Sita</h2></div>' +
      '<div class="timer-wrap"><span class="muted">Time left</span><span id="timer" class="timer">--</span></div></div>' +
      '<div class="track"><div id="timer-fill" class="track-fill"></div></div>' +
      (snap.paused?'<div class="alert-note">⏸ The host has paused the round. Discussion and guessing are temporarily frozen.</div>':'') +
      '<div class="columns"><div class="card"><div class="space-between"><span class="pill">🏹 Rama: '+esc(rama)+'</span><span class="muted" style="font-size:12px">One guess only</span></div>' +
      '<div class="role-stage">'+roleMarkup()+'</div>' +
      (snap.config.mode==='mystery'?mysteryArea():'') +
      '<div class="spacer16"></div>'+ramaControls()+'</div>' +
      '<aside class="card"><div class="space-between"><h3>Live standings</h3><span class="muted" style="font-size:11px">Round '+snap.round+'</span></div>'+scoreList(snap.players) +
      '<div class="spacer16"></div><p class="muted" style="font-size:12px">Everyone else can see Rama’s identity, but only you can see your own secret role.</p>' +
      (snap.you.host?'<button class="btn outline wide" data-action="pause">'+(snap.paused?'▶ Resume timer':'⏸ Pause game')+'</button>':'') +
      '</aside></div>';
  }
  function renderReveal() {
    const result = snap.result;
    if (!result) return '<p>Loading round results…</p>';
    const outcome = result.timedOut ? 'Time ran out!' : result.correct ? 'Rama found Sita!' : 'Sita escaped!';
    const explanation = result.timedOut ? 'Nobody was selected in time.' : 'Rama guessed '+getName(result.guessedId)+'. Sita was '+getName(result.sitaId)+'.';
    return '<div class="reveal-title"><div class="eyebrow">Round '+snap.round+' complete</div><span class="big-icon">'+(result.correct?'🏹':result.timedOut?'⌛':'🪷')+'</span>' +
      '<h1 style="font-size:clamp(34px,6vw,58px)">'+outcome+'</h1><p class="muted">'+esc(explanation)+'</p></div>' +
      '<div class="columns"><section class="card"><h3>Everyone’s secret identity</h3><div class="reveal-grid">' +
      snap.players.map(function(p) {
        const role = result.roles[p.id];
        return '<div class="reveal-person"><span class="face">'+(FACES[role]?.[0]||'🃏')+'</span><div><div class="name">'+esc(p.name)+(p.id===snap.you.id?' (you)':'')+'</div>' +
          '<div class="role">'+esc(role)+'</div><div class="points">+'+fmt(result.deltas[p.id])+' points</div></div></div>';
      }).join('')+'</div>' +
      (snap.config.mode==='mystery'?'<div class="clue-box">Real royal sigil: <strong>'+(sigil(result.trueSigil)?.symbol||'')+' '+esc(sigil(result.trueSigil)?.name||'')+'</strong></div>':'') +
      '<div class="actions">' + (snap.you.host?'<button class="btn primary" data-action="next">'+(snap.round===snap.config.totalRounds?'See the champions 🏆':'Next round →')+'</button>':'<p class="muted">The host will begin the next round.</p>') + '</div></section>' +
      '<aside class="card"><h3>Current standings</h3>'+scoreList(snap.players)+'</aside></div>';
  }
  function renderFinished() {
    const sorted = snap.players.slice().sort(function(a,b){return b.score-a.score;});
    const top = sorted[0];
    const tied = sorted.filter(function(p){return p.score===top.score;});
    return '<div class="champion"><span class="crown">🏆</span><div class="eyebrow">The royal court has spoken</div><h2>'+(tied.length>1?'It’s a royal tie!':esc(top.name)+' wins!')+'</h2>' +
      '<p>'+(tied.length>1?esc(tied.map(function(p){return p.name;}).join(' & '))+' share the crown.':'The champion of the court has been crowned.')+'</p></div>' +
      '<div class="card" style="max-width:660px;margin:0 auto"><div class="space-between"><h3>Final leaderboard</h3><span class="pill">'+snap.config.totalRounds+' rounds</span></div>' +
      scoreList(snap.players)+'<div class="actions">'+(snap.you.host?'<button class="btn primary" data-action="rematch">Play another match ↻</button>':'<p class="muted">Ask the host for a rematch.</p>') +
      '</div><div class="mode-note" style="margin-top:20px">Same friends. New secrets. A new round of chaos.</div></div>';
  }
  function render() {
    if (!snap) {
      view.innerHTML = saved ?
        '<div class="card center" style="max-width:520px;margin:45px auto"><h2>Returning to the court…</h2><p class="muted">Restoring your secret character and seat.</p><button class="btn ghost" data-action="forget">Forget this room</button></div>' :
        renderHome();
    } else if (snap.status==='lobby') view.innerHTML = renderLobby();
    else if (snap.status==='discussion') view.innerHTML = renderDiscussion();
    else if (snap.status==='reveal') view.innerHTML = renderReveal();
    else if (snap.status==='finished') view.innerHTML = renderFinished();
    updateClock();
  }
  function updateClock() {
    const el = document.getElementById('timer');
    const fill = document.getElementById('timer-fill');
    if (!el || !snap || snap.status !== 'discussion') return;
    let remaining;
    if (snap.paused) remaining = Math.ceil(snap.pausedRemaining/1000);
    else remaining = Math.max(0, Math.ceil((snap.deadline - Date.now() - timeOffset)/1000));
    el.textContent = snap.paused ? 'PAUSE' : remaining + 's';
    el.classList.toggle('urgent', !snap.paused && remaining <= 10);
    if (fill) fill.style.width = (100 * Math.min(1,remaining/snap.config.guessSeconds)) + '%';
  }
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) { cardOpen = false; if(snap?.status==='discussion') render(); }
  });
  document.addEventListener('click', function (event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = el.dataset.action;
    if (action==='tab-create' || action==='tab-join') {
      tab = action==='tab-create'?'create':'join';
      render();
      document.getElementById('entry')?.scrollIntoView({behavior:'smooth', block:'nearest'});
    } else if (action==='flip') { cardOpen = !cardOpen; render(); }
    else if (action==='select') { selected = el.dataset.id; render(); }
    else if (action==='guess') {
      if (selected && confirm('Lock your final guess as '+getName(selected)+'? This cannot be undone.')) send({type:'guess', id:selected});
    } else if (action==='ready') {
      const me = snap?.players.find(function(p){return p.id===snap.you.id;});
      send({type:'ready', ready:!me?.ready});
    } else if (action==='claim') send({type:'claim', sigil:el.dataset.sigil});
    else if (action==='start' || action==='next' || action==='rematch' || action==='pause') send({type:action});
    else if (action==='kick') {
      if (confirm('Remove '+getName(el.dataset.id)+' from the lobby?')) send({type:'kick', id:el.dataset.id});
    } else if (action==='leave') {
      if (confirm('Leave this lobby?')) send({type:'leave'});
    } else if (action==='forget') {
      persist(null); snap = null; lastRoundKey = null;
      if(socket) { socket.close(); socket = null; }
      render();
    } else if (action==='copy-code' || action==='share') {
      const copy = action==='copy-code' ? snap.code : new URL('?room='+encodeURIComponent(snap.code),location.href).href;
      if (action==='share' && navigator.share) {
        navigator.share({title:'Join my Ram–Sita room',text:'Come join my game: '+snap.code,url:copy}).catch(function(){});
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(copy).then(function(){toast(action==='copy-code'?'Room code copied!':'Invite link copied!');})
          .catch(function(){toast('Copy this: '+copy);});
      } else toast('Copy this: '+copy);
    }
  });
  document.addEventListener('submit', function (event) {
    if (!['createForm','joinForm','configForm'].includes(event.target.id)) return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.id==='createForm' || form.id==='joinForm') {
      localStorage.setItem(NAME_STORE, data.name.trim());
      if (form.id==='createForm') doEntry({type:'create', name:data.name,config:{
        maxPlayers:Number(data.maxPlayers),totalRounds:Number(data.totalRounds),
        guessSeconds:Number(data.guessSeconds),mode:data.mode
      }});
      else doEntry({type:'join', name:data.name,code:data.code.trim().toUpperCase()});
    } else {
      send({type:'config',maxPlayers:Number(data.maxPlayers),totalRounds:Number(data.totalRounds),
        guessSeconds:Number(data.guessSeconds),mode:data.mode});
    }
  });
  setInterval(updateClock, 200);
  render();
  if (saved) connect();
})();
