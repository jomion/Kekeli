// Page pages/eleve/jeu-calcul-mental.html — "Cadran opératoire" (douzième
// requête, 11 septembre 2026).
//
// IMPORTANT : ce fichier est un PORT QUASI-VERBATIM du <script> du fichier
// de référence fourni par le porteur du projet ("Cadran opératoire.html"),
// après qu'une première version de cette page s'en soit trop éloignée
// (remplacée par un moteur générique tirant des questions des séances, avec
// un cadran purement décoratif) — corrigé sur signalement explicite :
// "c'est un cadran opératoire avec des fonctionnalités bien définies, tout
// est dans le fichier [...] reproduis-moi exactement tout ce qui est
// dedans". Toute la logique ci-dessous (deux modes Cadran/Problèmes &
// Calculs, calculs et problèmes générés aléatoirement, cadran animé à 13
// positions, chronomètre, bilan avec mascotte dansante/confettis/tableau
// d'erreurs, sons synthétisés) reproduit fidèlement le fichier de référence
// — seuls les identifiants sont préfixés "cadran" pour ne jamais entrer en
// collision avec le reste du site, et les 3 niveaux de difficulté d'origine
// (Facile/Moyen/Difficile) deviennent 4 (Azɔ̀ví/Dèví/Ògán/Axɔ́sú), sur le
// même principe exact (chaque niveau règle le temps, l'intervalle des
// nombres et la disposition du cadran) — voir CADRAN_NIVEAUX ci-dessous.
//
// Seul ajout, additif et sans impact sur le fonctionnement ci-dessus : le
// réglage "masquer l'opération" de la page Paramètres (préférence
// preferences_navigation.masquer_operation_jeux) floute le cadran/l'énoncé
// une fois affiché, avec un bouton "Revoir" pour le faire réapparaître à la
// demande — voir cadranAppliquerMasquage().
//
// Compléments du 24 septembre 2026 (second lot) :
// - Le réglage "masquer l'opération" est désormais RAMENÉ directement dans
//   les Réglages du Cadran (en plus de rester modifiable depuis la page
//   Paramètres générale, dont il partage la même colonne
//   preferences_navigation.masquer_operation_jeux — les deux emplacements
//   restent synchronisés, et les autres jeux qui lisent cette même colonne
//   ne sont pas affectés).
// - Nouveau réglage "afficher ou non le bouton Revoir"
//   (preferences_navigation.cadran_revoir_actif, colonne ajoutée par
//   migration, défaut true = comportement identique à avant) : permet de
//   désactiver la possibilité de faire réapparaître l'opération masquée à
//   la demande, pour un entraînement plus strict de la mémoire.
// - Le niveau de difficulté choisi est maintenant mémorisé
//   (preferences_navigation.cadran_dernier_niveau) et repris automatiquement
//   au prochain lancement du jeu ("garde le niveau où l'enfant était"),
//   au lieu de toujours redémarrer sur Azɔ̀ví.
// - Le cadran/l'écran de jeu (chiffre central, opération affichée, saisie,
//   chronomètre, score) est maintenant réinitialisé en revenant du bilan de
//   fin de série (bouton "Rejouer") au lieu de garder l'état de la toute
//   dernière question posée — voir cadranResetEcranJeu().
//
// Opérations combinées Ògán/Axɔ́sú (24 septembre 2026, troisième lot) :
// signalement "au lieu de maintenir la dernière question posée faut
// réinitialiser le cadran [...] Pour le niveau Ogan et Axosu faut aussi
// ajouter la combinaison avec les autres opérations [...] L'opération peut
// même commencer par les chiffres du bord et toutes les combinaisons sont
// possibles". Clarifications obtenues avant développement : 2 à 3
// opérations enchaînées pour Ògán, 3 à 5 pour Axɔ́sú ; réponses entières ou
// décimales, réglable (preferences_navigation.cadran_reponse_decimale) ;
// récapitulatif texte optionnel en plus des surlignages
// (preferences_navigation.cadran_recap_texte_actif) ; le chiffre central
// n'est parfois pas utilisé du tout (point de départ parfois un chiffre du
// bord). Voir cadranGenererOperationCombinee()/cadranRunDialSequenceCombinee()
// plus bas — n'affecte ni Azɔ̀ví/Dèví (une seule opération, inchangé), ni le
// mode "Problèmes & Calculs".

let cadranProfil = null;
let cadranMasquerOperation = false;
let cadranRevoirActif = true;
let cadranReponseDecimale = false;
let cadranRecapTexteActif = true;

(async function () {
  cadranProfil = await requireRole('eleve');
  if (!cadranProfil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: cadranProfil.id, badgeHtml: `🟢 ${cadranEchapper(cadranProfil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  let cadranNiveauInitial = 'azovi';
  try {
    const { data } = await supabaseClient.from('preferences_navigation')
      .select('masquer_operation_jeux, cadran_revoir_actif, cadran_dernier_niveau, cadran_reponse_decimale, cadran_recap_texte_actif').eq('utilisateur_id', cadranProfil.id).maybeSingle();
    cadranMasquerOperation = !!data?.masquer_operation_jeux;
    cadranRevoirActif = data?.cadran_revoir_actif !== false; // défaut true
    cadranReponseDecimale = !!data?.cadran_reponse_decimale; // défaut false (entier)
    cadranRecapTexteActif = data?.cadran_recap_texte_actif !== false; // défaut true
    if (data?.cadran_dernier_niveau) cadranNiveauInitial = data.cadran_dernier_niveau;
  } catch (e) { cadranMasquerOperation = false; cadranRevoirActif = true; cadranReponseDecimale = false; cadranRecapTexteActif = true; }

  cadranInitJeu(cadranNiveauInitial);
})();

function cadranEchapper(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function cadranInitJeu(cadranNiveauInitial) {
  // ----- Moteur Audio (identique au fichier de référence) -----
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function cadranPlaySound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'select') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.setValueAtTime(100, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'sequenceComplete') {
      // Nouveau son (24 septembre 2026, opérations combinées Ògán/Axɔ́sú) :
      // signale la FIN de l'assemblage d'une opération à plusieurs étapes,
      // pour que l'enfant sache qu'il peut répondre — distinct de 'select'
      // (une seule note, joué à chaque élément qui s'allume PENDANT
      // l'assemblage) et de 'success'/'error' (résultat de la réponse).
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, audioCtx.currentTime);
      osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
      osc.start(); osc.stop(audioCtx.currentTime + 0.28);
    }
  }

  function cadranPlayVictoryTune() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [
      { freq: 523.25, duration: 0.15 }, { freq: 659.25, duration: 0.15 },
      { freq: 783.99, duration: 0.15 }, { freq: 1046.50, duration: 0.3 },
      { freq: 783.99, duration: 0.15 }, { freq: 1046.50, duration: 0.5 }
    ];
    let now = audioCtx.currentTime;
    notes.forEach(note => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(note.freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.duration);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + note.duration);
      now += note.duration + 0.05;
    });
  }

  // ----- Éléments -----
  const elCountdown = document.getElementById('cadranCountdown');
  const elDialContainer = document.getElementById('cadranDialContainer');
  const elCenterDisplay = document.getElementById('cadranCenterDisplay');
  const elOpPlus = document.getElementById('cadranOpPlus');
  const elOpMinus = document.getElementById('cadranOpMinus');
  const elOpMult = document.getElementById('cadranOpMult');
  const elOpDiv = document.getElementById('cadranOpDiv');
  const elProblemDisplay = document.getElementById('cadranProblemDisplay');
  const elTimerBar = document.getElementById('cadranTimerBar');
  const elUserAnswer = document.getElementById('cadranUserAnswer');
  const elValBtn = document.getElementById('cadranValBtn');
  const elFeedback = document.getElementById('cadranFeedback');
  const elBtnStart = document.getElementById('cadranBtnStart');
  const elQuestionCounter = document.getElementById('cadranQuestionCounter');
  const elScoreDisplay = document.getElementById('cadranScoreDisplay');
  const elSettingsModal = document.getElementById('cadranSettingsModal');
  const elBtnSettings = document.getElementById('cadranBtnSettings');
  const elBtnCloseSettings = document.getElementById('cadranBtnCloseSettings');
  const elSeriesSelect = document.getElementById('cadranSeriesSelect');
  const elTimeSelect = document.getElementById('cadranTimeSelect');
  const elCenterSelect = document.getElementById('cadranCenterSelect');
  const elOpSelect = document.getElementById('cadranOpSelect');
  const elTempoSelect = document.getElementById('cadranTempoSelect');
  const elShuffleModeSelect = document.getElementById('cadranShuffleModeSelect');
  const elRangeSelect = document.getElementById('cadranRangeSelect');
  const elMentalTypeSelect = document.getElementById('cadranMentalTypeSelect');
  const elRecapCombinee = document.getElementById('cadranRecapCombinee');
  const elReponseDecimaleToggle = document.getElementById('cadranReponseDecimaleToggle');
  const elRecapToggle = document.getElementById('cadranRecapToggle');
  const elNoteOpCombinee = document.getElementById('cadranNoteOpCombinee');
  const elSummaryModal = document.getElementById('cadranSummaryModal');
  const elBtnRejouer = document.getElementById('cadranBtnRejouer');
  const elDancerContainer = document.getElementById('cadranDancerContainer');
  const elSuccessBadge = document.getElementById('cadranSuccessBadge');
  const elSummaryMessage = document.getElementById('cadranSummaryMessage');
  const elErrorSection = document.getElementById('cadranErrorSection');
  const elErrorTableBody = document.getElementById('cadranErrorTableBody');
  const elBtnModeDial = document.getElementById('cadranBtnModeDial');
  const elBtnModeMental = document.getElementById('cadranBtnModeMental');
  const elBtnRevoir = document.getElementById('cadranBtnRevoir');
  const elMasquerToggle = document.getElementById('cadranMasquerToggle');
  const elRevoirToggle = document.getElementById('cadranRevoirToggle');
  const elRevoirToggleRow = document.getElementById('cadranRevoirToggleRow');
  const elCadranPage = document.querySelector('.cadran-page');
  const elBtnQuitterFlottant = document.getElementById('cadranBtnQuitterFlottant');
  const elLienRetourEntete = document.querySelector('.cadran-btn-lien-retour');
  const elEtatActuel = document.getElementById('cadranEtatActuel');

  // ----- Plein écran forcé sur mobile (session du 12 septembre 2026) -----
  //
  // Signalement : "l'affichage sur mobile ne rend pas le jeu facile à cause
  // du clavier de saisie qui prend une place importante". En plus du
  // passage à 100dvh (voir css/jeu-cadran-operatoire.css, qui réagit déjà
  // à l'ouverture du clavier), le jeu demande désormais le plein écran
  // (API Fullscreen) au lancement d'une série sur mobile : l'en-tête du
  // site disparaît alors complètement, libérant encore plus de hauteur
  // utile. Le bouton flottant "✕" (posé DANS .cadran-page, donc visible
  // même en plein écran) garantit un retour possible à tout moment.
  function cadranEstMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function cadranDemanderPleinEcran() {
    if (!cadranEstMobile() || !elCadranPage) return;
    if (document.fullscreenElement) return;
    const demander = elCadranPage.requestFullscreen
      || elCadranPage.webkitRequestFullscreen
      || elCadranPage.msRequestFullscreen;
    if (typeof demander !== 'function') return;
    // Sans conséquence si refusé/non supporté (Safari iOS ancien, etc.) :
    // le jeu reste pleinement jouable en mode normal, juste sans le
    // supplément de hauteur du plein écran.
    Promise.resolve(demander.call(elCadranPage)).catch(() => {});
  }

  function cadranQuitterPleinEcran() {
    const sortir = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (document.fullscreenElement && typeof sortir === 'function') {
      Promise.resolve(sortir.call(document)).catch(() => {});
    }
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach((evenement) => {
    document.addEventListener(evenement, () => {
      elCadranPage?.classList.toggle('cadran-plein-ecran-actif', !!document.fullscreenElement);
      if (!document.fullscreenElement) {
        // On quitte le plein écran : on retire la mesure manuelle pour
        // revenir immédiatement au comportement CSS normal (100dvh), plutôt
        // que de garder une hauteur figée sur l'ancien état du clavier.
        elCadranPage?.classList.remove('cadran-hauteur-mesuree');
      } else {
        cadranAjusterHauteurClavier();
      }
    });
  });

  // ----- Hauteur réellement visible en plein écran mobile, clavier compris
  // (correctif du 24 septembre 2026, voir le commentaire détaillé dans
  // css/jeu-cadran-operatoire.css) : window.visualViewport, contrairement à
  // 100dvh, réagit de façon fiable à l'ouverture du clavier virtuel MÊME
  // dans un élément en plein écran réel — on l'utilise pour poser la vraie
  // hauteur visible en variable CSS, que la page applique alors en priorité
  // sur 100dvh via .cadran-hauteur-mesuree. Sans effet hors plein écran
  // (déjà correctement géré par 100dvh, voir plus haut) ni sur les
  // navigateurs sans visualViewport (le clavier bascule un peu plus tard,
  // faute d'un signal fiable, mais rien ne casse).
  function cadranAjusterHauteurClavier() {
    if (!window.visualViewport || !document.fullscreenElement || !elCadranPage) return;
    elCadranPage.style.setProperty('--cadran-hauteur-visible', window.visualViewport.height + 'px');
    elCadranPage.classList.add('cadran-hauteur-mesuree');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', cadranAjusterHauteurClavier);
  }

  if (elBtnQuitterFlottant) {
    elBtnQuitterFlottant.addEventListener('click', () => {
      cadranQuitterPleinEcran();
      window.location.href = 'jeux-educatifs.html';
    });
  }
  // Le lien de retour de l'en-tête déclenche déjà sa navigation via son
  // href — on sort simplement du plein écran en plus, par prudence (la
  // plupart des navigateurs le font déjà seuls en quittant la page).
  elLienRetourEntete?.addEventListener('click', () => cadranQuitterPleinEcran());

  function cadranOpenSettings() { elSettingsModal.classList.add('active'); }
  function cadranCloseSettings() { elSettingsModal.classList.remove('active'); }
  function cadranCloseSummary() {
    elSummaryModal.classList.remove('active');
    cadranResetEcranJeu();
  }

  // ----- Réinitialisation de l'écran de jeu (24 septembre 2026, second lot)
  // — signalement : "au lieu de maintenir la dernière question posée faut
  // réinitialiser le cadran". En revenant du bilan de fin de série (bouton
  // "Rejouer"), l'écran gardait jusqu'ici l'état de la toute dernière
  // question (chiffre/opération/nombre surlignés, énoncé, saisie, retour
  // "Bravo !"/"Oups !", barre de temps) jusqu'à ce qu'une nouvelle série
  // soit lancée — cadranCloseSummary() n'appelait jamais la remise à zéro
  // (celle-ci n'existait que dans cadranStartSequence(), déclenchée
  // uniquement au lancement effectif d'une question). Cette fonction remet
  // l'écran dans son état neutre de départ dès la fermeture du bilan. -----
  function cadranResetEcranJeu() {
    clearInterval(timerInterval);
    clearTimeout(cadranMasquageTimeoutId);
    cadranResetDisplay();
    elDialContainer.classList.remove('cadran-masque');
    elProblemDisplay.classList.remove('cadran-masque');
    elProblemDisplay.innerText = 'Prêt pour le défi ?';
    if (elRecapCombinee) { elRecapCombinee.hidden = true; elRecapCombinee.textContent = ''; }
    elBtnRevoir.hidden = true;
    elTimerBar.style.width = '0%';
    elFeedback.innerText = '';
    elUserAnswer.value = '';
    elUserAnswer.disabled = true;
    elValBtn.disabled = true;
    elQuestionCounter.innerText = 'Question : 0/0';
    elScoreDisplay.innerText = 'Score : 0';
  }

  // ----- Rappel du mode/niveau en cours, affiché hors de la fenêtre
  // Réglages (24 septembre 2026 — voir cadran-etat-actuel). -----
  const CADRAN_LIBELLE_MODE = { dial: '🎯 Cadran', mental: '💡 Problèmes & Calculs' };
  const CADRAN_LIBELLE_NIVEAU = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
  let cadranNiveauActuel = 'azovi';
  function cadranMajEtatActuel() {
    if (!elEtatActuel) return;
    elEtatActuel.textContent = `${CADRAN_LIBELLE_MODE[currentAppMode] || ''} · ${CADRAN_LIBELLE_NIVEAU[cadranNiveauActuel] || ''}`;
  }

  // ----- Modes -----
  let currentAppMode = 'dial';

  function cadranSwitchMode(mode) {
    currentAppMode = mode;
    elBtnModeDial.classList.toggle('active', mode === 'dial');
    elBtnModeMental.classList.toggle('active', mode === 'mental');

    document.querySelectorAll('.cadran-dial-only').forEach(el => el.style.display = mode === 'dial' ? '' : 'none');
    document.querySelectorAll('.cadran-mental-only').forEach(el => el.style.display = mode === 'mental' ? '' : 'none');
    cadranMajEtatActuel();
  }

  // ----- Difficulté (Azɔ̀ví/Dèví/Ògán/Axɔ́sú — remplace Facile/Moyen/
  // Difficile du fichier de référence, même principe, un niveau de plus) :
  // chaque niveau règle le temps de réponse, l'intervalle des nombres (mode
  // Problèmes & Calculs) et la disposition du cadran, exactement comme le
  // faisait setDifficulty() dans le fichier d'origine. -----
  const CADRAN_NIVEAUX = {
    azovi: { temps: '12', intervalle: '20', disposition: 'ordered' },
    devi:  { temps: '8',  intervalle: '50', disposition: 'shuffled' },
    ogan:  { temps: '5',  intervalle: '100', disposition: 'shuffleEach' },
    axosu: { temps: '3',  intervalle: '500', disposition: 'shuffleEach' }
  };

  // persister=false lors de l'application du niveau repris au chargement
  // (on vient justement de LE LIRE en base, pas de le modifier) ; true
  // (par défaut) quand l'enfant clique lui-même sur un niveau.
  function cadranSetDifficulty(niveau, persister = true) {
    document.querySelectorAll('.cadran-diff-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.diff === niveau));
    const reglage = CADRAN_NIVEAUX[niveau];
    if (!reglage) return;
    cadranNiveauActuel = niveau;
    elTimeSelect.value = reglage.temps;
    elRangeSelect.value = reglage.intervalle;
    elShuffleModeSelect.value = reglage.disposition;
    cadranUpdateDialLayout();
    cadranMajEtatActuel();
    cadranMajEtatOpCombinee();
    if (persister) cadranPersisterNiveau(niveau);
  }

  // ----- Ògán/Axɔ́sú : l'"Opération Cadran" (Multiplication/Addition/.../
  // Mixte) n'a plus d'effet à ces deux niveaux, l'opération combinée y
  // mélangeant toujours plusieurs opérateurs différents (24 septembre 2026,
  // voir cadranGenererOperationCombinee()) — le sélecteur reste visible
  // (réglage sans lien direct avec le niveau, potentiellement repris si
  // l'enfant revient à Azɔ̀ví/Dèví) mais grisé, avec une note explicative.
  function cadranEstNiveauCombine() {
    return cadranNiveauActuel === 'ogan' || cadranNiveauActuel === 'axosu';
  }
  function cadranMajEtatOpCombinee() {
    const combine = cadranEstNiveauCombine();
    if (elOpSelect) elOpSelect.disabled = combine;
    if (elNoteOpCombinee) elNoteOpCombinee.hidden = !combine;
  }

  // ----- Mémorisation du niveau ("garde le niveau où l'enfant était",
  // 24 septembre 2026) : preferences_navigation.cadran_dernier_niveau, même
  // pattern d'upsert que masquer_operation_jeux/theme_premium. Non bloquant
  // en cas d'échec réseau : le niveau reste appliqué pour la partie en
  // cours, simplement pas mémorisé pour la prochaine visite. -----
  async function cadranPersisterNiveau(niveau) {
    if (!cadranProfil) return;
    try {
      const { error } = await supabaseClient.from('preferences_navigation')
        .upsert({ utilisateur_id: cadranProfil.id, cadran_dernier_niveau: niveau, maj_le: new Date().toISOString() });
      if (error) throw error;
    } catch (e) { /* non bloquant */ }
  }

  // ----- Configuration du cadran -----
  // centerOffset = centre exact du cadran (230px / 2 = 115), et non plus 99 :
  // depuis la correction CSS du 11 septembre 2026 (v2), chaque chiffre est
  // recentré sur son point via transform: translate(-50%,-50%) (voir
  // .cadran-outer-num), donc x/y doivent maintenant viser le vrai centre du
  // cercle plutôt qu'un centre approché compensant l'ancien positionnement
  // par coin haut-gauche.
  const totalNumbers = 13;
  const radius = 95;
  const centerOffset = 115;
  let currentNumbers = Array.from({ length: 13 }, (_, i) => i);

  for (let i = 0; i < totalNumbers; i++) {
    const numDiv = document.createElement('div');
    numDiv.className = 'cadran-outer-num';
    numDiv.id = 'cadran-slot-' + i;
    elDialContainer.appendChild(numDiv);
  }

  function cadranRenderDial(numbersArray) {
    for (let i = 0; i < totalNumbers; i++) {
      const angle = (i * (2 * Math.PI / totalNumbers)) - (Math.PI / 2);
      const x = centerOffset + radius * Math.cos(angle);
      const y = centerOffset + radius * Math.sin(angle);

      const numDiv = document.getElementById('cadran-slot-' + i);
      const val = numbersArray[i];
      numDiv.innerText = val;
      numDiv.setAttribute('data-val', val);
      numDiv.style.left = `${x}px`;
      numDiv.style.top = `${y}px`;
    }
  }

  function cadranShuffleArray(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function cadranUpdateDialLayout() {
    const mode = elShuffleModeSelect.value;
    if (mode === 'ordered') {
      currentNumbers = Array.from({ length: 13 }, (_, i) => i);
    } else {
      currentNumbers = cadranShuffleArray(currentNumbers);
    }
    cadranRenderDial(currentNumbers);
  }

  cadranRenderDial(currentNumbers);

  // ----- Déroulement de la partie (identique au fichier de référence) -----
  let currentTarget = null;
  let currentOp = 'mult';
  let currentQuestionText = '';
  let expectedAnswer = 0;
  let timerInterval = null;
  let totalQuestions = 1;
  let currentQuestionIndex = 0;
  let score = 0;
  let errorHistory = [];

  function cadranResetDisplay() {
    elCenterDisplay.innerText = elCenterSelect.value;
    cadranClearHighlights();
  }

  function cadranClearHighlights() {
    elCenterDisplay.classList.remove('cadran-active');
    [elOpPlus, elOpMinus, elOpMult, elOpDiv].forEach(el => el.classList.remove('cadran-active'));
    document.querySelectorAll('.cadran-outer-num').forEach(el => el.classList.remove('cadran-active'));
  }

  function cadranStartSeries() {
    cadranCloseSummary();
    cadranCloseSettings();
    totalQuestions = parseInt(elSeriesSelect.value);
    currentQuestionIndex = 0;
    score = 0;
    errorHistory = [];
    elScoreDisplay.innerText = `Score : ${score}`;

    if (currentAppMode === 'dial' && elShuffleModeSelect.value === 'shuffled') {
      currentNumbers = cadranShuffleArray(currentNumbers);
      cadranRenderDial(currentNumbers);
    }

    cadranNextInSeries();
  }

  function cadranNextInSeries() {
    if (currentQuestionIndex >= totalQuestions) {
      cadranShowFinalSummary();
      return;
    }
    currentQuestionIndex++;
    elQuestionCounter.innerText = `Question : ${currentQuestionIndex}/${totalQuestions}`;

    if (currentAppMode === 'dial' && elShuffleModeSelect.value === 'shuffleEach') {
      currentNumbers = cadranShuffleArray(currentNumbers);
      cadranRenderDial(currentNumbers);
    }

    cadranStartSequence();
  }

  function cadranStartSequence() {
    cadranClearHighlights();
    cadranMasquerCacher();
    if (elRecapCombinee) { elRecapCombinee.hidden = true; elRecapCombinee.textContent = ''; }
    clearInterval(timerInterval);
    elTimerBar.style.width = '0%';
    elFeedback.innerText = '';
    elUserAnswer.value = '';
    elUserAnswer.disabled = true;
    elValBtn.disabled = true;

    elCountdown.style.visibility = 'visible';
    let count = 3;
    elCountdown.innerText = count;

    let cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        elCountdown.innerText = count;
      } else {
        clearInterval(cdInterval);
        elCountdown.style.visibility = 'hidden';
        if (currentAppMode === 'dial') {
          if (cadranEstNiveauCombine()) cadranRunDialSequenceCombinee();
          else cadranRunDialSequence();
        } else {
          cadranRunMentalSequence();
        }
      }
    }, 1000);
  }

  function cadranRunDialSequence() {
    const tempo = parseInt(elTempoSelect.value);
    const centerVal = parseInt(elCenterDisplay.innerText);

    setTimeout(() => {
      elCenterDisplay.classList.add('cadran-active');
      cadranPlaySound('select');

      setTimeout(() => {
        let selectedOp = elOpSelect.value;
        if (selectedOp === 'mix') {
          const ops = ['plus', 'minus', 'mult', 'div'];
          selectedOp = ops[Math.floor(Math.random() * ops.length)];
        }
        currentOp = selectedOp;

        const opElMap = { plus: elOpPlus, minus: elOpMinus, mult: elOpMult, div: elOpDiv };
        opElMap[currentOp].classList.add('cadran-active');
        cadranPlaySound('select');

        setTimeout(() => {
          currentTarget = Math.floor(Math.random() * 13);
          const targetSlot = Array.from(document.querySelectorAll('.cadran-outer-num')).find(el => parseInt(el.getAttribute('data-val')) === currentTarget);
          if (targetSlot) targetSlot.classList.add('cadran-active');

          cadranPlaySound('select');

          const opSymbolMap = { plus: '+', minus: '-', mult: '×', div: '÷' };
          currentQuestionText = `${centerVal} ${opSymbolMap[currentOp]} ${currentTarget}`;

          if (currentOp === 'plus') expectedAnswer = centerVal + currentTarget;
          else if (currentOp === 'minus') expectedAnswer = centerVal - currentTarget;
          else if (currentOp === 'mult') expectedAnswer = centerVal * currentTarget;
          else if (currentOp === 'div') expectedAnswer = Math.floor(centerVal / (currentTarget || 1));

          elUserAnswer.disabled = false;
          elValBtn.disabled = false;
          elUserAnswer.focus();
          cadranMasquerAppliquer();
          cadranStartTimer();

        }, tempo);
      }, tempo);
    }, tempo);
  }

  // ===== Opérations combinées, niveaux Ògán/Axɔ́sú uniquement (24 septembre
  // 2026, troisième lot) — signalement : "faut aussi ajouter la combinaison
  // avec les autres opérations; par exemple 5 x 4 + 8 ou 5 x 12 ÷ 2 ou
  // 2 + 4 x 5 - 2 ÷ 2 [...] L'opération peut même commencer par les
  // chiffres du bord et toutes les combinaisons sont possibles". Clarifié
  // avec le porteur du projet avant développement : 2 à 3 opérateurs
  // enchaînés pour Ògán, 3 à 5 pour Axɔ́sú ; réponse entière (défaut) ou
  // décimale selon le réglage cadranReponseDecimale ; le chiffre central
  // n'est utilisé que dans environ une question sur deux (l'autre moitié du
  // temps, le point de départ est un chiffre du bord tiré au hasard, comme
  // tous les nombres suivants de la chaîne) ; récapitulatif texte optionnel
  //
  // RÉVISÉ le 24 septembre 2026 (sixième lot), sur signalement direct :
  // "les opérations proposées sont trop complexes et parfois impossible
  // comme les divisions par zéro. Faut proposer 1 à 2 opérations pour ogan
  // et 2 à 3 Axosu". Deux changements : (1) CADRAN_PLAGE_OPERATEURS réduite
  // à 1-2 pour Ògán et 2-3 pour Axɔ́sú (ci-dessous) ; (2) cadranTirerNombre-
  // BordCombinee() exclut désormais 0 (contrairement à cadranTirerNombreBord,
  // qui continue de le renvoyer pour le mode simple Azɔ̀ví/Dèví, inchangé).
  // Le code a été relu en détail sans y trouver de division par un
  // dénominateur littéralement égal à zéro (les diviseurs, en mode entier
  // strict, sont toujours choisis parmi les diviseurs exacts de 1 à 12,
  // jamais 0 ; en mode décimales, une boucle excluait déjà 0 du tirage) —
  // mais un 0 POUVAIT apparaître comme premier nombre ou comme opérande
  // intermédiaire, produisant des étapes dégénérées ("0 × 5", puis
  // "0 ÷ 7 = 0"...) qui ressemblent, pour un enfant, à une opération
  // "impossible" même si le calcul reste mathématiquement valide — c'est très
  // probablement ce qui a été perçu comme des "divisions par zéro". Exclure 0
  // de tous les opérandes du mode combiné supprime ces étapes dégénérées à la
  // racine, en plus de rendre la garantie "jamais de division par zéro"
  // triviale plutôt que simplement déduite du tirage des diviseurs.
  // selon cadranRecapTexteActif ; c'est la fin de l'assemblage complet qui
  // déclenche le chronomètre, avec un son dédié ('sequenceComplete') pour
  // que l'enfant sache que l'opération est terminée. N'affecte ni
  // Azɔ̀ví/Dèví (cadranRunDialSequence ci-dessus, inchangée), ni le mode
  // "Problèmes & Calculs" (cadranRunMentalSequence). =====

  const CADRAN_OP_SYMBOLES = { plus: '+', minus: '-', mult: '×', div: '÷' };
  const CADRAN_PLAGE_OPERATEURS = { ogan: [1, 2], axosu: [2, 3] };

  function cadranTirerNombreBord() {
    return Math.floor(Math.random() * 13); // 0 à 12, comme le mode simple
  }

  // Comme cadranTirerNombreBord(), mais 1 à 12 (jamais 0) — réservée au mode
  // combiné (voir note du 24 septembre 2026, sixième lot, ci-dessus) : évite
  // toute étape dégénérée ("0 × 5", "0 ÷ 7"...) qui pouvait ressembler, pour
  // un enfant, à une opération "impossible". Le mode simple (Azɔ̀ví/Dèví,
  // cadranRunDialSequence) continue d'utiliser cadranTirerNombreBord() et son
  // 0 à 12 d'origine, inchangé.
  function cadranTirerNombreBordCombinee() {
    return Math.floor(Math.random() * 12) + 1; // 1 à 12
  }

  // Évalue une expression à plat (n0 op0 n1 op1 n2 ...) en respectant la
  // priorité mathématique standard (× et ÷ avant + et -) : regroupe en
  // "termes" séparés par + / -, chaque terme étant un enchaînement de × et
  // ÷ évalué de gauche à droite, puis fait la somme algébrique des termes.
  // Reflète exactement la façon dont cadranGenererOperationCombinee()
  // choisit ses diviseurs ci-dessous (même logique de "valeur du terme en
  // cours").
  function cadranEvaluerExpression(nombres, operateurs) {
    let termes = [nombres[0]];
    let signes = [1];
    for (let i = 0; i < operateurs.length; i++) {
      const op = operateurs[i];
      const n = nombres[i + 1];
      if (op === 'mult') termes[termes.length - 1] *= n;
      else if (op === 'div') termes[termes.length - 1] = (n === 0) ? 0 : termes[termes.length - 1] / n;
      else if (op === 'plus') { termes.push(n); signes.push(1); }
      else if (op === 'minus') { termes.push(n); signes.push(-1); }
    }
    return termes.reduce((somme, t, i) => somme + t * signes[i], 0);
  }

  // Construit une opération combinée aléatoire. En mode "entier strict"
  // (cadranReponseDecimale === false, par défaut), chaque division choisit
  // son diviseur parmi les diviseurs exacts (1 à 12) de la valeur du terme
  // en cours à cet instant, pour garantir un résultat final toujours
  // entier ; si aucun diviseur exact n'existe dans 0-12 (cas rare), le "÷"
  // est remplacé par un "+" pour cette étape plutôt que de produire une
  // décimale — jamais de blocage. En mode décimales autorisées, le diviseur
  // est un chiffre du bord quelconque (hors 0, pour éviter une division par
  // zéro).
  function cadranGenererOperationCombinee(niveau) {
    const plageOperateurs = CADRAN_PLAGE_OPERATEURS[niveau] || CADRAN_PLAGE_OPERATEURS.ogan;
    const nbOperateurs = plageOperateurs[Math.floor(Math.random() * plageOperateurs.length)];

    const departBord = Math.random() < 0.5;
    const centerVal = parseInt(elCenterSelect.value);
    // Le chiffre central peut lui-même être réglé sur 0 — dans ce cas précis,
    // on tire quand même un chiffre du bord (1-12) plutôt que de démarrer
    // l'opération à 0 (voir note du 24 septembre 2026, sixième lot).
    const utiliserCentre = !departBord && centerVal !== 0;
    const premierNombre = utiliserCentre ? centerVal : cadranTirerNombreBordCombinee();

    const nombres = [premierNombre];
    const operateurs = [];
    const sourcesNombres = [utiliserCentre ? 'centre' : 'bord'];
    let valeurTermeCourant = premierNombre;

    for (let i = 0; i < nbOperateurs; i++) {
      let op = ['plus', 'minus', 'mult', 'div'][Math.floor(Math.random() * 4)];
      let candidat;

      if (op === 'div') {
        if (!cadranReponseDecimale) {
          const diviseurs = [];
          for (let d = 1; d <= 12; d++) { if (valeurTermeCourant % d === 0) diviseurs.push(d); }
          if (diviseurs.length === 0) { op = 'plus'; candidat = cadranTirerNombreBordCombinee(); }
          else candidat = diviseurs[Math.floor(Math.random() * diviseurs.length)];
        } else {
          candidat = cadranTirerNombreBordCombinee(); // déjà 1-12, jamais 0
        }
      } else {
        candidat = cadranTirerNombreBordCombinee();
      }

      operateurs.push(op);
      nombres.push(candidat);
      sourcesNombres.push('bord');

      if (op === 'mult') valeurTermeCourant *= candidat;
      else if (op === 'div') valeurTermeCourant = (candidat === 0) ? 0 : valeurTermeCourant / candidat;
      else valeurTermeCourant = candidat; // + ou - démarre un nouveau terme
    }

    const brut = cadranEvaluerExpression(nombres, operateurs);
    const expectedAnswerCombinee = cadranReponseDecimale ? Math.round(brut * 10) / 10 : Math.round(brut);

    return { nombres, operateurs, sourcesNombres, expectedAnswerCombinee };
  }

  // Révèle l'opération combinée élément par élément (même cadence "tempo"
  // que le mode simple), surlignages CUMULATIFS (rien ne s'éteint entre
  // deux éléments, contrairement au mode simple qui n'a que 3 éléments à
  // montrer) pour que l'enfant voie l'opération se construire
  // progressivement sur le cadran. Le récapitulatif texte (si activé) se
  // construit en parallèle. Le chronomètre ne démarre qu'une fois TOUS les
  // éléments révélés (son 'sequenceComplete' dédié à cet instant précis).
  function cadranRunDialSequenceCombinee() {
    const tempo = parseInt(elTempoSelect.value);
    const { nombres, operateurs, sourcesNombres, expectedAnswerCombinee } = cadranGenererOperationCombinee(cadranNiveauActuel);
    const opElMap = { plus: elOpPlus, minus: elOpMinus, mult: elOpMult, div: elOpDiv };

    expectedAnswer = expectedAnswerCombinee;
    currentQuestionText = '';

    const afficherRecap = cadranRecapTexteActif;
    if (elRecapCombinee) {
      elRecapCombinee.hidden = !afficherRecap;
      elRecapCombinee.textContent = '';
    }

    const etapes = [{ type: 'nombre', index: 0 }];
    for (let i = 0; i < operateurs.length; i++) {
      etapes.push({ type: 'operateur', index: i });
      etapes.push({ type: 'nombre', index: i + 1 });
    }

    function jouerEtape(pos) {
      if (pos >= etapes.length) {
        cadranPlaySound('sequenceComplete');
        elUserAnswer.disabled = false;
        elValBtn.disabled = false;
        elUserAnswer.focus();
        cadranMasquerAppliquer();
        cadranStartTimer();
        return;
      }

      setTimeout(() => {
        const etape = etapes[pos];
        if (etape.type === 'nombre') {
          const valeur = nombres[etape.index];
          if (sourcesNombres[etape.index] === 'centre') {
            elCenterDisplay.classList.add('cadran-active');
          } else {
            const slot = Array.from(document.querySelectorAll('.cadran-outer-num')).find(el => parseInt(el.getAttribute('data-val')) === valeur);
            if (slot) slot.classList.add('cadran-active');
          }
          currentQuestionText += (currentQuestionText ? ' ' : '') + valeur;
        } else {
          opElMap[operateurs[etape.index]].classList.add('cadran-active');
          currentQuestionText += ' ' + CADRAN_OP_SYMBOLES[operateurs[etape.index]];
        }
        cadranPlaySound('select');
        if (afficherRecap && elRecapCombinee) elRecapCombinee.textContent = currentQuestionText;

        jouerEtape(pos + 1);
      }, tempo);
    }

    jouerEtape(0);
  }

  function cadranRunMentalSequence() {
    const maxVal = parseInt(elRangeSelect.value);
    const type = elMentalTypeSelect.value;
    let isProblem = (type === 'problem') || (type === 'mix' && Math.random() > 0.5);

    if (isProblem) {
      const n1 = Math.floor(Math.random() * (maxVal / 2)) + 5;
      const n2 = Math.floor(Math.random() * (maxVal / 4)) + 2;
      const templates = [
        { q: `Léa a ${n1} bonbons. Elle en donne ${n2} à son frère. Combien lui en reste-t-il ?`, a: n1 - n2 },
        { q: `Un bus transporte ${n1} passagers. ${n2} personnes montent. Combien sont-ils ?`, a: n1 + n2 },
        { q: `Paul a ${n2} paquets de ${Math.min(n1, 10)} gâteaux. Combien de gâteaux au total ?`, a: n2 * Math.min(n1, 10) }
      ];
      const chosen = templates[Math.floor(Math.random() * templates.length)];
      currentQuestionText = chosen.q;
      expectedAnswer = chosen.a;
    } else {
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let n1 = Math.floor(Math.random() * maxVal);
      let n2 = Math.floor(Math.random() * (maxVal / 2)) + 1;

      if (op === '-') {
        if (n1 < n2) [n1, n2] = [n2, n1];
        expectedAnswer = n1 - n2;
        currentQuestionText = `${n1} - ${n2} = ?`;
      } else if (op === '+') {
        expectedAnswer = n1 + n2;
        currentQuestionText = `${n1} + ${n2} = ?`;
      } else {
        n1 = Math.floor(Math.random() * 10);
        n2 = Math.floor(Math.random() * 10);
        expectedAnswer = n1 * n2;
        currentQuestionText = `${n1} × ${n2} = ?`;
      }
    }

    elProblemDisplay.innerText = currentQuestionText;
    elUserAnswer.disabled = false;
    elValBtn.disabled = false;
    elUserAnswer.focus();
    cadranMasquerAppliquer();
    cadranStartTimer();
  }

  function cadranStartTimer() {
    const timeLimit = parseInt(elTimeSelect.value);
    let startTime = Date.now();

    timerInterval = setInterval(() => {
      let elapsed = (Date.now() - startTime) / 1000;
      let remaining = Math.max(0, timeLimit - elapsed);
      let percentage = (remaining / timeLimit) * 100;

      elTimerBar.style.width = percentage + '%';

      if (remaining <= 0) {
        clearInterval(timerInterval);
        cadranPlaySound('error');
        elFeedback.innerHTML = `<span style="color:var(--cadran-neon-red)">Temps écoulé !</span>`;
        errorHistory.push({ question: currentQuestionText, userAns: "Temps écoulé", correctAns: expectedAnswer });
        elUserAnswer.disabled = true;
        elValBtn.disabled = true;
        setTimeout(cadranNextInSeries, 1500);
      }
    }, 100);
  }

  function cadranValidateAnswer() {
    clearInterval(timerInterval);
    // parseFloat + comparaison à tolérance (24 septembre 2026, opérations
    // combinées) au lieu d'un simple parseInt/===, pour accepter une
    // réponse décimale (ex. "3.5") quand cadranReponseDecimale est actif ;
    // sans effet sur le mode simple (réponse toujours entière, une
    // tolérance de 0.05 exige toujours une saisie exacte).
    const userVal = parseFloat(elUserAnswer.value);

    if (!isNaN(userVal) && Math.abs(userVal - expectedAnswer) < 0.05) {
      score++;
      cadranPlaySound('success');
      elFeedback.innerHTML = `<span style="color:var(--cadran-neon-green)">Bravo !</span>`;
    } else {
      cadranPlaySound('error');
      elFeedback.innerHTML = `<span style="color:var(--cadran-neon-red)">Oups ! Réponse : ${expectedAnswer}</span>`;
      errorHistory.push({ question: currentQuestionText, userAns: isNaN(userVal) ? "Aucune" : userVal, correctAns: expectedAnswer });
    }

    elScoreDisplay.innerText = `Score : ${score}`;
    elUserAnswer.disabled = true;
    elValBtn.disabled = true;
    setTimeout(cadranNextInSeries, 1500);
  }

  function cadranShowFinalSummary() {
    const percentage = Math.round((score / totalQuestions) * 100);
    elErrorTableBody.innerHTML = '';

    if (percentage === 100) {
      elSuccessBadge.style.color = "var(--cadran-neon-green)";
      elSuccessBadge.innerText = `${percentage}% de réussite`;
      elSummaryMessage.innerText = "🏆 PERFECTION ABSOLUE ! Champion !";
      elErrorSection.style.display = "none";
      elDancerContainer.style.display = "block";
      cadranPlayVictoryTune();
      if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      elSuccessBadge.innerText = `${percentage}% de réussite`;
      elSuccessBadge.style.color = percentage >= 50 ? "var(--cadran-gold)" : "var(--cadran-neon-red)";
      elSummaryMessage.innerText = `Score : ${score}/${totalQuestions}. Regarde tes erreurs pour t'améliorer :`;
      elErrorSection.style.display = "block";
      elDancerContainer.style.display = "none";

      errorHistory.forEach(err => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${cadranEchapper(err.question)}</td>
          <td style="color:var(--cadran-neon-red); font-weight:bold;">${cadranEchapper(err.userAns)}</td>
          <td style="color:var(--cadran-neon-green); font-weight:bold;">${cadranEchapper(err.correctAns)}</td>
        `;
        elErrorTableBody.appendChild(tr);
      });
    }

    elSummaryModal.classList.add('active');
  }

  // ----- Réglage additif "masquer l'opération" (Paramètres) : floute la
  // zone de jeu une fois la question affichée, révélée à la demande via
  // "👁️ Revoir". N'a aucun effet sur la logique ci-dessus.
  //
  // Correctif du 24 septembre 2026 (signalement : "l'option masqué [...]
  // est activé juste avant la fin de l'opération. Il faut que le cadran
  // finisse de proposer l'opération avant que le masquage s'active") :
  // cadranMasquerAppliquer() était jusqu'ici appelée à l'instant même où
  // l'opération finit de s'assembler (voir cadranRunDialSequence/
  // cadranRunMentalSequence) — le flou s'appliquait donc AVANT que l'élève
  // ait eu le temps de lire l'opération complète, la masquant en pratique
  // dès son apparition plutôt qu'après. Un court délai de lecture
  // (CADRAN_DELAI_LECTURE_MASQUAGE_MS) est maintenant intercalé entre la fin
  // de l'assemblage (l'opération reste pleinement visible pendant ce délai)
  // et l'application réelle du flou. La saisie et le chronomètre, eux, ne
  // sont volontairement pas retardés (l'élève peut commencer à répondre dès
  // que l'opération est proposée, comme avant). -----
  const CADRAN_DELAI_LECTURE_MASQUAGE_MS = 1200;
  let cadranMasquageTimeoutId = null;
  function cadranMasquerAppliquer() {
    clearTimeout(cadranMasquageTimeoutId);
    if (!cadranMasquerOperation) { elBtnRevoir.hidden = true; return; }
    cadranMasquageTimeoutId = setTimeout(() => {
      const cible = currentAppMode === 'dial' ? elDialContainer : elProblemDisplay;
      cible.classList.add('cadran-masque');
      // Réglage additif "afficher ou non le bouton Revoir" (24 septembre
      // 2026, second lot) : quand désactivé, l'opération reste masquée
      // sans possibilité de la faire réapparaître à la demande.
      elBtnRevoir.hidden = !cadranRevoirActif;
    }, CADRAN_DELAI_LECTURE_MASQUAGE_MS);
  }
  function cadranMasquerCacher() {
    clearTimeout(cadranMasquageTimeoutId);
    elDialContainer.classList.remove('cadran-masque');
    elProblemDisplay.classList.remove('cadran-masque');
    elBtnRevoir.hidden = true;
  }
  elBtnRevoir.addEventListener('click', () => {
    const cible = currentAppMode === 'dial' ? elDialContainer : elProblemDisplay;
    cible.classList.toggle('cadran-masque');
  });

  // ----- Réglage "masquer l'opération" + sous-option "bouton Revoir",
  // ramenés directement dans les Réglages du Cadran (24 septembre 2026,
  // second lot) — mêmes colonnes preferences_navigation que la page
  // Paramètres générale (masquer_operation_jeux) / nouvelle colonne dédiée
  // (cadran_revoir_actif), toujours modifiables aussi depuis Paramètres. -----
  function cadranMajEtatToggleRevoir() {
    if (elRevoirToggle) elRevoirToggle.disabled = !cadranMasquerOperation;
    elRevoirToggleRow?.classList.toggle('cadran-toggle-desactive', !cadranMasquerOperation);
  }
  if (elMasquerToggle) elMasquerToggle.checked = cadranMasquerOperation;
  if (elRevoirToggle) elRevoirToggle.checked = cadranRevoirActif;
  cadranMajEtatToggleRevoir();

  elMasquerToggle?.addEventListener('change', async (e) => {
    const actif = e.target.checked;
    cadranMasquerOperation = actif;
    cadranMajEtatToggleRevoir();
    try {
      const { error } = await supabaseClient.from('preferences_navigation')
        .upsert({ utilisateur_id: cadranProfil.id, masquer_operation_jeux: actif, maj_le: new Date().toISOString() });
      if (error) throw error;
    } catch (err) { /* non bloquant : le réglage reste actif pour cette partie */ }
  });

  elRevoirToggle?.addEventListener('change', async (e) => {
    const actif = e.target.checked;
    cadranRevoirActif = actif;
    if (!actif) elBtnRevoir.hidden = true;
    try {
      const { error } = await supabaseClient.from('preferences_navigation')
        .upsert({ utilisateur_id: cadranProfil.id, cadran_revoir_actif: actif, maj_le: new Date().toISOString() });
      if (error) throw error;
    } catch (err) { /* non bloquant */ }
  });

  // ----- Réglages des opérations combinées (Ògán/Axɔ́sú, 24 septembre 2026,
  // troisième lot) — mêmes colonnes preferences_navigation que ci-dessus. -----
  if (elReponseDecimaleToggle) elReponseDecimaleToggle.checked = cadranReponseDecimale;
  if (elRecapToggle) elRecapToggle.checked = cadranRecapTexteActif;

  elReponseDecimaleToggle?.addEventListener('change', async (e) => {
    const actif = e.target.checked;
    cadranReponseDecimale = actif;
    try {
      const { error } = await supabaseClient.from('preferences_navigation')
        .upsert({ utilisateur_id: cadranProfil.id, cadran_reponse_decimale: actif, maj_le: new Date().toISOString() });
      if (error) throw error;
    } catch (err) { /* non bloquant */ }
  });

  elRecapToggle?.addEventListener('change', async (e) => {
    const actif = e.target.checked;
    cadranRecapTexteActif = actif;
    try {
      const { error } = await supabaseClient.from('preferences_navigation')
        .upsert({ utilisateur_id: cadranProfil.id, cadran_recap_texte_actif: actif, maj_le: new Date().toISOString() });
      if (error) throw error;
    } catch (err) { /* non bloquant */ }
  });

  // ----- Écouteurs -----
  elBtnSettings.addEventListener('click', cadranOpenSettings);
  elBtnCloseSettings.addEventListener('click', cadranCloseSettings);
  elBtnModeDial.addEventListener('click', () => cadranSwitchMode('dial'));
  elBtnModeMental.addEventListener('click', () => cadranSwitchMode('mental'));
  document.querySelectorAll('.cadran-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => cadranSetDifficulty(btn.dataset.diff));
  });
  elCenterSelect.addEventListener('change', cadranResetDisplay);
  elShuffleModeSelect.addEventListener('change', cadranUpdateDialLayout);
  elValBtn.addEventListener('click', cadranValidateAnswer);
  elUserAnswer.addEventListener('keydown', e => { if (e.key === 'Enter') cadranValidateAnswer(); });
  elBtnStart.addEventListener('click', () => { cadranDemanderPleinEcran(); cadranStartSeries(); });
  elBtnRejouer.addEventListener('click', cadranCloseSummary);

  // Niveau de difficulté : celui où l'enfant s'était arrêté la dernière fois
  // (preferences_navigation.cadran_dernier_niveau — "garde le niveau où
  // l'enfant était", 24 septembre 2026), Azɔ̀ví par défaut sinon (comme
  // avant). persister=false : on vient de LIRE ce niveau en base, pas de le
  // modifier.
  cadranSetDifficulty(CADRAN_NIVEAUX[cadranNiveauInitial] ? cadranNiveauInitial : 'azovi', false);
}
