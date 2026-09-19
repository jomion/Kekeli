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

  await initEnteteNavigation({
    role: 'autorite', utilisateurId: profil.id, badgeHtml: `🟢 ${echapper(profil.prenom)} ${echapper(profil.nom)}`,
    liens: liensAvecPrefixe('autorite', '')
  });

  const { data: autorite } = await supabaseClient.from('autorites_pedagogiques').select('*').eq('id', profil.id).single();
  const libelleFonction = LIBELLES_FONCTION_AUTORITE[autorite?.fonction] || autorite?.fonction || '';

  // 19 septembre 2026 (duotricies) : vues liées — même identifiant de
  // connexion, sélecteur de vue (voir possedeVueLiee/activerVueLiee dans
  // js/auth-utilisateur.js). Une Autorité Pédagogique peut activer une vue
  // parent ET/OU une vue enseignant, indépendamment l'une de l'autre.
  const [aVueParent, aVueEnseignant] = await Promise.all([
    possedeVueLiee(profil.id, 'parent'),
    possedeVueLiee(profil.id, 'enseignant')
  ]);

  const lignesLocalisation = [
    ['Département', profil.departement],
    ['Commune', profil.commune],
    ['Arrondissement', profil.arrondissement],
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

    <div class="section-title-eleve">Vues liées</div>
    <div class="welcome-card-eleve theme-autorite" style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <p style="margin:0;color:var(--text-gris);font-size:13px">
        Activez une vue supplémentaire sous ce même compte (même e-mail, sans vous déconnecter) —
        elle aura exactement les mêmes fonctionnalités qu'un compte habituel de ce rôle.
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>🔀 Vue parent</span>
        ${aVueParent
          ? `<a href="../parent/tableau-de-bord.html" class="btn btn-filled" style="padding:6px 14px;font-size:12px">Ouvrir</a>`
          : `<button class="btn btn-filled" id="btnActiverVueParentAut" style="padding:6px 14px;font-size:12px">Activer</button>`}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>🔀 Vue enseignant</span>
        ${aVueEnseignant
          ? `<a href="../enseignant/tableau-de-bord.html" class="btn btn-filled" style="padding:6px 14px;font-size:12px">Ouvrir</a>`
          : `<button class="btn btn-filled" id="btnActiverVueEnseignantAut" style="padding:6px 14px;font-size:12px">Activer</button>`}
      </div>
    </div>
  `;

  document.getElementById('btnActiverVueParentAut')?.addEventListener('click', async () => {
    const { error } = await activerVueLiee(profil.id, 'parent');
    if (error) return alert(error.message);
    window.location.reload();
  });
  document.getElementById('btnActiverVueEnseignantAut')?.addEventListener('click', async () => {
    const { error } = await activerVueLiee(profil.id, 'enseignant');
    if (error) return alert(error.message);
    window.location.reload();
  });
})();

function echapperAutoriteBv(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
