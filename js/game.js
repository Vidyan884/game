// Game utama: best-of-3 + side switch + timing/drop + practice + leaderboard
window.Game = (function () {
  var C = window.CONFIG;
  var canvas, ctx;
  var players = [], shuttle = null;
  var mode = 'single', difficulty = 'normal', bestOf = 3;
  var score = [0, 0], gamesWon = [0, 0], gameNo = 1;
  var phase = 'idle'; // idle|serve|rally|point|over|gamebreak
  var server = null, servingTeam = 0;
  var pointTimer = 0, serveHoldT = 0, breakTimer = 0;
  var particles = [];
  var matchActive = false, paused = false;
  var lastHitTeam = -1, lastHitter = null;
  var humans = [];
  var lastTime = 0, elapsed = 0;
  var optsCache = null;
  var shake = 0, rallyHits = 0, bestRally = 0, smashCount = 0, perfectCount = 0;
  // efek keren
  var rings = [], confetti = [], netWobble = 0, slowMo = 0, ledX = 0, countT = 0;
  // practice
  var pHits = 0, pMiss = 0, feedTimer = 0;
  // online P2P (host autoritatif)
  var netRole = null; // null | 'host' | 'guest'
  var remoteInp = { l: false, r: false, jump: 0, hit: 0, smash: 0, drop: 0, serve: 0 };
  var lastSnap = null, snapSendT = 0, guestSendT = 0, pingMs = -1;
  var lastTeams = null;

  function is2P() { return mode === 'single2p' || mode === 'double2p'; }
  function isOnline() { return mode === 'online'; }
  function isPractice() { return mode === 'practice'; }
  function allowArrowsForP1() { return !is2P() && !isPractice() && !(isOnline() && netRole === 'guest'); }
  function needGames() { return bestOf === 3 ? 2 : 1; }
  function dirOf(p) { return p.side === 'L' ? 1 : -1; }
  function teamOnSide(side) {
    for (var i = 0; i < players.length; i++) if (players[i].side === side) return players[i].team;
    return side === 'L' ? 0 : 1;
  }

  function msg(text, ms) {
    var el = document.getElementById('overlay-msg');
    el.textContent = text; el.classList.remove('hidden');
    if (msg._t) clearTimeout(msg._t);
    if (ms) msg._t = setTimeout(function () { el.classList.add('hidden'); }, ms);
  }
  function hideMsg() { document.getElementById('overlay-msg').classList.add('hidden'); }
  function updateScoreboard() {
    document.getElementById('sb-score-a').textContent = isPractice() ? pHits : score[0];
    document.getElementById('sb-score-b').textContent = isPractice() ? pMiss : score[1];
    document.getElementById('serve-a').classList.toggle('on', !isPractice() && servingTeam === 0 && phase !== 'over');
    document.getElementById('serve-b').classList.toggle('on', !isPractice() && servingTeam === 1 && phase !== 'over');
    var mid = document.getElementById('sb-mode');
    if (mid) {
      if (isPractice()) mid.textContent = 'PRACTICE • Best ' + window.Store.practiceBest();
      else if (isOnline()) mid.textContent = 'ONLINE • G' + gameNo + ' (' + gamesWon[0] + '-' + gamesWon[1] + ')';
      else if (bestOf === 3) mid.textContent = modeLabel() + ' • G' + gameNo + ' (' + gamesWon[0] + '-' + gamesWon[1] + ')';
      else mid.textContent = modeLabel();
    }
    var sdiff = document.getElementById('sb-diff');
    if (sdiff && isOnline()) sdiff.textContent = netRole === 'host' ? 'HOST' : (pingMs >= 0 ? pingMs + 'ms' : 'P2');
    var kb = document.querySelector('.kb-hint');
    if (kb) {
      kb.textContent = isPractice()
        ? 'F/J hit • G/K smash • S/↓ drop • R reset • P pause'
        : is2P()
        ? 'P1: A/D+W+F+G+T+S drop | P2: ←/→+↑+J+K+L+↓ drop'
        : 'J/F hit • K/G smash • S/↓ drop • T/L serve • P pause';
    }
  }
  function modeLabel() {
    return { single: 'SINGLE', single2p: '1v1 LOKAL', double: 'DOUBLE', double2p: '2v2 LOKAL', practice: 'PRACTICE', online: 'ONLINE 1v1' }[mode] || mode.toUpperCase();
  }
  function makeShuttle(x, y) { return { x: x, y: y, vx: 0, vy: 0, spin: 0, smash: false }; }

  function setupServe() {
    var teamPlayers = players.filter(function (p) { return p.team === servingTeam; });
    server = teamPlayers[0] || players[0];
    players.forEach(function (p) {
      p.x = p.homeX; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true;
      p.setState('idle'); p.hitCd = 0;
      if (p.ai) { p.ai.serveTimer = 0.8 + Math.random() * 0.8; p.ai.targetX = p.homeX; p.ai.think = 0.3; p.ai.hitCooldown = 0; }
    });
    var r = server.racketPos();
    shuttle = makeShuttle(r.x, r.y - 10);
    phase = 'serve'; serveHoldT = 0; rallyHits = 0;
    lastHitTeam = -1; lastHitter = null;
    updateScoreboard();
    var el = document.getElementById('overlay-msg');
    if (server.control === 'human') {
      el.textContent = server.humanIdx === 2 ? 'P2 Serve! (L)' : (is2P() ? 'P1 Serve! (T)' : 'Tekan SERVE (L/T)!');
    } else el.textContent = server.name + ' servis...';
    el.classList.remove('hidden');
    if (server.control !== 'human') setTimeout(function () { if (phase === 'serve') hideMsg(); }, 900);
  }

  function tryServe(p) {
    if (phase !== 'serve' || p !== server || p.hitCd > 0) return false;
    hideMsg();
    p.setState('serve', 0.35); p.hitCd = 0.5;
    window.AudioSys.serve();
    var dir = dirOf(p);
    shuttle.x = p.racketPos().x; shuttle.y = p.racketPos().y - 8;
    shuttle.vx = dir * (400 + Math.random() * 60) * p.powerMul;
    shuttle.vy = -640 * (0.9 + p.powerMul * 0.2);
    shuttle.smash = false;
    lastHitTeam = p.team; lastHitter = p;
    phase = 'rally'; rallyHits = 1;
    burst(shuttle.x, shuttle.y, 6, '#ffffff');
    p.addEnergy(8);
    return true;
  }

  function timingQuality(p) {
    // sweet-spot: jarak raket vs Zone ideal
    var r = p.racketPos();
    var d = Math.sqrt(Math.pow(shuttle.x - r.x, 2) + Math.pow(shuttle.y - r.y, 2));
    var idealY = shuttle.y > 170 && shuttle.y < 360;
    if (d < 42 && idealY) return 'perfect';
    if (d < 72) return 'good';
    return 'late';
  }

  function hitShuttle(p, type) {
    if (phase !== 'rally' || !p.canHit(shuttle)) return false;
    var dir = dirOf(p);
    var q = timingQuality(p);
    var qMult = q === 'perfect' ? 1.18 : q === 'good' ? 1.0 : 0.78;
    p.hitCd = 0.32;
    rallyHits++;
    if (q === 'perfect') { perfectCount++; p.addEnergy(10); window.AudioSys.perfect(); }
    if (type === 'smash') {
      var charged = p.energy >= 25;
      p.addEnergy(charged ? -25 : -10);
      p.setState('smash', 0.32);
      window.AudioSys.smash();
      var mult = (charged ? 1 : 0.72) * p.powerMul * qMult;
      shuttle.vx = dir * (700 + Math.random() * 140) * mult;
      shuttle.vy = 180 + Math.random() * 160 - (shuttle.y < 260 ? 120 : 0);
      // late smash rawan nyangkut net/out
      if (q === 'late') { shuttle.vx *= 0.9; shuttle.vy += 120; }
      shuttle.smash = true;
      burst(shuttle.x, shuttle.y, (charged ? 16 : 8) + (q === 'perfect' ? 8 : 0), q === 'perfect' ? '#00e5ff' : charged ? '#ffeb3b' : '#b0bec5');
      rings.push({ x: shuttle.x, y: shuttle.y, r: 8, life: 0.35, max: 0.35 });
      msg(q === 'perfect' ? 'PERFECT SMASH!' : charged ? 'SMASH!' : 'SMASH (lemah)', 500);
      shake = charged ? 9 : 4;
      if (charged && q === 'perfect') slowMo = 0.35; // slow-mo keren
      smashCount++;
      p.addEnergy(5);
    } else if (type === 'drop') {
      p.setState('hit', 0.28);
      window.AudioSys.hit();
      // drop: pelan, jatuh dekat net sisi lawan
      shuttle.vx = dir * (250 + Math.random() * 50) * (0.85 + p.powerMul * 0.25) * qMult;
      shuttle.vy = -260 - Math.random() * 60;
      shuttle.smash = false;
      burst(shuttle.x, shuttle.y, q === 'perfect' ? 10 : 5, '#80d8ff');
      if (q === 'perfect') msg('PERFECT DROP!', 500);
      p.addEnergy(6);
    } else if (type === 'drive') {
      p.setState('hit', 0.25);
      window.AudioSys.hit();
      shuttle.vx = dir * (640 + Math.random() * 80) * p.powerMul * qMult;
      shuttle.vy = -200 - Math.random() * 120;
      shuttle.smash = false;
      burst(shuttle.x, shuttle.y, 6, '#ffffff');
      if (q === 'perfect') { msg('PERFECT!', 350); burst(shuttle.x, shuttle.y, 8, '#00e5ff'); }
      else if (q === 'late') { shuttle.vx *= 0.88; }
      p.addEnergy(10);
    } else {
      p.setState('hit', 0.25);
      window.AudioSys.hit();
      var high = Math.random() < 0.45;
      if (high) { shuttle.vx = dir * (430 + Math.random() * 90) * p.powerMul * qMult; shuttle.vy = -680 - Math.random() * 120; }
      else { shuttle.vx = dir * (540 + Math.random() * 80) * p.powerMul * qMult; shuttle.vy = -430 - Math.random() * 120; }
      if (q === 'late') shuttle.vx *= 0.9;
      shuttle.smash = false;
      burst(shuttle.x, shuttle.y, 5, '#ffffff');
      if (q === 'perfect') { msg('PERFECT!', 350); burst(shuttle.x, shuttle.y, 8, '#00e5ff'); }
      p.addEnergy(12);
    }
    if (shuttle.vx > 950) shuttle.vx = 950;
    if (shuttle.vx < -950) shuttle.vx = -950;
    if (shuttle.vy < -950) shuttle.vy = -950;
    if (shuttle.vy > 800) shuttle.vy = 800;
    lastHitTeam = p.team; lastHitter = p;
    if (isPractice()) pHits = rallyHits;
    updateScoreboard();
    return true;
  }

  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 340, vy: (Math.random() - 0.5) * 340 - 80, life: 0.4 + Math.random() * 0.3, color: color, size: 2 + Math.random() * 3 });
    }
  }

  function awardPoint(winner) {
    score[winner]++;
    bestRally = Math.max(bestRally, rallyHits);
    if (rallyHits >= 12) window.AudioSys.cheer(); // reli panjang = penonton heboh
    else window.AudioSys.score();
    servingTeam = winner;
    phase = 'point'; pointTimer = 1.6; shake = 5;
    // deteksi match point / game point
    var win = window.Settings.winScore || 21, a = score[0], b = score[1];
    var aClose = (a >= win - 1 && a - b >= 1) || a === win - 0, bClose = (b >= win - 1 && b - a >= 1);
    var isMatchPoint = (gamesWon[winner] + 1 >= needGames()) && (winner === 0 ? aClose : bClose);
    msg(isMatchPoint ? '🔥 MATCH POINT! ' + teamNames()[winner] : 'POINT! ' + teamNames()[winner], 1400);
    if (isMatchPoint) { slowMo = 0.5; rings.push({ x: C.W / 2, y: 250, r: 20, life: 0.6, max: 0.6 }); }
    burst(shuttle.x, C.GROUND_Y - 10, 20, winner === 0 ? '#00e5ff' : '#ff8f00');
    updateScoreboard();
    var gameWinner = -1;
    if ((a >= win && a - b >= 2) || a === 30) gameWinner = 0;
    if ((b >= win && b - a >= 2) || b === 30) gameWinner = 1;
    if (gameWinner !== -1) {
      gamesWon[gameWinner]++;
      updateScoreboard();
      setTimeout(function () { onGameEnd(gameWinner); }, 1500);
    }
  }

  function onGameEnd(gameWinner) {
    if (phase !== 'point') return;
    if (gamesWon[gameWinner] >= needGames()) {
      endMatch(gameWinner);
    } else {
      // jeda ganti sisi
      phase = 'gamebreak'; breakTimer = 3.2;
      msg('Game ' + gameNo + ' → ' + teamNames()[gameWinner] + '  • Ganti sisi!', 3000);
      window.AudioSys.whistle();
    }
  }

  function swapSides() {
    // tukar sisi L<->R semua pemain (ganti lapangan), reset skor game
    players.forEach(function (p) {
      p.side = p.side === 'L' ? 'R' : 'L';
      p.dir = p.side === 'L' ? 1 : -1;
      // home mirror
      if (p.side === 'L') p.homeX = p.role === 0 ? 250 : 380;
      else p.homeX = p.role === 0 ? 710 : 580;
      if (mode === 'double' || mode === 'double2p') {
        if (p.team === 0 && p.role === 1 && p.side === 'L') p.homeX = 360;
        if (p.team === 0 && p.role === 1 && p.side === 'R') p.homeX = 600;
        if (p.team === 1 && p.role === 1 && p.side === 'R') p.homeX = 600;
        if (p.team === 1 && p.role === 1 && p.side === 'L') p.homeX = 360;
      }
      // teleport langsung + reset AI agar tidak geter di tengah
      p.x = p.homeX; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true;
      p.setState('idle'); p.hitCd = 0;
      if (p.ai) { p.ai.targetX = p.homeX; p.ai.think = 0.3; p.ai.hitCooldown = 0.3; }
    });
    score = [0, 0]; gameNo++;
    updateScoreboard();
  }

  function teamNames() {
    var t0 = players.filter(function (p) { return p.team === 0; }).map(function (p) { return p.name; }).join(' & ');
    var t1 = players.filter(function (p) { return p.team === 1; }).map(function (p) { return p.name; }).join(' & ');
    return [t0 || 'Tim Kiri', t1 || 'Tim Kanan'];
  }

  function endMatch(champ) {
    if (phase === 'over') return;
    phase = 'over'; matchActive = false;
    window.AudioSys.whistle(); window.AudioSys.cheer(); window.AudioSys.stopBgm();
    // confetti kemenangan
    for (var i = 0; i < 120; i++) {
      confetti.push({ x: Math.random() * C.W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 220, life: 3 + Math.random() * 2, color: ['#ffb300', '#00e5ff', '#ff5252', '#69f0ae', '#e040fb'][i % 5], size: 4 + Math.random() * 5, rot: Math.random() * 6 });
    }
    var names = teamNames();
    var scoreline = bestOf === 3 ? 'Games ' + gamesWon[0] + '-' + gamesWon[1] + ' • Game terakhir ' + score[0] + '-' + score[1] : score[0] + ' — ' + score[1];
    document.getElementById('end-title').textContent = '🏆 ' + names[champ] + ' Menang!';
    document.getElementById('end-score').textContent = scoreline + ' • Reli: ' + bestRally + ' • Smash: ' + smashCount + ' • Perfect: ' + perfectCount;
    document.getElementById('match-end').classList.remove('hidden');
    hideMsg(); updateScoreboard();
    // simpan leaderboard (host saja saat online biar tidak dobel)
    try {
      if (!isOnline() || netRole === 'host') {
        players.forEach(function (p) {
          window.Store.addWin(p.name, { won: p.team === champ, bestRally: bestRally, smash: p.team === champ ? smashCount : 0 });
        });
      }
    } catch (e) {}
    if (isOnline() && netRole === 'host') {
      try { window.Net.send({ t: 'over', champ: champ, title: document.getElementById('end-title').textContent, sub: document.getElementById('end-score').textContent }); } catch (e) {}
    }
  }
  function showGuestOver(d) {
    phase = 'over'; matchActive = false;
    window.AudioSys.whistle(); window.AudioSys.cheer(); window.AudioSys.stopBgm();
    for (var i = 0; i < 120; i++) {
      confetti.push({ x: Math.random() * C.W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 220, life: 3 + Math.random() * 2, color: ['#ffb300', '#00e5ff', '#ff5252', '#69f0ae', '#e040fb'][i % 5], size: 4 + Math.random() * 5, rot: Math.random() * 6 });
    }
    document.getElementById('end-title').textContent = d.title || 'Match selesai!';
    document.getElementById('end-score').textContent = d.sub || '';
    document.getElementById('match-end').classList.remove('hidden');
    hideMsg(); updateScoreboard();
  }

  function humanSlot(p) { return p.humanIdx === 2 ? 'p2' : 'p1'; }

  function handleHumanHit(h) {
    var I = window.Input, slot = humanSlot(h), alias = allowArrowsForP1();
    var didHit = slot === 'p2' ? I.p2Take('hit') : I.p1Take('hit', alias);
    var didSmash = slot === 'p2' ? I.p2Take('smash') : I.p1Take('smash', alias);
    var didDrop = slot === 'p2' ? I.p2Take('drop') : I.p1Take('drop', alias);
    if (didHit && !hitShuttle(h, 'hit')) h.setState('hit', 0.22);
    if (didSmash && !hitShuttle(h, 'smash')) h.setState('smash', 0.25);
    if (didDrop && !hitShuttle(h, 'drop')) h.setState('hit', 0.22);
    if (slot === 'p2') I.p2Take('serve'); else I.p1Take('serve', alias);
  }

  function handleHumanServe(h) {
    var I = window.Input, slot = humanSlot(h), alias = allowArrowsForP1();
    var go = slot === 'p2'
      ? (I.p2Take('serve') || I.p2Take('hit') || I.p2Take('smash') || I.p2Take('drop'))
      : (I.p1Take('serve', alias) || I.p1Take('hit', alias) || I.p1Take('smash', alias) || I.p1Take('drop', alias));
    if (go) tryServe(h);
  }

  // ---- ONLINE (host autoritatif, guest mirror) ----
  function updateNetP(dt, p) {
    var mv = 0;
    if (remoteInp.l) mv--;
    if (remoteInp.r) mv++;
    p.vx = mv * p.moveSpeed;
    p.x += p.vx * dt;
    if (p.x < p.minX()) p.x = p.minX();
    if (p.x > p.maxX()) p.x = p.maxX();
    if (mv !== 0) { p.dir = mv > 0 ? 1 : -1; p.runPhase += dt * 13; if (p.onGround && p.stateT <= 0) p.setState('run'); }
    else if (p.onGround && p.state === 'run') p.setState('idle');
    if (remoteInp.jump > 0) { remoteInp.jump = 0; p.doJump(); }
    p.anim += dt;
    p.energy = Math.min(100, p.energy + dt * 6);
    if (p.hitCd > 0) p.hitCd -= dt;
    if (p.stateT > 0) { p.stateT -= dt; if (p.stateT <= 0 && (p.state === 'hit' || p.state === 'smash' || p.state === 'serve')) p.setState(p.onGround ? 'idle' : 'jump'); }
  }
  function handleNetHit(h) {
    if (remoteInp.hit > 0) { remoteInp.hit = 0; if (!hitShuttle(h, 'hit')) h.setState('hit', 0.22); }
    if (remoteInp.smash > 0) { remoteInp.smash = 0; if (!hitShuttle(h, 'smash')) h.setState('smash', 0.25); }
    if (remoteInp.drop > 0) { remoteInp.drop = 0; if (!hitShuttle(h, 'drop')) h.setState('hit', 0.22); }
    remoteInp.serve = 0;
  }
  function getSnapshot() {
    return {
      t: 'snap', phase: phase, countT: Math.round(countT * 10) / 10,
      score: score.slice(), games: gamesWon.slice(), gameNo: gameNo, serving: servingTeam,
      serverIdx: server ? players.indexOf(server) : -1,
      rally: rallyHits, best: bestRally, smash: smashCount, perfect: perfectCount,
      players: players.map(function (p) {
        return { x: Math.round(p.x), y: Math.round(p.y), vy: Math.round(p.vy), dir: p.dir, state: p.state, energy: Math.round(p.energy), ground: p.onGround ? 1 : 0, side: p.side };
      }),
      shuttle: shuttle ? { x: Math.round(shuttle.x), y: Math.round(shuttle.y), vx: Math.round(shuttle.vx), vy: Math.round(shuttle.vy), smash: shuttle.smash ? 1 : 0 } : null
    };
  }
  function applySnapshot(s) {
    if (!s || netRole !== 'guest') return;
    var prevScore = score.slice();
    score = s.score.slice(); gamesWon = s.games.slice(); gameNo = s.gameNo; servingTeam = s.serving;
    rallyHits = s.rally; bestRally = s.best; smashCount = s.smash; perfectCount = s.perfect;
    lastSnap = s;
    if (s.phase === 'countdown') {
      phase = 'countdown'; countT = s.countT;
      var n = Math.ceil(countT);
      if (n !== applySnapshot._n) { applySnapshot._n = n; msg(n > 0 ? String(n) : 'GO!', 600); }
    } else if (s.phase === 'serve') {
      if (phase !== 'serve') { var sv = players[s.serverIdx] || players[0]; msg(sv && sv.humanIdx === 2 ? 'Serve! (L)' : 'P1 servis...', 0); }
      phase = 'serve';
      server = players[s.serverIdx] || null;
    } else if (s.phase === 'point') {
      if (phase !== 'point') msg('POINT!', 1200);
      phase = 'point';
    } else if (s.phase === 'gamebreak') {
      if (phase !== 'gamebreak') msg('Ganti sisi!', 2500);
      phase = 'gamebreak';
    } else if (s.phase === 'rally') {
      if (phase !== 'rally') hideMsg();
      phase = 'rally';
      server = players[s.serverIdx] || null;
    }
    // smoothing posisi: lawan + kok ikut host, posisi sendiri dikoreksi pelan
    var me = null;
    for (var i = 0; i < players.length && i < s.players.length; i++) {
      var p = players[i], q = s.players[i];
      if (q.side && p.side !== q.side) {
        // host ganti sisi → ikuti (teleport, cegah geter)
        p.side = q.side; p.dir = p.side === 'L' ? 1 : -1;
        p.homeX = p.side === 'L' ? 250 : 710;
        p.x = p.homeX; p.y = C.GROUND_Y; p.vy = 0; p.onGround = true;
      }
      if (p.humanIdx === 2 && p.control === 'human') {
        me = p;
        if (Math.abs(p.x - q.x) > 34) p.x += (q.x - p.x) * 0.25;
        if (Math.abs(p.y - q.y) > 34) { p.y = q.y; p.vy = q.vy; }
        p.energy = q.energy;
      } else {
        p.x += (q.x - p.x) * 0.55; p.y += (q.y - p.y) * 0.55;
        p.vy = q.vy; p.dir = q.dir; p.energy = q.energy; p.onGround = !!q.ground;
        if (p.state !== q.state && p.stateT <= 0) p.state = q.state;
      }
    }
    if (s.shuttle) {
      if (!shuttle) shuttle = makeShuttle(s.shuttle.x, s.shuttle.y);
      shuttle.x += (s.shuttle.x - shuttle.x) * 0.6;
      shuttle.y += (s.shuttle.y - shuttle.y) * 0.6;
      shuttle.vx = s.shuttle.vx; shuttle.vy = s.shuttle.vy; shuttle.smash = !!s.shuttle.smash;
    } else shuttle = null;
    if (score[0] !== prevScore[0] || score[1] !== prevScore[1]) updateScoreboard();
    updateScoreboard();
    if (me) { /* energi lokal tetap dipakai host */ }
  }
  function updateGuest(dt) {
    var I = window.Input;
    var me = null, foe = null;
    players.forEach(function (p) { if (p.humanIdx === 2 && p.control === 'human') me = p; else foe = p; });
    // kirim input ~30Hz
    guestSendT -= dt;
    var j = I.p2Take('jump'), h = I.p2Take('hit'), sm = I.p2Take('smash'), dr = I.p2Take('drop'), sv = I.p2Take('serve');
    if (me) {
      if (j) me.doJump();
      if (h) me.setState('hit', 0.22);
      if (sm) me.setState('smash', 0.25);
      if (dr) me.setState('hit', 0.22);
    }
    if (guestSendT <= 0) {
      guestSendT = 0.033;
      try { window.Net.send({ t: 'in', l: I.p2Left() ? 1 : 0, r: I.p2Right() ? 1 : 0, jump: j ? 1 : 0, hit: h ? 1 : 0, smash: sm ? 1 : 0, drop: dr ? 1 : 0, serve: sv ? 1 : 0 }); } catch (e) {}
    } else if (j || h || sm || dr || sv) {
      try { window.Net.send({ t: 'in', l: I.p2Left() ? 1 : 0, r: I.p2Right() ? 1 : 0, jump: j ? 1 : 0, hit: h ? 1 : 0, smash: sm ? 1 : 0, drop: dr ? 1 : 0, serve: sv ? 1 : 0 }); } catch (e) {}
      guestSendT = 0.033;
    }
    // gerak lokal (prediksi) untuk diri sendiri
    if (me) {
      me.applyGravity(dt);
      if (me.hitCd > 0) me.hitCd -= dt;
      var mv = 0;
      if (I.p2Left()) mv--;
      if (I.p2Right()) mv++;
      me.vx = mv * me.moveSpeed; me.x += me.vx * dt;
      if (me.x < me.minX()) me.x = me.minX();
      if (me.x > me.maxX()) me.x = me.maxX();
      if (mv !== 0) { me.dir = mv > 0 ? 1 : -1; me.runPhase += dt * 13; if (me.onGround && me.stateT <= 0) me.setState('run'); }
      else if (me.onGround && me.state === 'run') me.setState('idle');
      me.anim += dt;
      me.energy = Math.min(100, me.energy + dt * 6);
      if (me.stateT > 0) { me.stateT -= dt; if (me.stateT <= 0 && (me.state === 'hit' || me.state === 'smash')) me.setState(me.onGround ? 'idle' : 'jump'); }
    }
    if (foe) { foe.anim += dt; }
    stepFx(dt);
  }

  // ---- PRACTICE ----
  function practiceFeed() {
    // luncurkan kok dari kanan atas ke kiri
    shuttle = makeShuttle(760, 180);
    shuttle.vx = -(300 + Math.random() * 120);
    shuttle.vy = -120 - Math.random() * 80;
    shuttle.smash = false;
    phase = 'rally';
  }

  function updatePractice(dt) {
    var h = humans[0];
    if (!h) return;
    h.applyGravity(dt);
    if (h.hitCd > 0) h.hitCd -= dt;
    h.updateHuman(dt, true, 'p1', true);
    var I = window.Input;
    if (I.p1Take('hit', true) && !hitShuttle(h, 'hit')) h.setState('hit', 0.22);
    if (I.p1Take('smash', true) && !hitShuttle(h, 'smash')) h.setState('smash', 0.25);
    if (I.p1Take('drop', true) && !hitShuttle(h, 'drop')) h.setState('hit', 0.22);
    if (I.p1Take('serve', true)) { // R/reset: pakai serve untuk feed ulang
      pHits = 0; rallyHits = 0; practiceFeed(); msg('Feed ulang!', 600); updateScoreboard();
    }
    if (!shuttle || phase !== 'rally') { feedTimer -= dt; if (feedTimer <= 0) { practiceFeed(); feedTimer = 0.5; } return; }
    window.Physics.stepShuttle(shuttle, dt);
    window.Physics.netCollide(shuttle);
    if (shuttle.x < -30 || shuttle.x > C.W + 30) { pMiss++; rallyHits = 0; window.Store.addPractice(pHits); practiceFeed(); updateScoreboard(); return; }
    if (shuttle.y >= C.GROUND_Y) {
      shuttle.y = C.GROUND_Y;
      pMiss++; rallyHits = 0;
      window.Store.addPractice(pHits);
      burst(shuttle.x, C.GROUND_Y - 8, 8, '#ff8f00');
      msg(pHits > 0 ? pHits + 'x rally — miss!' : 'Miss! Coba lagi', 800);
      practiceFeed(); updateScoreboard();
    }
    stepParticles(dt);
  }

  function update(dt) {
    if (paused || !matchActive) return;
    // slow-mo keren: perlambat dunia sesaat
    if (slowMo > 0) { slowMo -= dt; dt *= 0.35; }
    elapsed += dt; ledX += dt * 120;
    if (shake > 0) shake = Math.max(0, shake - dt * 22);
    if (netWobble > 0) netWobble = Math.max(0, netWobble - dt * 3);
    stepFx(dt);
    // countdown awal match
    if (phase === 'countdown') {
      countT -= dt;
      var n = Math.ceil(countT);
      if (n !== update._lastN) {
        update._lastN = n;
        if (n > 0) { msg(String(n), 700); window.AudioSys.count(); }
        else { msg('GO!', 600); window.AudioSys.go(); }
      }
      if (countT <= 0) setupServe();
      return;
    }
    if (isPractice()) { updatePractice(dt); return; }
    if (isOnline() && netRole === 'guest') { elapsed += 0; updateGuest(dt); return; }
    // host online: kirim snapshot ~20Hz
    if (isOnline() && netRole === 'host') {
      snapSendT -= dt;
      if (snapSendT <= 0) {
        snapSendT = 0.05;
        try { window.Net.send(getSnapshot()); } catch (e) {}
      }
    }

    // Saat point / gamebreak: semua jalan pulang ke home, jangan kejar kok (cegah geter di net)
    if (phase === 'point' || phase === 'gamebreak') {
      players.forEach(function (p) {
        p.applyGravity(dt);
        if (p.hitCd > 0) p.hitCd -= dt;
        var dx = p.homeX - p.x;
        if (Math.abs(dx) > 5) {
          var step = Math.sign(dx) * p.moveSpeed * 0.45 * dt;
          if (Math.abs(step) > Math.abs(dx)) step = dx;
          p.x += step;
          p.dir = step > 0 ? 1 : -1;
          p.runPhase += dt * 8;
          if (p.onGround && p.stateT <= 0) p.setState('run');
        } else if (p.onGround && p.state === 'run') p.setState('idle');
        if (p.ai) { p.ai.targetX = p.homeX; p.ai.think = 0.2; }
        if (p.stateT > 0 && p.control !== 'human') p.stateT -= dt;
      });
      stepParticles(dt);
      if (phase === 'point') {
        pointTimer -= dt;
        if (pointTimer <= 0 && phase === 'point') {
          var win = window.Settings.winScore || 21, a = score[0], b = score[1];
          var gameWinner = -1;
          if ((a >= win && a - b >= 2) || a === 30) gameWinner = 0;
          if ((b >= win && b - a >= 2) || b === 30) gameWinner = 1;
          if (gameWinner === -1) setupServe();
        }
      } else {
        breakTimer -= dt;
        if (breakTimer <= 0) { swapSides(); setupServe(); }
      }
      return;
    }

    players.forEach(function (p) {
      p.applyGravity(dt);
      if (p.hitCd > 0) p.hitCd -= dt;
      if (p.control === 'human') p.updateHuman(dt, true, humanSlot(p), allowArrowsForP1());
      else if (p.control === 'net') updateNetP(dt, p);
      else if (p.ai) p.ai.update(dt, shuttle, api);
      if (p.stateT > 0 && p.control !== 'human') p.stateT -= dt;
    });

    if (phase === 'serve') {
      serveHoldT += dt;
      if (shuttle && server) {
        var r = server.racketPos();
        shuttle.x = r.x; shuttle.y = r.y - 12 + Math.sin(serveHoldT * 5) * 3;
        shuttle.vx = 0; shuttle.vy = 0;
      }
      if (server && server.control === 'human') handleHumanServe(server);
      else if (server && server.control === 'net') {
        if (remoteInp.serve > 0 || remoteInp.hit > 0 || remoteInp.smash > 0 || remoteInp.drop > 0) {
          remoteInp.serve = 0; remoteInp.hit = 0; remoteInp.smash = 0; remoteInp.drop = 0;
          tryServe(server);
        }
      }
      return;
    }
    if (phase === 'rally') {
      humans.forEach(handleHumanHit);
      players.forEach(function (p) { if (p.control === 'net') handleNetHit(p); });
      window.Physics.stepShuttle(shuttle, dt);
      if (window.Physics.netCollide(shuttle)) netWobble = 1;
      if (shuttle.x < -30 || shuttle.x > C.W + 30 || shuttle.y < -220) {
        var w = lastHitTeam === 0 ? 1 : 0;
        if (lastHitTeam === -1) w = teamOnSide(shuttle.x < C.NET_X ? 'L' : 'R') === 0 ? 1 : 0;
        // out: pemukul terakhir kalah
        awardPoint(w); return;
      }
      if (shuttle.y >= C.GROUND_Y) {
        shuttle.y = C.GROUND_Y;
        var lx = shuttle.x, winner, out = lx < C.COURT_L || lx > C.COURT_R;
        if (out) { winner = lastHitTeam === 0 ? 1 : 0; if (lastHitTeam === -1) winner = teamOnSide(lx < C.NET_X ? 'L' : 'R') === 0 ? 1 : 0; }
        else {
          // mendarat di sisi kiri → tim yang di kanan dapat poin
          var leftTeam = teamOnSide('L'), rightTeam = teamOnSide('R');
          winner = lx < C.NET_X ? rightTeam : leftTeam;
        }
        awardPoint(winner); return;
      }
      stepParticles(dt);
      return;
    }
  }

  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var pt = particles[i];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  }
  function stepFx(dt) {
    stepParticles(dt);
    for (var i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= dt; rings[i].r += dt * 320;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
    for (var j = confetti.length - 1; j >= 0; j--) {
      var c = confetti[j];
      c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 5;
      c.vy = Math.min(320, c.vy + 60 * dt);
      if (c.y > C.H + 30 || c.life <= 0) confetti.splice(j, 1);
    }
  }

  function drawArena() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    var g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, '#0d1b45'); g.addColorStop(0.55, '#13286b'); g.addColorStop(0.551, '#0e5c38'); g.addColorStop(1, '#0a452b');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, C.W + 40, C.H + 40);
    ctx.fillStyle = '#0a1430'; ctx.fillRect(0, 0, C.W, 120);
    var t = elapsed;
    for (var r = 0; r < 4; r++) for (var i = 0; i < 48; i++) {
      var px = 12 + i * 20 + (r % 2) * 8, py = 18 + r * 24 + Math.sin(t * 3 + i * 0.7 + r) * 2.5;
      var cols = ['#ff8a80', '#ffd180', '#a7ffeb', '#82b1ff', '#ea80fc'];
      ctx.fillStyle = cols[(i + r) % cols.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // LED berjalan + floodlight
    ctx.fillStyle = '#050a1e'; ctx.fillRect(0, 154, C.W, 26);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 154, C.W, 26); ctx.clip();
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
    var txt = ' SMASHARENA ★ PERFECT = +18% POWER ★ DROP-SHOT S / ↓ ★ SMASH BUTUH 25 ENERGY ★ BEST OF ' + bestOf + ' ★ ';
    var tw = ctx.measureText(txt).width || 600;
    var off = -(ledX % tw);
    for (var lx = off; lx < C.W; lx += tw) {
      ctx.fillStyle = '#00e5ff'; ctx.fillText(txt, lx, 172);
    }
    ctx.restore();
    // sorot floodlight
    var fg = ctx.createRadialGradient(C.W / 2, 120, 40, C.W / 2, 120, 520);
    fg.addColorStop(0, 'rgba(255,255,240,.14)'); fg.addColorStop(1, 'transparent');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, C.W, C.H);
    var glow = 0.6 + Math.sin(t * 2) * 0.2;
    ctx.fillStyle = 'rgba(255,179,0,' + glow.toFixed(2) + ')';
    ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillText(isPractice() ? '★ TRAINING COURT ★' : '★ SMASHARENA • GAME ' + gameNo + ' ★', C.W / 2, 132);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '12px Arial';
    ctx.fillText(isPractice() ? ('Pukulan: ' + pHits + ' • Miss: ' + pMiss + ' • Best: ' + window.Store.practiceBest()) : ('Reli: ' + rallyHits + ' • Best: ' + bestRally + ' • Smash: ' + smashCount + ' • Perfect: ' + perfectCount), C.W / 2, 150);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, C.GROUND_Y, C.W, C.H - C.GROUND_Y);
    ctx.fillStyle = '#2e9e5b'; ctx.fillRect(C.COURT_L - 20, 300, C.COURT_R - C.COURT_L + 40, C.GROUND_Y - 300);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(C.COURT_L - 20, 300, C.COURT_R - C.COURT_L + 40, 24);
    ctx.fillStyle = '#34ad63'; ctx.fillRect(C.COURT_L - 20, 360, C.COURT_R - C.COURT_L + 40, 60);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(C.COURT_L, C.GROUND_Y); ctx.lineTo(C.COURT_R, C.GROUND_Y); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeRect(C.COURT_L, 300, C.COURT_R - C.COURT_L, C.GROUND_Y - 300);
    var svc = 130;
    ctx.beginPath();
    ctx.moveTo(C.NET_X - svc, 300); ctx.lineTo(C.NET_X - svc, C.GROUND_Y);
    ctx.moveTo(C.NET_X + svc, 300); ctx.lineTo(C.NET_X + svc, C.GROUND_Y);
    ctx.stroke();
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(C.NET_X, 300); ctx.lineTo(C.NET_X, C.GROUND_Y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    var wob = Math.sin(elapsed * 30) * 5 * netWobble;
    ctx.fillRect(C.NET_X - C.NET_W / 2 + wob, C.NET_TOP, C.NET_W, C.GROUND_Y - C.NET_TOP);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (var ny = C.NET_TOP + 8; ny < C.GROUND_Y; ny += 12) {
      ctx.beginPath(); ctx.moveTo(C.NET_X - 4, ny); ctx.lineTo(C.NET_X + 4, ny); ctx.stroke();
    }
    ctx.fillStyle = '#0d47a1';
    ctx.fillRect(C.NET_X - 14, C.NET_TOP - 8, 28, 10);
    ctx.fillStyle = '#78909c';
    ctx.fillRect(C.NET_X - 4, C.NET_TOP - 8, 8, C.GROUND_Y - C.NET_TOP + 8);
    ctx.restore();
  }

  function drawShuttle() {
    if (!shuttle) return;
    ctx.save(); ctx.translate(shuttle.x, shuttle.y);
    if (shuttle.smash) {
      ctx.strokeStyle = 'rgba(255,235,59,.75)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-shuttle.vx * 0.06, -shuttle.vy * 0.06); ctx.lineTo(0, 0); ctx.stroke();
    }
    ctx.rotate(Math.atan2(shuttle.vy, shuttle.vx) + Math.PI / 2 + Math.sin(shuttle.spin) * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-7, 6); ctx.lineTo(7, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-4, 6); ctx.moveTo(0, -12); ctx.lineTo(4, 6); ctx.stroke();
    ctx.fillStyle = '#ff5722';
    ctx.beginPath(); ctx.arc(0, 9, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-2, 7, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    // shockwave ring
    rings.forEach(function (rg) {
      ctx.globalAlpha = Math.max(0, rg.life / rg.max);
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,229,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r * 0.7, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // confetti kemenangan
    confetti.forEach(function (c) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.color; ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    });
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawArena();
    players.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (p) { p.draw(ctx); });
    drawShuttle();
    if (phase === 'serve' && server) {
      ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('▼ SERVE ' + (server.control === 'human' ? (server.humanIdx === 2 ? 'P2' : 'P1') : ''), server.x, 250 + Math.sin(Date.now() / 200) * 4);
    }
    ctx.restore();
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!canvas) return;
    var dt = (t - lastTime) / 1000;
    lastTime = t;
    if (!(dt > 0)) return;
    if (dt > 0.033) dt = 0.033;
    try { update(dt); } catch (e) { console.error(e); }
    try { render(); } catch (e) { console.error(e); }
  }

  function beginWithCountdown() {
    players.forEach(function (p) {
      p.x = p.homeX; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true;
      p.setState('idle'); p.hitCd = 0;
      if (p.ai) { p.ai.targetX = p.homeX; p.ai.think = 0.5; }
    });
    shuttle = null;
    phase = 'countdown'; countT = 2.4; update._lastN = -1;
    updateScoreboard();
  }

  function mkPlayer(charData, name, side, team, role, control, humanIdx, jersey) {    var p = new window.Player({ charData: charData, name: name, side: side, team: team, role: role, control: control, humanIdx: humanIdx, jersey: jersey });
    if (control === 'ai') p.ai = new window.AIController(p, difficulty);
    else humans.push(p);
    return p;
  }

  var api = {
    init: function (cv) { canvas = cv; ctx = canvas.getContext('2d'); lastTime = performance.now(); requestAnimationFrame(loop); },
    startMatch: function (opts) {
      optsCache = opts;
      mode = opts.mode; difficulty = opts.difficulty || window.Settings.difficulty || 'normal';
      bestOf = opts.bestOf || window.Settings.bestOf || 3;
      netRole = null; lastSnap = null; lastTeams = null;
      remoteInp = { l: false, r: false, jump: 0, hit: 0, smash: 0, drop: 0, serve: 0 };
      players = []; humans = []; score = [0, 0]; gamesWon = [0, 0]; gameNo = 1;
      servingTeam = 0; particles = []; rings = []; confetti = []; rallyHits = 0; bestRally = 0; smashCount = 0; perfectCount = 0;
      pHits = 0; pMiss = 0; feedTimer = 0; slowMo = 0; netWobble = 0; shake = 0;
      paused = false; matchActive = true; shake = 0;
      document.getElementById('match-end').classList.add('hidden');
      document.getElementById('pause-menu').classList.add('hidden');
      hideMsg();
      if (mode === 'practice') {
        players = [mkPlayer(opts.teamA[0].charData, opts.teamA[0].name, 'L', 0, 0, 'human', 1, 1)];
        phase = 'rally';
        practiceFeed();
        msg('Latihan! Pukul kok, jangan jatuh. Serve = reset.', 2200);
      } else if (mode === 'single') {
        players = [mkPlayer(opts.teamA[0].charData, opts.teamA[0].name, 'L', 0, 0, 'human', 1, 1),
                   mkPlayer(opts.teamB[0].charData, opts.teamB[0].name, 'R', 1, 0, 'ai', 0, 1)];
        beginWithCountdown();
      } else if (mode === 'single2p') {
        players = [mkPlayer(opts.teamA[0].charData, opts.teamA[0].name, 'L', 0, 0, 'human', 1, 1),
                   mkPlayer(opts.teamB[0].charData, opts.teamB[0].name, 'R', 1, 0, 'human', 2, 1)];
        beginWithCountdown();
      } else if (mode === 'double') {
        var a0 = mkPlayer(opts.teamA[0].charData, opts.teamA[0].name, 'L', 0, 0, 'human', 1, 1);
        var a1 = mkPlayer(opts.teamA[1].charData, opts.teamA[1].name, 'L', 0, 1, 'ai', 0, 2);
        var b0 = mkPlayer(opts.teamB[0].charData, opts.teamB[0].name, 'R', 1, 0, 'ai', 0, 1);
        var b1 = mkPlayer(opts.teamB[1].charData, opts.teamB[1].name, 'R', 1, 1, 'ai', 0, 2);
        a1.homeX = 360; b1.homeX = 600; players = [a0, a1, b0, b1];
        beginWithCountdown();
      } else if (mode === 'double2p') {
        var c0 = mkPlayer(opts.teamA[0].charData, opts.teamA[0].name, 'L', 0, 0, 'human', 1, 1);
        var c1 = mkPlayer(opts.teamA[1].charData, opts.teamA[1].name, 'L', 0, 1, 'ai', 0, 2);
        var d0 = mkPlayer(opts.teamB[0].charData, opts.teamB[0].name, 'R', 1, 0, 'human', 2, 1);
        var d1 = mkPlayer(opts.teamB[1].charData, opts.teamB[1].name, 'R', 1, 1, 'ai', 0, 2);
        c1.homeX = 360; d1.homeX = 600; players = [c0, c1, d0, d1];
        beginWithCountdown();
      } else {
        // mode online lewat startOnlineHost/Guest, jangan startMatch biasa
        return;
      }
      var names = teamNames();
      document.getElementById('sb-name-a').textContent = isPractice() ? names[0] : names[0];
      document.getElementById('sb-name-b').textContent = isPractice() ? 'MISS' : names[1];
      document.getElementById('sb-diff').textContent = isPractice() ? 'TRAIN' : is2P() ? '2P' : difficulty.toUpperCase();
      window.AudioSys.startBgm();
      updateScoreboard();
    },
    tryServe: tryServe, hitShuttle: hitShuttle,
    // ---- ONLINE API ----
    startOnlineHost: function (teamA, teamB) {
      mode = 'online'; netRole = 'host'; bestOf = window.Settings.bestOf || 3;
      lastTeams = { teamA: teamA, teamB: teamB };
      optsCache = null;
      players = []; humans = []; score = [0, 0]; gamesWon = [0, 0]; gameNo = 1;
      servingTeam = 0; particles = []; rings = []; confetti = [];
      rallyHits = 0; bestRally = 0; smashCount = 0; perfectCount = 0;
      slowMo = 0; netWobble = 0; shake = 0; snapSendT = 0;
      remoteInp = { l: false, r: false, jump: 0, hit: 0, smash: 0, drop: 0, serve: 0 };
      paused = false; matchActive = true;
      document.getElementById('match-end').classList.add('hidden');
      document.getElementById('pause-menu').classList.add('hidden');
      hideMsg();
      players = [mkPlayer(teamA[0].charData, teamA[0].name, 'L', 0, 0, 'human', 1, 1),
                 mkPlayer(teamB[0].charData, teamB[0].name, 'R', 1, 0, 'net', 2, 1)];
      beginWithCountdown();
      var names = teamNames();
      document.getElementById('sb-name-a').textContent = names[0];
      document.getElementById('sb-name-b').textContent = names[1];
      window.AudioSys.startBgm();
      updateScoreboard();
    },
    startOnlineGuest: function (teamA, teamB) {
      mode = 'online'; netRole = 'guest'; bestOf = window.Settings.bestOf || 3;
      lastTeams = { teamA: teamA, teamB: teamB };
      optsCache = null;
      players = []; humans = []; score = [0, 0]; gamesWon = [0, 0]; gameNo = 1;
      servingTeam = 0; particles = []; rings = []; confetti = [];
      rallyHits = 0; bestRally = 0; smashCount = 0; perfectCount = 0;
      slowMo = 0; netWobble = 0; shake = 0; guestSendT = 0; lastSnap = null;
      paused = false; matchActive = true;
      document.getElementById('match-end').classList.add('hidden');
      document.getElementById('pause-menu').classList.add('hidden');
      hideMsg();
      var g1 = mkPlayer(teamA[0].charData, teamA[0].name, 'L', 0, 0, 'mirror', 1, 1);
      var g2 = mkPlayer(teamB[0].charData, teamB[0].name, 'R', 1, 0, 'human', 2, 1);
      void g1;
      players = [g1, g2]; humans = [g2];
      phase = 'countdown'; countT = 3; applySnapshot._n = -1;
      msg('Terhubung! Ikuti host...', 1500);
      var names = teamNames();
      document.getElementById('sb-name-a').textContent = names[0];
      document.getElementById('sb-name-b').textContent = names[1];
      window.AudioSys.startBgm();
      updateScoreboard();
    },
    setRemoteInput: function (d) {
      remoteInp.l = !!d.l; remoteInp.r = !!d.r;
      remoteInp.jump += d.jump ? 1 : 0; remoteInp.hit += d.hit ? 1 : 0;
      remoteInp.smash += d.smash ? 1 : 0; remoteInp.drop += d.drop ? 1 : 0;
      remoteInp.serve += d.serve ? 1 : 0;
    },
    applySnapshot: applySnapshot,
    setPing: function (ms) { pingMs = ms; if (isOnline()) updateScoreboard(); },
    guestReset: function () {
      score = [0, 0]; gamesWon = [0, 0]; gameNo = 1;
      phase = 'countdown'; countT = 3; applySnapshot._n = -1; lastSnap = null;
      document.getElementById('match-end').classList.add('hidden');
      hideMsg(); updateScoreboard();
    },
    showGuestOver: showGuestOver,
    get netRole() { return netRole; },
    togglePause: function () {
      if (!matchActive && !paused) return;
      if (phase === 'over') return;
      if (isOnline() && netRole === 'guest') { msg('Hanya host yang bisa pause', 1000); return; }
      paused = !paused;
      document.getElementById('pause-menu').classList.toggle('hidden', !paused);
      document.getElementById('btn-pause-top').classList.remove('hidden');
      if (isOnline() && netRole === 'host') { try { window.Net.send({ t: 'pause', v: paused }); } catch (e) {} }
    },
    setPaused: function (v) { paused = !!v; document.getElementById('pause-menu').classList.toggle('hidden', !paused); },
    rematch: function () {
      if (isOnline()) {
        if (netRole === 'guest') { msg('Minta P1 untuk rematch', 1200); return; }
        try { window.Net.send({ t: 'restart' }); } catch (e) {}
        if (lastTeams) this.startOnlineHost(lastTeams.teamA, lastTeams.teamB);
        return;
      }
      if (optsCache) this.startMatch(optsCache);
    },
    quit: function () {
      if (isPractice() && pHits > 0) window.Store.addPractice(pHits);
      if (isOnline()) { try { window.Net.send({ t: 'bye' }); } catch (e) {} try { window.Net.destroy(); } catch (e2) {} }
      netRole = null; lastSnap = null;
      matchActive = false; paused = false; window.AudioSys.stopBgm();
    },
    get players() { return players; },
    get phase() { return phase; },
    get mode() { return mode; },
    get server() { return server; },
    get matchActive() { return matchActive; }
  };
  return api;
})();
