// Page pages/admin/badges.html
// Vue en LECTURE SEULE (réécriture du 11 septembre 2026) du système de
// récompenses affiché aux élèves : étoiles, logos de palier, médailles
// spéciales et trophées d'excellence — tables etoiles_eleve/
// compteurs_badges_paliers, alimentées automatiquement par
// attribuer_badges_taches()/recalculer_paliers_seance() côté base (voir
// js/pages/eleve-badges.js pour l'affichage élève, dont cette page reprend
// exactement les icônes et couleurs).
//
// Remplace l'ancien catalogue de badges (création manuelle de badges +
// règles automatiques génériques, attribution à la main par un enseignant/
// admin — tables badges/badges_eleves) : retiré de la base le 11/09/2026 à
// la demande explicite du porteur du projet ("Garde uniquement les
// nouveaux badges et supprimes tous les anciens. trop de badge devient
// ennuyeux"). Il n'existe donc plus qu'UN SEUL système de récompenses, et
// il est entièrement automatique : rien à créer, activer ou attribuer ici.

const LIBELLES_PALIER_ADMIN_BADGES = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const MEDAILLE_PAR_PALIER_ADMIN_BADGES = { azovi: 'Bronze', devi: 'Argent', ogan: 'Or', axosu: 'Diamant' };
const IMAGE_MEDAILLE_PAR_PALIER_ADMIN_BADGES = { azovi: 'medaille-bronze.jpg', devi: 'medaille-argent.jpg', ogan: 'medaille-or.jpg', axosu: 'medaille-diamant.jpg' };

async function init() {
  const profilAdminBadges = await requireAdmin();
  if (!profilAdminBadges) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminBadges.id,
    badgeHtml: `${profilAdminBadges.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperBadgesAdmin(profilAdminBadges.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminBadges.est_super_admin })
  });

  rendreBadges();
}

// Petites icônes <img> réutilisant les mêmes photos que côté élève (voir
// assets/badges/, fournies le 11 septembre 2026).
function iconeBadgeAdmin(fichier, taille, alt) {
  return `<img src="${RACINE_SITE}assets/badges/${fichier}" alt="${alt || ''}" width="${taille}" height="${taille}" style="display:block;margin:0 auto;object-fit:contain;border-radius:8px">`;
}

function rendreBadges() {
  document.getElementById('contenu').innerHTML = `
    <p class="sous-titre-page" style="margin-top:-10px">
      Ce système est entièrement automatique : aucun badge ne se crée ni ne s'attribue à la main, il n'y a donc rien à gérer ici. Cette page reflète exactement les récompenses affichées à l'élève sur sa page « Mes badges ».
    </p>

    <div class="grille-badges-admin">
      <div class="carte-badge-admin">
        <div class="icone-badge-admin">⭐</div>
        <h4>Étoile</h4>
        <p class="regle-badge-admin">Attribuée par tâche (question) réussie, à l'intérieur d'un bloc noté rattaché à un palier.</p>
        <ul class="conditions-badge-admin">
          <li>+2 étoiles si la tâche est réussie dès le 1er essai.</li>
          <li>+1 étoile si elle n'est réussie qu'au 2e essai (pas déjà au 1er).</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">${iconeBadgeAdmin('logo-standard.jpg', 48, 'Logo')}</div>
        <h4>Logo de palier</h4>
        <p class="regle-badge-admin">Attribué par bloc noté entièrement réussi (100% des tâches du bloc).</p>
        <ul class="conditions-badge-admin">
          <li>+2 logos si le bloc est réussi dès le 1er essai.</li>
          <li>+1 logo s'il n'est réussi qu'au 2e essai.</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">🎖️</div>
        <h4>Médaille spéciale</h4>
        <p class="regle-badge-admin">Attribuée quand un palier entier d'une séance est validé (taux de réussite ≥ 66,7 % sur l'ensemble de ses blocs notés, sans consultation du corrigé avant validation).</p>
        <ul class="conditions-badge-admin">
          <li>+2 médailles si le palier est validé dès le 1er essai.</li>
          <li>+1 médaille s'il n'est validé qu'au 2e essai.</li>
          <li>La couleur dépend du palier validé (voir tableau ci-dessous).</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">${iconeBadgeAdmin('trophee-excellence.jpg', 48, 'Trophée')}</div>
        <h4>Trophée d'excellence</h4>
        <p class="regle-badge-admin">Attribué en plus de la médaille quand un palier est validé dès le 1er essai avec un taux de réussite ≥ 90 %.</p>
      </div>
    </div>

    <div class="titre-cycle">Couleur de la médaille selon le palier</div>
    <div class="grille-medailles-admin">
      ${Object.entries(LIBELLES_PALIER_ADMIN_BADGES).map(([code, libelle]) => `
        <div class="carte-medaille-admin">
          ${iconeBadgeAdmin(IMAGE_MEDAILLE_PAR_PALIER_ADMIN_BADGES[code], 40, MEDAILLE_PAR_PALIER_ADMIN_BADGES[code])}
          <div style="font-weight:700;margin-top:6px">${libelle}</div>
          <div style="font-size:12px;color:var(--texte-gris)">${MEDAILLE_PAR_PALIER_ADMIN_BADGES[code]}</div>
        </div>`).join('')}
    </div>
  `;
}

function echapperBadgesAdmin(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
