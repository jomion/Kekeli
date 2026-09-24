// Page pages/autorite/cahier-ecriture.html
//
// 24 septembre 2026 : cahier d'écriture personnel de l'autorité pédagogique
// (généralisation à tous les rôles — voir js/cahier-ecriture-partage.js).
// Sauvegarde cloud gratuite et illimitée pour ce rôle (pas de service
// Premium personnel pour les comptes adultes/staff).

let profilCahierAutorite = null;

(async function () {
  profilCahierAutorite = await requireRole('autorite_pedagogique');
  if (!profilCahierAutorite) return;
  await initEnteteNavigation({
    role: 'autorite', utilisateurId: profilCahierAutorite.id,
    badgeHtml: `🟢 ${echapperCahierAutorite(profilCahierAutorite.prenom)} ${echapperCahierAutorite(profilCahierAutorite.nom)}`,
    liens: liensAvecPrefixe('autorite', '')
  });
  await initialiserCahierEcriturePartage(profilCahierAutorite, { estEleve: false });
})();

function echapperCahierAutorite(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
