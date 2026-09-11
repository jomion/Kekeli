// Lot "Jeux éducatifs interactifs" (11 septembre 2026, douzième requête).
// Coquille COMMUNE aux 3 jeux d'arcade : écran d'accueil (choix du palier),
// décompte, affichage d'une question à la fois (façon "Atelier du Français" /
// "Cadran opératoire" fournis en référence), barre de temps décorative,
// bilan de fin de ronde avec confettis, réglages. La partie spécifique à
// chaque jeu (matière(s) ciblées, étiquette, cadran cosmétique pour le
// Calcul mental...) est passée en configuration par
// js/pages/eleve-jeu-*.js — voir creerJeuArcade() en bas de fichier.
//
// Dépend de : supabaseClient, RACINE_SITE, js/sons-eleve.js,
// js/jeux/rendu-questions-jeu.js, js/jeux/moteur-jeu-arcade.js — tous chargés
// avant ce fichier sur chaque page de jeu. Le confetti (canvas-confetti,
// même CDN que les fichiers de référence) est chargé par la page HTML.

function creerJeuArcade(config) {
  // config attendu :
  //   champFormationIds: [id,...]  (1 matière, ou 2 pour ES+EST)
  //   dureesParDefautSecondes: 15 (temps par question, cosmétique)
  //   permettreMasquerOperation: bool (Calcul mental uniquement)
  //   etiquetteQuestion(seance): string affichée dans le tag matière
  //   transformerZoneQuestion(zoneEl, q): optionnel, hook visuel (ex: cadran)

  const els = {
    accueil: document.getElementById('jeuAccueil'),
    jeuCorps: document.getElementById('jeuCorps'),
    palierSelector: document.getElementById('jeuPalierSelector'),
    infoAccueil: document.getElementById('jeuInfoAccueil'),
    btnLancer: document.getElementById('jeuBtnLancer'),
    matiereTag: document.getElementById('jeuMatiereTag'),
    questionArea: document.getElementById('jeuQuestionArea'),
    feedback: document.getElementById('jeuFeedback'),
    timerBar: document.getElementById('jeuTimerBar'),
    countdown: document.getElementById('jeuCountdownOverlay'),
    scoreCounter: document.getElementById('jeuScoreCounter'),
    questionCounter: document.getElementById('jeuQuestionCounter'),
    btnSettings: document.getElementById('jeuBtnSettings'),
    settingsModal: document.getElementById('jeuSettingsModal'),
    btnCloseSettings: document.getElementById('jeuBtnCloseSettings'),
    timeSelect: document.getElementById('jeuTimeSelect'),
    summaryModal: document.getElementById('jeuSummaryModal'),
  };

  const etat = {
    profil: null,
    classeId: null,
    palier: null,
    accesCorrection: { autorise: false },
    ronde: null, // { bloc, seance, essaisPrecedents, termine }
    index: 0,
    reponses: {},
    tempsParQuestion: config.dureesParDefautSecondes || 15,
    timerInterval: null,
    scoreDirect: 0, // compteur cosmétique de bonnes réponses de CETTE ronde
    masquerOperation: false,
    operationReveleeIndex: -1, // index de question pour laquelle "Revoir" a été cliqué
  };

  function afficherPalierSelector() {
    els.palierSelector.innerHTML = JEU_PALIERS.map(p => `
      <button type="button" class="jeu-palier-btn" data-palier="${p.code}" style="${etat.palier === p.code ? `background:${p.couleur};border-color:#fff;color:#000` : ''}">
        <span class="jeu-palier-icone">${p.icone}</span>${p.nom}
      </button>`).join('');
    els.palierSelector.querySelectorAll('[data-palier]').forEach(btn => {
      btn.addEventListener('click', () => choisirPalier(btn.dataset.palier));
    });
  }

  async function choisirPalier(code) {
    etat.palier = code;
    afficherPalierSelector();
    els.infoAccueil.textContent = 'Recherche des activités disponibles...';
    els.btnLancer.disabled = true;

    etat.ronde = await jeuTrouverRonde({ eleveId: etat.profil.id, classeId: etat.classeId, champFormationIds: config.champFormationIds, palier: code });

    if (etat.ronde.aucunContenu) {
      const p = JEU_PALIERS.find(x => x.code === code);
      els.infoAccueil.innerHTML = `Aucune activité ${p.nom} disponible pour l'instant dans cette matière — reviens plus tard, ou choisis un autre niveau. 🙂`;
      els.btnLancer.disabled = true;
      return;
    }
    if (!etat.accesCorrection.autorise) {
      els.infoAccueil.innerHTML = `<div class="jeu-verrou-premium">🔒 La correction automatique des exercices est un service premium — tu as utilisé tous tes essais gratuits. Demande à un adulte de contacter l'administration pour souscrire.</div>`;
      els.btnLancer.disabled = true;
      return;
    }
    if (etat.ronde.termine) {
      els.infoAccueil.innerHTML = `🏅 Tu as déjà fait tout ce qui est disponible pour ce niveau dans cette matière — bravo ! Tu peux revoir la correction, ou choisir un autre niveau.`;
      els.btnLancer.textContent = '🔓 Revoir la correction';
      els.btnLancer.disabled = false;
      els.btnLancer.dataset.mode = 'correction';
      return;
    }
    const nbQ = etat.ronde.bloc.contenu.questions.length;
    const nbEssais = etat.ronde.essaisPrecedents.length;
    els.infoAccueil.innerHTML = `📘 ${echapper(etat.ronde.seance?.titre_contenu || etat.ronde.seance?.titre || '')} — ${nbQ} question${nbQ > 1 ? 's' : ''}${nbEssais ? ` (nouvel essai n°${nbEssais + 1})` : ''}`;
    els.btnLancer.textContent = '🚀 Lancer la partie';
    els.btnLancer.disabled = false;
    els.btnLancer.dataset.mode = 'jouer';
  }

  async function lancer() {
    if (els.btnLancer.dataset.mode === 'correction') { await afficherEcranCorrection(); return; }
    if (!etat.ronde || !etat.ronde.bloc) return;
    els.accueil.hidden = true;
    els.jeuCorps.hidden = false;
    etat.index = 0; // on reprend toujours à la 1ère question à chaque nouvel essai (comme le mode progressif de eleve-seance.js)
    etat.reponses = {};
    etat.scoreDirect = 0;
    majScoreBoard();
    await afficherQuestionCourante();
  }

  function questions() { return etat.ronde.bloc.contenu.questions; }

  function majScoreBoard() {
    els.questionCounter.textContent = `Question : ${Math.min(etat.index + 1, questions().length)}/${questions().length}`;
    els.scoreCounter.textContent = `Bonnes réponses : ${etat.scoreDirect}`;
  }

  async function afficherQuestionCourante() {
    clearInterval(etat.timerInterval);
    els.feedback.textContent = '';
    els.feedback.className = 'jeu-feedback';
    els.timerBar.style.width = '0%';
    majScoreBoard();

    // Petit décompte façon "3...2...1" avant chaque question, comme les
    // fichiers de référence.
    els.countdown.style.visibility = 'visible';
    let compte = 2;
    els.countdown.textContent = String(compte);
    await new Promise(resolve => {
      const cd = setInterval(() => {
        compte--;
        if (compte > 0) { els.countdown.textContent = String(compte); }
        else { clearInterval(cd); els.countdown.style.visibility = 'hidden'; resolve(); }
      }, 700);
    });

    const q = questions()[etat.index];
    const masquer = config.permettreMasquerOperation && etat.masquerOperation && etat.operationReveleeIndex !== etat.index;
    let html = jeuRendreChampQuestion(q, etat.index, { masquerNumero: true });
    if (masquer) {
      html = html.replace('<p class="question-enonce">', `<p class="question-enonce jeu-dial-masque" data-enonce-masque="1">`);
      html += `<button type="button" class="jeu-btn-settings" id="jeuBtnRevoirOperation" style="margin-top:6px">👁️ Revoir l'opération</button>`;
    }
    els.questionArea.innerHTML = html;
    jeuAttacherTousEcouteurs(els.questionArea);
    if (typeof config.transformerZoneQuestion === 'function') config.transformerZoneQuestion(els.questionArea, q, etat);

    const btnRevoir = document.getElementById('jeuBtnRevoirOperation');
    if (btnRevoir) btnRevoir.addEventListener('click', () => {
      etat.operationReveleeIndex = etat.index;
      afficherQuestionCourante();
    });

    demarrerTimerDecoratif();

    els.questionArea.insertAdjacentHTML('beforeend', `<button type="button" class="jeu-btn-valider" id="jeuBtnValiderQuestion">✅ Valider cette réponse</button>`);
    document.getElementById('jeuBtnValiderQuestion').addEventListener('click', validerQuestionCourante);
  }

  function demarrerTimerDecoratif() {
    const duree = etat.tempsParQuestion * 1000;
    const debut = Date.now();
    clearInterval(etat.timerInterval);
    etat.timerInterval = setInterval(() => {
      const ecoule = Date.now() - debut;
      const pct = Math.min(100, (ecoule / duree) * 100);
      els.timerBar.style.width = `${pct}%`;
      if (pct >= 100) clearInterval(etat.timerInterval);
    }, 100);
  }

  async function validerQuestionCourante() {
    const q = questions()[etat.index];
    const reponse = jeuLireReponseQuestion(els.questionArea, q);
    const btn = document.getElementById('jeuBtnValiderQuestion');
    btn.disabled = true;
    btn.textContent = 'Vérification...';

    try {
      const data = await jeuValiderTache({ blocId: etat.ronde.bloc.id, questionId: q.id, reponse });
      etat.reponses[q.id] = reponse;
      clearInterval(etat.timerInterval);

      // Les types corrigés par IA (reponse_longue, vrai_faux_justifie)
      // renvoient juste "rempli" (une réponse a été fournie ou non) — la
      // VRAIE note vient de la validation finale, jamais de ce guidage en
      // direct. On ne compte donc PAS ce cas dans le compteur "Bonnes
      // réponses" (purement cosmétique), pour ne jamais afficher un score
      // trompeur pendant la partie.
      const estGuidageIA = typeof data.rempli === 'boolean'; // reponse_longue / vrai_faux_justifie : pas de vraie note ici
      let reussi;
      if (estGuidageIA) {
        reussi = data.rempli;
        els.feedback.textContent = reussi ? '📝 Réponse enregistrée — corrigée à la validation finale.' : '✏️ Écris une réponse avant de continuer.';
      } else {
        const total = data.tachesTotal ?? 1;
        const ok = data.tachesReussies ?? 0;
        reussi = ok > 0;
        els.feedback.textContent = ok === total ? (total > 1 ? `✅ Bravo — ${ok}/${total} réussies !` : '✅ Bonne réponse !')
          : ok > 0 ? `🙂 ${ok}/${total} réussies !` : "❌ Ce n'est pas encore ça !";
      }

      if (reussi) {
        jouerSonReussite();
        if (!estGuidageIA) etat.scoreDirect++;
        els.feedback.className = 'jeu-feedback feedback-ok';
      } else {
        jouerSonEchec();
        els.feedback.className = 'jeu-feedback feedback-echec';
      }

      if (reussi) {
        etat.index++;
        etat.operationReveleeIndex = -1;
        setTimeout(async () => {
          if (etat.index >= questions().length) await finaliserRonde();
          else await afficherQuestionCourante();
        }, 750);
      } else {
        btn.disabled = false;
        btn.textContent = '✅ Valider cette réponse';
      }
    } catch (e) {
      alert(e.message || 'Une erreur est survenue.');
      btn.disabled = false;
      btn.textContent = '✅ Valider cette réponse';
    }
  }

  async function finaliserRonde() {
    els.questionArea.innerHTML = '<p class="jeu-message-accueil">📤 Envoi de tes réponses...</p>';
    const numeroEssai = etat.ronde.essaisPrecedents.length + 1;

    // Capturé AVANT la soumission (pas après !) pour pouvoir détecter un
    // déblocage de palier tout juste survenu — voir soumettreExercice dans
    // js/pages/eleve-seance.js pour l'équivalent (reussiAvant y vient de
    // l'état déjà chargé en mémoire ; ici on le relit juste avant l'appel,
    // faute d'un cache équivalent côté jeu).
    let reussiAvant = false;
    if (etat.ronde.bloc.palier && etat.ronde.seance?.id) {
      const etatsAvant = await jeuEtatPaliers({ eleveId: etat.profil.id, seanceId: etat.ronde.seance.id });
      reussiAvant = !!etatsAvant.find(p => p.palier === etat.ronde.bloc.palier)?.reussi;
    }

    try {
      const data = await jeuSoumettreRonde({ blocId: etat.ronde.bloc.id, reponses: etat.reponses, numeroEssai });
      const total = data.nbTaches;
      const ok = data.nbTachesReussies;
      const reussiteTotale = data.statut !== 'en_attente_ia' && typeof total === 'number' && total > 0 && ok === total;

      let palierMessage = '';
      if (etat.ronde.bloc.palier && etat.ronde.seance?.id) {
        const etatsApres = await jeuEtatPaliers({ eleveId: etat.profil.id, seanceId: etat.ronde.seance.id });
        const apres = etatsApres.find(p => p.palier === etat.ronde.bloc.palier);
        if (apres?.reussi && !reussiAvant) {
          jouerSonPalier();
          palierMessage = `🏆 Palier débloqué${numeroEssai === 1 ? ' — badges obtenus au 1er essai !' : ' !'}`;
        }
      }
      if (reussiteTotale && !palierMessage) jouerSonReussite();

      afficherBilan({ data, reussiteTotale, palierMessage, numeroEssai });
    } catch (e) {
      els.questionArea.innerHTML = `<p class="jeu-message-accueil" style="color:var(--neon-red)">${echapper(e.message || 'Une erreur est survenue pendant la correction.')}</p>
        <button type="button" class="jeu-btn-start" id="jeuBtnRetourAccueil">⬅️ Retour</button>`;
      document.getElementById('jeuBtnRetourAccueil').addEventListener('click', retourAccueil);
    }
  }

  function afficherBilan({ data, reussiteTotale, palierMessage, numeroEssai }) {
    const total = data.nbTaches ?? 0;
    const ok = data.nbTachesReussies ?? 0;
    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
    els.jeuCorps.hidden = true;
    els.summaryModal.classList.add('active');
    els.summaryModal.innerHTML = `
      <h2 style="color:var(--gold);margin:0">📊 Bilan de la partie</h2>
      <div class="jeu-success-badge" style="color:${pct >= 66.7 ? 'var(--neon-green)' : pct > 0 ? 'var(--gold)' : 'var(--neon-red)'}">${pct}%</div>
      <p style="font-weight:700">${ok}/${total} tâche${total > 1 ? 's' : ''} réussie${ok > 1 ? 's' : ''}${jeuLibelleMedaille(data.medaille, numeroEssai) ? ` — ${jeuLibelleMedaille(data.medaille, numeroEssai)}` : ''}</p>
      ${palierMessage ? `<p style="font-weight:700;color:var(--gold)">${palierMessage}</p>` : ''}
      <p>${data.statut === 'en_attente_ia' ? '⏳ Certaines réponses seront corrigées par un enseignant.' : reussiteTotale ? '🎉 Parfait, continue comme ça !' : '💪 Entraîne-toi encore, tu vas progresser !'}</p>
      <button type="button" class="jeu-btn-start" id="jeuBtnRejouer" style="margin-top:10px">🔄 Choisir un autre niveau</button>
    `;
    if (reussiteTotale && typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    document.getElementById('jeuBtnRejouer').addEventListener('click', () => {
      els.summaryModal.classList.remove('active');
      retourAccueil();
    });
  }

  async function afficherEcranCorrection() {
    els.accueil.hidden = true;
    els.jeuCorps.hidden = false;
    els.questionArea.innerHTML = '<p class="jeu-message-accueil">Chargement de la correction...</p>';
    try {
      const corrige = await jeuConsulterCorrection(etat.ronde.bloc.id);
      if (corrige?.erreur && corrige.autorise !== true) {
        els.questionArea.innerHTML = `<p class="jeu-message-accueil">${echapper(corrige.erreur)}</p>`;
      } else {
        els.questionArea.innerHTML = questions().map((q, i) => `
          <div class="question-lecture">
            <p class="question-enonce">${i + 1}. ${jeuRendreEnonce(q)}</p>
            <p style="color:var(--neon-green)">🔓 Bonne réponse : <strong>${echapper(jeuTexteBonneReponse(q, corrige.corrige?.[q.id]))}</strong></p>
          </div>`).join('');
      }
      els.questionArea.insertAdjacentHTML('beforeend', `<button type="button" class="jeu-btn-start" id="jeuBtnRetourCorrection" style="margin-top:12px">⬅️ Retour</button>`);
      document.getElementById('jeuBtnRetourCorrection').addEventListener('click', retourAccueil);
    } catch (e) {
      els.questionArea.innerHTML = `<p class="jeu-message-accueil">${echapper(e.message)}</p>`;
    }
  }

  function retourAccueil() {
    clearInterval(etat.timerInterval);
    els.summaryModal.classList.remove('active');
    els.jeuCorps.hidden = true;
    els.accueil.hidden = false;
    if (etat.palier) choisirPalier(etat.palier);
  }

  function ouvrirReglages() { els.settingsModal.classList.add('active'); }
  function fermerReglages() { els.settingsModal.classList.remove('active'); }

  async function init(profil, classeId) {
    etat.profil = profil;
    etat.classeId = classeId;
    etat.accesCorrection = await jeuVerifierAccesCorrection(profil.id);
    if (config.permettreMasquerOperation) {
      etat.masquerOperation = await jeuLireMasquerOperation(profil.id);
    }
    afficherPalierSelector();
    els.btnLancer.addEventListener('click', lancer);
    if (els.btnSettings) els.btnSettings.addEventListener('click', ouvrirReglages);
    if (els.btnCloseSettings) els.btnCloseSettings.addEventListener('click', fermerReglages);
    if (els.timeSelect) els.timeSelect.addEventListener('change', () => { etat.tempsParQuestion = parseInt(els.timeSelect.value, 10) || 15; });
    els.infoAccueil.textContent = 'Choisis ton niveau pour commencer.';
  }

  return { init, els, etat };
}
