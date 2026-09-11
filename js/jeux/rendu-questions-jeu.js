// Lot "Jeux éducatifs interactifs" (11 septembre 2026, douzième requête).
// Rendu des questions à l'intérieur des jeux d'arcade (pages/eleve/jeu-*.html)
// — copie ADAPTÉE (pas un refactor) des fonctions équivalentes de
// js/pages/eleve-seance.js (rendreEnonce, rendreChampQuestion,
// attacherEcouteursListesOrdre/SelectionMots/TrousGlisser, lireReponseQuestion,
// texteBonneReponse), sur le modèle déjà établi par ce projet de dupliquer ces
// mêmes fonctions entre eleve-seance.js et eleve-devoir-rendu.js plutôt que de
// les mutualiser dans un module partagé unique — même logique ici pour ne
// prendre AUCUN risque de régression sur la page séance/devoir, déjà testée.
//
// Dépend de js/editeur/blocs.js (echapper, contenuRicheInitial, tokeniserMots,
// TYPES_ENONCE_PLAT) — à charger AVANT ce fichier sur chaque page de jeu.
// Couvre les 13 types de question (LIBELLES_TYPE_QUESTION dans
// js/editeur/blocs.js) : qcm, vrai_faux, reponse_courte, reponse_longue,
// texte_a_trous, texte_a_trous_glisser, remise_en_ordre, association,
// qcm_multiple, classement, intrus_lexical, reponse_numerique,
// selection_mots, vrai_faux_justifie.
//
// Différence volontaire avec eleve-seance.js : `rendreChampQuestion` prend un
// 3e paramètre optionnel `options` ({ masquerNumero }) pour que l'habillage
// "jeu" (une question à la fois, sans numérotation "1.", "2."...) reste
// propre — l'affichage du numéro de question est déjà géré par l'écran de jeu
// lui-même (ex : "Question 3/8").

function jeuRendreEnonce(q) {
  if (TYPES_ENONCE_PLAT.includes(q.type)) return echapper(q.enonce);
  return contenuRicheInitial(q.enonce);
}

function jeuRendreChampQuestion(q, i, options = {}) {
  const prefixe = options.masquerNumero ? '' : `${i + 1}. `;

  if (q.type === 'texte_a_trous') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<input type="text" class="champ-trou" data-trou-index="${idxTrou}" required style="width:110px;display:inline-block;margin:0 4px">`;
    }).join('');
    return `<div class="question-lecture" data-question-trous="${echapper(q.id)}"><p class="question-enonce">${prefixe}${enonceAvecTrous}</p>${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}</div>`;
  }
  if (q.type === 'texte_a_trous_glisser') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<span class="zone-trou-glisser" data-trou-glisser-index="${idxTrou}"></span>`;
    }).join('');
    const banque = Array.isArray(q.banqueMots) ? q.banqueMots : [];
    const banqueMelangee = banque.map((m, idx) => ({ m, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture" data-question-trous-glisser="${echapper(q.id)}">
      <p class="question-enonce">${prefixe}${enonceAvecTrous}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div class="banque-mots-glisser">
        ${banqueMelangee.map(({ m }) => `<button type="button" class="chip-glisser" draggable="true" data-mot-glisser="${echapper(m)}">${echapper(m)}</button>`).join('')}
      </div>
      <p class="note-aide-glisser">Glisse chaque mot dans le trou qui convient (ou touche un mot puis touche un trou).</p>
    </div>`;
  }
  if (q.type === 'selection_mots') {
    const mots = tokeniserMots(q.enonce || '');
    return `<div class="question-lecture" data-question-selection-mots="${echapper(q.id)}">
      <p class="question-enonce">${prefixe}Clique sur le ou les mots corrects.</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div class="mots-selectionnables-lecture">
        ${mots.map((m, mi) => `<button type="button" class="chip-mot-choix" data-mot-choix-index="${mi}">${echapper(m)}</button>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'intrus_lexical') {
    const series = Array.isArray(q.series) ? q.series : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div class="series-intrus-lecture" data-intrus-question="${echapper(q.id)}">
        ${series.map((s, si) => {
          const mots = Array.isArray(s?.mots) ? s.mots : [];
          return `<div class="serie-intrus" data-serie-intrus-index="${si}">
            ${mots.map((m, mi) => `<label class="chip-mot-choix-radio"><input type="radio" name="intrus_${echapper(q.id)}_${si}" data-intrus-radio-index="${mi}" required> ${echapper(m)}</label>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'remise_en_ordre') {
    const optionsListe = Array.isArray(q.options) ? q.options : [];
    const ordreMele = optionsListe.map((opt, idx) => ({ opt, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture">
      <p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <ol class="liste-remise-en-ordre" data-ordre-question="${echapper(q.id)}">
        ${ordreMele.map(({ opt, idx }) => `<li data-index-original="${idx}"><span>${echapper(opt)}</span><span class="fleches-ordre"><button type="button" data-monter title="Monter">▲</button><button type="button" data-descendre title="Descendre">▼</button></span></li>`).join('')}
      </ol>
    </div>`;
  }
  if (q.type === 'association') {
    const gauche = Array.isArray(q.gauche) ? q.gauche : [];
    const droite = Array.isArray(q.droite) ? q.droite : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div class="lignes-association" data-association-question="${echapper(q.id)}">
        ${gauche.map((g, idx) => `
          <div class="ligne-association" style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="flex:1">${echapper(g)}</span>
            <select data-association-choix-index="${idx}" required>
              <option value="">— Choisis —</option>
              ${droite.map((d, k) => `<option value="${k}">${echapper(d)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'qcm_multiple') {
    const optionsListe = Array.isArray(q.options) ? q.options : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div data-qcm-multiple-question="${echapper(q.id)}">
        ${optionsListe.map((opt, idx) => `<label class="option-jeu-arcade"><input type="checkbox" data-qcm-multiple-choix-index="${idx}"> ${echapper(opt)}</label>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'classement') {
    const motsAClasser = Array.isArray(q.motsAClasser) ? q.motsAClasser : [];
    const categories = Array.isArray(q.categories) ? q.categories : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>
      ${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}
      <div class="lignes-classement" data-classement-question="${echapper(q.id)}">
        ${motsAClasser.map((mot, idx) => `
          <div class="ligne-classement" style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="flex:1">${echapper(mot)}</span>
            <select data-classement-choix-index="${idx}" required>
              <option value="">— Choisis —</option>
              ${categories.map((cat, k) => `<option value="${k}">${echapper(cat)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // QCM/Vrai-Faux : rendus comme des boutons "option-jeu-arcade" (au lieu de
  // simples <label><input radio>...</label>) pour retrouver l'esthétique
  // "boutons cliquables" du fichier de référence (.option-btn) — voir
  // css/jeux-arcade.css. Le clic pose/enlève juste l'attribut `checked` sur
  // le radio caché à l'intérieur : lireReponseQuestion (ci-dessous) continue
  // à lire exactement les mêmes sélecteurs que côté séance.
  let champ = '';
  if (q.type === 'qcm') {
    champ = `<div class="options-grid-jeu">${(q.options || []).map((opt, idx) => `
      <label class="option-jeu-arcade" data-option-jeu>
        <input type="radio" name="q_${echapper(q.id)}" value="${idx}" required style="display:none">
        ${echapper(opt)}
      </label>`).join('')}</div>`;
  } else if (q.type === 'vrai_faux') {
    champ = `<div class="options-grid-jeu">
      <label class="option-jeu-arcade" data-option-jeu><input type="radio" name="q_${echapper(q.id)}" value="true" required style="display:none"> ✅ Vrai</label>
      <label class="option-jeu-arcade" data-option-jeu><input type="radio" name="q_${echapper(q.id)}" value="false" required style="display:none"> ❌ Faux</label>
    </div>`;
  } else if (q.type === 'reponse_courte') {
    champ = `<div class="input-answer-area-jeu"><input type="text" name="q_${echapper(q.id)}" required placeholder="Ta réponse..." autocomplete="off"></div>`;
  } else if (q.type === 'reponse_numerique') {
    champ = `<div class="input-answer-area-jeu"><input type="number" step="any" name="q_${echapper(q.id)}" required placeholder="Ta réponse..." autocomplete="off"></div>`;
  } else if (q.type === 'vrai_faux_justifie') {
    champ = `<div class="options-grid-jeu">
      <label class="option-jeu-arcade" data-option-jeu><input type="radio" name="q_${echapper(q.id)}" value="true" required style="display:none"> ✅ Vrai</label>
      <label class="option-jeu-arcade" data-option-jeu><input type="radio" name="q_${echapper(q.id)}" value="false" required style="display:none"> ❌ Faux</label>
    </div>
    <div class="input-answer-area-jeu"><textarea name="q_${echapper(q.id)}_justification" required placeholder="Justifie ta réponse..."></textarea></div>`;
  } else {
    // reponse_longue et types non prévus : zone de texte libre.
    champ = `<div class="input-answer-area-jeu"><textarea name="q_${echapper(q.id)}" required placeholder="Ta réponse..."></textarea></div>`;
  }
  return `<div class="question-lecture"><p class="question-enonce">${prefixe}${jeuRendreEnonce(q)}</p>${q.consigne ? `<p class="consigne-question">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
}

// --- Écouteurs interactifs (identiques à eleve-seance.js) -------------------

function jeuAttacherEcouteursOptions(racine = document) {
  // Bascule visuelle "sélectionné" pour les boutons QCM/Vrai-Faux/Vrai-Faux
  // justifié (voir jeuRendreChampQuestion) — coche le radio caché associé.
  racine.querySelectorAll('[data-option-jeu]').forEach(label => {
    label.addEventListener('click', () => {
      const nomGroupe = label.querySelector('input[type=radio]')?.name;
      if (!nomGroupe) return;
      racine.querySelectorAll(`[data-option-jeu] input[name="${CSS.escape(nomGroupe)}"]`).forEach(r => {
        r.closest('[data-option-jeu]')?.classList.remove('option-jeu-selectionnee');
      });
      const radio = label.querySelector('input[type=radio]');
      radio.checked = true;
      label.classList.add('option-jeu-selectionnee');
    });
  });
}

function jeuAttacherEcouteursListesOrdre(racine = document) {
  racine.querySelectorAll('.liste-remise-en-ordre').forEach(liste => {
    liste.querySelectorAll('button[data-monter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const li = btn.closest('li');
        const precedent = li.previousElementSibling;
        if (precedent) liste.insertBefore(li, precedent);
      });
    });
    liste.querySelectorAll('button[data-descendre]').forEach(btn => {
      btn.addEventListener('click', () => {
        const li = btn.closest('li');
        const suivant = li.nextElementSibling;
        if (suivant) liste.insertBefore(suivant, li);
      });
    });
  });
}

function jeuAttacherEcouteursSelectionMots(racine = document) {
  racine.querySelectorAll('.mots-selectionnables-lecture .chip-mot-choix').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
  });
}

function jeuAttacherEcouteursTrousGlisser(racine = document) {
  racine.querySelectorAll('[data-question-trous-glisser]').forEach(zoneQuestion => {
    const chips = Array.from(zoneQuestion.querySelectorAll('.chip-glisser'));
    let motArme = null;

    function armerMot(chip) {
      chips.forEach(c => c.classList.remove('chip-armee'));
      if (motArme === chip) { motArme = null; return; }
      motArme = chip;
      chip.classList.add('chip-armee');
    }
    function placerMot(trou, chip) {
      if (trou.dataset.motPlace) {
        const ancien = chips.find(c => c.hidden && c.dataset.motGlisser === trou.dataset.motPlace);
        if (ancien) ancien.hidden = false;
      }
      trou.textContent = chip.dataset.motGlisser;
      trou.dataset.motPlace = chip.dataset.motGlisser;
      trou.classList.add('trou-glisser-rempli');
      chip.hidden = true;
      chip.classList.remove('chip-armee');
      motArme = null;
    }
    function retirerMot(trou) {
      if (!trou.dataset.motPlace) return;
      const chip = chips.find(c => c.hidden && c.dataset.motGlisser === trou.dataset.motPlace);
      if (chip) chip.hidden = false;
      trou.textContent = '';
      delete trou.dataset.motPlace;
      trou.classList.remove('trou-glisser-rempli');
    }

    chips.forEach(chip => {
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', chip.dataset.motGlisser);
        e.dataTransfer.effectAllowed = 'move';
      });
      chip.addEventListener('click', () => armerMot(chip));
    });
    zoneQuestion.querySelectorAll('.zone-trou-glisser').forEach(trou => {
      trou.addEventListener('dragover', (e) => { e.preventDefault(); trou.classList.add('trou-glisser-survole'); });
      trou.addEventListener('dragleave', () => trou.classList.remove('trou-glisser-survole'));
      trou.addEventListener('drop', (e) => {
        e.preventDefault();
        trou.classList.remove('trou-glisser-survole');
        const motTexte = e.dataTransfer.getData('text/plain');
        const chip = chips.find(c => !c.hidden && c.dataset.motGlisser === motTexte);
        if (chip) placerMot(trou, chip);
      });
      trou.addEventListener('click', () => {
        if (motArme) { placerMot(trou, motArme); return; }
        retirerMot(trou);
      });
    });
  });
}

// Attache tous les écouteurs interactifs d'un coup — à appeler après chaque
// rendu d'une question dans la zone de jeu.
function jeuAttacherTousEcouteurs(racine = document) {
  jeuAttacherEcouteursOptions(racine);
  jeuAttacherEcouteursListesOrdre(racine);
  jeuAttacherEcouteursSelectionMots(racine);
  jeuAttacherEcouteursTrousGlisser(racine);
}

// Lit la réponse donnée par l'élève pour UNE question — identique à
// lireReponseQuestion (js/pages/eleve-seance.js), `racine` est la zone de jeu
// contenant le champ actuellement affiché.
function jeuLireReponseQuestion(racine, q) {
  if (q.type === 'texte_a_trous') {
    const champsTrou = racine.querySelectorAll(`[data-question-trous="${CSS.escape(String(q.id))}"] .champ-trou`);
    return Array.from(champsTrou).map(inp => inp.value);
  }
  if (q.type === 'remise_en_ordre') {
    const liste = racine.querySelector(`[data-ordre-question="${CSS.escape(String(q.id))}"]`);
    return liste ? Array.from(liste.children).map(li => parseInt(li.dataset.indexOriginal, 10)) : [];
  }
  if (q.type === 'association') {
    const zone = racine.querySelector(`[data-association-question="${CSS.escape(String(q.id))}"]`);
    const selects = zone ? Array.from(zone.querySelectorAll('[data-association-choix-index]')) : [];
    selects.sort((a, b) => parseInt(a.dataset.associationChoixIndex, 10) - parseInt(b.dataset.associationChoixIndex, 10));
    return selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
  }
  if (q.type === 'qcm_multiple') {
    const zone = racine.querySelector(`[data-qcm-multiple-question="${CSS.escape(String(q.id))}"]`);
    const cases = zone ? Array.from(zone.querySelectorAll('[data-qcm-multiple-choix-index]')) : [];
    return cases.filter(cb => cb.checked).map(cb => parseInt(cb.dataset.qcmMultipleChoixIndex, 10));
  }
  if (q.type === 'classement') {
    const zone = racine.querySelector(`[data-classement-question="${CSS.escape(String(q.id))}"]`);
    const selects = zone ? Array.from(zone.querySelectorAll('[data-classement-choix-index]')) : [];
    selects.sort((a, b) => parseInt(a.dataset.classementChoixIndex, 10) - parseInt(b.dataset.classementChoixIndex, 10));
    return selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
  }
  if (q.type === 'intrus_lexical') {
    const zone = racine.querySelector(`[data-intrus-question="${CSS.escape(String(q.id))}"]`);
    const series = zone ? Array.from(zone.querySelectorAll('[data-serie-intrus-index]')) : [];
    series.sort((a, b) => parseInt(a.dataset.serieIntrusIndex, 10) - parseInt(b.dataset.serieIntrusIndex, 10));
    return series.map(s => {
      const coche = s.querySelector('input[data-intrus-radio-index]:checked');
      return coche ? parseInt(coche.dataset.intrusRadioIndex, 10) : null;
    });
  }
  if (q.type === 'selection_mots') {
    const zone = racine.querySelector(`[data-question-selection-mots="${CSS.escape(String(q.id))}"]`);
    const chips = zone ? Array.from(zone.querySelectorAll('.chip-mot-choix')) : [];
    return chips.filter(c => c.classList.contains('selectionne')).map(c => c.dataset.motChoixIndex);
  }
  if (q.type === 'texte_a_trous_glisser') {
    const zone = racine.querySelector(`[data-question-trous-glisser="${CSS.escape(String(q.id))}"]`);
    const trous = zone ? Array.from(zone.querySelectorAll('.zone-trou-glisser')) : [];
    trous.sort((a, b) => parseInt(a.dataset.trouGlisserIndex, 10) - parseInt(b.dataset.trouGlisserIndex, 10));
    return trous.map(t => t.dataset.motPlace || null);
  }
  if (q.type === 'vrai_faux_justifie') {
    const coche = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
    const justif = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}_justification"]`);
    return { reponse: coche ? coche.value === 'true' : null, justification: justif ? justif.value : '' };
  }
  const champCoche = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
  const champSimple = racine.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], input[type=number][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
  const champ = champCoche || champSimple;
  if (!champ) return undefined;
  return (q.type === 'vrai_faux') ? (champ.value === 'true') : champ.value;
}

// Bonne réponse "lisible" (affichage post-correction / bilan) — identique à
// texteBonneReponse (js/pages/eleve-seance.js).
function jeuTexteBonneReponse(q, cq) {
  if (!cq) return '';
  const br = cq.bonneReponse;
  if (q.type === 'qcm') return (q.options || [])[Number(br)] ?? String(br ?? '');
  if (q.type === 'vrai_faux') return (br === true || br === 'true') ? 'Vrai' : 'Faux';
  if (q.type === 'reponse_courte') return Array.isArray(br) ? br.join(' / ') : String(br ?? '');
  if (q.type === 'reponse_numerique') {
    const attendu = (br && typeof br === 'object') ? br : {};
    return `${attendu.valeur ?? ''}${attendu.tolerance ? ` (± ${attendu.tolerance})` : ''}`;
  }
  if (q.type === 'texte_a_trous' || q.type === 'texte_a_trous_glisser') {
    return Array.isArray(br) ? br.map(v => Array.isArray(v) ? v[0] : v).join(' / ') : '';
  }
  if (q.type === 'remise_en_ordre') return Array.isArray(br) ? br.map(v => (q.options || [])[v] ?? v).join(' → ') : '';
  if (q.type === 'association') return Array.isArray(br) ? br.map((v, i) => `${(q.gauche || [])[i] ?? ''} → ${(q.droite || [])[v] ?? v}`).join(' ; ') : '';
  if (q.type === 'classement') return Array.isArray(br) ? br.map((v, i) => `${(q.motsAClasser || [])[i] ?? ''} → ${(q.categories || [])[v] ?? v}`).join(' ; ') : '';
  if (q.type === 'intrus_lexical') return Array.isArray(br) ? br.map((v, i) => (q.series?.[i]?.mots || [])[v] ?? v).join(' ; ') : '';
  if (q.type === 'qcm_multiple') return Array.isArray(br) ? br.map(v => (q.options || [])[v] ?? v).join(', ') : '';
  if (q.type === 'selection_mots') {
    const mots = tokeniserMots(q.enonce || '');
    return Array.isArray(br) ? br.map(v => mots[Number(v)]).filter(Boolean).join(', ') : '';
  }
  return cq.bareme ? `Barème : ${cq.bareme}` : '';
}
