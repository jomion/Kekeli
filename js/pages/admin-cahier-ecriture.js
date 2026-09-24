// Page pages/admin/cahier-ecriture.html
//
// 24 septembre 2026 : cahier d'écriture personnel de l'administrateur
// (généralisation à tous les rôles — voir js/cahier-ecriture-partage.js).
// Sauvegarde cloud gratuite et illimitée pour ce rôle (pas de service
// Premium personnel pour les comptes adultes/staff).

let profilCahierAdmin = null;

(async function () {
  profilCahierAdmin = await requireAdmin();
  if (!profilCahierAdmin) return;
  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilCahierAdmin.id,
    badgeHtml: `${profilCahierAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperCahierAdmin(profilCahierAdmin.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilCahierAdmin.est_super_admin })
  });
  await initialiserCahierEcriturePartage(profilCahierAdmin, { estEleve: false });
})();

function echapperCahierAdmin(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
