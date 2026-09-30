// Data karakter. Tambah karakter baru cukup push object baru ke array ini.
// Stat 1-10. speed: gerak, power: kerasnya pukulan, agility: lompatan, defense: jangkauan.
// Opsional: sprite: 'assets/nama.png' (56x110 transparan) untuk ganti gambar prosedural.
window.CHARACTERS = [
  { id: 'bolt',  name: 'Bolt',  color: '#ff5252', trim: '#ffd54f', speed: 8, power: 6, agility: 7, defense: 5, desc: 'Cepat dan lincah, cocok untuk reli cepat.' },
  { id: 'tank',  name: 'Tank',  color: '#40c4ff', trim: '#0d47a1', speed: 5, power: 9, agility: 4, defense: 7, desc: 'Smash keras, gerak lambat tapi mematikan.' },
  { id: 'flash', name: 'Flash', color: '#69f0ae', trim: '#1b5e20', speed: 9, power: 5, agility: 9, defense: 6, desc: 'Pelompat ulung, jago adu depan net.' },
  { id: 'wall',  name: 'Wall',  color: '#ffd740', trim: '#bf360c', speed: 4, power: 6, agility: 5, defense: 10, desc: 'Defense tebal, susah ditembus smash.' },
  { id: 'storm', name: 'Storm', color: '#e040fb', trim: '#4a148c', speed: 7, power: 8, agility: 6, defense: 6, desc: 'Seimbang, smash + speed sama kuat.' },
  { id: 'ninja', name: 'Ninja', color: '#8c9eff', trim: '#212121', speed: 10, power: 4, agility: 8, defense: 5, desc: 'Tercepat, main tipu-tipu.' },
  { id: 'raka',  name: 'Raka',  color: '#ff7043', trim: '#3e2723', speed: 6, power: 7, agility: 7, defense: 7, desc: 'All-round andalan Indonesia.' },
  { id: 'sinta', name: 'Sinta', color: '#f48fb1', trim: '#880e4f', speed: 8, power: 7, agility: 8, defense: 6, desc: 'Lincah + smash menyilang.' }
];
window.getCharacter = function (id) {
  for (var i = 0; i < window.CHARACTERS.length; i++) if (window.CHARACTERS[i].id === id) return window.CHARACTERS[i];
  return window.CHARACTERS[0];
};
