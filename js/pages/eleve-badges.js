// Page pages/eleve/badges.html
// Affiche les badges obtenus par l'élève : l'ancien catalogue (badges_eleves/
// badges, attribution automatique via evaluer_badges_auto ou manuelle par un
// enseignant/admin), PLUS — depuis le lot "Activité et Paliers / Badges" du
// 11 septembre 2026 — les nouveaux badges liés aux paliers de séance :
// logos standard (par question réussie), médailles spéciales et trophées
// d'excellence (par palier réussi), alimentés par compteurs_badges_paliers
// (voir attribuer_badges_taches/recalculer_paliers_seance côté base) et les
// étoiles (etoiles_eleve, par tâche réussie — même compteur que la pastille
// de la barre du haut, voir js/theme-premium-eleve.js).

const LIBELLES_PALIER_BADGES = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const COULEURS_PALIER_BADGES = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#9A3412', axosu: '#B91C1C' };
// Un palier réussi donne toujours la médaille/le trophée de SA propre
// couleur (cahier des charges : Azɔ̀ví → Bronze, Dèví → Argent, Ògán → Or,
// Axɔ́sú → Diamant) — même correspondance que calculer_medaille() côté base.
const MEDAILLE_PAR_PALIER = { azovi: '🥉 Bronze', devi: '🥈 Argent', ogan: '🥇 Or', axosu: '💎 Diamant' };

let filtrePalierBadges = 'tous';
let compteursBadgesParPalier = {}; // palier -> { logo_standard, medaille_speciale, trophee_excellence }
let totalEtoilesBadges = 0;
let listeBadgesCatalogue = [];

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperBadgesEleve(profil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const [{ data: attributions }, { data: compteurs }, { data: etoiles }] = await Promise.all([
    supabaseClient.from('badges_eleves').select('*, badges(*)').eq('eleve_id', profil.id).order('attribue_le', { ascending: false }),
    supabaseClient.from('compteurs_badges_paliers').select('palier, type_badge, total').eq('eleve_id', profil.id),
    supabaseClient.from('etoiles_eleve').select('total').eq('eleve_id', profil.id).maybeSingle(),
  ]);
  listeBadgesCatalogue = (attributions || []).filter(a => a.badges);
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
      <p style="margin:6px 0 0;color:var(--text-gris);font-size:14px">
        🏷️ ${c.logo_standard || 0} logo${(c.logo_standard || 0) > 1 ? 's' : ''} · ${MEDAILLE_PAR_PALIER[p]} × ${c.medaille_speciale || 0} · 🏆 ${c.trophee_excellence || 0} trophée${(c.trophee_excellence || 0) > 1 ? 's' : ''} d'excellence
      </p>
    </div>`;
  })() : '';

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>🎯 Mes badges</h1>
      <p>${listeBadgesCatalogue.length ? `Tu as obtenu ${listeBadgesCatalogue.length} badge${listeBadgesCatalogue.length > 1 ? 's' : ''} — continue comme ça !` : "Continue tes efforts, tes badges arrivent vite !"}</p>
    </div>

    <div class="section-title-eleve">🎯 Badges des paliers</div>
    <div class="grille-totaux-badges-paliers">
      <div class="carte-total-badge-palier">⭐<div class="valeur-total-badge-palier">${totalEtoilesBadges}</div><div>Étoile${totalEtoilesBadges > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">🏷️<div class="valeur-total-badge-palier">${totalLogos}</div><div>Logo${totalLogos > 1 ? 's' : ''} de palier</div></div>
      <div class="carte-total-badge-palier">🎖️<div class="valeur-total-badge-palier">${totalMedailles}</div><div>Médaille${totalMedailles > 1 ? 's' : ''} spéciale${totalMedailles > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">🏆<div class="valeur-total-badge-palier">${totalTrophees}</div><div>Trophée${totalTrophees > 1 ? 's' : ''} d'excellence</div></div>
    </div>
    <div class="filtres-palier-badges">${boutonsFiltre}</div>
    ${detailParPalier}

    <div class="section-title-eleve" style="margin-top:26px">🏅 Autres badges</div>
    ${listeBadgesCatalogue.length ? `<div class="grille-mes-badges">
      ${listeBadgesCatalogue.map(a => `
        <div class="carte-mon-badge">
          <div class="icone-mon-badge">${echapperBadgesEleve(a.badges.icone)}</div>
          <h4>${echapperBadgesEleve(a.badges.nom)}</h4>
          <p>${echapperBadgesEleve(a.badges.description)}</p>
          <div class="date-mon-badge">Obtenu le ${new Date(a.attribue_le).toLocaleDateString('fr-FR')}</div>
        </div>`).join('')}
    </div>` : '<p style="color:var(--text-gris)">Pas encore de badge dans cette catégorie.</p>'}
  `;

  document.querySelectorAll('[data-filtre-palier-badges]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtrePalierBadges = btn.dataset.filtrePalierBadges;
      rendreBadges();
    });
  });
}
