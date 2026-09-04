// ============================================================
// Coquille visuelle "premium" de l'espace élève — sidebar + barre du haut +
// nav mobile basse, sur le modèle fourni par l'utilisateur.
//
// N'est appelé que depuis js/entete-navigation.js#initEnteteNavigation,
// UNIQUEMENT quand le rôle est 'eleve' ET que l'élève a activé
// "🎨 Essayer le nouveau look premium" dans Paramètres (voir
// preferences_navigation.theme_premium) — jamais directement par une page,
// et jamais pour un autre rôle (parent/enseignant/autorité/admin gardent
// TOUJOURS l'en-tête classique, quoi qu'il arrive).
//
// Ce module construit uniquement le CADRE autour de la page : le <header>
// du DOM devient la barre du haut, une nouvelle <aside> (sidebar) et une
// nouvelle <nav> (barre mobile basse) sont ajoutées. #contenu n'est jamais
// touché ici — chaque page continue d'y écrire son propre HTML comme avant
// (voir js/pages/eleve-*.js) ; seul le style de ce contenu change, via
// css/theme-premium-eleve.css (scopé sous body.theme-premium-actif).
//
// Éléments affichés mais SANS fonctionnalité réelle pour l'instant (choix
// explicite de l'utilisateur : "visuels seulement, pour l'instant") :
// "📈 Mes progrès", "❤️ Favoris" et le compteur "⭐" — présentés avec une
// pastille "Bientôt" plutôt que comme des liens morts, pour rester honnête
// avec l'élève. "🎮 Jeux éducatifs" est en revanche un VRAI lien (demande
// explicite de l'utilisateur : "jeux éducatif va représenter les
// différentes activités avec paliers") : il ouvre
// pages/eleve/jeux-educatifs.html, qui liste les séances de la classe
// contenant des blocs à palier (azovi/devi/ogan/axosu) — voir
// js/pages/eleve-jeux-educatifs.js.
// ============================================================

const RUPTURE_PREMIUM_MOBILE = 900;

// Icônes par matière (code de champs_formation) — copie volontaire de
// PRESENTATION_CHAMPS_ELEVE (js/pages/eleve-matiere.js) : ce fichier est
// chargé sur TOUTES les pages élève (pas seulement matiere.html), il a donc
// besoin de sa propre petite copie plutôt que de dépendre du chargement d'un
// autre fichier de page. Garder les deux synchronisées si une matière change.
const PRESENTATION_CHAMPS_PREMIUM = {
  francais:     { icone: '📚' }, mathematique: { icone: '📐' }, es: { icone: '🌍' },
  est:          { icone: '🔬' }, ea:           { icone: '🎨' }, eps: { icone: '⚽' }
};

function echapperPremEleve(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

// Devine le prénom à partir du badgeHtml existant ("🟢 Prénom") pour éviter
// de redemander cette info à chaque page appelante (déjà échappé par
// l'appelant, comme le badge classique).
function prenomDepuisBadgePremEleve(badgeHtml) {
  return (badgeHtml || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Élève';
}

async function construireShellPremiumEleve(config, liensVisibles) {
  const racine = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
  const header = document.querySelector('header');
  if (!header) return;

  const prenom = prenomDepuisBadgePremEleve(config.badgeHtml);

  // Nom de classe + matières réelles de la classe : deux petites requêtes
  // dédiées (pas systématiquement déjà chargées par la page appelante) —
  // non bloquantes si elles échouent. Les matières servent au panneau
  // "MATIÈRES" de la sidebar (voir plus bas) : toujours les matières RÉELLES
  // de la classe de l'élève, jamais une liste figée.
  let classeNom = '';
  let champsEleve = [];
  try {
    const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', config.utilisateurId).maybeSingle();
    if (fiche?.classe_id) {
      const [{ data: classe }, { data: champsLies }] = await Promise.all([
        supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).maybeSingle(),
        supabaseClient.from('classes_champs_formation').select('champs_formation(id, nom, code)').eq('classe_id', fiche.classe_id),
      ]);
      classeNom = classe?.nom || '';
      champsEleve = (champsLies || []).map(c => c.champs_formation).filter(Boolean);
    }
  } catch (_e) { /* pas bloquant : la topbar/sidebar s'affichent sans ces infos */ }

  const nomFichierActuel = (window.location.pathname.split('/').pop() || '').toLowerCase();

  // Matière actuellement consultée (matiere.html?champId=...), pour
  // surligner la bonne entrée dans le panneau MATIÈRES.
  let champIdActuel = null;
  if (nomFichierActuel === 'matiere.html') {
    try { champIdActuel = new URLSearchParams(window.location.search).get('champId'); } catch (_e) { /* ignore */ }
  }
  // Panneau MATIÈRES déployé automatiquement dès que l'élève est déjà dans
  // le parcours d'une matière (matiere.html) — voir demande utilisateur :
  // "quand l'enfant sélectionne séance, les matières se développent
  // automatiquement". Peut aussi être déplié/replié à la main via le bouton
  // "📌 Séances" (voir plus bas), qui n'est plus un lien de navigation mais
  // un simple bouton d'ouverture/fermeture de ce panneau.
  const matieresOuvertesInitialement = nomFichierActuel === 'matiere.html';

  // Liens de la sidebar : les vrais liens du rôle (déjà filtrés selon les
  // préférences de masquage — voir js/entete-navigation.js), plus "Jeux
  // éducatifs" (réel) et deux entrées visuelles seulement.
  const lienMatieres = liensVisibles.find(l => l.id === 'matieres');
  const liensSidebar = [
    ...liensVisibles.map(l => ({ ...l, reel: true })),
    { href: 'jeux-educatifs.html', icone: '🎮', label: 'Jeux éducatifs', reel: true },
    { href: '#', icone: '📈', label: 'Mes progrès', reel: false },
    { href: '#', icone: '❤️', label: 'Favoris', reel: false },
  ];

  // Le lien "Séances" (id 'seances') n'ouvre plus pages/seances.html
  // directement : il devient un bouton qui déplie/replie le panneau
  // "MATIÈRES" juste en dessous de la nav (voir sectionMatieresHtml), comme
  // dans la maquette fournie. L'accès direct à pages/seances.html (recherche/
  // épinglage transversal à toutes les matières) reste possible via le lien
  // "🔎 Toutes mes séances" à l'intérieur du panneau déplié.
  const ligneSidebarHtml = (l) => {
    if (l.id === 'seances') {
      return `<a href="#" class="prem-sidebar-lien${matieresOuvertesInitialement ? ' selected' : ''}" id="premBoutonToggleMatieres" data-sidebar-toggle-matieres>
        <span class="prem-sidebar-icone">${l.icone}</span><span>${echapperPremEleve(l.label)}</span>
      </a>`;
    }
    const basename = (l.href.split('/').pop() || '').toLowerCase();
    const actif = l.reel && basename && basename === nomFichierActuel;
    if (!l.reel) {
      return `<a href="#" class="prem-sidebar-lien bientot" title="Bientôt disponible" onclick="return false">
        <span class="prem-sidebar-icone">${l.icone}</span><span>${echapperPremEleve(l.label)}</span>
        <span class="prem-sidebar-pastille-bientot">Bientôt</span>
      </a>`;
    }
    return `<a href="${l.href}" class="prem-sidebar-lien${actif ? ' actif' : ''}">
      <span class="prem-sidebar-icone">${l.icone}</span><span>${echapperPremEleve(l.label)}</span>
    </a>`;
  };

  // Panneau "MATIÈRES" : liste réelle des matières de la classe (jamais de
  // valeurs figées) + un lien vers pages/seances.html (recherche/épinglage
  // transversal à toutes les matières, fonctionnalité déjà existante et
  // conservée telle quelle). Absent du DOM si l'élève n'a aucune classe/
  // matière connue, ou si le lien "Séances" a été masqué par l'élève dans
  // Paramètres.
  const lienSeances = liensVisibles.find(l => l.id === 'seances');
  const hrefMatiereBase = lienMatieres ? lienMatieres.href : 'matiere.html';
  const sectionMatieresHtml = (lienSeances && champsEleve.length) ? `
    <div class="prem-sidebar-matieres${matieresOuvertesInitialement ? ' ouvert' : ''}" id="premSidebarMatieres">
      <div class="prem-sidebar-section-titre">MATIÈRES</div>
      ${champsEleve.map(c => `
        <a href="${hrefMatiereBase}?champId=${c.id}" class="prem-sidebar-matiere${String(c.id) === String(champIdActuel) ? ' active' : ''}" data-champ-id="${c.id}">
          <span class="prem-sidebar-matiere-badge">${(PRESENTATION_CHAMPS_PREMIUM[c.code] || {}).icone || '📘'}</span>${echapperPremEleve(c.nom)}
        </a>`).join('')}
      <a href="${lienSeances.href}" class="prem-sidebar-toutes-seances">🔎 <span>Toutes mes séances</span></a>
    </div>` : '';

  // --- Sidebar ---
  const sidebar = document.createElement('aside');
  sidebar.className = 'prem-sidebar';
  sidebar.id = 'premSidebar';
  sidebar.innerHTML = `
    <div class="prem-sidebar-logo"><img src="${racine}assets/logo/logo.png" alt="KEKELI"> KEKELI</div>
    <nav class="prem-sidebar-nav">${liensSidebar.map(ligneSidebarHtml).join('')}</nav>
    ${sectionMatieresHtml}
    <div class="prem-sidebar-pied">
      <a href="${racine}pages/parametres.html" class="prem-sidebar-lien">⚙️ <span>Paramètres</span></a>
      <a href="#" class="prem-sidebar-lien" id="premLienDeconnexion">🚪 <span>Déconnexion</span></a>
    </div>
  `;

  const overlaySidebar = document.createElement('div');
  overlaySidebar.className = 'prem-sidebar-overlay';
  overlaySidebar.id = 'premSidebarOverlay';

  // --- Barre du haut (réutilise le <header> déjà présent dans le DOM) ---
  header.className = 'prem-topbar';
  header.innerHTML = `
    <button type="button" class="prem-topbar-hamburger" id="premBtnMenuMobile" aria-label="Ouvrir le menu">☰</button>
    <label class="prem-topbar-recherche">
      🔍 <input type="search" placeholder="Rechercher... (bientôt disponible)" readonly title="Bientôt disponible">
    </label>
    <div class="prem-topbar-actions">
      <span class="prem-topbar-etoiles" title="Bientôt disponible">⭐ —</span>
      <div id="zoneClochePremium"></div>
      <span class="prem-topbar-profil">
        <span class="prem-topbar-avatar">🟢</span>
        <span class="prem-topbar-profil-texte">
          <div class="prem-topbar-profil-nom">${echapperPremEleve(prenom)}</div>
          ${classeNom ? `<div class="prem-topbar-profil-classe">${echapperPremEleve(classeNom)}</div>` : ''}
        </span>
      </span>
    </div>
  `;

  document.body.insertBefore(overlaySidebar, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);

  // --- Nav mobile basse (5 raccourcis fixes, comme le modèle fourni) ---
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'prem-bottom-nav';
  const itemsBottomNav = [
    { href: 'bienvenue.html', icone: '🏠', label: 'Accueil', reel: true },
    { href: 'matiere.html', icone: '🧭', label: 'Parcours', reel: true },
    { href: 'jeux-educatifs.html', icone: '🎮', label: 'Jeux', reel: true },
    { href: '#', icone: '❤️', label: 'Favoris', reel: false },
    { href: 'tableau-de-bord.html', icone: '👤', label: 'Profil', reel: true },
  ];
  bottomNav.innerHTML = itemsBottomNav.map(it => {
    const basename = (it.href.split('/').pop() || '').toLowerCase();
    const actif = it.reel && basename === nomFichierActuel;
    if (!it.reel) return `<a href="#" class="bientot" title="Bientôt disponible" onclick="return false"><span class="prem-bottom-icone">${it.icone}</span>${echapperPremEleve(it.label)}</a>`;
    return `<a href="${it.href}"${actif ? ' class="actif"' : ''}><span class="prem-bottom-icone">${it.icone}</span>${echapperPremEleve(it.label)}</a>`;
  }).join('');
  document.body.appendChild(bottomNav);

  // --- Comportements ---
  const fnDeconnexion = config.role === 'admin' ? 'deconnecterAdmin' : 'deconnecterUtilisateur';
  const lienDeconnexion = document.getElementById('premLienDeconnexion');
  if (lienDeconnexion) lienDeconnexion.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof window[fnDeconnexion] === 'function') window[fnDeconnexion]();
  });

  if (config.avecCloche !== false && config.utilisateurId && typeof initClocheNotifications === 'function') {
    initClocheNotifications('zoneClochePremium', config.utilisateurId);
  }

  const btnMenu = document.getElementById('premBtnMenuMobile');
  function fermerSidebarMobile() {
    sidebar.classList.remove('ouvert');
    overlaySidebar.classList.remove('visible');
  }
  function basculerSidebarMobile() {
    const ouvert = sidebar.classList.toggle('ouvert');
    overlaySidebar.classList.toggle('visible', ouvert);
  }
  if (btnMenu) btnMenu.addEventListener('click', basculerSidebarMobile);
  overlaySidebar.addEventListener('click', fermerSidebarMobile);
  // Le bouton "Séances" (déplie/replie MATIÈRES) ne doit pas refermer le
  // tiroir mobile : sans ça, sur mobile, déplier le panneau le cacherait
  // aussitôt derrière la fermeture du tiroir.
  sidebar.querySelectorAll('a').forEach(a => {
    if (a.id !== 'premBoutonToggleMatieres') a.addEventListener('click', fermerSidebarMobile);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerSidebarMobile(); });
  window.addEventListener('resize', () => { if (window.innerWidth > RUPTURE_PREMIUM_MOBILE) fermerSidebarMobile(); });

  // --- Panneau MATIÈRES : déplier/replier au clic sur "Séances" ---
  const boutonToggleMatieres = document.getElementById('premBoutonToggleMatieres');
  const panneauMatieres = document.getElementById('premSidebarMatieres');
  if (boutonToggleMatieres && panneauMatieres) {
    boutonToggleMatieres.addEventListener('click', (e) => {
      e.preventDefault();
      const ouvert = panneauMatieres.classList.toggle('ouvert');
      boutonToggleMatieres.classList.toggle('selected', ouvert);
    });
  }
}
