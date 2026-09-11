// Page pages/admin/badges.html
// Vue en LECTURE SEULE du système de récompenses affiché aux élèves :
// étoiles, médailles de palier, badges spéciaux, trophées d'excellence et
// pierres diamant — tables etoiles_eleve/compteurs_badges_paliers, alimentées
// automatiquement par attribuer_badges_taches()/recalculer_paliers_seance()
// côté base (voir js/pages/eleve-badges.js pour l'affichage élève, dont
// cette page reprend exactement les icônes et couleurs).
//
// Remplace l'ancien catalogue de badges (création manuelle de badges +
// règles automatiques génériques, attribution à la main par un enseignant/
// admin — tables badges/badges_eleves) : retiré de la base le 11/09/2026 à
// la demande explicite du porteur du projet ("Garde uniquement les
// nouveaux badges et supprimes tous les anciens. trop de badge devient
// ennuyeux"). Il n'existe donc plus qu'UN SEUL système de récompenses, et
// il est entièrement automatique : rien à créer, activer ou attribuer ici.
//
// Nomenclature (cahier des charges précis reçu le 11 septembre 2026, avec
// une image par nom — "les noms des médailles et trophée que tu dois
// utiliser à chaque niveau est conforme au nom de son image correspondante")
// — colonne type_badge de compteurs_badges_paliers inchangée, seuls les
// libellés/images affichés changent :
//   - logo_standard      → "Badge standard" : décerne des medaille_<palier>.
//   - medaille_speciale  → "Badges spéciaux" : décerne des badge_<couleur>.
//   - trophee_excellence → "Badge d'excellence" : décerne des trophee_<couleur>.
//   - pierre_diamant (pas un type_badge, calculé à part par
//     racine_a_pierres_rouges) : 5 pierres sur la carte de la matière.

const LIBELLES_PALIER_ADMIN_BADGES = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const NOM_COULEUR_ADMIN_BADGES = { azovi: 'Bronze', devi: 'Argent', ogan: 'Or', axosu: 'Diamant' };
const IMAGE_MEDAILLE_PALIER_ADMIN_BADGES = { azovi: 'medaille-azovi.jpg', devi: 'medaille-devi.jpg', ogan: 'medaille-ogan.jpg', axosu: 'medaille-axosu.jpg' };
const IMAGE_BADGE_PALIER_ADMIN_BADGES = { azovi: 'badge-bronze.jpg', devi: 'badge-argent.jpg', ogan: 'badge-or.jpg', axosu: 'badge-diamant.jpg' };
const IMAGE_TROPHEE_PALIER_ADMIN_BADGES = { azovi: 'trophee-bronze.jpg', devi: 'trophee-argent.jpg', ogan: 'trophee-or.jpg', axosu: 'trophee-diamant.jpg' };

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
// assets/badges/, fournies le 11 septembre 2026) — cliquables (loupe en
// grand, voir js/loupe-badge.js) ; pas de "nombre collecté" sur cette page
// de référence (lecture seule, aucun élève précis), donc pas de compteur.
function iconeBadgeAdmin(fichier, taille, alt) {
  return `<img src="${RACINE_SITE}assets/badges/${fichier}" alt="${alt || ''}" width="${taille}" height="${taille}" style="display:block;margin:0 auto;object-fit:contain;border-radius:8px;cursor:pointer" data-loupe-badge="${fichier}" data-loupe-titre="${echapperBadgesAdmin(alt || '')}" tabindex="0" role="button">`;
}

function rendreBadges() {
  document.getElementById('contenu').innerHTML = `
    <p class="sous-titre-page" style="margin-top:-10px">
      Ce système est entièrement automatique : aucun badge ne se crée ni ne s'attribue à la main, il n'y a donc rien à gérer ici. Cette page reflète exactement les récompenses affichées à l'élève sur sa page « Mes badges » (clique sur une image pour l'agrandir).
    </p>

    <div class="grille-badges-admin">
      <div class="carte-badge-admin">
        <div class="icone-badge-admin">⭐</div>
        <h4>Étoile</h4>
        <p class="regle-badge-admin">Attribuée par tâche (question) réussie, à l'intérieur d'un bloc noté rattaché à un palier.</p>
        <ul class="conditions-badge-admin">
          <li>+2 étoiles si la tâche est réussie dès le 1er essai.</li>
          <li>+1 étoile si elle n'est réussie qu'au 2e essai (pas déjà au 1er).</li>
          <li>Le 3e essai ne donne accès à aucune étoile.</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">🎖️</div>
        <h4>Badge standard</h4>
        <p class="regle-badge-admin">Une médaille de palier (medaille_azovi/devi/ogan/axosu — une par palier, voir images ci-dessous) est attribuée à chaque question réussie à l'intérieur du palier concerné.</p>
        <ul class="conditions-badge-admin">
          <li>+2 médailles du palier si la question est réussie dès le 1er essai.</li>
          <li>+1 médaille du palier si elle n'est réussie qu'au 2e essai.</li>
          <li>Le 3e essai ne donne accès à aucun badge.</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">🏅</div>
        <h4>Badges spéciaux</h4>
        <p class="regle-badge-admin">Un badge (badge_bronze/argent/or/diamant, voir images ci-dessous) est attribué quand un palier entier d'une séance est validé (taux de réussite ≥ 66,7 % sur l'ensemble de ses blocs notés, sans consultation du corrigé avant validation).</p>
        <ul class="conditions-badge-admin">
          <li>+2 badges si le palier est validé dès le 1er essai.</li>
          <li>+1 badge s'il n'est validé qu'au 2e essai.</li>
          <li>La couleur du badge dépend du palier validé (voir tableau ci-dessous).</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">🏆</div>
        <h4>Badge d'excellence</h4>
        <p class="regle-badge-admin">Un trophée (trophee_bronze/argent/or/diamant, voir images ci-dessous) est attribué EN PLUS du badge spécial quand un palier est validé dès le 1er essai UNIQUEMENT, avec un taux de réussite ≥ 90 %.</p>
        <ul class="conditions-badge-admin">
          <li>Exactement 1 trophée (jamais 2, même au 1er essai).</li>
          <li>Ne s'obtient jamais au 2e essai, même avec un taux ≥ 90 %.</li>
          <li>La couleur du trophée dépend du palier validé (voir tableau ci-dessous).</li>
        </ul>
      </div>

      <div class="carte-badge-admin">
        <div class="icone-badge-admin">${iconeBadgeAdmin('pierre-diamant.jpg', 40, 'Pierre diamant')}</div>
        <h4>Pierre diamant</h4>
        <p class="regle-badge-admin">Autre recommandation : 5 pierres diamant s'affichent sur la carte de la matière quand TOUS ses paliers sont validés à au moins 66,7 % (même racine que ci-dessus : Thème pour le français, Dossier pour les mathématiques).</p>
      </div>
    </div>

    <div class="titre-cycle">Médailles de palier (badge standard, par question)</div>
    <div class="grille-medailles-admin">
      ${Object.entries(LIBELLES_PALIER_ADMIN_BADGES).map(([code, libelle]) => `
        <div class="carte-medaille-admin">
          ${iconeBadgeAdmin(IMAGE_MEDAILLE_PALIER_ADMIN_BADGES[code], 40, `Médaille ${libelle.replace(/^\S+ /, '')}`)}
          <div style="font-weight:700;margin-top:6px">${libelle}</div>
        </div>`).join('')}
    </div>

    <div class="titre-cycle">Badges spéciaux (≥ 66,7 % du palier)</div>
    <div class="grille-medailles-admin">
      ${Object.entries(LIBELLES_PALIER_ADMIN_BADGES).map(([code, libelle]) => `
        <div class="carte-medaille-admin">
          ${iconeBadgeAdmin(IMAGE_BADGE_PALIER_ADMIN_BADGES[code], 40, `Badge ${NOM_COULEUR_ADMIN_BADGES[code]}`)}
          <div style="font-weight:700;margin-top:6px">${libelle}</div>
          <div style="font-size:12px;color:var(--texte-gris)">Badge ${NOM_COULEUR_ADMIN_BADGES[code]}</div>
        </div>`).join('')}
    </div>

    <div class="titre-cycle">Trophées d'excellence (≥ 90 %, 1er essai uniquement)</div>
    <div class="grille-medailles-admin">
      ${Object.entries(LIBELLES_PALIER_ADMIN_BADGES).map(([code, libelle]) => `
        <div class="carte-medaille-admin">
          ${iconeBadgeAdmin(IMAGE_TROPHEE_PALIER_ADMIN_BADGES[code], 40, `Trophée ${NOM_COULEUR_ADMIN_BADGES[code]}`)}
          <div style="font-weight:700;margin-top:6px">${libelle}</div>
          <div style="font-size:12px;color:var(--texte-gris)">Trophée ${NOM_COULEUR_ADMIN_BADGES[code]}</div>
        </div>`).join('')}
    </div>
  `;
}

function echapperBadgesAdmin(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
