// Liste des liens de navigation par rôle, utilisée par js/entete-navigation.js
// et par pages/parametres.html (pour proposer les liens masquables).
//
// Toutes les hrefs sont écrites comme si on se trouvait DANS le dossier du
// rôle (ex. pages/eleve/...) : { href: 'tableau-de-bord.html' } veut dire
// "tableau-de-bord.html à côté de la page courante". Utiliser
// liensAvecPrefixe(cle, prefixe) pour obtenir ces mêmes liens depuis un autre
// dossier (ex. pages/navigation.html doit préfixer par "admin/" ou
// "enseignant/" ; pages/parametres.html doit préfixer par "<role>/").
//
// `racine: true` : l'href est déjà écrite depuis la RACINE DU SITE (ex.
// 'pages/seances.html') plutôt que depuis le dossier du rôle — utilisé pour
// les quelques pages partagées qui ne vivent pas dans un dossier de rôle
// (pages/navigation.html, pages/seances.html...). liensAvecPrefixe() la
// préfixe alors avec RACINE_SITE (déjà défini par la page appelante) au lieu
// du préfixe de dossier habituel.
//
// `categorie` : regroupe plusieurs liens sous un même menu déroulant dans
// l'en-tête (voir CATEGORIES_NAV ci-dessous et js/entete-navigation.js) —
// utile pour un rôle qui a beaucoup de liens (admin). Un lien sans
// `categorie` reste affiché directement dans la barre.
//
// `superAdminSeulement: true` : à ne garder que si l'appelant sait que le
// profil courant est super_admin (filtré via l'option superAdmin ci-dessous).

const CATEGORIES_NAV = {
  pedagogie: { label: 'Pédagogie', icone: '📚' },
  comptes: { label: 'Comptes', icone: '👥' },
  finances: { label: 'Finances', icone: '💳' }
};

const LIENS_PAR_ROLE = {
  eleve: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'matieres', href: 'matiere.html', icone: '📘', label: 'Mes matières' },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Mes badges' },
    // Fonctionnalité Premium (voir messagerie.html) : le lien reste visible
    // pour tous — la page explique elle-même comment l'activer (abonnement
    // + autorisation d'un parent) plutôt que de disparaître silencieusement.
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie ✨' }
  ],
  parent: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'paiements', href: 'paiements.html', icone: '💳', label: 'Paiements' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' }
  ],
  enseignant: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' },
    { id: 'messagerie-admin', href: 'messagerie-admin.html', icone: '📨', label: "Contacter l'administration" }
  ],
  autorite: [
    { id: 'bienvenue', href: 'bienvenue.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' }
  ],
  admin: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'navigation-arbo', href: 'pages/navigation.html', racine: true, icone: '🌳', label: 'Arborescence', categorie: 'pedagogie' },
    { id: 'editer-seance', href: 'gestion-seances.html', icone: '✏️', label: 'Gestion des séances', categorie: 'pedagogie' },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances', categorie: 'pedagogie' },
    { id: 'activites', href: 'activites.html', icone: '✅', label: 'Corriger activités', categorie: 'pedagogie' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes', categorie: 'pedagogie' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Badges', categorie: 'pedagogie' },
    { id: 'competences', href: 'competences.html', icone: '🧩', label: 'Compétences ✨', categorie: 'pedagogie' },
    { id: 'enseignants-classes', href: 'enseignants-classes.html', icone: '🏫', label: 'Enseignants & classes', categorie: 'comptes' },
    { id: 'gestion-administrateurs', href: 'gestion-administrateurs.html', icone: '🛠️', label: 'Administrateurs', categorie: 'comptes', superAdminSeulement: true },
    { id: 'roles', href: 'roles.html', icone: '🎛️', label: 'Rôles admin', categorie: 'comptes', superAdminSeulement: true },
    { id: 'abonnements', href: 'abonnements.html', icone: '💳', label: 'Abonnements', categorie: 'finances' },
    { id: 'paiements', href: 'paiements.html', icone: '💰', label: 'Paiements', categorie: 'finances' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' },
    { id: 'bannieres', href: 'bannieres.html', icone: '📣', label: 'Bannière', superAdminSeulement: true },
    { id: 'section-accueil', href: 'section-accueil.html', icone: '🖼️', label: "Accueil (bandeau)", superAdminSeulement: true }
  ]
};

// Libellés lisibles pour pages/parametres.html.
const LIBELLES_ROLE = {
  eleve: 'Élève', parent: 'Parent', enseignant: 'Enseignant', autorite: 'Autorité pédagogique', admin: 'Administrateur'
};

function liensAvecPrefixe(cle, prefixe, opts) {
  const options = opts || {};
  const racineSite = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
  return (LIENS_PAR_ROLE[cle] || [])
    .filter(l => !l.superAdminSeulement || options.superAdmin)
    .map(l => ({ ...l, href: l.racine ? (racineSite + l.href) : (prefixe + l.href) }));
}
