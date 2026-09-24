// Page pages/parent/cahier-ecriture.html
//
// 24 septembre 2026 : cahier d'écriture personnel du parent (généralisation
// du cahier d'écriture à tous les rôles — voir js/cahier-ecriture-partage.js
// pour la logique partagée : sélecteur de classe/réglure, iframe de l'outil
// Seyes/Éducajou, sauvegarde cloud). Contrairement à l'élève, la sauvegarde
// cloud est ici GRATUITE ET ILLIMITÉE (pas de système de facturation Premium
// personnel pour les comptes adultes/staff sur cette plateforme).

let profilCahierParent = null;

(async function () {
  profilCahierParent = await requireRole('parent');
  if (!profilCahierParent) return;
  await initEnteteNavigation({
    role: 'parent', utilisateurId: profilCahierParent.id, badgeHtml: `🟢 ${echapperCahierParent(profilCahierParent.prenom)}`,
    liens: liensAvecPrefixe('parent', '')
  });
  await initialiserCahierEcriturePartage(profilCahierParent, { estEleve: false });
})();

function echapperCahierParent(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
