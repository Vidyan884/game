// Online P2P via PeerJS cloud (gratis, tanpa server sendiri).
// Pola: HOST (P1) autoritatif menjalankan fisika; GUEST (P2) kirim input, terima snapshot.
// Kode room 5 huruf, Peer ID = PREFIX + kode.
window.Net = (function () {
  var PREFIX = 'smasharena-v1-';
  var peer = null, conn = null;
  var role = null; // 'host' | 'guest'
  var code = null;
  var cb = {};
  var pingMs = -1, pingTimer = null, seq = 0;

  function supported() { return typeof window.Peer !== 'undefined'; }
  function makeCode() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function destroy() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conn = null; role = null; code = null;
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    pingMs = -1;
  }
  function on(cbs) { cb = cbs || {}; }
  function emit(name, arg) { try { if (cb[name]) cb[name](arg); } catch (e) { console.error(e); } }
  function send(obj) {
    try { if (conn && conn.open) conn.send(obj); } catch (e) {}
  }
  function wireConn(c, handlers) {
    c.on('data', function (d) {
      if (!d || !d.t) return;
      if (d.t === 'in') emit('input', d);
      else if (d.t === 'snap') emit('snapshot', d);
      else if (d.t === 'hello') emit('hello', d);
      else if (d.t === 'welcome') emit('welcome', d);
      else if (d.t === 'pause') emit('pause', d.v);
      else if (d.t === 'restart') emit('restart', d);
      else if (d.t === 'over') emit('over', d);
      else if (d.t === 'bye') emit('bye', d);
      else if (d.t === 'ping') send({ t: 'pong', t0: d.t0 });
      else if (d.t === 'pong') {
        pingMs = Date.now() - d.t0;
        emit('ping', pingMs);
      }
      if (handlers && handlers[d.t]) { try { handlers[d.t](d); } catch (e) {} }
    });
    c.on('close', function () { emit('bye', {}); });
    c.on('error', function () {});
  }

  // HOST: buat room, tunggu guest. info = {name, charId}
  function createRoom(info) {
    destroy();
    if (!supported()) { emit('error', 'PeerJS gagal dimuat (butuh internet). Refresh halaman.'); return; }
    code = makeCode();
    role = 'host';
    try { peer = new window.Peer(PREFIX + code); } catch (e) { emit('error', 'Gagal init Peer: ' + e.message); return; }
    emit('code', code);
    peer.on('open', function () { emit('waiting', code); });
    peer.on('connection', function (c) {
      if (conn) { try { c.close(); } catch (e) {} return; } // hanya 1 guest
      conn = c;
      wireConn(c);
      c.on('open', function () { /* tunggu hello dari guest */ });
    });
    peer.on('error', function (err) {
      var t = (err && err.type) || '';
      if (t === 'unavailable-id') { code = makeCode(); try { peer = new window.Peer(PREFIX + code); } catch (e) {} emit('code', code); }
      else emit('error', 'Jaringan: ' + t);
    });
  }

  // GUEST: gabung via kode. info = {name, charId}
  function joinRoom(rawCode, info) {
    destroy();
    if (!supported()) { emit('error', 'PeerJS gagal dimuat (butuh internet). Refresh halaman.'); return; }
    code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length !== 5) { emit('error', 'Kode harus 5 karakter.'); return; }
    role = 'guest';
    try { peer = new window.Peer(); } catch (e) { emit('error', 'Gagal init Peer: ' + e.message); return; }
    peer.on('open', function () {
      var c;
      try { c = peer.connect(PREFIX + code, { reliable: true }); } catch (e) { emit('error', 'Gagal connect.'); return; }
      conn = c;
      wireConn(c);
      c.on('open', function () {
        send({ t: 'hello', name: info.name, charId: info.charId });
        emit('joining', code);
      });
    });
    peer.on('error', function (err) {
      var t = (err && err.type) || '';
      if (t === 'peer-unavailable') emit('error', 'Kode tidak ditemukan. Cek kode dari P1.');
      else emit('error', 'Jaringan: ' + t);
    });
  }

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(function () {
      if (role === 'guest') send({ t: 'ping', t0: Date.now() });
    }, 2000);
  }

  return {
    on: on, createRoom: createRoom, joinRoom: joinRoom, destroy: destroy,
    send: send, startPing: startPing,
    get role() { return role; },
    get code() { return code; },
    get ping() { return pingMs; },
    get connected() { return !!(conn && conn.open); }
  };
})();
