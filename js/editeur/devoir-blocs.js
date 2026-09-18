// Éditeur de blocs pour un devoir (exercice / correction / quiz / évaluation
// / activité). Réutilise les mêmes types de blocs et le même éditeur de
// questions/corrigé que l'éditeur de séance (js/editeur/blocs.js : infoType,
// teinteClaire, echapper, html_questionEditeur, html_editeurTexteRiche...),
// en version volontairement plus simple : pas de palier (concept propre à la
// progression dans une séance), pas de glisser-déposer, pas de blocs de
// cours (texte, image, tableau...), pas d'assistant IA de rédaction.
//
// Deux familles de blocs, depuis le 11 septembre 2026 (2e requête groupée du
// jour, même remodelage que côté séance — voir js/editeur/blocs.js et
// js/pages/eleve-seance.js) :
// - 'exercice'/'correction' : texte libre (comme "Texte"), l'exercice étant
//   suivi d'un bloc "Correction" masqué/révélé côté élève. Contrairement à
//   la séance (contenu purement passif, sans envoi), un devoir "exercice"
//   attend quand même une réponse de l'élève : elle est recueillie en texte
//   libre (+ pièce jointe) et corrigée À LA MAIN par l'enseignant — même
//   mécanisme (table rendus_activites, champs note/bareme/appréciation/
//   commentaire) que le bloc "activité" historique, réutilisé tel quel (voir
//   ouvrirCorrectionActiviteDevoir dans js/devoirs-notes-rendu.js et
//   rendreExerciceLibreDevoir/attacherEcouteursExercicesLibresDevoir dans
//   js/pages/eleve-devoir-rendu.js) plutôt que d'inventer un second circuit.
// - 'quiz'/'evaluation'/'activite' : inchangés — questions structurées avec
//   corrigé (barème/bonne réponse/commentaire) dans corriges_exercices,
//   notées automatiquement dès que l'élève valide (Edge Function
//   corriger-exercice) — c'est le "barème pour la correction automatique"
//   déjà existant, juste rendu plus visible par ce remodelage.
//
// Contrairement à l'éditeur de séance (pages/editeur-seance.html, réservé aux
// admins via requireAdmin()), ce module est appelé depuis les pages
// "Devoirs & notes" enseignant ET admin : l'appelant doit avoir déjà vérifié
// que l'utilisateur peut gérer ce devoir avant d'appeler initEditeurBlocsDevoir
// — les policies RLS protègent aussi côté serveur en cas d'oubli.

// 'probleme' ajouté le 11 septembre 2026 (remplacement v2 du bloc Problème,
// demande explicite du porteur du projet : "seance et devoir c'est ma
// préférence pour le bloc problème") — voir js/editeur/blocs.js pour le
// moteur partagé (parsing d'équation + génération de grille de calcul posé)
// et attacherEcouteursProblemeDevoir plus bas pour le câblage propre au
// devoir (mêmes fonctions que côté séance, juste raccordées aux fonctions
// de sauvegarde/réaffichage de CE fichier).
// 18 septembre 2026 : "Retire les autres blocs et maintiens uniquement en
// plus du bloc Devoir, les blocs Problème, Activités et Evaluation" — 'quiz'
// et 'correction' retirés du menu "+ Ajouter un bloc" (vérifié : 0 bloc
// devoir existant de ces deux types en production, aucune donnée affectée ;
// le rendu des blocs EXISTANTS, lui, reste géré par infoType()/html_corpsBlocDevoir
// indépendamment de cette liste, donc un ancien bloc quiz/correction resterait
// affichable s'il existait). 'exercice' reste le type réel en base, renommé
// "Devoir" à l'affichage uniquement — voir infoTypeDevoir() dans
// js/devoirs-notes-rendu.js, "l'enseignant est libre de proposer ce qu'il veut"
// avec ce bloc (texte libre, comme avant).
const TYPES_BLOCS_DEVOIR = ['exercice', 'probleme', 'evaluation', 'activite'];
// Types de blocs devoir qui utilisent l'éditeur de texte libre (comme un
// bloc "Texte" de séance) plutôt que l'éditeur de questions structurées.
const TYPES_BLOCS_DEVOIR_TEXTE_LIBRE = ['exercice', 'correction'];

let devoirBlocsEtat = {}; // devoirId -> { blocs, conteneurEl, minuteriesBloc }
let minuteriesCorrigeDevoir = {}; // blocId -> timer (partagé, blocId est unique dans toute la table)

async function initEditeurBlocsDevoir(devoirId, conteneurEl) {
  devoirBlocsEtat[devoirId] = { blocs: [], conteneurEl, minuteriesBloc: {}, competencesDisponibles: [] };
  await chargerCompetencesDisponiblesDevoir(devoirId);
  await chargerBlocsDevoir(devoirId);
  rendreBlocsDevoir(devoirId);
}

// Compétences actives du référentiel pour la classe/matière de ce devoir
// (Phase 2 "Accompagnement personnalisé", Premium) — transversales incluses
// (classe_id null). Chargé une seule fois par devoir, avant les blocs.
async function chargerCompetencesDisponiblesDevoir(devoirId) {
  const { data: devoir } = await supabaseClient.from('devoirs').select('classe_id, champ_formation_id').eq('id', devoirId).single();
  if (!devoir) return;
  const { data: competences } = await supabaseClient.from('competences').select('id, intitule, domaine, ordre')
    .eq('champ_formation_id', devoir.champ_formation_id).eq('actif', true)
    .or(`classe_id.eq.${devoir.classe_id},classe_id.is.null`)
    .order('domaine').order('ordre');
  devoirBlocsEtat[devoirId].competencesDisponibles = competences || [];
}

async function chargerBlocsDevoir(devoirId) {
  const { data } = await supabaseClient.from('blocs_seance').select('*').eq('devoir_id', devoirId).order('ordre');
  const liste = data || [];

  // Compétences déjà rattachées à chaque bloc (table de liaison, jamais dans
  // bloc.contenu — même principe que côté éditeur de séance).
  const idsBlocs = liste.map(b => b.id);
  if (idsBlocs.length) {
    const { data: liens } = await supabaseClient.from('blocs_competences').select('bloc_id, competence_id').in('bloc_id', idsBlocs);
    const idsParBloc = {};
    (liens || []).forEach(l => { (idsParBloc[l.bloc_id] ??= []).push(l.competence_id); });
    liste.forEach(b => { b.competencesIds = idsParBloc[b.id] || []; });
  }

  devoirBlocsEtat[devoirId].blocs = liste;
}

function rendreBlocsDevoir(devoirId) {
  const etat = devoirBlocsEtat[devoirId];
  if (!etat) return;
  const { blocs, conteneurEl } = etat;

  conteneurEl.innerHTML = `
    <div class="liste-blocs-devoir">
      ${blocs.length ? blocs.map(b => html_ligneBlocDevoir(b, etat.competencesDisponibles)).join('') : '<p class="note-future">Aucun bloc pour l\'instant — ajoute un exercice, un quiz, une évaluation ou une activité.</p>'}
    </div>
    <div class="menu-ajout-bloc-devoir" style="position:relative;margin-top:10px">
      <button type="button" class="btn btn-discret" data-toggle-ajout-devoir>+ Ajouter un bloc</button>
      <div class="liste-types-devoir" data-liste-types-devoir style="display:none;position:absolute;background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:10;padding:6px;min-width:190px">
        ${TYPES_BLOCS_DEVOIR.map(t => {
          const info = infoTypeDevoir(t);
          return `<button type="button" class="item-type-devoir" data-ajouter-type-devoir="${t}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px;border:none;background:none;cursor:pointer;border-radius:6px;font-size:13px">${info.icone} ${info.label}</button>`;
        }).join('')}
      </div>
    </div>
  `;

  attacherEcouteursBlocsDevoir(devoirId);
}

function html_ligneBlocDevoir(b, competencesDisponibles) {
  const info = infoTypeDevoir(b.type_bloc);
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
      <div class="bloc-corps">${html_corpsBlocDevoir(b, competencesDisponibles)}</div>
    </div>`;
}

function html_corpsBlocDevoir(bloc, competencesDisponibles) {
  const c = bloc.contenu || {};
  // "exercice" a droit à l'option HTML brut (voir html_editeurExerciceLibre
  // dans blocs.js) ; "correction" reste un texte riche classique.
  if (bloc.type_bloc === 'exercice') return html_editeurExerciceLibre(bloc, c);
  if (TYPES_BLOCS_DEVOIR_TEXTE_LIBRE.includes(bloc.type_bloc)) {
    return html_editeurTexteRiche(bloc, c);
  }
  if (bloc.type_bloc === 'probleme') return html_editeurProbleme(bloc, c);
  const questions = Array.isArray(c.questions) ? c.questions : [];
  return `
    <div class="champ-consigne-riche">
      <label class="etiquette-outils">Consigne générale (ex : Réponds aux questions suivantes)</label>
      ${html_zoneTexteRiche('data-champ-devoir-riche="consigne"', c.consigne)}
    </div>
    ${html_selectCompetencesBloc(bloc, competencesDisponibles || [])}
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

    // Champs simples (ex. data-champ="code" du mode HTML brut de l'exercice
    // — voir html_editeurExerciceLibre dans blocs.js) — même wiring générique
    // que js/pages/editeur-seance.js.
    el.querySelectorAll(':scope > .bloc-corps [data-champ]').forEach(champEl => {
      champEl.addEventListener('input', () => {
        bloc.contenu = { ...bloc.contenu, [champEl.dataset.champ]: champEl.value };
        sauvegarderBlocDevoir(devoirId, bloc);
      });
    });

    // Case "HTML brut" du bloc Exercice (11 septembre 2026) — bascule un
    // champ structurel, donc réaffichage complet du bloc (voir le même
    // commentaire dans js/pages/editeur-seance.js).
    const caseHtmlBrutExerciceDevoir = el.querySelector(':scope > .bloc-corps [data-champ-case-html-brut]');
    if (caseHtmlBrutExerciceDevoir) {
      caseHtmlBrutExerciceDevoir.addEventListener('change', () => {
        bloc.contenu = { ...bloc.contenu, htmlBrut: caseHtmlBrutExerciceDevoir.checked };
        sauvegarderBlocDevoir(devoirId, bloc);
        rendreBlocsDevoir(devoirId);
      });
    }

    // Consigne générale du bloc (quiz/évaluation/activité) : zone de texte
    // riche depuis le 5 septembre 2026 (même formatage — gras/italique/
    // listes/couleurs — que côté éditeur de séance, voir
    // html_zoneTexteRiche/configurerZoneRiche dans blocs.js).
    const zoneConsigneRiche = el.querySelector('[data-champ-devoir-riche="consigne"]');
    if (zoneConsigneRiche) {
      const barresOutilsConsigne = Array.from(el.querySelectorAll(':scope > .bloc-corps .barre-outils-texte'));
      configurerZoneRiche(zoneConsigneRiche, barresOutilsConsigne, (html) => {
        bloc.contenu = { ...bloc.contenu, consigne: html };
        sauvegarderBlocDevoir(devoirId, bloc);
      });
    }

    // Texte libre du bloc (exercice/correction, 11 septembre 2026) — même
    // attribut générique data-champ-riche que côté éditeur de séance (voir
    // html_editeurTexteRiche dans blocs.js), câblage identique à
    // editeur-seance.js pour ne pas faire diverger la logique.
    const zoneTexteLibre = el.querySelector(':scope > .bloc-corps [data-champ-riche]');
    if (zoneTexteLibre) {
      const barresOutilsTexteLibre = Array.from(el.querySelectorAll(':scope > .bloc-corps .barre-outils-texte'));
      configurerZoneRiche(zoneTexteLibre, barresOutilsTexteLibre, (html) => {
        bloc.contenu = { ...bloc.contenu, [zoneTexteLibre.dataset.champRiche]: html };
        sauvegarderBlocDevoir(devoirId, bloc);
      });
    }

    el.querySelectorAll('[data-action-bloc-devoir]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.actionBlocDevoir === 'dupliquer') dupliquerBlocDevoir(devoirId, bloc);
        if (btn.dataset.actionBlocDevoir === 'supprimer') supprimerBlocDevoir(devoirId, bloc);
      });
    });

    // Compétences travaillées (Phase 2 "Accompagnement personnalisé", Premium)
    // — même principe que côté éditeur de séance : écriture immédiate dans la
    // table de liaison blocs_competences, jamais dans bloc.contenu.
    el.querySelectorAll('[data-competence-bloc]').forEach(caseCompetence => {
      caseCompetence.addEventListener('change', async () => {
        const competenceId = parseInt(caseCompetence.dataset.competenceBloc, 10);
        bloc.competencesIds = Array.isArray(bloc.competencesIds) ? bloc.competencesIds : [];
        if (caseCompetence.checked) {
          if (!bloc.competencesIds.includes(competenceId)) {
            const { error } = await supabaseClient.from('blocs_competences').insert({ bloc_id: bloc.id, competence_id: competenceId });
            if (error) { caseCompetence.checked = false; alert(error.message); return; }
            bloc.competencesIds.push(competenceId);
          }
        } else {
          const { error } = await supabaseClient.from('blocs_competences').delete().eq('bloc_id', bloc.id).eq('competence_id', competenceId);
          if (error) { caseCompetence.checked = true; alert(error.message); return; }
          bloc.competencesIds = bloc.competencesIds.filter(id => id !== competenceId);
        }
      });
    });

    if (['quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
      attacherEcouteursQuestionsDevoir(devoirId, el, bloc);
    }
    if (bloc.type_bloc === 'probleme') {
      attacherEcouteursProblemeDevoir(devoirId, el, bloc);
    }
  });
}

// Câblage du bloc "Problème" v2 côté devoir — même logique que
// attacherEcouteursProbleme dans js/pages/editeur-seance.js (moteur partagé
// dans js/editeur/blocs.js), juste raccordée à sauvegarderBlocDevoir/
// rendreBlocsDevoir plutôt qu'aux globales de l'éditeur de séance. Les champs
// génériques (énoncé riche, donneesManuelles/inconnuesManuelles) sont déjà
// couverts par le câblage générique juste au-dessus (zoneTexteLibre / boucle
// data-champ) — seuls les réglages spécifiques et le tableau de résolution
// (indexé par ligne) ont besoin d'un câblage dédié ici.
function attacherEcouteursProblemeDevoir(devoirId, el, bloc) {
  const corps = el.querySelector(':scope > .bloc-corps [data-lignes-probleme]');
  if (!corps) return;
  const c = () => bloc.contenu || {};

  const lignesActuelles = () => {
    const l = c().lignes;
    return Array.isArray(l) && l.length ? l.map(x => ({ ...x })) : [problemeLigneParDefaut()];
  };
  const declencherRerendu = (nouveauxChamps) => {
    bloc.contenu = { ...c(), ...nouveauxChamps };
    sauvegarderBlocDevoir(devoirId, bloc);
    rendreBlocsDevoir(devoirId);
  };

  ['modeAffichage', 'prepMode', 'explicationPos'].forEach(champ => {
    const select = el.querySelector(`:scope > .bloc-corps [data-champ-probleme="${champ}"]`);
    if (select) select.addEventListener('change', () => declencherRerendu({ [champ]: select.value }));
  });

  const casePoseParEleve = el.querySelector(':scope > .bloc-corps [data-champ-case-probleme="poseParEleve"]');
  if (casePoseParEleve) casePoseParEleve.addEventListener('change', () => {
    bloc.contenu = { ...c(), poseParEleve: casePoseParEleve.checked };
    sauvegarderBlocDevoir(devoirId, bloc);
  });

  const rafraichirApercus = (lignes, iEquationSeule) => {
    if (typeof iEquationSeule === 'number') {
      const apercu = corps.querySelector(`[data-apercu-grille-probleme="${iEquationSeule}"]`);
      const apercuResultat = corps.querySelector(`[data-apercu-resultat-probleme="${iEquationSeule}"]`);
      const analyse = problemeAnalyserEquation(lignes[iEquationSeule].equation);
      const idPrefixe = `probleme-devoir-${bloc.id}-${iEquationSeule}`;
      if (apercu) {
        apercu.innerHTML = analyse
          ? problemeGenererGrilleHtml(analyse, { interactif: false, prefixeId: idPrefixe })
          : `<p class="operation-vide">Saisissez une équation avec deux nombres et un opérateur (ex : 15 * 24 =) pour générer la grille.</p>`;
      }
      if (apercuResultat) apercuResultat.innerHTML = problemeResultatBoiteHtml(analyse, { prefixeId: idPrefixe });
    }
    if ((c().prepMode || 'auto') !== 'manuel') {
      const { donnees, inconnues } = problemeCalculerDonneesInconnues(lignes);
      const ulDonnees = el.querySelector(':scope > .bloc-corps [data-liste-donnees-probleme]');
      if (ulDonnees) ulDonnees.innerHTML = donnees.length ? donnees.map(d => `<li>${d}</li>`).join('') : '<li><em>Saisissez une équation…</em></li>';
      const ulInconnues = el.querySelector(':scope > .bloc-corps [data-liste-inconnues-probleme]');
      if (ulInconnues) ulInconnues.innerHTML = inconnues.length ? inconnues.map(u => `<li>${echapper(u)}</li>`).join('') : '<li><em>Saisissez une étape…</em></li>';
    }
  };

  corps.querySelectorAll('[data-probleme-champ="description"]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      const i = parseInt(champEl.dataset.problemeLigne, 10);
      const lignes = lignesActuelles();
      if (!lignes[i]) return;
      lignes[i].description = champEl.innerHTML;
      bloc.contenu = { ...c(), lignes };
      sauvegarderBlocDevoir(devoirId, bloc);
      rafraichirApercus(lignes);
    });
  });

  corps.querySelectorAll('[data-probleme-champ="equation"]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      const i = parseInt(champEl.dataset.problemeLigne, 10);
      const lignes = lignesActuelles();
      if (!lignes[i]) return;
      lignes[i].equation = champEl.value;
      bloc.contenu = { ...c(), lignes };
      sauvegarderBlocDevoir(devoirId, bloc);
      rafraichirApercus(lignes, i);
    });
  });

  corps.querySelectorAll('[data-probleme-champ="explication"]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      const i = parseInt(champEl.dataset.problemeLigne, 10);
      const lignes = lignesActuelles();
      if (!lignes[i]) return;
      lignes[i].explication = champEl.value;
      bloc.contenu = { ...c(), lignes };
      sauvegarderBlocDevoir(devoirId, bloc);
    });
  });

  const boutonAjouterLigne = el.querySelector(':scope > .bloc-corps [data-action-probleme="ajouter-ligne"]');
  if (boutonAjouterLigne) boutonAjouterLigne.addEventListener('click', () => {
    declencherRerendu({ lignes: [...lignesActuelles(), problemeLigneParDefaut()] });
  });

  corps.querySelectorAll('[data-action-probleme="supprimer-ligne"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (lignesActuelles().length <= 1) return alert('Le tableau doit garder au moins une étape de résolution.');
      const i = parseInt(btn.dataset.problemeLigne, 10);
      const lignes = lignesActuelles();
      lignes.splice(i, 1);
      declencherRerendu({ lignes });
    });
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
        if (q.type === 'intrus_lexical' && !Array.isArray(q.series)) q.series = [{ mots: ['', '', ''] }];
        if (q.type === 'texte_a_trous_glisser' && !Array.isArray(q.banqueMots)) q.banqueMots = [];
        majQuestions(questions());
        if (c) sauvegarderCorrige();
        rerender();
      });

      // Énoncé : soit un simple textarea texte brut (types dont le texte est
      // analysé littéralement — texte à trous, sa variante glisser-déposer,
      // sélection de mots), soit une zone de texte riche (tous les autres
      // types) — voir TYPES_ENONCE_PLAT et html_questionEditeur dans blocs.js.
      // Les deux ne coexistent jamais pour une même question : garder les
      // deux blocs sous garde (if) plutôt qu'un querySelector non vérifié,
      // qui plantait ici pour tout type autre que texte_a_trous.
      const inputEnonce = qEl.querySelector('[data-question-champ="enonce"]');
      if (inputEnonce) inputEnonce.addEventListener('input', (e) => {
        q.enonce = e.target.value;
        majQuestions(questions());
      });
      const zoneEnonceRiche = qEl.querySelector('[data-question-champ-riche="enonce"]');
      if (zoneEnonceRiche) {
        const barresOutilsQuestion = Array.from(qEl.querySelectorAll('.barre-outils-texte-question'));
        configurerZoneRiche(zoneEnonceRiche, barresOutilsQuestion, (html) => {
          q.enonce = html;
          majQuestions(questions());
        });
      }
      const inputConsigne = qEl.querySelector('[data-question-champ="consigne"]');
      if (inputConsigne) inputConsigne.addEventListener('input', (e) => {
        q.consigne = e.target.value;
        majQuestions(questions());
      });
      if (['texte_a_trous', 'texte_a_trous_glisser', 'selection_mots'].includes(q.type)) {
        // Nombre de trous (ou liste de mots cliquables) recalculé au blur
        // seulement (pas au input), sinon le champ énoncé perdrait le focus
        // à chaque frappe (même logique dans js/pages/editeur-seance.js).
        if (inputEnonce) inputEnonce.addEventListener('blur', () => rerender());
      }

      const inputPoints = qEl.querySelector('[data-question-points]');
      if (inputPoints) inputPoints.addEventListener('input', () => {
        if (!c) return;
        c.points = parseFloat(inputPoints.value) || 0;
        sauvegarderCorrige();
      });

      // Commentaire enseignant (11 septembre 2026) — voir html_commentaireQuestion
      // dans blocs.js ; absent du DOM pour reponse_longue/vrai_faux_justifie.
      const texteCommentaire = qEl.querySelector('[data-question-commentaire]');
      if (texteCommentaire) texteCommentaire.addEventListener('input', () => {
        if (!c) return;
        c.commentaire = texteCommentaire.value;
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

      if (q.type === 'vrai_faux' || q.type === 'vrai_faux_justifie') {
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

      if (q.type === 'reponse_longue' || q.type === 'vrai_faux_justifie') {
        const texteBareme = qEl.querySelector('[data-question-bareme]');
        if (texteBareme) texteBareme.addEventListener('input', () => {
          if (!c) return;
          c.bareme = texteBareme.value;
          sauvegarderCorrige();
        });
      }

      if (q.type === 'reponse_numerique') {
        const inputNumValeur = qEl.querySelector('[data-question-numerique-valeur]');
        const inputNumTolerance = qEl.querySelector('[data-question-numerique-tolerance]');
        const majNumerique = () => {
          if (!c) return;
          c.bonneReponse = {
            valeur: inputNumValeur ? parseFloat(inputNumValeur.value) : undefined,
            tolerance: inputNumTolerance ? (parseFloat(inputNumTolerance.value) || 0) : 0,
          };
          sauvegarderCorrige();
        };
        if (inputNumValeur) inputNumValeur.addEventListener('input', majNumerique);
        if (inputNumTolerance) inputNumTolerance.addEventListener('input', majNumerique);
      }

      if (q.type === 'selection_mots') {
        qEl.querySelectorAll('[data-mot-selection-index]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (!c) return;
            const i = parseInt(btn.dataset.motSelectionIndex, 10);
            const estCorrect = btn.classList.toggle('chip-mot-correct');
            const actuel = new Set((Array.isArray(c.bonneReponse) ? c.bonneReponse : []).map(String));
            if (estCorrect) actuel.add(String(i)); else actuel.delete(String(i));
            c.bonneReponse = Array.from(actuel).map(Number).sort((a, b) => a - b);
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'intrus_lexical') {
        qEl.querySelectorAll('[data-serie-intrus-mots]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.serieIntrusMots, 10);
            q.series = Array.isArray(q.series) ? [...q.series] : [];
            const mots = input.value.split(',').map(s => s.trim());
            q.series[i] = { ...(q.series[i] || {}), mots };
            if (c && Array.isArray(c.bonneReponse) && typeof c.bonneReponse[i] === 'number' && c.bonneReponse[i] >= mots.length) {
              c.bonneReponse[i] = undefined;
            }
            majQuestions(questions());
            if (c) sauvegarderCorrige();
          });
          input.addEventListener('blur', () => rerender());
        });
        qEl.querySelectorAll('[data-serie-intrus-radio]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            const i = parseInt(radio.dataset.serieIntrusRadio, 10);
            c.bonneReponse = Array.isArray(c.bonneReponse) ? [...c.bonneReponse] : [];
            c.bonneReponse[i] = parseInt(radio.value, 10);
            sauvegarderCorrige();
          });
        });
        const btnAjouterSerieIntrus = qEl.querySelector('[data-ajouter-serie-intrus]');
        if (btnAjouterSerieIntrus) btnAjouterSerieIntrus.addEventListener('click', () => {
          q.series = [...(q.series || []), { mots: ['', '', ''] }];
          majQuestions(questions());
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-serie-intrus]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerSerieIntrus, 10);
            q.series.splice(i, 1);
            if (c && Array.isArray(c.bonneReponse)) c.bonneReponse.splice(i, 1);
            majQuestions(questions());
            if (c) sauvegarderCorrige();
            rerender();
          });
        });
      }

      if (q.type === 'texte_a_trous_glisser') {
        const inputBanque = qEl.querySelector('[data-question-banque-mots]');
        if (inputBanque) {
          inputBanque.addEventListener('input', () => {
            q.banqueMots = inputBanque.value.split(',').map(s => s.trim()).filter(Boolean);
            majQuestions(questions());
          });
          inputBanque.addEventListener('blur', () => rerender());
        }
        qEl.querySelectorAll('[data-question-trou-glisser-index]').forEach(select => {
          select.addEventListener('change', () => {
            if (!c) return;
            const i = parseInt(select.dataset.questionTrouGlisserIndex, 10);
            c.bonneReponse = Array.isArray(c.bonneReponse) ? [...c.bonneReponse] : [];
            c.bonneReponse[i] = select.value || null;
            sauvegarderCorrige();
          });
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

  if (['quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
    const { data: corrigeOriginal } = await supabaseClient.from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle();
    if (corrigeOriginal) await supabaseClient.from('corriges_exercices').insert({ bloc_id: data.id, corrige: corrigeOriginal.corrige });
  }
  if (Array.isArray(bloc.competencesIds) && bloc.competencesIds.length) {
    await supabaseClient.from('blocs_competences').insert(
      bloc.competencesIds.map(competenceId => ({ bloc_id: data.id, competence_id: competenceId }))
    );
    data.competencesIds = [...bloc.competencesIds];
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
