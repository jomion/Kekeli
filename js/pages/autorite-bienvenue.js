// Page pages/autorite/bienvenue.html — écran d'accueil pour le rôle
// "Autorité Pédagogique" (Directeur, Conseiller Pédagogique, Inspecteur,
// Directeur Départemental). Pour l'instant, un espace dédié avec tableau
// de bord (suivi des écoles/enseignants selon la fonction) n'existe pas
// encore — cette page ne fait que confirmer l'inscription et récapituler
// les informations enregistrées, en attendant ce développement à venir.

const LIBELLES_FONCTION_AUTORITE = {
  directeur: 'Directeur',
  conseiller_pedagogique: 'Conseiller Pédagogique',
  inspecteur: 'Inspecteur',
  directeur_departemental: 'Directeur Départemental'
};

(async function () {
  const profil = await requireRole('autorite_pedagogique');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom} ${profil.nom}`;

  const { data: autorite } = await supabaseClient.from('autorites_pedagogiques').select('*').eq('id', profil.id).single();
  const libelleFonction = LIBELLES_FONCTION_AUTORITE[autorite?.fonction] || autorite?.fonction || '';

  const lignesLocalisation = [
    ['Département', profil.departement],
    ['Commune', profil.commune],
    ['Circonscription Scolaire', autorite?.circonscription_scolaire],
    ['Zone Pédagogique', autorite?.zone_pedagogique],
    ['École', autorite?.ecole]
  ].filter(([, valeur]) => valeur);

  document.getElementById('contenu').innerHTML = `
    <div class="welcome-card-eleve theme-autorite">
      <div class="mascot-avatar-eleve theme-autorite">🏛️</div>
      <h1 style="color:#6D28D9;margin:0 0 8px">Bienvenue, ${echapperAutoriteBv(profil.prenom)} !</h1>
      <p style="color:var(--text-gris);margin:0 0 4px">${echapperAutoriteBv(libelleFonction)}</p>
      <p style="color:var(--text-gris);font-size:13px;margin-top:14px">
        Votre espace « Autorité Pédagogique » est en cours de construction — le suivi des écoles,
        enseignants et séances selon votre fonction sera bientôt disponible ici. Votre compte est
        bien créé et vos informations enregistrées.
      </p>
    </div>

    ${lignesLocalisation.length ? `
      <div class="section-title-eleve">Vos informations</div>
      <div class="welcome-card-eleve theme-autorite" style="padding:20px">
        ${lignesLocalisation.map(([libelle, valeur]) => `
          <p style="margin:0 0 8px;color:var(--text-dark)"><strong>${echapperAutoriteBv(libelle)} :</strong> ${echapperAutoriteBv(valeur)}</p>
        `).join('')}
      </div>
    ` : ''}
  `;
})();

function echapperAutoriteBv(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
