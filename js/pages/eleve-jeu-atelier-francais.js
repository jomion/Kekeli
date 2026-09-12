// Page pages/eleve/jeu-atelier-francais.html — "L'Atelier du Français"
// (treizième requête, 12 septembre 2026, second lot).
//
// IMPORTANT : ce fichier est un PORT QUASI-VERBATIM du <script> du nouveau
// fichier de référence fourni par le porteur du projet ("atelier_français.html"),
// sur le même principe déjà appliqué au jeu "Cadran opératoire" (voir
// eleve-jeu-calcul-mental.js et la leçon retenue n°13 du document d'état des
// lieux) : reproduction fidèle plutôt qu'intégration au moteur d'arcade
// commun (js/jeux/rendu-questions-jeu.js / moteur-jeu-arcade.js). Toute la
// logique ci-dessous (banque de 30 questions fixes, 6 catégories × 3
// difficultés, sélection catégorie/difficulté, décompte, minuteur,
// validation QCM/texte, bilan avec mascotte dansante/confettis/tableau
// d'erreurs, sons synthétisés) reproduit fidèlement le fichier de référence
// — seuls les identifiants sont préfixés "atelier" pour ne jamais entrer en
// collision avec le reste du site, et les boutons utilisent
// addEventListener plutôt que des attributs onclick inline, conformément à
// la convention déjà en place sur les autres pages du site. Ce jeu ne pioche
// donc plus dans les vraies séances publiées, exactement comme le faisait le
// jeu "Cadran opératoire" après sa propre réécriture fidèle.

let atelierProfil = null;

(async function () {
  atelierProfil = await requireRole('eleve');
  if (!atelierProfil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: atelierProfil.id, badgeHtml: `🟢 ${atelierEchapper(atelierProfil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  atelierInitJeu();
})();

function atelierEchapper(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function atelierInitJeu() {
  // ----- Banque de questions (identique au fichier de référence) -----
  const questionDatabase = [
    // --- CONJUGAISON ---
    { cat: "conjugaison", diff: "easy", type: "qcm", q: "Conjugue le verbe 'être' au présent : 'Nous ... heureux.'", options: ["sommes", "sont", "êtes", "somme"], ans: "sommes" },
    { cat: "conjugaison", diff: "easy", type: "qcm", q: "Quel est le futur simple du verbe 'chanter' avec 'je' ?", options: ["je chantais", "je chanterai", "je chanterais", "je chante"], ans: "je chanterai" },
    { cat: "conjugaison", diff: "medium", type: "qcm", q: "Imparfait de l'indicatif : 'Tu (finir)'", options: ["tu finissais", "tu finiras", "tu finis", "tu finissais"], ans: "tu finissais" },
    { cat: "conjugaison", diff: "medium", type: "input", q: "Écris le participe passé du verbe 'prendre' au féminin singulier :", ans: "prise" },
    { cat: "conjugaison", diff: "hard", type: "qcm", q: "Subjonctif présent : 'Il faut que vous (savoir) la vérité.'", options: ["savez", "sachiez", "saviez", "sachais"], ans: "sachiez" },
    { cat: "conjugaison", diff: "hard", type: "input", q: "Conjugue 'aller' au passé simple à la 3e personne du singulier (il) :", ans: "alla" },

    // --- GRAMMAIRE ---
    { cat: "grammaire", diff: "easy", type: "qcm", q: "Quelle est la nature du mot en majuscule : 'Le chat noir dort' (NOIR) ?", options: ["Nom commun", "Adjectif qualificatif", "Verbe", "Adverbe"], ans: "Adjectif qualificatif" },
    { cat: "grammaire", diff: "easy", type: "qcm", q: "Identifie le sujet dans : 'Dans le jardin, les oiseaux chantent.'", options: ["Dans le jardin", "les oiseaux", "chantent", "jardin"], ans: "les oiseaux" },
    { cat: "grammaire", diff: "medium", type: "qcm", q: "Quel mot est un pronom relatif ?", options: ["que", "mais", "très", "parce que"], ans: "que" },
    { cat: "grammaire", diff: "medium", type: "qcm", q: "Quelle phrase est à la forme passive ?", options: ["Le chat mange la souris.", "La souris est mangée par le chat.", "Le chat a mangé.", "Mange la souris !"], ans: "La souris est mangée par le chat." },
    { cat: "grammaire", diff: "hard", type: "qcm", q: "Quel est le mode du verbe dans : 'Si j'avais su, je serais venu.' ?", options: ["Indicatif", "Subjonctif", "Conditionnel", "Impératif"], ans: "Conditionnel" },

    // --- ORTHOGRAPHE ---
    { cat: "orthographe", diff: "easy", type: "qcm", q: "Choisis la bonne orthographe :", options: ["un appartment", "un appartement", "un apartement", "un appartemant"], ans: "un appartement" },
    { cat: "orthographe", diff: "easy", type: "qcm", q: "Complète : 'Il a mangé ... pomme.'", options: ["une", "un", "ain", "unst"], ans: "une" },
    { cat: "orthographe", diff: "medium", type: "qcm", q: "Quelle phrase ne contient pas de faute d'accord ?", options: ["Les fleurs qu'elle a cueillie sont belles.", "Les fleurs qu'elle a cueillies sont belles.", "Les fleurs qu'elle a cueilli sont belles.", "Les fleurs qu'elle a cueillis sont belles."], ans: "Les fleurs qu'elle a cueillies sont belles." },
    { cat: "orthographe", diff: "medium", type: "input", q: "Écris le pluriel du mot 'un journal' :", ans: "journaux" },
    { cat: "orthographe", diff: "hard", type: "qcm", q: "Quel mot prend deux 'm' ?", options: ["acompte", "recommencer", "apartenir", "efacer"], ans: "recommencer" },
    { cat: "orthographe", diff: "hard", type: "input", q: "Complète par 'ses' ou 'ces' : '... livres sont passionnants.'", ans: "ces" },

    // --- VOCABULAIRE ---
    { cat: "vocabulaire", diff: "easy", type: "qcm", q: "Quel est le synonyme du mot 'rapide' ?", options: ["lent", "vif", "lourd", "faible"], ans: "vif" },
    { cat: "vocabulaire", diff: "easy", type: "qcm", q: "Quel est le contraire (antonyme) du mot 'courageux' ?", options: ["brave", "peureux", "fort", "audacieux"], ans: "peureux" },
    { cat: "vocabulaire", diff: "medium", type: "qcm", q: "Que signifie le préfixe 'hydro-' dans le mot 'hydromassage' ?", options: ["air", "feu", "eau", "terre"], ans: "eau" },
    { cat: "vocabulaire", diff: "medium", type: "input", q: "Trouve un synonyme de 'joyeux' commençant par 'g' :", ans: "gai" },
    { cat: "vocabulaire", diff: "hard", type: "qcm", q: "Quel mot désigne une figure de style par exagération ?", options: ["Une métaphore", "Une hyperbole", "Une litote", "Une anaphore"], ans: "Une hyperbole" },
    { cat: "vocabulaire", diff: "hard", type: "input", q: "Quel est l'antonyme du mot 'ambigu' (synonyme de clair, net) ?", ans: "clair" },

    // --- EXPRESSION ÉCRITE ---
    { cat: "expression", diff: "easy", type: "qcm", q: "Quel connecteur logique indique une opposition ?", options: ["De plus", "Cependant", "Par conséquent", "Ensuite"], ans: "Cependant" },
    { cat: "expression", diff: "easy", type: "qcm", q: "Quel type de texte sert à raconter une histoire imaginaire ou réelle ?", options: ["Un texte argumentatif", "Un texte narratif", "Un texte descriptif", "Un texte prescriptif"], ans: "Un texte narratif" },
    { cat: "expression", diff: "medium", type: "qcm", q: "Quel connecteur logique introduit une cause ?", options: ["Parce que", "Donc", "Mais", "Puis"], ans: "Parce que" },
    { cat: "expression", diff: "medium", type: "qcm", q: "Dans une lettre formelle, comment formule-t-on généralement la formule finale de politesse ?", options: ["Salut !", "Je vous prie d'agréer mes salutations distinguées.", "À plus dans le bus.", "Bisous."], ans: "Je vous prie d'agréer mes salutations distinguées." },
    { cat: "expression", diff: "hard", type: "qcm", q: "Quel terme qualifie un texte qui cherche à convaincre le lecteur en soutenant une thèse ?", options: ["Narratif", "Argumentatif", "Informatif", "Poétique"], ans: "Argumentatif" },
    { cat: "expression", diff: "hard", type: "input", q: "Quel connecteur de transition en 3 lettres exprime une conséquence (synonyme de 'par conséquent') ?", ans: "donc" }
  ];

  // ----- Moteur Audio (identique au fichier de référence) -----
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function atelierPlaySound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.setValueAtTime(100, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
  }

  function atelierPlayVictoryTune() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [
      { freq: 523.25, duration: 0.15 }, { freq: 659.25, duration: 0.15 },
      { freq: 783.99, duration: 0.15 }, { freq: 1046.50, duration: 0.3 }
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
  const elCountdownOverlay = document.getElementById('atelierCountdownOverlay');
  const elBtnSettings = document.getElementById('atelierBtnSettings');
  const elBtnCloseSettings = document.getElementById('atelierBtnCloseSettings');
  const elSettingsModal = document.getElementById('atelierSettingsModal');
  const elSummaryModal = document.getElementById('atelierSummaryModal');
  const elQCatTag = document.getElementById('atelierQCatTag');
  const elQuestionText = document.getElementById('atelierQuestionText');
  const elInteractiveArea = document.getElementById('atelierInteractiveArea');
  const elFeedback = document.getElementById('atelierFeedback');
  const elTimerBar = document.getElementById('atelierTimerBar');
  const elBtnStart = document.getElementById('atelierBtnStart');
  const elQuestionCounter = document.getElementById('atelierQuestionCounter');
  const elScoreDisplay = document.getElementById('atelierScoreDisplay');
  const elSeriesLengthSelect = document.getElementById('atelierSeriesLengthSelect');
  const elTimeLimitSelect = document.getElementById('atelierTimeLimitSelect');
  const elSuccessBadge = document.getElementById('atelierSuccessBadge');
  const elSummaryMessage = document.getElementById('atelierSummaryMessage');
  const elErrorSection = document.getElementById('atelierErrorSection');
  const elErrorTableBody = document.getElementById('atelierErrorTableBody');
  const elDancerContainer = document.getElementById('atelierDancerContainer');
  const elBtnRejouer = document.getElementById('atelierBtnRejouer');

  // ----- États du jeu -----
  let currentCategory = 'all';
  let currentDifficulty = 'easy';
  let activeQuestions = [];
  let currentIndex = 0;
  let score = 0;
  let timerInterval = null;
  let errorHistory = [];
  let currentQuestion = null;

  function setCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.atelier-cat-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === cat));
  }

  function setDifficulty(diff) {
    currentDifficulty = diff;
    document.querySelectorAll('.atelier-diff-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.diff === diff));
  }

  function openSettings() { elSettingsModal.classList.add('active'); }
  function closeSettings() { elSettingsModal.classList.remove('active'); }
  function closeSummary() { elSummaryModal.classList.remove('active'); }

  function shuffleArray(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function startSeries() {
    closeSummary();
    closeSettings();

    // Filtrer les questions
    let filtered = questionDatabase.filter(q => {
      let matchCat = (currentCategory === 'all' || q.cat === currentCategory);
      let matchDiff = (q.diff === currentDifficulty);
      return matchCat && matchDiff;
    });

    // Si pas assez de questions dans ce filtre, élargir à toutes les difficultés de la catégorie
    if (filtered.length < 3) {
      filtered = questionDatabase.filter(q => (currentCategory === 'all' || q.cat === currentCategory));
    }

    activeQuestions = shuffleArray(filtered);
    const maxLen = parseInt(elSeriesLengthSelect.value);
    activeQuestions = activeQuestions.slice(0, maxLen);

    if (activeQuestions.length === 0) {
      activeQuestions = shuffleArray(questionDatabase).slice(0, 5);
    }

    currentIndex = 0;
    score = 0;
    errorHistory = [];
    elScoreDisplay.innerText = `Score : ${score}`;

    nextQuestion();
  }

  function nextQuestion() {
    if (currentIndex >= activeQuestions.length) {
      showFinalSummary();
      return;
    }

    currentQuestion = activeQuestions[currentIndex];
    currentIndex++;
    elQuestionCounter.innerText = `Question : ${currentIndex}/${activeQuestions.length}`;
    elFeedback.innerText = '';

    startCountdownAndRun();
  }

  function startCountdownAndRun() {
    clearInterval(timerInterval);
    elTimerBar.style.width = '0%';

    elCountdownOverlay.style.visibility = 'visible';
    let count = 2;
    elCountdownOverlay.innerText = count;

    let cd = setInterval(() => {
      count--;
      if (count > 0) {
        elCountdownOverlay.innerText = count;
      } else {
        clearInterval(cd);
        elCountdownOverlay.style.visibility = 'hidden';
        displayQuestionContent();
      }
    }, 800);
  }

  function displayQuestionContent() {
    elQCatTag.innerText = currentQuestion.cat.toUpperCase();
    elQuestionText.innerText = currentQuestion.q;

    elInteractiveArea.innerHTML = '';

    if (currentQuestion.type === 'qcm') {
      const grid = document.createElement('div');
      grid.className = 'atelier-options-grid';
      const shuffledOptions = shuffleArray(currentQuestion.options);

      shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'atelier-option-btn';
        btn.innerText = opt;
        btn.addEventListener('click', () => validateQCM(opt, btn));
        grid.appendChild(btn);
      });
      elInteractiveArea.appendChild(grid);
    } else {
      const area = document.createElement('div');
      area.className = 'atelier-input-answer-area';
      area.innerHTML = `
        <div class="atelier-input-row">
          <input type="text" id="atelierUserInputText" placeholder="Ta réponse...">
          <button type="button" class="atelier-btn-validate" id="atelierBtnValidateText">OK</button>
        </div>
      `;
      elInteractiveArea.appendChild(area);
      const inputField = document.getElementById('atelierUserInputText');
      inputField.addEventListener('keydown', e => { if (e.key === 'Enter') validateInputText(); });
      document.getElementById('atelierBtnValidateText').addEventListener('click', validateInputText);
      inputField.focus();
    }

    startTimer();
  }

  function startTimer() {
    const timeLimit = parseInt(elTimeLimitSelect.value);
    let startTime = Date.now();

    timerInterval = setInterval(() => {
      let elapsed = (Date.now() - startTime) / 1000;
      let remaining = Math.max(0, timeLimit - elapsed);
      let percentage = (remaining / timeLimit) * 100;

      elTimerBar.style.width = percentage + '%';

      if (remaining <= 0) {
        clearInterval(timerInterval);
        atelierPlaySound('error');
        elFeedback.innerHTML = `<span style="color:var(--atelier-neon-red)">Temps écoulé ! Réponse : ${currentQuestion.ans}</span>`;
        errorHistory.push({ question: currentQuestion.q, userAns: "Temps écoulé", correctAns: currentQuestion.ans });
        disableAllInputs();
        setTimeout(nextQuestion, 1800);
      }
    }, 100);
  }

  function disableAllInputs() {
    document.querySelectorAll('.atelier-option-btn').forEach(b => b.disabled = true);
    const inputField = document.getElementById('atelierUserInputText');
    if (inputField) inputField.disabled = true;
  }

  function validateQCM(selectedOpt, btnElement) {
    clearInterval(timerInterval);
    disableAllInputs();

    const isCorrect = (selectedOpt === currentQuestion.ans);
    if (isCorrect) {
      score++;
      atelierPlaySound('success');
      btnElement.classList.add('correct');
      elFeedback.innerHTML = `<span style="color:var(--atelier-neon-green)">Parfait !</span>`;
    } else {
      atelierPlaySound('error');
      btnElement.classList.add('incorrect');
      // Mettre en valeur la bonne réponse
      document.querySelectorAll('.atelier-option-btn').forEach(b => {
        if (b.innerText === currentQuestion.ans) b.classList.add('correct');
      });
      elFeedback.innerHTML = `<span style="color:var(--atelier-neon-red)">Oups ! C'était : ${currentQuestion.ans}</span>`;
      errorHistory.push({ question: currentQuestion.q, userAns: selectedOpt, correctAns: currentQuestion.ans });
    }

    elScoreDisplay.innerText = `Score : ${score}`;
    setTimeout(nextQuestion, 1800);
  }

  function validateInputText() {
    clearInterval(timerInterval);
    const inputField = document.getElementById('atelierUserInputText');
    if (!inputField || inputField.disabled) return;

    const userVal = inputField.value.trim().toLowerCase();
    const correctVal = currentQuestion.ans.trim().toLowerCase();
    disableAllInputs();

    const isCorrect = (userVal === correctVal);
    if (isCorrect) {
      score++;
      atelierPlaySound('success');
      elFeedback.innerHTML = `<span style="color:var(--atelier-neon-green)">Brillant !</span>`;
    } else {
      atelierPlaySound('error');
      elFeedback.innerHTML = `<span style="color:var(--atelier-neon-red)">Raté ! C'était : ${currentQuestion.ans}</span>`;
      errorHistory.push({ question: currentQuestion.q, userAns: inputField.value || "Vide", correctAns: currentQuestion.ans });
    }

    elScoreDisplay.innerText = `Score : ${score}`;
    setTimeout(nextQuestion, 1800);
  }

  function showFinalSummary() {
    const percentage = Math.round((score / activeQuestions.length) * 100);

    elSuccessBadge.innerText = `${percentage}% de réussite`;
    elErrorTableBody.innerHTML = '';

    if (percentage === 100) {
      elSuccessBadge.style.color = "var(--atelier-neon-green)";
      elSummaryMessage.innerText = "🏆 MAÎTRE DE LA LANGUE FRANÇAISE ! Félicitations !";
      elErrorSection.style.display = "none";
      elDancerContainer.style.display = "block";
      atelierPlayVictoryTune();
      if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      elSuccessBadge.style.color = percentage >= 50 ? "var(--atelier-gold)" : "var(--atelier-neon-red)";
      elSummaryMessage.innerText = `Score : ${score}/${activeQuestions.length}. Analyse tes erreurs pour progresser :`;
      elErrorSection.style.display = "block";
      elDancerContainer.style.display = "none";

      errorHistory.forEach(err => {
        const tr = document.createElement('tr');
        const tdQ = document.createElement('td'); tdQ.textContent = err.question;
        const tdU = document.createElement('td'); tdU.style.color = 'var(--atelier-neon-red)'; tdU.style.fontWeight = 'bold'; tdU.textContent = err.userAns;
        const tdC = document.createElement('td'); tdC.style.color = 'var(--atelier-neon-green)'; tdC.style.fontWeight = 'bold'; tdC.textContent = err.correctAns;
        tr.appendChild(tdQ); tr.appendChild(tdU); tr.appendChild(tdC);
        elErrorTableBody.appendChild(tr);
      });
    }

    elSummaryModal.classList.add('active');
  }

  // ----- Câblage des événements -----
  document.querySelectorAll('.atelier-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.cat));
  });
  document.querySelectorAll('.atelier-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
  });
  elBtnSettings.addEventListener('click', openSettings);
  elBtnCloseSettings.addEventListener('click', closeSettings);
  elBtnStart.addEventListener('click', startSeries);
  elBtnRejouer.addEventListener('click', closeSummary);
}
