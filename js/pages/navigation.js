// Page pages/navigation.html
const etat = {
  classe: null, champ: null, cheminNoeuds: [], sa: null, vueArborescence: false,
  peutEditer: false, peutValider: false, profilAdmin: null, profilEnseignant: null,
  estEleve: false, userId: null
};

// État déplié/replié de l'arborescence — en dehors de `etat` pour survivre
// aux re-rendus déclenchés par une création/suppression/renommage
// (sinon tout se replie à chaque action, ce qui casse le fil).
const noeudsOuverts = new Set();
const saOuvertes = new Set();

const contenu = document.getElementById('contenu');
const filAriane = document.getElementById('filAriane');

(async function initEntete() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  etat.userId = session.user.id;

  const profil = await chargerProfilAdmin(session.user.id);
  if (profil) {
    etat.profilAdmin = profil;
    document.getElementById('zoneDroite').innerHTML = `
      <div id="zoneCloche"></div>
      <span class="badge-utilisateur">${profil.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profil.prenom}</span>
      <a href="admin/tableau-de-bord.html" class="btn btn-discret">🏠 Tableau de bord</a>
      <a href="admin/devoirs-notes.html" class="btn btn-discret">📊 Devoirs &amp; notes</a>
      <a href="admin/messagerie.html" class="btn btn-discret">💬 Messagerie</a>
      <button class="btn btn-discret" id="btnDeconnexion">Déconnexion</button>
    `;
    document.getElementById('btnDeconnexion').addEventListener('click', deconnecterAdmin);
    initClocheNotifications('zoneCloche', profil.id);
    return;
  }

  // Pas un compte admin : on regarde si c'est un enseignant (accès de
  // gestion sur son périmètre : suivi élève ou classe assignée) ou un
  // élève (bouton "Lire la séance" plus bas, en lecture seule).
  const profilGenerique = await chargerProfil(session.user.id);
  if (profilGenerique?.role === 'enseignant') {
    const { data: enseignant } = await supabaseClient.from('enseignants').select('*').eq('id', session.user.id).single();
    etat.profilEnseignant = { ...profilGenerique, ...enseignant };
    document.getElementById('zoneDroite').innerHTML = `
      <div id="zoneCloche"></div>
      <span class="badge-utilisateur">🧑‍🏫 Enseignant : ${echapper(profilGenerique.prenom)}</span>
      <a href="enseignant/tableau-de-bord.html" class="btn btn-discret">🏠 Tableau de bord</a>
      <a href="enseignant/activites.html" class="btn btn-discret">📝 Activités à corriger</a>
      <a href="enseignant/devoirs-notes.html" class="btn btn-discret">📊 Devoirs &amp; notes</a>
      <button class="btn btn-discret" id="btnDeconnexion">Déconnexion</button>
    `;
    document.getElementById('btnDeconnexion').addEventListener('click', deconnecterUtilisateur);
    initClocheNotifications('zoneCloche', profilGenerique.id);
    return;
  }
  if (profilGenerique?.role === 'eleve') etat.estEleve = true;
})();

// --- FIL D'ARIANE ------------------------------------------------------

function construireFilAriane() {
  const segments = [{ label: '🏠 Classes', action: 'accueil' }];
  if (etat.classe) segments.push({ label: etat.classe.nom, action: 'classe' });
  if (etat.champ) segments.push({ label: etat.champ.nom, action: 'champ' });
  if (etat.vueArborescence) {
    segments.push({ label: '🌳 Arborescence', action: null });
  } else {
    etat.cheminNoeuds.forEach((n, i) => segments.push({ label: n.titre, action: 'noeud', index: i }));
    if (etat.sa) segments.push({ label: etat.sa.titre, action: null });
  }

  filAriane.innerHTML = segments.map((s, i) => {
    const dernier = i === segments.length - 1;
    return `<span class="segment ${dernier ? 'actif' : ''}" ${s.action ? `data-fil-action="${s.action}" data-fil-index="${s.index ?? ''}"` : ''}>${echapper(s.label)}</span>` +
      (dernier ? '' : `<span class="sep">›</span>`);
  }).join('');

  filAriane.querySelectorAll('[data-fil-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.filAction;
      if (action === 'accueil') Object.assign(etat, { classe: null, champ: null, cheminNoeuds: [], sa: null, vueArborescence: false });
      if (action === 'classe') Object.assign(etat, { champ: null, cheminNoeuds: [], sa: null, vueArborescence: false });
      if (action === 'champ') Object.assign(etat, { cheminNoeuds: [], sa: null, vueArborescence: false });
      if (action === 'noeud') { etat.cheminNoeuds = etat.cheminNoeuds.slice(0, parseInt(el.dataset.filIndex, 10) + 1); etat.sa = null; }
      afficher();
    });
  });
}

// --- CHARGEMENT & AFFICHAGE PAR NIVEAU ---------------------------------

async function afficher() {
  construireFilAriane();
  contenu.innerHTML = '<div class="chargement">Chargement...</div>';

  if (!etat.classe) return afficherClasses();
  if (!etat.champ) return afficherChamps();
  if (etat.vueArborescence) return afficherArborescence();
  if (!etat.sa) return afficherNoeudsEtSA();
  return afficherSeances();
}

function rendreCartes(items, rendreCarte, gestionClic) {
  contenu.innerHTML = `<div class="grille-cartes" id="grilleCartes">${items.map(rendreCarte).join('')}</div>`;
  document.getElementById('grilleCartes').addEventListener('click', (e) => {
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    const item = items.find(i => String(i.id) === carte.dataset.id);
    if (item) gestionClic(item);
  });
}
// (conservée pour compatibilité éventuelle avec d'autres écrans futurs)


// Présentation détaillée des classes (regroupées par cycle), fidèle au modèle fourni.
const CYCLES_CLASSES = [
  {
    titre: "🌱 Cycle d'Initiation (Niveau Élémentaire 1)",
    classes: [
      {
        nom: 'CI', age: '5 - 6 ans', titre: "Cours D'Initiation",
        description: "Ancrage dans les premiers apprentissages : découverte de l'écriture, socialisation, pré-lecture et logique des nombres.",
        focus: 'Graphisme, Sons et Calcul concret',
        objectif: "Préparer l'entrée dans la lecture autonome"
      },
      {
        nom: 'CP', age: '6 - 7 ans', titre: 'Cours Préparatoire',
        description: "L'année fondamentale du déchiffrage : consolidation de la lecture, écriture courante et bases de l'arithmétique.",
        focus: 'Lecture fluide, Écriture et Addition/Soustraction',
        objectif: "Maîtriser le code alphabétique et la numération"
      }
    ]
  },
  {
    titre: '🪘 Cycle d\'Approfondissement (Niveau Moyen)',
    classes: [
      {
        nom: 'CE1', age: '7 - 8 ans', titre: 'Cours Élémentaire 1ère Année',
        description: "Développement de l'expression orale et écrite, étude de la langue (grammaire, orthographe) et découverte du monde.",
        focus: 'Compréhension de texte et Calcul mental',
        objectif: 'Enrichir le vocabulaire et la méthode de résolution'
      },
      {
        nom: 'CE2', age: '8 - 9 ans', titre: 'Cours Élémentaire 2ème Année',
        description: "Renforcement de l'autonomie. Introduction aux concepts scientifiques simples et structuration de l'espace-temps.",
        focus: 'Multiplication, Géométrie et Rédaction guidée',
        objectif: "Consolider la logique et l'expression autonome"
      }
    ]
  },
  {
    titre: '🦁 Cycle de Consolidation &amp; Préparation au CEP',
    classes: [
      {
        nom: 'CM1', age: '9 - 10 ans', titre: 'Cours Moyen 1ère Année',
        description: 'Développement du raisonnement critique. Analyse grammaticale poussée et résolution de problèmes complexes.',
        focus: 'Divisions, Fractions, Histoire et Sciences',
        objectif: 'Préparer l\'entrée dans le second degré du primaire'
      },
      {
        nom: 'CM2', age: '10 - 11 ans', titre: 'Cours Moyen 2ème Année',
        description: "Classe d'aboutissement du primaire. Préparation intensive à l'examen du CEP et transition vers le collège.",
        focus: 'Rédaction libre, Problèmes à étapes et Bilan Général',
        objectif: "Réussite au CEP et maîtrise des Paliers d'agilité"
      }
    ]
  }
];

async function afficherClasses() {
  const { data, error } = await supabaseClient.from('classes').select('*').order('ordre');
  if (error) return erreur(error);

  contenu.innerHTML = `
    <div class="titre-page centre">Choisissez votre Classe</div>
    <div class="sous-titre-page centre">Accédez aux programmes officiels et aux activités adaptées à chaque niveau scolaire.</div>
    ${CYCLES_CLASSES.map(cycle => `
      <div class="titre-cycle">${cycle.titre}</div>
      <div class="grille-classes">
        ${cycle.classes.map(c => `
          <div class="carte-classe-detail" data-nom="${echapper(c.nom)}">
            <div>
              <div class="entete-carte-classe">
                <span class="badge-classe">${echapper(c.nom)}</span>
                <span class="age-classe">🎂 ${echapper(c.age)}</span>
              </div>
              <h2 class="titre-classe-detail">${echapper(c.titre)}</h2>
              <p class="description-classe-detail">${echapper(c.description)}</p>
              <ul class="liste-infos-classe">
                <li>📌 <strong>Focus :</strong> ${echapper(c.focus)}</li>
                <li>🎯 <strong>Objectif :</strong> ${echapper(c.objectif)}</li>
              </ul>
            </div>
            <button class="bouton-explorer-classe" type="button">Explorer le ${echapper(c.nom)} 🚀</button>
          </div>`).join('')}
      </div>`).join('')}
  `;

  contenu.querySelectorAll('[data-nom]').forEach(carte => {
    carte.addEventListener('click', () => {
      etat.classe = data.find(x => x.nom === carte.dataset.nom);
      if (!etat.classe) return alert("Cette classe n'existe pas encore en base — ajoutez-la dans la table 'classes'.");
      afficher();
    });
  });
}

// Icônes et descriptions (présentation uniquement — pas de colonne en base
// pour l'instant) associées à chaque champ via son "code" technique.
const PRESENTATION_CHAMPS = {
  francais:     { icone: '📚', description: "Expression orale, lecture expliquée, grammaire, conjugaison, orthographe et production d'écrits." },
  mathematique: { icone: '📐', description: "Numération, opérations arithmétiques, géométrie plane, mesures de grandeur et résolution de problèmes." },
  es:           { icone: '🌍', description: "Histoire, géographie, instruction civique et morale, et découverte du patrimoine culturel." },
  est:          { icone: '🔬', description: "Anatomie, hygiène, étude du milieu naturel, physiques appliquées et premières notions d'informatique." },
  ea:           { icone: '🎨', description: "Dessin, arts plastiques, chant, musique traditionnelle et activités créatives manuelles." },
  eps:          { icone: '⚽', description: "Développement psychomoteur, jeux collectifs, athlétisme, règles d'hygiène sportive et santé." }
};

async function afficherChamps() {
  const { data, error } = await supabaseClient
    .from('classes_champs_formation').select('champs_formation(id, nom, code)').eq('classe_id', etat.classe.id);
  if (error) return erreur(error);
  const champs = data.map(d => d.champs_formation);

  // Nombre d'"unités" par champ : niveau unite/dossier si présent,
  // sinon nombre de SA rattachées directement (champs à un seul niveau).
  const comptes = await Promise.all(champs.map(c => compterUnitesChamp(c)));
  const droitsEdition = (etat.profilAdmin || etat.profilEnseignant)
    ? await Promise.all(champs.map(c => supabaseClient.rpc('peut_gerer_classe_champ', { p_id: etat.userId, p_classe_id: etat.classe.id, p_champ_id: c.id }).then(r => !!r.data)))
    : champs.map(() => false);

  contenu.innerHTML = `
    <div class="titre-page">Champs de Formation (${echapper(etat.classe.nom)})</div>
    <div class="sous-titre-page">Sélectionnez une discipline pour accéder aux Unités d'Apprentissage et aux exercices.</div>
    <div class="grille-champs" id="grilleCartes">
      ${champs.map((c, i) => {
        const p = PRESENTATION_CHAMPS[c.code] || { icone: '📘', description: '' };
        return `
        <div class="carte-champ" data-id="${c.id}">
          <div class="entete-carte-champ">
            <div class="icone-champ">${p.icone}</div>
            <div class="titre-carte-champ">${echapper(c.nom)}</div>
          </div>
          <div class="description-carte-champ">${echapper(p.description)}</div>
          <div class="pied-carte-champ">
            <span class="nb-unites-champ">${comptes[i]} Unité${comptes[i] > 1 ? 's' : ''}</span>
            <div style="display:flex;gap:6px">
              ${droitsEdition[i] ? `<button class="btn btn-discret" data-editer-champ="${c.id}" type="button" title="Gérer toute la hiérarchie">✏️ Éditer</button>` : ''}
              <button class="bouton-acceder-champ" data-acceder-champ="${c.id}" type="button">Accéder ➔</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('grilleCartes').addEventListener('click', async (e) => {
    const btnEditer = e.target.closest('[data-editer-champ]');
    const btnAcceder = e.target.closest('[data-acceder-champ]');
    if (!btnEditer && !btnAcceder) return;
    e.stopPropagation();
    const idChamp = (btnEditer || btnAcceder).dataset.editerChamp || (btnEditer || btnAcceder).dataset.accederChamp;
    etat.champ = champs.find(x => String(x.id) === idChamp);
    etat.vueArborescence = !!btnEditer; // Éditer -> arborescence complète, Accéder -> présentation par cartes
    etat.cheminNoeuds = []; etat.sa = null;
    noeudsOuverts.clear(); saOuvertes.clear();
    await verifierPermissions();
    afficher();
  });
}

async function compterUnitesChamp(champ) {
  const { count: compteUnitesDossiers } = await supabaseClient
    .from('noeuds_parcours').select('id', { count: 'exact', head: true })
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', champ.id).in('type_noeud', ['unite', 'dossier']);

  if (compteUnitesDossiers > 0) return compteUnitesDossiers;

  // Champs à un seul niveau (pas d'unité/dossier) : on compte les SA
  // rattachées à n'importe quel noeud racine de ce champ.
  const { data: racines } = await supabaseClient
    .from('noeuds_parcours').select('id')
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', champ.id).is('parent_id', null);
  if (!racines || racines.length === 0) return 0;

  const { count: compteSA } = await supabaseClient
    .from('sa').select('id', { count: 'exact', head: true }).in('noeud_id', racines.map(r => r.id));
  return compteSA || 0;
}

async function verifierPermissions() {
  etat.peutEditer = false; etat.peutValider = false;
  if (etat.profilAdmin) {
    const { data: peutEditer } = await supabaseClient.rpc('peut_editer_perimetre', { p_id: etat.profilAdmin.id, p_classe_id: etat.classe.id, p_champ_id: etat.champ.id });
    const { data: peutValider } = await supabaseClient.rpc('peut_valider_perimetre', { p_id: etat.profilAdmin.id, p_classe_id: etat.classe.id, p_champ_id: etat.champ.id });
    etat.peutEditer = !!peutEditer;
    etat.peutValider = !!peutValider;
    return;
  }
  if (etat.profilEnseignant) {
    // Un enseignant gère son périmètre (suivi élève accepté ou classe
    // assignée) : il peut éditer ET publier son propre contenu — pas de
    // validation admin séparée pour l'instant.
    const { data: peutGerer } = await supabaseClient.rpc('peut_gerer_classe_champ', { p_id: etat.userId, p_classe_id: etat.classe.id, p_champ_id: etat.champ.id });
    etat.peutEditer = !!peutGerer;
    etat.peutValider = !!peutGerer;
  }
}

// Structures hiérarchiques IMPOSÉES pour certains champs (clé = code du champ).
// Pour ces champs, le type de chaque niveau est dicté par la profondeur —
// impossible de se tromper ou d'inverser l'ordre. Une fois le dernier niveau
// atteint, seules des SA peuvent être ajoutées (plus de sous-niveau).
// Les champs absents de cette liste restent libres (l'admin choisit le type).
const STRUCTURES_IMPOSEES = {
  francais: ['theme', 'unite', 'semaine']
};

function structureImposeeChamp() {
  return STRUCTURES_IMPOSEES[etat.champ?.code] || null;
}

async function afficherNoeudsEtSA() {
  const parentId = etat.cheminNoeuds.length ? etat.cheminNoeuds[etat.cheminNoeuds.length - 1].id : null;
  const structure = structureImposeeChamp();
  const profondeur = etat.cheminNoeuds.length;
  // Pour un champ à structure imposée : niveau max atteint => plus de sous-niveau, seulement des SA.
  const auNiveauMax = structure ? profondeur >= structure.length : false;
  const peutAjouterNiveau = etat.peutEditer && !auNiveauMax;
  // Pour les champs SANS structure imposée (Français mis à part), une SA
  // peut être ajoutée directement après le champ, sans niveau intermédiaire.
  const peutAjouterSA = etat.peutEditer && (structure ? (parentId && auNiveauMax) : true);

  let requeteNoeuds = supabaseClient.from('noeuds_parcours').select('*').eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).order('ordre');
  requeteNoeuds = parentId ? requeteNoeuds.eq('parent_id', parentId) : requeteNoeuds.is('parent_id', null);
  const { data: noeuds, error: erreurNoeuds } = auNiveauMax ? { data: [], error: null } : await requeteNoeuds;
  if (erreurNoeuds) return erreur(erreurNoeuds);

  let sas = [];
  if (parentId) {
    const { data, error: erreurSA } = await supabaseClient.from('sa').select('*').eq('noeud_id', parentId).order('ordre');
    if (erreurSA) return erreur(erreurSA);
    sas = data;
  }

  // Nombre d'enfants directs (filleuls) par carte, pour affichage.
  const idsNoeuds = noeuds.map(n => n.id);
  const idsSA = sas.map(s => s.id);
  const [{ data: sousNoeuds }, { data: saDesNoeuds }, { data: seancesDesSA }] = await Promise.all([
    idsNoeuds.length ? supabaseClient.from('noeuds_parcours').select('id, parent_id').in('parent_id', idsNoeuds) : Promise.resolve({ data: [] }),
    idsNoeuds.length ? supabaseClient.from('sa').select('id, noeud_id').in('noeud_id', idsNoeuds) : Promise.resolve({ data: [] }),
    idsSA.length ? supabaseClient.from('seances').select('id, sa_id').in('sa_id', idsSA) : Promise.resolve({ data: [] })
  ]);
  const compteFilleulsNoeud = {};
  (sousNoeuds || []).forEach(n => { compteFilleulsNoeud[n.parent_id] = (compteFilleulsNoeud[n.parent_id] || 0) + 1; });
  (saDesNoeuds || []).forEach(s => { compteFilleulsNoeud[s.noeud_id] = (compteFilleulsNoeud[s.noeud_id] || 0) + 1; });
  const compteFilleulsSA = {};
  (seancesDesSA || []).forEach(se => { compteFilleulsSA[se.sa_id] = (compteFilleulsSA[se.sa_id] || 0) + 1; });

  const libelleProchainNiveau = structure && !auNiveauMax ? ` (${etiquetteType(structure[profondeur])})` : '';
  const boutonAjoutNiveau = peutAjouterNiveau ? `<button class="btn btn-accent" id="btnCreerNoeud" style="margin-bottom:14px">+ Ajouter${libelleProchainNiveau ? ' un ' + etiquetteType(structure[profondeur]).toLowerCase() : ' un niveau'}</button>` : '';
  const boutonAjoutSA = peutAjouterSA ? `<button class="btn btn-accent" id="btnCreerSA" style="margin-bottom:14px;margin-left:8px">+ Nouvelle SA ici</button>` : '';

  let html = `<div style="margin-bottom:10px">${boutonAjoutNiveau}${boutonAjoutSA}${etat.peutEditer ? ` <button class="btn btn-discret" id="btnVueArbo">🌳 Voir toute l'arborescence</button>` : ''}</div>`;
  if (structure) {
    html = `<p class="infos-sauvegarde" style="margin-bottom:10px">📐 Structure imposée pour ${echapper(etat.champ.nom)} : ${structure.map(etiquetteType).join(' → ')} → SA → Séance</p>` + html;
  }

  if (noeuds.length > 0) {
    html += `<div class="titre-cycle" style="margin-top:6px">Niveaux</div>
      <div class="grille-cartes" id="grilleNoeuds">${noeuds.map(n => `
        <div class="carte" data-id="${n.id}" style="position:relative">
          ${etat.peutEditer ? `<button data-supprimer-noeud="${n.id}" title="Supprimer" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:14px">🗑️</button>` : ''}
          <div class="titre-carte">${echapper(n.titre)}</div><div class="sous-titre-carte">${etiquetteType(n.type_noeud)}${compteFilleulsNoeud[n.id] ? ` · ${compteFilleulsNoeud[n.id]} élément${compteFilleulsNoeud[n.id] > 1 ? 's' : ''}` : ''}</div>
        </div>`).join('')}</div>`;
  }

  if (sas.length > 0) {
    html += `<div class="titre-cycle">Situations d'Apprentissage</div>
      <div class="grille-cartes" id="grilleSA">${sas.map(s => `
        <div class="carte" data-id="${s.id}" style="position:relative">
          ${etat.peutEditer ? `<button data-supprimer-sa="${s.id}" title="Supprimer" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:14px">🗑️</button>` : ''}
          <div class="titre-carte">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapper(s.titre)}</div><div class="sous-titre-carte">${s.description ? echapper(s.description) + ' · ' : ''}${compteFilleulsSA[s.id] || 0} séance${(compteFilleulsSA[s.id] || 0) > 1 ? 's' : ''}</div>
        </div>`).join('')}</div>`;
  }

  if (noeuds.length === 0 && sas.length === 0) {
    html += `<p class="chargement">Rien ici pour l'instant — ${parentId ? 'ajoutez un sous-niveau ou une SA' : 'ajoutez un niveau'}.</p>`;
  }

  contenu.innerHTML = html;

  const grilleNoeuds = document.getElementById('grilleNoeuds');
  if (grilleNoeuds) grilleNoeuds.addEventListener('click', (e) => {
    const btnSupprimer = e.target.closest('[data-supprimer-noeud]');
    if (btnSupprimer) { e.stopPropagation(); return supprimerNoeud(parseInt(btnSupprimer.dataset.supprimerNoeud, 10)); }
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    etat.cheminNoeuds.push(noeuds.find(x => String(x.id) === carte.dataset.id));
    afficher();
  });

  const grilleSA = document.getElementById('grilleSA');
  if (grilleSA) grilleSA.addEventListener('click', (e) => {
    const btnSupprimer = e.target.closest('[data-supprimer-sa]');
    if (btnSupprimer) { e.stopPropagation(); return supprimerSA(parseInt(btnSupprimer.dataset.supprimerSa, 10)); }
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    etat.sa = sas.find(x => String(x.id) === carte.dataset.id);
    afficher();
  });

  const btnCreerNoeud = document.getElementById('btnCreerNoeud');
  if (btnCreerNoeud) btnCreerNoeud.addEventListener('click', creerNoeud);
  const btnCreerSA = document.getElementById('btnCreerSA');
  if (btnCreerSA) btnCreerSA.addEventListener('click', () => creerSA(parentId));
  const btnVueArbo = document.getElementById('btnVueArbo');
  if (btnVueArbo) btnVueArbo.addEventListener('click', () => { etat.vueArborescence = true; etat.cheminNoeuds = []; etat.sa = null; afficher(); });
}

async function supprimerNoeud(id) {
  confirmerAction("Supprimer ce niveau ? Tout ce qu'il contient (sous-niveaux, SA, séances, blocs) sera supprimé avec.", async () => {
    const { error } = await supabaseClient.from('noeuds_parcours').delete().eq('id', id);
    if (error) return alert(error.message);
    afficher();
  });
}

function etiquetteType(t) {
  return { theme: 'Thème', unite: 'Unité', semaine: 'Semaine', dossier: 'Dossier', discipline: 'Discipline' }[t] || t;
}

async function supprimerSA(id) {
  confirmerAction("Supprimer cette SA ? Toutes ses séances et leurs blocs seront supprimés avec.", async () => {
    const { error } = await supabaseClient.from('sa').delete().eq('id', id);
    if (error) return alert(error.message);
    afficher();
  });
}

async function afficherSeances() {
  const { data, error } = await supabaseClient.from('seances').select('*').eq('sa_id', etat.sa.id).order('ordre');
  if (error) return erreur(error);
  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };
  const boutonAjout = etat.peutEditer ? `<button class="btn btn-accent" id="btnCreerSeance" style="margin-bottom:14px">+ Nouvelle séance</button>` : '';

  contenu.innerHTML = `${boutonAjout}<div class="liste-lignes">${data.map(s => `
    <div class="ligne">
      <div><div class="titre-ligne">${echapper(s.titre)}${s.discipline ? ` <span class="statut-pill" style="background:var(--accent-clair);color:var(--bleu-principal)">${echapper(s.discipline)}</span>` : ''}</div><span class="statut-pill statut-${s.statut}">${pillsStatut[s.statut]}</span></div>
      <div style="display:flex;gap:8px">
        ${etat.peutEditer ? `<a class="btn btn-primaire" href="editeur-seance.html?id=${s.id}">Modifier la séance</a>` : ''}
        ${etat.estEleve && !etat.peutEditer ? `<a class="btn btn-primaire" href="eleve/seance.html?id=${s.id}">📖 Lire la séance</a>` : ''}
        ${etat.peutEditer ? `<button class="btn btn-danger" data-supprimer-seance="${s.id}">🗑️</button>` : ''}
      </div>
    </div>`).join('') || '<p class="chargement">Aucune séance pour l\'instant.</p>'}</div>`;

  contenu.querySelectorAll('[data-supprimer-seance]').forEach(btn => {
    btn.addEventListener('click', () => supprimerSeance(parseInt(btn.dataset.supprimerSeance, 10)));
  });

  const btnCreer = document.getElementById('btnCreerSeance');
  if (btnCreer) btnCreer.addEventListener('click', () => creerSeance(etat.sa.id));
}

async function supprimerSeance(id, callbackApresSuppression) {
  confirmerAction('Supprimer cette séance et tous ses blocs ?', async () => {
    const { error } = await supabaseClient.from('seances').delete().eq('id', id);
    if (error) return alert(error.message);
    if (callbackApresSuppression) callbackApresSuppression(); else afficher();
  });
}

// --- CRÉATION / RENOMMAGE (formulaires dynamiques) ------------------------

// creerNoeudDans(classe, champ, parentId, profondeur, apresCreation)
// Version générique réutilisée par la navigation pas-à-pas ET par l'arborescence.
function creerNoeudDans(classeId, champId, champCode, parentId, profondeur, apresCreation) {
  const structure = STRUCTURES_IMPOSEES[champCode] || null;

  const poursuivre = (type) => {
    ouvrirModal({
      titre: `Nouveau niveau${structure ? ' — ' + etiquetteType(type) : ''}`,
      champs: [{ nom: 'titre', label: 'Titre', placeholder: 'Ex: Thème 1, Unité 3, Semaine 1...' }],
      texteValider: 'Créer',
      onValider: async ({ titre }) => {
        const { error } = await supabaseClient.from('noeuds_parcours').insert({
          classe_id: classeId, champ_formation_id: champId, parent_id: parentId, type_noeud: type, titre, ordre: 0
        });
        if (error) return alert(error.message);
        apresCreation();
      }
    });
  };

  if (structure) {
    if (profondeur >= structure.length) return alert("Niveau maximum atteint pour ce champ — créez une SA ici plutôt qu'un nouveau niveau.");
    poursuivre(structure[profondeur]);
  } else {
    ouvrirModal({
      titre: 'Nouveau niveau',
      champs: [
        { nom: 'titre', label: 'Titre', placeholder: 'Ex: Dossier 2' },
        { nom: 'type', label: 'Type', type: 'select', options: [
          { valeur: 'theme', label: 'Thème' }, { valeur: 'unite', label: 'Unité' }, { valeur: 'semaine', label: 'Semaine' },
          { valeur: 'dossier', label: 'Dossier' }, { valeur: 'discipline', label: 'Discipline (champ à un seul niveau)' }
        ], valeur: 'dossier' }
      ],
      texteValider: 'Créer',
      onValider: async ({ titre, type }) => {
        const { error } = await supabaseClient.from('noeuds_parcours').insert({
          classe_id: classeId, champ_formation_id: champId, parent_id: parentId, type_noeud: type, titre, ordre: 0
        });
        if (error) return alert(error.message);
        apresCreation();
      }
    });
  }
}

function creerNoeud() {
  const profondeur = etat.cheminNoeuds.length;
  const parentId = profondeur ? etat.cheminNoeuds[profondeur - 1].id : null;
  creerNoeudDans(etat.classe.id, etat.champ.id, etat.champ.code, parentId, profondeur, afficher);
}

function creerSADans(noeudParentId, typeNoeudParent, champCode, apresCreation) {
  const structure = STRUCTURES_IMPOSEES[champCode] || null;
  if (structure && typeNoeudParent !== structure[structure.length - 1]) {
    return alert(`Pour ce champ, une SA ne peut être créée qu'au niveau "${etiquetteType(structure[structure.length - 1])}".`);
  }
  ouvrirModal({
    titre: 'Nouvelle Situation d\'Apprentissage',
    champs: [
      { nom: 'titre', label: 'Titre', placeholder: 'Ex: Lecture, Vocabulaire thématique...' },
      { nom: 'numero', label: 'Numéro (optionnel)', type: 'number', requis: false },
      { nom: 'description', label: 'Description (optionnelle)', type: 'textarea', requis: false }
    ],
    texteValider: 'Créer',
    onValider: async ({ titre, numero, description }) => {
      const { error } = await supabaseClient.from('sa').insert({
        noeud_id: noeudParentId, titre, numero: numero ? parseInt(numero, 10) : null, description: description || null, ordre: 0
      });
      if (error) return alert(error.message);
      apresCreation();
    }
  });
}

async function creerSA(noeudParentId) {
  const structure = structureImposeeChamp();
  if (structure && etat.cheminNoeuds.length < structure.length) {
    return alert(`Pour ${etat.champ.nom}, une SA ne peut être créée qu'au niveau "${etiquetteType(structure[structure.length - 1])}". Continuez à descendre dans les niveaux.`);
  }

  if (!noeudParentId) {
    // Champ sans structure imposée : on crée (ou réutilise) un niveau
    // racine implicite pour porter la SA directement sous le champ.
    noeudParentId = await obtenirOuCreerNoeudRacineImplicite();
    if (!noeudParentId) return;
  }

  const typeNoeudParent = structure ? structure[structure.length - 1] : null;
  creerSADans(noeudParentId, typeNoeudParent, etat.champ.code, afficher);
}

async function obtenirOuCreerNoeudRacineImplicite() {
  const { data: existants } = await supabaseClient.from('noeuds_parcours').select('*')
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).is('parent_id', null).order('ordre');
  if (existants && existants.length > 0) return existants[0].id;

  const { data: cree, error } = await supabaseClient.from('noeuds_parcours').insert({
    classe_id: etat.classe.id, champ_formation_id: etat.champ.id, parent_id: null, type_noeud: 'discipline', titre: etat.champ.nom, ordre: 0
  }).select().single();
  if (error) { alert(error.message); return null; }
  return cree.id;
}

function creerSeanceDans(saId, redirigerVersEditeur = true, onCree) {
  ouvrirModal({
    titre: 'Nouvelle séance',
    champs: [
      { nom: 'titre', label: 'Titre', placeholder: 'Ex: Séance 1 — Découverte du texte' },
      { nom: 'discipline', label: 'Discipline (optionnelle)', requis: false, placeholder: 'Lecture, Grammaire, Conjugaison...' },
      { nom: 'palier', label: 'Palier (optionnel — parcours différencié par niveau)', type: 'select', requis: false,
        options: [
          { valeur: '', label: '— Aucun (séance classique) —' },
          { valeur: 'azovi', label: '🌱 Azɔ̀ví (très facile)' },
          { valeur: 'devi', label: '🪘 Dèví (moyen)' },
          { valeur: 'ogan', label: '🦁 Ògán (difficile)' },
          { valeur: 'axosu', label: '👑 Axɔ́sú (très difficile)' }
        ] }
    ],
    texteValider: redirigerVersEditeur ? "Créer et ouvrir l'éditeur" : 'Créer',
    onValider: async ({ titre, discipline, palier }) => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      // ordre séquentiel (nécessaire au verrouillage progressif par palier :
      // les séances d'une même SA/palier se débloquent dans l'ordre de création
      // par défaut — un réordonnancement manuel viendra plus tard).
      const { count } = await supabaseClient.from('seances').select('id', { count: 'exact', head: true }).eq('sa_id', saId);
      const { data, error } = await supabaseClient.from('seances').insert({
        sa_id: saId, titre, discipline: discipline || null, palier: palier || null,
        statut: 'brouillon', ordre: count || 0, cree_par: session.user.id
      }).select().single();
      if (error) return alert(error.message);
      if (redirigerVersEditeur) window.location.href = `editeur-seance.html?id=${data.id}`;
      else if (onCree) onCree();
    }
  });
}

function creerSeance(saId) {
  creerSeanceDans(saId || etat.sa.id);
}

// --- DUPLICATION (réutiliser un gabarit déjà construit, ex: Unité 1) -----

// Duplique un noeud ET tout ce qu'il contient (sous-niveaux, SA, séances, blocs)
// vers un nouveau parent.
async function dupliquerNoeudRecursif(noeudId, nouveauParentId) {
  const { data: original } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', noeudId).single();
  const { data: copie, error } = await supabaseClient.from('noeuds_parcours').insert({
    classe_id: original.classe_id, champ_formation_id: original.champ_formation_id,
    parent_id: nouveauParentId, type_noeud: original.type_noeud, titre: original.titre + ' (copie)', ordre: original.ordre
  }).select().single();
  if (error) { alert(error.message); return null; }

  const { data: sasOriginales } = await supabaseClient.from('sa').select('*').eq('noeud_id', noeudId);
  for (const sa of sasOriginales || []) {
    await dupliquerSARecursif(sa, copie.id, false);
  }

  const { data: enfants } = await supabaseClient.from('noeuds_parcours').select('*').eq('parent_id', noeudId);
  for (const enfant of enfants || []) {
    await dupliquerNoeudRecursif(enfant.id, copie.id);
  }

  return copie;
}

// Duplique une SA et toutes ses séances (avec leurs blocs) vers un noeud donné.
async function dupliquerSARecursif(saOriginale, nouveauNoeudId, renommer = true) {
  const { data: copie, error } = await supabaseClient.from('sa').insert({
    noeud_id: nouveauNoeudId, numero: saOriginale.numero,
    titre: saOriginale.titre + (renommer ? ' (copie)' : ''), description: saOriginale.description, ordre: saOriginale.ordre
  }).select().single();
  if (error) { alert(error.message); return null; }

  const { data: seancesOriginales } = await supabaseClient.from('seances').select('*').eq('sa_id', saOriginale.id);
  for (const se of seancesOriginales || []) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const { data: seanceCopie, error: erreurSeance } = await supabaseClient.from('seances').insert({
      sa_id: copie.id, titre: se.titre, discipline: se.discipline, statut: 'brouillon', ordre: se.ordre, cree_par: session.user.id
    }).select().single();
    if (erreurSeance) { alert(erreurSeance.message); continue; }

    const { data: blocsOriginaux } = await supabaseClient.from('blocs_seance').select('*').eq('seance_id', se.id).is('parent_bloc_id', null).order('ordre');
    for (const b of blocsOriginaux || []) {
      await supabaseClient.from('blocs_seance').insert({
        seance_id: seanceCopie.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier, ordre: b.ordre
      });
    }
  }
  return copie;
}

async function ouvrirDupliquerNoeud(noeudId) {
  const { data: noeud } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', noeudId).single();
  if (!noeud) return;

  if (!noeud.parent_id) {
    return confirmerAction(`Dupliquer "${noeud.titre}" comme nouveau niveau racine, avec tout son contenu ?`, async () => {
      contenu.innerHTML = '<div class="chargement">Duplication en cours (cela peut prendre un instant selon la taille du contenu)...</div>';
      await dupliquerNoeudRecursif(noeudId, null);
      afficherArborescence();
    });
  }

  const { data: parentActuel } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', noeud.parent_id).single();
  let requete = supabaseClient.from('noeuds_parcours').select('*')
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).eq('type_noeud', parentActuel.type_noeud).order('ordre');
  requete = parentActuel.parent_id ? requete.eq('parent_id', parentActuel.parent_id) : requete.is('parent_id', null);
  const { data: destinationsPossibles } = await requete;

  if (!destinationsPossibles || destinationsPossibles.length === 0) return alert('Aucune destination possible.');

  ouvrirModal({
    titre: `Dupliquer "${noeud.titre}" vers...`,
    champs: [{
      nom: 'destination', label: `Destination (même niveau que "${parentActuel.titre}")`, type: 'select',
      options: destinationsPossibles.map(d => ({ valeur: d.id, label: d.titre }))
    }],
    texteValider: 'Dupliquer',
    onValider: async ({ destination }) => {
      contenu.innerHTML = '<div class="chargement">Duplication en cours (cela peut prendre un instant selon la taille du contenu)...</div>';
      await dupliquerNoeudRecursif(noeudId, parseInt(destination, 10));
      afficherArborescence();
    }
  });
}

async function ouvrirDupliquerSA(saId) {
  const { data: sa } = await supabaseClient.from('sa').select('*').eq('id', saId).single();
  if (!sa) return;
  const { data: noeudActuel } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', sa.noeud_id).single();

  let requete = supabaseClient.from('noeuds_parcours').select('*')
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).eq('type_noeud', noeudActuel.type_noeud).order('ordre');
  requete = noeudActuel.parent_id ? requete.eq('parent_id', noeudActuel.parent_id) : requete.is('parent_id', null);
  const { data: destinationsPossibles } = await requete;

  if (!destinationsPossibles || destinationsPossibles.length === 0) return alert('Aucune destination possible.');

  ouvrirModal({
    titre: `Dupliquer "${sa.titre}" vers...`,
    champs: [{
      nom: 'destination', label: `Destination (même niveau que "${noeudActuel.titre}")`, type: 'select',
      options: destinationsPossibles.map(d => ({ valeur: d.id, label: d.titre }))
    }],
    texteValider: 'Dupliquer',
    onValider: async ({ destination }) => {
      contenu.innerHTML = '<div class="chargement">Duplication en cours...</div>';
      await dupliquerSARecursif(sa, parseInt(destination, 10));
      afficherArborescence();
    }
  });
}

// --- VUE ARBORESCENTE (navigation fluide + création à tout niveau) -------

async function afficherArborescence() {
  const [{ data: tousNoeuds, error: e1 }, { data: toutesSAImbriquees, error: e2 }] = await Promise.all([
    supabaseClient.from('noeuds_parcours').select('*').eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).order('ordre'),
    supabaseClient.from('sa').select('*, noeuds_parcours!inner(classe_id, champ_formation_id)').eq('noeuds_parcours.classe_id', etat.classe.id).eq('noeuds_parcours.champ_formation_id', etat.champ.id).order('ordre')
  ]);
  if (e1) return erreur(e1);
  if (e2) return erreur(e2);
  const toutesSA = toutesSAImbriquees || [];

  const idsSA = toutesSA.map(s => s.id);
  const { data: toutesSeances, error: e3 } = idsSA.length
    ? await supabaseClient.from('seances').select('*').in('sa_id', idsSA).order('ordre')
    : { data: [], error: null };
  if (e3) return erreur(e3);

  const enfantsParParent = {};
  (tousNoeuds || []).forEach(n => { const cle = n.parent_id ?? 'racine'; (enfantsParParent[cle] ??= []).push(n); });
  const saParNoeud = {};
  toutesSA.forEach(s => { (saParNoeud[s.noeud_id] ??= []).push(s); });
  const seancesParSA = {};
  (toutesSeances || []).forEach(se => { (seancesParSA[se.sa_id] ??= []).push(se); });

  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };
  const structure = structureImposeeChamp();

  function rendreNoeud(n, profondeur) {
    const enfants = enfantsParParent[n.id] || [];
    const sas = saParNoeud[n.id] || [];
    const aDuContenu = enfants.length || sas.length;
    const auNiveauMax = structure ? profondeur + 1 >= structure.length : false;
    const ouvert = noeudsOuverts.has(n.id);
    return `<div class="noeud-arbo">
      <div class="ligne-arbo">
        <span class="bascule" data-bascule="${n.id}">${aDuContenu ? (ouvert ? '▾' : '▸') : '·'}</span>
        <span class="libelle-arbo" data-bascule="${n.id}">${echapper(n.titre)}</span><span class="type-arbo">${etiquetteType(n.type_noeud)}</span>
        ${etat.peutEditer ? `<div class="actions-arbo">
          ${(!structure || !auNiveauMax) ? `<button data-arbo-ajouter-niveau="${n.id}" data-profondeur="${profondeur + 1}">+ Niveau</button>` : ''}
          ${(!structure || auNiveauMax) ? `<button data-arbo-ajouter-sa="${n.id}" data-type-noeud="${n.type_noeud}">+ SA</button>` : ''}
          <button data-arbo-renommer-noeud="${n.id}" data-titre-actuel="${echapper(n.titre)}">✏️</button>
          <button data-arbo-dupliquer-noeud="${n.id}" title="Dupliquer avec tout son contenu vers un autre parent du même niveau">📋</button>
          <button data-arbo-supprimer-noeud="${n.id}">🗑️</button>
        </div>` : ''}
      </div>
      <div class="enfants-arbo" data-enfants="${n.id}" style="display:${ouvert ? 'block' : 'none'}">
        ${enfants.map(e => rendreNoeud(e, profondeur + 1)).join('')}
        ${sas.map(s => rendreSA(s)).join('')}
      </div>
    </div>`;
  }

  function rendreSA(s) {
    const seances = seancesParSA[s.id] || [];
    const ouvert = saOuvertes.has(s.id);
    return `<div class="noeud-arbo">
      <div class="ligne-arbo type-sa">
        <span class="bascule" data-bascule-sa="${s.id}">${seances.length ? (ouvert ? '▾' : '▸') : '·'}</span>
        <span class="libelle-arbo" data-bascule-sa="${s.id}">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapper(s.titre)}</span><span class="type-arbo">SA</span>
        ${etat.peutEditer ? `<div class="actions-arbo">
          <button data-arbo-ajouter-seance="${s.id}">+ Séance</button>
          <button data-arbo-dupliquer-sa="${s.id}" title="Dupliquer cette SA (et ses séances) vers un autre niveau">📋</button>
          <button data-arbo-supprimer-sa="${s.id}">🗑️</button>
        </div>` : ''}
      </div>
      <div class="enfants-arbo" data-enfants-sa="${s.id}" style="display:${ouvert ? 'block' : 'none'}">
        ${seances.map(se => rendreSeance(se)).join('') || '<p class="chargement" style="padding:10px">Aucune séance.</p>'}
      </div>
    </div>`;
  }

  function rendreSeance(se) {
    // La discipline est mise en avant (label principal) — le titre de la
    // séance devient une précision secondaire juste à côté, alignée.
    const labelPrincipal = se.discipline ? echapper(se.discipline) : echapper(se.titre);
    const labelSecondaire = se.discipline ? `<span style="color:var(--texte-gris);font-weight:400"> — ${echapper(se.titre)}</span>` : '';
    return `<div class="ligne-arbo type-seance">
      <span class="bascule">·</span>
      <a class="libelle-arbo" href="editeur-seance.html?id=${se.id}" style="display:flex;align-items:baseline">${labelPrincipal}${labelSecondaire}</a>
      <span class="statut-pill statut-${se.statut}" style="margin-left:6px">${pillsStatut[se.statut]}</span>
      ${etat.peutEditer ? `<div class="actions-arbo">
        <a href="editeur-seance.html?id=${se.id}" title="Éditer le contenu">✏️</a>
        <button data-arbo-supprimer-seance="${se.id}">🗑️</button>
      </div>` : ''}
    </div>`;
  }

  const racines = enfantsParParent['racine'] || [];
  const boutonAjoutRacine = etat.peutEditer ? `<button class="btn btn-accent" id="btnArboAjouterRacine" style="margin-bottom:14px">+ Ajouter un niveau racine${structure ? ' (' + etiquetteType(structure[0]) + ')' : ''}</button>` : '';
  const boutonAjoutSARacine = (etat.peutEditer && !structure) ? `<button class="btn btn-accent" id="btnArboAjouterSARacine" style="margin-bottom:14px;margin-left:8px">+ SA directement</button>` : '';

  contenu.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div class="titre-page" style="margin-bottom:0">🌳 Arborescence — ${echapper(etat.champ.nom)} (${echapper(etat.classe.nom)})</div>
      <button class="btn btn-discret" id="btnRetourNavClassique">📋 Navigation classique</button>
    </div>
    ${structure ? `<p class="infos-sauvegarde" style="margin-bottom:10px">📐 Structure imposée : ${structure.map(etiquetteType).join(' → ')} → SA → Séance</p>` : ''}
    ${boutonAjoutRacine}${boutonAjoutSARacine}
    <div class="arborescence">
      ${racines.length ? racines.map(n => rendreNoeud(n, 0)).join('') : '<p class="chargement">Aucun contenu — commencez par ajouter un niveau racine.</p>'}
    </div>`;

  document.getElementById('btnRetourNavClassique').addEventListener('click', () => { etat.vueArborescence = false; afficher(); });
  const btnSARacine = document.getElementById('btnArboAjouterSARacine');
  if (btnSARacine) btnSARacine.addEventListener('click', async () => {
    const idRacine = await obtenirOuCreerNoeudRacineImplicite();
    if (!idRacine) return;
    noeudsOuverts.add(idRacine);
    creerSADans(idRacine, 'discipline', etat.champ.code, afficherArborescence);
  });
  const btnRacine = document.getElementById('btnArboAjouterRacine');
  if (btnRacine) btnRacine.addEventListener('click', () => creerNoeudDans(etat.classe.id, etat.champ.id, etat.champ.code, null, 0, afficherArborescence));

  const arbo = document.querySelector('.arborescence');
  if (!arbo) return;
  arbo.addEventListener('click', (e) => {
    const cible = e.target;

    const toggleNoeud = cible.closest('[data-bascule]:not([data-bascule-sa])');
    if (toggleNoeud) {
      const id = parseInt(toggleNoeud.dataset.bascule, 10);
      const conteneur = document.querySelector(`[data-enfants="${id}"]`);
      if (conteneur) {
        const ouvert = conteneur.style.display !== 'none';
        conteneur.style.display = ouvert ? 'none' : 'block';
        if (ouvert) noeudsOuverts.delete(id); else noeudsOuverts.add(id);
        document.querySelectorAll(`[data-bascule="${id}"].bascule`).forEach(b => b.textContent = ouvert ? '▸' : '▾');
      }
      if (!cible.closest('.actions-arbo')) return;
    }

    const toggleSA = cible.closest('[data-bascule-sa]');
    if (toggleSA && !cible.closest('.actions-arbo')) {
      const id = parseInt(toggleSA.dataset.basculeSa, 10);
      const conteneur = document.querySelector(`[data-enfants-sa="${id}"]`);
      if (conteneur) {
        const ouvert = conteneur.style.display !== 'none';
        conteneur.style.display = ouvert ? 'none' : 'block';
        if (ouvert) saOuvertes.delete(id); else saOuvertes.add(id);
        document.querySelectorAll(`[data-bascule-sa="${id}"].bascule`).forEach(b => b.textContent = ouvert ? '▸' : '▾');
      }
      return;
    }

    const btnAjouterNiveau = cible.closest('[data-arbo-ajouter-niveau]');
    if (btnAjouterNiveau) {
      const idParent = parseInt(btnAjouterNiveau.dataset.arboAjouterNiveau, 10);
      return creerNoeudDans(etat.classe.id, etat.champ.id, etat.champ.code, idParent, parseInt(btnAjouterNiveau.dataset.profondeur, 10), () => { noeudsOuverts.add(idParent); afficherArborescence(); });
    }

    const btnAjouterSA = cible.closest('[data-arbo-ajouter-sa]');
    if (btnAjouterSA) {
      const idParent = parseInt(btnAjouterSA.dataset.arboAjouterSa, 10);
      return creerSADans(idParent, btnAjouterSA.dataset.typeNoeud, etat.champ.code, () => { noeudsOuverts.add(idParent); afficherArborescence(); });
    }

    const btnAjouterSeance = cible.closest('[data-arbo-ajouter-seance]');
    if (btnAjouterSeance) {
      const idSA = parseInt(btnAjouterSeance.dataset.arboAjouterSeance, 10);
      return creerSeanceDans(idSA, false, () => { saOuvertes.add(idSA); afficherArborescence(); });
    }

    const btnRenommer = cible.closest('[data-arbo-renommer-noeud]');
    if (btnRenommer) {
      return ouvrirModal({
        titre: 'Renommer', champs: [{ nom: 'titre', label: 'Titre', valeur: btnRenommer.dataset.titreActuel }], texteValider: 'Renommer',
        onValider: async ({ titre }) => {
          const { error } = await supabaseClient.from('noeuds_parcours').update({ titre }).eq('id', parseInt(btnRenommer.dataset.arboRenommerNoeud, 10));
          if (error) return alert(error.message);
          afficherArborescence();
        }
      });
    }

    const btnDupliquerNoeud = cible.closest('[data-arbo-dupliquer-noeud]');
    if (btnDupliquerNoeud) return ouvrirDupliquerNoeud(parseInt(btnDupliquerNoeud.dataset.arboDupliquerNoeud, 10));

    const btnDupliquerSA = cible.closest('[data-arbo-dupliquer-sa]');
    if (btnDupliquerSA) return ouvrirDupliquerSA(parseInt(btnDupliquerSA.dataset.arboDupliquerSa, 10));

    const btnSupprimerNoeud = cible.closest('[data-arbo-supprimer-noeud]');
    if (btnSupprimerNoeud) return supprimerNoeud(parseInt(btnSupprimerNoeud.dataset.arboSupprimerNoeud, 10));

    const btnSupprimerSA = cible.closest('[data-arbo-supprimer-sa]');
    if (btnSupprimerSA) return supprimerSA(parseInt(btnSupprimerSA.dataset.arboSupprimerSa, 10));

    const btnSupprimerSeance = cible.closest('[data-arbo-supprimer-seance]');
    if (btnSupprimerSeance) return supprimerSeance(parseInt(btnSupprimerSeance.dataset.arboSupprimerSeance, 10), afficherArborescence);
  });
}
function erreur(e) {
  contenu.innerHTML = `<p class="message-erreur">Erreur : ${echapper(e.message)}</p>`;
  console.error(e);
}

function echapper(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// --- POINT D'ENTRÉE : reprend le contexte depuis l'URL si présent --------
// (ex: retour depuis l'éditeur de séance, qui ramène directement à la SA
// plutôt qu'à la racine — voir urlNavigationVersSA() dans editeur-seance.js)
async function initDepuisURL() {
  const p = new URLSearchParams(window.location.search);
  const classeId = p.get('classeId');
  const champId = p.get('champId');
  const saId = p.get('saId');

  if (classeId) {
    const { data: classe } = await supabaseClient.from('classes').select('*').eq('id', classeId).single();
    if (classe) etat.classe = classe;
  }
  if (etat.classe && champId) {
    const { data: champ } = await supabaseClient.from('champs_formation').select('*').eq('id', champId).single();
    if (champ) { etat.champ = champ; etat.vueArborescence = false; await verifierPermissions(); }
  }
  if (etat.champ && saId) {
    const { data: sa } = await supabaseClient.from('sa').select('*').eq('id', saId).single();
    if (sa) etat.sa = sa;
  }
  afficher();
}

initDepuisURL();
