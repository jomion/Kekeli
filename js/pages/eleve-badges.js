// Page pages/eleve/badges.html
// Affiche les badges obtenus par l'élève via le système de paliers de
// séance : logos standard (par question réussie), médailles spéciales et
// trophées d'excellence (par palier réussi), alimentés par
// compteurs_badges_paliers (voir attribuer_badges_taches/
// recalculer_paliers_seance côté base) et les étoiles (etoiles_eleve, par
// tâche réussie — même compteur que la pastille de la barre du haut, voir
// js/theme-premium-eleve.js).
//
// L'ancien catalogue de badges (tables badges/badges_eleves, création et
// attribution manuelles ou règles automatiques génériques) a été retiré le
// 11 septembre 2026 à la demande du porteur du projet ("trop de badge
// devient ennuyeux") : un seul système de récompenses reste visible côté
// élève, celui des paliers ci-dessus.

const LIBELLES_PALIER_BADGES = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const COULEURS_PALIER_BADGES = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#9A3412', axosu: '#B91C1C' };
// Un palier réussi donne toujours la médaille/le trophée de SA propre
// couleur (cahier des charges : Azɔ̀ví → Bronze, Dèví → Argent, Ògán → Or,
// Axɔ́sú → Diamant) — même correspondance que calculer_medaille() côté base.
// Depuis le 11 septembre 2026 (photos fournies par le porteur du projet) :
// une vraie coupe (bronze/argent/or/diamant) au lieu d'un emoji — voir
// assets/badges/medaille-*.jpg et RACINE_SITE (défini par chaque page HTML).
const MEDAILLE_PAR_PALIER = { azovi: 'Bronze', devi: 'Argent', ogan: 'Or', axosu: 'Diamant' };
const IMAGE_MEDAILLE_PAR_PALIER = { azovi: 'medaille-bronze.jpg', devi: 'medaille-argent.jpg', ogan: 'medaille-or.jpg', axosu: 'medaille-diamant.jpg' };

// Petites icônes <img> réutilisées à plusieurs endroits de la page — voir
// les images fournies le 11 septembre 2026 (coupes de médailles, gemme pour
// le trophée d'excellence, badge métallique pour le logo standard).
function iconeBadgeImgMat(fichier, taille, alt) {
  return `<img src="${RACINE_SITE}assets/badges/${fichier}" alt="${alt || ''}" width="${taille}" height="${taille}" class="icone-badge-img-mat" loading="lazy">`;
}

let filtrePalierBadges = 'tous';
let compteursBadgesParPalier = {}; // palier -> { logo_standard, medaille_speciale, trophee_excellence }
let totalEtoilesBadges = 0;

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperBadgesEleve(profil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const [{ data: compteurs }, { data: etoiles }] = await Promise.all([
    supabaseClient.from('compteurs_badges_paliers').select('palier, type_badge, total').eq('eleve_id', profil.id),
    supabaseClient.from('etoiles_eleve').select('total').eq('eleve_id', profil.id).maybeSingle(),
  ]);
  totalEtoilesBadges = etoiles?.total || 0;
  (compteurs || []).forEach(c => {
    (compteursBadgesParPalier[c.palier] ??= { logo_standard: 0, medaille_speciale: 0, trophee_excellence: 0 })[c.type_badge] = c.total;
  });

  rendreBadges();
})();

function echapperBadgesEleve(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Totaux "toute matière confondue" pour un type de badge donné — soit sur
// TOUS les paliers (filtre "tous", demande explicite du cahier des
// charges : "le nombre total de chaque type de badge s'affiche toute
// matière confondue"), soit restreints à un seul palier quand l'élève a
// choisi un filtre (même demande : "Prévois ... des filtres si l'enfant
// veut consulter le nombre de badge par un niveau donné").
function totalBadgeType(type) {
  const paliers = filtrePalierBadges === 'tous' ? Object.keys(LIBELLES_PALIER_BADGES) : [filtrePalierBadges];
  return paliers.reduce((somme, p) => somme + (compteursBadgesParPalier[p]?.[type] || 0), 0);
}

function rendreBadges() {
  const totalLogos = totalBadgeType('logo_standard');
  const totalMedailles = totalBadgeType('medaille_speciale');
  const totalTrophees = totalBadgeType('trophee_excellence');
  // Logo et trophée ont chacun UNE seule image, quel que soit le palier ;
  // la médaille dépend de la couleur du palier — on n'affiche l'image
  // réelle que si un palier précis est sélectionné (sinon le total mélange
  // les 4 couleurs, donc on garde l'emoji générique 🎖️).
  const iconeMedailleTop = filtrePalierBadges !== 'tous'
    ? iconeBadgeImgMat(IMAGE_MEDAILLE_PAR_PALIER[filtrePalierBadges], 34, MEDAILLE_PAR_PALIER[filtrePalierBadges]) : '🎖️';

  const boutonsFiltre = ['tous', ...Object.keys(LIBELLES_PALIER_BADGES)].map(p => {
    const libelle = p === 'tous' ? 'Tous les paliers' : LIBELLES_PALIER_BADGES[p];
    const actif = filtrePalierBadges === p;
    return `<button type="button" class="btn ${actif ? 'btn-filled' : 'btn-discret'} bouton-filtre-palier-badges" data-filtre-palier-badges="${p}" style="${actif && p !== 'tous' ? `background:${COULEURS_PALIER_BADGES[p]};border-color:${COULEURS_PALIER_BADGES[p]}` : ''}">${libelle}</button>`;
  }).join('');

  // Détail par palier — uniquement quand un palier précis est sélectionné
  // (la vue "Tous les paliers" reste un simple total, sans répétition).
  const detailParPalier = filtrePalierBadges !== 'tous' ? (() => {
    const p = filtrePalierBadges;
    const c = compteursBadgesParPalier[p] || {};
    return `<div class="carte-detail-palier-badges" style="border-left-color:${COULEURS_PALIER_BADGES[p]}">
      <div class="bloc-lecture-titre" style="color:${COULEURS_PALIER_BADGES[p]}">${LIBELLES_PALIER_BADGES[p]}</div>
      <p style="margin:6px 0 0;color:var(--text-gris);font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${iconeBadgeImgMat('logo-standard.jpg', 20, 'Logo')} ${c.logo_standard || 0} logo${(c.logo_standard || 0) > 1 ? 's' : ''}
        · ${iconeBadgeImgMat(IMAGE_MEDAILLE_PAR_PALIER[p], 20, MEDAILLE_PAR_PALIER[p])} ${MEDAILLE_PAR_PALIER[p]} × ${c.medaille_speciale || 0}
        · ${iconeBadgeImgMat('trophee-excellence.jpg', 20, 'Trophée')} ${c.trophee_excellence || 0} trophée${(c.trophee_excellence || 0) > 1 ? 's' : ''} d'excellence
      </p>
    </div>`;
  })() : '';

  const totalToutesRecompenses = totalEtoilesBadges + totalLogos + totalMedailles + totalTrophees;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>🎯 Mes badges</h1>
      <p>${totalToutesRecompenses > 0 ? `Tu as déjà récolté ${totalToutesRecompenses} récompense${totalToutesRecompenses > 1 ? 's' : ''} — continue comme ça !` : "Continue tes efforts, tes badges arrivent vite !"}</p>
    </div>

    <div class="section-title-eleve">🎯 Badges des paliers</div>
    <div class="grille-totaux-badges-paliers">
      <div class="carte-total-badge-palier">⭐<div class="valeur-total-badge-palier">${totalEtoilesBadges}</div><div>Étoile${totalEtoilesBadges > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">${iconeBadgeImgMat('logo-standard.jpg', 34, 'Logo')}<div class="valeur-total-badge-palier">${totalLogos}</div><div>Logo${totalLogos > 1 ? 's' : ''} de palier</div></div>
      <div class="carte-total-badge-palier">${iconeMedailleTop}<div class="valeur-total-badge-palier">${totalMedailles}</div><div>Médaille${totalMedailles > 1 ? 's' : ''} spéciale${totalMedailles > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">${iconeBadgeImgMat('trophee-excellence.jpg', 34, 'Trophée')}<div class="valeur-total-badge-palier">${totalTrophees}</div><div>Trophée${totalTrophees > 1 ? 's' : ''} d'excellence</div></div>
    </div>
    <div class="filtres-palier-badges">${boutonsFiltre}</div>
    ${detailParPalier}
  `;

  document.querySelectorAll('[data-filtre-palier-badges]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtrePalierBadges = btn.dataset.filtrePalierBadges;
      rendreBadges();
    });
  });
}
