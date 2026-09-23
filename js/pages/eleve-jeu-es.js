// Page pages/eleve/jeu-es.html — jeu "Défi Éducation Sociale" (champ_formation_id
// = 3), séparé le 24 septembre 2026 de l'ancien jeu combiné "Défi ES & EST"
// (js/pages/eleve-jeu-es-est.js, retiré ce même jour) sur demande explicite :
// "Sépare l'ES de L'EST et lie chacun au séances réelles du site". Même
// moteur/mêmes paliers que les autres jeux (voir js/jeux/coquille-jeu-
// arcade.js) — seule la matière ciblée change ; la recherche de contenu
// (js/jeux/moteur-jeu-arcade.js) tirait déjà, avant cette séparation, dans
// les séances publiées de la classe de l'élève.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [3], // Éducation Sociale
    dureesParDefautSecondes: 15,
    permettreMasquerOperation: false,
  });
  await jeu.init(profil, classeId);
  // 24 septembre 2026 (requête P, partie 2) : bouton "Entraînement IA" —
  // questions inédites générées par IA, validées par un administrateur, hors
  // du pipeline de notation habituel. Voir js/jeux/entrainement-ia-arcade.js.
  initEntrainementIA(jeu, { champFormationId: 3 });
})();
