// Page pages/admin/gestion-tous-les-comptes.html
// 19 septembre 2026 — réservée au COMPTE RACINE (voir administrateurs.est_racine
// et est_racine() en base) : liste tous les comptes du site, tous rôles
// confondus (admin, super_admin, enseignant, parent, élève, autorité
// pédagogique), et permet de les modifier, désactiver/réactiver ou supprimer
// définitivement. Différente de "Gestion des administrateurs" (réservée au
// super_admin, qui ne fait que CRÉER des comptes admin) : ici on gère
// N'IMPORTE QUEL compte déjà existant — un outil plus puissant, donc encore
// plus restreint.
//
// Toutes les actions réelles passent par la fonction Supabase
// "gerer-tous-les-comptes" (clé service role, jamais exposée au navigateur) :
// le blocage ici (redirection si pas compte racine) n'est qu'un confort
// d'affichage — la fonction revérifie tout, y compris l'intouchabilité totale
// du compte racine, de son côté.

let profilTC = null;
let comptesTC = [];

const LIBELLE_ROLE_TC = {
  super_admin: '👑 Super admin',
  admin: '🛠️ Admin',
  enseignant: '🧑‍🏫 Enseignant',
  parent: '👪 Parent',
  eleve: '🎓 Élève',
  autorite_pedagogique: '🏛️ Autorité pédagogique'
};

const ORDRE_ROLES_TC = ['super_admin', 'admin', 'enseignant', 'parent', 'eleve', 'autorite_pedagogique'];

function echapperTC(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formaterDateTC(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch (_e) { return ''; }
}

async function init() {
  profilTC = await requireAdmin();
  if (!profilTC) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilTC.id,
    badgeHtml: `${profilTC.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperTC(profilTC.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilTC.est_super_admin })
  });

  // Gate d'affichage seulement — voir en-tête du fichier. On vérifie ici via
  // administrateurs.est_racine (lisible pour son propre compte grâce à la
  // policy RLS "admin_lecture_soi") plutôt que via un rôle : seul le compte
  // racine (kekelieduc@gmail.com) doit voir cette page, pas tous les
  // super_admin.
  const { data: adminSoi } = await supabaseClient.from('administrateurs').select('est_racine').eq('id', profilTC.id).maybeSingle();
  if (!adminSoi?.est_racine) {
    afficherAccesRefuseTC();
    return;
  }

  await chargerComptesTC();
}

function afficherAccesRefuseTC() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">Gestion de tous les comptes</div>
    <p class="message-erreur">⛔ Cette page est réservée au compte racine.</p>
    <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
}

async function chargerComptesTC() {
  document.getElementById('contenu').innerHTML = `<div class="titre-page">Gestion de tous les comptes</div><div class="chargement">Chargement...</div>`;

  const { data, error } = await supabaseClient.functions.invoke('gerer-tous-les-comptes', { body: { action: 'lister' } });
  const corpsErreur = error ? await lireErreurTC(error) : null;

  // La fonction revérifie elle-même que l'appelant est le compte racine —
  // un 403 ici (ou data.error) veut dire que le contrôle côté page ci-dessus
  // s'est trompé (ou a été contourné) : on retombe alors sur le même message.
  if (error || data?.error) {
    if (error?.context?.status === 403) { afficherAccesRefuseTC(); return; }
    document.getElementById('contenu').innerHTML = `
      <div class="titre-page">Gestion de tous les comptes</div>
      <p class="message-erreur">${echapperTC(corpsErreur || data?.error || 'Une erreur est survenue.')}</p>`;
    return;
  }

  comptesTC = data.comptes || [];
  afficherPageTC();
}

async function lireErreurTC(error) {
  try {
    const corps = await error.context?.json?.();
    return corps?.error || error.message;
  } catch (_e) { return error.message; }
}

function afficherPageTC() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">Gestion de tous les comptes</div>
    <div class="sous-titre-page">Réservé au compte racine : consultez, modifiez, désactivez/réactivez ou supprimez n'importe quel compte du site.</div>
    <div id="banniereTC"></div>
    ${ORDRE_ROLES_TC.map(role => rendreSectionRoleTC(role)).join('')}
  `;
  cablerActionsTC();
}

function rendreSectionRoleTC(role) {
  const comptes = comptesTC.filter(c => c.role === role)
    .sort((x, y) => (x.prenom || '').localeCompare(y.prenom || '', 'fr'));
  return `
    <div class="section-title-eleve" style="margin-top:22px">${LIBELLE_ROLE_TC[role] || role} (${comptes.length})</div>
    <div class="liste-lignes">
      ${comptes.length ? comptes.map(c => rendreLigneCompteTC(c)).join('') : `<p style="color:var(--texte-gris)">Aucun compte.</p>`}
    </div>`;
}

function rendreLigneCompteTC(c) {
  const identite = c.role === 'eleve' ? (c.identifiant || '(sans identifiant)') : (c.email || '');
  const actions = c.estRacine
    ? `<span class="statut-pill statut-publie">🔒 Compte racine</span>`
    : `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-discret" data-modifier-compte="${c.id}" style="padding:6px 12px;font-size:12px">✏️ Modifier</button>
        ${c.actif
          ? `<button class="btn btn-discret" data-desactiver-compte="${c.id}" style="padding:6px 12px;font-size:12px">🚫 Désactiver</button>`
          : `<button class="btn btn-accent" data-reactiver-compte="${c.id}" style="padding:6px 12px;font-size:12px">✅ Réactiver</button>`}
        <button class="btn btn-danger" data-supprimer-compte="${c.id}" style="padding:6px 12px;font-size:12px">🗑️ Supprimer définitivement</button>
      </div>`;
  return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperTC(c.prenom)} ${echapperTC(c.nom)}
          <span class="statut-pill ${c.actif ? 'statut-publie' : 'statut-archive'}">${c.actif ? 'Actif' : 'Désactivé'}</span>
        </span>
        <span class="meta-seance-admin">${echapperTC(identite)} — créé le ${formaterDateTC(c.creeLe)}</span>
      </div>
      ${actions}
    </div>`;
}

function cablerActionsTC() {
  document.querySelectorAll('[data-modifier-compte]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirModifierCompteTC(comptesTC.find(c => c.id === btn.dataset.modifierCompte)));
  });
  document.querySelectorAll('[data-desactiver-compte]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = comptesTC.find(x => x.id === btn.dataset.desactiverCompte);
      confirmerAction(
        `Désactiver le compte de ${c.prenom} ${c.nom} ? (réversible — vous pourrez le réactiver à tout moment, l'accès est simplement bloqué en attendant)`,
        () => appelerFonctionTC({ action: 'desactiver', cibleId: c.id }, `Compte de ${c.prenom} ${c.nom} désactivé.`)
      );
    });
  });
  document.querySelectorAll('[data-reactiver-compte]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = comptesTC.find(x => x.id === btn.dataset.reactiverCompte);
      confirmerAction(
        `Réactiver le compte de ${c.prenom} ${c.nom} ?`,
        () => appelerFonctionTC({ action: 'reactiver', cibleId: c.id }, `Compte de ${c.prenom} ${c.nom} réactivé.`)
      );
    });
  });
  document.querySelectorAll('[data-supprimer-compte]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = comptesTC.find(x => x.id === btn.dataset.supprimerCompte);
      confirmerAction(
        `Supprimer DÉFINITIVEMENT le compte de ${c.prenom} ${c.nom} ? Cette action est IRRÉVERSIBLE (le compte, son profil et toutes ses données associées seront effacés). Si vous voulez juste bloquer l'accès, utilisez plutôt « Désactiver ».`,
        () => appelerFonctionTC({ action: 'supprimer', cibleId: c.id }, `Compte de ${c.prenom} ${c.nom} supprimé définitivement.`)
      );
    });
  });
}

function ouvrirModifierCompteTC(c) {
  if (!c) return;
  const champs = [
    { nom: 'prenom', label: 'Prénom', valeur: c.prenom, requis: true },
    { nom: 'nom', label: 'Nom', valeur: c.nom, requis: true }
  ];
  if (c.role === 'eleve') {
    champs.push({ nom: 'identifiant', label: "Identifiant de connexion", valeur: c.identifiant || '', requis: true });
  } else {
    champs.push({ nom: 'email', label: 'E-mail', type: 'email', valeur: c.email || '', requis: true });
  }
  ouvrirModal({
    titre: `Modifier — ${c.prenom} ${c.nom}`,
    champs,
    texteValider: 'Enregistrer',
    onValider: (valeurs) => appelerFonctionTC({ action: 'modifier', cibleId: c.id, ...valeurs }, 'Compte mis à jour.')
  });
}

async function appelerFonctionTC(corps, messageSucces) {
  const { data, error } = await supabaseClient.functions.invoke('gerer-tous-les-comptes', { body: corps });
  const banniere = document.getElementById('banniereTC');

  if (error || data?.error) {
    const message = error ? await lireErreurTC(error) : data.error;
    if (banniere) banniere.innerHTML = `<p class="message-erreur">${echapperTC(message)}</p>`;
    else alert(message);
    return;
  }

  await chargerComptesTC();
  const nouvelleBanniere = document.getElementById('banniereTC');
  if (nouvelleBanniere) nouvelleBanniere.innerHTML = `<div class="encadre-succes-admin">✅ ${echapperTC(messageSucces)}</div>`;
}

init();
