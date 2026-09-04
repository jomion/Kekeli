// ============================================================
// Panneau LATÉRAL de structure d'une matière (Thème/Unité/Semaine/Dossier/...
// puis SA) : tiroir qui se déploie depuis la droite de l'écran, avec des
// noeuds dépliables/repliables (▸/▾) et des lignes cliquables — remplace
// l'ancien panneau "🗂️ Structure" (liste plate, sans interaction) qui
// vivait, dupliqué, dans js/pages/navigation.js et js/pages/seances.js.
//
// Retour utilisateur ayant motivé cette refonte : "Pour la structure des
// séances pour les admin c'est vilain. je veux quelque chose de latérale qui
// peut se déployer et se replier et être cliquable."
//
// Module partagé (chargé par pages/navigation.html ET pages/seances.html) :
// un seul tiroir est créé dans le DOM (id="structureLaterale"), réutilisé à
// chaque appel plutôt que recréé.
//
// Usage :
//   ouvrirStructureLaterale({
//     classeId, champId, champNom,
//     onNoeud(noeud)  -> optionnel : appelé au clic sur le LIBELLÉ d'une
//                        ligne "noeud" (le petit bouton ▸/▾, lui, ne fait
//                        que déplier/replier — jamais naviguer)
//     onSa(sa)        -> optionnel : appelé au clic sur une ligne "SA"
//   });
// Sans onNoeud/onSa, les lignes correspondantes restent seulement
// dépliables/repliables (noeuds) ou simplement affichées (SA).
// ============================================================

const ETIQUETTES_TYPE_STRUCTURE_LATERALE = { theme: 'Thème', unite: 'Unité', semaine: 'Semaine', dossier: 'Dossier', discipline: 'Discipline' };

function echapperStructureLaterale(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function elementStructureLaterale() {
  let el = document.getElementById('structureLaterale');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'structureLaterale';
  el.className = 'structure-laterale';
  el.innerHTML = `
    <div class="structure-laterale-overlay" data-fermer-structure></div>
    <aside class="structure-laterale-panneau">
      <div class="structure-laterale-entete">
        <div class="structure-laterale-titre" id="structureLateraleTitre">Structure</div>
        <button type="button" class="structure-laterale-fermer" data-fermer-structure title="Fermer">✕</button>
      </div>
      <div class="structure-laterale-corps" id="structureLateraleCorps"><p class="chargement">Chargement...</p></div>
    </aside>`;
  document.body.appendChild(el);
  el.querySelectorAll('[data-fermer-structure]').forEach(b => b.addEventListener('click', fermerStructureLaterale));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerStructureLaterale(); });
  return el;
}

function fermerStructureLaterale() {
  const el = document.getElementById('structureLaterale');
  if (el) el.classList.remove('ouvert');
}

async function ouvrirStructureLaterale({ classeId, champId, champNom, onNoeud, onSa }) {
  const el = elementStructureLaterale();
  document.getElementById('structureLateraleTitre').textContent = champNom ? `🗂️ Structure — ${champNom}` : '🗂️ Structure';
  const corps = document.getElementById('structureLateraleCorps');
  corps.innerHTML = '<p class="chargement">Chargement de la structure...</p>';
  el.classList.add('ouvert');

  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, ordre, titre, type_noeud')
    .eq('classe_id', classeId).eq('champ_formation_id', champId).order('ordre');
  const idsNoeuds = (noeuds || []).map(n => n.id);
  const { data: sasBrut } = idsNoeuds.length
    ? await supabaseClient.from('sa').select('id, noeud_id, ordre, titre, numero').in('noeud_id', idsNoeuds).order('ordre')
    : { data: [] };

  if (!noeuds || !noeuds.length) {
    corps.innerHTML = '<p class="chargement">Rien à afficher pour l\'instant — cette matière est vide.</p>';
    return;
  }

  const enfantsParParent = {};
  noeuds.forEach(n => { const cle = n.parent_id ?? 'racine'; (enfantsParParent[cle] ??= []).push(n); });
  const saParNoeud = {};
  (sasBrut || []).forEach(s => { (saParNoeud[s.noeud_id] ??= []).push(s); });

  function rendreNoeud(n, profondeur) {
    const enfants = enfantsParParent[n.id] || [];
    const sas = saParNoeud[n.id] || [];
    const aDesEnfants = enfants.length > 0 || sas.length > 0;
    // Racine dépliée par défaut (pour montrer tout de suite qu'il y a du
    // contenu), le reste replié — évite un mur de texte à l'ouverture.
    const deplieeParDefaut = profondeur === 0;
    return `
      <div class="structure-laterale-noeud">
        <div class="structure-laterale-ligne" style="padding-left:${profondeur * 18}px">
          ${aDesEnfants
            ? `<button type="button" class="structure-laterale-bascule" data-bascule-noeud="${n.id}" aria-label="Déplier/replier">${deplieeParDefaut ? '▾' : '▸'}</button>`
            : '<span class="structure-laterale-bascule-vide"></span>'}
          <span class="structure-laterale-icone">📁</span>
          <span class="structure-laterale-libelle${onNoeud ? ' cliquable' : ''}" data-noeud-id="${n.id}">${echapperStructureLaterale(n.titre)}</span>
          <span class="type-arbo">${ETIQUETTES_TYPE_STRUCTURE_LATERALE[n.type_noeud] || n.type_noeud}</span>
        </div>
        <div class="structure-laterale-enfants" data-enfants-de="${n.id}" style="display:${deplieeParDefaut ? 'block' : 'none'}">
          ${sas.map(s => `
            <div class="structure-laterale-ligne structure-laterale-ligne-sa" style="padding-left:${(profondeur + 1) * 18}px">
              <span class="structure-laterale-bascule-vide"></span>
              <span class="structure-laterale-icone">📄</span>
              <span class="structure-laterale-libelle${onSa ? ' cliquable' : ''}" data-sa-id="${s.id}">${s.numero ? 'SA' + s.numero + ' — ' : ''}${echapperStructureLaterale(s.titre)}</span>
            </div>`).join('')}
          ${enfants.map(e => rendreNoeud(e, profondeur + 1)).join('')}
        </div>
      </div>`;
  }

  const racines = enfantsParParent['racine'] || [];
  corps.innerHTML = `<div class="structure-laterale-arbre">${racines.map(r => rendreNoeud(r, 0)).join('')}</div>`;

  corps.querySelectorAll('[data-bascule-noeud]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enfants = corps.querySelector(`[data-enfants-de="${btn.dataset.basculeNoeud}"]`);
      if (!enfants) return;
      const ouvert = enfants.style.display !== 'none';
      enfants.style.display = ouvert ? 'none' : 'block';
      btn.textContent = ouvert ? '▸' : '▾';
    });
  });

  if (onNoeud) {
    const noeudParId = new Map(noeuds.map(n => [n.id, n]));
    corps.querySelectorAll('[data-noeud-id]').forEach(libelle => {
      libelle.addEventListener('click', () => onNoeud(noeudParId.get(parseInt(libelle.dataset.noeudId, 10))));
    });
  }
  if (onSa) {
    const saParId = new Map((sasBrut || []).map(s => [s.id, s]));
    corps.querySelectorAll('[data-sa-id]').forEach(libelle => {
      libelle.addEventListener('click', () => onSa(saParId.get(parseInt(libelle.dataset.saId, 10))));
    });
  }
}
