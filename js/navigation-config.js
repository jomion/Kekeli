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
  finances: { label: 'Finances', icone: '💳' },
  // Espace enseignant, 12 septembre 2026 (tâche "gestion administrative") :
  // registre d'appel + bilan, planification mensuelle — regroupés ici pour
  // accueillir les prochains outils du même esprit (évaluation, fiche
  // pédagogique) sans reproduire le menu à plat.
  gestionAdministrative: { label: 'Gestion administrative', icone: '🗂️' },
  // Espace élève, 24 septembre 2026 (demande explicite : "regroupe les
  // boutons de l'entête de même catégorie... pour réduire le nombre de
  // bouton à l'affichage") : suivi personnel de l'élève (résultats, badges,
  // progrès, favoris) — distinct de "pedagogie" qui reste les outils de
  // travail (matières, séances, emploi du temps, cahier d'écriture).
  suivi: { label: 'Mon suivi', icone: '📈' }
};

const LIENS_PAR_ROLE = {
  // 24 septembre 2026 (demande explicite : "regroupe les boutons de
  // l'entête de même catégorie dans de catégorie différente pour réduire
  // le nombre de bouton à l'affichage") : l'entête élève venait de passer
  // à 11 liens à plat (le seul rôle sans regroupement par `categorie`,
  // malgré le plus grand nombre de liens) — regroupés ici en 2 menus
  // déroulants (mécanisme déjà existant, voir regrouperLiensParCategorie()
  // dans js/entete-navigation.js, réutilisé tel quel) :
  //   - "pedagogie" : les outils de travail (matières, séances, emploi du
  //     temps, cahier d'écriture) ;
  //   - "suivi" (nouvelle catégorie) : le suivi personnel de l'élève
  //     (devoirs & notes, badges, progrès, favoris).
  // "Tableau de bord" (essentiel), "Mon profil" et "Messagerie" restent à
  // plat. Résultat : 5 éléments visibles dans la barre au lieu de 11.
  // Sans effet sur la sidebar du thème premium (js/theme-premium-eleve.js),
  // qui ne lit jamais `categorie` et construit sa propre liste à plat.
  eleve: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'matieres', href: 'matiere.html', icone: '📘', label: 'Mes matières', categorie: 'pedagogie' },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances', categorie: 'pedagogie' },
    // 19 septembre 2026 : emploi du temps hebdomadaire officiel, partagé par
    // tous les rôles liés à la classe (CM1/CM2 pour l'instant), voir
    // js/pages/emploi-du-temps.js. Page partagée à la racine de pages/ comme
    // "seances" ci-dessus, donc racine: true.
    { id: 'emploi-du-temps', href: 'pages/emploi-du-temps.html', racine: true, icone: '🗓️', label: 'Emploi du temps', categorie: 'pedagogie' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes', categorie: 'suivi' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Mes badges', categorie: 'suivi' },
    // 24 septembre 2026 : intégration du cahier d'écriture Seyes/Éducajou
    // (outil libre GPL, écrit par Arnaud Champollion) — page quadrillée
    // Seyes éditable, polices cursives, export PDF/impression, sauvegarde
    // locale/lien de partage. L'outil lui-même est copié tel quel dans
    // pages/eleve/cahier-ecriture/ (dossier autonome avec son propre
    // css/js/images/polices), à la demande explicite de l'utilisateur
    // ("adapter exactement ce fichier") — aucune modification fonctionnelle
    // de son code, seul le suivi Matomo du Ministère de l'Éducation
    // nationale français (sans rapport avec Kekeli) en a été retiré.
    //
    // Le lien pointe vers pages/eleve/cahier-ecriture.html (mise à jour du
    // même jour, requête complémentaire "je veux que ça soit vraiment
    // intégré à Kekeli avec l'affichage du logo et du menu de navigation") :
    // une page normale du site (en-tête/pied de page/sidebar réels, comme
    // toutes les autres pages élève, pilotée par js/pages/eleve-cahier-
    // ecriture.js) qui embarque l'outil dans un <iframe> et propose un choix
    // de classe CI à CM2 avec un lignage par défaut adapté à chacune.
    { id: 'cahier-ecriture', href: 'cahier-ecriture.html', icone: '✍️', label: "Cahier d'écriture", categorie: 'pedagogie' },
    // 19 septembre 2026 : "Mes progrès"/"Favoris"/"Mon profil" existaient déjà
    // (visuels seulement) dans la sidebar/nav mobile basse du thème premium
    // (voir js/theme-premium-eleve.js) — ajoutés ici aussi pour que l'élève
    // en thème classique (sans le look premium) puisse y accéder depuis
    // l'en-tête, comme n'importe quel autre lien réel du rôle.
    { id: 'mes-progres', href: 'mes-progres.html', icone: '📈', label: 'Mes progrès', categorie: 'suivi' },
    { id: 'favoris', href: 'favoris.html', icone: '❤️', label: 'Favoris', categorie: 'suivi' },
    { id: 'profil', href: 'profil.html', icone: '🙂', label: 'Mon profil' },
    // Fonctionnalité Premium (voir messagerie.html) : le lien reste visible
    // pour tous — la page explique elle-même comment l'activer (abonnement
    // + autorisation d'un parent) plutôt que de disparaître silencieusement.
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie ✨' }
  ],
  parent: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    // 19 septembre 2026 (25e lot) : « en tant que parent, je n'ai pas pu
    // accéder aux activités de l'enfant... les cours suivis, les activités,
    // les badges » — nouvelle page dédiée (voir js/pages/parent-suivi-enfant.js).
    { id: 'suivi-enfant', href: 'suivi-enfant.html', icone: '📈', label: "Suivi de l'enfant" },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'emploi-du-temps', href: 'pages/emploi-du-temps.html', racine: true, icone: '🗓️', label: 'Emploi du temps' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'paiements', href: 'paiements.html', icone: '💳', label: 'Paiements' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' }
  ],
  enseignant: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes' },
    { id: 'registre-appel', href: 'registre-appel.html', icone: '📋', label: "Registre d'appel", categorie: 'gestionAdministrative' },
    { id: 'planification', href: 'planification.html', icone: '🗓️', label: 'Planification mensuelle', categorie: 'gestionAdministrative' },
    // 19 septembre 2026 (demande explicite : "Pour les enseignant ajoute
    // l'emploi du temps dans gestion administrative") — regroupé ici plutôt
    // qu'en lien top-level, avec registre d'appel et planification.
    { id: 'emploi-du-temps', href: 'pages/emploi-du-temps.html', racine: true, icone: '🗓️', label: 'Emploi du temps', categorie: 'gestionAdministrative' },
    { id: 'messagerie', href: 'messagerie.html', icone: '💬', label: 'Messagerie' },
    { id: 'messagerie-admin', href: 'messagerie-admin.html', icone: '📨', label: "Contacter l'administration" }
  ],
  autorite: [
    { id: 'bienvenue', href: 'bienvenue.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances' },
    { id: 'emploi-du-temps', href: 'pages/emploi-du-temps.html', racine: true, icone: '🗓️', label: 'Emploi du temps' }
  ],
  admin: [
    { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
    { id: 'navigation-arbo', href: 'pages/navigation.html', racine: true, icone: '🌳', label: 'Arborescence', categorie: 'pedagogie' },
    { id: 'editer-seance', href: 'gestion-seances.html', icone: '✏️', label: 'Gestion des séances', categorie: 'pedagogie' },
    { id: 'seances', href: 'pages/seances.html', racine: true, icone: '📌', label: 'Séances', categorie: 'pedagogie' },
    { id: 'emploi-du-temps', href: 'pages/emploi-du-temps.html', racine: true, icone: '🗓️', label: 'Emploi du temps', categorie: 'pedagogie' },
    { id: 'activites', href: 'activites.html', icone: '✅', label: 'Corriger activités', categorie: 'pedagogie' },
    { id: 'devoirs-notes', href: 'devoirs-notes.html', icone: '📊', label: 'Devoirs & notes', categorie: 'pedagogie' },
    { id: 'badges', href: 'badges.html', icone: '🏅', label: 'Badges', categorie: 'pedagogie' },
    { id: 'competences', href: 'competences.html', icone: '🧩', label: 'Compétences ✨', categorie: 'pedagogie' },
    // 24 septembre 2026 (requête P, partie 2) : génération par IA de
    // questions d'entraînement pour les jeux Français/ES/EST, toujours
    // relues et validées ici avant qu'un élève ne puisse y accéder — voir
    // js/pages/admin-questions-ia-jeux.js.
    { id: 'questions-ia-jeux', href: 'questions-ia-jeux.html', icone: '🤖', label: 'Questions IA (jeux) ✨', categorie: 'pedagogie' },
    // 24 septembre 2026 : plateforme de formation (marketplace multi-
    // formateurs, voir pages/formations/) — validation des formateurs et des
    // formations, catégories, inscriptions. Accès vérifié par la page
    // elle-même (droit « gerer_formations » ou super_admin).
    { id: 'formations', href: 'formations.html', icone: '🎓', label: 'Plateforme de formation', categorie: 'pedagogie' },
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
