// Page pages/enseignant/consulter-seance.html
// 19 septembre 2026 (25e lot) : « Ajoute aussi le mode lecture uniquement
// pour tous les rôles qui n'en n'ont pas encore accès » — précisé ensuite par
// le porteur du projet : l'enseignant doit pouvoir accéder au contenu d'une
// séance et le LIRE, sans jamais pouvoir déclencher une correction
// automatique. Avant ce correctif, un enseignant sans droit d'édition
// (pages/editeur-seance.html est réservé à l'admin via requireAdmin()) ne
// pouvait voir d'une séance que l'aperçu compact de pages/seances.html
// (js/apercu-blocs-seance.js — juste "N questions", jamais leur contenu
// réel). Cette page réutilise le rendu complet et désactivé de
// js/lecture-seule-seance.js (dérivé de l'aperçu élève de l'éditeur admin) :
// aucune donnée écrite, aucun appel à la Edge Function corriger-exercice.
// Sécurité : entièrement portée par les policies RLS déjà en place sur
// `seances`/`blocs_seance` (peut_gerer_classe_champ couvre déjà l'enseignant
// pour les classes qu'il gère, via classe assignée ou abonnement élève
// accepté — voir enseignant-devoirs-notes.js pour le même principe) ; cette
// page ne fait qu'afficher ce que la requête renvoie, sans vérification
// cliente supplémentaire qui pourrait diverger de la vraie règle serveur.

(async function () {
  const profil = await requireRole('enseignant');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperConsultEns(profil.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });
  await chargerConsultationEns();
})();

function echapperConsultEns(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function remonterCheminNoeudsConsultEns(noeudDepart) {
  const chemin = [];
  let n = noeudDepart;
  let garde = 0;
  while (n && garde++ < 20) {
    chemin.unshift(n.titre);
    if (!n.parent_id) break;
    const { data: parent } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, titre').eq('id', n.parent_id).single();
    n = parent;
  }
  return chemin;
}

async function chargerConsultationEns() {
  const conteneur = document.getElementById('contenu');
  const params = new URLSearchParams(window.location.search);
  const seanceId = parseInt(params.get('id'), 10);
  if (!seanceId) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Séance introuvable.</p>';
    return;
  }

  const { data: seance } = await supabaseClient
    .from('seances')
    .select('*, sa(titre, noeud_id, noeuds_parcours(id, parent_id, titre, classe_id, champ_formation_id, classes(nom), champs_formation(nom)))')
    .eq('id', seanceId).maybeSingle();
  // RLS (seances_lecture_publiees) renvoie null si cet enseignant ne gère pas
  // la classe/matière de cette séance — même message que côté élève pour une
  // séance introuvable, pas de distinction technique inutile ici.
  if (!seance || seance.statut !== 'publie') {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Cette séance est introuvable, n\'est pas publiée, ou vous n\'y avez pas accès.</p>';
    return;
  }

  const noeud = seance.sa?.noeuds_parcours;
  const classeNom = noeud?.classes?.nom || '';
  const champNom = noeud?.champs_formation?.nom || '';
  const cheminNoeuds = noeud ? await remonterCheminNoeudsConsultEns(noeud) : [];
  const segmentsChemin = [classeNom, champNom, ...cheminNoeuds, seance.discipline || seance.titre_contenu || seance.titre];
  const filArianeHtml = segmentsChemin.filter(Boolean).map(s => `<span>${echapperConsultEns(s)}</span>`).join(' <span class="sep-arbo-eleve">›</span> ');

  const { data: blocs } = await supabaseClient
    .from('blocs_seance').select('*').eq('seance_id', seanceId).eq('statut_bloc', 'publie').order('ordre');

  conteneur.innerHTML = html_seanceLectureSeule(seance, blocs || [], filArianeHtml,
    'Mode consultation — vous lisez cette séance telle qu\'affichée à un élève. Vous ne pouvez pas y répondre : aucune correction n\'est possible depuis cette vue.');
}
