// Navigasi UI + character selection + settings + leaderboard + practice
window.UI = (function () {
  var mode = 'single';
  var selected = [];
  var difficulty = window.Settings.difficulty || 'normal';

  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
    document.getElementById('btn-pause-top').classList.toggle('hidden', id !== 'screen-match');
    window.scrollTo(0, 0);
  }
  function statBar(label, v) {
    return '<div class="stat">' + label + ' ' + v + '<div class="bar"><i style="width:' + (v * 10) + '%"></i></div></div>';
  }
  function cardHTML(ch) {
    return '<div class="dot" style="background:' + ch.color + ';border:3px solid ' + ch.trim + '"></div>' +
      '<div class="cname">' + ch.name + '</div><div class="cstat">SPD ' + ch.speed + ' • PWR ' + ch.power + '</div>';
  }
  function renderGallery() {
    var g = document.getElementById('gallery-grid'); g.innerHTML = '';
    window.CHARACTERS.forEach(function (ch) {
      var d = document.createElement('div');
      d.className = 'char-card'; d.innerHTML = cardHTML(ch) + '<div class="cstat">' + ch.desc + '</div>';
      g.appendChild(d);
    });
  }
  function renderLeader() {
    var box = document.getElementById('leader-table');
    var db = window.Store.all();
    var rows = Object.keys(db).map(function (k) { return { name: k, v: db[k] }; });
    rows.sort(function (a, b) { return b.v.wins - a.v.wins || b.v.bestRally - a.v.bestRally; });
    var html = '<div class="muted small">Practice best: ' + window.Store.practiceBest() + ' pukulan</div><br>';
    if (!rows.length) html += '<div class="muted">Belum ada data. Mainkan 1 match dulu!</div>';
    else {
      html += '<table style="width:100%;font-size:14px;border-collapse:collapse"><tr style="color:#9fb0d6"><td>Nama</td><td>Win</td><td>Match</td><td>Best</td><td>Smash</td></tr>';
      rows.slice(0, 15).forEach(function (r) {
        html += '<tr style="border-top:1px solid #2b4a9e"><td><b>' + r.name + '</b></td><td>' + r.v.wins + '</td><td>' + r.v.matches + '</td><td>' + r.v.bestRally + '</td><td>' + r.v.smash + '</td></tr>';
      });
      html += '</table>';
    }
    box.innerHTML = html;
  }
  function needCount() {
    if (mode === 'single' || mode === 'practice') return 1;
    return 2;
  }
  function modeLabel() {
    return {
      single: 'Single vs AI (pilih 1)', single2p: 'Single 2P Lokal — P1 vs P2 (pilih 2)',
      double: 'Double vs AI (pilih 2)', double2p: 'Double 2P Lokal (pilih 2)',
      practice: 'Practice — latihan solo (pilih 1)'
    }[mode];
  }
  function renderSelect() {
    var grid = document.getElementById('char-grid'); grid.innerHTML = '';
    document.getElementById('select-title').textContent = 'Character Selection — ' + modeLabel();
    document.getElementById('select-subtitle').textContent = modeLabel() +
      (mode === 'practice' ? '' : ' • ' + (window.Settings.bestOf === 3 ? 'Best of 3 + ganti sisi' : '1 game'));
    document.getElementById('name-p2').classList.toggle('hidden', mode === 'single' || mode === 'practice');
    var solo = (mode === 'single2p' || mode === 'double2p');
    document.getElementById('diff-seg').style.opacity = (solo || mode === 'practice') ? 0.35 : 1;
    document.getElementById('diff-seg').style.pointerEvents = (solo || mode === 'practice') ? 'none' : 'auto';
    window.CHARACTERS.forEach(function (ch) {
      var d = document.createElement('div');
      d.className = 'char-card' + (selected.indexOf(ch.id) !== -1 ? ' selected' : '');
      d.innerHTML = cardHTML(ch);
      d.onclick = function () { window.AudioSys.unlock(); window.AudioSys.click(); toggleSelect(ch.id); };
      d.onmouseenter = function () { preview(ch.id); };
      grid.appendChild(d);
    });
    updateSelectInfo();
    preview(selected[0] || (window.CHARACTERS[0] && window.CHARACTERS[0].id));
  }
  function toggleSelect(id) {
    var need = needCount(), ix = selected.indexOf(id);
    if (ix !== -1) selected.splice(ix, 1);
    else { if (selected.length >= need) selected.shift(); selected.push(id); }
    renderSelect();
  }
  function preview(id) {
    var ch = window.getCharacter(id); if (!ch) return;
    document.getElementById('preview-name').textContent = ch.name;
    document.getElementById('preview-desc').textContent = ch.desc;
    document.getElementById('preview-stats').innerHTML =
      statBar('Speed', ch.speed) + statBar('Power', ch.power) + statBar('Defense', ch.defense) + statBar('Agil', ch.agility);
    try { window.drawPreview(document.getElementById('preview-canvas'), ch); } catch (e) {}
  }
  function updateSelectInfo() {
    var need = needCount();
    document.getElementById('select-info').textContent = 'Terpilih ' + selected.length + '/' + need +
      (selected.length < need ? ' — klik karakter.' : ' — siap! Atur nama lalu Mulai.');
    document.getElementById('btn-start-match').disabled = selected.length !== need;
  }
  function pickRandom(excludeIds, n) {
    var pool = window.CHARACTERS.filter(function (c) { return excludeIds.indexOf(c.id) === -1; });
    if (pool.length < n) pool = window.CHARACTERS.slice();
    var out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function startMatch() {
    var need = needCount();
    if (selected.length !== need) return;
    var n1 = (document.getElementById('name-p1').value || 'Player 1').trim().slice(0, 12) || 'Player 1';
    var n2 = (document.getElementById('name-p2').value || 'Player 2').trim().slice(0, 12) || 'Player 2';
    var teamA, teamB;
    if (mode === 'practice') {
      teamA = [{ charData: window.getCharacter(selected[0]), name: n1 }];
      teamB = [];
    } else if (mode === 'single') {
      teamA = [{ charData: window.getCharacter(selected[0]), name: n1 }];
      var f = pickRandom(selected, 1)[0];
      teamB = [{ charData: f, name: 'CPU ' + f.name }];
    } else if (mode === 'single2p') {
      teamA = [{ charData: window.getCharacter(selected[0]), name: n1 + ' (P1)' }];
      teamB = [{ charData: window.getCharacter(selected[1]), name: n2 + ' (P2)' }];
    } else if (mode === 'double') {
      teamA = [{ charData: window.getCharacter(selected[0]), name: n1 }, { charData: window.getCharacter(selected[1]), name: n1 + ' Jr' }];
      var foes = pickRandom(selected, 2);
      teamB = foes.map(function (ch) { return { charData: ch, name: 'CPU ' + ch.name }; });
    } else {
      var pPartner = pickRandom(selected, 1)[0];
      var qPartner = pickRandom(selected.concat([pPartner.id]), 1)[0];
      teamA = [{ charData: window.getCharacter(selected[0]), name: n1 + ' (P1)' }, { charData: pPartner, name: n1 + ' AI' }];
      teamB = [{ charData: window.getCharacter(selected[1]), name: n2 + ' (P2)' }, { charData: qPartner, name: n2 + ' AI' }];
    }
    window.AudioSys.unlock(); window.AudioSys.click();
    show('screen-match');
    window.Game.startMatch({ mode: mode, difficulty: difficulty, bestOf: window.Settings.bestOf, teamA: teamA, teamB: teamB });
  }
  // ---- ONLINE ROOM (P2P) ----
  var onHostChar = null, onGuestChar = null;
  function miniGrid(elId, current, onPick) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    window.CHARACTERS.forEach(function (ch) {
      var d = document.createElement('div');
      d.className = 'char-card' + (current === ch.id ? ' selected' : '');
      d.innerHTML = '<div class="dot" style="background:' + ch.color + ';border:3px solid ' + ch.trim + '"></div><div class="cname">' + ch.name + '</div>';
      d.onclick = function () { window.AudioSys.click(); onPick(ch.id); miniGrid(elId, ch.id, onPick); };
      el.appendChild(d);
    });
  }
  function openOnline() {
    if (!window.CHARACTERS.length) return;
    if (!onHostChar) onHostChar = window.CHARACTERS[0].id;
    if (!onGuestChar) onGuestChar = window.CHARACTERS[1] ? window.CHARACTERS[1].id : window.CHARACTERS[0].id;
    miniGrid('on-char-host', onHostChar, function (id) { onHostChar = id; });
    miniGrid('on-char-guest', onGuestChar, function (id) { onGuestChar = id; });
    document.getElementById('on-code-box').classList.add('hidden');
    document.getElementById('on-status-host').textContent = '';
    document.getElementById('on-status-guest').textContent = '';
    show('screen-online');
  }
  function bindOnline() {
    var bc = document.getElementById('btn-on-create');
    if (bc) bc.onclick = function () {
      window.AudioSys.click();
      if (typeof window.Peer === 'undefined') { document.getElementById('on-status-host').textContent = 'PeerJS belum termuat (butuh internet). Refresh.'; return; }
      var name = (document.getElementById('on-name-host').value || 'P1').trim().slice(0, 12) || 'P1';
      document.getElementById('on-code-box').classList.remove('hidden');
      document.getElementById('on-status-host').textContent = 'Membuat kode...';
      window.Net.on({
        code: function (c) { document.getElementById('on-code').textContent = c; },
        waiting: function () { document.getElementById('on-status-host').textContent = 'Share kode ke P2, menunggu...'; },
        hello: function (g) {
          // P2 datang → mulai match sebagai host
          var hostChar = window.getCharacter(onHostChar);
          var guestChar = window.getCharacter((g && g.charId) || onGuestChar);
          var gName = ((g && g.name) || 'P2').slice(0, 12);
          var teamA = [{ charData: hostChar, name: name + ' (P1)' }];
          var teamB = [{ charData: guestChar, name: gName + ' (P2)' }];
          try { window.Net.send({ t: 'welcome', hostName: name, hostCharId: hostChar.id, guestName: gName, guestCharId: guestChar.id, bestOf: window.Settings.bestOf }); } catch (e) {}
          document.getElementById('on-status-host').textContent = gName + ' gabung! Mulai...';
          setTimeout(function () {
            show('screen-match');
            window.Game.startOnlineHost(teamA, teamB);
          }, 600);
        },
        input: function (d) { try { window.Game.setRemoteInput(d); } catch (e) {} },
        bye: function () {
          try { window.Game.quit(); } catch (e) {}
          openOnline();
          document.getElementById('on-status-host').textContent = 'P2 keluar. Buat kode baru untuk main lagi.';
        },
        error: function (m) { document.getElementById('on-status-host').textContent = m; }
      });
      window.Net.createRoom({ name: name, charId: onHostChar });
    };
    var bx = document.getElementById('btn-on-cancel');
    if (bx) bx.onclick = function () {
      window.AudioSys.click();
      try { window.Net.destroy(); } catch (e) {}
      document.getElementById('on-code-box').classList.add('hidden');
      document.getElementById('on-status-host').textContent = '';
    };
    var bj = document.getElementById('btn-on-join');
    if (bj) bj.onclick = function () {
      window.AudioSys.click();
      if (typeof window.Peer === 'undefined') { document.getElementById('on-status-guest').textContent = 'PeerJS belum termuat (butuh internet). Refresh.'; return; }
      var code = document.getElementById('on-code-in').value;
      var name = (document.getElementById('on-name-guest').value || 'P2').trim().slice(0, 12) || 'P2';
      document.getElementById('on-status-guest').textContent = 'Menghubungkan...';
      window.Net.on({
        joining: function () { document.getElementById('on-status-guest').textContent = 'Tersambung! Menunggu host mulai...'; },
        welcome: function (w) {
          var teamA = [{ charData: window.getCharacter(w.hostCharId), name: (w.hostName || 'P1') + ' (P1)' }];
          var teamB = [{ charData: window.getCharacter(w.guestCharId || onGuestChar), name: (w.guestName || name) + ' (P2)' }];
          show('screen-match');
          window.Game.startOnlineGuest(teamA, teamB);
          try { window.Net.startPing(); } catch (e) {}
        },
        snapshot: function (s) { try { window.Game.applySnapshot(s); } catch (e) {} },
        pause: function (v) { try { window.Game.setPaused(!!v); } catch (e) {} },
        restart: function () { try { window.Game.guestReset(); } catch (e) {} },
        over: function (d) { try { window.Game.showGuestOver(d); } catch (e) {} },
        ping: function (ms) { try { window.Game.setPing(ms); } catch (e) {} },
        bye: function () {
          try { window.Game.quit(); } catch (e) {}
          openOnline();
          document.getElementById('on-status-guest').textContent = 'Host keluar. Minta kode baru.';
        },
        error: function (m) { document.getElementById('on-status-guest').textContent = m; }
      });
      window.Net.joinRoom(code, { name: name, charId: onGuestChar });
    };
  }
  function bind() {
    document.getElementById('btn-play').onclick = function () { window.AudioSys.click(); show('screen-mode'); };
    var bp = document.getElementById('btn-practice');
    if (bp) bp.onclick = function () { window.AudioSys.click(); setMode('practice'); };
    var bl = document.getElementById('btn-leader');
    if (bl) bl.onclick = function () { window.AudioSys.click(); renderLeader(); show('screen-leader'); };
    var cl = document.getElementById('btn-leader-clear');
    if (cl) cl.onclick = function () { try { localStorage.removeItem(window.Store.key); localStorage.removeItem('smash_practice_best'); } catch (e) {} renderLeader(); };
    document.getElementById('btn-chars').onclick = function () { window.AudioSys.click(); renderGallery(); show('screen-gallery'); };
    document.getElementById('btn-how').onclick = function () { window.AudioSys.click(); show('screen-how'); };
    document.getElementById('btn-settings').onclick = function () { window.AudioSys.click(); show('screen-settings'); };
    document.getElementById('btn-mode-single').onclick = function () { window.AudioSys.click(); setMode('single'); };
    var s2 = document.getElementById('btn-mode-single2p');
    if (s2) s2.onclick = function () { window.AudioSys.click(); setMode('single2p'); };
    document.getElementById('btn-mode-double').onclick = function () { window.AudioSys.click(); setMode('double'); };
    var d2 = document.getElementById('btn-mode-double2p');
    if (d2) d2.onclick = function () { window.AudioSys.click(); setMode('double2p'); };
    var pr = document.getElementById('btn-mode-practice');
    if (pr) pr.onclick = function () { window.AudioSys.click(); setMode('practice'); };
    var on = document.getElementById('btn-mode-online');
    if (on) on.onclick = function () { window.AudioSys.click(); openOnline(); };
    bindOnline();
    document.querySelectorAll('.back-btn').forEach(function (b) {
      b.onclick = function () { window.AudioSys.click(); show(b.getAttribute('data-back')); };
    });
    document.querySelectorAll('#diff-seg button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-diff') === difficulty);
      b.onclick = function () {
        document.querySelectorAll('#diff-seg button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); difficulty = b.getAttribute('data-diff');
        window.Settings.difficulty = difficulty; window.saveSettings(); window.AudioSys.click();
      };
    });
    document.getElementById('btn-start-match').onclick = startMatch;
    document.getElementById('btn-pause').onclick = function () { window.AudioSys.click(); window.Game.togglePause(); };
    document.getElementById('btn-pause-top').onclick = function () { window.Game.togglePause(); };
    document.getElementById('btn-resume').onclick = function () { window.AudioSys.click(); window.Game.setPaused(false); };
    document.getElementById('btn-rematch').onclick = function () { window.AudioSys.click(); window.Game.rematch(); };
    document.getElementById('btn-rematch2').onclick = function () { window.AudioSys.click(); window.Game.rematch(); };
    var quit = function () { window.AudioSys.click(); window.Game.quit(); show('screen-home'); };
    document.getElementById('btn-quit').onclick = quit;
    document.getElementById('btn-quit2').onclick = quit;
    document.getElementById('btn-quit-top').onclick = quit;
    var st = document.getElementById('btn-sound-toggle');
    var refreshSnd = function () { st.textContent = window.Settings.sound ? '🔊' : '🔇'; };
    st.onclick = function () { window.Settings.sound = !window.Settings.sound; window.saveSettings(); refreshSnd(); window.AudioSys.click(); };
    refreshSnd();
    var ss = document.getElementById('set-sound'); ss.checked = window.Settings.sound;
    ss.onchange = function () { window.Settings.sound = ss.checked; window.saveSettings(); };
    var mu = document.getElementById('set-music'); mu.checked = window.Settings.music;
    mu.onchange = function () { window.Settings.music = mu.checked; window.saveSettings(); if (!mu.checked) window.AudioSys.stopBgm(); };
    var ws = document.getElementById('set-winscore'); ws.value = String(window.Settings.winScore);
    ws.onchange = function () { window.Settings.winScore = parseInt(ws.value, 10); window.saveSettings(); document.getElementById('how-win').textContent = ws.value; };
    var sd = document.getElementById('set-diff'); sd.value = window.Settings.difficulty;
    sd.onchange = function () { window.Settings.difficulty = sd.value; difficulty = sd.value; window.saveSettings(); };
    var bo = document.getElementById('set-bestof');
    if (bo) { bo.value = String(window.Settings.bestOf); bo.onchange = function () { window.Settings.bestOf = parseInt(bo.value, 10) === 1 ? 1 : 3; window.saveSettings(); }; }
    document.getElementById('how-win').textContent = String(window.Settings.winScore);
    document.addEventListener('pointerdown', function () { window.AudioSys.unlock(); }, { once: true });
  }
  function setMode(m) {
    mode = m; selected = []; difficulty = window.Settings.difficulty || 'normal';
    document.querySelectorAll('#diff-seg button').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-diff') === difficulty);
    });
    if (m === 'practice') document.getElementById('name-p1').value = 'Saya';
    else if (m === 'double' || m === 'double2p') {
      document.getElementById('name-p1').value = m === 'double' ? 'TimKu' : 'P1';
      document.getElementById('name-p2').value = m === 'double' ? 'Partner' : 'P2';
    } else if (m === 'single2p') {
      document.getElementById('name-p1').value = 'P1';
      document.getElementById('name-p2').value = 'P2';
    } else document.getElementById('name-p1').value = 'Player 1';
    renderSelect(); show('screen-select');
  }
  return { show: show, bind: bind, renderGallery: renderGallery, renderLeader: renderLeader };
})();
