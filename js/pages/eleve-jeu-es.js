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
    // 24 septembre 2026, septième lot : limite des questions par SA
    // ("Prévois une limite des questions [...] SA pour EST et ES") — voir
    // jeuListerPorteeContenu (js/jeux/moteur-jeu-arcade.js), pas de
    // sous-arborescence unité/thème au-dessus de la SA pour cette matière.
    porteeGranularite: 'sa',
    // Fusion Entraînement IA (même lot — "Retire le bouton entrainement IA
    // et mélange simplement les questions IA avec celles existant déjà") :
    // plus de bouton manuel, voir js/jeux/coquille-jeu-arcade.js
    // (choisirPalier/lancer) et js/jeux/entrainement-ia-arcade.js.
    entrainementIA: { champFormationId: 3 },
  });
  await jeu.init(profil, classeId);
})();
