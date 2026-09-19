// Page pages/eleve/badges.html
// Affiche les badges obtenus par l'élève via le système de paliers de
// séance, alimenté par compteurs_badges_paliers (voir attribuer_badges_taches/
// recalculer_paliers_seance côté base) et les étoiles (etoiles_eleve, par
// tâche réussie — même compteur que la pastille de la barre du haut, voir
// js/theme-premium-eleve.js). AUCUN changement de base de données pour cette
// page : compteurs_badges_paliers a toujours stocké palier + type_badge
// séparément (logo_standard/medaille_speciale/trophee_excellence), ce qui
// suffisait déjà à la granularité demandée ci-dessous.
//
// Refonte du 11 septembre 2026 (nomenclature + images précises fournies par
// le porteur du projet, cahier des charges strict — "les noms des médailles
// et trophée que tu dois utiliser à chaque niveau est conforme au nom de son
// image correspondante") :
//   - logo_standard      → « Médaille de palier » : medaille_azovi/devi/ogan/
//     axosu (icône propre à chaque palier : pousse/djembé/tête de lion/
//     couronne, déjà utilisées comme emoji ailleurs sur le site).
//   - medaille_speciale  → « Badge spécial » : badge_bronze/argent/or/diamant
//     (icône carrée plate), attribué quand le palier entier est validé
//     (≥ 66,7 %).
//   - trophee_excellence → « Trophée d'excellence » : trophee_bronze/argent/
//     or/diamant (vraie coupe), attribué en plus du badge quand le palier est
//     validé dès le 1er essai avec ≥ 90 %.
// Ne concerne QUE l'affichage : les règles d'attribution exactes n'ont pas
// changé (voir js/pages/admin-badges.js pour le détail texte).
//
// L'ancien catalogue de badges (tables badges/badges_eleves, création et
// attribution manuelles ou règles automatiques génériques) a été retiré le
// 11 septembre 2026 à la demande du porteur du projet ("trop de badge
// devient ennuyeux") : un seul système de récompenses reste visible côté
// élève, celui des paliers ci-dessus.
//
// Nouveauté du 11 septembre 2026 : cliquer sur une miniature l'ouvre en grand
// avec le nombre collecté en bas — voir js/loupe-badge.js (ouvrirLoupeBadge),
// chargé sur cette page.

const LIBELLES_PALIER_BADGES = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
// Couleurs mises à jour le 19 septembre 2026 (5e lot) pour rester cohérentes
// avec js/pages/eleve-seance.js (ogan orange, axosu violet — alignées sur
// les couleurs déjà utilisées ailleurs sur le site : tableau de bord, jeux
// éducatifs).
const COULEURS_PALIER_BADGES = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#C2410C', axosu: '#9B59B6' };
// Un palier réussi donne toujours le badge/trophée de SA propre couleur
// (cahier des charges : Azɔ̀ví → Bronze, Dèví → Argent, Ògán → Or, Axɔ́sú →
// Diamant) — même correspondance que calculer_medaille() côté base.
const NOM_COULEUR_PAR_PALIER = { azovi: 'Bronze', devi: 'Argent', ogan: 'Or', axosu: 'Diamant' };

// Une image par palier pour chacun des 3 types de récompense — noms de
// fichiers strictement alignés sur la nomenclature demandée (medaille_<palier>,
// badge_<couleur>, trophee_<couleur>) pour ne plus jamais les mélanger.
const IMAGE_MEDAILLE_PALIER = { azovi: 'medaille-azovi.jpg', devi: 'medaille-devi.jpg', ogan: 'medaille-ogan.jpg', axosu: 'medaille-axosu.jpg' };
const IMAGE_BADGE_PALIER = { azovi: 'badge-bronze.jpg', devi: 'badge-argent.jpg', ogan: 'badge-or.jpg', axosu: 'badge-diamant.jpg' };
const IMAGE_TROPHEE_PALIER = { azovi: 'trophee-bronze.jpg', devi: 'trophee-argent.jpg', ogan: 'trophee-or.jpg', axosu: 'trophee-diamant.jpg' };

// Petites icônes <img> réutilisées à plusieurs endroits de la page — chaque
// vignette porte les attributs data-loupe-* qui la rendent cliquable (loupe
// en grand avec le nombre collecté en bas — délégation globale, voir
// js/loupe-badge.js), sauf quand `nombre` est omis (icône générique du
// filtre "Tous les paliers", qui ne représente aucune image précise).
function iconeBadgeImgMat(fichier, taille, alt, { nombre, unite } = {}) {
  const clic = nombre === undefined ? '' : ` data-loupe-badge="${fichier}" data-loupe-titre="${echapperBadgesEleve(alt || '')}" data-loupe-nombre="${nombre}" data-loupe-unite="${echapperBadgesEleve(unite || '')}" style="cursor:pointer" tabindex="0" role="button"`;
  return `<img src="${RACINE_SITE}assets/badges/${fichier}" alt="${alt || ''}" width="${taille}" height="${taille}" class="icone-badge-img-mat"${clic} loading="lazy">`;
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
  const totalMedailles = totalBadgeType('logo_standard');
  const totalBadgesSpeciaux = totalBadgeType('medaille_speciale');
  const totalTrophees = totalBadgeType('trophee_excellence');
  // Chaque type d'image dépend du palier ; on n'affiche l'image réelle que si
  // un palier précis est sélectionné (sinon le total mélange les 4 couleurs,
  // donc on garde une icône générique — non cliquable, elle ne représente
  // aucune image précise).
  const iconeMedailleTop = filtrePalierBadges !== 'tous'
    ? iconeBadgeImgMat(IMAGE_MEDAILLE_PALIER[filtrePalierBadges], 34, `Médaille ${LIBELLES_PALIER_BADGES[filtrePalierBadges].replace(/^\S+ /, '')}`, { nombre: totalMedailles, unite: totalMedailles > 1 ? 'médailles' : 'médaille' })
    : '🎖️';
  const iconeBadgeSpecialTop = filtrePalierBadges !== 'tous'
    ? iconeBadgeImgMat(IMAGE_BADGE_PALIER[filtrePalierBadges], 34, `Badge ${NOM_COULEUR_PAR_PALIER[filtrePalierBadges]}`, { nombre: totalBadgesSpeciaux, unite: totalBadgesSpeciaux > 1 ? 'badges' : 'badge' })
    : '🏅';
  const iconeTropheeTop = filtrePalierBadges !== 'tous'
    ? iconeBadgeImgMat(IMAGE_TROPHEE_PALIER[filtrePalierBadges], 34, `Trophée ${NOM_COULEUR_PAR_PALIER[filtrePalierBadges]}`, { nombre: totalTrophees, unite: totalTrophees > 1 ? 'trophées' : 'trophée' })
    : '🏆';

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
    const nbMedaille = c.logo_standard || 0;
    const nbBadge = c.medaille_speciale || 0;
    const nbTrophee = c.trophee_excellence || 0;
    return `<div class="carte-detail-palier-badges" style="border-left-color:${COULEURS_PALIER_BADGES[p]}">
      <div class="bloc-lecture-titre" style="color:${COULEURS_PALIER_BADGES[p]}">${LIBELLES_PALIER_BADGES[p]}</div>
      <p style="margin:6px 0 0;color:var(--text-gris);font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${iconeBadgeImgMat(IMAGE_MEDAILLE_PALIER[p], 20, `Médaille ${LIBELLES_PALIER_BADGES[p].replace(/^\S+ /, '')}`, { nombre: nbMedaille, unite: nbMedaille > 1 ? 'médailles' : 'médaille' })} ${nbMedaille} médaille${nbMedaille > 1 ? 's' : ''}
        · ${iconeBadgeImgMat(IMAGE_BADGE_PALIER[p], 20, `Badge ${NOM_COULEUR_PAR_PALIER[p]}`, { nombre: nbBadge, unite: nbBadge > 1 ? 'badges' : 'badge' })} Badge ${NOM_COULEUR_PAR_PALIER[p]} × ${nbBadge}
        · ${iconeBadgeImgMat(IMAGE_TROPHEE_PALIER[p], 20, `Trophée ${NOM_COULEUR_PAR_PALIER[p]}`, { nombre: nbTrophee, unite: nbTrophee > 1 ? 'trophées' : 'trophée' })} ${nbTrophee} trophée${nbTrophee > 1 ? 's' : ''} d'excellence
      </p>
    </div>`;
  })() : '';

  const totalToutesRecompenses = totalEtoilesBadges + totalMedailles + totalBadgesSpeciaux + totalTrophees;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>🎯 Mes badges</h1>
      <p>${totalToutesRecompenses > 0 ? `Tu as déjà récolté ${totalToutesRecompenses} récompense${totalToutesRecompenses > 1 ? 's' : ''} — continue comme ça !` : "Continue tes efforts, tes badges arrivent vite !"}</p>
    </div>

    <div class="section-title-eleve">🎯 Badges des paliers</div>
    <div class="grille-totaux-badges-paliers">
      <div class="carte-total-badge-palier">⭐<div class="valeur-total-badge-palier">${totalEtoilesBadges}</div><div>Étoile${totalEtoilesBadges > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">${iconeMedailleTop}<div class="valeur-total-badge-palier">${totalMedailles}</div><div>Médaille${totalMedailles > 1 ? 's' : ''} de palier</div></div>
      <div class="carte-total-badge-palier">${iconeBadgeSpecialTop}<div class="valeur-total-badge-palier">${totalBadgesSpeciaux}</div><div>Badge${totalBadgesSpeciaux > 1 ? 's' : ''} spécia${totalBadgesSpeciaux > 1 ? 'ux' : 'l'}</div></div>
      <div class="carte-total-badge-palier">${iconeTropheeTop}<div class="valeur-total-badge-palier">${totalTrophees}</div><div>Trophée${totalTrophees > 1 ? 's' : ''} d'excellence</div></div>
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
