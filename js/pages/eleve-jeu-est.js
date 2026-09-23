// Page pages/eleve/jeu-est.html — jeu "Défi Éducation Scientifique et
// Technologique" (champ_formation_id = 4), séparé le 24 septembre 2026 de
// l'ancien jeu combiné "Défi ES & EST" (js/pages/eleve-jeu-es-est.js, retiré
// ce même jour) sur demande explicite : "Sépare l'ES de L'EST et lie chacun
// au séances réelles du site". Même moteur/mêmes paliers que les autres jeux
// (voir js/jeux/coquille-jeu-arcade.js) — seule la matière ciblée change ; la
// recherche de contenu (js/jeux/moteur-jeu-arcade.js) tirait déjà, avant
// cette séparation, dans les séances publiées de la classe de l'élève.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [4], // Éducation Scientifique et Technologique
    dureesParDefautSecondes: 15,
    permettreMasquerOperation: false,
  });
  await jeu.init(profil, classeId);
})();
