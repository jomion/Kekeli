// Page pages/admin/badges.html
// Deux volets : (1) créer/activer/désactiver les badges (avec, en option, une
// règle d'attribution automatique — cf. evaluer_badges_auto() en base,
// déclenchée par des triggers sur devoirs_rendus/evaluations/reponses_exercices) ;
// (2) attribuer un badge à la main à un élève.

let profilAdminBadges = null;
let badgesTous = [];
let classesBadges = [];
let classeSelectionneeBadges = null;
let elevesClasseBadges = [];
let attributionsParEleveBadges = {};

const LIBELLES_REGLE_AUTO = {
  '': 'Aucune (attribution manuelle uniquement)',
  devoirs_rendus_a_temps: 'Nombre de devoirs rendus à temps ≥ seuil',
  devoirs_rendus_total: 'Nombre total de devoirs rendus ≥ seuil',
  moyenne_min: 'Moyenne générale (/20) ≥ seuil',
  quiz_reussis: 'Nombre de quiz/exercices réussis (≥50%) ≥ seuil',
  // Ces deux règles existaient déjà côté base (fonction evaluer_badges_auto)
  // mais n'étaient pas proposées ici — corrigé le 04/09/2026, en même temps
  // que la mise en place du catalogue de badges de départ (voir LISEZ-MOI).
  paliers_franchis: 'Nombre de paliers franchis (bloc réussi dans une séance) ≥ seuil',
  medailles_or_diamant: 'Nombre de médailles or/diamant (1er ou 2e essai) ≥ seuil'
};

async function init() {
  profilAdminBadges = await requireAdmin();
  if (!profilAdminBadges) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminBadges.id,
    badgeHtml: `${profilAdminBadges.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperBadges(profilAdminBadges.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminBadges.est_super_admin })
  });

  const [{ data: badges }, { data: classes }] = await Promise.all([
    supabaseClient.from('badges').select('*').order('cree_le'),
    supabaseClient.from('classes').select('*').order('ordre')
  ]);
  badgesTous = badges || [];
  classesBadges = classes || [];

  rendreBadges();
}

function rendreBadges() {
  document.getElementById('contenu').innerHTML = `
    <button class="btn btn-accent" id="btnNouveauBadge" style="margin-bottom:16px">+ Nouveau badge</button>
    <div class="grille-badges">
      ${badgesTous.map(b => `
        <div class="carte-badge ${b.actif ? '' : 'inactif'}">
          <div class="icone-badge">${echapperBadges(b.icone)}</div>
          <h4>${echapperBadges(b.nom)}</h4>
          <p>${echapperBadges(b.description)}</p>
          ${b.regle_auto ? `<div class="regle-badge">⚙️ ${LIBELLES_REGLE_AUTO[b.regle_auto.type] || b.regle_auto.type} (seuil : ${b.regle_auto.seuil})</div>` : ''}
          <div class="actions-badge">
            <button class="btn btn-discret" data-basculer-badge="${b.id}" style="padding:4px 10px;font-size:11px">${b.actif ? 'Désactiver' : 'Activer'}</button>
            <button class="btn btn-danger" data-supprimer-badge="${b.id}" style="padding:4px 10px;font-size:11px">🗑️</button>
          </div>
        </div>`).join('') || '<p class="chargement">Aucun badge créé pour l\'instant.</p>'}
    </div>

    <div class="titre-cycle" style="margin-top:0">Attribution manuelle</div>
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <select id="selectClasseBadges" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Choisir une classe —</option>
        ${classesBadges.map(c => `<option value="${c.id}">${echapperBadges(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div id="zoneElevesBadges"></div>
  `;

  document.getElementById('btnNouveauBadge').addEventListener('click', ouvrirNouveauBadge);
  document.querySelectorAll('[data-basculer-badge]').forEach(btn => {
    btn.addEventListener('click', () => basculerBadge(parseInt(btn.dataset.basculerBadge, 10)));
  });
  document.querySelectorAll('[data-supprimer-badge]').forEach(btn => {
    btn.addEventListener('click', () => supprimerBadge(parseInt(btn.dataset.supprimerBadge, 10)));
  });
  document.getElementById('selectClasseBadges').addEventListener('change', async (e) => {
    classeSelectionneeBadges = e.target.value || null;
    if (classeSelectionneeBadges) await afficherElevesBadges();
    else document.getElementById('zoneElevesBadges').innerHTML = '';
  });
}

function ouvrirNouveauBadge() {
  ouvrirModal({
    titre: 'Nouveau badge',
    champs: [
      { nom: 'nom', label: 'Nom du badge', placeholder: 'Ex : Champion des devoirs' },
      { nom: 'code', label: 'Code unique', placeholder: 'Ex : champion_devoirs' },
      { nom: 'icone', label: 'Icône (emoji)', valeur: '🏅' },
      { nom: 'description', label: 'Description', type: 'textarea', requis: false },
      { nom: 'type_regle', label: 'Règle automatique', type: 'select', requis: false, options: Object.entries(LIBELLES_REGLE_AUTO).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'seuil', label: 'Seuil (si règle automatique choisie)', type: 'number', requis: false }
    ],
    texteValider: 'Créer',
    onValider: async ({ nom, code, icone, description, type_regle, seuil }) => {
      const regle_auto = (type_regle && seuil) ? { type: type_regle, seuil: parseFloat(seuil) } : null;
      const { error } = await supabaseClient.from('badges').insert({
        nom, code: code.trim().toLowerCase().replace(/\s+/g, '_'), icone: icone || '🏅',
        description: description || null, regle_auto, cree_par: profilAdminBadges.id
      });
      if (error) {
        if (error.code === '23505') return alert('Ce code de badge existe déjà.');
        return alert(error.message);
      }
      const { data: badges } = await supabaseClient.from('badges').select('*').order('cree_le');
      badgesTous = badges || [];
      rendreBadges();
    }
  });
}

function basculerBadge(id) {
  const badge = badgesTous.find(b => b.id === id);
  if (!badge) return;
  confirmerAction(`${badge.actif ? 'Désactiver' : 'Activer'} le badge "${badge.nom}" ?`, async () => {
    const { error } = await supabaseClient.from('badges').update({ actif: !badge.actif }).eq('id', id);
    if (error) return alert(error.message);
    badge.actif = !badge.actif;
    rendreBadges();
  });
}

function supprimerBadge(id) {
  confirmerAction('Supprimer ce badge ? Les attributions déjà faites aux élèves seront perdues.', async () => {
    const { error } = await supabaseClient.from('badges').delete().eq('id', id);
    if (error) return alert(error.message);
    badgesTous = badgesTous.filter(b => b.id !== id);
    rendreBadges();
  });
}

async function afficherElevesBadges() {
  const zone = document.getElementById('zoneElevesBadges');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  const { data: eleves } = await supabaseClient.from('eleves').select('id, profils(prenom, nom)').eq('classe_id', classeSelectionneeBadges);
  elevesClasseBadges = eleves || [];
  const idsEleves = elevesClasseBadges.map(e => e.id);

  attributionsParEleveBadges = {};
  if (idsEleves.length) {
    const { data: attributions } = await supabaseClient.from('badges_eleves').select('*').in('eleve_id', idsEleves);
    (attributions || []).forEach(a => { (attributionsParEleveBadges[a.eleve_id] ??= []).push(a); });
  }

  const badgesParId = {};
  badgesTous.forEach(b => { badgesParId[b.id] = b; });

  zone.innerHTML = `<div class="liste-lignes">${elevesClasseBadges.map(e => `
    <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <div class="titre-ligne">${echapperBadges(e.profils?.prenom)} ${echapperBadges(e.profils?.nom)}</div>
        <button class="btn btn-primaire" data-attribuer-badge="${e.id}" style="padding:6px 14px;font-size:12px">+ Attribuer un badge</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${(attributionsParEleveBadges[e.id] || []).map(a => {
          const b = badgesParId[a.badge_id];
          if (!b) return '';
          return `<span class="pastille-badge-eleve">${echapperBadges(b.icone)} ${echapperBadges(b.nom)} <button data-retirer-badge="${a.id}" title="Retirer">✕</button></span>`;
        }).join('') || '<span style="font-size:12px;color:var(--texte-gris)">Aucun badge pour l\'instant.</span>'}
      </div>
    </div>`).join('') || '<p class="chargement">Aucun élève dans cette classe.</p>'}</div>`;

  zone.querySelectorAll('[data-attribuer-badge]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirAttributionBadge(btn.dataset.attribuerBadge));
  });
  zone.querySelectorAll('[data-retirer-badge]').forEach(btn => {
    btn.addEventListener('click', () => retirerBadge(parseInt(btn.dataset.retirerBadge, 10)));
  });
}

function ouvrirAttributionBadge(eleveId) {
  const badgesActifs = badgesTous.filter(b => b.actif);
  if (!badgesActifs.length) return alert('Créez d\'abord un badge actif.');

  ouvrirModal({
    titre: 'Attribuer un badge',
    champs: [
      { nom: 'badge_id', label: 'Badge', type: 'select', options: badgesActifs.map(b => ({ valeur: b.id, label: `${b.icone} ${b.nom}` })) },
      { nom: 'commentaire', label: 'Commentaire (facultatif)', type: 'textarea', requis: false }
    ],
    texteValider: 'Attribuer',
    onValider: async ({ badge_id, commentaire }) => {
      const { error } = await supabaseClient.from('badges_eleves').insert({
        badge_id: parseInt(badge_id, 10), eleve_id: eleveId, attribue_par: profilAdminBadges.id, commentaire: commentaire || null
      });
      if (error) {
        if (error.code === '23505') return alert('Cet élève a déjà ce badge.');
        return alert(error.message);
      }
      afficherElevesBadges();
    }
  });
}

function retirerBadge(id) {
  confirmerAction('Retirer ce badge à l\'élève ?', async () => {
    const { error } = await supabaseClient.from('badges_eleves').delete().eq('id', id);
    if (error) return alert(error.message);
    afficherElevesBadges();
  });
}

function echapperBadges(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
