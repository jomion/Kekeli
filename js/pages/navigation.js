// Page pages/navigation.html
const etat = {
  classe: null, champ: null, cheminNoeuds: [], discipline: null, sa: null,
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
  if (etat.discipline) segments.push({ label: etat.discipline.titre, action: 'discipline' });
  if (etat.sa) segments.push({ label: etat.sa.titre, action: null });

  filAriane.innerHTML = segments.map((s, i) => {
    const dernier = i === segments.length - 1;
    return `<span class="segment ${dernier ? 'actif' : ''}" ${s.action ? `data-fil-action="${s.action}" data-fil-index="${s.index ?? ''}"` : ''}>${echapper(s.label)}</span>` +
      (dernier ? '' : `<span class="sep">›</span>`);
  }).join('');

  filAriane.querySelectorAll('[data-fil-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.filAction;
      if (action === 'accueil') Object.assign(etat, { classe: null, champ: null, cheminNoeuds: [], discipline: null, sa: null });
      if (action === 'classe') Object.assign(etat, { champ: null, cheminNoeuds: [], discipline: null, sa: null });
      if (action === 'champ') Object.assign(etat, { cheminNoeuds: [], discipline: null, sa: null });
      if (action === 'noeud') { etat.cheminNoeuds = etat.cheminNoeuds.slice(0, parseInt(el.dataset.filIndex, 10) + 1); etat.discipline = null; etat.sa = null; }
      if (action === 'discipline') etat.sa = null;
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
  if (!etat.discipline) return afficherNoeuds();
  if (!etat.sa) return afficherSA();
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


// Icônes et noms complets par classe (présentation uniquement, clé = nom en base)
const PRESENTATION_CLASSES = {
  CI:  { icone: '🎈', description: "Cours d'Initiation" },
  CP:  { icone: '📗', description: 'Cours Préparatoire' },
  CE1: { icone: '📘', description: 'Cours Élémentaire 1ère année' },
  CE2: { icone: '📙', description: 'Cours Élémentaire 2ème année' },
  CM1: { icone: '📕', description: 'Cours Moyen 1ère année' },
  CM2: { icone: '🎓', description: 'Cours Moyen 2ème année' }
};

async function afficherClasses() {
  const { data, error } = await supabaseClient.from('classes').select('*').order('ordre');
  if (error) return erreur(error);

  const comptes = await Promise.all(data.map(c =>
    supabaseClient.from('classes_champs_formation').select('champ_formation_id', { count: 'exact', head: true }).eq('classe_id', c.id)
      .then(r => r.count || 0)
  ));

  contenu.innerHTML = `
    <div class="titre-page">Classes</div>
    <div class="sous-titre-page">Sélectionnez une classe pour accéder à ses champs de formation.</div>
    <div class="grille-champs" id="grilleCartes">
      ${data.map((c, i) => {
        const p = PRESENTATION_CLASSES[c.nom] || { icone: '📘', description: '' };
        return `
        <div class="carte-champ" data-id="${c.id}">
          <div class="entete-carte-champ">
            <div class="icone-champ">${p.icone}</div>
            <div class="titre-carte-champ">${echapper(c.nom)}</div>
          </div>
          <div class="description-carte-champ">${echapper(p.description)}</div>
          <div class="pied-carte-champ">
            <span class="nb-unites-champ">${comptes[i]} Champ${comptes[i] > 1 ? 's' : ''}</span>
            <button class="bouton-acceder-champ" type="button">Accéder ➔</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('grilleCartes').addEventListener('click', (e) => {
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    etat.classe = data.find(x => String(x.id) === carte.dataset.id);
    afficher();
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

  const { data: disciplines } = await supabaseClient
    .from('noeuds_parcours').select('id')
    .eq('classe_id', etat.classe.id).eq('champ_formation_id', champ.id).eq('type_noeud', 'discipline');
  if (!disciplines || disciplines.length === 0) return 0;

  const { count: compteSA } = await supabaseClient
    .from('sa').select('id', { count: 'exact', head: true }).in('noeud_id', disciplines.map(d => d.id));
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

async function afficherNoeuds() {
  const parentId = etat.cheminNoeuds.length ? etat.cheminNoeuds[etat.cheminNoeuds.length - 1].id : null;
  let requete = supabaseClient.from('noeuds_parcours').select('*').eq('classe_id', etat.classe.id).eq('champ_formation_id', etat.champ.id).order('ordre');
  requete = parentId ? requete.eq('parent_id', parentId) : requete.is('parent_id', null);
  const { data, error } = await requete;
  if (error) return erreur(error);

  const boutonAjout = etat.peutEditer ? `<button class="btn btn-accent" id="btnCreerNoeud" style="margin-bottom:14px">+ Ajouter un niveau</button>` : '';

  if (data.length === 0) {
    contenu.innerHTML = `<p class="chargement">Aucun contenu créé pour l'instant ici.</p>${boutonAjout}`;
  } else {
    contenu.innerHTML = `${boutonAjout}<div class="grille-cartes" id="grilleCartes">${data.map(n => `
      <div class="carte" data-id="${n.id}"><div class="titre-carte">${echapper(n.titre)}</div><div class="sous-titre-carte">${etiquetteType(n.type_noeud)}</div></div>`).join('')}</div>`;
    document.getElementById('grilleCartes').addEventListener('click', (e) => {
      const carte = e.target.closest('[data-id]');
      if (!carte) return;
      const n = data.find(x => String(x.id) === carte.dataset.id);
      if (n.type_noeud === 'discipline') etat.discipline = n; else etat.cheminNoeuds.push(n);
      afficher();
    });
  }
  const btnCreer = document.getElementById('btnCreerNoeud');
  if (btnCreer) btnCreer.addEventListener('click', creerNoeud);
}

function etiquetteType(t) {
  return { theme: 'Thème', unite: 'Unité', semaine: 'Semaine', dossier: 'Dossier', discipline: 'Discipline' }[t] || t;
}

async function afficherSA() {
  const { data, error } = await supabaseClient.from('sa').select('*').eq('noeud_id', etat.discipline.id).order('ordre');
  if (error) return erreur(error);
  const boutonAjout = etat.peutEditer ? `<button class="btn btn-accent" id="btnCreerSA" style="margin-bottom:14px">+ Nouvelle SA</button>` : '';
  contenu.innerHTML = `${boutonAjout}<div class="grille-cartes" id="grilleCartes">${data.map(s => `
    <div class="carte" data-id="${s.id}"><div class="titre-carte">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapper(s.titre)}</div>${s.description ? `<div class="sous-titre-carte">${echapper(s.description)}</div>` : ''}</div>`).join('')}</div>`;
  document.getElementById('grilleCartes').addEventListener('click', (e) => {
    const carte = e.target.closest('[data-id]');
    if (!carte) return;
    etat.sa = data.find(x => String(x.id) === carte.dataset.id);
    afficher();
  });
  const btnCreer = document.getElementById('btnCreerSA');
  if (btnCreer) btnCreer.addEventListener('click', creerSA);
}

async function afficherSeances() {
  const { data, error } = await supabaseClient.from('seances').select('*').eq('sa_id', etat.sa.id).order('ordre');
  if (error) return erreur(error);
  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };
  const boutonAjout = etat.peutEditer ? `<button class="btn btn-accent" id="btnCreerSeance" style="margin-bottom:14px">+ Nouvelle séance</button>` : '';

  contenu.innerHTML = `${boutonAjout}<div class="liste-lignes">${data.map(s => `
    <div class="ligne">
      <div><div class="titre-ligne">${echapper(s.titre)}</div><span class="statut-pill statut-${s.statut}">${pillsStatut[s.statut]}</span></div>
      ${etat.peutEditer ? `<a class="btn btn-primaire" href="editeur-seance.html?id=${s.id}">Modifier la séance</a>` : ''}
    </div>`).join('') || '<p class="chargement">Aucune séance pour l\'instant.</p>'}</div>`;

  const btnCreer = document.getElementById('btnCreerSeance');
  if (btnCreer) btnCreer.addEventListener('click', creerSeance);
}

// --- CRÉATION RAPIDE -----------------------------------------------------

async function creerNoeud() {
  const titre = prompt("Titre du niveau (ex: Thème 1, Unité 3, Semaine 1, Dossier 2) :");
  if (!titre) return;
  const type = prompt("Type : theme / unite / semaine / dossier / discipline", "discipline");
  if (!type) return;
  const parentId = etat.cheminNoeuds.length ? etat.cheminNoeuds[etat.cheminNoeuds.length - 1].id : null;
  const { error } = await supabaseClient.from('noeuds_parcours').insert({
    classe_id: etat.classe.id, champ_formation_id: etat.champ.id, parent_id: parentId, type_noeud: type, titre, ordre: 0
  });
  if (error) return alert(error.message);
  afficher();
}

async function creerSA() {
  const titre = prompt("Titre de la SA :");
  if (!titre) return;
  const { error } = await supabaseClient.from('sa').insert({ noeud_id: etat.discipline.id, titre, ordre: 0 });
  if (error) return alert(error.message);
  afficher();
}

async function creerSeance() {
  const titre = prompt("Titre de la séance :");
  if (!titre) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  const { data, error } = await supabaseClient.from('seances').insert({
    sa_id: etat.sa.id, titre, statut: 'brouillon', ordre: 0, cree_par: session.user.id
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
