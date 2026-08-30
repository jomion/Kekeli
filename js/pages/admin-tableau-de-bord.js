// Page pages/admin/tableau-de-bord.html
// Nouvelle page d'accueil de l'espace administrateur : vue d'ensemble des
// tâches à gérer, raccourcis vers les autres pages admin, et surtout une
// liste de toutes les séances groupées par matière, filtrable, avec un
// accès direct (un clic) à l'éditeur — sans repasser par tout le chemin
// Classes → Matière → Arborescence → SA de la page navigation.html.

let profilAdminTB = null;
let classesTB = [];
let champsTB = [];
let seancesTB = [];
let devoirsTB = [];
const filtresTB = { matiere: '', classe: '', statut: '', recherche: '', unite: '', semaine: '', dossier: '', sa: '' };

const LIBELLES_STATUT_TB = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

async function init() {
  profilAdminTB = await requireAdmin();
  if (!profilAdminTB) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminTB.id,
    badgeHtml: `${profilAdminTB.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperTB(profilAdminTB.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminTB.est_super_admin })
  });

  const [
    { data: classes }, { data: champs }, { data: noeuds }, { data: sa }, { data: seances },
    { data: enseignants }, { data: devoirs }
  ] = await Promise.all([
    supabaseClient.from('classes').select('id, nom, ordre').order('ordre'),
    supabaseClient.from('champs_formation').select('id, nom, code, actif').eq('actif', true).order('nom'),
    supabaseClient.from('noeuds_parcours').select('id, classe_id, champ_formation_id, parent_id, type_noeud, titre'),
    supabaseClient.from('sa').select('id, noeud_id, titre, numero'),
    supabaseClient.from('seances').select('id, sa_id, titre, statut, discipline, ordre, modifie_le').order('modifie_le', { ascending: false }),
    supabaseClient.from('enseignants').select('id'),
    supabaseClient.from('devoirs').select('id, titre, date_limite')
  ]);

  classesTB = classes || [];
  champsTB = champs || [];
  devoirsTB = devoirs || [];

  // Petites tables (quelques dizaines de lignes au total) : on résout les
  // rattachements côté client plutôt que d'imbriquer des jointures PostgREST
  // à 3 niveaux (séance → SA → noeud → classe/matière), ce qui reste rapide
  // et évite les soucis d'ambiguïté de clés étrangères multiples sur un même
  // noeud (classe_id ET champ_formation_id).
  const noeudParId = new Map((noeuds || []).map(n => [n.id, n]));
  const saParId = new Map((sa || []).map(s => [s.id, s]));
  const classeParId = new Map(classesTB.map(c => [c.id, c]));
  const champParId = new Map(champsTB.map(c => [c.id, c]));

  seancesTB = (seances || []).map(s => {
    const saInfo = saParId.get(s.sa_id) || null;
    const noeud = saInfo ? noeudParId.get(saInfo.noeud_id) : null;
    const chemin = saInfo ? remonterCheminHierarchiqueTB(saInfo.noeud_id, noeudParId) : { unite: null, semaine: null, dossier: null };
    // Chemin complet (Thème › Unité › ... › SA), même principe que la page
    // "Séances" partagée (pages/seances.html) — pour retrouver une séance
    // sans avoir à deviner sa place dans l'arborescence depuis cette liste.
    const cheminTitres = saInfo
      ? [...cheminTitresNoeudTB(saInfo.noeud_id, noeudParId), `${saInfo.numero ? 'SA' + saInfo.numero + ' — ' : ''}${saInfo.titre}`]
      : [];
    return {
      ...s,
      saInfo,
      classe: noeud ? classeParId.get(noeud.classe_id) || null : null,
      champ: noeud ? champParId.get(noeud.champ_formation_id) || null : null,
      unite: chemin.unite, semaine: chemin.semaine, dossier: chemin.dossier,
      cheminTitres
    };
  });

  afficherTaches(enseignants || [], devoirs || []);
  afficherActions();
  afficherFiltres();
  rendreSeances();
}

// Remonte la chaîne de parent_id d'un noeud (celui qui porte la SA d'une
// séance) pour retrouver ses ancêtres "Unité", "Semaine" et "Dossier", quel
// que soit le nombre de niveaux entre eux (ex: Thème > Unité > Semaine pour
// le français). Sert à filtrer/regrouper les séances sans avoir à connaître
// à l'avance la profondeur exacte de la hiérarchie de chaque matière.
// Chemin des titres d'un noeud en remontant sa chaîne de parent_id (ex:
// ["Thème 1", "Unité 3"]) — même logique que cheminTitresNoeudSea de
// js/pages/seances.js, dupliquée ici car les deux pages ne partagent pas de
// module commun.
function cheminTitresNoeudTB(noeudId, noeudParId, garde) {
  garde = garde || 0;
  const n = noeudParId.get(noeudId);
  if (!n || garde > 30) return [];
  const chemin = n.parent_id ? cheminTitresNoeudTB(n.parent_id, noeudParId, garde + 1) : [];
  return [...chemin, n.titre];
}

function remonterCheminHierarchiqueTB(noeudId, noeudParId) {
  const chemin = { unite: null, semaine: null, dossier: null };
  let n = noeudParId.get(noeudId);
  let garde = 0; // filet de sécurité si une chaîne de parent_id bouclait par erreur
  while (n && garde++ < 30) {
    if (n.type_noeud === 'unite' && !chemin.unite) chemin.unite = n;
    if (n.type_noeud === 'semaine' && !chemin.semaine) chemin.semaine = n;
    if (n.type_noeud === 'dossier' && !chemin.dossier) chemin.dossier = n;
    n = n.parent_id ? noeudParId.get(n.parent_id) : null;
  }
  return chemin;
}

function afficherTaches(enseignants, devoirs) {
  const brouillons = seancesTB.filter(s => s.statut === 'brouillon').length;
  const orphelines = seancesTB.filter(s => !s.champ || !s.classe).length;
  const maintenant = new Date();
  const devoirsAVenir = devoirs.filter(d => d.date_limite && new Date(d.date_limite) > maintenant).length;

  const taches = [
    { chiffre: brouillons, libelle: '📝 Séances en brouillon (à publier)', alerte: brouillons > 0 },
    { chiffre: seancesTB.length, libelle: '📚 Séances au total', alerte: false },
    { chiffre: enseignants.length, libelle: '🧑‍🏫 Enseignants actifs', alerte: false },
    { chiffre: devoirsAVenir, libelle: '📅 Devoirs à venir', alerte: false }
  ];
  if (orphelines > 0) {
    taches.push({ chiffre: orphelines, libelle: '⚠️ Séances sans matière/classe rattachée', alerte: true });
  }

  document.getElementById('zoneTaches').innerHTML = taches.map(t => `
    <div class="pastille-tache-admin ${t.alerte ? 'a-traiter' : ''}">
      <span class="chiffre-tache">${t.chiffre}</span>
      <span class="libelle-tache">${t.libelle}</span>
    </div>`).join('');
}

function afficherActions() {
  const estSuperAdmin = !!profilAdminTB.est_super_admin;
  const maintenantTB = new Date();
  const apercuDevoirsAdmin = devoirsTB
    .filter(d => d.date_limite && new Date(d.date_limite) > maintenantTB)
    .sort((a, b) => new Date(a.date_limite) - new Date(b.date_limite))
    .slice(0, 6)
    .map(d => `${d.titre} — ${new Date(d.date_limite).toLocaleDateString('fr-FR')}`);

  document.getElementById('zoneActions').innerHTML = [
    `<a href="../navigation.html" class="carte-action-tb disponible carte-apercu-hover">
      <div class="icone-action-tb">🌳</div>
      <h3>Arborescence complète</h3>
      <p>Créer de nouvelles classes, matières, unités, SA ou séances.</p>
      ${bulleApercuHtml('Classes', classesTB.map(c => c.nom))}
    </a>`,
    // Le suivi des devoirs et notes reste un outil du quotidien pour les
    // admins de terrain ; le super_admin, dont le rôle est plus transversal
    // (supervision, gestion des comptes admin), n'en a pas besoin ici.
    !estSuperAdmin ? `<a href="devoirs-notes.html" class="carte-action-tb disponible carte-apercu-hover">
      <div class="icone-action-tb">📊</div>
      <h3>Devoirs &amp; notes</h3>
      <p>Attribuer des devoirs et des notes par classe et par matière.</p>
      ${bulleApercuHtml('Devoirs à venir', apercuDevoirsAdmin)}
    </a>` : '',
    `<a href="messagerie.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">💬</div>
      <h3>Messagerie</h3>
      <p>Échanger avec les enseignants et les autres administrateurs.</p>
    </a>`,
    `<a href="paiements.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">💳</div>
      <h3>Paiements des frais</h3>
      <p>Enregistrer les règlements reçus (suivi manuel, par classe).</p>
    </a>`,
    `<a href="abonnements.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">💎</div>
      <h3>Abonnements &amp; services premium</h3>
      <p>Formules tarifaires, essais gratuits, souscriptions (correction IA, etc.).</p>
    </a>`,
    `<a href="badges.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🎯</div>
      <h3>Badges des élèves</h3>
      <p>Créer des badges et en attribuer manuellement aux élèves.</p>
    </a>`,
    `<a href="activites.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">📝</div>
      <h3>Activités à corriger</h3>
      <p>Corriger les activités rendues, filtrées par palier/classe/matière.</p>
    </a>`,
    `<a href="enseignants-classes.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🧑‍🏫</div>
      <h3>Enseignants &amp; classes</h3>
      <p>Valider les demandes d'accès à une classe faites par les enseignants.</p>
    </a>`,
    estSuperAdmin ? `<a href="gestion-administrateurs.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🛡️</div>
      <h3>Gestion des administrateurs</h3>
      <p>Ajouter un administrateur et définir ses droits d'édition.</p>
    </a>` : '',
    estSuperAdmin ? `<a href="roles.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🎛️</div>
      <h3>Rôles administrateurs</h3>
      <p>Créer des rôles personnalisés (ex. Correcteur d'activités) et les assigner.</p>
    </a>` : ''
  ].filter(Boolean).join('');
}

function afficherFiltres() {
  document.getElementById('zoneFiltres').innerHTML = `
    <input type="search" id="rechercheSeanceTB" placeholder="🔎 Rechercher une séance par titre...">
    <select id="filtreMatiereTB">
      <option value="">Toutes les matières</option>
      ${champsTB.map(c => `<option value="${c.id}">${echapperTB(c.nom)}</option>`).join('')}
    </select>
    <select id="filtreClasseTB">
      <option value="">Toutes les classes</option>
      ${classesTB.map(c => `<option value="${c.id}">${echapperTB(c.nom)}</option>`).join('')}
    </select>
    <select id="filtreStatutTB">
      <option value="">Tous les statuts</option>
      <option value="brouillon">Brouillon</option>
      <option value="publie">Publié</option>
      <option value="archive">Archivé</option>
    </select>
    <span id="zoneFiltresHierarchiquesTB" style="display:contents"></span>
  `;
  document.getElementById('rechercheSeanceTB').addEventListener('input', (e) => {
    filtresTB.recherche = e.target.value.trim().toLowerCase();
    rendreSeances();
  });
  document.getElementById('filtreMatiereTB').addEventListener('change', (e) => {
    filtresTB.matiere = e.target.value;
    filtresTB.unite = ''; filtresTB.semaine = ''; filtresTB.dossier = ''; filtresTB.sa = '';
    afficherFiltresHierarchiques();
    rendreSeances();
  });
  document.getElementById('filtreClasseTB').addEventListener('change', (e) => {
    filtresTB.classe = e.target.value;
    filtresTB.unite = ''; filtresTB.semaine = ''; filtresTB.dossier = ''; filtresTB.sa = '';
    afficherFiltresHierarchiques();
    rendreSeances();
  });
  document.getElementById('filtreStatutTB').addEventListener('change', (e) => {
    filtresTB.statut = e.target.value;
    rendreSeances();
  });

  afficherFiltresHierarchiques();
}

// Filtres secondaires calculés automatiquement à partir du contenu réel du
// parcours (pas de valeurs codées en dur) : Unité + Semaine pour le français,
// Dossier pour les mathématiques, ou juste la SA pour les autres matières
// (structure à un seul niveau) — pour retrouver une séance à éditer sans
// avoir à redescendre toute l'arborescence depuis "navigation.html".
function afficherFiltresHierarchiques() {
  const zone = document.getElementById('zoneFiltresHierarchiquesTB');
  if (!filtresTB.matiere) { zone.innerHTML = ''; return; }

  const champSelectionne = champsTB.find(c => String(c.id) === filtresTB.matiere);
  // Séances de la matière choisie (et de la classe choisie, si renseignée) —
  // sert uniquement à calculer les options disponibles dans les filtres.
  const seancesPourOptions = seancesTB.filter(s =>
    String(s.champ?.id ?? '') === filtresTB.matiere &&
    (!filtresTB.classe || String(s.classe?.id ?? '') === filtresTB.classe)
  );

  const optionsUniques = (liste, cle) => {
    const vues = new Map();
    liste.forEach(s => { const n = s[cle]; if (n && !vues.has(n.id)) vues.set(n.id, n); });
    return [...vues.values()].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  };
  const optionsSA = (liste) => {
    const vues = new Map();
    liste.forEach(s => { const sa = s.saInfo; if (sa && !vues.has(sa.id)) vues.set(sa.id, sa); });
    return [...vues.values()].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0) || a.titre.localeCompare(b.titre, 'fr'));
  };
  const libelleSA = (sa) => `${sa.numero ? 'SA' + sa.numero + ' — ' : ''}${sa.titre}`;

  let html = '';

  if (champSelectionne?.code === 'francais') {
    const unites = optionsUniques(seancesPourOptions, 'unite');
    const seancesApresUnite = filtresTB.unite ? seancesPourOptions.filter(s => String(s.unite?.id ?? '') === filtresTB.unite) : seancesPourOptions;
    const semaines = optionsUniques(seancesApresUnite, 'semaine');
    const seancesApresSemaine = filtresTB.semaine ? seancesApresUnite.filter(s => String(s.semaine?.id ?? '') === filtresTB.semaine) : seancesApresUnite;
    const sasDispo = optionsSA(seancesApresSemaine);

    html = `
      <select id="filtreUniteTB"><option value="">Toutes les unités</option>${unites.map(n => `<option value="${n.id}" ${filtresTB.unite === String(n.id) ? 'selected' : ''}>${echapperTB(n.titre)}</option>`).join('')}</select>
      <select id="filtreSemaineTB"><option value="">Toutes les semaines</option>${semaines.map(n => `<option value="${n.id}" ${filtresTB.semaine === String(n.id) ? 'selected' : ''}>${echapperTB(n.titre)}</option>`).join('')}</select>
      <select id="filtreSaTB"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresTB.sa === String(sa.id) ? 'selected' : ''}>${echapperTB(libelleSA(sa))}</option>`).join('')}</select>`;
  } else if (champSelectionne?.code === 'mathematique') {
    const dossiers = optionsUniques(seancesPourOptions, 'dossier');
    const seancesApresDossier = filtresTB.dossier ? seancesPourOptions.filter(s => String(s.dossier?.id ?? '') === filtresTB.dossier) : seancesPourOptions;
    const sasDispo = optionsSA(seancesApresDossier);

    html = `
      <select id="filtreDossierTB"><option value="">Tous les dossiers</option>${dossiers.map(n => `<option value="${n.id}" ${filtresTB.dossier === String(n.id) ? 'selected' : ''}>${echapperTB(n.titre)}</option>`).join('')}</select>
      <select id="filtreSaTB"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresTB.sa === String(sa.id) ? 'selected' : ''}>${echapperTB(libelleSA(sa))}</option>`).join('')}</select>`;
  } else {
    const sasDispo = optionsSA(seancesPourOptions);
    html = `<select id="filtreSaTB"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresTB.sa === String(sa.id) ? 'selected' : ''}>${echapperTB(libelleSA(sa))}</option>`).join('')}</select>`;
  }

  zone.innerHTML = html;

  const filtreUnite = document.getElementById('filtreUniteTB');
  if (filtreUnite) filtreUnite.addEventListener('change', (e) => {
    filtresTB.unite = e.target.value; filtresTB.semaine = ''; filtresTB.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreSemaine = document.getElementById('filtreSemaineTB');
  if (filtreSemaine) filtreSemaine.addEventListener('change', (e) => {
    filtresTB.semaine = e.target.value; filtresTB.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreDossier = document.getElementById('filtreDossierTB');
  if (filtreDossier) filtreDossier.addEventListener('change', (e) => {
    filtresTB.dossier = e.target.value; filtresTB.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreSA = document.getElementById('filtreSaTB');
  if (filtreSA) filtreSA.addEventListener('change', (e) => {
    filtresTB.sa = e.target.value;
    rendreSeances();
  });
}

function rendreSeances() {
  const zone = document.getElementById('zoneSeances');
  const filtrees = seancesTB.filter(s => {
    if (filtresTB.matiere && String(s.champ?.id ?? '') !== filtresTB.matiere) return false;
    if (filtresTB.classe && String(s.classe?.id ?? '') !== filtresTB.classe) return false;
    if (filtresTB.statut && s.statut !== filtresTB.statut) return false;
    if (filtresTB.recherche && !(s.titre || '').toLowerCase().includes(filtresTB.recherche)) return false;
    if (filtresTB.unite && String(s.unite?.id ?? '') !== filtresTB.unite) return false;
    if (filtresTB.semaine && String(s.semaine?.id ?? '') !== filtresTB.semaine) return false;
    if (filtresTB.dossier && String(s.dossier?.id ?? '') !== filtresTB.dossier) return false;
    if (filtresTB.sa && String(s.sa_id ?? '') !== filtresTB.sa) return false;
    return true;
  });

  if (!filtrees.length) {
    zone.innerHTML = `<p style="color:var(--texte-gris)">Aucune séance ne correspond à ces critères.</p>`;
    return;
  }

  const parMatiere = new Map();
  filtrees.forEach(s => {
    const cle = s.champ ? s.champ.nom : '— Sans matière rattachée —';
    if (!parMatiere.has(cle)) parMatiere.set(cle, []);
    parMatiere.get(cle).push(s);
  });
  const matieresTriees = [...parMatiere.keys()].sort((a, b) => a.localeCompare(b, 'fr'));

  zone.innerHTML = matieresTriees.map(nomMatiere => {
    const liste = parMatiere.get(nomMatiere).sort((a, b) => new Date(b.modifie_le) - new Date(a.modifie_le));
    return `
      <div class="groupe-matiere-admin">
        <div class="titre-groupe-matiere">${echapperTB(nomMatiere)} (${liste.length})</div>
        <div class="liste-lignes">${liste.map(ligneSeanceHtmlTB).join('')}</div>
      </div>`;
  }).join('');

  zone.querySelectorAll('[data-publier-seance]').forEach(btn => {
    btn.addEventListener('click', () => changerStatutSeanceTB(
      parseInt(btn.dataset.publierSeance, 10), 'publie',
      'Publier cette séance ? Elle deviendra visible pour les élèves concernés.'
    ));
  });
  zone.querySelectorAll('[data-archiver-seance]').forEach(btn => {
    btn.addEventListener('click', () => changerStatutSeanceTB(
      parseInt(btn.dataset.archiverSeance, 10), 'archive',
      'Archiver cette séance ? Elle ne sera plus visible pour les élèves.'
    ));
  });
}

function ligneSeanceHtmlTB(s) {
  const meta = [
    s.discipline || null,
    `Modifiée le ${formaterDateTB(s.modifie_le)}`
  ].filter(Boolean).join(' · ');
  const chemin = (s.cheminTitres || []).map(t => echapperTB(t)).join(' › ');

  return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperTB(s.titre)}${s.classe ? ` <span class="badge-classe-admin">${echapperTB(s.classe.nom)}</span>` : ''}</span>
        ${chemin ? `<span class="chemin-ligne-seance-partagee">${chemin}</span>` : ''}
        <span class="meta-seance-admin">${meta}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="statut-pill statut-${s.statut}">${LIBELLES_STATUT_TB[s.statut] || s.statut}</span>
        ${s.statut === 'brouillon' ? `<button type="button" class="btn btn-discret" data-publier-seance="${s.id}">📤 Publier</button>` : ''}
        ${s.statut === 'publie' ? `<button type="button" class="btn btn-discret" data-archiver-seance="${s.id}">🗄️ Archiver</button>` : ''}
        <a href="../editeur-seance.html?id=${s.id}" class="btn btn-primaire">✏️ Éditer</a>
      </div>
    </div>`;
}

async function changerStatutSeanceTB(id, nouveauStatut, message) {
  confirmerAction(message, async () => {
    const { data, error } = await supabaseClient.from('seances').update({ statut: nouveauStatut }).eq('id', id).select('id');
    if (error) return alert('Erreur : ' + error.message);
    if (!data || !data.length) {
      return alert("Cette modification n'a pas été appliquée — vous n'avez peut-être pas les droits d'édition sur cette classe/matière.");
    }
    const s = seancesTB.find(x => x.id === id);
    if (s) s.statut = nouveauStatut;
    rendreSeances();
  });
}

function formaterDateTB(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function echapperTB(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
