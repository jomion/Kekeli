// Page pages/eleve/tableau-de-bord.html

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom}`;

  const { data: fiche } = await supabaseClient.from('eleves').select('mascotte, classe_id').eq('id', profil.id).single();
  const mascotte = fiche?.mascotte || '🦁';

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).single();
    nomClasse = classe?.nom || '';
  }

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue carte-bienvenue-eleve">
      <div class="mascotte-eleve">${mascotte}</div>
      <h1>Bonjour, ${profil.prenom} !</h1>
      <p>${nomClasse ? `Bienvenue dans ton espace ${nomClasse}.` : 'Bienvenue dans ton espace KEKELI.'}</p>
    </div>

    <div class="grille-actions-tb">
      <a href="../navigation.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit">
        <div class="icone-action-tb">📖</div>
        <h3>Mes cours</h3>
        <p>Découvrir les leçons de ta classe.</p>
      </a>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">🎯</div>
        <h3>Mes badges</h3>
        <p>Bientôt disponible.</p>
      </div>
      <a href="devoirs-notes.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">📊</div>
        <h3>Mes notes et devoirs</h3>
        <p>Voir mes devoirs à rendre et mes notes.</p>
      </a>
    </div>
  `;
})();
