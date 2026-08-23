// Page pages/navigation.html
const etat = {
  classe: null, champ: null, cheminNoeuds: [], sa: null, vueArborescence: false,
  peutEditer: false, peutValider: false, profilAdmin: null
};

const contenu = document.getElementById('contenu');
const filAriane = document.getElementById('filAriane');

(async function initEntete() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  const profil = await chargerProfilAdmin(session.user.id);
  if (!profil) return;
  etat.profilAdmin = profil;
  document.getElementById('zoneDroite').innerHTML = `
    <span class="badge-utilisateur">${profil.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profil.prenom}</span>
    <button class="btn btn-discret" id="btnDeconnexion">Déconnexion</button>
  `;
  document.getElementById('btnDeconnexion').addEventListener('click', deconnecterAdmin);
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
  const droitsEdition = etat.profilAdmin
    ? await Promise.all(champs.map(c => supabaseClient.rpc('peut_editer_perimetre', { p_id: etat.profilAdmin.id, p_classe_id: etat.classe.id, p_champ_id: c.id }).then(r => !!r.data)))
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
              <button class="bouton-acceder-champ" type="button">Accéder ➔</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('grilleCartes').addEventListener('click', async (e) => {
    const btnEditer = e.target.closest('[data-editer-champ]');
    if (btnEditer) {
      e.stopPropagation();
      etat.champ = champs.find(x => String(x.id) === btnEditer.dataset.editerChamp);
      etat.vueArborescence = true;
      await verifierPermissions();
      return afficher();
    }
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    const c = champs.find(x => String(x.id) === carte.dataset.id);
    etat.champ = c;
    etat.vueArborescence = false;
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
  if (!etat.profilAdmin) return;
  const { data: peutEditer } = await supabaseClient.rpc('peut_editer_perimetre', { p_id: etat.profilAdmin.id, p_classe_id: etat.classe.id, p_champ_id: etat.champ.id });
  const { data: peutValider } = await supabaseClient.rpc('peut_valider_perimetre', { p_id: etat.profilAdmin.id, p_classe_id: etat.classe.id, p_champ_id: etat.champ.id });
  etat.peutEditer = !!peutEditer;
  etat.peutValider = !!peutValider;
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
  const peutAjouterSA = etat.peutEditer && parentId && (!structure || auNiveauMax);

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
          <div class="titre-carte">${echapper(n.titre)}</div><div class="sous-titre-carte">${etiquetteType(n.type_noeud)}</div>
        </div>`).join('')}</div>`;
  }

  if (sas.length > 0) {
    html += `<div class="titre-cycle">Situations d'Apprentissage</div>
      <div class="grille-cartes" id="grilleSA">${sas.map(s => `
        <div class="carte" data-id="${s.id}" style="position:relative">
          ${etat.peutEditer ? `<button data-supprimer-sa="${s.id}" title="Supprimer" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:14px">🗑️</button>` : ''}
          <div class="titre-carte">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapper(s.titre)}</div>${s.description ? `<div class="sous-titre-carte">${echapper(s.description)}</div>` : ''}
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

function creerSA(noeudParentId) {
  if (!noeudParentId) return alert("Entrez d'abord dans un niveau avant de créer une SA.");
  const structure = structureImposeeChamp();
  if (structure && etat.cheminNoeuds.length < structure.length) {
    return alert(`Pour ${etat.champ.nom}, une SA ne peut être créée qu'au niveau "${etiquetteType(structure[structure.length - 1])}". Continuez à descendre dans les niveaux.`);
  }
  const typeNoeudParent = structure ? structure[structure.length - 1] : null;
  creerSADans(noeudParentId, typeNoeudParent, etat.champ.code, afficher);
}

function creerSeanceDans(saId, redirigerVersEditeur = true, onCree) {
  ouvrirModal({
    titre: 'Nouvelle séance',
    champs: [
      { nom: 'titre', label: 'Titre', placeholder: 'Ex: Séance 1 — Découverte du texte' },
      { nom: 'discipline', label: 'Discipline (optionnelle)', requis: false, placeholder: 'Lecture, Grammaire, Conjugaison...' }
    ],
    texteValider: redirigerVersEditeur ? "Créer et ouvrir l'éditeur" : 'Créer',
    onValider: async ({ titre, discipline }) => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const { data, error } = await supabaseClient.from('seances').insert({
        sa_id: saId, titre, discipline: discipline || null, statut: 'brouillon', ordre: 0, cree_par: session.user.id
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
    return `<div class="noeud-arbo">
      <div class="ligne-arbo">
        <span class="bascule" data-bascule="${n.id}">${aDuContenu ? '▸' : '·'}</span>
        <span class="libelle-arbo" data-bascule="${n.id}">${echapper(n.titre)}</span><span class="type-arbo">${etiquetteType(n.type_noeud)}</span>
        ${etat.peutEditer ? `<div class="actions-arbo">
          ${(!structure || !auNiveauMax) ? `<button data-arbo-ajouter-niveau="${n.id}" data-profondeur="${profondeur + 1}">+ Niveau</button>` : ''}
          ${(!structure || auNiveauMax) ? `<button data-arbo-ajouter-sa="${n.id}" data-type-noeud="${n.type_noeud}">+ SA</button>` : ''}
          <button data-arbo-renommer-noeud="${n.id}" data-titre-actuel="${echapper(n.titre)}">✏️</button>
          <button data-arbo-supprimer-noeud="${n.id}">🗑️</button>
        </div>` : ''}
      </div>
      <div class="enfants-arbo" data-enfants="${n.id}" style="display:none">
        ${enfants.map(e => rendreNoeud(e, profondeur + 1)).join('')}
        ${sas.map(s => rendreSA(s)).join('')}
      </div>
    </div>`;
  }

  function rendreSA(s) {
    const seances = seancesParSA[s.id] || [];
    return `<div class="noeud-arbo">
      <div class="ligne-arbo type-sa">
        <span class="bascule" data-bascule-sa="${s.id}">${seances.length ? '▸' : '·'}</span>
        <span class="libelle-arbo" data-bascule-sa="${s.id}">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapper(s.titre)}</span><span class="type-arbo">SA</span>
        ${etat.peutEditer ? `<div class="actions-arbo">
          <button data-arbo-ajouter-seance="${s.id}">+ Séance</button>
          <button data-arbo-supprimer-sa="${s.id}">🗑️</button>
        </div>` : ''}
      </div>
      <div class="enfants-arbo" data-enfants-sa="${s.id}" style="display:none">
        ${seances.map(se => rendreSeance(se)).join('') || '<p class="chargement" style="padding:10px">Aucune séance.</p>'}
      </div>
    </div>`;
  }

  function rendreSeance(se) {
    return `<div class="ligne-arbo type-seance">
      <span class="bascule">·</span>
      <a class="libelle-arbo" href="editeur-seance.html?id=${se.id}">${echapper(se.titre)}</a>
      ${se.discipline ? `<span class="type-arbo">${echapper(se.discipline)}</span>` : ''}
      <span class="statut-pill statut-${se.statut}" style="margin-left:6px">${pillsStatut[se.statut]}</span>
      ${etat.peutEditer ? `<div class="actions-arbo">
        <a href="editeur-seance.html?id=${se.id}" title="Éditer le contenu">✏️</a>
        <button data-arbo-supprimer-seance="${se.id}">🗑️</button>
      </div>` : ''}
    </div>`;
  }

  const racines = enfantsParParent['racine'] || [];
  const boutonAjoutRacine = etat.peutEditer ? `<button class="btn btn-accent" id="btnArboAjouterRacine" style="margin-bottom:14px">+ Ajouter un niveau racine${structure ? ' (' + etiquetteType(structure[0]) + ')' : ''}</button>` : '';

  contenu.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div class="titre-page" style="margin-bottom:0">🌳 Arborescence — ${echapper(etat.champ.nom)} (${echapper(etat.classe.nom)})</div>
      <button class="btn btn-discret" id="btnRetourNavClassique">📋 Navigation classique</button>
    </div>
    ${structure ? `<p class="infos-sauvegarde" style="margin-bottom:10px">📐 Structure imposée : ${structure.map(etiquetteType).join(' → ')} → SA → Séance</p>` : ''}
    ${boutonAjoutRacine}
    <div class="arborescence">
      ${racines.length ? racines.map(n => rendreNoeud(n, 0)).join('') : '<p class="chargement">Aucun contenu — commencez par ajouter un niveau racine.</p>'}
    </div>`;

  document.getElementById('btnRetourNavClassique').addEventListener('click', () => { etat.vueArborescence = false; afficher(); });
  const btnRacine = document.getElementById('btnArboAjouterRacine');
  if (btnRacine) btnRacine.addEventListener('click', () => creerNoeudDans(etat.classe.id, etat.champ.id, etat.champ.code, null, 0, afficherArborescence));

  const arbo = document.querySelector('.arborescence');
  if (!arbo) return;
  arbo.addEventListener('click', (e) => {
    const cible = e.target;

    const toggleNoeud = cible.closest('[data-bascule]:not([data-bascule-sa])');
    if (toggleNoeud) {
      const conteneur = document.querySelector(`[data-enfants="${toggleNoeud.dataset.bascule}"]`);
      if (conteneur) {
        const ouvert = conteneur.style.display !== 'none';
        conteneur.style.display = ouvert ? 'none' : 'block';
        document.querySelectorAll(`[data-bascule="${toggleNoeud.dataset.bascule}"].bascule`).forEach(b => b.textContent = ouvert ? '▸' : '▾');
      }
      if (!cible.closest('.actions-arbo')) return;
    }

    const toggleSA = cible.closest('[data-bascule-sa]');
    if (toggleSA && !cible.closest('.actions-arbo')) {
      const conteneur = document.querySelector(`[data-enfants-sa="${toggleSA.dataset.basculeSa}"]`);
      if (conteneur) {
        const ouvert = conteneur.style.display !== 'none';
        conteneur.style.display = ouvert ? 'none' : 'block';
        document.querySelectorAll(`[data-bascule-sa="${toggleSA.dataset.basculeSa}"].bascule`).forEach(b => b.textContent = ouvert ? '▸' : '▾');
      }
      return;
    }

    const btnAjouterNiveau = cible.closest('[data-arbo-ajouter-niveau]');
    if (btnAjouterNiveau) return creerNoeudDans(etat.classe.id, etat.champ.id, etat.champ.code, parseInt(btnAjouterNiveau.dataset.arboAjouterNiveau, 10), parseInt(btnAjouterNiveau.dataset.profondeur, 10), afficherArborescence);

    const btnAjouterSA = cible.closest('[data-arbo-ajouter-sa]');
    if (btnAjouterSA) return creerSADans(parseInt(btnAjouterSA.dataset.arboAjouterSa, 10), btnAjouterSA.dataset.typeNoeud, etat.champ.code, afficherArborescence);

    const btnAjouterSeance = cible.closest('[data-arbo-ajouter-seance]');
    if (btnAjouterSeance) return creerSeanceDans(parseInt(btnAjouterSeance.dataset.arboAjouterSeance, 10), false, afficherArborescence);

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

afficher();
