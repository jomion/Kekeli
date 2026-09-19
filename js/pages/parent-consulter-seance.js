// Page pages/parent/consulter-seance.html
// 19 septembre 2026 (25e lot) : même principe que js/pages/enseignant-consulter-seance.js
// (voir ce fichier pour le contexte détaillé de la demande) — un parent
// pouvait déjà LIRE les données de suivi de son enfant (réponses, notes,
// badges, voir pages/parent/suivi-enfant.html) mais n'avait aucune page pour
// voir le CONTENU d'une séance (support de cours, énoncé des exercices).
// Contrairement à l'enseignant, le parent n'a accès qu'aux séances de la/les
// classe(s) de SES enfants (parent_eleve) — déjà la seule règle que vérifie
// la policy RLS seances_lecture_publiees/blocs_lecture, reprise ici sans
// duplication de logique de sécurité côté client.

(async function () {
  const profil = await requireRole('parent');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'parent', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperConsultParent(profil.prenom)}`,
    liens: liensAvecPrefixe('parent', '')
  });
  await chargerConsultationParent();
})();

function echapperConsultParent(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function remonterCheminNoeudsConsultParent(noeudDepart) {
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

async function chargerConsultationParent() {
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
  // RLS (seances_lecture_publiees/blocs_lecture) ne renvoie une ligne que si
  // cette séance appartient à la classe d'au moins un enfant suivi par ce
  // parent (via parent_eleve) — même message générique qu'ailleurs sur le
  // site en cas de refus, sans distinguer "pas trouvé" de "pas autorisé".
  if (!seance || seance.statut !== 'publie') {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Cette séance est introuvable, n\'est pas publiée, ou vous n\'y avez pas accès.</p>';
    return;
  }

  const noeud = seance.sa?.noeuds_parcours;
  const classeNom = noeud?.classes?.nom || '';
  const champNom = noeud?.champs_formation?.nom || '';
  const cheminNoeuds = noeud ? await remonterCheminNoeudsConsultParent(noeud) : [];
  const segmentsChemin = [classeNom, champNom, ...cheminNoeuds, seance.discipline || seance.titre_contenu || seance.titre];
  const filArianeHtml = segmentsChemin.filter(Boolean).map(s => `<span>${echapperConsultParent(s)}</span>`).join(' <span class="sep-arbo-eleve">›</span> ');

  const { data: blocs } = await supabaseClient
    .from('blocs_seance').select('*').eq('seance_id', seanceId).eq('statut_bloc', 'publie').order('ordre');

  conteneur.innerHTML = html_seanceLectureSeule(seance, blocs || [], filArianeHtml,
    'Mode consultation — vous lisez cette séance telle qu\'affichée à votre enfant. Vous ne pouvez pas y répondre : aucune correction n\'est possible depuis cette vue.');
}
