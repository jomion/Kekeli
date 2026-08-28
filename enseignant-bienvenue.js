// Page pages/enseignant/bienvenue.html — écran d'accueil juste après
// connexion, sur le même principe que pages/eleve/bienvenue.html : accès
// rapide aux tâches du jour plutôt que le tableau de bord complet.

(async function () {
  const profil = await requireRole('enseignant');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom} ${profil.nom}`;
  initClocheNotifications('zoneCloche', profil.id);

  const [{ data: enseignant }, { count: nbEnAttenteActivites }] = await Promise.all([
    supabaseClient.from('enseignants').select('classes_assignees').eq('id', profil.id).single(),
    supabaseClient.from('rendus_activites').select('id', { count: 'exact', head: true }).is('corrige_le', null)
  ]);
  const nbClasses = (enseignant?.classes_assignees || []).length;

  document.getElementById('contenu').innerHTML = `
    <div class="welcome-card-eleve theme-enseignant">
      <div class="mascot-avatar-eleve theme-enseignant">🧑‍🏫</div>
      <h1 style="color:var(--bleu-kekeli);margin:0 0 8px">Bienvenue, ${echapperEnsBv(profil.prenom)} !</h1>
      <p style="color:var(--text-gris);margin:0">${nbClasses ? `Tu gères ${nbClasses} classe${nbClasses > 1 ? 's' : ''}.` : "Aucune classe accordée pour l'instant — demandes-en une depuis ton tableau de bord."}</p>
    </div>

    <div class="section-title-eleve">Que souhaites-tu faire aujourd'hui ?</div>
    <div class="actions-grid-eleve">
      <a href="activites.html" class="action-card-eleve">
        <div class="action-icon-eleve">📝</div>
        <div class="action-title-eleve">Corriger des activités</div>
        <div class="action-desc-eleve">${nbEnAttenteActivites ? `<strong>${nbEnAttenteActivites}</strong> rendu${nbEnAttenteActivites > 1 ? 's' : ''} en attente (tous périmètres confondus).` : 'Rien en attente pour le moment.'}</div>
        <div class="btn-start-eleve" style="background:#3498DB">Corriger 📝</div>
      </a>
      <a href="../navigation.html" class="action-card-eleve">
        <div class="action-icon-eleve">📚</div>
        <div class="action-title-eleve">Contenu pédagogique</div>
        <div class="action-desc-eleve">Consulter et éditer les séances de tes classes.</div>
        <div class="btn-start-eleve" style="background:#2ECC71">Explorer 📚</div>
      </a>
      <a href="tableau-de-bord.html" class="action-card-eleve">
        <div class="action-icon-eleve">🏫</div>
        <div class="action-title-eleve">Mon tableau de bord</div>
        <div class="action-desc-eleve">Tes classes, tes élèves suivis, tes demandes en cours.</div>
        <div class="btn-start-eleve" style="background:var(--bleu-kekeli)">Voir tout 🏫</div>
      </a>
    </div>
  `;
})();

function echapperEnsBv(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
