// Page pages/enseignant/tableau-de-bord.html

(async function () {
  const profil = await requireRole('enseignant');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom} ${profil.nom}`;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profil.prenom} !</h1>
      <p>Votre espace enseignant KEKELI. Le contenu pédagogique reste géré par l'administration —
      cet espace vous permettra de suivre votre classe et vos élèves.</p>
    </div>
    <div class="grille-actions-tb">
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">🏫</div>
        <h3>Ma classe</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">📝</div>
        <h3>Saisir des notes</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">🎥</div>
        <h3>Visioconférence</h3>
        <p>Bientôt disponible.</p>
      </div>
    </div>
  `;
})();
