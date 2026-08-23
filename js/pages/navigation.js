// Page pages/navigation.html
const etat = {
  classe: null, champ: null, cheminNoeuds: [], sa: null,
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
  etat.cheminNoeuds.forEach((n, i) => segments.push({ label: n.titre, action: 'noeud', index: i }));
  if (etat.sa) segments.push({ label: etat.sa.titre, action: null });

  filAriane.innerHTML = segments.map((s, i) => {
    const dernier = i === segments.length - 1;
    return `<span class="segment ${dernier ? 'actif' : ''}" ${s.action ? `data-fil-action="${s.action}" data-fil-index="${s.index ?? ''}"` : ''}>${echapper(s.label)}</span>` +
      (dernier ? '' : `<span class="sep">›</span>`);
  }).join('');

  filAriane.querySelectorAll('[data-fil-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.filAction;
      if (action === 'accueil') Object.assign(etat, { classe: null, champ: null, cheminNoeuds: [], sa: null });
      if (action === 'classe') Object.assign(etat, { champ: null, cheminNoeuds: [], sa: null });
      if (action === 'champ') Object.assign(etat, { cheminNoeuds: [], sa: null });
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
            <button class="bouton-acceder-champ" type="button">Accéder ➔</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('grilleCartes').addEventListener('click', async (e) => {
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    const c = champs.find(x => String(x.id) === carte.dataset.id);
    etat.champ = c;
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

async function afficherNoeudsEtSA() {
  const parentId = etat.cheminNoeuds.length ? etat.cheminNoeuds[etat.cheminNoeuds.length - 1].id : null;

  let requeteNoeuds = supabaseClient.from('noeuds_parcours').select('*').eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).order('ordre');
  requeteNoeuds = parentId ? requeteNoeuds.eq('parent_id', parentId) : requeteNoeuds.is('parent_id', null);
  const { data: noeuds, error: erreurNoeuds } = await requeteNoeuds;
  if (erreurNoeuds) return erreur(erreurNoeuds);

  let sas = [];
  if (parentId) {
    const { data, error: erreurSA } = await supabaseClient.from('sa').select('*').eq('noeud_id', parentId).order('ordre');
    if (erreurSA) return erreur(erreurSA);
    sas = data;
  }

  const boutonAjoutNiveau = etat.peutEditer ? `<button class="btn btn-accent" id="btnCreerNoeud" style="margin-bottom:14px">+ Ajouter un niveau</button>` : '';
  const boutonAjoutSA = (etat.peutEditer && parentId) ? `<button class="btn btn-accent" id="btnCreerSA" style="margin-bottom:14px;margin-left:8px">+ Nouvelle SA ici</button>` : '';

  let html = `<div style="margin-bottom:10px">${boutonAjoutNiveau}${boutonAjoutSA}</div>`;

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
}

async function supprimerNoeud(id) {
  if (!confirm("Supprimer ce niveau ? Tout ce qu'il contient (sous-niveaux, SA, séances, blocs) sera supprimé avec.")) return;
  const { error } = await supabaseClient.from('noeuds_parcours').delete().eq('id', id);
  if (error) return alert(error.message);
  afficher();
}

function etiquetteType(t) {
  return { theme: 'Thème', unite: 'Unité', semaine: 'Semaine', dossier: 'Dossier', discipline: 'Discipline' }[t] || t;
}

async function supprimerSA(id) {
  if (!confirm("Supprimer cette SA ? Toutes ses séances et leurs blocs seront supprimés avec.")) return;
  const { error } = await supabaseClient.from('sa').delete().eq('id', id);
  if (error) return alert(error.message);
  afficher();
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
  if (btnCreer) btnCreer.addEventListener('click', creerSeance);
}

async function supprimerSeance(id) {
  if (!confirm('Supprimer cette séance et tous ses blocs ?')) return;
  const { error } = await supabaseClient.from('seances').delete().eq('id', id);
  if (error) return alert(error.message);
  afficher();
}

// --- CRÉATION RAPIDE -----------------------------------------------------

async function creerNoeud() {
  const titre = prompt("Titre du niveau (ex: Thème 1, Unité 3, Semaine 1, Dossier 2) :");
  if (!titre) return;
  const type = prompt("Type : theme / unite / semaine / dossier\n(utilisez \"discipline\" uniquement pour un champ à un seul niveau, ex: EPS)", "semaine");
  if (!type) return;
  const parentId = etat.cheminNoeuds.length ? etat.cheminNoeuds[etat.cheminNoeuds.length - 1].id : null;
  const { error } = await supabaseClient.from('noeuds_parcours').insert({
    classe_id: etat.classe.id, champ_formation_id: etat.champ.id, parent_id: parentId, type_noeud: type, titre, ordre: 0
  });
  if (error) return alert(error.message);
  afficher();
}

async function creerSA(noeudParentId) {
  if (!noeudParentId) return alert("Entrez d'abord dans un niveau (ex: une Semaine) avant de créer une SA.");
  const titre = prompt("Titre de la SA :");
  if (!titre) return;
  const { error } = await supabaseClient.from('sa').insert({ noeud_id: noeudParentId, titre, ordre: 0 });
  if (error) return alert(error.message);
  afficher();
}

async function creerSeance() {
  const titre = prompt("Titre de la séance :");
  if (!titre) return;
  const discipline = prompt("Discipline de cette séance (ex: Lecture, Grammaire, Conjugaison, Orthographe, Vocabulaire, Expression écrite, Écriture...) — laissez vide si non applicable :", "");
  const { data: { session } } = await supabaseClient.auth.getSession();
  const { data, error } = await supabaseClient.from('seances').insert({
    sa_id: etat.sa.id, titre, discipline: discipline || null, statut: 'brouillon', ordre: 0, cree_par: session.user.id
  }).select().single();
  if (error) return alert(error.message);
  window.location.href = `editeur-seance.html?id=${data.id}`;
}

function erreur(e) {
  contenu.innerHTML = `<p class="message-erreur">Erreur : ${echapper(e.message)}</p>`;
  console.error(e);
}

function echapper(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

afficher();
