// Page pages/eleve/profil.html
// Nouvelle page "Mon profil" (19 septembre 2026, demande "si l'enfant appuie
// sur le bouton profil affiche son profil" + clarification AskUserQuestion :
// "Nouvelle page 'Mon profil' (Recommandé)") — fiche de lecture SEULE,
// AUCUN champ modifiable (cohérent avec la décision déjà actée que l'élève
// n'a rien à remplir dans un profil personnel) : avatar/mascotte, prénom,
// classe, total étoiles, total badges (tous types/paliers confondus — voir
// js/pages/eleve-badges.js pour le détail complet par palier/type).
// Devient la vraie destination du bouton "Profil" de la nav mobile basse du
// thème premium (js/theme-premium-eleve.js), à la place de
// tableau-de-bord.html.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperProfilEleve(profil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const { data: fiche } = await supabaseClient.from('eleves').select('mascotte, classe_id').eq('id', profil.id).maybeSingle();
  const mascotte = fiche?.mascotte || '🦁';

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).maybeSingle();
    nomClasse = classe?.nom || '';
  }

  const [{ data: etoiles }, { data: compteurs }] = await Promise.all([
    supabaseClient.from('etoiles_eleve').select('total').eq('eleve_id', profil.id).maybeSingle(),
    supabaseClient.from('compteurs_badges_paliers').select('total').eq('eleve_id', profil.id),
  ]);
  const totalEtoiles = etoiles?.total || 0;
  // Total "toutes récompenses de paliers confondues" (médailles + badges
  // spéciaux + trophées, tous paliers) — le détail par type/palier reste sur
  // pages/eleve/badges.html, lien fourni ci-dessous.
  const totalBadges = (compteurs || []).reduce((somme, c) => somme + (c.total || 0), 0);

  document.getElementById('contenu').innerHTML = `
    <div class="profil-carte-identite">
      <div class="profil-avatar-grand">${mascotte}</div>
      <h1>${echapperProfilEleve(profil.prenom)}</h1>
      ${nomClasse ? `<p class="profil-classe">Classe : ${echapperProfilEleve(nomClasse)}</p>` : ''}
    </div>

    <div class="section-title-eleve">🏆 Mes récompenses</div>
    <div class="grille-totaux-profil">
      <div class="carte-total-profil">⭐<div class="valeur-total-profil">${totalEtoiles}</div><div>Étoile${totalEtoiles > 1 ? 's' : ''}</div></div>
      <div class="carte-total-profil">🏅<div class="valeur-total-profil">${totalBadges}</div><div>Badge${totalBadges > 1 ? 's' : ''}</div></div>
    </div>
    <a href="badges.html" class="btn btn-discret" style="display:inline-block;margin-top:14px">Voir le détail de mes badges</a>
  `;
})();

function echapperProfilEleve(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
