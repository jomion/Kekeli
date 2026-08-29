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
// `superAdminSeulement: true` : à ne garder que si l'appelant sait que le
// profil courant est super_admin (filtré via l'option superAdmin ci-dessous).

const LIENS_PAR_ROLE = {
  eleve: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'matieres', href: 'matiere.html', icone: '📘', label: 'Mes matières' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Mes badges' }
  ],
  parent: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'paiements', href: 'paiements.html', icone: '💳', label: 'Paiements' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' }
  ],
  enseignant: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' },
    { id: 'messagerie-admin', href: 'messagerie-admin.html', icone: '📨', label: "Contacter l'administration" }
  ],
  autorite: [
    { id: 'bienvenue', href: 'bienvenue.html', icone: '🏠', label: 'Tableau de bord', essentiel: true }
  ],
  admin: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'enseignants-classes', href: 'enseignants-classes.html', icone: '🏫', label: 'Enseignants & classes' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'activites', href: 'activites.html', icone: '✅', label: 'Corriger activités' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Badges' },
    { id: 'abonnements', href: 'abonnements.html', icone: '💳', label: 'Abonnements' },
    { id: 'paiements', href: 'paiements.html', icone: '💰', label: 'Paiements' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' },
    { id: 'gestion-administrateurs', href: 'gestion-administrateurs.html', icone: '🛠️', label: 'Administrateurs', superAdminSeulement: true },
    { id: 'roles', href: 'roles.html', icone: '🎛️', label: 'Rôles admin', superAdminSeulement: true }
  ]
};

// Libellés lisibles pour pages/parametres.html.
const LIBELLES_ROLE = {
  eleve: 'Élève', parent: 'Parent', enseignant: 'Enseignant', autorite: 'Autorité pédagogique', admin: 'Administrateur'
};

function liensAvecPrefixe(cle, prefixe, opts) {
  const options = opts || {};
  return (LIENS_PAR_ROLE[cle] || [])
    .filter(l => !l.superAdminSeulement || options.superAdmin)
    .map(l => ({ ...l, href: prefixe + l.href }));
}
