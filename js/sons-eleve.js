// Sons de retour élève (lot "Activité et Paliers / Badges", 11 septembre
// 2026) — sons synthétisés en direct via l'API Web Audio (aucun fichier
// audio à héberger), pensés comme des PLACEHOLDERS simples : la structure
// (jouerSonReussite/jouerSonEchec/jouerSonPalier, toutes déclenchées aux
// bons endroits dans js/pages/eleve-seance.js) est en place pour qu'on
// puisse remplacer facilement leur contenu par de vrais fichiers audio plus
// tard (il suffira de changer le corps de ces 3 fonctions, aucun appelant à
// toucher).
//
// Un seul AudioContext partagé, créé au premier son (les navigateurs
// interdisent de démarrer l'audio avant une interaction utilisateur — ce qui
// tombe bien puisque ces sons sont toujours déclenchés par un clic élève).
// Toute erreur (contexte audio indisponible, navigateur qui bloque l'audio)
// est silencieusement ignorée : un son manqué ne doit jamais empêcher la
// correction de s'afficher.

let _contexteAudioEleve = null;
function _obtenirContexteAudioEleve() {
  try {
    if (!_contexteAudioEleve) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      _contexteAudioEleve = new Ctx();
    }
    if (_contexteAudioEleve.state === 'suspended') _contexteAudioEleve.resume();
    return _contexteAudioEleve;
  } catch (_e) { return null; }
}

// Joue une courte suite de notes (fréquences en Hz, durée en secondes) en
// ondes triangulaires douces (plus agréable qu'un carré/sinus pur pour de
// jeunes élèves), avec une petite enveloppe pour éviter les "clics" audio.
function _jouerSequence(notes, volume = 0.15) {
  const ctx = _obtenirContexteAudioEleve();
  if (!ctx) return;
  let t = ctx.currentTime;
  notes.forEach(({ freq, duree }) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + duree);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duree + 0.02);
    } catch (_e) { /* un son raté ne doit jamais bloquer la suite */ }
    t += duree;
  });
}

// Bip de réussite (tâche/question réussie) — deux notes montantes, courtes.
function jouerSonReussite() {
  _jouerSequence([{ freq: 660, duree: 0.11 }, { freq: 880, duree: 0.16 }]);
}

// Bip d'échec (tâche/question non réussie) — une note grave, brève et discrète
// (jamais punitive : juste un signal neutre, pas un buzzer agressif).
function jouerSonEchec() {
  _jouerSequence([{ freq: 220, duree: 0.18 }]);
}

// Petite fanfare de palier réussi — 4 notes montantes.
function jouerSonPalier() {
  _jouerSequence([
    { freq: 523, duree: 0.12 }, { freq: 659, duree: 0.12 },
    { freq: 784, duree: 0.12 }, { freq: 1047, duree: 0.28 },
  ], 0.18);
}
