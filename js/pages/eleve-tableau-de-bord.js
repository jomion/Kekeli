// Page pages/eleve/tableau-de-bord.html

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom}`;
  initClocheNotifications('zoneCloche', profil.id);

  const { data: fiche } = await supabaseClient.from('eleves').select('mascotte, classe_id').eq('id', profil.id).single();
  const mascotte = fiche?.mascotte || '🦁';

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).single();
    nomClasse = classe?.nom || '';
  }

  const { data: abonnements } = await supabaseClient
    .from('abonnements_enseignant_eleve')
    .select('*, enseignants(profils(prenom, nom))')
    .eq('eleve_id', profil.id).eq('statut', 'accepte');
  const enseignantsSuivis = abonnements || [];

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue carte-bienvenue-eleve">
      <div class="mascotte-eleve">${mascotte}</div>
      <h1>Bonjour, ${profil.prenom} !</h1>
      <p>${nomClasse ? `Bienvenue dans ton espace ${nomClasse}.` : 'Bienvenue dans ton espace KEKELI.'}</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">👩‍🏫 Mes enseignants</h1>
      ${enseignantsSuivis.length ? `<ul style="color:var(--text-gris);padding-left:20px">
        ${enseignantsSuivis.map(a => `<li>${a.enseignants?.profils?.prenom || ''} ${a.enseignants?.profils?.nom || ''}</li>`).join('')}
      </ul>` : `<p style="color:var(--text-gris)">Aucun enseignant ne te suit pour l'instant.</p>`}
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
