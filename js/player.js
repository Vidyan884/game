// Entity pemain — support sprite PNG opsional + prosedural fallback + energy smash
// control: 'human' | 'ai'. humanIdx: 1 = P1, 2 = P2 (untuk 2P lokal)
window.Player = function (opts) {
  var C = window.CONFIG;
  this.charData = opts.charData;
  this.name = opts.name || 'Player';
  this.side = opts.side;
  this.control = opts.control || 'human';
  this.humanIdx = opts.humanIdx || 1;
  this.team = opts.team;
  this.role = opts.role || 0;
  var sp = this.charData.speed / 10, pw = this.charData.power / 10,
      ag = this.charData.agility / 10, df = this.charData.defense / 10;
  this.moveSpeed = C.BASE_SPEED * (0.78 + sp * 0.45);
  this.jumpV = C.BASE_JUMP * (0.82 + ag * 0.36);
  this.powerMul = 0.82 + pw * 0.36;
  this.reach = 72 + df * 34;
  this.dir = this.side === 'L' ? 1 : -1;
  if (this.side === 'L') this.homeX = this.role === 0 ? 250 : 380;
  else this.homeX = this.role === 0 ? 710 : 580;
  this.x = this.homeX; this.y = C.GROUND_Y; this.vx = 0; this.vy = 0;
  this.onGround = true;
  this.anim = Math.random() * 5; this.runPhase = 0;
  this.state = 'idle'; this.stateT = 0;
  this.hitCd = 0;
  this.energy = 50; // 0-100, smash butuh >=25
  this.ai = null;
  this.jersey = opts.jersey || (this.role === 0 ? 1 : 2);
  this.sprite = null;
  // coba load sprite opsional assets/char-<id>.png (fallback prosedural bila gagal)
  try {
    if (this.charData.sprite) {
      var img = new Image();
      img.src = this.charData.sprite;
      var self = this;
      img.onload = function () { self.sprite = img; };
    }
  } catch (e) {}
};
window.Player.prototype.minX = function () {
  var C = window.CONFIG;
  return this.side === 'L' ? C.COURT_L : C.NET_X + 14;
};
window.Player.prototype.maxX = function () {
  var C = window.CONFIG;
  return this.side === 'L' ? C.NET_X - 14 : C.COURT_R;
};
window.Player.prototype.racketPos = function () {
  return { x: this.x + this.dir * 52, y: this.y - 92 };
};
// slot: 'p1' | 'p2' | 'any'. allowArrows: true saat single vs AI
window.Player.prototype.updateHuman = function (dt, isActive, slot, allowArrows) {
  var I = window.Input;
  var mv = 0;
  if (isActive) {
    if (slot === 'p2') {
      if (I.p2Left()) mv -= 1;
      if (I.p2Right()) mv += 1;
    } else {
      if (I.p1Left(allowArrows)) mv -= 1;
      if (I.p1Right(allowArrows)) mv += 1;
    }
  }
  this.vx = mv * this.moveSpeed;
  this.x += this.vx * dt;
  if (this.x < this.minX()) this.x = this.minX();
  if (this.x > this.maxX()) this.x = this.maxX();
  if (mv !== 0) { this.dir = mv > 0 ? 1 : -1; this.runPhase += dt * 13; if (this.onGround && this.stateT <= 0) this.setState('run'); }
  else if (this.onGround && this.state === 'run') this.setState('idle');
  if (isActive) {
    var jumped = slot === 'p2' ? I.p2Take('jump') : I.p1Take('jump', allowArrows);
    if (jumped) this.doJump();
  }
  this.anim += dt;
  // regen energy pelan
  this.energy = Math.min(100, this.energy + dt * 6);
  if (this.hitCd > 0) this.hitCd -= dt;
  if (this.stateT > 0) { this.stateT -= dt; if (this.stateT <= 0 && (this.state === 'hit' || this.state === 'smash' || this.state === 'serve')) this.setState(this.onGround ? 'idle' : 'jump'); }
};
window.Player.prototype.doJump = function () {
  if (!this.onGround) return;
  this.vy = -this.jumpV; this.onGround = false;
  this.setState('jump'); window.AudioSys.jump();
};
window.Player.prototype.setState = function (s, dur) { this.state = s; this.stateT = dur || 0; };
window.Player.prototype.applyGravity = function (dt) {
  var C = window.CONFIG;
  if (!this.onGround) {
    this.vy += C.GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y >= C.GROUND_Y) { this.y = C.GROUND_Y; this.vy = 0; this.onGround = true; if (this.state === 'jump') this.state = 'idle'; }
  }
};
window.Player.prototype.canHit = function (shuttle) {
  if (!shuttle || this.hitCd > 0) return false;
  var r = this.racketPos();
  var dx = shuttle.x - r.x, dy = shuttle.y - r.y;
  if (Math.sqrt(dx * dx + dy * dy) > this.reach + 22) return false;
  var C = window.CONFIG;
  if (this.side === 'L' && shuttle.x > C.NET_X + 30) return false;
  if (this.side === 'R' && shuttle.x < C.NET_X - 30) return false;
  if (shuttle.y > C.GROUND_Y + 6) return false;
  return true;
};
window.Player.prototype.addEnergy = function (n) { this.energy = Math.max(0, Math.min(100, this.energy + n)); };
window.Player.prototype.draw = function (ctx) {
  // aura energy penuh
  if (this.energy >= 70) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(this.anim * 6) * 0.1;
    var grd = ctx.createRadialGradient(this.x, this.y - 55, 8, this.x, this.y - 55, 62);
    grd.addColorStop(0, '#ffeb3b'); grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(this.x, this.y - 55, 62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (this.sprite) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(this.sprite, -28, -110, 56, 110);
    ctx.restore();
    this.drawLabel(ctx);
    return;
  }
  var c = this.charData.color, trim = this.charData.trim;
  ctx.save();
  ctx.translate(this.x, this.y);
  var squash = 1;
  if (!this.onGround) squash = 1.03;
  ctx.scale(1, squash);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 4, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  var legSwing = this.state === 'run' ? Math.sin(this.runPhase) * 13 : Math.sin(this.anim * 2) * 1.5;
  var airBend = !this.onGround ? -10 : 0;
  // sepatu + kaki
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-9 + legSwing * 0.6, 0 + airBend); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(9 - legSwing * 0.6, 0 + airBend); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-14 + legSwing * 0.6, -4 + airBend, 11, 5);
  ctx.fillRect(3 - legSwing * 0.6, -4 + airBend, 11, 5);
  // badan jersey
  ctx.strokeStyle = c; ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(0, -74); ctx.lineTo(0, -34); ctx.stroke();
  ctx.fillStyle = trim;
  ctx.fillRect(-7, -70, 14, 6); // strip dada
  // nomor punggung
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(String(this.jersey), -this.dir * 0 + 0, -48);
  // kepala + bandana + bayangan muka
  ctx.fillStyle = '#ffd9b3';
  ctx.beginPath(); ctx.arc(0, -88, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, -92, 12, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-12, -93, 24, 4);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(this.dir * 4.5, -87, 2.1, 0, Math.PI * 2); ctx.fill();
  // lengan + raket
  var armAngle = -0.4 * this.dir, racketAngle = 0.5;
  if (this.state === 'hit') { armAngle = -1.5 * this.dir; racketAngle = -0.9; }
  if (this.state === 'smash') { armAngle = -2.3 * this.dir; racketAngle = -1.7; }
  if (this.state === 'serve') { armAngle = -1.0 * this.dir; racketAngle = -0.4; }
  if (this.state === 'jump' && !this.onGround) { armAngle = -1.3 * this.dir; }
  var hx = Math.cos(armAngle) * 22 * this.dir, hy = -63 + Math.sin(armAngle) * 18;
  ctx.strokeStyle = '#ffd9b3'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(hx, hy); ctx.stroke();
  var rx = hx + this.dir * 12, ry = hy - 7;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(hx + 2, hy - 4); ctx.lineTo(hx + 6, hy + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 6, hy - 5); ctx.lineTo(hx + 10, hy + 1); ctx.stroke();
  ctx.fillStyle = (this.charData.trim || '#e53935');
  ctx.beginPath(); ctx.arc(rx, ry, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(racketAngle * this.dir);
  var glow = this.state === 'smash';
  if (glow) { ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 14; }
  // shaft menonjol dari grip ke throat
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * this.dir, -10); ctx.stroke();
  ctx.strokeStyle = (this.charData.trim || '#e53935'); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(20 * this.dir, -10); ctx.lineTo(27 * this.dir, -11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20 * this.dir, -10); ctx.lineTo(25 * this.dir, -18); ctx.stroke();
  // frame oval + senar anyam
  ctx.save(); ctx.translate(40 * this.dir, -22); ctx.rotate(racketAngle * this.dir * 0.4);
  ctx.lineWidth = 5; ctx.strokeStyle = (this.charData.trim || '#e53935');
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 19, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(0, 0, 11.5, 16.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, 11.5, 16.5, 0, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 0.9;
  for (var si = -10; si <= 10; si += 3) { ctx.beginPath(); ctx.moveTo(si, -17); ctx.lineTo(si, 17); ctx.stroke(); }
  for (var sj = -15; sj <= 15; sj += 3) { ctx.beginPath(); ctx.moveTo(-12, sj); ctx.lineTo(12, sj); ctx.stroke(); }
  ctx.fillStyle = this.state === 'smash' ? 'rgba(255,235,59,.9)' : 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.arc(0, 2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 19, 0, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  ctx.fillStyle = '#212121';
  ctx.beginPath(); ctx.arc(0, 16.5, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.restore();
  this.drawLabel(ctx);
};
window.Player.prototype.drawLabel = function (ctx) {
  var x = this.x, y = this.y;
  ctx.save();
  ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
  var w = ctx.measureText(this.name).width;
  // bedakan P1/P2 manusia
  var tag = this.control === 'human' ? (this.humanIdx === 2 ? ' [P2]' : ' [P1]') : '';
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x - w / 2 - 6, y - 126, w + 12, 16);
  ctx.fillStyle = this.control === 'human' ? '#ffeb3b' : '#fff';
  ctx.fillText(this.name + tag, x, y - 114);
  // energy bar smash
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(x - 22, y - 108, 44, 5);
  var pct = this.energy / 100;
  ctx.fillStyle = pct >= 0.25 ? (pct > 0.7 ? '#00e676' : '#ffb300') : '#e53935';
  ctx.fillRect(x - 22, y - 108, 44 * pct, 5);
  ctx.restore();
};
window.drawPreview = function (canvas, charData) {
  try {
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var p = new window.Player({ charData: charData, name: charData.name, side: 'L', team: 0 });
    p.x = 110; p.y = 190; p.dir = 1; p.state = 'idle'; p.energy = 80;
    p.draw(ctx);
  } catch (e) {}
};
