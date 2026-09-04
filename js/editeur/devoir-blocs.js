// Éditeur de blocs pour un devoir (exercice / quiz / évaluation / activité).
// Réutilise les mêmes types de blocs et le même éditeur de questions/corrigé
// que l'éditeur de séance (js/editeur/blocs.js : infoType, teinteClaire,
// echapper, html_questionEditeur...), en version volontairement plus simple :
// pas de palier (concept propre à la progression dans une séance), pas de
// glisser-déposer, pas de blocs de cours (texte, image, tableau...), pas
// d'assistant IA de rédaction — juste ce qu'il faut pour composer un devoir
// avec de vraies questions, notées automatiquement ou à corriger à la main.
//
// Contrairement à l'éditeur de séance (pages/editeur-seance.html, réservé aux
// admins via requireAdmin()), ce module est appelé depuis les pages
// "Devoirs & notes" enseignant ET admin : l'appelant doit avoir déjà vérifié
// que l'utilisateur peut gérer ce devoir avant d'appeler initEditeurBlocsDevoir
// — les policies RLS protègent aussi côté serveur en cas d'oubli.

const TYPES_BLOCS_DEVOIR = ['exercice', 'quiz', 'evaluation', 'activite'];

let devoirBlocsEtat = {}; // devoirId -> { blocs, conteneurEl, minuteriesBloc }
let minuteriesCorrigeDevoir = {}; // blocId -> timer (partagé, blocId est unique dans toute la table)

async function initEditeurBlocsDevoir(devoirId, conteneurEl) {
  devoirBlocsEtat[devoirId] = { blocs: [], conteneurEl, minuteriesBloc: {} };
  await chargerBlocsDevoir(devoirId);
  rendreBlocsDevoir(devoirId);
}

async function chargerBlocsDevoir(devoirId) {
  const { data } = await supabaseClient.from('blocs_seance').select('*').eq('devoir_id', devoirId).order('ordre');
  devoirBlocsEtat[devoirId].blocs = data || [];
}

function rendreBlocsDevoir(devoirId) {
  const etat = devoirBlocsEtat[devoirId];
  if (!etat) return;
  const { blocs, conteneurEl } = etat;

  conteneurEl.innerHTML = `
    <div class="liste-blocs-devoir">
      ${blocs.length ? blocs.map(b => html_ligneBlocDevoir(b)).join('') : '<p class="note-future">Aucun bloc pour l\'instant — ajoute un exercice, un quiz, une évaluation ou une activité.</p>'}
    </div>
    <div class="menu-ajout-bloc-devoir" style="position:relative;margin-top:10px">
      <button type="button" class="btn btn-discret" data-toggle-ajout-devoir>+ Ajouter un bloc</button>
      <div class="liste-types-devoir" data-liste-types-devoir style="display:none;position:absolute;background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:10;padding:6px;min-width:190px">
        ${TYPES_BLOCS_DEVOIR.map(t => {
          const info = infoType(t);
          return `<button type="button" class="item-type-devoir" data-ajouter-type-devoir="${t}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px;border:none;background:none;cursor:pointer;border-radius:6px;font-size:13px">${info.icone} ${info.label}</button>`;
        }).join('')}
      </div>
    </div>
  `;

  attacherEcouteursBlocsDevoir(devoirId);
}

function html_ligneBlocDevoir(b) {
  const info = infoType(b.type_bloc);
  const couleur = (b.contenu && b.contenu.couleurBloc) || info.couleur;
  return `
    <div class="bloc" data-bloc-devoir-id="${b.id}" style="border-left-color:${couleur};background:${teinteClaire(couleur)};margin-bottom:12px">
      <div class="bloc-entete">
        <span class="bloc-type" style="color:${couleur}">${info.icone} ${info.label}</span>
        <div class="bloc-actions">
          <button title="Dupliquer" data-action-bloc-devoir="dupliquer" type="button">📑</button>
          <button title="Supprimer" data-action-bloc-devoir="supprimer" type="button">🗑️</button>
        </div>
      </div>
      <div class="bloc-corps">${html_corpsBlocDevoir(b)}</div>
    </div>`;
}

function html_corpsBlocDevoir(bloc) {
  const c = bloc.contenu || {};
  const questions = Array.isArray(c.questions) ? c.questions : [];
  return `
    <textarea data-champ-devoir="consigne" placeholder="Consigne générale (ex : Réponds aux questions suivantes)">${echapper(c.consigne)}</textarea>
    <div class="editeur-questions" data-questions-bloc-devoir="1">
      <div class="liste-questions" data-liste-questions>
        ${questions.length ? questions.map((q, i) => html_questionEditeur(q, i, null)).join('') : '<p class="note-future">Aucune question pour l\'instant.</p>'}
      </div>
      <button type="button" class="btn btn-discret" data-ajouter-question>+ Ajouter une question</button>
      <p class="note-future" data-etat-corrige>Chargement du corrigé...</p>
    </div>`;
}

function attacherEcouteursBlocsDevoir(devoirId) {
  const etat = devoirBlocsEtat[devoirId];
  const { blocs, conteneurEl } = etat;

  const btnToggle = conteneurEl.querySelector('[data-toggle-ajout-devoir]');
  const listeTypes = conteneurEl.querySelector('[data-liste-types-devoir]');
  if (btnToggle && listeTypes) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      listeTypes.style.display = listeTypes.style.display === 'none' ? 'block' : 'none';
    });
    listeTypes.querySelectorAll('[data-ajouter-type-devoir]').forEach(btn => {
      btn.addEventListener('click', () => ajouterBlocDevoir(devoirId, btn.dataset.ajouterTypeDevoir));
    });
  }

  blocs.forEach(bloc => {
    const el = conteneurEl.querySelector(`[data-bloc-devoir-id="${bloc.id}"]`);
    if (!el) return;

    const zoneConsigne = el.querySelector('[data-champ-devoir="consigne"]');
    if (zoneConsigne) zoneConsigne.addEventListener('input', () => {
      bloc.contenu = { ...bloc.contenu, consigne: zoneConsigne.value };
      sauvegarderBlocDevoir(devoirId, bloc);
    });

    el.querySelectorAll('[data-action-bloc-devoir]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.actionBlocDevoir === 'dupliquer') dupliquerBlocDevoir(devoirId, bloc);
        if (btn.dataset.actionBlocDevoir === 'supprimer') supprimerBlocDevoir(devoirId, bloc);
      });
    });

    if (['exercice', 'quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
      attacherEcouteursQuestionsDevoir(devoirId, el, bloc);
    }
  });
}

function sauvegarderBlocDevoir(devoirId, bloc) {
  const etat = devoirBlocsEtat[devoirId];
  clearTimeout(etat.minuteriesBloc[bloc.id]);
  etat.minuteriesBloc[bloc.id] = setTimeout(async () => {
    await supabaseClient.from('blocs_seance').update({ contenu: bloc.contenu }).eq('id', bloc.id);
  }, 700);
}

function sauvegarderCorrigeDevoir(blocId, corrige) {
  clearTimeout(minuteriesCorrigeDevoir[blocId]);
  minuteriesCorrigeDevoir[blocId] = setTimeout(async () => {
    await supabaseClient.from('corriges_exercices').upsert(
      { bloc_id: blocId, corrige, modifie_le: new Date().toISOString() }, { onConflict: 'bloc_id' }
    );
  }, 700);
}

// Édition des questions + corrigé — même logique que attacherEcouteursQuestions
// dans js/pages/editeur-seance.js, adaptée pour sauvegarder via les fonctions
// ci-dessus (blocs de devoir) plutôt que via les globales de l'éditeur de séance.
function attacherEcouteursQuestionsDevoir(devoirId, el, bloc) {
  const conteneur = el.querySelector('[data-questions-bloc-devoir]');
  if (!conteneur) return;

  const listeEl = conteneur.querySelector('[data-liste-questions]');
  const etatCorrigeEl = conteneur.querySelector('[data-etat-corrige]');
  const btnAjouterQuestion = conteneur.querySelector('[data-ajouter-question]');
  let corrigeActuel = null;

  const questions = () => Array.isArray(bloc.contenu && bloc.contenu.questions) ? bloc.contenu.questions : [];
  const majQuestions = (liste) => { bloc.contenu = { ...bloc.contenu, questions: liste }; sauvegarderBlocDevoir(devoirId, bloc); };
  const sauvegarderCorrige = () => { if (corrigeActuel) sauvegarderCorrigeDevoir(bloc.id, corrigeActuel); };

  function rerender() {
    const qs = questions();
    listeEl.innerHTML = qs.length
      ? qs.map((q, i) => html_questionEditeur(q, i, corrigeActuel)).join('')
      : '<p class="note-future">Aucune question pour l\'instant.</p>';
    wirerQuestions();
  }

  function wirerQuestions() {
    listeEl.querySelectorAll('[data-question-id]').forEach(qEl => {
      const qId = qEl.dataset.questionId;
      const q = questions().find(x => x.id === qId);
      if (!q) return;
      const c = corrigeActuel ? (corrigeActuel[qId] = corrigeActuel[qId] || {}) : null;

      qEl.querySelector('[data-question-champ="type"]').addEventListener('change', (e) => {
        q.type = e.target.value;
        if ((q.type === 'qcm' || q.type === 'qcm_multiple' || q.type === 'remise_en_ordre') && !Array.isArray(q.options)) q.options = ['', ''];
        if (q.type === 'association' && !Array.isArray(q.paires)) {
          q.paires = [{ gauche: '', droite: '' }, { gauche: '', droite: '' }];
          recalculerAssociation(q, c);
        }
        if (q.type === 'classement' && !Array.isArray(q.categories)) {
          q.categories = ['', ''];
          q.items = [{ mot: '', categorieIndex: null }, { mot: '', categorieIndex: null }];
          recalculerClassement(q, c);
        }
        majQuestions(questions());
        if (c) sauvegarderCorrige();
        rerender();
      });

      qEl.querySelector('[data-question-champ="enonce"]').addEventListener('input', (e) => {
        q.enonce = e.target.value;
        majQuestions(questions());
      });
      const inputConsigne = qEl.querySelector('[data-question-champ="consigne"]');
      if (inputConsigne) inputConsigne.addEventListener('input', (e) => {
        q.consigne = e.target.value;
        majQuestions(questions());
      });
      if (q.type === 'texte_a_trous') {
        // Nombre de trous recalculé au blur seulement (pas au input), sinon
        // le champ énoncé perdrait le focus à chaque frappe (voir la même
        // logique dans js/pages/editeur-seance.js).
        qEl.querySelector('[data-question-champ="enonce"]').addEventListener('blur', () => rerender());
      }

      const inputPoints = qEl.querySelector('[data-question-points]');
      if (inputPoints) inputPoints.addEventListener('input', () => {
        if (!c) return;
        c.points = parseFloat(inputPoints.value) || 0;
        sauvegarderCorrige();
      });

      qEl.querySelector('[data-supprimer-question]').addEventListener('click', () => {
        majQuestions(questions().filter(x => x.id !== qId));
        if (corrigeActuel) { delete corrigeActuel[qId]; sauvegarderCorrige(); }
        rerender();
      });

      if (q.type === 'qcm' || q.type === 'qcm_multiple' || q.type === 'remise_en_ordre') {
        qEl.querySelectorAll('[data-option-index]').forEach(inputOpt => {
          inputOpt.addEventListener('input', () => {
            const i = parseInt(inputOpt.dataset.optionIndex, 10);
            q.options[i] = inputOpt.value;
            majQuestions(questions());
          });
        });
        const btnAjouterOption = qEl.querySelector('[data-ajouter-option]');
        if (btnAjouterOption) btnAjouterOption.addEventListener('click', () => {
          q.options = [...(q.options || []), ''];
          majQuestions(questions());
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-option]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerOption, 10);
            q.options.splice(i, 1);
            majQuestions(questions());
            if (c && q.type === 'qcm' && String(c.bonneReponse) === String(i)) c.bonneReponse = undefined;
            if (c && Array.isArray(c.bonneReponse)) {
              c.bonneReponse = c.bonneReponse.filter(x => x !== i).map(x => x > i ? x - 1 : x);
            }
            if (c) sauvegarderCorrige();
            rerender();
          });
        });
      }

      if (q.type === 'qcm') {
        qEl.querySelectorAll('[data-question-bonne-index]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            c.bonneReponse = radio.dataset.questionBonneIndex;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'qcm_multiple') {
        qEl.querySelectorAll('[data-question-bonne-multi-index]').forEach(checkbox => {
          checkbox.addEventListener('change', () => {
            if (!c) return;
            const i = parseInt(checkbox.dataset.questionBonneMultiIndex, 10);
            const actuel = Array.isArray(c.bonneReponse) ? c.bonneReponse.filter(x => x !== i) : [];
            if (checkbox.checked) actuel.push(i);
            c.bonneReponse = actuel;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'remise_en_ordre') {
        qEl.querySelectorAll('[data-question-rang-index]').forEach(input => {
          input.addEventListener('input', () => {
            if (!c) return;
            const i = parseInt(input.dataset.questionRangIndex, 10);
            const rang = parseInt(input.value, 10);
            const ordreActuel = Array.isArray(c.bonneReponse) ? c.bonneReponse.filter(x => x !== i) : [];
            const position = Math.max(0, Math.min(ordreActuel.length, (rang || 1) - 1));
            ordreActuel.splice(position, 0, i);
            c.bonneReponse = ordreActuel;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'texte_a_trous') {
        qEl.querySelectorAll('[data-question-trou-index]').forEach(input => {
          input.addEventListener('input', () => {
            if (!c) return;
            const i = parseInt(input.dataset.questionTrouIndex, 10);
            c.bonneReponse = Array.isArray(c.bonneReponse) ? [...c.bonneReponse] : [];
            c.bonneReponse[i] = input.value.split(',').map(s => s.trim()).filter(Boolean);
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'vrai_faux') {
        qEl.querySelectorAll('[data-question-bonne-vf]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            c.bonneReponse = radio.dataset.questionBonneVf === 'true';
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'reponse_courte') {
        const inputRc = qEl.querySelector('[data-question-reponse-courte]');
        if (inputRc) inputRc.addEventListener('input', () => {
          if (!c) return;
          c.bonneReponse = inputRc.value.split(',').map(s => s.trim()).filter(Boolean);
          sauvegarderCorrige();
        });
      }

      if (q.type === 'reponse_longue') {
        const texteBareme = qEl.querySelector('[data-question-bareme]');
        if (texteBareme) texteBareme.addEventListener('input', () => {
          if (!c) return;
          c.bareme = texteBareme.value;
          sauvegarderCorrige();
        });
      }

      if (q.type === 'association') {
        const rafraichirAssociation = () => {
          recalculerAssociation(q, c);
          majQuestions(questions());
          if (c) sauvegarderCorrige();
        };
        qEl.querySelectorAll('[data-association-gauche-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.associationGaucheIndex, 10);
            q.paires = Array.isArray(q.paires) ? [...q.paires] : [];
            q.paires[i] = { ...(q.paires[i] || {}), gauche: input.value };
            rafraichirAssociation();
          });
        });
        qEl.querySelectorAll('[data-association-droite-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.associationDroiteIndex, 10);
            q.paires = Array.isArray(q.paires) ? [...q.paires] : [];
            q.paires[i] = { ...(q.paires[i] || {}), droite: input.value };
            rafraichirAssociation();
          });
        });
        const btnAjouterPaire = qEl.querySelector('[data-ajouter-paire]');
        if (btnAjouterPaire) btnAjouterPaire.addEventListener('click', () => {
          q.paires = [...(q.paires || []), { gauche: '', droite: '' }];
          rafraichirAssociation();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-paire]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerPaire, 10);
            q.paires.splice(i, 1);
            rafraichirAssociation();
            rerender();
          });
        });
      }

      if (q.type === 'classement') {
        const rafraichirClassement = () => {
          recalculerClassement(q, c);
          majQuestions(questions());
          if (c) sauvegarderCorrige();
        };
        qEl.querySelectorAll('[data-categorie-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.categorieIndex, 10);
            q.categories = Array.isArray(q.categories) ? [...q.categories] : [];
            q.categories[i] = input.value;
            rafraichirClassement();
          });
        });
        const btnAjouterCategorie = qEl.querySelector('[data-ajouter-categorie]');
        if (btnAjouterCategorie) btnAjouterCategorie.addEventListener('click', () => {
          q.categories = [...(q.categories || []), ''];
          rafraichirClassement();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-categorie]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerCategorie, 10);
            q.categories.splice(i, 1);
            (q.items || []).forEach(it => {
              if (it.categorieIndex === i) it.categorieIndex = null;
              else if (typeof it.categorieIndex === 'number' && it.categorieIndex > i) it.categorieIndex -= 1;
            });
            rafraichirClassement();
            rerender();
          });
        });
        qEl.querySelectorAll('[data-item-classement-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.itemClassementIndex, 10);
            q.items = Array.isArray(q.items) ? [...q.items] : [];
            q.items[i] = { ...(q.items[i] || {}), mot: input.value };
            rafraichirClassement();
          });
        });
        qEl.querySelectorAll('[data-item-categorie-index]').forEach(select => {
          select.addEventListener('change', () => {
            const i = parseInt(select.dataset.itemCategorieIndex, 10);
            q.items = Array.isArray(q.items) ? [...q.items] : [];
            q.items[i] = { ...(q.items[i] || {}), categorieIndex: select.value === '' ? null : parseInt(select.value, 10) };
            rafraichirClassement();
          });
        });
        const btnAjouterItem = qEl.querySelector('[data-ajouter-item-classement]');
        if (btnAjouterItem) btnAjouterItem.addEventListener('click', () => {
          q.items = [...(q.items || []), { mot: '', categorieIndex: null }];
          rafraichirClassement();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-item-classement]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerItemClassement, 10);
            q.items.splice(i, 1);
            rafraichirClassement();
            rerender();
          });
        });
      }
    });
  }

  if (btnAjouterQuestion) {
    btnAjouterQuestion.disabled = true; // le temps que le corrigé charge, pour ne rien écraser
    btnAjouterQuestion.addEventListener('click', () => {
      if (!corrigeActuel) return;
      const nouvelleQuestion = { id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), type: 'qcm', enonce: '', options: ['', ''] };
      majQuestions([...questions(), nouvelleQuestion]);
      corrigeActuel[nouvelleQuestion.id] = { points: 1 };
      sauvegarderCorrige();
      rerender();
    });
  }

  supabaseClient.from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle()
    .then(({ data }) => {
      corrigeActuel = (data && data.corrige) || {};
      if (etatCorrigeEl) etatCorrigeEl.remove();
      if (btnAjouterQuestion) btnAjouterQuestion.disabled = false;
      rerender();
    });
}

async function ajouterBlocDevoir(devoirId, type) {
  const etat = devoirBlocsEtat[devoirId];
  const listeTypes = etat.conteneurEl.querySelector('[data-liste-types-devoir]');
  if (listeTypes) listeTypes.style.display = 'none';

  const ordre = etat.blocs.length ? Math.max(...etat.blocs.map(b => b.ordre)) + 1 : 0;
  const { data, error } = await supabaseClient.from('blocs_seance')
    .insert({ devoir_id: devoirId, type_bloc: type, contenu: {}, ordre }).select().single();
  if (error) { alert(error.message); return; }
  etat.blocs.push(data);
  rendreBlocsDevoir(devoirId);
}

async function dupliquerBlocDevoir(devoirId, bloc) {
  const etat = devoirBlocsEtat[devoirId];
  const ordre = etat.blocs.length ? Math.max(...etat.blocs.map(b => b.ordre)) + 1 : 0;
  const { data, error } = await supabaseClient.from('blocs_seance')
    .insert({ devoir_id: devoirId, type_bloc: bloc.type_bloc, contenu: bloc.contenu, ordre }).select().single();
  if (error) { alert(error.message); return; }

  if (['exercice', 'quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
    const { data: corrigeOriginal } = await supabaseClient.from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle();
    if (corrigeOriginal) await supabaseClient.from('corriges_exercices').insert({ bloc_id: data.id, corrige: corrigeOriginal.corrige });
  }
  etat.blocs.push(data);
  rendreBlocsDevoir(devoirId);
}

function supprimerBlocDevoir(devoirId, bloc) {
  if (!confirm('Supprimer ce bloc ? Les réponses des élèves déjà données pour ce bloc seront supprimées aussi.')) return;
  supabaseClient.from('blocs_seance').delete().eq('id', bloc.id).then(({ error }) => {
    if (error) { alert(error.message); return; }
    const etat = devoirBlocsEtat[devoirId];
    etat.blocs = etat.blocs.filter(b => b.id !== bloc.id);
    rendreBlocsDevoir(devoirId);
  });
}
