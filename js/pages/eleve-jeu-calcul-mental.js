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

let cadranProfil = null;
let cadranMasquerOperation = false;

(async function () {
  cadranProfil = await requireRole('eleve');
  if (!cadranProfil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: cadranProfil.id, badgeHtml: `🟢 ${cadranEchapper(cadranProfil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  try {
    const { data } = await supabaseClient.from('preferences_navigation')
      .select('masquer_operation_jeux').eq('utilisateur_id', cadranProfil.id).maybeSingle();
    cadranMasquerOperation = !!data?.masquer_operation_jeux;
  } catch (e) { cadranMasquerOperation = false; }

  cadranInitJeu();
})();

function cadranEchapper(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function cadranInitJeu() {
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
  const elCadranPage = document.querySelector('.cadran-page');
  const elBtnQuitterFlottant = document.getElementById('cadranBtnQuitterFlottant');
  const elLienRetourEntete = document.querySelector('.cadran-btn-lien-retour');

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
    });
  });

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
  function cadranCloseSummary() { elSummaryModal.classList.remove('active'); }

  // ----- Modes -----
  let currentAppMode = 'dial';

  function cadranSwitchMode(mode) {
    currentAppMode = mode;
    elBtnModeDial.classList.toggle('active', mode === 'dial');
    elBtnModeMental.classList.toggle('active', mode === 'mental');

    document.querySelectorAll('.cadran-dial-only').forEach(el => el.style.display = mode === 'dial' ? '' : 'none');
    document.querySelectorAll('.cadran-mental-only').forEach(el => el.style.display = mode === 'mental' ? '' : 'none');
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

  function cadranSetDifficulty(niveau) {
    document.querySelectorAll('.cadran-diff-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.diff === niveau));
    const reglage = CADRAN_NIVEAUX[niveau];
    if (!reglage) return;
    elTimeSelect.value = reglage.temps;
    elRangeSelect.value = reglage.intervalle;
    elShuffleModeSelect.value = reglage.disposition;
    cadranUpdateDialLayout();
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
        if (currentAppMode === 'dial') cadranRunDialSequence();
        else cadranRunMentalSequence();
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
    const userVal = parseInt(elUserAnswer.value);

    if (userVal === expectedAnswer) {
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
  // "👁️ Revoir". N'a aucun effet sur la logique ci-dessus. -----
  function cadranMasquerAppliquer() {
    if (!cadranMasquerOperation) { elBtnRevoir.hidden = true; return; }
    const cible = currentAppMode === 'dial' ? elDialContainer : elProblemDisplay;
    cible.classList.add('cadran-masque');
    elBtnRevoir.hidden = false;
  }
  function cadranMasquerCacher() {
    elDialContainer.classList.remove('cadran-masque');
    elProblemDisplay.classList.remove('cadran-masque');
    elBtnRevoir.hidden = true;
  }
  elBtnRevoir.addEventListener('click', () => {
    const cible = currentAppMode === 'dial' ? elDialContainer : elProblemDisplay;
    cible.classList.toggle('cadran-masque');
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

  // Niveau de difficulté par défaut : Azɔ̀ví (comme le fichier de référence
  // démarrait sur "Facile").
  cadranSetDifficulty('azovi');
}
