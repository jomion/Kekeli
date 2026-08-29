// ============================================================
// En-tête et navigation partagés — utilisé par TOUTES les pages connectées
// (élève, parent, enseignant, autorité pédagogique, admin).
//
// Remplace le contenu du <header> déjà présent sur la page (peu importe son
// balisage d'origine : ce module réécrit tout) par une version commune :
// fixe (reste visible au défilement), avec un menu qui se replie dans un
// tiroir latéral sur petit écran, un lien "⚙️ Paramètres" (voir
// pages/parametres.html) permettant à l'utilisateur de masquer les liens
// qu'il n'utilise pas pour dégager son en-tête, et le même bouton
// Déconnexion / cloche de notifications qu'avant.
//
// Chaque page appelle initEnteteNavigation({...}) une fois son profil chargé
// (voir js/pages/*.js), au lieu de construire elle-même le HTML du header.
//
// Usage :
//   initEnteteNavigation({
//     role: 'eleve' | 'parent' | 'enseignant' | 'autorite' | 'admin',
//     utilisateurId: profil.id,
//     badgeHtml: '🟢 Prénom Nom',              // déjà échappé par l'appelant
//     liens: [
//       { id: 'tableau-de-bord', href: 'tableau-de-bord.html', icone: '🏠', label: 'Tableau de bord', essentiel: true },
//       { id: 'devoirs-notes',   href: 'devoirs-notes.html',   icone: '📊', label: 'Devoirs & notes' },
//       ...
//     ],
//     avecCloche: true   // par défaut true — insère #zoneCloche et appelle initClocheNotifications
//   });
//
// Un lien est masquable par défaut ; passer `essentiel: true` pour l'exclure
// du réglage "Paramètres" (toujours affiché — ex. Tableau de bord).
// ============================================================

const RUPTURE_MENU_MOBILE = 860;

// Regroupe les liens partageant une même `categorie` (voir
// js/navigation-config.js) sous UN SEUL menu déroulant, à la place où le
// premier lien de cette catégorie serait apparu — sert surtout à l'admin,
// qui a beaucoup de liens, pour désencombrer sa barre de navigation. Un lien
// sans `categorie` reste affiché directement.
function regrouperLiensParCategorie(liens) {
  const resultat = [];
  const indexParCategorie = new Map();
  liens.forEach(l => {
    if (!l.categorie) { resultat.push({ type: 'lien', lien: l }); return; }
    if (indexParCategorie.has(l.categorie)) {
      resultat[indexParCategorie.get(l.categorie)].liens.push(l);
    } else {
      indexParCategorie.set(l.categorie, resultat.length);
      resultat.push({ type: 'categorie', cle: l.categorie, liens: [l] });
    }
  });
  return resultat;
}

function liensNavHtml(liensVisibles) {
  const categories = typeof CATEGORIES_NAV === 'object' ? CATEGORIES_NAV : {};
  return regrouperLiensParCategorie(liensVisibles).map(g => {
    if (g.type === 'lien') {
      const l = g.lien;
      return `<a href="${l.href}">${l.icone ? `${l.icone} ` : ''}${l.label}</a>`;
    }
    const info = categories[g.cle] || { label: g.cle, icone: '' };
    return `
      <div class="entete-kekeli-categorie">
        <button type="button" class="entete-kekeli-categorie-btn">${info.icone ? `${info.icone} ` : ''}${info.label} <span class="entete-kekeli-caret">▾</span></button>
        <div class="entete-kekeli-sousmenu">
          ${g.liens.map(l => `<a href="${l.href}">${l.icone ? `${l.icone} ` : ''}${l.label}</a>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// Ouverture/fermeture des menus déroulants de catégorie : au survol (CSS) ET
// au clic (nécessaire sur écran tactile, où il n'y a pas de survol) — un
// seul ouvert à la fois, fermeture au clic ailleurs ou sur Échap.
function initCategoriesNavEntete(header) {
  const categories = [...header.querySelectorAll('.entete-kekeli-categorie')];
  if (!categories.length) return;

  function fermerToutes(sauf) {
    categories.forEach(c => { if (c !== sauf) c.classList.remove('ouvert'); });
  }

  categories.forEach(cat => {
    const btn = cat.querySelector('.entete-kekeli-categorie-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const etaitOuverte = cat.classList.contains('ouvert');
      fermerToutes();
      cat.classList.toggle('ouvert', !etaitOuverte);
    });
  });

  document.addEventListener('click', () => fermerToutes());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerToutes(); });
}

// Épingle la page COURANTE dans les raccourcis personnels de l'utilisateur
// (preferences_navigation.raccourcis — voir js/pages/parametres.js pour la
// gestion complète/suppression). Sert la demande "afficher dans la
// navigation une carte ou une page voulue" : plutôt que de faire chercher la
// page dans une longue liste, on la capture directement pendant qu'on la
// consulte. N'a pas besoin de js/modal.js (pas garanti chargé partout) : les
// classes .modal-overlay/.modal-boite/.champ-modal/.modal-actions sont de
// simples classes CSS, définies dans les deux thèmes.
async function ouvrirEpinglagePageEntete(utilisateurId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const labelParDefaut = (document.title || '').replace(/^KEKELI\s*-\s*/i, '').trim();
  overlay.innerHTML = `
    <div class="modal-boite">
      <h3>📌 Épingler cette page</h3>
      <p style="font-size:13px;color:var(--text-gris,#64748B);margin-top:-8px">Elle apparaîtra dans votre menu, sur toutes vos pages.</p>
      <form id="formEpinglerPageEntete">
        <label class="champ-modal">Nom affiché
          <input type="text" name="label" value="${labelParDefaut.replace(/"/g, '&quot;')}" required maxlength="40">
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
          <button type="submit" class="btn btn-primaire">Épingler</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  document.addEventListener('keydown', function echap(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } });

  overlay.querySelector('#formEpinglerPageEntete').addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = overlay.querySelector('[name="label"]').value.trim();
    fermer();
    if (!label) return;

    const href = window.location.pathname + window.location.search;
    const { data: prefsActuelles } = await supabaseClient.from('preferences_navigation').select('raccourcis').eq('utilisateur_id', utilisateurId).maybeSingle();
    const raccourcisActuels = prefsActuelles?.raccourcis || [];
    if (raccourcisActuels.some(r => r.href === href)) { alert('Cette page est déjà dans vos raccourcis.'); return; }

    const nouveauRaccourci = { id: 'r' + Date.now().toString(36), href, icone: '📌', label };
    const { error } = await supabaseClient.from('preferences_navigation')
      .upsert({ utilisateur_id: utilisateurId, raccourcis: [...raccourcisActuels, nouveauRaccourci], maj_le: new Date().toISOString() });
    if (error) { alert(error.message); return; }
    window.location.reload();
  });
}

async function initEnteteNavigation(config) {
  const racine = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
  const header = document.querySelector('header');
  if (!header) return;

  let liensMasques = [];
  let raccourcisPerso = [];
  if (config.utilisateurId) {
    try {
      const { data } = await supabaseClient.from('preferences_navigation').select('liens_masques, raccourcis').eq('utilisateur_id', config.utilisateurId).maybeSingle();
      liensMasques = data?.liens_masques || [];
      // Les raccourcis personnels (voir pages/parametres.html) sont stockés
      // avec un chemin relatif à la RACINE DU SITE (comme les liens
      // `racine: true` de js/navigation-config.js) : on les préfixe ici avec
      // le RACINE_SITE de la page COURANTE, pas celui de la page où ils ont
      // été ajoutés.
      // Un raccourci "épinglé depuis l'en-tête" (voir ouvrirEpinglagePageEntete
      // ci-dessous) stocke une adresse ABSOLUE (commence par "/") — utilisable
      // telle quelle depuis n'importe quelle profondeur de page, donc pas de
      // préfixe RACINE_SITE dans ce cas. Un raccourci ajouté depuis la page
      // Paramètres (liste des pages du rôle) garde, lui, l'ancienne convention
      // relative à la racine du site (comme les liens `racine: true`).
      raccourcisPerso = (data?.raccourcis || []).map(r => ({ ...r, href: r.href && r.href.startsWith('/') ? r.href : racine + r.href }));
    } catch (_e) { /* préférences indisponibles -> on affiche tout, tant pis */ }
  }

  const liensVisibles = [...(config.liens || []).filter(l => l.essentiel || !liensMasques.includes(l.id)), ...raccourcisPerso];
  const fnDeconnexion = config.role === 'admin' ? 'deconnecterAdmin' : 'deconnecterUtilisateur';

  // Petit "top" de dernière activité pour le contrôle parental (voir
  // pages/parent/tableau-de-bord.html) — sans bloquer l'affichage de la page,
  // et sans faire échouer quoi que ce soit si ça ne passe pas.
  if (config.role === 'eleve' && config.utilisateurId) {
    supabaseClient.from('eleves').update({ derniere_activite: new Date().toISOString() }).eq('id', config.utilisateurId).then(() => {}, () => {});
  }

  header.classList.add('entete-kekeli');
  header.innerHTML = `
    <a href="${racine}index.html" class="entete-kekeli-logo">
      <img src="${racine}assets/logo/logo.png" alt="KEKELI"> KEKELI${config.role === 'admin' ? ' Admin' : ''}
    </a>

    <button type="button" class="entete-kekeli-hamburger" id="btnMenuMobile" aria-label="Ouvrir le menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>

    <div class="entete-kekeli-zone" id="enteteKekeliZone">
      <nav class="entete-kekeli-liens">
        ${liensNavHtml(liensVisibles)}
      </nav>
      <div class="entete-kekeli-actions">
        <div id="zoneCloche"></div>
        ${config.badgeHtml ? `<span class="entete-kekeli-badge">${config.badgeHtml}</span>` : ''}
        ${config.utilisateurId ? `<button type="button" class="entete-kekeli-icone-btn" id="btnEpinglerPageEntete" title="Épingler cette page dans mes raccourcis">📌</button>` : ''}
        ${config.utilisateurId ? `<a href="${racine}pages/parametres.html" class="entete-kekeli-icone-btn" title="Paramètres">⚙️</a>` : ''}
        ${config.utilisateurId ? `<button class="entete-kekeli-icone-btn" id="btnDeconnexionEntete" title="Déconnexion">🚪</button>` : ''}
      </div>
    </div>
    <div class="entete-kekeli-overlay" id="enteteKekeliOverlay"></div>
  `;

  document.body.classList.add('avec-entete-fixe');
  initCategoriesNavEntete(header);

  const btnDeconnexionEntete = document.getElementById('btnDeconnexionEntete');
  if (btnDeconnexionEntete) btnDeconnexionEntete.addEventListener('click', () => {
    if (typeof window[fnDeconnexion] === 'function') window[fnDeconnexion]();
  });

  const btnEpinglerPageEntete = document.getElementById('btnEpinglerPageEntete');
  if (btnEpinglerPageEntete) btnEpinglerPageEntete.addEventListener('click', () => ouvrirEpinglagePageEntete(config.utilisateurId));

  if (config.avecCloche !== false && config.utilisateurId && typeof initClocheNotifications === 'function') {
    initClocheNotifications('zoneCloche', config.utilisateurId);
  }

  const btnMenu = document.getElementById('btnMenuMobile');
  const zone = document.getElementById('enteteKekeliZone');
  const overlay = document.getElementById('enteteKekeliOverlay');
  function fermerMenuMobile() {
    zone.classList.remove('ouvert');
    overlay.classList.remove('visible');
    btnMenu.setAttribute('aria-expanded', 'false');
  }
  function basculerMenuMobile() {
    const ouvert = zone.classList.toggle('ouvert');
    overlay.classList.toggle('visible', ouvert);
    btnMenu.setAttribute('aria-expanded', String(ouvert));
  }
  btnMenu.addEventListener('click', basculerMenuMobile);
  overlay.addEventListener('click', fermerMenuMobile);
  zone.querySelectorAll('a').forEach(a => a.addEventListener('click', fermerMenuMobile));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerMenuMobile(); });
  window.addEventListener('resize', () => { if (window.innerWidth > RUPTURE_MENU_MOBILE) fermerMenuMobile(); });
}
