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
const filtresTB = { matiere: '', classe: '', statut: '', recherche: '' };

const LIBELLES_STATUT_TB = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

async function init() {
  profilAdminTB = await requireAdmin();
  if (!profilAdminTB) return;

  document.getElementById('zoneDroite').innerHTML = `
    <div id="zoneCloche"></div>
    <span class="badge-utilisateur">${profilAdminTB.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperTB(profilAdminTB.prenom)}</span>
    <button class="btn btn-discret" id="btnDeconnexionTB">Déconnexion</button>
  `;
  document.getElementById('btnDeconnexionTB').addEventListener('click', deconnecterAdmin);
  initClocheNotifications('zoneCloche', profilAdminTB.id);

  const [
    { data: classes }, { data: champs }, { data: noeuds }, { data: sa }, { data: seances },
    { data: enseignants }, { data: devoirs }
  ] = await Promise.all([
    supabaseClient.from('classes').select('id, nom, ordre').order('ordre'),
    supabaseClient.from('champs_formation').select('id, nom, code, actif').eq('actif', true).order('nom'),
    supabaseClient.from('noeuds_parcours').select('id, classe_id, champ_formation_id'),
    supabaseClient.from('sa').select('id, noeud_id, titre, numero'),
    supabaseClient.from('seances').select('id, sa_id, titre, statut, discipline, ordre, modifie_le').order('modifie_le', { ascending: false }),
    supabaseClient.from('enseignants').select('id'),
    supabaseClient.from('devoirs').select('id, date_limite')
  ]);

  classesTB = classes || [];
  champsTB = champs || [];

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
    return {
      ...s,
      saInfo,
      classe: noeud ? classeParId.get(noeud.classe_id) || null : null,
      champ: noeud ? champParId.get(noeud.champ_formation_id) || null : null
    };
  });

  afficherTaches(enseignants || [], devoirs || []);
  afficherActions();
  afficherFiltres();
  rendreSeances();
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

  document.getElementById('zoneActions').innerHTML = [
    `<a href="../navigation.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🌳</div>
      <h3>Arborescence complète</h3>
      <p>Créer de nouvelles classes, matières, unités, SA ou séances.</p>
    </a>`,
    // Le suivi des devoirs et notes reste un outil du quotidien pour les
    // admins de terrain ; le super_admin, dont le rôle est plus transversal
    // (supervision, gestion des comptes admin), n'en a pas besoin ici.
    !estSuperAdmin ? `<a href="devoirs-notes.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">📊</div>
      <h3>Devoirs &amp; notes</h3>
      <p>Attribuer des devoirs et des notes par classe et par matière.</p>
    </a>` : '',
    `<a href="messagerie.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">💬</div>
      <h3>Messagerie</h3>
      <p>Échanger avec les enseignants et les autres administrateurs.</p>
    </a>`,
    estSuperAdmin ? `<a href="gestion-administrateurs.html" class="carte-action-tb disponible">
      <div class="icone-action-tb">🛡️</div>
      <h3>Gestion des administrateurs</h3>
      <p>Ajouter un administrateur et définir ses droits d'édition.</p>
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
  `;
  document.getElementById('rechercheSeanceTB').addEventListener('input', (e) => {
    filtresTB.recherche = e.target.value.trim().toLowerCase();
    rendreSeances();
  });
  document.getElementById('filtreMatiereTB').addEventListener('change', (e) => {
    filtresTB.matiere = e.target.value;
    rendreSeances();
  });
  document.getElementById('filtreClasseTB').addEventListener('change', (e) => {
    filtresTB.classe = e.target.value;
    rendreSeances();
  });
  document.getElementById('filtreStatutTB').addEventListener('change', (e) => {
    filtresTB.statut = e.target.value;
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
    s.saInfo ? `${s.saInfo.numero ? 'SA' + s.saInfo.numero + ' — ' : ''}${echapperTB(s.saInfo.titre)}` : null,
    s.discipline || null,
    `Modifiée le ${formaterDateTB(s.modifie_le)}`
  ].filter(Boolean).join(' · ');

  return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperTB(s.titre)}${s.classe ? ` <span class="badge-classe-admin">${echapperTB(s.classe.nom)}</span>` : ''}</span>
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
