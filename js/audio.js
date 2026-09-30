// Audio sintetis via WebAudio — tanpa file eksternal
window.AudioSys = (function () {
  var ctx = null, bgmTimer = null, bgmStep = 0;
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!window.Settings.sound) return;
    var c = ensure(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    } catch (e) {}
  }
  function noise(dur, vol) {
    if (!window.Settings.sound) return;
    var c = ensure(); if (!c) return;
    try {
      var n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; g.gain.value = vol || 0.25;
      src.connect(g); g.connect(c.destination); src.start();
    } catch (e) {}
  }
  return {
    unlock: function () { ensure(); },
    click: function () { tone(600, 0.07, 'square', 0.08); },
    hit: function () { noise(0.09, 0.3); tone(300, 0.08, 'triangle', 0.12, 180); },
    smash: function () { noise(0.18, 0.4); tone(180, 0.2, 'sawtooth', 0.18, 60); },
    serve: function () { tone(440, 0.1, 'sine', 0.14, 660); },
    score: function () { tone(660, 0.12, 'square', 0.12); setTimeout(function(){ tone(880, 0.15, 'square', 0.12); }, 110); },
    whistle: function () { tone(2200, 0.35, 'sine', 0.12); },
    jump: function () { tone(250, 0.08, 'sine', 0.07, 420); },
    count: function () { tone(880, 0.09, 'square', 0.12); },
    go: function () { tone(880, 0.1, 'square', 0.14); setTimeout(function(){ tone(1320, 0.25, 'square', 0.14); }, 100); },
    cheer: function () {
      if (!window.Settings.sound) return;
      noise(0.7, 0.22);
      tone(523, 0.12, 'square', 0.07); setTimeout(function(){ tone(659, 0.12, 'square', 0.07); }, 90);
      setTimeout(function(){ tone(784, 0.2, 'square', 0.08); }, 180);
    },
    perfect: function () { tone(1200, 0.08, 'sine', 0.1, 1800); },
    startBgm: function () {
      this.stopBgm();
      if (!window.Settings.music) return;
      var c = ensure(); if (!c) return;
      var notes = [262, 294, 330, 392, 440, 392, 330, 294];
      bgmStep = 0;
      bgmTimer = setInterval(function () {
        if (!window.Settings.music) return;
        try {
          var o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = notes[bgmStep % notes.length];
          g.gain.setValueAtTime(0.035, c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
          o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.3);
        } catch (e) {}
        bgmStep++;
      }, 300);
    },
    stopBgm: function () { if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } }
  };
})();
