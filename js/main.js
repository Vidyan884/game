// Bootstrap
(function () {
  function boot() {
    try {
      window.UI.bind();
      window.Game.init(document.getElementById('gameCanvas'));
      window.UI.show('screen-home');
      console.log('SmashArena ready');
    } catch (e) {
      console.error(e);
      document.body.insertAdjacentHTML('beforeend', '<div style="color:#fff;background:#c00;padding:10px">Gagal init: ' + e.message + '</div>');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
