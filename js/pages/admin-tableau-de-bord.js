// Page pages/admin/tableau-de-bord.html
// Page d'accueil de l'espace administrateur : uniquement une vue d'ensemble
// des tâches à surveiller et des raccourcis (avec aperçu au survol) vers les
// autres pages admin. La recherche/filtre/liste complète des séances, qui
// vivait ici auparavant, a sa propre page dédiée : pages/admin/gestion-seances.html
// (js/pages/admin-gestion-seances.js) — accessible via le raccourci
// "Gestion des séances" ci-dessous et via le menu "📚 Pédagogie".

let profilAdminTB = null;
let classesTB = [];
let champsTB = [];
let seancesTB = [];
let devoirsTB = [];

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
    supabaseClient.from('seances').select('id, sa_id, titre, statut, discipline, titre_contenu, ordre, modifie_le').order('modifie_le', { ascending: false }),
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
  // noeud (classe_id ET champ_formation_id). Seuls classe/champ sont encore
  // nécessaires ici (pour compter les séances orphelines) — le chemin complet
  // (Unité/Semaine/Dossier/SA) ne sert plus que dans gestion-seances.html.
  const noeudParId = new Map((noeuds || []).map(n => [n.id, n]));
  const saParId = new Map((sa || []).map(s => [s.id, s]));
  const classeParId = new Map(classesTB.map(c => [c.id, c]));
  const champParId = new Map(champsTB.map(c => [c.id, c]));

  seancesTB = (seances || []).map(s => {
    const saInfo = saParId.get(s.sa_id) || null;
    const noeud = saInfo ? noeudParId.get(saInfo.noeud_id) : null;
    return {
      ...s,
      classe: noeud ? classeParId.get(noeud.classe_id) || null : null,
      champ: noeud ? champParId.get(noeud.champ_formation_id) || null : null
    };
  });

  afficherTaches(enseignants || [], devoirs || []);
  afficherActions();
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
    `<a href="gestion-seances.html" class="carte-action-tb disponible carte-apercu-hover">
      <div class="icone-action-tb">✏️</div>
      <h3>Gestion des séances</h3>
      <p>Rechercher, filtrer et éditer directement les séances de chaque matière.</p>
      ${bulleApercuHtml('Matières', champsTB.map(c => c.nom))}
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

function echapperTB(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
