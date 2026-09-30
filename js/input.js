// Input keyboard + touch. P1/P2 lokal + drop-shot.
// P1: A/D, W, F hit, G smash, S/H drop, T serve
// P2: ←/→, ↑, J hit, K smash, ↓ drop, L serve
window.Input = (function () {
  var keys = {};
  var q1 = { hit: 0, smash: 0, jump: 0, serve: 0, drop: 0 };
  var q2 = { hit: 0, smash: 0, jump: 0, serve: 0, drop: 0 };
  var touchHeld = { left: false, right: false };

  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) !== -1 || e.key === ' ') e.preventDefault();
    if (e.repeat) return;
    keys[k] = true;
    if (k === 'f') q1.hit++;
    if (k === 'g') q1.smash++;
    if (k === 'w') q1.jump++;
    if (k === 't' || k === 'r') q1.serve++;
    if (k === 's' || k === 'h' || k === 'v') q1.drop++;
    if (k === 'arrowup') q2.jump++;
    if (k === 'j') q2.hit++;
    if (k === 'k') q2.smash++;
    if (k === 'l' || k === 'enter') q2.serve++;
    if (k === 'arrowdown') q2.drop++;
    if (k === 'j') q1.hit++;
    if (k === 'k') q1.smash++;
    if (k === 'l' || k === 'c' || k === 'enter') q1.serve++;
    if (k === 's' || k === 'arrowdown') q1.serve = q1.serve; // no-op, drop terpisah
    if (k === ' ') { q1.jump++; q2.jump++; }
    if (k === 'p' && window.Game) window.Game.togglePause();
    if (window.AudioSys) window.AudioSys.unlock();
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  function bindTouch() {
    var btns = document.querySelectorAll('#touch-controls button');
    btns.forEach(function (b) {
      var act = b.getAttribute('data-act');
      var start = function (e) {
        e.preventDefault(); window.AudioSys.unlock();
        if (act === 'left') touchHeld.left = true;
        if (act === 'right') touchHeld.right = true;
        if (act === 'hit') { q1.hit++; q2.hit++; }
        if (act === 'smash') { q1.smash++; q2.smash++; }
        if (act === 'drop') { q1.drop++; q2.drop++; }
        if (act === 'jump') { q1.jump++; q2.jump++; }
        if (act === 'serve') { q1.serve++; q2.serve++; }
      };
      var end = function (e) {
        if (e) e.preventDefault();
        if (act === 'left') touchHeld.left = false;
        if (act === 'right') touchHeld.right = false;
      };
      b.addEventListener('touchstart', start, { passive: false });
      b.addEventListener('touchend', end);
      b.addEventListener('touchcancel', end);
      b.addEventListener('mousedown', start);
      b.addEventListener('mouseup', end);
      b.addEventListener('mouseleave', end);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTouch);
  else bindTouch();
  // cegah pull-to-refresh / scroll saat match di HP (menu tetap bisa scroll)
  document.addEventListener('touchmove', function (e) {
    var m = document.getElementById('screen-match');
    if (m && m.classList.contains('active')) e.preventDefault();
  }, { passive: false });

  return {
    left: function () { return !!(keys['a'] || keys['arrowleft'] || touchHeld.left); },
    right: function () { return !!(keys['d'] || keys['arrowright'] || touchHeld.right); },
    take: function (what) {
      var has = (q1[what] > 0 || q2[what] > 0);
      if (has) { q1[what] = 0; q2[what] = 0; return true; }
      return false;
    },
    p1Left: function (allowArrows) { return !!(keys['a'] || touchHeld.left || (allowArrows && keys['arrowleft'])); },
    p1Right: function (allowArrows) { return !!(keys['d'] || touchHeld.right || (allowArrows && keys['arrowright'])); },
    p1Take: function (what, allowAlias) {
      if (q1[what] > 0) { q1[what] = 0; if (allowAlias) q2[what] = 0; return true; }
      if (allowAlias && q2[what] > 0) { q2[what] = 0; return true; }
      return false;
    },
    p2Left: function () { return !!(keys['arrowleft']); },
    p2Right: function () { return !!(keys['arrowright']); },
    p2Take: function (what) { if (q2[what] > 0) { q2[what] = 0; return true; } return false; },
    peekServe: function () { return q1.serve > 0 || q1.hit > 0 || q1.smash > 0 || q2.serve > 0 || q2.hit > 0; },
    clearFrame: function () {},
    _q1: q1, _q2: q2
  };
})();
