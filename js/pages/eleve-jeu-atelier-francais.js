// Page pages/eleve/jeu-atelier-francais.html — "L'Atelier du Français"
// (treizième requête, 12 septembre 2026, second lot).
//
// **Rebranché le 24 septembre 2026** sur le moteur d'arcade commun
// (js/jeux/moteur-jeu-arcade.js / coquille-jeu-arcade.js) — demande
// explicite : "Pour le français, faut lier les questionnaires à au séances
// réelles". Entre le 12 et le 24 septembre 2026, ce fichier était un port
// quasi-verbatim d'un fichier de référence fourni par le porteur du projet,
// avec sa propre banque fixe de 30 questions (6 catégories × 3 difficultés) —
// entièrement retiré ci-dessous, remplacé par la même configuration légère
// que jeu-es.html/jeu-est.html (voir ces fichiers).
//
// Clarification obtenue avant cette bascule (AskUserQuestion) : le porteur
// du projet a choisi de conserver un filtre par CATÉGORIE en plus du palier
// (plutôt que de passer au palier seul, comme ES/EST), malgré un contenu réel
// encore peu fourni à ce jour (27 blocs sur 13 séances de Français, répartis
// sur 9 valeurs de seances.discipline différentes) — et a confirmé que ce
// jeu devient, comme les autres jeux liés aux séances réelles, soumis au
// service Premium "correction_ia" (il était auparavant gratuit et illimité,
// sans aucune vérification d'accès).
//
// Les 5 catégories ci-dessous reprennent exactement celles de l'ancienne
// banque statique (Conjugaison/Grammaire/Orthographe/Vocabulaire/Expression).
// Aucune colonne dédiée n'existe pour ranger une séance dans l'une de ces
// catégories : le rapprochement se fait par mots-clés sur seances.discipline
// (texte libre saisi par l'auteur de la séance, ex. "Vocabulaire Thématique",
// "Expression Écrite (1er Jet)") — voir motsCles ci-dessous et
// construireFiltreCategorie() dans coquille-jeu-arcade.js. "Lecture" et
// "Écriture" (disciplines réellement utilisées mais absentes de l'ancienne
// liste de catégories) sont rattachées à "Expression", la catégorie la plus
// proche dans l'esprit (production/compréhension de la langue) — un
// classement pragmatique, à affiner si de nouvelles disciplines apparaissent
// et ne s'y reconnaissent plus.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [1], // Français
    dureesParDefautSecondes: 15,
    permettreMasquerOperation: false,
    categoriesDisponibles: [
      { code: 'conjugaison', label: '⏳ Conjugaison', motsCles: ['conjug'] },
      { code: 'grammaire', label: '🧩 Grammaire', motsCles: ['grammair'] },
      { code: 'orthographe', label: '✍️ Orthographe', motsCles: ['orthograph'] },
      { code: 'vocabulaire', label: '📚 Vocabulaire', motsCles: ['vocabulaire'] },
      { code: 'expression', label: '📝 Expression', motsCles: ['expression', 'écriture', 'lecture'] },
    ],
    // 24 septembre 2026, septième lot : limite des questions par unité ou
    // thème ("Prévois une limite des questions Par unité ou thème pour
    // français") — voir jeuListerPorteeContenu (js/jeux/moteur-jeu-arcade.js).
    porteeGranularite: 'unite_theme',
    // Fusion Entraînement IA (même lot — "Retire le bouton entrainement IA
    // et mélange simplement les questions IA avec celles existant déjà") :
    // plus de bouton manuel, voir js/jeux/coquille-jeu-arcade.js
    // (choisirPalier/lancer) et js/jeux/entrainement-ia-arcade.js.
    // avecCategorie: true, car ce jeu a un filtre par catégorie (voir
    // categoriesDisponibles ci-dessus) — les questions générées pour
    // Français sont elles aussi taguées par catégorie (voir pages/admin/
    // questions-ia-jeux.html) avec exactement ces 5 codes.
    entrainementIA: { champFormationId: 1, avecCategorie: true },
  });
  await jeu.init(profil, classeId);
})();
