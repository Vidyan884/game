// Konfigurasi global + settings + leaderboard storage
window.CONFIG = {
  W: 960, H: 540,
  GROUND_Y: 462,
  NET_X: 480, NET_TOP: 296, NET_W: 8,
  COURT_L: 70, COURT_R: 890,
  GRAVITY: 1500,
  SHUTTLE_GRAV: 1050,
  SHUTTLE_DRAG: 0.35,
  BASE_SPEED: 330,
  BASE_JUMP: 720,
  WIN_SCORE: 21,
  get winScore() { return (window.Settings && window.Settings.winScore) || this.WIN_SCORE; }
};
window.Settings = { sound: true, music: true, winScore: 21, difficulty: 'normal', bestOf: 3 };
try {
  var s = JSON.parse(localStorage.getItem('smash_settings') || '{}');
  if (typeof s.sound === 'boolean') window.Settings.sound = s.sound;
  if (typeof s.music === 'boolean') window.Settings.music = s.music;
  if (s.winScore) window.Settings.winScore = parseInt(s.winScore, 10);
  if (s.difficulty) window.Settings.difficulty = s.difficulty;
  if (s.bestOf) window.Settings.bestOf = parseInt(s.bestOf, 10) === 1 ? 1 : 3;
} catch (e) {}
window.saveSettings = function () {
  try { localStorage.setItem('smash_settings', JSON.stringify(window.Settings)); } catch (e) {}
};
// Leaderboard lokal: menang, game, best rally
window.Store = {
  key: 'smash_leaderboard_v1',
  all: function () {
    try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { return {}; }
  },
  addWin: function (name, stats) {
    try {
      var db = this.all();
      var k = (name || 'Player').slice(0, 12) || 'Player';
      if (!db[k]) db[k] = { wins: 0, matches: 0, bestRally: 0, smash: 0 };
      db[k].matches++;
      if (stats && stats.won) db[k].wins++;
      if (stats && stats.bestRally) db[k].bestRally = Math.max(db[k].bestRally, stats.bestRally);
      if (stats && stats.smash) db[k].smash += stats.smash;
      localStorage.setItem(this.key, JSON.stringify(db));
    } catch (e) {}
  },
  addPractice: function (hits) {
    try {
      var b = parseInt(localStorage.getItem('smash_practice_best') || '0', 10) || 0;
      if (hits > b) localStorage.setItem('smash_practice_best', String(hits));
      return Math.max(b, hits);
    } catch (e) { return hits; }
  },
  practiceBest: function () {
    try { return parseInt(localStorage.getItem('smash_practice_best') || '0', 10) || 0; } catch (e) { return 0; }
  }
};
