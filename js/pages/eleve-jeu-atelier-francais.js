// Page pages/eleve/jeu-atelier-francais.html — jeu "L'Atelier du Français"
// (lot "Jeux éducatifs interactifs", 11 septembre 2026, douzième requête).
// Fidèle au fichier de référence fourni ("atelier_français.html") pour le
// chrome visuel/sonore (voir css/jeux-arcade.css et
// js/jeux/coquille-jeu-arcade.js), mais tire ses questions des VRAIES
// activités déjà publiées pour la classe de l'élève (matière Français,
// champ_formation_id = 1 — voir js/pages/eleve-matiere.js) et rejoue le
// système de paliers/badges déjà en place (aucune règle de notation
// dupliquée ici).

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [1], // Français — voir champs_formation en base
    dureesParDefautSecondes: 15,
    permettreMasquerOperation: false,
  });
  await jeu.init(profil, classeId);
})();
