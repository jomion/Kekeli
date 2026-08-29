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

async function initEnteteNavigation(config) {
  const racine = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
  const header = document.querySelector('header');
  if (!header) return;

  let liensMasques = [];
  if (config.utilisateurId) {
    try {
      const { data } = await supabaseClient.from('preferences_navigation').select('liens_masques').eq('utilisateur_id', config.utilisateurId).maybeSingle();
      liensMasques = data?.liens_masques || [];
    } catch (_e) { /* préférences indisponibles -> on affiche tout, tant pis */ }
  }

  const liensVisibles = (config.liens || []).filter(l => l.essentiel || !liensMasques.includes(l.id));
  const fnDeconnexion = config.role === 'admin' ? 'deconnecterAdmin' : 'deconnecterUtilisateur';

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
        ${liensVisibles.map(l => `<a href="${l.href}">${l.icone ? `${l.icone} ` : ''}${l.label}</a>`).join('')}
      </nav>
      <div class="entete-kekeli-actions">
        <div id="zoneCloche"></div>
        ${config.badgeHtml ? `<span class="entete-kekeli-badge">${config.badgeHtml}</span>` : ''}
        ${config.utilisateurId ? `<a href="${racine}pages/parametres.html" class="entete-kekeli-icone-btn" title="Paramètres">⚙️</a>` : ''}
        ${config.utilisateurId ? `<button class="entete-kekeli-icone-btn" id="btnDeconnexionEntete" title="Déconnexion">🚪</button>` : ''}
      </div>
    </div>
    <div class="entete-kekeli-overlay" id="enteteKekeliOverlay"></div>
  `;

  document.body.classList.add('avec-entete-fixe');

  const btnDeconnexionEntete = document.getElementById('btnDeconnexionEntete');
  if (btnDeconnexionEntete) btnDeconnexionEntete.addEventListener('click', () => {
    if (typeof window[fnDeconnexion] === 'function') window[fnDeconnexion]();
  });

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
