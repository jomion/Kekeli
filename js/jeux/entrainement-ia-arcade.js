// Requête P, partie 2 (24 septembre 2026) : "Entraînement IA" — questions
// INÉDITES générées par IA à partir du contenu réel de la classe et des
// séances, mais toujours relues et validées par un administrateur avant
// qu'un élève ne puisse y jouer (pages/admin/questions-ia-jeux.html), pour
// les 3 jeux reliés aux vraies séances (Français, ES, EST — voir
// js/jeux/moteur-jeu-arcade.js).
//
// 24 septembre 2026, septième lot ("Retire le bouton entrainement IA et
// mélange simplement les questions IA avec celles existant déjà") : le
// bouton manuel "🤖 Entraînement IA" est RETIRÉ. Les questions IA validées
// sont désormais tirées au sort dans la même rotation que le contenu réel,
// sans action de l'élève — voir choisirPalier()/lancer() dans
// js/jeux/coquille-jeu-arcade.js, qui décide, à chaque choix de palier, si
// la prochaine partie sera une vraie ronde ou une question IA (coup de sort
// 50/50 si les deux existent, IA seule si le contenu réel est
// épuisé/absent, jamais d'IA sinon).
//
// 24 septembre 2026, douzième lot ("les questions IA ont une présentation
// particulière, tout doit se passer comme si c'est uniquement des questions
// d'activité") : la fenêtre superposée dédiée (#eiaOverlay, avec son propre
// habillage "🤖 Entraînement IA") a été RETIRÉE — les questions IA se
// déroulent désormais DANS l'écran de jeu normal (els.jeuCorps/
// questionArea/feedback/timerBar, décompte, bilan avec confettis), à
// l'identique d'une vraie ronde. Toute cette logique de déroulement vit
// maintenant directement dans js/jeux/coquille-jeu-arcade.js (voir
// questions()/validerQuestionCourante()/finaliserRonde(), qui branchent sur
// etat.modeRonde === 'ia'). Ce fichier ne conserve plus que la fonction
// d'appoint utilisée par choisirPalier() pour DÉCIDER du mode et PRÉPARER
// les questions IA (eiaCompterQuestionsDisponibles, ci-dessous) — plus
// aucun rendu ni interaction ici.
//
// Décision produit reconfirmée le même jour (clarification avant
// développement) : le service Premium payant dédié "entrainement_ia" est
// RETIRÉ — l'entraînement IA est désormais entièrement gratuit, comme le
// reste du contenu des 3 jeux (voir la Edge Function "jeu-ia-questions",
// dont la vérification etat_acces_service a été retirée côté serveur, et
// js/pages/admin-abonnements.js, dont le libellé de catalogue a été retiré —
// aucun plan tarifaire ni abonnement ne référençait ce service au moment du
// retrait, vérifié directement en base avant retrait).
// - "Entraînement libre, sans impact formel" (non négociable, reconfirmé
//   explicitement à chaque évolution de cette fonctionnalité) : une partie
//   utilisant du contenu IA ne touche JAMAIS reponses_exercices, essais,
//   médailles, paliers, badges ni compétences — js/jeux/coquille-jeu-
//   arcade.js n'appelle jamais jeuSoumettreRonde/jeuValiderTache
//   (js/jeux/moteur-jeu-arcade.js, qui persistent la notation réelle des
//   séances) pour une ronde en mode 'ia' ; la vérification de chaque
//   réponse passe exclusivement par l'action "corriger" de la Edge Function
//   jeu-ia-questions, qui ne persiste rien non plus. Cette garantie reste
//   structurelle (pas seulement conventionnelle) même maintenant que la
//   présentation est indiscernable d'une vraie ronde pour l'élève.
//
// Utilisation, depuis js/jeux/coquille-jeu-arcade.js (choisirPalier), via
// config.entrainementIA passé à creerJeuArcade() par
// js/pages/eleve-jeu-es.js/eleve-jeu-est.js/eleve-jeu-atelier-francais.js :
//   entrainementIA: { champFormationId: 3 }                    // ES/EST
//   entrainementIA: { champFormationId: 1, avecCategorie: true } // Français

// eiaCompterQuestionsDisponibles : appelée par choisirPalier() à chaque
// choix de palier/catégorie pour savoir si du contenu IA existe pour ce
// choix précis, ET pour préparer directement la liste complète des
// questions (réutilisée telle quelle par lancer() si le tirage au sort
// retient le mode 'ia' — aucun second appel réseau nécessaire).
async function eiaCompterQuestionsDisponibles({ champFormationId, palier, discipline }) {
  if (!champFormationId || !palier) return { count: 0, questions: [] };
  try {
    const { data, error } = await supabaseClient.functions.invoke('jeu-ia-questions', {
      body: { action: 'lister', champFormationId, palier, discipline: discipline || '' },
    });
    if (error || data?.error) return { count: 0, questions: [] };
    const lignes = Array.isArray(data?.questions) ? data.questions : [];
    // { ...l.question, id: l.id } — écrase volontairement l'id interne du
    // JSON question (une chaîne générée à l'insertion côté admin, voir
    // construireQuestionDepuisIAQia dans js/pages/admin-questions-ia-jeux.js)
    // par l'id RÉEL de la ligne questions_ia_generees (l.id, numérique) :
    // jeuRendreChampQuestion/jeuLireReponseQuestion (js/jeux/rendu-questions-
    // jeu.js) ne se servent de q.id que comme jeton opaque pour leurs
    // sélecteurs DOM, donc l'écraser ici ne casse rien côté affichage — mais
    // c'est cet id qu'il faut renvoyer tel quel à l'action "corriger" de
    // jeu-ia-questions (questionId), qui l'utilise pour retrouver la ligne et
    // son corrigé en base. Sans cette réécriture, "corriger" recevait l'id
    // interne (non numérique) et échouait systématiquement.
    const questions = lignes.map(l => ({ ...l.question, id: l.id }));
    return { count: questions.length, questions };
  } catch (_e) {
    // Panne réseau/Edge Function : jamais bloquant, se comporte comme
    // "aucune question IA disponible" — la rotation retombe sur le contenu
    // réel exactement comme avant cette fusion.
    return { count: 0, questions: [] };
  }
}
