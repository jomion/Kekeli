// Loupe (agrandissement) réutilisable pour les badges/médailles/trophées
// affichés en miniature — demande du porteur du projet (11 septembre 2026) :
// "si on appuie sur une bage ou trophé il doit se présenter en son entièreté
// et en grand plan avec le nombre collecté en bas". Ne concerne QUE les
// récompenses avec une vraie image (médailles de palier, badges spéciaux,
// trophées d'excellence, pierre diamant) — les étoiles restent un simple
// emoji, inchangées, et n'ouvrent donc jamais cette loupe.
//
// Utilisation : ouvrirLoupeBadge({ src, titre, nombre, unite }).
// - src : chemin complet de l'image (déjà préfixé par RACINE_SITE).
// - titre : nom affiché en haut (ex. "Médaille Azɔ̀ví", "Trophée Or").
// - nombre : le compte à afficher en bas ("Tu en as X") ; omettre (ou null)
//   pour ne pas afficher de compte (ex. page admin, simple référence).
// - unite : mot affiché après le nombre (ex. "médaille"/"médailles") —
//   accorde lui-même le pluriel si besoin.
//
// Chargé sur toutes les pages qui affichent des miniatures de récompenses :
// pages/eleve/badges.html, pages/eleve/matiere.html,
// pages/eleve/tableau-de-bord.html, pages/admin/badges.html. Les styles
// .loupe-badge-* sont définis dans css/style-public.css (élève) et
// css/style.css (admin) — même duplication déjà en place pour .modal-*.
function ouvrirLoupeBadge({ src, titre, nombre = null, unite = '' }) {
  const overlay = document.createElement('div');
  overlay.className = 'loupe-badge-overlay';
  overlay.innerHTML = `
    <div class="loupe-badge-boite">
      <button type="button" class="loupe-badge-fermer" aria-label="Fermer">✕</button>
      ${titre ? `<div class="loupe-badge-titre">${titre}</div>` : ''}
      <img class="loupe-badge-image" src="${src}" alt="${titre || ''}">
      ${nombre !== null && nombre !== undefined ? `<div class="loupe-badge-compteur">Tu en as <strong>${nombre}</strong>${unite ? ' ' + unite : ''} !</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  overlay.querySelector('.loupe-badge-fermer').addEventListener('click', fermer);
  document.addEventListener('keydown', function echapLoupe(e) {
    if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echapLoupe); }
  });
}

// Délégation d'évènements globale : plutôt que de re-brancher un écouteur
// après CHAQUE rendu (les pages qui affichent des badges se re-rendent
// souvent — filtres, changement d'onglet...), il suffit qu'une miniature
// porte les attributs data-loupe-badge/-titre/-nombre/-unite (voir
// js/pages/eleve-badges.js#iconeBadgeImgMat pour le générateur de balisage)
// pour que le clic (ou Entrée/Espace au clavier) ouvre la loupe — aucun
// re-câblage à faire côté page.
document.addEventListener('click', (e) => {
  const cible = e.target.closest('[data-loupe-badge]');
  if (!cible) return;
  ouvrirLoupeBadge({
    src: `${(typeof RACINE_SITE !== 'undefined' && RACINE_SITE) || ''}assets/badges/${cible.dataset.loupeBadge}`,
    titre: cible.dataset.loupeTitre,
    nombre: cible.dataset.loupeNombre,
    unite: cible.dataset.loupeUnite
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const cible = e.target.closest('[data-loupe-badge]');
  if (!cible) return;
  e.preventDefault();
  cible.click();
});
