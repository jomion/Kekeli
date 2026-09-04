// Page pages/seances.html — bouton "📌 Séances" accessible à tous les rôles
// connectés (élève, parent, enseignant, autorité pédagogique, admin) : liste
// toutes les séances d'un champ de formation (matière) pour une classe,
// avec filtre, tri, et épinglage personnel (favoris, table
// seances_epinglees) — voir js/navigation-config.js pour le lien.
//
// Cette page vit à la racine de pages/ (comme pages/navigation.html) et est
// donc partagée par tous les rôles : le thème (clair admin / sombre public)
// est choisi dynamiquement, comme pages/navigation.html et
// pages/parametres.html.

let profilSeances = null;
let roleSeances = null; // 'admin' | 'eleve' | 'parent' | 'enseignant' | 'autorite'
let estSuperAdminSeances = false;
let classesAutoriseesSeances = []; // [{id, nom}]
let champsAutorisesSeances = [];   // [{id, nom, code}]
let seancesEpingleesIds = new Set();
let listeAffichee = []; // dernière liste calculée (pour le clic sur une ligne)

const filtresSeances = { classeId: '', champId: '', recherche: '', statut: '', tri: 'hierarchique', epinglesSeulement: false };

const LIBELLES_STATUT_SEANCES = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

(async function () {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const profilAdmin = await chargerProfilAdmin(session.user.id);
  if (profilAdmin) {
    profilSeances = profilAdmin;
    roleSeances = 'admin';
    estSuperAdminSeances = !!profilAdmin.est_super_admin;
  } else {
    const profilGenerique = await chargerProfil(session.user.id);
    const cle = profilGenerique?.role === 'autorite_pedagogique' ? 'autorite' : profilGenerique?.role;
    if (!profilGenerique || !LIENS_PAR_ROLE[cle]) { window.location.href = 'index.html'; return; }
    profilSeances = profilGenerique;
    roleSeances = cle;
  }

  const feuille = document.createElement('link');
  feuille.rel = 'stylesheet';
  feuille.href = roleSeances === 'admin' ? '../css/style.css' : '../css/style-public.css';
  document.head.appendChild(feuille);

  const badgeHtml = roleSeances === 'admin'
    ? `${estSuperAdminSeances ? '👑 Super admin' : '🛠️ Admin'} : ${echapperSea(profilSeances.prenom)}`
    : `🟢 ${echapperSea(profilSeances.prenom)}`;

  await initEnteteNavigation({
    role: roleSeances, utilisateurId: profilSeances.id, badgeHtml,
    liens: liensAvecPrefixe(roleSeances, roleSeances === 'admin' ? 'admin/' : roleSeances + '/', { superAdmin: estSuperAdminSeances })
  });

  const { data: pins } = await supabaseClient.from('seances_epinglees').select('seance_id').eq('utilisateur_id', profilSeances.id);
  seancesEpingleesIds = new Set((pins || []).map(p => p.seance_id));

  await chargerClassesAutorisees();

  // Accès direct depuis une carte matière de pages/navigation.html
  // (?classeId=X&champId=Y) : permet de sauter droit aux séances d'une
  // matière sans repasser par Classes → Matière → Arborescence → SA. On ne
  // retient classeId que s'il fait partie des classes autorisées pour ce
  // rôle (sécurité + évite un sélecteur incohérent) ; champId est validé
  // séparément une fois les matières de cette classe chargées (voir
  // chargerChampsPourClasse), car il dépend de la classe.
  const paramsUrlSea = new URLSearchParams(window.location.search);
  const classeIdUrlSea = paramsUrlSea.get('classeId');
  const champIdUrlSea = paramsUrlSea.get('champId');
  if (classeIdUrlSea && classesAutoriseesSeances.some(c => String(c.id) === classeIdUrlSea)) {
    filtresSeances.classeId = classeIdUrlSea;
    if (champIdUrlSea) filtresSeances.champId = champIdUrlSea;
  }

  afficherPageSeances();
})();

// Reflète classe/matière choisies dans l'URL (remplace l'entrée d'historique
// courante, sans recharger la page) — pour que l'épinglage d'en-tête
// (js/entete-navigation.js, qui capture window.location.pathname+search au
// moment du clic) retienne bien la bonne matière, et pour que le lien de
// cette page reste partageable/rechargeable tel quel.
function synchroniserUrlSeances() {
  const params = new URLSearchParams();
  if (filtresSeances.classeId) params.set('classeId', filtresSeances.classeId);
  if (filtresSeances.champId) params.set('champId', filtresSeances.champId);
  const nouvelle = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  history.replaceState(null, '', nouvelle);
}

// --- Classes accessibles selon le rôle -------------------------------

async function chargerClassesAutorisees() {
  if (roleSeances === 'admin' || roleSeances === 'autorite') {
    const { data } = await supabaseClient.from('classes').select('id, nom').order('ordre');
    classesAutoriseesSeances = data || [];
    return;
  }
  if (roleSeances === 'enseignant') {
    const { data: enseignant } = await supabaseClient.from('enseignants').select('classes_assignees').eq('id', profilSeances.id).single();
    const ids = enseignant?.classes_assignees || [];
    const { data } = ids.length ? await supabaseClient.from('classes').select('id, nom').in('id', ids).order('ordre') : { data: [] };
    classesAutoriseesSeances = data || [];
    return;
  }
  if (roleSeances === 'eleve') {
    const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilSeances.id).single();
    if (!fiche?.classe_id) { classesAutoriseesSeances = []; return; }
    const { data: classe } = await supabaseClient.from('classes').select('id, nom').eq('id', fiche.classe_id).single();
    classesAutoriseesSeances = classe ? [classe] : [];
    return;
  }
  if (roleSeances === 'parent') {
    const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilSeances.id);
    const idsEnfants = (liens || []).map(l => l.eleve_id);
    if (!idsEnfants.length) { classesAutoriseesSeances = []; return; }
    const { data: enfants } = await supabaseClient.from('eleves').select('classe_id').in('id', idsEnfants);
    const idsClasses = [...new Set((enfants || []).map(e => e.classe_id).filter(Boolean))];
    const { data } = idsClasses.length ? await supabaseClient.from('classes').select('id, nom').in('id', idsClasses).order('ordre') : { data: [] };
    classesAutoriseesSeances = data || [];
    return;
  }
  classesAutoriseesSeances = [];
}

const MESSAGES_AUCUNE_CLASSE = {
  enseignant: "Aucune classe ne vous est encore accordée par l'administration — depuis votre tableau de bord, utilisez « + Demander une classe ».",
  eleve: "Aucune classe ne vous est encore attribuée.",
  parent: "Inscrivez d'abord un enfant depuis votre tableau de bord pour consulter ses séances.",
  autorite: "Aucune classe n'existe encore.",
  admin: "Aucune classe n'existe encore."
};

// --- Affichage général -------------------------------------------------

function afficherPageSeances() {
  if (!classesAutoriseesSeances.length) {
    document.getElementById('contenu').innerHTML = `<p class="message-erreur" style="text-align:center;padding:30px 0">${MESSAGES_AUCUNE_CLASSE[roleSeances] || 'Aucune classe disponible.'}</p>`;
    return;
  }
  if (!filtresSeances.classeId) filtresSeances.classeId = String(classesAutoriseesSeances[0].id);

  const afficherSelecteurClasse = classesAutoriseesSeances.length > 1;

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">📌 Séances</div>
    <div class="sous-titre-page">Parcourez les séances d'une matière, filtrez-les, et épinglez celles que vous voulez retrouver rapidement.</div>

    <div class="barre-filtres-seances">
      ${afficherSelecteurClasse ? `
        <select id="selectClasseSea">
          ${classesAutoriseesSeances.map(c => `<option value="${c.id}" ${String(c.id) === filtresSeances.classeId ? 'selected' : ''}>${echapperSea(c.nom)}</option>`).join('')}
        </select>` : ''}
      <select id="selectChampSea"><option value="">Choisir une matière…</option></select>
      <button type="button" class="btn btn-discret" id="btnStructureSea" style="display:none">🗂️ Structure</button>
      <input type="search" id="rechercheSea" placeholder="Rechercher un titre…" value="${echapperSea(filtresSeances.recherche)}">
      ${roleSeances === 'admin' ? `
        <select id="selectStatutSea">
          <option value="">Tous les statuts</option>
          <option value="brouillon" ${filtresSeances.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
          <option value="publie" ${filtresSeances.statut === 'publie' ? 'selected' : ''}>Publié</option>
          <option value="archive" ${filtresSeances.statut === 'archive' ? 'selected' : ''}>Archivé</option>
        </select>` : ''}
      <select id="selectTriSea">
        <option value="hierarchique" ${filtresSeances.tri === 'hierarchique' ? 'selected' : ''}>Ordre du parcours</option>
        <option value="alphabetique" ${filtresSeances.tri === 'alphabetique' ? 'selected' : ''}>Ordre alphabétique</option>
        <option value="recent" ${filtresSeances.tri === 'recent' ? 'selected' : ''}>Plus récentes</option>
      </select>
      <label class="case-epingles-sea">
        <input type="checkbox" id="checkEpinglesSea" ${filtresSeances.epinglesSeulement ? 'checked' : ''}>
        📌 Mes épinglées seulement
      </label>
    </div>

    <div id="panneauStructureSea" class="panneau-structure-champ" style="display:none;margin-bottom:14px"></div>

    <div id="zoneListeSea" class="chargement">Choisissez une matière pour voir ses séances.</div>
  `;

  if (afficherSelecteurClasse) {
    document.getElementById('selectClasseSea').addEventListener('change', async (e) => {
      filtresSeances.classeId = e.target.value;
      filtresSeances.champId = '';
      await chargerChampsPourClasse();
      synchroniserUrlSeances();
      rafraichirListeSea();
    });
  }
  document.getElementById('rechercheSea').addEventListener('input', (e) => { filtresSeances.recherche = e.target.value; rafraichirListeSea(); });
  document.getElementById('selectTriSea').addEventListener('change', (e) => { filtresSeances.tri = e.target.value; rafraichirListeSea(); });
  document.getElementById('checkEpinglesSea').addEventListener('change', (e) => { filtresSeances.epinglesSeulement = e.target.checked; rafraichirListeSea(); });
  const selectStatut = document.getElementById('selectStatutSea');
  if (selectStatut) selectStatut.addEventListener('change', (e) => { filtresSeances.statut = e.target.value; rafraichirListeSea(); });

  // Structure de la matière choisie : chargée à la demande (voir
  // construireHtmlStructureSea), mise en cache dans le panneau tant que la
  // matière ne change pas (mettreAJourBoutonStructureSea invalide le cache).
  document.getElementById('btnStructureSea').addEventListener('click', async () => {
    const panneau = document.getElementById('panneauStructureSea');
    if (!panneau) return;
    const ouvert = panneau.style.display !== 'none';
    if (ouvert) { panneau.style.display = 'none'; return; }
    panneau.style.display = 'block';
    if (panneau.dataset.charge === '1') return;
    panneau.innerHTML = '<p class="chargement" style="margin:8px 0 0">Chargement de la structure...</p>';
    panneau.innerHTML = await construireHtmlStructureSea(filtresSeances.classeId, filtresSeances.champId);
    panneau.dataset.charge = '1';
  });

  chargerChampsPourClasse().then(() => { synchroniserUrlSeances(); rafraichirListeSea(); });
}

// Affiche/masque le bouton "Structure" selon qu'une matière est sélectionnée,
// et invalide le panneau (et son cache) dès que la matière change — sinon on
// risquerait d'afficher la structure de l'ancienne matière après un
// changement de sélection.
function mettreAJourBoutonStructureSea() {
  const bouton = document.getElementById('btnStructureSea');
  const panneau = document.getElementById('panneauStructureSea');
  if (!bouton || !panneau) return;
  bouton.style.display = filtresSeances.champId ? 'inline-flex' : 'none';
  if (panneau.dataset.champId !== filtresSeances.champId) {
    panneau.style.display = 'none';
    panneau.innerHTML = '';
    delete panneau.dataset.charge;
    panneau.dataset.champId = filtresSeances.champId || '';
  }
}

// Structure complète d'une matière (Thème/Unité/Semaine/Dossier/... puis SA)
// sous forme de liste indentée — même principe que
// construireHtmlStructureChamp() dans js/pages/navigation.js, dupliqué ici
// (pas de module partagé entre les deux pages) car les deux vivent dans des
// contextes différents (etat.classe.id côté navigation, filtresSeances côté
// ici).
async function construireHtmlStructureSea(classeId, champId) {
  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, ordre, titre, type_noeud')
    .eq('classe_id', classeId).eq('champ_formation_id', champId).order('ordre');
  const idsNoeuds = (noeuds || []).map(n => n.id);
  const { data: sasBrut } = idsNoeuds.length
    ? await supabaseClient.from('sa').select('id, noeud_id, ordre, titre, numero').in('noeud_id', idsNoeuds).order('ordre')
    : { data: [] };

  if (!noeuds || !noeuds.length) {
    return '<p class="chargement" style="margin:8px 0 0">Rien à afficher pour l\'instant — cette matière est vide.</p>';
  }

  const enfantsParParent = {};
  noeuds.forEach(n => { const cle = n.parent_id ?? 'racine'; (enfantsParParent[cle] ??= []).push(n); });
  const saParNoeud = {};
  (sasBrut || []).forEach(s => { (saParNoeud[s.noeud_id] ??= []).push(s); });
  const ETIQUETTES_TYPE_SEA = { theme: 'Thème', unite: 'Unité', semaine: 'Semaine', dossier: 'Dossier', discipline: 'Discipline' };

  function rendreNiveau(n, profondeur) {
    const enfants = enfantsParParent[n.id] || [];
    const sas = saParNoeud[n.id] || [];
    return `<div class="ligne-structure-champ" style="padding-left:${profondeur * 16}px">📁 ${echapperSea(n.titre)} <span class="type-arbo">${ETIQUETTES_TYPE_SEA[n.type_noeud] || n.type_noeud}</span></div>` +
      sas.map(s => `<div class="ligne-structure-champ" style="padding-left:${(profondeur + 1) * 16}px">📄 ${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapperSea(s.titre)}</div>`).join('') +
      enfants.map(e => rendreNiveau(e, profondeur + 1)).join('');
  }

  const racines = enfantsParParent['racine'] || [];
  return `<div class="structure-champ-liste">${racines.map(r => rendreNiveau(r, 0)).join('')}</div>`;
}

async function chargerChampsPourClasse() {
  const { data } = await supabaseClient.from('classes_champs_formation')
    .select('champs_formation(id, nom, code)').eq('classe_id', filtresSeances.classeId);
  champsAutorisesSeances = (data || []).map(d => d.champs_formation).filter(Boolean).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const select = document.getElementById('selectChampSea');
  if (!select) return;
  // Un champId venu de l'URL (ou laissé d'une classe précédente) qui
  // n'appartient pas à cette classe est ignoré plutôt que de laisser le
  // sélecteur dans un état incohérent.
  if (filtresSeances.champId && !champsAutorisesSeances.some(c => String(c.id) === filtresSeances.champId)) {
    filtresSeances.champId = '';
  }
  if (!filtresSeances.champId && champsAutorisesSeances.length === 1) filtresSeances.champId = String(champsAutorisesSeances[0].id);
  select.innerHTML = '<option value="">Choisir une matière…</option>' +
    champsAutorisesSeances.map(c => `<option value="${c.id}" ${String(c.id) === filtresSeances.champId ? 'selected' : ''}>${echapperSea(c.nom)}</option>`).join('');
  select.addEventListener('change', (e) => {
    filtresSeances.champId = e.target.value;
    mettreAJourBoutonStructureSea();
    synchroniserUrlSeances();
    rafraichirListeSea();
  });
  mettreAJourBoutonStructureSea();
}

// --- Chargement + tri hiérarchique de la liste de séances ---------------

// Chemin d'"ordre" complet d'un noeud (ex: [0, 2] pour "Thème 1 > Unité 3")
// en remontant sa chaîne de parent_id — sert à trier les séances dans le
// même ordre que leur structure réelle, quel que soit le nombre de niveaux
// (voir la demande explicite : "Thème 1 avant Thème 2", etc.).
function cheminOrdreNoeudSea(noeudId, noeudParId, garde) {
  garde = garde || 0;
  const n = noeudParId.get(noeudId);
  if (!n || garde > 30) return [];
  const chemin = n.parent_id ? cheminOrdreNoeudSea(n.parent_id, noeudParId, garde + 1) : [];
  return [...chemin, n.ordre ?? 0];
}
function cheminTitresNoeudSea(noeudId, noeudParId, garde) {
  garde = garde || 0;
  const n = noeudParId.get(noeudId);
  if (!n || garde > 30) return [];
  const chemin = n.parent_id ? cheminTitresNoeudSea(n.parent_id, noeudParId, garde + 1) : [];
  return [...chemin, n.titre];
}
function comparerCheminsSea(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? -1, y = b[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

async function rafraichirListeSea() {
  const zone = document.getElementById('zoneListeSea');
  if (!zone) return;
  if (!filtresSeances.champId) { zone.innerHTML = '<p class="chargement">Choisissez une matière pour voir ses séances.</p>'; return; }
  zone.innerHTML = '<p class="chargement">Chargement...</p>';

  const [{ data: noeuds }, ] = await Promise.all([
    supabaseClient.from('noeuds_parcours').select('id, parent_id, ordre, titre')
      .eq('classe_id', filtresSeances.classeId).eq('champ_formation_id', filtresSeances.champId)
  ]);
  const noeudParId = new Map((noeuds || []).map(n => [n.id, n]));
  const idsNoeuds = (noeuds || []).map(n => n.id);

  const { data: sasBrut } = idsNoeuds.length
    ? await supabaseClient.from('sa').select('id, noeud_id, ordre, titre, numero').in('noeud_id', idsNoeuds)
    : { data: [] };
  const saParId = new Map((sasBrut || []).map(s => [s.id, s]));
  const idsSA = (sasBrut || []).map(s => s.id);

  let requeteSeances = idsSA.length
    ? supabaseClient.from('seances').select('id, sa_id, titre, statut, discipline, titre_contenu, ordre, modifie_le').in('sa_id', idsSA)
    : null;
  // Seul l'admin peut choisir de voir brouillons/archives — tous les autres
  // rôles (y compris l'enseignant, qui les verrait de toute façon via les
  // règles d'accès de la base) restent sur les séances publiées, seules
  // garanties gratuites et accessibles à tous.
  if (requeteSeances && roleSeances !== 'admin') requeteSeances = requeteSeances.eq('statut', 'publie');
  else if (requeteSeances && filtresSeances.statut) requeteSeances = requeteSeances.eq('statut', filtresSeances.statut);

  const { data: seancesBrut } = requeteSeances ? await requeteSeances : { data: [] };

  let liste = (seancesBrut || []).map(s => {
    const sa = saParId.get(s.sa_id) || null;
    const cheminTitres = sa ? [...cheminTitresNoeudSea(sa.noeud_id, noeudParId), `${sa.numero ? 'SA' + sa.numero + ' — ' : ''}${sa.titre}`] : [];
    const cheminOrdre = sa ? [...cheminOrdreNoeudSea(sa.noeud_id, noeudParId), sa.ordre ?? 0, s.ordre ?? 0] : [s.ordre ?? 0];
    return { ...s, cheminTitres, cheminOrdre, epinglee: seancesEpingleesIds.has(s.id) };
  });

  const recherche = filtresSeances.recherche.trim().toLowerCase();
  if (recherche) liste = liste.filter(s => (s.titre || '').toLowerCase().includes(recherche));
  if (filtresSeances.epinglesSeulement) liste = liste.filter(s => s.epinglee);

  if (filtresSeances.tri === 'alphabetique') liste.sort((a, b) => (a.titre || '').localeCompare(b.titre || '', 'fr'));
  else if (filtresSeances.tri === 'recent') liste.sort((a, b) => new Date(b.modifie_le) - new Date(a.modifie_le));
  else liste.sort((a, b) => comparerCheminsSea(a.cheminOrdre, b.cheminOrdre));

  listeAffichee = liste;
  rendreListeSea(liste);
}

function rendreListeSea(liste) {
  const zone = document.getElementById('zoneListeSea');
  if (!liste.length) { zone.innerHTML = '<p class="chargement">Aucune séance ne correspond à ces critères.</p>'; return; }

  zone.innerHTML = `<div class="liste-lignes-seances">${liste.map(s => `
    <div class="ligne-seance-partagee">
      <div class="details-ligne-seance-partagee">
        <div class="titre-ligne-seance-partagee">
          <span class="texte-titre-seance-partagee">${echapperSea(s.titre)}</span>
          ${s.discipline ? `<span class="statut-pill" style="background:rgba(0,0,0,0.06)">${echapperSea(s.discipline)}</span>` : ''}
          ${s.titre_contenu ? `<span class="statut-pill" style="background:rgba(0,0,0,0.06)">🔖 ${echapperSea(s.titre_contenu)}</span>` : ''}
          ${roleSeances === 'admin' || roleSeances === 'autorite' ? `<span class="statut-pill statut-${s.statut}">${LIBELLES_STATUT_SEANCES[s.statut] || s.statut}</span>` : ''}
        </div>
        <div class="chemin-ligne-seance-partagee">${s.cheminTitres.map(t => echapperSea(t)).join(' › ')}</div>
      </div>
      <div class="actions-ligne-seance-partagee">
        <button type="button" class="bouton-epingler-sea ${s.epinglee ? 'epinglee' : ''}" data-epingler="${s.id}" title="${s.epinglee ? 'Retirer des épinglées' : 'Épingler cette séance'}">${s.epinglee ? '📌' : '📍'}</button>
        ${roleSeances === 'eleve' && s.statut === 'publie' ? `<a class="btn btn-primaire" href="eleve/seance.html?id=${s.id}">📖 Lire</a>` : ''}
        ${roleSeances === 'admin' ? `<a class="btn btn-discret" href="editeur-seance.html?id=${s.id}" title="Éditer le contenu">✏️ Éditer</a>` : ''}
      </div>
    </div>`).join('')}</div>`;

  zone.querySelectorAll('[data-epingler]').forEach(btn => {
    btn.addEventListener('click', () => basculerEpinglageSea(parseInt(btn.dataset.epingler, 10)));
  });
}

async function basculerEpinglageSea(seanceId) {
  const dejaEpinglee = seancesEpingleesIds.has(seanceId);
  if (dejaEpinglee) {
    const { error } = await supabaseClient.from('seances_epinglees').delete().eq('utilisateur_id', profilSeances.id).eq('seance_id', seanceId);
    if (error) return alert(error.message);
    seancesEpingleesIds.delete(seanceId);
  } else {
    const { error } = await supabaseClient.from('seances_epinglees').insert({ utilisateur_id: profilSeances.id, seance_id: seanceId });
    if (error) return alert(error.message);
    seancesEpingleesIds.add(seanceId);
  }
  listeAffichee.forEach(s => { if (s.id === seanceId) s.epinglee = !dejaEpinglee; });
  if (filtresSeances.epinglesSeulement) rafraichirListeSea();
  else rendreListeSea(listeAffichee);
}

function echapperSea(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
