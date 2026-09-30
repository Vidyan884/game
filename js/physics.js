// Fisika shuttlecock
window.Physics = {
  stepShuttle: function (s, dt) {
    var C = window.CONFIG;
    s.vy += C.SHUTTLE_GRAV * dt;
    // drag udara (kok melambat horizontal)
    var drag = 1 - C.SHUTTLE_DRAG * dt;
    if (drag < 0.5) drag = 0.5;
    s.vx *= drag;
    // smash jatuh lebih cepat tapi tetap kena drag vertikal dikit
    if (s.smash) s.vy += 600 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.spin += (Math.abs(s.vx) * 0.01 + 4) * dt;
  },
  // Pantulan net sederhana. Return true jika kena net.
  netCollide: function (s) {
    var C = window.CONFIG;
    var inX = Math.abs(s.x - C.NET_X) < (C.NET_W + 6);
    var inY = s.y > C.NET_TOP && s.y < C.GROUND_Y;
    if (inX && inY) {
      // jika datang cepat, kadang lolos (net cord), kadang jatuh
      if (Math.abs(s.vx) > 650 && Math.random() < 0.25) {
        s.vx *= 0.45; s.vy *= 0.6; s.smash = false; return false;
      }
      if (s.x < C.NET_X) s.x = C.NET_X - C.NET_W - 6; else s.x = C.NET_X + C.NET_W + 6;
      s.vx *= -0.18; s.vy *= 0.5; s.smash = false;
      return true;
    }
    // tiang net atas
    if (Math.abs(s.x - C.NET_X) < 10 && Math.abs(s.y - C.NET_TOP) < 8) {
      s.vy = Math.abs(s.vy) * 0.4; s.vx *= 0.4;
      return true;
    }
    return false;
  }
};
