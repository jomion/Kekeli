// ============================================================
// Coquille visuelle "premium" de l'espace élève — sidebar + barre du haut +
// nav mobile basse, reproduction fidèle du modèle fourni par le porteur du
// projet (kekeli_modele_dashboard.html).
//
// N'est appelé que depuis js/entete-navigation.js#initEnteteNavigation,
// UNIQUEMENT quand le rôle est 'eleve' ET que l'élève a activé
// "🎨 Essayer le nouveau look premium" dans Paramètres (voir
// preferences_navigation.theme_premium) — jamais directement par une page,
// et jamais pour un autre rôle (parent/enseignant/autorité/admin gardent
// TOUJOURS l'en-tête classique, quoi qu'il arrive).
//
// Ce module construit uniquement le CADRE autour de la page : le <header>
// du DOM devient la barre du haut, une nouvelle <aside> (sidebar, CLAIRE —
// pas sombre) et une nouvelle <nav> (barre mobile basse) sont ajoutées.
// #contenu n'est jamais touché ici — chaque page continue d'y écrire son
// propre HTML comme avant (voir js/pages/eleve-*.js) ; seul le style de ce
// contenu change, via css/theme-premium-eleve.css (scopé sous
// body.theme-premium-actif).
//
// Éléments affichés mais SANS fonctionnalité réelle pour l'instant (choix
// explicite de l'utilisateur : "visuels seulement, pour l'instant") :
// "📈 Mes progrès", "❤️ Favoris", le compteur d'étoiles et la barre de
// recherche de la topbar — présentés avec une pastille "Bientôt" ou un
// state désactivé plutôt que comme des liens/actions morts, pour rester
// honnête avec l'élève. "🎮 Jeux éducatifs" est en revanche un VRAI lien
// (demande explicite de l'utilisateur : "jeux éducatif va représenter les
// différentes activités avec paliers") : il ouvre
// pages/eleve/jeux-educatifs.html, qui liste les séances de la classe
// contenant des blocs à palier (azovi/devi/ogan/axosu) — voir
// js/pages/eleve-jeux-educatifs.js.
// ============================================================

const RUPTURE_PREMIUM_MOBILE = 900;
const CLE_SIDEBAR_REPLIEE = 'kekeliPremiumSidebarRepliee';

// ------------------------------------------------------------
// Icônes en traits fins (style du modèle fourni) — un seul petit jeu
// d'icônes SVG en ligne, partagé par toutes les pages élève premium
// (sidebar, topbar, nav mobile) ET par js/pages/eleve-matiere.js (chargé
// après ce fichier sur matiere.html — voir l'ordre des <script> des pages
// élève). `iconePrem(nom, taille)` retourne le <svg> prêt à insérer ; la
// couleur suit `currentColor`, donc se pilote entièrement en CSS.
// ------------------------------------------------------------
const ICONES_PREM = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
  matieres: '<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="16" y="3" width="4" height="17" rx="1"/>',
  seances: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  devoirs: '<path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v5h5"/><path d="M8 13h8M8 17h5"/>',
  badges: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/>',
  progres: '<path d="M4 17 10 11l4 4 6-7"/><path d="M15 8h5v5"/>',
  favoris: '<path d="M12 3.5l2.6 5.4 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.9L12 3.5Z"/>',
  plus: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  chevronBas: '<path d="m6 9 6 6 6-6"/>',
  chevronGauche: '<path d="m15 6-6 6 6 6"/>',
  chevronDroite: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  volet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  casque: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>',
  jouer: '<path d="M7 5v14l12-7Z"/>',
  coeur: '<path d="M12 20s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 21.5 11c-2.5 4.4-9.5 9-9.5 9Z"/>',
  boussole: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-4-2 2-6 4 2Z"/>',
  manette: '<rect x="3" y="8" width="18" height="9" rx="4"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="13" r="1"/>',
  utilisateur: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  parametres: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.5a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.5c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>',
  deconnexion: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
  livre: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5V5.5"/>',
  livreOuvert: '<path d="M12 6v14"/><path d="M4 6c2-1.3 5-2 8-.5C15-.5 18 .7 20 2v14c-2-1.3-5-2.5-8-.5-3-2-6-.8-8 .5Z"/>',
  plume: '<path d="M20 4c-7 1-13 6-15 13 5-1 8-3 10-6"/><path d="M9 15 4 20"/>',
  poubelle: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  planche: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  fermer: '<path d="m6 6 12 12M18 6 6 18"/>',
  drapeau: '<path d="M6 21V4"/><path d="M6 4h12l-3 4 3 4H6"/>',
  grille: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  liste: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  etoilePleine: '<path d="M12 3.5l2.6 5.4 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.9L12 3.5Z" fill="currentColor" stroke="none"/>',
};

function iconePrem(nom, taille) {
  const chemin = ICONES_PREM[nom] || ICONES_PREM.plus;
  return `<svg viewBox="0 0 24 24" width="${taille || 18}" height="${taille || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${chemin}</svg>`;
}

// Icônes de navigation par identifiant de lien (voir js/navigation-config.js
// pour la liste des id du rôle élève) + couleur par matière (code de
// champs_formation) pour les badges ronds du panneau "MATIÈRES" — copie
// volontaire de PRESENTATION_CHAMPS_ELEVE (js/pages/eleve-matiere.js) : ce
// fichier est chargé sur TOUTES les pages élève (pas seulement
// matiere.html), il a donc besoin de sa propre petite copie plutôt que de
// dépendre du chargement d'un autre fichier de page. Garder les trois
// synchronisées si une matière change.
const ICONE_LIEN_SIDEBAR_PREMIUM = {
  'tableau-de-bord': 'home', matieres: 'matieres', seances: 'seances',
  'devoirs-notes': 'devoirs', badges: 'badges',
};
const PRESENTATION_CHAMPS_PREMIUM = {
  francais:     { icone: '📚', couleur: '#3B5EFF' }, mathematique: { icone: '📐', couleur: '#14B8A6' },
  es:           { icone: '🌍', couleur: '#22C55E' }, est:          { icone: '🔬', couleur: '#6366F1' },
  ea:           { icone: '🎨', couleur: '#EC4899' }, eps:          { icone: '⚽', couleur: '#F97316' },
};
function couleurChampPremium(code) { return (PRESENTATION_CHAMPS_PREMIUM[code] || {}).couleur || '#64748B'; }

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
  // le parcours d'une matière (matiere.html, ET la page de lecture d'une
  // séance qu'on atteint depuis matiere.html) — voir demande utilisateur :
  // "quand l'enfant sélectionne séance, les matières se développent
  // automatiquement". Corrigé le 04/09/2026 : seul 'matiere.html' était pris
  // en compte, donc le panneau se repliait dès qu'on ouvrait une séance
  // (pages/eleve/seance.html) alors qu'on reste dans le parcours de la même
  // matière — signalé par l'utilisateur ("quand je clique sur séance le
  // déploiement de la matière ne s'affiche pas"). Peut aussi être déplié/
  // replié à la main via le bouton "Séances" (voir plus bas), qui n'est plus
  // un lien de navigation mais un simple bouton d'ouverture/fermeture de ce
  // panneau.
  const matieresOuvertesInitialement = nomFichierActuel === 'matiere.html' || nomFichierActuel === 'seance.html';

  // Liens de la sidebar : les vrais liens du rôle (déjà filtrés selon les
  // préférences de masquage — voir js/entete-navigation.js), plus "Jeux
  // éducatifs" (réel) et deux entrées visuelles seulement.
  const lienMatieres = liensVisibles.find(l => l.id === 'matieres');
  const liensSidebar = [
    ...liensVisibles.map(l => ({ ...l, reel: true })),
    { id: 'jeux-educatifs', href: 'jeux-educatifs.html', icone: 'manette', label: 'Jeux éducatifs', reel: true },
    { id: 'mes-progres', href: '#', icone: 'progres', label: 'Mes progrès', reel: false },
    { id: 'favoris', href: '#', icone: 'favoris', label: 'Favoris', reel: false },
  ];

  // Le lien "Séances" (id 'seances') n'ouvre plus pages/seances.html
  // directement : il devient un bouton qui déplie/replie le panneau
  // "MATIÈRES" juste en dessous de la nav (voir sectionMatieresHtml), comme
  // dans la maquette fournie. L'accès direct à pages/seances.html (recherche/
  // épinglage transversal à toutes les matières) reste possible via le lien
  // "Toutes mes séances" à l'intérieur du panneau déplié.
  const ligneSidebarHtml = (l) => {
    const nomIcone = l.id === 'jeux-educatifs' || l.id === 'mes-progres' || l.id === 'favoris' ? l.icone : (ICONE_LIEN_SIDEBAR_PREMIUM[l.id] || 'plus');
    if (l.id === 'seances') {
      return `<a href="#" class="prem-sidebar-lien${matieresOuvertesInitialement ? ' selected' : ''}" id="premBoutonToggleMatieres" data-sidebar-toggle-matieres>
        <span class="prem-sidebar-icone">${iconePrem(nomIcone)}</span><span>${echapperPremEleve(l.label)}</span>
      </a>`;
    }
    const basename = (l.href.split('/').pop() || '').toLowerCase();
    const actif = l.reel && basename && basename === nomFichierActuel;
    if (!l.reel) {
      return `<a href="#" class="prem-sidebar-lien bientot" title="Bientôt disponible" onclick="return false">
        <span class="prem-sidebar-icone">${iconePrem(nomIcone)}</span><span>${echapperPremEleve(l.label)}</span>
        <span class="prem-sidebar-pastille-bientot">Bientôt</span>
      </a>`;
    }
    return `<a href="${l.href}" class="prem-sidebar-lien${actif ? ' actif' : ''}">
      <span class="prem-sidebar-icone">${iconePrem(nomIcone)}</span><span>${echapperPremEleve(l.label)}</span>
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
          <span class="prem-sidebar-matiere-badge" style="background:${couleurChampPremium(c.code)}">${(PRESENTATION_CHAMPS_PREMIUM[c.code] || {}).icone || '📘'}</span><span>${echapperPremEleve(c.nom)}</span>
        </a>`).join('')}
      <a href="${lienSeances.href}" class="prem-sidebar-toutes-seances">${iconePrem('recherche', 14)} <span>Toutes mes séances</span></a>
    </div>` : '';

  // --- Sidebar (claire, avec bouton de réduction — état mémorisé) ---
  const sidebarRepliee = (() => { try { return localStorage.getItem(CLE_SIDEBAR_REPLIEE) === '1'; } catch (_e) { return false; } })();

  const sidebar = document.createElement('aside');
  sidebar.className = 'prem-sidebar';
  sidebar.id = 'premSidebar';
  sidebar.innerHTML = `
    <div class="prem-sidebar-entete">
      <div class="prem-sidebar-logo"><img src="${racine}assets/logo/logo.png" alt="KEKELI"><span class="prem-sidebar-logo-texte">KEKELI</span></div>
      <button type="button" class="prem-sidebar-toggle" id="premBtnReplierSidebar" title="Réduire ou agrandir le menu" aria-label="Réduire ou agrandir le menu">${iconePrem('volet', 16)}</button>
    </div>
    <nav class="prem-sidebar-nav">${liensSidebar.map(ligneSidebarHtml).join('')}</nav>
    ${sectionMatieresHtml}
    <div class="prem-sidebar-carte-pub">
      <div class="prem-sidebar-carte-pub-emoji">📖</div>
      <div class="prem-sidebar-carte-pub-titre">Apprendre avec plaisir ✨</div>
      <div class="prem-sidebar-carte-pub-texte">Chaque jour est une nouvelle victoire !</div>
    </div>
    <div class="prem-sidebar-pied">
      <a href="${racine}pages/parametres.html" class="prem-sidebar-lien"><span class="prem-sidebar-icone">${iconePrem('parametres')}</span><span>Paramètres</span></a>
      <a href="#" class="prem-sidebar-lien" id="premLienDeconnexion"><span class="prem-sidebar-icone">${iconePrem('deconnexion')}</span><span>Déconnexion</span></a>
    </div>
  `;

  const overlaySidebar = document.createElement('div');
  overlaySidebar.className = 'prem-sidebar-overlay';
  overlaySidebar.id = 'premSidebarOverlay';

  // --- Barre du haut (réutilise le <header> déjà présent dans le DOM) ---
  header.className = 'prem-topbar';
  header.innerHTML = `
    <button type="button" class="prem-topbar-hamburger" id="premBtnMenuMobile" aria-label="Ouvrir le menu">${iconePrem('menu', 22)}</button>
    <label class="prem-topbar-recherche">
      ${iconePrem('recherche', 16)} <input type="search" placeholder="Rechercher une leçon, une notion..." readonly title="Bientôt disponible">
    </label>
    <div class="prem-topbar-actions">
      <span class="prem-topbar-etoiles" title="Bientôt disponible">${iconePrem('etoilePleine', 15)} —</span>
      <div id="zoneClochePremium"></div>
      <span class="prem-topbar-profil">
        <span class="prem-topbar-avatar">🟢</span>
        <span class="prem-topbar-profil-texte">
          <div class="prem-topbar-profil-nom">${echapperPremEleve(prenom)}</div>
          ${classeNom ? `<div class="prem-topbar-profil-classe">${echapperPremEleve(classeNom)}</div>` : ''}
        </span>
        <span class="prem-topbar-profil-chevron">${iconePrem('chevronBas', 14)}</span>
      </span>
    </div>
  `;

  document.body.insertBefore(overlaySidebar, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
  if (sidebarRepliee) document.body.classList.add('prem-sidebar-repliee');

  // --- Nav mobile basse (5 raccourcis fixes, comme le modèle fourni — le
  // 3e, "Jeux éducatifs", flotte en bouton rond au-dessus de la barre). ---
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'prem-bottom-nav';
  const itemsBottomNav = [
    { href: 'bienvenue.html', icone: 'home', label: 'Accueil', reel: true },
    { href: 'matiere.html', icone: 'boussole', label: 'Parcours', reel: true },
    { href: 'jeux-educatifs.html', icone: 'manette', label: 'Jeux éducatifs', reel: true, fab: true },
    { href: '#', icone: 'coeur', label: 'Favoris', reel: false },
    { href: 'tableau-de-bord.html', icone: 'utilisateur', label: 'Profil', reel: true },
  ];
  bottomNav.innerHTML = itemsBottomNav.map(it => {
    const basename = (it.href.split('/').pop() || '').toLowerCase();
    const actif = it.reel && basename === nomFichierActuel;
    const classes = [it.fab ? 'prem-bottom-fab' : '', actif ? 'actif' : ''].filter(Boolean).join(' ');
    if (!it.reel) return `<a href="#" class="bientot" title="Bientôt disponible" onclick="return false"><span class="prem-bottom-icone">${iconePrem(it.icone, 19)}</span>${echapperPremEleve(it.label)}</a>`;
    return `<a href="${it.href}"${classes ? ` class="${classes}"` : ''}><span class="prem-bottom-icone">${iconePrem(it.icone, it.fab ? 22 : 19)}</span>${echapperPremEleve(it.label)}</a>`;
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

  // --- Réduction/agrandissement de la sidebar (desktop) — persisté en
  // localStorage pour rester cohérent d'une page à l'autre et d'une visite
  // à l'autre ; purement une préférence d'affichage locale à l'appareil,
  // sans lien avec preferences_navigation (côté serveur). ---
  const btnReplier = document.getElementById('premBtnReplierSidebar');
  if (btnReplier) {
    btnReplier.addEventListener('click', () => {
      const repliee = document.body.classList.toggle('prem-sidebar-repliee');
      try { localStorage.setItem(CLE_SIDEBAR_REPLIEE, repliee ? '1' : '0'); } catch (_e) { /* stockage indisponible : pas bloquant */ }
      if (repliee) {
        // Replier referme aussi le panneau MATIÈRES (plus de place pour l'afficher).
        const panneau = document.getElementById('premSidebarMatieres');
        const bouton = document.getElementById('premBoutonToggleMatieres');
        if (panneau) panneau.classList.remove('ouvert');
        if (bouton) bouton.classList.remove('selected');
      }
    });
  }

  // --- Panneau MATIÈRES : déplier/replier au clic sur "Séances" ---
  const boutonToggleMatieres = document.getElementById('premBoutonToggleMatieres');
  const panneauMatieres = document.getElementById('premSidebarMatieres');
  if (boutonToggleMatieres && panneauMatieres) {
    boutonToggleMatieres.addEventListener('click', (e) => {
      e.preventDefault();
      if (document.body.classList.contains('prem-sidebar-repliee')) return; // pas de place en mode réduit
      const ouvert = panneauMatieres.classList.toggle('ouvert');
      boutonToggleMatieres.classList.toggle('selected', ouvert);
    });
  }
}
