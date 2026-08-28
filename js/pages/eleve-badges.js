// Page pages/eleve/badges.html
// Affiche les badges obtenus par l'élève (automatiques via evaluer_badges_auto,
// ou attribués à la main par un enseignant/administrateur).

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;

  const { data: attributions } = await supabaseClient
    .from('badges_eleves').select('*, badges(*)').eq('eleve_id', profil.id).order('attribue_le', { ascending: false });
  const liste = (attributions || []).filter(a => a.badges);

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>🎯 Mes badges</h1>
      <p>${liste.length ? `Tu as obtenu ${liste.length} badge${liste.length > 1 ? 's' : ''} — continue comme ça !` : "Tu n'as pas encore de badge — continue tes efforts, ils arrivent vite !"}</p>
    </div>

    ${liste.length ? `<div class="grille-mes-badges">
      ${liste.map(a => `
        <div class="carte-mon-badge">
          <div class="icone-mon-badge">${echapperBadgesEleve(a.badges.icone)}</div>
          <h4>${echapperBadgesEleve(a.badges.nom)}</h4>
          <p>${echapperBadgesEleve(a.badges.description)}</p>
          <div class="date-mon-badge">Obtenu le ${new Date(a.attribue_le).toLocaleDateString('fr-FR')}</div>
        </div>`).join('')}
    </div>` : ''}
  `;
})();

function echapperBadgesEleve(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
