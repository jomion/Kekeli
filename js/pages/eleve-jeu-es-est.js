// Page pages/eleve/jeu-es-est.html — nouveau jeu combinant les matières
// Éducation Sociale (ES, champ_formation_id = 3) et Éducation Scientifique
// et Technologique (EST, champ_formation_id = 4), comme demandé le
// 11 septembre 2026 (douzième requête indépendante) : "Tu vas mettre EST et
// ES ensemble dans un autre jeu ... Des quiz comme atelier de français avec
// les différents type d'exercice." Même moteur/mêmes paliers que les 2
// autres jeux (voir js/jeux/coquille-jeu-arcade.js) — seule la liste des
// matières ciblées change, la recherche de contenu (js/jeux/moteur-jeu-
// arcade.js) pioche indifféremment dans les séances publiées de l'une ou
// l'autre matière pour la classe de l'élève.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [3, 4], // Éducation Sociale + Éducation Scientifique et Technologique
    dureesParDefautSecondes: 15,
    permettreMasquerOperation: false,
  });
  await jeu.init(profil, classeId);
})();
