// Page pages/admin/questions-ia-jeux.html — Requête P, partie 2 (24
// septembre 2026) : génération par IA de questions d'entraînement pour les
// jeux d'arcade Français/ES/EST (js/jeux/moteur-jeu-arcade.js), à partir
// d'une séance publiée réelle de la classe visée — TOUJOURS relues et
// validées ici avant qu'un élève ne puisse y accéder (table
// questions_ia_generees, servie côté élève par la Edge Function
// "jeu-ia-questions", jamais lue directement par le client élève).
//
// Modelé sur le même principe que pages/admin/competences.html
// (action "proposerCompetences" de l'edge function assistant-ia) : l'IA ne
// fait QUE proposer, rien n'est jamais inséré en base avant que l'admin
// n'ait relu et coché les questions à garder. Réutilise ici l'action
// "genererActivite" DÉJÀ existante de assistant-ia (déjà utilisée par
// l'éditeur de séance pour générer questions+corrigé d'un bloc exercice) —
// aucune modification de la Edge Function n'a été nécessaire pour ce lot.
//
// construireQuestionDepuisIA ci-dessous est une copie ADAPTÉE de la fonction
// du même nom dans js/pages/editeur-seance.js (même logique, mêmes types de
// question) — dupliquée plutôt que partagée, sur le modèle déjà établi par
// ce projet, pour ne prendre aucun risque de régression sur l'éditeur de
// séance. Dépend de recalculerAssociation/recalculerClassement
// (js/editeur/blocs.js) et de jeuRendreEnonce/jeuTexteBonneReponse
// (js/jeux/rendu-questions-jeu.js) pour l'aperçu — tous deux chargés avant ce
// fichier sur cette page.

let profilAdminQia = null;
let champsFormationQia = [];
let classesQia = [];
let champSelectionneQia = null; // id (number)
let classeSelectionneeQia = 'toutes';
let questionsQiaTous = [];

// Seules ces 3 matières sont concernées par cette fonctionnalité (demande
// explicite : "Français, EST, ES en dehors de celles déjà disponibles").
const CHAMPS_IDS_QIA = [1, 3, 4];

const PALIERS_QIA = [
  { code: 'azovi', nom: 'Azɔ̀ví (très facile)' },
  { code: 'devi', nom: 'Dèví (moyen)' },
  { code: 'ogan', nom: 'Ògán (difficile)' },
  { code: 'axosu', nom: 'Axɔ́sú (très difficile)' },
];

// Mêmes 5 codes/libellés que categoriesDisponibles dans
// js/pages/eleve-jeu-atelier-francais.js — indispensable que les codes
// correspondent exactement, puisque la Edge Function "jeu-ia-questions"
// filtre par comparaison exacte sur questions_ia_generees.discipline.
const CATEGORIES_FRANCAIS_QIA = [
  { code: 'conjugaison', label: '⏳ Conjugaison' },
  { code: 'grammaire', label: '🧩 Grammaire' },
  { code: 'orthographe', label: '✍️ Orthographe' },
  { code: 'vocabulaire', label: '📚 Vocabulaire' },
  { code: 'expression', label: '📝 Expression' },
];

const LIBELLES_TYPE_QUESTION_QIA = {
  qcm: 'QCM', qcm_multiple: 'QCM (plusieurs réponses)', vrai_faux: 'Vrai/Faux',
  reponse_courte: 'Réponse courte', texte_a_trous: 'Texte à trous',
  remise_en_ordre: 'Remise en ordre', association: 'Association', classement: 'Classement',
};

async function init() {
  profilAdminQia = await requireAdmin();
  if (!profilAdminQia) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminQia.id,
    badgeHtml: `${profilAdminQia.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperQia(profilAdminQia.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminQia.est_super_admin })
  });

  const [{ data: champs }, { data: classes }] = await Promise.all([
    supabaseClient.from('champs_formation').select('*').in('id', CHAMPS_IDS_QIA).eq('actif', true).order('id'),
    supabaseClient.from('classes').select('*').order('ordre')
  ]);
  champsFormationQia = champs || [];
  classesQia = classes || [];

  if (!champsFormationQia.length) {
    document.getElementById('contenu').innerHTML = '<p class="chargement">Aucune des matières concernées (Français, Éducation Sociale, Éducation Scientifique et Technologique) n\'est configurée.</p>';
    return;
  }

  champSelectionneQia = champsFormationQia[0].id;
  await chargerQuestionsQia();
}

async function chargerQuestionsQia() {
  const { data } = await supabaseClient.from('questions_ia_generees').select('*')
    .eq('champ_formation_id', champSelectionneQia).order('classe_id').order('palier').order('id');
  let liste = data || [];
  if (classeSelectionneeQia !== 'toutes') {
    const idClasse = parseInt(classeSelectionneeQia, 10);
    liste = liste.filter(q => q.classe_id === idClasse);
  }
  questionsQiaTous = liste;
  rendreQuestionsQia();
}

function rendreQuestionsQia() {
  const classesParId = {};
  classesQia.forEach(c => { classesParId[c.id] = c; });
  const palierNom = code => (PALIERS_QIA.find(p => p.code === code) || {}).nom || code;

  const groupes = {};
  questionsQiaTous.forEach(q => {
    const cle = `${q.classe_id}__${q.palier}__${q.discipline || ''}`;
    (groupes[cle] ??= { classeId: q.classe_id, palier: q.palier, discipline: q.discipline, lignes: [] }).lignes.push(q);
  });

  const contenu = document.getElementById('contenu');
  contenu.innerHTML = `
    <div class="filtres-qia">
      <select id="qiaSelectChamp">
        ${champsFormationQia.map(c => `<option value="${c.id}" ${c.id === champSelectionneQia ? 'selected' : ''}>${echapperQia(c.nom)}</option>`).join('')}
      </select>
      <select id="qiaSelectClasse">
        <option value="toutes" ${classeSelectionneeQia === 'toutes' ? 'selected' : ''}>Toutes les classes</option>
        ${classesQia.map(c => `<option value="${c.id}" ${classeSelectionneeQia === String(c.id) ? 'selected' : ''}>${echapperQia(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div class="barre-actions-qia">
      <button type="button" class="btn btn-primaire" id="qiaBtnGenerer">🤖 Générer des questions avec l'IA</button>
    </div>
    <div id="qiaListeGroupes">
      ${Object.keys(groupes).length ? Object.values(groupes).map(g => `
        <div class="groupe-qia">
          <h3>${echapperQia(classesParId[g.classeId]?.nom || '?')} · ${echapperQia(palierNom(g.palier))}${g.discipline ? ` · ${echapperQia((CATEGORIES_FRANCAIS_QIA.find(c => c.code === g.discipline) || {}).label || g.discipline)}` : ''} (${g.lignes.length})</h3>
          ${g.lignes.map(q => htmlCarteQuestionQia(q)).join('')}
        </div>`).join('') : '<p class="chargement">Aucune question générée pour l\'instant pour cette matière.</p>'}
    </div>`;

  document.getElementById('qiaSelectChamp').addEventListener('change', async (e) => {
    champSelectionneQia = parseInt(e.target.value, 10);
    await chargerQuestionsQia();
  });
  document.getElementById('qiaSelectClasse').addEventListener('change', async (e) => {
    classeSelectionneeQia = e.target.value;
    await chargerQuestionsQia();
  });
  document.getElementById('qiaBtnGenerer').addEventListener('click', ouvrirGenererQia);

  contenu.querySelectorAll('[data-qia-archiver]').forEach(btn => {
    btn.addEventListener('click', () => basculerStatutQia(parseInt(btn.dataset.qiaArchiver, 10), 'archive'));
  });
  contenu.querySelectorAll('[data-qia-reactiver]').forEach(btn => {
    btn.addEventListener('click', () => basculerStatutQia(parseInt(btn.dataset.qiaReactiver, 10), 'valide'));
  });
  contenu.querySelectorAll('[data-qia-supprimer]').forEach(btn => {
    btn.addEventListener('click', () => supprimerQuestionQia(parseInt(btn.dataset.qiaSupprimer, 10)));
  });
}

function htmlCarteQuestionQia(q) {
  const question = q.question || {};
  const type = LIBELLES_TYPE_QUESTION_QIA[question.type] || question.type;
  const bonneReponse = jeuTexteBonneReponse(question, q.corrige || {});
  return `
    <div class="carte-question-qia ${q.statut === 'archive' ? 'archivee' : ''}">
      <div class="entete-question-qia">
        <div>
          <span class="pastille-qia">${echapperQia(type)}</span>${q.statut === 'archive' ? '<span class="pastille-qia" style="background:#e5e7eb;color:#374151">Archivée</span>' : ''}
          <p>${jeuRendreEnonce(question)}</p>
          <p class="bonne-reponse-qia">✅ ${echapperQia(bonneReponse)}</p>
        </div>
        <div class="actions-question-qia">
          ${q.statut === 'valide'
            ? `<button type="button" data-qia-archiver="${q.id}">🗄️ Archiver</button>`
            : `<button type="button" data-qia-reactiver="${q.id}">♻️ Réactiver</button>`}
          <button type="button" data-qia-supprimer="${q.id}">🗑️</button>
        </div>
      </div>
    </div>`;
}

async function basculerStatutQia(id, statut) {
  const { error } = await supabaseClient.from('questions_ia_generees').update({ statut }).eq('id', id);
  if (error) return alert(error.message);
  await chargerQuestionsQia();
}

async function supprimerQuestionQia(id) {
  if (!confirm('Supprimer définitivement cette question ? Cette action est irréversible.')) return;
  const { error } = await supabaseClient.from('questions_ia_generees').delete().eq('id', id);
  if (error) return alert(error.message);
  await chargerQuestionsQia();
}

// --- Génération IA ------------------------------------------------------

function ouvrirGenererQia() {
  ouvrirModal({
    titre: "🤖 Générer des questions avec l'IA",
    champs: [
      { nom: 'champ_formation_id', label: 'Matière', type: 'select', valeur: champSelectionneQia, options: champsFormationQia.map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'classe_id', label: 'Classe', type: 'select', options: classesQia.map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'palier', label: 'Niveau de difficulté', type: 'select', options: PALIERS_QIA.map(p => ({ valeur: p.code, label: p.nom })) },
      { nom: 'nombre', label: 'Nombre de questions à proposer (1 à 12)', type: 'number', valeur: 6 },
    ],
    texteValider: 'Continuer',
    onValider: async (valeurs) => {
      const champFormationId = parseInt(valeurs.champ_formation_id, 10);
      await ouvrirChoixSeanceQia(
        champFormationId, parseInt(valeurs.classe_id, 10), valeurs.palier,
        Math.max(1, Math.min(12, parseInt(valeurs.nombre, 10) || 6)),
      );
    }
  });
}

// La "Catégorie" (discipline, Français uniquement) n'est demandée qu'ici,
// pas dans ouvrirGenererQia : à ce stade, champFormationId est une valeur
// déjà résolue (reçue en paramètre, plus un champ de formulaire modifiable
// par l'admin dans CETTE modale) — évite l'incohérence où l'admin changerait
// la matière du select "Matière" de la modale précédente vers Français sans
// que le champ Catégorie, décidé avant ouverture de cette première modale,
// n'ait eu l'occasion d'apparaître.
async function ouvrirChoixSeanceQia(champFormationId, classeId, palier, nombre) {
  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id').eq('classe_id', classeId).eq('champ_formation_id', champFormationId);
  const idsNoeuds = (noeuds || []).map(n => n.id);
  if (!idsNoeuds.length) return alert('Aucun contenu (unité/séquence) trouvé pour cette matière et cette classe.');

  const { data: sas } = await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds);
  const idsSa = (sas || []).map(s => s.id);
  if (!idsSa.length) return alert('Aucune séquence trouvée pour cette matière et cette classe.');

  const { data: seances } = await supabaseClient.from('seances').select('id, titre, titre_contenu, discipline')
    .in('sa_id', idsSa).eq('statut', 'publie').order('id');
  if (!seances || !seances.length) return alert('Aucune séance publiée trouvée pour cette matière et cette classe.');

  const estFrancais = champFormationId === 1;

  ouvrirModal({
    titre: 'Choisir la séance source',
    champs: [
      {
        nom: 'seance_id', label: 'Séance publiée à analyser (le contenu réellement écrit y sert de base à l\'IA)', type: 'select',
        options: seances.map(s => ({ valeur: s.id, label: `${s.titre}${s.titre_contenu ? ' — ' + s.titre_contenu : ''}${s.discipline ? ' (' + s.discipline + ')' : ''}` }))
      },
      ...(estFrancais ? [{ nom: 'discipline', label: 'Catégorie (filtre du jeu Atelier du Français)', type: 'select', options: CATEGORIES_FRANCAIS_QIA.map(c => ({ valeur: c.code, label: c.label })) }] : []),
    ],
    texteValider: "Analyser avec l'IA",
    onValider: async (valeurs) => {
      const discipline = estFrancais ? valeurs.discipline : null;
      await lancerGenerationQuestionsQia(champFormationId, classeId, parseInt(valeurs.seance_id, 10), palier, discipline, nombre);
    }
  });
}

async function lancerGenerationQuestionsQia(champFormationId, classeId, seanceId, palier, discipline, nombre) {
  const attente = afficherAttenteQia("L'IA analyse le contenu de la séance et prépare des questions, merci de patienter...");
  try {
    const { data: blocs } = await supabaseClient.from('blocs_seance').select('type_bloc, contenu').eq('seance_id', seanceId).order('ordre');
    const contexteSeance = (blocs || []).map(extraireTexteBlocQia).filter(Boolean).join('\n\n');
    if (!contexteSeance.trim()) {
      attente.fermer();
      return alert('Cette séance ne contient pas de texte exploitable pour générer des questions.');
    }

    const champ = champsFormationQia.find(c => c.id === champFormationId);
    const classe = classesQia.find(c => c.id === classeId);

    let requeteExistantes = supabaseClient.from('questions_ia_generees').select('question')
      .eq('champ_formation_id', champFormationId).eq('classe_id', classeId).eq('palier', palier).eq('statut', 'valide');
    if (discipline) requeteExistantes = requeteExistantes.eq('discipline', discipline);
    const { data: existantesRows } = await requeteExistantes;
    const questionsExistantes = (existantesRows || []).map(r => (r.question && r.question.enonce) || '').filter(Boolean);

    const { data, error } = await supabaseClient.functions.invoke('assistant-ia', {
      body: {
        action: 'genererActivite', typeBloc: 'quiz', palier, consigne: '', contexteSeance, nombre,
        instructions: "Ces questions serviront de banque d'entraînement libre pour un jeu, indépendantes d'un bloc précis — restent cohérentes avec le contenu fourni et adaptées au niveau visé.",
        questionsExistantes, classe: classe?.nom, champ: champ?.nom,
      }
    });
    attente.fermer();

    if (error) {
      let message = error.message || "Le service IA n'a pas répondu.";
      try {
        const corps = await error.context?.json?.();
        if (corps?.error) message = corps.error;
      } catch (_ignore) { /* on garde le message par défaut */ }
      return alert(message);
    }
    if (data?.error) return alert(data.error);

    const questionsRecues = Array.isArray(data?.questions) ? data.questions : [];
    if (!questionsRecues.length) return alert("L'IA n'a proposé aucune question exploitable — réessayez avec une autre séance.");

    const propositions = questionsRecues
      .map((qBrute, i) => construireQuestionDepuisIAQia(qBrute, `q_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`))
      .filter(p => p.question);

    if (!propositions.length) return alert("Aucune des questions renvoyées par l'IA n'était exploitable — réessayez.");
    ouvrirRevuePropositionsQia(propositions, champFormationId, classeId, palier, discipline, contexteSeance);
  } catch (e) {
    attente.fermer();
    alert(e.message || 'Erreur inattendue.');
  }
}

// Copie adaptée de construireQuestionDepuisIA (js/pages/editeur-seance.js) —
// voir en tête de fichier pour la justification de cette duplication.
function construireQuestionDepuisIAQia(qBrute, id) {
  const type = qBrute && typeof qBrute.type === 'string' ? qBrute.type : '';
  const enonce = (qBrute && typeof qBrute.enonce === 'string' ? qBrute.enonce : '').trim();
  if (!enonce) return { question: null };
  const consigneIA = (qBrute && typeof qBrute.consigne === 'string' ? qBrute.consigne : '').trim().slice(0, 300);
  const base = { id, type, enonce, consigne: consigneIA };
  const corrigeEntree = {};

  if (type === 'qcm') {
    const options = Array.isArray(qBrute.options) ? qBrute.options.map(String).filter(Boolean) : [];
    const idx = Number.isInteger(qBrute.bonneReponseIndex) ? qBrute.bonneReponseIndex : -1;
    if (options.length < 2 || idx < 0 || idx >= options.length) return { question: null };
    corrigeEntree.bonneReponse = String(idx);
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'qcm_multiple') {
    const options = Array.isArray(qBrute.options) ? qBrute.options.map(String).filter(Boolean) : [];
    const idxs = Array.isArray(qBrute.bonnesReponsesIndex) ? qBrute.bonnesReponsesIndex.filter(i => Number.isInteger(i) && i >= 0 && i < options.length) : [];
    if (options.length < 2 || !idxs.length) return { question: null };
    corrigeEntree.bonneReponse = idxs.map(String);
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'vrai_faux') {
    if (typeof qBrute.bonneReponse !== 'boolean') return { question: null };
    corrigeEntree.bonneReponse = qBrute.bonneReponse;
    return { question: base, corrigeEntree };
  }
  if (type === 'reponse_courte') {
    const reponses = Array.isArray(qBrute.reponsesAcceptees) ? qBrute.reponsesAcceptees.map(String).filter(Boolean) : [];
    if (!reponses.length) return { question: null };
    corrigeEntree.bonneReponse = reponses;
    return { question: base, corrigeEntree };
  }
  if (type === 'texte_a_trous') {
    const nbTrous = (enonce.match(/___/g) || []).length;
    const reponsesParTrou = Array.isArray(qBrute.reponsesParTrou)
      ? qBrute.reponsesParTrou.map(r => (Array.isArray(r) ? r.map(String).filter(Boolean) : [String(r)].filter(Boolean)))
      : [];
    if (!nbTrous || reponsesParTrou.length !== nbTrous || reponsesParTrou.some(r => !r.length)) return { question: null };
    corrigeEntree.bonneReponse = reponsesParTrou;
    return { question: base, corrigeEntree };
  }
  if (type === 'remise_en_ordre') {
    const elements = Array.isArray(qBrute.elementsEnOrdre) ? qBrute.elementsEnOrdre.map(String).filter(Boolean) : [];
    if (elements.length < 2 || new Set(elements).size !== elements.length) return { question: null };
    const options = [...elements];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const bonneReponse = elements.map(texte => options.indexOf(texte));
    corrigeEntree.bonneReponse = bonneReponse;
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'association') {
    const paires = Array.isArray(qBrute.paires)
      ? qBrute.paires.map(p => ({ gauche: String((p && p.gauche) || ''), droite: String((p && p.droite) || '') })).filter(p => p.gauche && p.droite)
      : [];
    if (paires.length < 2) return { question: null };
    const q = { ...base, paires };
    recalculerAssociation(q, corrigeEntree); // dérive q.gauche/q.droite (js/editeur/blocs.js)
    // Divergence DÉLIBÉRÉE par rapport à construireQuestionDepuisIA
    // (js/pages/editeur-seance.js) : on retire q.paires une fois q.gauche/
    // q.droite dérivés. q.paires associe déjà gauche↔droite dans le bon
    // ordre — le laisser dans l'objet "question" stocké reviendrait à
    // envoyer la bonne réponse en clair à l'élève via l'action "lister" de
    // jeu-ia-questions (qui renvoie question mais jamais corrige) : exigence
    // de sécurité propre à ce nouveau service, plus stricte ici que pour une
    // séance normale.
    delete q.paires;
    return { question: q, corrigeEntree };
  }
  if (type === 'classement') {
    const categories = Array.isArray(qBrute.categories) ? qBrute.categories.map(String).filter(Boolean) : [];
    const items = Array.isArray(qBrute.items)
      ? qBrute.items
          .map(it => ({ mot: String((it && it.mot) || ''), categorieIndex: Number.isInteger(it && it.categorieIndex) ? it.categorieIndex : null }))
          .filter(it => it.mot && it.categorieIndex !== null && it.categorieIndex >= 0 && it.categorieIndex < categories.length)
      : [];
    if (categories.length < 2 || items.length < 2) return { question: null };
    const q = { ...base, categories, items };
    recalculerClassement(q, corrigeEntree); // dérive q.motsAClasser (js/editeur/blocs.js)
    // Même divergence délibérée que pour "association" ci-dessus : q.items
    // porte categorieIndex, la bonne réponse en clair — retiré une fois
    // q.motsAClasser dérivé (q.categories, lui, reste : c'est la liste des
    // catégories proposées à l'élève, pas la réponse).
    delete q.items;
    return { question: q, corrigeEntree };
  }
  return { question: null };
}

function extraireTexteBlocQia(bloc) {
  const c = bloc && bloc.contenu ? bloc.contenu : {};
  if (typeof c.texte === 'string' && c.texte.trim()) return stripHtmlQia(c.texte);
  if (Array.isArray(c.questions) && c.questions.length) {
    return c.questions.map(q => (q && typeof q.enonce === 'string' ? q.enonce : '')).filter(Boolean).join('\n');
  }
  return '';
}

function stripHtmlQia(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

function afficherAttenteQia(texte) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-boite" style="text-align:center">⏳ ${echapperQia(texte)}</div>`;
  document.body.appendChild(overlay);
  return { fermer: () => overlay.remove() };
}

// Panneau de relecture : chaque question générée est prévisualisée (énoncé +
// bonne réponse en clair, via jeuRendreEnonce/jeuTexteBonneReponse — les
// mêmes fonctions déjà utilisées côté élève pour l'affichage/le bilan) et
// cochée par défaut ; rien n'est enregistré tant que l'admin n'a pas cliqué
// sur "Ajouter les questions cochées" — même principe que la relecture des
// compétences proposées par l'IA (admin-competences.js).
function ouvrirRevuePropositionsQia(propositions, champFormationId, classeId, palier, discipline, contexteSeance) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite" style="max-width:640px;max-height:82vh;overflow:auto">
      <h3>Questions proposées par l'IA</h3>
      <p style="font-size:13px;color:var(--texte-gris);margin-top:-8px">Relisez chaque question et sa bonne réponse, décochez celles à écarter, puis validez. Rien n'est enregistré tant que vous ne validez pas — un élève ne verra jamais ces questions avant.</p>
      <div id="listePropositionsQia">
        ${propositions.map(({ question }, i) => `
          <div class="carte-proposition-qia" data-proposition-qia="${i}">
            <label class="entete-proposition-qia">
              <input type="checkbox" data-prop-qia-cochee="${i}" checked style="margin-top:4px">
              <div style="flex:1">
                <span class="pastille-qia">${echapperQia(LIBELLES_TYPE_QUESTION_QIA[question.type] || question.type)}</span>
                <p style="margin:6px 0 2px">${jeuRendreEnonce(question)}</p>
                <p class="bonne-reponse-qia">✅ ${echapperQia(jeuTexteBonneReponse(question, propositions[i].corrigeEntree))}</p>
              </div>
            </label>
          </div>`).join('')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-discret" data-fermer-revue-qia>Annuler</button>
        <button type="button" class="btn btn-primaire" data-enregistrer-revue-qia>Ajouter les questions cochées</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-revue-qia]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

  overlay.querySelectorAll('[data-prop-qia-cochee]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.carte-proposition-qia').classList.toggle('exclue', !cb.checked);
    });
  });

  overlay.querySelector('[data-enregistrer-revue-qia]').addEventListener('click', async () => {
    const maintenant = new Date().toISOString();
    const lignes = [];
    propositions.forEach((p, i) => {
      const coche = overlay.querySelector(`[data-prop-qia-cochee="${i}"]`).checked;
      if (!coche) return;
      lignes.push({
        champ_formation_id: champFormationId, classe_id: classeId, discipline: discipline || null, palier,
        question: p.question, corrige: p.corrigeEntree,
        contexte_genere: contexteSeance.slice(0, 2000),
        genere_le: maintenant, genere_par: profilAdminQia.id, valide_par: profilAdminQia.id, valide_le: maintenant,
        statut: 'valide',
      });
    });
    if (!lignes.length) return alert('Cochez au moins une question à ajouter.');

    const { error } = await supabaseClient.from('questions_ia_generees').insert(lignes);
    if (error) return alert(error.message);
    fermer();
    champSelectionneQia = champFormationId;
    classeSelectionneeQia = String(classeId);
    await chargerQuestionsQia();
  });
}

function echapperQia(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
