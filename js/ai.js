// AI lawan & partner
window.AIController = function (player, difficulty) {
  this.p = player;
  this.diff = difficulty || 'normal';
  var cfg = {
    easy:   { speed: 0.62, react: 0.45, err: 0.28, smash: 0.08, jump: 0.4 },
    normal: { speed: 0.82, react: 0.28, err: 0.15, smash: 0.20, jump: 0.65 },
    hard:   { speed: 1.0,  react: 0.14, err: 0.06, smash: 0.38, jump: 0.9 }
  };
  this.c = cfg[this.diff] || cfg.normal;
  this.think = 0; this.targetX = player.homeX;
  this.serveTimer = 1 + Math.random();
  this.hitCooldown = 0;
};
window.AIController.prototype.update = function (dt, shuttle, game) {
  var p = this.p, C = window.CONFIG, c = this.c;
  if (this.hitCooldown > 0) this.hitCooldown -= dt;
  // saat jeda poin / ganti sisi / selesai: pulang, jangan kejar kok
  if (game.phase === 'point' || game.phase === 'gamebreak' || game.phase === 'over' || !shuttle) {
    this.targetX = p.homeX;
    this.moveToward(dt, c.speed * 0.6);
    return;
  }
  this.think -= dt;
  var mySide = p.side === 'L' ? -1 : 1;

  // Tentukan target X
  if (game.phase === 'serve') {
    // kembali ke home saat serve
    this.targetX = p.homeX;
    if (game.server && game.server.team === p.team) {
      // saya yang servis -> maju ke titik servis, lalu servis otomatis
      this.targetX = p.side === 'L' ? 330 : 630;
      this.moveToward(dt, c.speed);
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) { this.serveTimer = 1.2 + Math.random(); game.tryServe(p); }
      return;
    }
    this.moveToward(dt, c.speed * 0.8);
    return;
  }

  // Prediksi landing kok sederhana
  var comingToMe = (mySide === -1 && shuttle.vx < 40) || (mySide === 1 && shuttle.vx > -40);
  // bagi zona untuk double (termasuk double2p): role 0 jaga belakang, role 1 jaga depan
  var isDbl = game.mode === 'double' || game.mode === 'double2p';
  var wantX = shuttle.x;
  if (isDbl) {
    var mates = game.players.filter(function (q) { return q.team === p.team; });
    var me = p, other = mates[0] === p ? mates[1] : mates[0];
    if (other) {
      // siapa lebih dekat ke kok, dia yang ambil
      var dMe = Math.abs(shuttle.x - me.x) + Math.abs(shuttle.y - (me.y - 60));
      var dOt = Math.abs(shuttle.x - other.x) + Math.abs(shuttle.y - (other.y - 60));
      var shuttleOnMyTeamSide = (p.team === 0 && shuttle.x < C.NET_X) || (p.team === 1 && shuttle.x > C.NET_X);
      if (shuttleOnMyTeamSide && dOt + 60 < dMe) {
        // mengalah: kembali ke posisi cover
        this.targetX = p.homeX + (p.side === 'L' ? -60 : 60) * (p.role === 1 ? 1 : 0);
        this.moveToward(dt, c.speed * 0.7);
        return;
      }
      if (p.role === 1) {
        // partner depan: jangan terlalu mundur
        if (wantX < C.NET_X - 260 && p.team === 0) wantX = C.NET_X - 260;
        if (wantX > C.NET_X + 260 && p.team === 1) wantX = C.NET_X + 260;
      }
    }
  }

  if (this.think <= 0) {
    this.think = c.react;
    if (comingToMe || Math.abs(shuttle.x - C.NET_X) < 300) this.targetX = wantX + (Math.random() - 0.5) * (c.err * 300);
    else this.targetX = p.homeX + (Math.random() - 0.5) * 60;
    // error acak: kadang salah posisi
    if (Math.random() < c.err * 0.3) this.targetX += (Math.random() - 0.5) * 160;
  }
  // clamp ke sisi sendiri
  if (this.targetX < p.minX()) this.targetX = p.minX();
  if (this.targetX > p.maxX()) this.targetX = p.maxX();
  this.moveToward(dt, c.speed);

  // Lompat jika kok tinggi & di atas kita
  var r = p.racketPos();
  var dx = Math.abs(shuttle.x - r.x);
  if (shuttle.y < r.y - 40 && dx < 90 && p.onGround && Math.random() < c.jump) p.doJump();

  // Pukul jika bisa (cek sisi via p.side agar tahan ganti lapangan)
  if (p.canHit(shuttle) && this.hitCooldown <= 0 && game.phase === 'rally') {
    var onMySide = (p.side === 'L' && shuttle.x < C.NET_X + 25) || (p.side === 'R' && shuttle.x > C.NET_X - 25);
    if (onMySide) {
      if (Math.random() < c.err * 0.35) { this.hitCooldown = 0.35; return; }
      var doSmash = shuttle.y < 300 && Math.random() < c.smash;
      var doDrop = !doSmash && Math.random() < 0.14 && shuttle.y > 240;
      var type = doSmash ? 'smash' : doDrop ? 'drop' : (Math.random() < 0.5 ? 'hit' : 'drive');
      game.hitShuttle(p, type);
      this.hitCooldown = 0.4;
    }
  }
};
window.AIController.prototype.moveToward = function (dt, mul) {
  var p = this.p;
  var dx = this.targetX - p.x;
  if (Math.abs(dx) < 6) { p.vx = 0; if (p.onGround && p.state === 'run') p.setState('idle'); return; }
  var step = Math.sign(dx) * p.moveSpeed * mul * dt;
  // cegah overshoot
  if (Math.abs(step) > Math.abs(dx)) step = dx;
  p.x += step;
  if (p.x < p.minX()) p.x = p.minX();
  if (p.x > p.maxX()) p.x = p.maxX();
  p.dir = step > 0 ? 1 : -1;
  p.runPhase += dt * 12;
  if (p.onGround) p.setState('run');
};
