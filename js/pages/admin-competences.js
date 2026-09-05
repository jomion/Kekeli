// Page pages/admin/competences.html — Phase 2 du système "Accompagnement
// pédagogique personnalisé" (Premium) : CRUD du référentiel de compétences
// (table `competences`) + assistance IA pour proposer des compétences à
// partir d'une séance déjà publiée (edge function assistant-ia, action
// "proposerCompetences"). L'IA ne fait QUE proposer — rien n'est jamais
// inséré en base sans relecture/validation explicite de l'admin ici.

let profilAdminCompetences = null;
let champsFormationCompetences = [];
let classesCompetences = [];
let champSelectionneCompetences = null;   // id (number)
let classeSelectionneeCompetences = 'toutes'; // 'toutes' | '' (transversales) | id (number en string)
let competencesTous = [];

async function init() {
  profilAdminCompetences = await requireAdmin();
  if (!profilAdminCompetences) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminCompetences.id,
    badgeHtml: `${profilAdminCompetences.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperCompetences(profilAdminCompetences.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminCompetences.est_super_admin })
  });

  const [{ data: champs }, { data: classes }] = await Promise.all([
    supabaseClient.from('champs_formation').select('*').eq('actif', true).order('nom'),
    supabaseClient.from('classes').select('*').order('ordre')
  ]);
  champsFormationCompetences = champs || [];
  classesCompetences = classes || [];

  if (!champsFormationCompetences.length) {
    document.getElementById('contenu').innerHTML = '<p class="chargement">Aucune matière configurée pour l\'instant.</p>';
    return;
  }

  champSelectionneCompetences = champsFormationCompetences[0].id;
  await chargerCompetences();
}

async function chargerCompetences() {
  let requete = supabaseClient.from('competences').select('*').eq('champ_formation_id', champSelectionneCompetences).order('domaine').order('ordre');
  const { data } = await requete;
  let liste = data || [];
  if (classeSelectionneeCompetences === '') {
    liste = liste.filter(c => c.classe_id === null);
  } else if (classeSelectionneeCompetences !== 'toutes') {
    const idClasse = parseInt(classeSelectionneeCompetences, 10);
    liste = liste.filter(c => c.classe_id === idClasse || c.classe_id === null);
  }
  competencesTous = liste;
  rendreCompetences();
}

function rendreCompetences() {
  const classesParId = {};
  classesCompetences.forEach(c => { classesParId[c.id] = c.nom; });

  const groupes = {};
  competencesTous.forEach(c => {
    const domaine = c.domaine && c.domaine.trim() ? c.domaine.trim() : 'Sans domaine';
    (groupes[domaine] ??= []).push(c);
  });
  const nomsDomaines = Object.keys(groupes).sort((a, b) => a.localeCompare(b, 'fr'));

  document.getElementById('contenu').innerHTML = `
    <div class="filtres-competences">
      <select id="selectChampCompetences">
        ${champsFormationCompetences.map(c => `<option value="${c.id}" ${c.id === champSelectionneCompetences ? 'selected' : ''}>${echapperCompetences(c.nom)}</option>`).join('')}
      </select>
      <select id="selectClasseCompetences">
        <option value="toutes" ${classeSelectionneeCompetences === 'toutes' ? 'selected' : ''}>Toutes les classes</option>
        <option value="" ${classeSelectionneeCompetences === '' ? 'selected' : ''}>Transversales uniquement</option>
        ${classesCompetences.map(c => `<option value="${c.id}" ${String(classeSelectionneeCompetences) === String(c.id) ? 'selected' : ''}>${echapperCompetences(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div class="barre-actions-competences">
      <button class="btn btn-accent" id="btnNouvelleCompetence">+ Nouvelle compétence</button>
      <button class="btn btn-primaire" id="btnProposerIA">🤖 Proposer avec l'IA</button>
    </div>
    ${nomsDomaines.length ? nomsDomaines.map(domaine => `
      <div class="groupe-domaine-competences">
        <h3>${echapperCompetences(domaine)}</h3>
        ${groupes[domaine].map(c => `
          <div class="carte-competence ${c.actif ? '' : 'inactive'}">
            <div class="entete-competence">
              <div>
                <h4>${echapperCompetences(c.intitule)}</h4>
                ${c.description ? `<p>${echapperCompetences(c.description)}</p>` : ''}
                <span class="pastille-classe-competence">${c.classe_id ? echapperCompetences(classesParId[c.classe_id] || '?') : 'Transversale'}</span>
              </div>
              <div class="actions-competence">
                <button class="btn btn-discret" data-modifier-competence="${c.id}">✏️</button>
                <button class="btn btn-discret" data-basculer-competence="${c.id}">${c.actif ? 'Désactiver' : 'Activer'}</button>
                <button class="btn btn-danger" data-supprimer-competence="${c.id}">🗑️</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`).join('') : '<p class="chargement">Aucune compétence pour cette sélection — créez-en une ou utilisez l\'assistance IA.</p>'}
  `;

  document.getElementById('selectChampCompetences').addEventListener('change', async (e) => {
    champSelectionneCompetences = parseInt(e.target.value, 10);
    await chargerCompetences();
  });
  document.getElementById('selectClasseCompetences').addEventListener('change', async (e) => {
    classeSelectionneeCompetences = e.target.value;
    await chargerCompetences();
  });
  document.getElementById('btnNouvelleCompetence').addEventListener('click', ouvrirNouvelleCompetence);
  document.getElementById('btnProposerIA').addEventListener('click', ouvrirProposerIA);
  document.querySelectorAll('[data-modifier-competence]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirModifierCompetence(parseInt(btn.dataset.modifierCompetence, 10)));
  });
  document.querySelectorAll('[data-basculer-competence]').forEach(btn => {
    btn.addEventListener('click', () => basculerCompetence(parseInt(btn.dataset.basculerCompetence, 10)));
  });
  document.querySelectorAll('[data-supprimer-competence]').forEach(btn => {
    btn.addEventListener('click', () => supprimerCompetence(parseInt(btn.dataset.supprimerCompetence, 10)));
  });
}

function champsFormulaireCompetence(valeurs) {
  const v = valeurs || {};
  return [
    { nom: 'champ_formation_id', label: 'Matière', type: 'select', valeur: v.champ_formation_id ?? champSelectionneCompetences, options: champsFormationCompetences.map(c => ({ valeur: c.id, label: c.nom })) },
    { nom: 'classe_id', label: 'Classe', type: 'select', requis: false, valeur: v.classe_id ?? '', options: [{ valeur: '', label: '— Compétence transversale (toutes classes) —' }, ...classesCompetences.map(c => ({ valeur: c.id, label: c.nom }))] },
    { nom: 'intitule', label: 'Intitulé (verbe d\'action, ex : "Comparer deux fractions de même dénominateur")', valeur: v.intitule, placeholder: 'Ex : Accorder le verbe avec son sujet au présent' },
    { nom: 'description', label: 'Description (ce que l\'élève doit savoir faire)', type: 'textarea', requis: false, valeur: v.description },
    { nom: 'domaine', label: 'Domaine (regroupement thématique)', requis: false, valeur: v.domaine, placeholder: 'Ex : Fractions' },
    { nom: 'ordre', label: 'Ordre d\'affichage', type: 'number', requis: false, valeur: v.ordre ?? 0 }
  ];
}

function ouvrirNouvelleCompetence() {
  ouvrirModal({
    titre: 'Nouvelle compétence',
    champs: champsFormulaireCompetence({}),
    texteValider: 'Créer',
    onValider: async ({ champ_formation_id, classe_id, intitule, description, domaine, ordre }) => {
      const champFormationId = parseInt(champ_formation_id, 10);
      const classeId = classe_id ? parseInt(classe_id, 10) : null;
      const { data: tousCodes } = await supabaseClient.from('competences').select('code');
      const setCodes = new Set((tousCodes || []).map(c => c.code));
      const champ = champsFormationCompetences.find(c => c.id === champFormationId);
      const classe = classesCompetences.find(c => c.id === classeId);
      const code = genererCodeUniqueCompetence(champ?.code, classe?.nom, intitule, setCodes);
      const { error } = await supabaseClient.from('competences').insert({
        champ_formation_id: champFormationId, classe_id: classeId, code,
        intitule: intitule.trim(), description: (description || '').trim(), domaine: (domaine || '').trim(),
        ordre: ordre ? parseInt(ordre, 10) : 0, cree_par: profilAdminCompetences.id
      });
      if (error) return alert(error.message);
      champSelectionneCompetences = champFormationId;
      await chargerCompetences();
    }
  });
}

function ouvrirModifierCompetence(id) {
  const comp = competencesTous.find(c => c.id === id);
  if (!comp) return;
  ouvrirModal({
    titre: 'Modifier la compétence',
    champs: champsFormulaireCompetence(comp),
    texteValider: 'Enregistrer',
    onValider: async ({ champ_formation_id, classe_id, intitule, description, domaine, ordre }) => {
      const { error } = await supabaseClient.from('competences').update({
        champ_formation_id: parseInt(champ_formation_id, 10),
        classe_id: classe_id ? parseInt(classe_id, 10) : null,
        intitule: intitule.trim(), description: (description || '').trim(), domaine: (domaine || '').trim(),
        ordre: ordre ? parseInt(ordre, 10) : 0
      }).eq('id', id);
      if (error) return alert(error.message);
      await chargerCompetences();
    }
  });
}

function basculerCompetence(id) {
  const comp = competencesTous.find(c => c.id === id);
  if (!comp) return;
  confirmerAction(`${comp.actif ? 'Désactiver' : 'Activer'} la compétence "${comp.intitule}" ?`, async () => {
    const { error } = await supabaseClient.from('competences').update({ actif: !comp.actif }).eq('id', id);
    if (error) return alert(error.message);
    await chargerCompetences();
  });
}

function supprimerCompetence(id) {
  const comp = competencesTous.find(c => c.id === id);
  if (!comp) return;
  confirmerAction(`Supprimer la compétence "${comp.intitule}" ? Le suivi de progression déjà enregistré pour les élèves sur cette compétence sera perdu.`, async () => {
    const { error } = await supabaseClient.from('competences').delete().eq('id', id);
    if (error) return alert(error.message);
    await chargerCompetences();
  });
}

// --- Assistance IA : proposer des compétences à partir d'une séance --------

async function ouvrirProposerIA() {
  ouvrirModal({
    titre: "🤖 Proposer des compétences avec l'IA",
    champs: [
      { nom: 'champ_formation_id', label: 'Matière', type: 'select', valeur: champSelectionneCompetences, options: champsFormationCompetences.map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'classe_id', label: 'Classe (les compétences proposées seront rattachées à cette classe)', type: 'select', options: classesCompetences.map(c => ({ valeur: c.id, label: c.nom })) }
    ],
    texteValider: 'Continuer',
    onValider: async ({ champ_formation_id, classe_id }) => {
      await ouvrirChoixSeanceIA(parseInt(champ_formation_id, 10), parseInt(classe_id, 10));
    }
  });
}

async function ouvrirChoixSeanceIA(champFormationId, classeId) {
  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id').eq('classe_id', classeId).eq('champ_formation_id', champFormationId);
  const idsNoeuds = (noeuds || []).map(n => n.id);
  if (!idsNoeuds.length) return alert("Aucun contenu (unité/séquence) trouvé pour cette matière et cette classe.");

  const { data: sas } = await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds);
  const idsSa = (sas || []).map(s => s.id);
  if (!idsSa.length) return alert('Aucune séquence trouvée pour cette matière et cette classe.');

  const { data: seances } = await supabaseClient.from('seances').select('id, titre, titre_contenu, discipline')
    .in('sa_id', idsSa).eq('statut', 'publie').order('id');
  if (!seances || !seances.length) return alert('Aucune séance publiée trouvée pour cette matière et cette classe.');

  ouvrirModal({
    titre: 'Choisir la séance source',
    champs: [
      {
        nom: 'seance_id', label: 'Séance publiée à analyser', type: 'select',
        options: seances.map(s => ({ valeur: s.id, label: `${s.titre}${s.titre_contenu ? ' — ' + s.titre_contenu : ''}${s.discipline ? ' (' + s.discipline + ')' : ''}` }))
      },
      { nom: 'nombre', label: 'Nombre de compétences à proposer (1 à 15)', type: 'number', valeur: 6 }
    ],
    texteValider: "Analyser avec l'IA",
    onValider: async ({ seance_id, nombre }) => {
      await lancerPropositionIA(champFormationId, classeId, parseInt(seance_id, 10), Math.max(1, Math.min(15, parseInt(nombre, 10) || 6)));
    }
  });
}

async function lancerPropositionIA(champFormationId, classeId, seanceId, nombre) {
  const attente = afficherAttenteCompetencesIA("L'IA analyse le contenu de la séance, merci de patienter...");
  try {
    const { data: blocs } = await supabaseClient.from('blocs_seance').select('type_bloc, contenu').eq('seance_id', seanceId).order('ordre');
    const contenuSource = (blocs || []).map(extraireTexteBlocCompetences).filter(Boolean).join('\n\n');
    if (!contenuSource.trim()) {
      attente.fermer();
      return alert('Cette séance ne contient pas de texte exploitable pour proposer des compétences.');
    }

    const { data: existantesRows } = await supabaseClient.from('competences').select('intitule').eq('champ_formation_id', champFormationId);
    const competencesExistantes = (existantesRows || []).map(c => c.intitule);

    const { data, error } = await supabaseClient.functions.invoke('assistant-ia', {
      body: { action: 'proposerCompetences', contenuSource, nombre, competencesExistantes }
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

    const propositions = Array.isArray(data?.competences) ? data.competences : [];
    if (!propositions.length) return alert("L'IA n'a proposé aucune compétence exploitable — réessayez avec une autre séance.");
    ouvrirRevuePropositionsIA(propositions, champFormationId, classeId);
  } catch (e) {
    attente.fermer();
    alert(e.message || 'Erreur inattendue.');
  }
}

// Ne garde que le texte pédagogique exploitable d'un bloc (titre, texte,
// consigne, énoncés d'exercice/quiz) — ignore images/médias, et retire les
// balises HTML pour ne transmettre que du texte brut à l'IA.
function extraireTexteBlocCompetences(bloc) {
  const c = bloc && bloc.contenu ? bloc.contenu : {};
  if (typeof c.texte === 'string' && c.texte.trim()) return stripHtmlCompetences(c.texte);
  if (Array.isArray(c.questions) && c.questions.length) {
    return c.questions.map(q => (q && typeof q.enonce === 'string' ? q.enonce : '')).filter(Boolean).join('\n');
  }
  return '';
}

function stripHtmlCompetences(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

function afficherAttenteCompetencesIA(texte) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-boite" style="text-align:center">⏳ ${echapperCompetences(texte)}</div>`;
  document.body.appendChild(overlay);
  return { fermer: () => overlay.remove() };
}

// Panneau de relecture des propositions IA : chaque compétence proposée est
// éditable (intitulé/description/domaine) et cochée par défaut ; rien n'est
// enregistré tant que l'admin n'a pas cliqué sur "Ajouter les compétences
// cochées" — voir la règle produit dans le plan (l'IA propose, ne décide jamais).
function ouvrirRevuePropositionsIA(propositions, champFormationId, classeId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite" style="max-width:640px;max-height:82vh;overflow:auto">
      <h3>Compétences proposées par l'IA</h3>
      <p style="font-size:13px;color:var(--texte-gris);margin-top:-8px">Relisez et corrigez si besoin, puis cochez celles à ajouter au référentiel. Rien n'est enregistré tant que vous ne validez pas.</p>
      <div id="listePropositionsCompetencesIA">
        ${propositions.map((p, i) => `
          <div class="carte-proposition-ia" style="border:1px solid var(--bordure);border-radius:8px;padding:10px;margin-bottom:10px">
            <label style="display:flex;gap:8px;align-items:flex-start">
              <input type="checkbox" data-prop-cochee="${i}" checked style="margin-top:4px">
              <div style="flex:1">
                <input type="text" data-prop-intitule="${i}" value="${echapperCompetences(p.intitule)}" style="width:100%;font-weight:700;border:1px solid var(--bordure);border-radius:6px;padding:6px;margin-bottom:6px;box-sizing:border-box">
                <textarea data-prop-description="${i}" rows="2" style="width:100%;border:1px solid var(--bordure);border-radius:6px;padding:6px;margin-bottom:6px;font-size:12px;box-sizing:border-box">${echapperCompetences(p.description)}</textarea>
                <input type="text" data-prop-domaine="${i}" value="${echapperCompetences(p.domaine)}" placeholder="Domaine" style="width:100%;border:1px solid var(--bordure);border-radius:6px;padding:6px;font-size:12px;box-sizing:border-box">
              </div>
            </label>
          </div>`).join('')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-discret" data-fermer-revue-competences>Annuler</button>
        <button type="button" class="btn btn-primaire" data-enregistrer-revue-competences>Ajouter les compétences cochées</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-revue-competences]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

  overlay.querySelector('[data-enregistrer-revue-competences]').addEventListener('click', async () => {
    const aInserer = [];
    propositions.forEach((_p, i) => {
      const coche = overlay.querySelector(`[data-prop-cochee="${i}"]`).checked;
      if (!coche) return;
      const intitule = overlay.querySelector(`[data-prop-intitule="${i}"]`).value.trim();
      const description = overlay.querySelector(`[data-prop-description="${i}"]`).value.trim();
      const domaine = overlay.querySelector(`[data-prop-domaine="${i}"]`).value.trim();
      if (intitule) aInserer.push({ intitule, description, domaine });
    });
    if (!aInserer.length) return alert('Cochez au moins une compétence à ajouter.');

    const champ = champsFormationCompetences.find(c => c.id === champFormationId);
    const classe = classesCompetences.find(c => c.id === classeId);
    const { data: tousCodes } = await supabaseClient.from('competences').select('code');
    const setCodes = new Set((tousCodes || []).map(c => c.code));
    const lignes = aInserer.map(p => {
      const code = genererCodeUniqueCompetence(champ?.code, classe?.nom, p.intitule, setCodes);
      setCodes.add(code);
      return {
        champ_formation_id: champFormationId, classe_id: classeId, code,
        intitule: p.intitule, description: p.description || '', domaine: p.domaine || '',
        ordre: 0, cree_par: profilAdminCompetences.id
      };
    });

    const { error } = await supabaseClient.from('competences').insert(lignes);
    if (error) return alert(error.message);
    fermer();
    champSelectionneCompetences = champFormationId;
    classeSelectionneeCompetences = String(classeId);
    await chargerCompetences();
  });
}

// Génère un code technique unique et stable à partir de la matière/classe/
// intitulé (ex : "MATHEMATIQUE-CM2-COMPARER-DEUX-FRACTIONS") — jamais montré
// à l'admin, sert uniquement de clé interne (colonne `code`, unique en base).
function genererCodeUniqueCompetence(champCode, classeNom, intitule, setCodesExistants) {
  const slug = (intitule || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'COMPETENCE';
  const base = `${(champCode || 'GEN').toString().toUpperCase()}-${(classeNom || 'TRANSV').toString().toUpperCase()}-${slug}`;
  let code = base;
  let n = 2;
  while (setCodesExistants.has(code)) { code = `${base}-${n}`; n++; }
  return code;
}

function echapperCompetences(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
