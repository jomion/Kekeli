// Page pages/parent/tableau-de-bord.html

(async function () {
  const profil = await requireRole('parent');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom} ${profil.nom}`;

  const { data: enfants } = await supabaseClient
    .from('parent_eleve')
    .select('eleve_id, profils:eleve_id(prenom, nom)')
    .eq('parent_id', profil.id);

  const listeEnfants = (enfants && enfants.length > 0)
    ? enfants.map(e => `<li>${e.profils?.prenom || ''} ${e.profils?.nom || ''}</li>`).join('')
    : `<li>Aucun enfant inscrit pour l'instant.</li>`;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profil.prenom} !</h1>
      <p>Voici votre espace parent KEKELI.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">Mes enfants</h1>
      <ul style="color:var(--text-gris);padding-left:20px">${listeEnfants}</ul>
    </div>

    <div class="grille-actions-tb">
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">➕</div>
        <h3>Inscrire un enfant</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">📊</div>
        <h3>Suivi des devoirs et notes</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie enseignant</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💳</div>
        <h3>Paiement des frais</h3>
        <p>Bientôt disponible.</p>
      </div>
    </div>
  `;
})();
