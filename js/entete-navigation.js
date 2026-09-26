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
          <div class="entete-kekeli-sousmenu-inner">
            ${g.liens.map(l => `<a href="${l.href}">${l.icone ? `${l.icone} ` : ''}${l.label}</a>`).join('')}
          </div>
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

// Le bouton d'épinglage "📌 Épingler cette page" a été retiré de l'en-tête
// le 26 septembre 2026 (demande explicite : "retire le bouton épingler de
// toutes les pages et maintient l'épinglement via paramètre uniquement") —
// il capturait le chemin de la page courante, mais faisait doublon avec le
// sélecteur "Épingler une page de mon espace" de pages/parametres.html, qui
// reste le SEUL moyen d'ajouter/retirer un raccourci désormais (voir
// js/pages/parametres.js — ajouterRaccourciDepuisListeParam/
// retirerRaccourciParam). Les raccourcis déjà épinglés par ce bouton restent
// affichés normalement (même colonne preferences_navigation.raccourcis).
async function initEnteteNavigation(config) {
  const racine = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
  const header = document.querySelector('header');
  if (!header) return;

  // 19 septembre 2026 : lien vers "Gestion de tous les comptes"
  // (pages/admin/gestion-tous-les-comptes.html), réservé au COMPTE RACINE
  // (administrateurs.est_racine — voir cette même migration), pas seulement
  // au super_admin. Ajouté ici, de façon centralisée, plutôt que dans
  // js/navigation-config.js + chaque page admin (qui ne connaissent que le
  // drapeau super_admin) : ça évite de toucher aux ~15 pages admin
  // existantes (dont certaines purement pédagogiques, ex. éditeur de
  // séance) juste pour un lien de menu cosmétique — la vraie protection est
  // de toute façon revérifiée côté serveur par la fonction
  // "gerer-tous-les-comptes", ce lien n'est qu'un confort d'affichage. On
  // déduit le préfixe de dossier à utiliser (ex. "" depuis pages/admin/*.html,
  // "admin/" depuis pages/navigation.html) à partir du lien "tableau-de-bord"
  // déjà présent (toujours fourni, jamais masquable) plutôt que de le
  // recevoir en paramètre.
  if (config.role === 'admin' && config.utilisateurId) {
    try {
      const { data: adminSoi } = await supabaseClient.from('administrateurs').select('est_racine').eq('id', config.utilisateurId).maybeSingle();
      if (adminSoi?.est_racine && !(config.liens || []).some(l => l.id === 'gestion-tous-les-comptes')) {
        const lienTableauDeBord = (config.liens || []).find(l => l.id === 'tableau-de-bord');
        const prefixeAdmin = lienTableauDeBord ? lienTableauDeBord.href.replace(/tableau-de-bord\.html$/, '') : '';
        config.liens = [...(config.liens || []), {
          id: 'gestion-tous-les-comptes', href: `${prefixeAdmin}gestion-tous-les-comptes.html`,
          icone: '🔑', label: 'Tous les comptes (racine)', categorie: 'comptes'
        }];
      }
    } catch (_e) { /* préférence non disponible -> pas grave, le lien n'apparaît pas */ }
  }

  let liensMasques = [];
  let raccourcisPerso = [];
  let themePremiumActif = false;
  if (config.utilisateurId) {
    try {
      const { data } = await supabaseClient.from('preferences_navigation').select('liens_masques, raccourcis, theme_premium').eq('utilisateur_id', config.utilisateurId).maybeSingle();
      liensMasques = data?.liens_masques || [];
      // Formatage premium (aperçu) — voir js/theme-premium-eleve.js. Ne
      // s'applique qu'à l'espace élève ; les autres rôles gardent toujours
      // l'en-tête classique, quoi qu'il arrive.
      if (config.role === 'eleve') {
        // 11 septembre 2026 : réglage global réversible (voir
        // pages/admin/abonnements.html) — tant qu'il est actif, TOUS les
        // élèves ont le thème premium, quelle que soit leur préférence
        // enregistrée (elle reste stockée telle quelle et reprend effet dès
        // que ce réglage est désactivé). table publique en lecture, un seul
        // aller-retour léger (une ligne).
        const { data: parametresPremium } = await supabaseClient.from('parametres_premium').select('theme_premium_par_defaut_tous').eq('id', 1).maybeSingle();
        themePremiumActif = !!parametresPremium?.theme_premium_par_defaut_tous || !!data?.theme_premium;
      }
      // Les raccourcis personnels (voir pages/parametres.html) sont stockés
      // avec un chemin relatif à la RACINE DU SITE (comme les liens
      // `racine: true` de js/navigation-config.js) : on les préfixe ici avec
      // le RACINE_SITE de la page COURANTE, pas celui de la page où ils ont
      // été ajoutés.
      // Un raccourci épinglé via l'ancien bouton 📌 de l'en-tête (retiré le 26
      // septembre 2026 — voir plus haut) avait stocké une adresse ABSOLUE
      // (commence par "/") — utilisable telle quelle depuis n'importe quelle
      // profondeur de page, donc pas de préfixe RACINE_SITE dans ce cas ; ces
      // raccourcis déjà enregistrés continuent de fonctionner normalement. Un
      // raccourci ajouté depuis la page Paramètres (liste des pages du rôle)
      // garde, lui, l'ancienne convention relative à la racine du site (comme
      // les liens `racine: true`).
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

  // Formatage premium (aperçu, réservé à l'espace élève) : délègue toute la
  // construction du cadre (sidebar + barre du haut + nav mobile basse) à
  // js/theme-premium-eleve.js, chargé uniquement sur les pages élève. Le
  // <header> classique ci-dessous n'est alors jamais construit. Si le
  // fichier n'est pas chargé (page non élève, ou script manquant), on
  // retombe silencieusement sur l'en-tête classique — aucun risque de page
  // cassée.
  if (themePremiumActif && typeof construireShellPremiumEleve === 'function') {
    document.body.classList.add('theme-premium-actif');
    await construireShellPremiumEleve(config, liensVisibles);
    if (typeof initBanniereSite === 'function') initBanniereSite(config.role);
    return { premium: true };
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
        ${config.utilisateurId ? `
        <div class="entete-kekeli-categorie">
          <button type="button" class="entete-kekeli-categorie-btn" aria-label="Menu du compte">
            ${config.badgeHtml ? `<span class="entete-kekeli-badge">${config.badgeHtml}</span> ` : ''}<span class="entete-kekeli-caret">▾</span>
          </button>
          <div class="entete-kekeli-sousmenu">
            <div class="entete-kekeli-sousmenu-inner">
              ${['parent', 'enseignant', 'autorite'].includes(config.role) && typeof urlCompleterProfil === 'function' ? `<a href="${urlCompleterProfil()}">👤 Mon profil</a>` : ''}
              <a href="${racine}pages/parametres.html">⚙️ Paramètres</a>
              <a href="#" id="btnDeconnexionEntete">🚪 Déconnexion</a>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>
    <div class="entete-kekeli-overlay" id="enteteKekeliOverlay"></div>
  `;

  document.body.classList.add('avec-entete-fixe');
  initCategoriesNavEntete(header);

  const btnDeconnexionEntete = document.getElementById('btnDeconnexionEntete');
  if (btnDeconnexionEntete) btnDeconnexionEntete.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof window[fnDeconnexion] === 'function') window[fnDeconnexion]();
  });

  if (config.avecCloche !== false && config.utilisateurId && typeof initClocheNotifications === 'function') {
    initClocheNotifications('zoneCloche', config.utilisateurId);
  }

  // Bannière dynamique du super admin (voir js/banniere-site.js) : toute
  // page connectée passant par l'en-tête partagé l'affiche automatiquement,
  // ciblée sur son rôle — rien à ajouter dans chaque page.
  if (typeof initBanniereSite === 'function') {
    initBanniereSite(config.role);
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

  return { premium: false };
}
