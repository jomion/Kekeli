// Lot "Jeux éducatifs interactifs" (11 septembre 2026, douzième requête).
// Moteur PARTAGÉ des jeux d'arcade reliés aux vraies séances : découverte de
// contenu réel (blocs_seance rattachés aux séances déjà publiées de la
// classe de l'élève, jamais une banque de questions à part), et
// réutilisation EXACTE du système de paliers/badges déjà en place (mêmes
// appels que js/pages/eleve-seance.js — valider_tache pour le guidage en
// direct, soumission réelle pour la notation/les badges,
// etat_paliers_seance_v2 pour l'état des paliers). Voir
// js/jeux/rendu-questions-jeu.js pour le rendu des 13 types de question.
//
// Utilisé par pages/eleve/jeu-es.html (Éducation Sociale) et jeu-est.html
// (Éducation Scientifique et Technologique), séparés le 24 septembre 2026 à
// partir de l'ancien jeu combiné "Défi ES & EST" (jeu-es-est.html, retiré ce
// même jour) — et depuis le même jour par jeu-atelier-francais.html
// (Français), qui a rejoint ce moteur commun après avoir été, entre le 12 et
// le 24 septembre 2026, un port fidèle et autonome d'une banque de 30
// questions statiques (voir js/pages/eleve-jeu-atelier-francais.js pour le
// détail de cette bascule). jeu-calcul-mental.html reste volontairement à
// l'écart de ce moteur (calcul mental généré aléatoirement, jamais tiré des
// séances — voir js/pages/eleve-jeu-calcul-mental.js).
//
// Dépend de : supabaseClient (js/supabaseClient.js), RACINE_SITE (défini
// inline sur chaque page), js/sons-eleve.js (jouerSonReussite/Echec/Palier).

// --- Paliers (mêmes 4 niveaux que le reste du site — badges, tableau de
// bord, jeux éducatifs — mais couleurs "néon" pour s'accorder au chrome
// sombre des jeux, repris des fichiers de référence fournis) -----------------
const JEU_PALIERS = [
  { code: 'azovi', icone: '🌱', nom: 'Azɔ̀ví', couleur: '#10b981', desc: 'Débutant' },
  { code: 'devi', icone: '🪘', nom: 'Dèví', couleur: '#06b6d4', desc: 'Intermédiaire' },
  { code: 'ogan', icone: '🦁', nom: 'Ògán', couleur: '#f59e0b', desc: 'Avancé' },
  { code: 'axosu', icone: '👑', nom: 'Axɔ́sú', couleur: '#8b5cf6', desc: 'Expert' },
];

const JEU_LIBELLES_MEDAILLE = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or', diamant: '💎 Diamant' };
const JEU_IMAGE_MEDAILLE = { bronze: 'badge-bronze.jpg', argent: 'badge-argent.jpg', or: 'badge-or.jpg', diamant: 'badge-diamant.jpg' };

function jeuLibelleMedaille(medaille, numeroEssai) {
  if (!medaille || numeroEssai > 2) return '';
  const marque = numeroEssai === 2 ? ' <span style="opacity:.75;font-size:.85em">· 2ᵉ essai</span>' : '';
  const image = JEU_IMAGE_MEDAILLE[medaille]
    ? `<img src="${RACINE_SITE}assets/badges/${JEU_IMAGE_MEDAILLE[medaille]}" alt="" width="18" height="18" style="display:inline-block;vertical-align:middle;object-fit:contain;margin-right:4px">` : '';
  return `${image}${JEU_LIBELLES_MEDAILLE[medaille] || ''}${marque}`;
}

// --- Découverte du contenu réel ---------------------------------------------
// Même cheminement en 3 étapes que js/pages/eleve-jeux-educatifs.js
// (noeuds_parcours → sa → seances), étendu avec un filtre champ_formation_id
// (une ou plusieurs matières — 2 pour le jeu ES+EST) et un filtre palier.
async function jeuTrouverClasseEleve(eleveId) {
  const { data } = await supabaseClient.from('eleves').select('classe_id').eq('id', eleveId).maybeSingle();
  return data?.classe_id || null;
}

// filtrerCategorie (optionnel, ajouté le 24 septembre 2026 pour l'Atelier du
// Français relié aux vraies séances) : fonction (discipline: string) =>
// boolean, appliquée sur seances.discipline pour ne garder que les blocs
// d'une catégorie choisie par l'élève (conjugaison, grammaire...) — voir
// config.categoriesDisponibles dans js/jeux/coquille-jeu-arcade.js. Absente
// ou non fournie, aucun filtre de catégorie n'est appliqué (comportement
// inchangé pour les autres jeux — ES, EST, et l'ancien ES+EST combiné).
async function jeuTrouverBlocsCandidats({ classeId, champFormationIds, palier, filtrerCategorie }) {
  if (!classeId || !Array.isArray(champFormationIds) || !champFormationIds.length || !palier) return [];

  const { data: noeuds } = await supabaseClient.from('noeuds_parcours')
    .select('id').eq('classe_id', classeId).in('champ_formation_id', champFormationIds);
  const idsNoeuds = (noeuds || []).map(n => n.id);
  if (!idsNoeuds.length) return [];

  const { data: sa } = await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds);
  const idsSA = (sa || []).map(s => s.id);
  if (!idsSA.length) return [];

  const { data: seances } = await supabaseClient.from('seances')
    .select('id, titre, titre_contenu, discipline').eq('statut', 'publie').in('sa_id', idsSA);
  const seancesParId = {};
  (seances || []).forEach(s => { seancesParId[s.id] = s; });
  const idsSeances = Object.keys(seancesParId).map(Number);
  if (!idsSeances.length) return [];

  // select('*') puis filtre côté client (brouillon / type) : même prudence
  // que js/pages/eleve-seance.js — la RLS bloque déjà les brouillons, ce
  // filtre est une seconde barrière, jamais la seule.
  const { data: blocs } = await supabaseClient.from('blocs_seance')
    .select('*').in('seance_id', idsSeances).eq('palier', palier).order('ordre');

  let resultats = (blocs || [])
    .filter(b => b.statut_bloc !== 'brouillon' && ['quiz', 'evaluation', 'activite'].includes(b.type_bloc))
    .filter(b => Array.isArray(b.contenu?.questions) && b.contenu.questions.length > 0)
    .map(b => ({ ...b, seance: seancesParId[b.seance_id] }));

  if (typeof filtrerCategorie === 'function') {
    resultats = resultats.filter(b => filtrerCategorie(b.seance?.discipline));
  }

  return resultats;
}

// Choisit LA ronde à proposer : priorité au contenu jamais tenté, puis à un
// bloc en cours (essais < 3, pas encore réussi à 100%) ; si tout est déjà
// épuisé/réussi, on retombe sur le premier bloc en mode "relecture" plutôt
// que de bloquer l'élève sur une impasse.
async function jeuTrouverRonde({ eleveId, classeId, champFormationIds, palier, filtrerCategorie }) {
  const blocsCandidats = await jeuTrouverBlocsCandidats({ classeId, champFormationIds, palier, filtrerCategorie });
  if (!blocsCandidats.length) return { aucunContenu: true };

  const idsBlocs = blocsCandidats.map(b => b.id);
  const { data: reponses } = await supabaseClient.from('reponses_exercices')
    .select('*').eq('eleve_id', eleveId).in('bloc_id', idsBlocs).order('numero_essai');
  const reponsesParBloc = {};
  (reponses || []).forEach(r => { (reponsesParBloc[r.bloc_id] ??= []).push(r); });

  const jamaisTente = blocsCandidats.find(b => !(reponsesParBloc[b.id]?.length));
  if (jamaisTente) return { bloc: jamaisTente, essaisPrecedents: [], termine: false };

  const enCours = blocsCandidats.find(b => {
    const essais = reponsesParBloc[b.id] || [];
    if (essais.length >= 3) return false;
    const dernier = essais[essais.length - 1];
    const total = dernier.nb_taches ?? dernier.score_max;
    const reussies = dernier.nb_taches_reussies ?? dernier.score;
    return !(total > 0 && reussies === total);
  });
  if (enCours) return { bloc: enCours, essaisPrecedents: reponsesParBloc[enCours.id], termine: false };

  const premier = blocsCandidats[0];
  return { bloc: premier, essaisPrecedents: reponsesParBloc[premier.id] || [], termine: true, dernierEssai: reponsesParBloc[premier.id][reponsesParBloc[premier.id].length - 1] };
}

// --- Accès premium (correction automatique) ---------------------------------
// Exactement le même service que la page séance : "correction_ia" — voir
// etat_acces_service côté base. Les jeux ne créent AUCUN nouveau service
// premium, ils réutilisent celui déjà en place.
async function jeuVerifierAccesCorrection(eleveId) {
  const { data } = await supabaseClient.rpc('etat_acces_service', { p_eleve_id: eleveId, p_service: 'correction_ia' });
  return data || { autorise: false };
}

// --- Validation en direct (guidage question par question, sans coût) -------
async function jeuValiderTache({ blocId, questionId, reponse }) {
  const { data, error } = await supabaseClient.functions.invoke('corriger-exercice', {
    body: { blocId, action: 'valider_tache', questionId, reponse },
  });
  if (error) throw new Error(error.message || "Impossible de vérifier ta réponse pour l'instant.");
  if (data?.error) throw new Error(data.error);
  return data;
}

// --- Soumission RÉELLE (consomme un essai + le quota Premium, déclenche la
// notation et le recalcul des paliers/badges côté base) — identique à
// soumettreExercice (js/pages/eleve-seance.js), à une exception près :
// depuisJeu: true (24 septembre 2026, correctif "un jeu ne doit jamais
// débloquer une séance") indique côté serveur que cette réponse vient d'un
// jeu d'arcade réutilisant un vrai bloc de séance — la notation (score,
// tâches, médaille, paliers/badges, compétences) reste inchangée, mais la
// séance dont ce bloc fait partie n'est jamais marquée "terminée" pour
// autant (l'élève n'a joué qu'une question isolée, pas visité la séance).
async function jeuSoumettreRonde({ blocId, reponses, numeroEssai }) {
  const { data, error } = await supabaseClient.functions.invoke('corriger-exercice', { body: { blocId, reponses, numeroEssai, depuisJeu: true } });
  if (error) {
    let message = error.message || "Le service de correction n'a pas répondu.";
    try {
      const corps = await error.context?.json?.();
      if (corps?.error) message = corps.error;
    } catch (_ignore) { /* on garde le message par défaut */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function jeuEtatPaliers({ eleveId, seanceId }) {
  const { data } = await supabaseClient.rpc('etat_paliers_seance_v2', { p_eleve_id: eleveId, p_seance_id: seanceId });
  return data || [];
}

async function jeuConsulterCorrection(blocId) {
  const { data, error } = await supabaseClient.rpc('consulter_correction_exercice', { p_bloc_id: blocId });
  if (error) throw new Error(error.message || "Impossible d'afficher la correction pour l'instant.");
  return data;
}

// --- Réglage "masquer l'opération pour entraîner la mémoire" ---------------
// preferences_navigation.masquer_operation_jeux (migration du 11 septembre
// 2026) — même table/pattern d'upsert que theme_premium, voir
// js/pages/parametres.js. Utilisé par le jeu Calcul mental / Cadran
// opératoire pour cacher l'énoncé du calcul pendant la partie.
async function jeuLireMasquerOperation(eleveId) {
  const { data } = await supabaseClient.from('preferences_navigation')
    .select('masquer_operation_jeux').eq('utilisateur_id', eleveId).maybeSingle();
  return !!data?.masquer_operation_jeux;
}

async function jeuDefinirMasquerOperation(eleveId, actif) {
  const { error } = await supabaseClient.from('preferences_navigation')
    .upsert({ utilisateur_id: eleveId, masquer_operation_jeux: actif, maj_le: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// --- Petit utilitaire : détecte si une question "réponse_numerique" est un
// calcul simple "A <op> B" (ex: "7 x 8 = ?", "12 + 5", "Combien font 9 - 4 ?")
// pour piloter le cadran cosmétique du jeu Calcul mental — sinon (énoncé
// pédagogique plus riche, mot-problème...) le cadran reste décoratif et
// l'énoncé s'affiche en texte classique. Volontairement permissif mais
// jamais approximatif : si le motif ne matche pas clairement, on renvoie
// null plutôt que de deviner.
function jeuAnalyserCalculSimple(enonce) {
  if (!enonce) return null;
  const texte = String(enonce).toLowerCase()
    .replace(/×|x(?=\s*\d)/g, '*').replace(/÷/g, '/').replace(/plus/g, '+')
    .replace(/moins/g, '-').replace(/fois/g, '*');
  const m = texte.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-*/])\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return { a: parseFloat(m[1].replace(',', '.')), op: m[2], b: parseFloat(m[3].replace(',', '.')) };
}
