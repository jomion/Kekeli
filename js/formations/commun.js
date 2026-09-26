// ============================================================
// KEKELI Formation — fonctions partagées par toutes les pages de la
// plateforme de formation (pages/formations/**) et par la page admin
// pages/admin/formations.html.
//
// Chaque page définit d'abord RACINE_SITE (ex. "../../"), puis charge :
//   supabase-js, js/config.js, js/supabaseClient.js, js/auth-utilisateur.js,
//   js/notifications.js, DOMPurify (sanitisation HTML), ce fichier.
//
// Sécurité : toutes les règles d'accès sont vérifiées CÔTÉ SERVEUR
// (RLS + fonctions SECURITY DEFINER, voir LISEZ-MOI) ; ce fichier ne fait
// que de l'affichage. Tout HTML rédigé par un formateur (description,
// contenu de leçon) passe par fkNettoyerHtml() avant affichage.
// ============================================================

const FK_RACINE = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
const FK_BASE = `${FK_RACINE}pages/formations/`;
const FK_BUCKET_PRIVE = 'formations';
const FK_BUCKET_PUBLIC = 'formations-public';
const FK_NIVEAUX = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', tous: 'Tous niveaux' };
const FK_STATUTS_FORMATION = { brouillon: 'Brouillon', en_revision: 'En cours de validation', publiee: 'Publiée', refusee: 'À revoir', archivee: 'Archivée' };
const FK_STATUTS_FORMATEUR = { en_attente: 'En attente de validation', valide: 'Validé', refuse: 'Refusé', suspendu: 'Suspendu' };

// ---------- Petits utilitaires ----------
function fkEchapper(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fkParam(nom) { return new URLSearchParams(window.location.search).get(nom); }
function fkPrix(prix, devise) {
  if (!prix) return 'Gratuit';
  return `${Number(prix).toLocaleString('fr-FR')} ${devise === 'XOF' || !devise ? 'FCFA' : devise}`;
}
function fkDuree(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}
function fkDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fkEtoiles(note, nb) {
  if (!nb) return '<span class="fk-vide">Nouvelle formation</span>';
  const n = Math.round(Number(note) || 0);
  return `<span aria-label="Note ${Number(note).toFixed(1)} sur 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span> ${Number(note).toFixed(1).replace('.', ',')} (${nb})`;
}
function fkPourcentage(v) { return `${Math.round(Number(v) || 0)} %`; }

// Nettoyage du HTML rédigé par un formateur : DOMPurify si disponible,
// sinon repli sûr (texte brut échappé).
// 25 septembre 2026 : l'attribut style est désormais accepté pour garder
// les couleurs, le surlignage et l'alignement (gauche, centre, droite,
// justifié) — mais filtré propriété par propriété (FK_STYLES_AUTORISES) :
// aucune position, taille, image de fond ou url() ne peut passer.
// 26 septembre 2026 : liste élargie pour garder la mise en forme d'un texte
// collé depuis Word (polices, tailles, interlignes, retraits, bordures et
// largeurs de tableau…). Toujours aucune position, image de fond ni url().
const FK_STYLES_AUTORISES = ['color', 'background-color', 'border-left-color', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line',
  'font-family', 'font-size', 'line-height', 'text-indent', 'margin-left', 'padding-left', 'vertical-align', 'text-transform', 'letter-spacing', 'font-variant',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width', 'border-collapse', 'width', 'padding',
  // 26 septembre 2026 : rendu fidèle des pages HTML importées (cartes, grilles, dégradés…).
  'background-image', 'border-radius', 'box-shadow', 'text-shadow', 'padding-top', 'padding-right', 'padding-bottom',
  'margin', 'margin-top', 'margin-bottom', 'margin-right', 'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'flex',
  'grid-template-columns', 'max-width', 'white-space', 'word-spacing', 'list-style-type', 'opacity',
  // 27 septembre 2026 : tailles fixes (pastilles numérotées, icônes, encadrés de chiffres) et petits décalages.
  'height', 'min-width', 'min-height', 'box-sizing', 'position', 'top', 'left', 'right', 'bottom', 'align-self', 'flex-shrink', 'flex-grow', 'flex-basis', 'text-indent'];
// Propriétés dont la valeur peut être longue (dégradés, ombres).
const FK_STYLES_LONGS = ['background-image', 'box-shadow', 'text-shadow', 'font-family', 'grid-template-columns'];
let _fkHookStyle = false;
function fkFiltrerStyle(style) {
  const sortie = String(style || '').split(';').map(d => {
    const i = d.indexOf(':');
    if (i < 0) return null;
    const prop = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).trim();
    let p2 = prop;
    let v2 = val.replace(/\s*!important\s*$/i, '');
    // « background: #ff0 » (Word) -> background-color, s'il ne contient qu'une couleur.
    if (prop === 'background' && /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i.test(v2)) p2 = 'background-color';
    if (!FK_STYLES_AUTORISES.includes(p2)) return null;
    if (!new RegExp(`^[#a-z0-9(),.%\\s"'-]{1,${FK_STYLES_LONGS.includes(p2) ? 400 : 120}}$`, 'i').test(v2) || /url|expression|var\(|attr\(|image-set|element\(|\\/i.test(v2)) return null;
    if (p2 === 'background-image' && !/^((repeating-)?(linear|radial|conic)-gradient\(.*\)\s*,?\s*)+$/i.test(v2)) return null;
    if (p2 === 'display' && !/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|list-item|table|table-row|table-cell|none)$/i.test(v2)) return null;
    if (p2 === 'opacity' && !(Number(v2) >= 0.3)) return null;
    if (/^(windowtext|auto|initial|inherit)$/i.test(v2) && /color/.test(p2)) return null;
    if (p2 === 'font-size') { const m = /^([\d.]+)(pt|px|em|rem|%)$/i.exec(v2); if (!m || Number(m[1]) > ({ pt: 60, px: 80, em: 5, rem: 5, '%': 400 }[m[2].toLowerCase()])) return null; }
    if (['margin-left', 'padding-left', 'text-indent', 'padding', 'width'].includes(p2) && !/^((-?[\d.]+(pt|px|em|rem|cm|mm|in|%)?|auto)\s*){1,4}$/i.test(v2)) return null;
    if (p2 === 'width' && /^([\d.]+)(pt|px)$/i.test(v2) && parseFloat(v2) > 1000) v2 = '100%';
    // Marges et espacements des pages importées : longueurs positives (ou auto) seulement — rien ne peut chevaucher le reste de la page.
    if (['margin', 'margin-top', 'margin-bottom', 'margin-right', 'padding-top', 'padding-right', 'padding-bottom', 'gap', 'max-width', 'border-radius'].includes(p2)
      && !/^(([\d.]+(pt|px|em|rem|cm|mm|%)?|auto|none)\s*){1,4}$/i.test(v2)) return null;
    if (p2 === 'margin-left' && /^-/.test(v2)) return null;
    if (['height', 'min-width', 'min-height', 'flex-basis'].includes(p2) && !/^(([\d.]+(px|pt|em|rem|%)?)|auto)$/i.test(v2)) return null;
    if (['height', 'min-height'].includes(p2) && /px$/i.test(v2) && parseFloat(v2) > 600) return null;
    if (p2 === 'box-sizing' && !/^(border-box|content-box)$/i.test(v2)) return null;
    // Position : seulement « relative » avec un petit décalage (jamais de superposition).
    if (p2 === 'position' && !/^relative$/i.test(v2)) return null;
    if (['top', 'left', 'right', 'bottom'].includes(p2) && !(/^-?[\d.]+(px|em)$/i.test(v2) && Math.abs(parseFloat(v2)) <= (/em$/i.test(v2) ? 2 : 30))) return null;
    if (['flex-shrink', 'flex-grow'].includes(p2) && !/^\d+(\.\d+)?$/.test(v2)) return null;
    if (p2 === 'align-self' && !/^(auto|flex-start|flex-end|center|baseline|stretch|start|end)$/i.test(v2)) return null;
    return `${p2}: ${v2}`;
  }).filter(Boolean);
  // top/left/right/bottom n'ont d'effet (et ne sont gardés) qu'avec « position: relative ».
  const relatif = sortie.some(d => /^position: relative$/i.test(d));
  return sortie.filter(d => relatif || !/^(top|left|right|bottom):/.test(d)).join('; ');
}
function fkNettoyerHtml(html) {
  if (!html) return '';
  if (window.DOMPurify) {
    if (!_fkHookStyle) {
      _fkHookStyle = true;
      window.DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
        if (data.attrName === 'style') {
          data.attrValue = fkFiltrerStyle(data.attrValue);
          if (!data.attrValue) data.keepAttr = false;
        }
      });
      window.DOMPurify.addHook('afterSanitizeAttributes', node => {
        if (node.tagName === 'A' && node.getAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener nofollow'); }
      });
    }
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'small', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr', 'sub', 'sup', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'input'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'data-bloc', 'data-activite', 'data-image', 'data-presentation', 'data-src', 'target', 'rel', 'type', 'checked', 'disabled'],
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/|\.)/i
    }).replace(/<input(?![^>]*type="checkbox")[^>]*>/gi, '');
  }
  return `<p>${fkEchapper(html.replace(/<[^>]*>/g, ' '))}</p>`;
}
function fkTexteVersHtml(texte) {
  return fkEchapper(texte || '').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

// ---------- Toasts, modales, confirmations ----------
function fkToast(message, type) {
  let pile = document.querySelector('.fk-toasts');
  if (!pile) { pile = document.createElement('div'); pile.className = 'fk-toasts'; pile.setAttribute('role', 'status'); document.body.appendChild(pile); }
  const t = document.createElement('div');
  t.className = `fk-toast ${type || ''}`;
  t.textContent = message;
  pile.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
function fkMessageErreur(error) {
  const msg = (error && (error.message || error.error_description)) || 'Une erreur est survenue.';
  return msg.replace(/^PAIEMENT_REQUIS:\s*/, '');
}

// Ouvre une modale. `contenuHtml` est inséré tel quel (déjà échappé par
// l'appelant). Retourne { fond, boite, fermer }. Ne se ferme PAS au clic
// extérieur si `protegee` est vrai (évite de perdre une saisie longue).
function fkModale(titre, contenuHtml, opts) {
  const o = opts || {};
  const fond = document.createElement('div');
  fond.className = 'fk-modale-fond';
  fond.innerHTML = `<div class="fk-modale" role="dialog" aria-modal="true" aria-labelledby="fkModaleTitre">
      <h2 id="fkModaleTitre">${fkEchapper(titre)}</h2>${contenuHtml}</div>`;
  document.body.appendChild(fond);
  const boite = fond.querySelector('.fk-modale');
  const precedent = document.activeElement;
  function fermer() { fond.remove(); document.removeEventListener('keydown', echap); if (precedent && precedent.focus) precedent.focus(); }
  function echap(e) { if (e.key === 'Escape' && !o.protegee) fermer(); }
  document.addEventListener('keydown', echap);
  if (!o.protegee) fond.addEventListener('click', e => { if (e.target === fond) fermer(); });
  fond.querySelectorAll('[data-fermer]').forEach(b => b.addEventListener('click', fermer));
  const premier = boite.querySelector('input, select, textarea, [contenteditable], button');
  if (premier) setTimeout(() => premier.focus(), 30);
  return { fond, boite, fermer };
}
function fkConfirmer(message, libelleOk) {
  return new Promise(resolve => {
    const m = fkModale('Confirmation', `<p>${fkEchapper(message)}</p>
      <div class="fk-actions-form"><button class="fk-btn fk-btn-ghost" data-non>Annuler</button>
      <button class="fk-btn fk-btn-primary" data-oui>${fkEchapper(libelleOk || 'Confirmer')}</button></div>`);
    m.boite.querySelector('[data-non]').onclick = () => { m.fermer(); resolve(false); };
    m.boite.querySelector('[data-oui]').onclick = () => { m.fermer(); resolve(true); };
  });
}
function fkDemanderTexte(titre, libelle, obligatoire) {
  return new Promise(resolve => {
    const m = fkModale(titre, `<label class="fk-champ"><span>${fkEchapper(libelle)}</span><textarea data-txt></textarea></label>
      <div class="fk-actions-form"><button class="fk-btn fk-btn-ghost" data-non>Annuler</button>
      <button class="fk-btn fk-btn-primary" data-oui>Valider</button></div>`, { protegee: true });
    m.boite.querySelector('[data-non]').onclick = () => { m.fermer(); resolve(null); };
    m.boite.querySelector('[data-oui]').onclick = () => {
      const v = m.boite.querySelector('[data-txt]').value.trim();
      if (obligatoire && v.length < 5) { fkToast('Merci de préciser (5 caractères minimum).', 'erreur'); return; }
      m.fermer(); resolve(v);
    };
  });
}

// ---------- Session ----------
let _fkSessionCache = null;
async function fkSession() {
  if (_fkSessionCache) return _fkSessionCache;
  const res = { session: null, profil: null, formateur: null, estGestionnaire: false };
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    res.session = session;
    if (session) {
      const { data: profil } = await supabaseClient.from('profils').select('*').eq('id', session.user.id).maybeSingle();
      if (profil && profil.actif !== false) {
        res.profil = profil;
        const [{ data: formateur }, { data: gest }] = await Promise.all([
          supabaseClient.from('formateurs').select('*').eq('id', profil.id).maybeSingle(),
          supabaseClient.rpc('peut_gerer_formations', { p_id: profil.id })
        ]);
        res.formateur = formateur || null;
        res.estGestionnaire = gest === true;
      }
    }
  } catch (_e) { /* visiteur : on continue sans session */ }
  _fkSessionCache = res;
  return res;
}
function fkUrlConnexion() {
  const ici = window.location.pathname.split('/').filter(Boolean);
  const idx = ici.lastIndexOf('pages');
  const relatif = (idx >= 0 ? ici.slice(idx) : ici.slice(-2)).join('/') + window.location.search;
  return `${FK_RACINE}pages/login.html?retour=${encodeURIComponent(relatif)}`;
}
function fkUrlInscription() {
  const ici = window.location.pathname.split('/').filter(Boolean);
  const idx = ici.lastIndexOf('pages');
  const relatif = (idx >= 0 ? ici.slice(idx) : ici.slice(-2)).join('/') + window.location.search;
  return `${FK_RACINE}pages/inscription.html?role=etudiant&retour=${encodeURIComponent(relatif)}`;
}
async function fkExigerConnexion() {
  const s = await fkSession();
  if (!s.profil) { window.location.href = fkUrlConnexion(); return null; }
  if (s.profil.doit_changer_mot_de_passe) { window.location.href = `${FK_RACINE}pages/changer-mot-de-passe-oblige.html`; return null; }
  return s;
}
async function fkDeconnexion() {
  await supabaseClient.auth.signOut();
  window.location.href = `${FK_BASE}index.html`;
}

// ---------- En-tête / pied de page ----------
async function fkRendreEntete(actif) {
  const header = document.getElementById('fkEntete');
  if (!header) return;
  const s = await fkSession();
  const p = s.profil;
  const estFormateur = s.formateur && s.formateur.statut === 'valide';
  const liens = [
    { id: 'accueil', href: `${FK_BASE}index.html`, label: 'Accueil' },
    { id: 'catalogue', href: `${FK_BASE}catalogue.html`, label: 'Formations' },
    p ? { id: 'apprentissage', href: `${FK_BASE}app/tableau-de-bord.html`, label: 'Mon apprentissage' } : null,
    estFormateur
      ? { id: 'formateur', href: `${FK_BASE}formateur/tableau-de-bord.html`, label: 'Espace formateur' }
      : { id: 'devenir', href: `${FK_BASE}devenir-formateur.html`, label: 'Devenir formateur' },
    s.estGestionnaire ? { id: 'admin', href: `${FK_RACINE}pages/admin/formations.html`, label: '🛠️ Admin' } : null
  ].filter(Boolean);

  const initiales = p ? `${(p.prenom || '?')[0]}${(p.nom || '')[0] || ''}`.toUpperCase() : '';
  const lienEspaceKekeli = p && p.role !== 'etudiant'
    ? `<a href="${typeof urlTableauDeBord === 'function' ? urlTableauDeBord(p.role) : FK_RACINE + 'index.html'}">🏫 Mon espace KEKELI</a>` : '';

  header.className = 'fk-header';
  header.innerHTML = `
    <a href="#fkContenu" class="fk-lien-evitement">Aller au contenu</a>
    <div class="fk-container fk-nav">
      <a class="fk-logo" href="${FK_BASE}index.html" aria-label="KEKELI Formation — accueil">
        <img src="${FK_RACINE}assets/logo/logo.png" alt="">
        <div><strong>KEKELI</strong><small class="fk-logo-sous">Formation</small></div>
      </a>
      <form class="fk-search" role="search" action="${FK_BASE}catalogue.html">
        <label class="fk-sr" for="fkRecherche">Rechercher une formation</label>
        <input id="fkRecherche" type="search" name="q" placeholder="Que souhaitez-vous apprendre ?" value="${fkEchapper(fkParam('q') || '')}">
        <button type="submit" aria-label="Rechercher">⌕</button>
      </form>
      <button class="fk-burger" type="button" aria-label="Menu" aria-expanded="false">☰</button>
      <nav class="fk-navlinks" aria-label="Navigation principale">
        ${liens.map(l => `<a href="${l.href}" class="${l.id === actif ? 'actif' : ''}" ${l.id === actif ? 'aria-current="page"' : ''}>${l.label}</a>`).join('')}
      </nav>
      <div class="fk-actions">
        ${p ? `
          <div id="fkZoneCloche"></div>
          <div class="fk-menu-compte">
            <button type="button" class="fk-menu-compte-btn" aria-haspopup="true" aria-expanded="false">👤 <span>${fkEchapper(p.prenom)}</span> ▾</button>
            <div class="fk-menu-compte-liste">
              <a href="${FK_BASE}app/tableau-de-bord.html">📘 Mon apprentissage</a>
              ${estFormateur ? `<a href="${FK_BASE}formateur/tableau-de-bord.html">👨‍🏫 Espace formateur</a><a href="${FK_BASE}formateur/profil.html">🪪 Profil formateur</a>` : ''}
              ${lienEspaceKekeli}
              <a href="${FK_RACINE}index.html">🏠 Accueil KEKELI</a>
              <hr>
              <button type="button" data-deconnexion>🚪 Déconnexion</button>
            </div>
          </div>` : `
          <a class="fk-btn fk-btn-outline" href="${fkUrlConnexion()}">Connexion</a>
          <a class="fk-btn fk-btn-primary" href="${fkUrlInscription()}">S'inscrire</a>`}
      </div>
    </div>`;
  header.querySelector('.fk-burger').addEventListener('click', e => {
    const ouvert = header.classList.toggle('menu-ouvert');
    e.currentTarget.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
  });
  const menu = header.querySelector('.fk-menu-compte');
  if (menu) {
    const btn = menu.querySelector('.fk-menu-compte-btn');
    btn.addEventListener('click', e => { e.stopPropagation(); const o = menu.classList.toggle('ouvert'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
    document.addEventListener('click', () => menu.classList.remove('ouvert'));
    menu.querySelector('[data-deconnexion]').addEventListener('click', fkDeconnexion);
  }
  if (p && typeof initClocheNotifications === 'function') {
    try { await initClocheNotifications('fkZoneCloche', p.id); } catch (_e) { /* cloche facultative */ }
  }
  if (!initiales) return;
}

function fkRendrePied() {
  const pied = document.getElementById('fkPied');
  if (!pied) return;
  pied.className = 'fk-footer';
  pied.innerHTML = `
    <div class="fk-container">
      <div class="fk-footer-grid">
        <div>
          <a class="fk-logo" href="${FK_BASE}index.html">
            <img src="${FK_RACINE}assets/logo/logo.png" alt="">
            <div><strong style="color:#fff">KEKELI</strong><small>L'éducation qui éclaire l'avenir</small></div>
          </a>
          <p style="line-height:1.7;color:#b8cbc5">Une plateforme pour apprendre, transmettre et développer les compétences.</p>
        </div>
        <div><h3>Apprendre</h3>
          <a href="${FK_BASE}catalogue.html">Toutes les formations</a>
          <a href="${FK_BASE}catalogue.html?gratuit=1">Formations gratuites</a>
          <a href="${FK_BASE}catalogue.html?tri=populaires">Formations populaires</a>
          <a href="${FK_BASE}app/tableau-de-bord.html">Mon apprentissage</a></div>
        <div><h3>Enseigner</h3>
          <a href="${FK_BASE}devenir-formateur.html">Devenir formateur</a>
          <a href="${FK_BASE}formateur/tableau-de-bord.html">Créer une formation</a>
          <a href="${FK_BASE}index.html#comment">Comment ça marche</a></div>
        <div><h3>KEKELI</h3>
          <a href="${FK_RACINE}index.html">Accueil KEKELI</a>
          <a href="${FK_RACINE}primaire.html">KEKELI Primaire</a>
          <a href="${FK_RACINE}pages/conditions-utilisation.html">Conditions d'utilisation</a>
          <a href="${FK_RACINE}pages/politique-confidentialite.html">Confidentialité</a></div>
      </div>
      <div class="fk-footer-bottom">
        <span>© ${new Date().getFullYear()} KEKELI. Tous droits réservés.</span>
        <span>L'éducation qui éclaire l'avenir.</span>
      </div>
    </div>`;
}

// ---------- Cartes formation ----------
const FK_SELECT_CARTE = 'id, slug, titre, sous_titre, image_couverture, prix, devise, niveau, duree_minutes, nb_lecons, nb_inscrits, note_moyenne, nb_avis, publiee_le, categorie_id, formation_categories(id, nom, icone, slug), formateurs(nom_affiche, slug)';

function fkStyleCouverture(f, i) {
  if (f.image_couverture) return { classe: '', style: `background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.25)),url('${fkEchapper(f.image_couverture)}')` };
  return { classe: ['', 'c1', 'c2', 'c3'][(Number(f.id) || i || 0) % 4], style: '' };
}
function fkCarteFormation(f, opts) {
  const o = opts || {};
  const cat = f.formation_categories;
  const cv = fkStyleCouverture(f);
  const lien = `${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}`;
  return `
    <article class="fk-course">
      ${o.favori !== undefined ? `<button class="fk-favori" type="button" data-favori="${f.id}" aria-pressed="${o.favori ? 'true' : 'false'}" aria-label="${o.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${o.favori ? '❤️' : '🤍'}</button>` : ''}
      <a href="${lien}" class="fk-cover ${cv.classe}" style="${cv.style}" tabindex="-1" aria-hidden="true">
        ${cat ? `<span class="fk-tag">${fkEchapper(cat.nom)}</span>` : ''}
        ${f.image_couverture ? '' : `<div class="fk-symbol">${fkEchapper(cat?.icone || '🎓')}</div>`}
      </a>
      <div class="fk-course-body">
        <h3><a href="${lien}">${fkEchapper(f.titre)}</a></h3>
        ${f.formateurs ? `<div class="fk-formateur-nom">par ${fkEchapper(f.formateurs.nom_affiche)}</div>` : ''}
        <div class="fk-meta"><span>📚 ${f.nb_lecons || 0} leçon${f.nb_lecons > 1 ? 's' : ''}</span><span>⏱️ ${fkDuree(f.duree_minutes)}</span><span>${FK_NIVEAUX[f.niveau] || ''}</span></div>
        <div class="fk-rating">${fkEtoiles(f.note_moyenne, f.nb_avis)}</div>
        <div class="fk-price"><strong>${fkPrix(f.prix, f.devise)}</strong><a class="fk-btn fk-btn-primary fk-btn-petit" href="${lien}">Voir</a></div>
      </div>
    </article>`;
}

// Branche les boutons ❤️ d'une grille de cartes.
function fkBrancherFavoris(conteneur, favorisIds, profilId) {
  conteneur.querySelectorAll('[data-favori]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      if (!profilId) { window.location.href = fkUrlConnexion(); return; }
      const id = Number(btn.dataset.favori);
      const estFavori = favorisIds.has(id);
      const { error } = estFavori
        ? await supabaseClient.from('formation_favoris').delete().eq('apprenant_id', profilId).eq('formation_id', id)
        : await supabaseClient.from('formation_favoris').insert({ apprenant_id: profilId, formation_id: id });
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      if (estFavori) favorisIds.delete(id); else favorisIds.add(id);
      btn.textContent = estFavori ? '🤍' : '❤️';
      btn.setAttribute('aria-pressed', estFavori ? 'false' : 'true');
      btn.setAttribute('aria-label', estFavori ? 'Ajouter aux favoris' : 'Retirer des favoris');
      fkToast(estFavori ? 'Retiré de vos favoris' : 'Ajouté à vos favoris', 'succes');
    });
  });
}
async function fkChargerFavoris(profilId) {
  if (!profilId) return new Set();
  const { data } = await supabaseClient.from('formation_favoris').select('formation_id').eq('apprenant_id', profilId);
  return new Set((data || []).map(x => x.formation_id));
}

// ---------- Types de questions de quiz ----------
// 25 septembre 2026 : les types de questions du site KEKELI (voir
// LIBELLES_TYPE_QUESTION dans js/editeur/blocs.js) sont disponibles dans
// les quiz de formation, avec les mêmes conventions de saisie (« ___ » pour
// un trou, etc.). Les types corrigés par IA (réponse longue, vrai/faux
// justifié) ne sont pas repris : un quiz de formation est corrigé
// automatiquement et immédiatement par le serveur.
const FK_TYPES_QUESTIONS = {
  choix_unique: { label: 'QCM (une seule bonne réponse)', icone: '🔘' },
  choix_multiple: { label: 'QCM à réponses multiples', icone: '☑️' },
  vrai_faux: { label: 'Vrai / Faux', icone: '⚖️' },
  reponse_courte: { label: 'Réponse courte', icone: '✏️' },
  reponse_numerique: { label: 'Réponse numérique / calcul', icone: '🔢' },
  texte_a_trous: { label: 'Texte à trous', icone: '🕳️' },
  texte_a_trous_glisser: { label: 'Texte à trous — banque de mots', icone: '🧩' },
  remise_en_ordre: { label: 'Remise en ordre', icone: '↕️' },
  association: { label: 'Association (relier des paires)', icone: '🔗' },
  classement: { label: 'Classement (trier en catégories)', icone: '🗂️' },
  intrus_lexical: { label: "Trouve l'intrus (séries de mots)", icone: '🕵️' },
  selection_mots: { label: 'Sélectionner des mots dans un texte', icone: '👆' }
};
const FK_TYPES_CHOIX = ['choix_unique', 'choix_multiple', 'vrai_faux'];
function fkNbTrous(t) { return (String(t || '').match(/___/g) || []).length; }
function fkMots(t) { return String(t || '').trim().split(/\s+/).filter(Boolean); }

// ---------- Médias ----------
// URL temporaire (1 h) pour un fichier privé du bucket "formations" : le
// serveur vérifie à chaque demande que l'utilisateur a le droit de le lire.
async function fkUrlFichier(chemin, telecharger) {
  const { data, error } = await supabaseClient.storage.from(FK_BUCKET_PRIVE)
    .createSignedUrl(chemin, 3600, telecharger ? { download: true } : undefined);
  if (error) return null;
  return data.signedUrl;
}
function fkIdYoutube(url) {
  const m = (url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function fkIdVimeo(url) {
  const m = (url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
// Retourne le HTML d'un lecteur vidéo pour une URL (YouTube, Vimeo, fichier
// hébergé "fichier:chemin" ou lien direct .mp4/.webm).
async function fkHtmlVideo(url) {
  if (!url) return '';
  const yt = fkIdYoutube(url);
  if (yt) return `<div class="fk-video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="Vidéo de la leçon" allowfullscreen loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture"></iframe></div>`;
  const vm = fkIdVimeo(url);
  if (vm) return `<div class="fk-video"><iframe src="https://player.vimeo.com/video/${vm}" title="Vidéo de la leçon" allowfullscreen loading="lazy"></iframe></div>`;
  let src = url;
  if (url.startsWith('fichier:')) src = await fkUrlFichier(url.slice(8));
  if (!src || !/^https:\/\//i.test(src)) return '<p class="fk-alerte fk-alerte-attention">Vidéo indisponible.</p>';
  return `<div class="fk-video"><video src="${fkEchapper(src)}" controls controlsList="nodownload" preload="metadata" playsinline></video></div>`;
}
async function fkHtmlAudio(url) {
  if (!url) return '';
  let src = url;
  if (url.startsWith('fichier:')) src = await fkUrlFichier(url.slice(8));
  if (!src || !/^https:\/\//i.test(src)) return '';
  return `<audio class="fk-audio" src="${fkEchapper(src)}" controls controlsList="nodownload" preload="metadata"></audio>`;
}

// Vérification avant envoi d'un fichier (extension, type, taille) — le
// bucket applique lui-même les mêmes limites côté serveur.
const FK_TYPES_FICHIERS = {
  video: { ext: ['mp4', 'webm'], max: 50 },
  audio: { ext: ['mp3', 'm4a', 'ogg', 'wav'], max: 50 },
  document: { ext: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'png', 'jpg', 'jpeg', 'webp'], max: 50 },
  image: { ext: ['png', 'jpg', 'jpeg', 'webp'], max: 5 }
};
function fkVerifierFichier(fichier, famille) {
  const regle = FK_TYPES_FICHIERS[famille];
  const ext = (fichier.name.split('.').pop() || '').toLowerCase();
  if (!regle.ext.includes(ext)) return `Format non accepté (.${ext}). Formats possibles : ${regle.ext.join(', ')}.`;
  if (fichier.size > regle.max * 1024 * 1024) return `Fichier trop lourd (max ${regle.max} Mo).`;
  return null;
}
function fkNomFichierSur(nom) {
  const ext = (nom.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = nom.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fichier';
  const alea = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
  return `${alea}-${base}.${ext}`;
}

// ---------- Éditeur riche ----------
// 25 septembre 2026 (demande du porteur du projet) : barre d'outils FIXE
// (reste visible en haut pendant qu'on fait défiler une longue leçon),
// couleurs du texte et surlignage, alignement gauche / centre / droite /
// justifié, titres, code, séparateur, annuler/rétablir, et lecture du
// Markdown et du HTML : import d'un fichier .md/.html/.txt, collage de
// Markdown ou de HTML, et bascule « Code HTML » pour voir/modifier la
// source. Tout ce qui entre est nettoyé par fkNettoyerHtml().
let _fkChargementsScripts = {};
function fkChargerScript(url) {
  if (!_fkChargementsScripts[url]) {
    _fkChargementsScripts[url] = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = url; s.onload = ok; s.onerror = () => { delete _fkChargementsScripts[url]; ko(new Error('Chargement impossible')); };
      document.head.appendChild(s);
    });
  }
  return _fkChargementsScripts[url];
}
async function fkMarkdownVersHtml(texte) {
  await fkChargerScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js');
  return window.marked.parse(String(texte || ''), { gfm: true, breaks: false });
}
// Devine le format d'un texte collé : HTML s'il contient des balises
// courantes, sinon Markdown.
function fkDevinerFormat(texte) {
  return /<\s*(p|div|h[1-6]|ul|ol|li|table|strong|em|b|i|br|span|a|img|blockquote|pre|html|body)\b[^>]*>/i.test(texte) ? 'html' : 'markdown';
}
// ---------- Collage depuis Word / Google Docs / LibreOffice (26 septembre 2026) ----------
// Demande : « quand on colle un document Word, l'éditeur garde le même
// formatage que le texte original ». Le HTML copié depuis Word décrit une
// grande partie de sa mise en forme dans une feuille <style> (styles
// « Titre 1 », « Normal »…) et fabrique ses listes avec des paragraphes
// spéciaux (mso-list). fkPreparerHtmlBureautique() :
//   1. applique en ligne les règles de cette feuille <style> (styles Word) ;
//   2. reconstruit les vraies listes à puces / numérotées, niveaux compris ;
//   3. retire les éléments propres à Office (commentaires, <o:p>, VML…).
// Le résultat passe ensuite par fkNettoyerHtml() : seules les propriétés de
// FK_STYLES_AUTORISES sont gardées (polices, tailles, couleurs, surlignage,
// gras/italique/souligné, alignement, retraits, interlignes, bordures de
// tableau…), jamais de script ni d'url().
function fkEstHtmlBureautique(html) {
  return /urn:schemas-microsoft-com:office|class="?Mso|mso-|docs-internal-guid|<meta[^>]+(Word|LibreOffice|OpenOffice|Google)/i.test(html || '');
}

function fkPreparerHtmlBureautique(html) {
  const doc = new DOMParser().parseFromString(String(html || '').replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, m => /supportLists/i.test(m) ? m.replace(/<!--\[if[^\]]*\]>|<!\[endif\]-->/gi, '') : ''), 'text/html');

  // 1) Styles de la feuille <style> Word -> en ligne (le style en ligne existant reste prioritaire).
  const regles = [];
  doc.querySelectorAll('style').forEach(st => {
    const css = st.textContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '');
    const re = /([^{}@]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const selecteurs = m[1].trim();
      if (!selecteurs || /^@|@page|@list|@font-face/i.test(selecteurs)) continue;
      regles.push({ selecteurs, decl: m[2].trim() });
    }
  });
  regles.forEach(r => {
    let els = [];
    try { els = [...doc.body.querySelectorAll(r.selecteurs)]; } catch (_e) { return; }
    els.forEach(el => { el.setAttribute('style', `${r.decl};${el.getAttribute('style') || ''}`); });
  });

  // 2) Listes Word (paragraphes « mso-list ») -> <ul>/<ol> imbriquées.
  const estItem = p => /mso-list\s*:\s*l\d+\s+level\d+/i.test(p.getAttribute('style') || '') || /MsoListParagraph/i.test(p.className || '');
  const niveau = p => { const m = /level(\d+)/i.exec(p.getAttribute('style') || ''); return m ? Number(m[1]) : 1; };
  [...doc.body.querySelectorAll('p')].forEach(p => {
    if (!p.isConnected || !estItem(p)) return;
    // Rassemble les paragraphes de liste consécutifs.
    // (une nouvelle liste Word — autre identifiant « lN » — commence un nouveau groupe)
    const idListe = el => { const m = /mso-list\s*:\s*(l\d+)/i.exec(el.getAttribute('style') || ''); return m ? m[1] : ''; };
    const groupe = [];
    let n = p;
    while (n && n.tagName === 'P' && estItem(n) && idListe(n) === idListe(p)) { groupe.push(n); n = n.nextElementSibling; }
    const pile = [];
    let racine = null;
    groupe.forEach(item => {
      const ignore = item.querySelector('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]');
      const marque = (ignore ? ignore.textContent : '').replace(/\s+/g, '');
      const ordonnee = /^(\d+|[a-z]{1,2}|[ivxlc]+)[.)]$/i.test(marque);
      if (ignore) {
        // Retire la puce/le numéro écrit par Word, et les <span> devenus vides autour.
        let parent = ignore.parentElement;
        ignore.remove();
        while (parent && parent !== item && !parent.textContent.trim() && !parent.querySelector('img')) { const pp = parent.parentElement; parent.remove(); parent = pp; }
      }
      const lvl = niveau(item);
      while (pile.length > lvl) pile.pop();
      while (pile.length < lvl) {
        const liste = doc.createElement(ordonnee ? 'ol' : 'ul');
        if (!pile.length) { racine = liste; item.before(liste); }
        else { const parentLi = pile[pile.length - 1].lastElementChild || pile[pile.length - 1].appendChild(doc.createElement('li')); parentLi.appendChild(liste); }
        pile.push(liste);
      }
      const li = doc.createElement('li');
      const st = (item.getAttribute('style') || '').replace(/mso-list[^;]*;?|margin-left[^;]*;?|text-indent[^;]*;?/gi, '');
      if (st.trim()) li.setAttribute('style', st);
      while (item.firstChild) li.appendChild(item.firstChild);
      pile[pile.length - 1].appendChild(li);
      item.remove();
    });
  });

  // 3) Nettoyage propre à Office / Google Docs.
  doc.body.querySelectorAll('[style*="mso-list:Ignore" i]').forEach(el => el.remove());
  doc.body.querySelectorAll('o\\:p, v\\:shape, v\\:imagedata, w\\:sdt, xml').forEach(el => el.replaceWith(...el.childNodes));
  // Google Docs entoure tout d'un <b style="font-weight:normal"> : on le déplie.
  doc.body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(el => el.replaceWith(...el.childNodes));
  // Titres Word (« Titre », « Titre 1… ») mis en forme par classe -> vrais titres.
  doc.body.querySelectorAll('p.MsoTitle').forEach(p => { const h = doc.createElement('h1'); h.setAttribute('style', p.getAttribute('style') || ''); h.append(...p.childNodes); p.replaceWith(h); });
  doc.body.querySelectorAll('p.MsoSubtitle').forEach(p => { const h = doc.createElement('h3'); h.setAttribute('style', p.getAttribute('style') || ''); h.append(...p.childNodes); p.replaceWith(h); });
  // Surlignage Word (mso-highlight) -> background-color.
  doc.body.querySelectorAll('[style*="mso-highlight" i]').forEach(el => {
    const m = /mso-highlight\s*:\s*([a-z#0-9]+)/i.exec(el.getAttribute('style'));
    if (m) el.setAttribute('style', `${el.getAttribute('style')};background-color:${m[1]}`);
  });
  // Images locales de Word (file://) : impossibles à reprendre -> retirées, signalées.
  let imagesPerdues = 0;
  doc.body.querySelectorAll('img').forEach(img => {
    if (/^https?:/i.test(img.getAttribute('src') || '')) return;
    imagesPerdues++;
    const bloc = img.closest('p');
    img.remove();
    if (bloc && !bloc.textContent.trim() && !bloc.querySelector('img')) bloc.remove();
  });
  return { html: doc.body.innerHTML, imagesPerdues };
}

// ---------- HTML importé ou collé : rendu fidèle (26 septembre 2026) ----------
// Demande : « l'aperçu HTML de l'éditeur des leçons ne rend pas fidèlement
// l'affichage ». Un fichier HTML (souvent produit par une IA) décrit son
// apparence dans une feuille <style> (classes, variables CSS, couleurs de
// fond, cartes arrondies, grilles…) que le nettoyage de sécurité retirait.
// fkHtmlStylesEnLigne() affiche d'abord ce HTML dans un cadre invisible SANS
// script (sandbox), lit le style réellement calculé par le navigateur pour
// chaque élément et le recopie en ligne (style="…") ; fkNettoyerHtml() ne
// garde ensuite que les propriétés autorisées (FK_STYLES_AUTORISES) —
// jamais de script, d'url(), de position ou de superposition.
const FK_STYLES_HERITES = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'letter-spacing', 'text-transform', 'font-variant', 'word-spacing', 'white-space', 'list-style-type', 'text-shadow'];
const FK_STYLES_BOITE = ['background-color', 'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'box-shadow',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'flex', 'grid-template-columns', 'max-width', 'text-decoration-line', 'vertical-align', 'border-collapse', 'opacity'];
function fkHtmlARendreFidelement(html) {
  return /<style[\s>]|<link[^>]+stylesheet|\sclass\s*=|var\(--/i.test(html || '');
}
async function fkHtmlStylesEnLigne(html, largeur) {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('sandbox', 'allow-same-origin'); // aucun script ne s'exécute
  cadre.setAttribute('aria-hidden', 'true');
  cadre.style.cssText = `position:fixed;left:-10000px;top:0;width:${largeur || 860}px;height:1200px;border:0;visibility:hidden`;
  const propre = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  cadre.srcdoc = /<html[\s>]/i.test(propre) ? propre : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${propre}</body></html>`;
  // Second cadre VIERGE : valeurs par défaut du navigateur, sans la feuille de style
  // de la page (sinon une règle « h2 { … } » s'appliquerait aussi au témoin).
  const vierge = document.createElement('iframe');
  vierge.setAttribute('sandbox', 'allow-same-origin');
  vierge.setAttribute('aria-hidden', 'true');
  vierge.style.cssText = cadre.style.cssText;
  vierge.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
  document.body.appendChild(cadre);
  document.body.appendChild(vierge);
  try {
    await Promise.all([cadre, vierge].map(f => new Promise(ok => { f.onload = ok; setTimeout(ok, 4000); })));
    const doc = cadre.contentDocument;
    if (!doc || !doc.body) return html;
    try { await Promise.race([doc.fonts.ready, new Promise(ok => setTimeout(ok, 1500))]); } catch (_e) { /* ignoré */ }
    const vue = cadre.contentWindow;
    // Valeurs par défaut du navigateur, balise par balise (dans le cadre vierge).
    const docV = vierge.contentDocument;
    const defauts = {};
    const defaut = tag => {
      if (!defauts[tag]) {
        const el = docV.createElement(tag);
        (/^(td|th)$/.test(tag) ? docV.body.appendChild(docV.createElement('table')).insertRow().appendChild(el).parentElement.closest('table') : docV.body.appendChild(el));
        const cs = vierge.contentWindow.getComputedStyle(el);
        defauts[tag] = Object.fromEntries(FK_STYLES_BOITE.map(p => [p, cs.getPropertyValue(p)]));
        docV.body.innerHTML = '';
      }
      return defauts[tag];
    };
    const vide = v => !v || v === 'none' || v === 'normal' || v === 'auto' || /^0(px)?$/.test(v) || v === 'rgba(0, 0, 0, 0)';
    const styles = new Map();
    const tous = [...doc.body.querySelectorAll('*')].filter(el => !/^(SCRIPT|STYLE|LINK|META|TITLE|NOSCRIPT|TEMPLATE|BR|WBR)$/.test(el.tagName));
    const px = v => parseFloat(v) || 0;
    // Largeur / hauteur voulues par l'auteur (pastilles, icônes, encadrés de chiffres…) :
    // on les repère en remettant provisoirement la dimension en « auto ».
    const tailleVoulue = (el, cs, prop) => {
      if (cs.display === 'inline' || /^(TD|TH|TR|TBODY|THEAD|TFOOT|TABLE|LI|UL|OL)$/.test(el.tagName)) return null;
      const avant = el.getAttribute('style');
      const r0 = el.getBoundingClientRect()[prop];
      el.style.setProperty(prop, 'auto', 'important');
      const r1 = el.getBoundingClientRect()[prop];
      if (avant === null) el.removeAttribute('style'); else el.setAttribute('style', avant);
      return Math.abs(r1 - r0) > 1 ? r0 : null;
    };
    const lireBoite = (cs, parentCs, d, el, pseudo) => {
      const decl = [];
      FK_STYLES_HERITES.forEach(p => {
        const v = cs.getPropertyValue(p);
        if (v && v !== parentCs.getPropertyValue(p)) decl.push([p, v]);
      });
      FK_STYLES_BOITE.forEach(p => {
        let v = cs.getPropertyValue(p);
        if (v === d[p]) return;
        if (/^border-(top|right|bottom|left)$/.test(p) && /^0px|none/.test(v)) { if (!pseudo && /^(TABLE|TD|TH)$/.test(el.tagName)) decl.push([p, 'none']); return; }
        if (p !== 'display' && p !== 'border-collapse' && !/^(margin|padding)/.test(p) && vide(v)) return;
        if (p === 'display' && !/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|list-item|table|table-row|table-cell|none)$/.test(v)) return;
        if (p === 'background-image' && /url\(/i.test(v)) return;
        if (p === 'grid-template-columns') {
          const pistes = v.split(/\s+(?![^(]*\))/);
          if (pistes.length > 1 && pistes.every(x => x === pistes[0])) v = `repeat(${pistes.length}, minmax(0, 1fr))`;
        }
        decl.push([p, v]);
      });
      ['min-width', 'min-height', 'align-self', 'flex-shrink', 'flex-grow'].forEach(p => {
        const v = cs.getPropertyValue(p);
        if (v && !/^(0px|auto|normal)$/.test(v) && !(p === 'flex-shrink' && v === '1') && !(p === 'flex-grow' && v === '0')) decl.push([p, v]);
      });
      // box-sizing toujours explicite quand il y a une taille (les leçons KEKELI sont en border-box).
      if (cs.getPropertyValue('box-sizing') === 'border-box' || /^(min-width|min-height)$/.test((decl.find(([p]) => /^min-/.test(p)) || [])[0] || '')) decl.push(['box-sizing', cs.getPropertyValue('box-sizing')]);
      return decl;
    };
    const lire = el => {
      const cs = vue.getComputedStyle(el);
      const parent = vue.getComputedStyle(el.parentElement || doc.body);
      const decl = lireBoite(cs, parent, defaut(el.tagName.toLowerCase()), el, false);
      // Dimensions fixées par l'auteur.
      const w = tailleVoulue(el, cs, 'width');
      if (w !== null && el.parentElement) {
        const dispo = el.parentElement.clientWidth - px(parent.paddingLeft) - px(parent.paddingRight);
        decl.push(['width', w > 160 && dispo > 0 ? `${Math.min(100, Math.round(w / dispo * 1000) / 10)}%` : cs.width]);
      }
      const h = tailleVoulue(el, cs, 'height');
      if (h !== null) decl.push([h <= 160 ? 'height' : 'min-height', cs.height]);
      if (w !== null || h !== null) decl.push(['box-sizing', cs.getPropertyValue('box-sizing')]);
      // Petit décalage « position: relative; top: -4px ».
      if (cs.position === 'relative') {
        const dec = ['top', 'left'].map(p => [p, cs.getPropertyValue(p)]).filter(([, v]) => v !== 'auto' && px(v) !== 0 && Math.abs(px(v)) <= 30);
        if (dec.length) decl.push(['position', 'relative'], ...dec);
      }
      // Tableau pleine largeur.
      if (el.tagName === 'TABLE' && el.parentElement) {
        const dispo = el.parentElement.clientWidth - px(parent.paddingLeft) - px(parent.paddingRight);
        if (dispo > 0 && el.offsetWidth / dispo > 0.97) decl.push(['width', '100%']);
      }
      // Centrage « margin: 0 auto » : le navigateur le calcule en pixels.
      const ml = decl.find(x => x[0] === 'margin-left'), mr = decl.find(x => x[0] === 'margin-right');
      if (ml && mr && ml[1] === mr[1] && cs.getPropertyValue('max-width') !== 'none') { ml[1] = 'auto'; mr[1] = 'auto'; }
      return decl;
    };
    tous.forEach(el => styles.set(el, lire(el)));

    // ::before / ::after (numéros d'étapes, coches ✔, icônes…) : le navigateur les
    // dessine sans qu'ils existent dans le texte — on les transforme en vrais <span>.
    // Les compteurs CSS (counter()) sont recalculés dans l'ordre du document.
    const compteurs = {};
    const lirePaires = v => {
      const r = [];
      if (!v || v === 'none') return r;
      const t = v.trim().split(/\s+/);
      for (let k = 0; k < t.length; k++) {
        const nom = t[k];
        let n = null;
        if (/^-?\d+$/.test(t[k + 1] || '')) { n = Number(t[k + 1]); k++; }
        r.push([nom, n]);
      }
      return r;
    };
    const romain = n => { const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let r = ''; t.forEach(([v, l]) => { while (n >= v) { r += l; n -= v; } }); return r; };
    const formater = (n, style) => {
      switch (style) {
        case 'decimal-leading-zero': return String(n).padStart(2, '0');
        case 'lower-alpha': case 'lower-latin': return String.fromCharCode(96 + ((n - 1) % 26) + 1);
        case 'upper-alpha': case 'upper-latin': return String.fromCharCode(64 + ((n - 1) % 26) + 1);
        case 'lower-roman': return romain(n);
        case 'upper-roman': return romain(n).toUpperCase();
        default: return String(n);
      }
    };
    const texteContenu = (c, el) => {
      if (!c || c === 'none' || c === 'normal') return null;
      let r = '', trouve = false;
      c.replace(/"((?:[^"\\]|\\.)*)"|counters?\(\s*([\w-]+)\s*(?:,\s*"([^"]*)")?\s*(?:,\s*([\w-]+))?\s*\)|attr\(\s*([\w-]+)\s*\)/g, (m, str, nom, sep, style, att) => {
        trouve = true;
        if (str !== undefined) r += str.replace(/\\([0-9a-f]{1,6})\s?/gi, (x, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
        else if (nom) r += formater(compteurs[nom] ?? 0, style);
        else if (att) r += el.getAttribute(att) || '';
        return '';
      });
      return trouve ? r : null;
    };
    const pseudos = [];
    tous.forEach(el => {
      const cs = vue.getComputedStyle(el);
      lirePaires(cs.counterReset).forEach(([n, v]) => { compteurs[n] = v ?? 0; });
      lirePaires(cs.counterIncrement).forEach(([n, v]) => { compteurs[n] = (compteurs[n] ?? 0) + (v ?? 1); });
      ['::before', '::after'].forEach(quel => {
        const ps = vue.getComputedStyle(el, quel);
        if (ps.display === 'none') return;
        const texte = texteContenu(ps.content, el);
        if (texte === null) return;
        const boite = ps.backgroundColor !== 'rgba(0, 0, 0, 0)' || ps.backgroundImage !== 'none' || px(ps.borderTopWidth) > 0 || px(ps.borderLeftWidth) > 0;
        if (!texte.trim() && !boite) return;
        const absolu = /^(absolute|fixed)$/.test(ps.position);
        if (absolu && !texte.trim() && quel === '::after') return; // décor flottant sans texte
        const decl = lireBoite(ps, cs, defaut('span'), el, true).filter(([p]) => !/^(margin-left|margin-right)$/.test(p) || !absolu);
        if (ps.display !== 'inline' || absolu) {
          const k = decl.findIndex(([p]) => p === 'display');
          if (k >= 0) decl.splice(k, 1);
          decl.push(['display', absolu ? (/flex/.test(ps.display) ? 'inline-flex' : 'inline-block') : ps.display]);
          decl.push(['box-sizing', ps.boxSizing]);
          if (ps.width !== 'auto' && px(ps.width) > 0) decl.push(['width', ps.width]);
          if (ps.height !== 'auto' && px(ps.height) > 0 && px(ps.height) <= 160) decl.push(['height', ps.height]);
          decl.push(['vertical-align', absolu ? 'middle' : ps.verticalAlign]);
        }
        const info = { el, quel, texte, decl };
        // Pastille placée en « position: absolute » dans la marge gauche de son parent
        // (liste d'étapes numérotées) : on la remet dans le texte, à la même place.
        if (absolu && quel === '::before' && ps.left !== 'auto') {
          const pl = px(cs.paddingLeft), l = Math.max(0, px(ps.left)), w = px(ps.width) || 0;
          if (pl >= l + w) info.retrait = { padding: `${l}px`, marge: `${Math.round(pl - l - w)}px` };
        }
        pseudos.push(info);
      });
    });

    // Puces et numéros de liste colorés (::marker) : remplacés par un <span>.
    const marqueurs = [];
    doc.body.querySelectorAll('ol > li, ul > li').forEach(li => {
      const cs = vue.getComputedStyle(li), mk = vue.getComputedStyle(li, '::marker');
      if (cs.display !== 'list-item' || cs.listStyleType === 'none') return;
      if (mk.color === cs.color && mk.fontWeight === cs.fontWeight && mk.fontSize === cs.fontSize) return;
      const liste = li.parentElement;
      const rang = [...liste.children].filter(x => x.tagName === 'LI').indexOf(li);
      const t = liste.tagName === 'OL' ? `${formater((Number(liste.getAttribute('start')) || 1) + rang, cs.listStyleType)}.` : ({ circle: '◦', square: '▪' }[cs.listStyleType] || '•');
      marqueurs.push({ li, liste, t, decl: [['color', mk.color], ['font-weight', mk.fontWeight], ['font-size', mk.fontSize]], largeur: px(vue.getComputedStyle(liste).paddingLeft) });
    });

    // Application (après toutes les lectures, pour ne pas fausser les mesures).
    pseudos.forEach(({ el, quel, texte, decl, retrait }) => {
      const sp = doc.createElement('span');
      sp.textContent = texte;
      if (retrait) { styles.get(el).push(['padding-left', retrait.padding]); decl.push(['margin-right', retrait.marge]); }
      styles.set(sp, decl);
      if (quel === '::before') el.insertBefore(sp, el.firstChild); else el.appendChild(sp);
    });
    marqueurs.forEach(({ li, liste, t, decl, largeur }) => {
      const sp = doc.createElement('span');
      sp.textContent = t;
      styles.set(sp, [...decl, ['display', 'inline-block'], ['box-sizing', 'border-box'], ['width', `${largeur}px`], ['text-align', 'right'], ['padding-right', '0.4em']]);
      li.insertBefore(sp, li.firstChild);
      styles.get(li).push(['list-style-type', 'none']);
      styles.get(liste).push(['padding-left', '0px']);
    });
    // Une même propriété déclarée deux fois : la dernière gagne.
    styles.forEach((decl, el) => styles.set(el, [...new Map(decl.map(x => [x[0], x])).values()]));
    // Le fond, la police et la couleur de la page elle-même : sur un bloc qui entoure le tout.
    const csBody = vue.getComputedStyle(doc.body);
    const csRacine = vue.getComputedStyle(doc.documentElement);
    const fond = csBody.getPropertyValue('background-color') !== 'rgba(0, 0, 0, 0)' ? csBody.getPropertyValue('background-color') : csRacine.getPropertyValue('background-color');
    const enveloppe = [['color', csBody.color], ['font-family', csBody.fontFamily], ['font-size', csBody.fontSize], ['line-height', csBody.lineHeight]];
    const fondImage = csBody.getPropertyValue('background-image');
    if (fond && fond !== 'rgba(0, 0, 0, 0)' && !/^rgb\(255, 255, 255\)$/.test(fond)) enveloppe.push(['background-color', fond], ['padding', '16px'], ['border-radius', '12px']);
    if (fondImage && fondImage !== 'none' && !/url\(/i.test(fondImage)) enveloppe.push(['background-image', fondImage], ['padding', '16px'], ['border-radius', '12px']);
    styles.forEach((decl, el) => {
      el.removeAttribute('class');
      el.removeAttribute('id');
      el.setAttribute('style', decl.map(([p, v]) => `${p}: ${v}`).join('; '));
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
    const corps = doc.body.innerHTML;
    return `<div style="${enveloppe.map(([p, v]) => `${p}: ${String(v).replace(/"/g, "'")}`).join('; ')}">${corps}</div>`;
  } catch (_e) {
    return html;
  } finally {
    cadre.remove();
    vierge.remove();
  }
}

async function fkConvertirEnHtml(texte, format) {
  const f = format === 'auto' || !format ? fkDevinerFormat(texte) : format;
  if (f === 'markdown') return fkNettoyerHtml(await fkMarkdownVersHtml(texte));
  if (f === 'texte') return fkTexteVersHtml(texte);
  if (fkEstHtmlBureautique(texte)) return fkNettoyerHtml(fkPreparerHtmlBureautique(texte).html);
  if (fkHtmlARendreFidelement(texte)) return fkNettoyerHtml(await fkHtmlStylesEnLigne(texte));
  const corps = /<body[^>]*>([\s\S]*)<\/body>/i.exec(texte);
  return fkNettoyerHtml(corps ? corps[1] : texte);
}

// Couleurs de fond (paragraphes, cellules, encadrés) et encadrés prédéfinis.
const FK_FONDS = ['#e8f5ef', '#fff6d6', '#e8f0fb', '#fdecea', '#f3e8ff', '#fff1e6', '#eef2f0', 'transparent'];
const FK_ENCADRES = [
  { cle: 'astuce', icone: '💡', titre: 'Astuce', fond: '#fff6d6' },
  { cle: 'info', icone: 'ℹ️', titre: 'Information', fond: '#e8f0fb' },
  { cle: 'retenir', icone: '✅', titre: 'À retenir', fond: '#e8f5ef' },
  { cle: 'attention', icone: '⚠️', titre: 'Attention', fond: '#fdecea' },
  { cle: 'exemple', icone: '📝', titre: 'Exemple', fond: '#f3e8ff' }
];
// Barres latérales (blockquote) : même rendu que le Markdown « > texte ».
const FK_BARRES = [
  { nom: 'verte', couleur: '#0b7a5c' }, { nom: 'bleue', couleur: '#1769aa' }, { nom: 'orange', couleur: '#e85d04' },
  { nom: 'rouge', couleur: '#c0392b' }, { nom: 'violette', couleur: '#673ab7' }, { nom: 'jaune', couleur: '#e0a800' }, { nom: 'grise', couleur: '#6c7b76' }
];
// Polices et tailles (26 septembre 2026). Polices présentes sur la plupart
// des ordinateurs et téléphones, chacune avec une police de secours.
const FK_POLICES = [
  { nom: 'Arial', valeur: 'Arial, Helvetica, sans-serif' },
  { nom: 'Calibri', valeur: 'Calibri, Carlito, Arial, sans-serif' },
  { nom: 'Verdana', valeur: 'Verdana, Geneva, sans-serif' },
  { nom: 'Tahoma', valeur: 'Tahoma, Verdana, sans-serif' },
  { nom: 'Trebuchet MS', valeur: "'Trebuchet MS', Arial, sans-serif" },
  { nom: 'Segoe UI', valeur: "'Segoe UI', Roboto, Arial, sans-serif" },
  { nom: 'Georgia', valeur: 'Georgia, serif' },
  { nom: 'Times New Roman', valeur: "'Times New Roman', Times, serif" },
  { nom: 'Garamond', valeur: "Garamond, 'EB Garamond', Georgia, serif" },
  { nom: 'Cambria', valeur: 'Cambria, Caladea, Georgia, serif' },
  { nom: 'Courier New', valeur: "'Courier New', Courier, monospace" },
  { nom: 'Comic Sans MS', valeur: "'Comic Sans MS', 'Comic Neue', cursive" },
  { nom: 'Impact', valeur: 'Impact, Haettenschweiler, sans-serif' }
];
const FK_TAILLES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '60px'];
const FK_COULEURS = ['#18302a', '#0b7a5c', '#1769aa', '#673ab7', '#c0392b', '#e85d04', '#b27700', '#6c7b76'];

// opts (25 septembre 2026) :
//   formationId : active le bouton 🖼️ Image (envoi dans formations-public/lecons/{id}/)
//   activites   : { leconId, liste, editer(id|null) => Promise<activite|null> }
//                 active le bouton 🧭 Test (tests / questionnaires au cœur de la leçon)
function fkEditeurRiche(conteneur, htmlInitial, placeholder, opts) {
  const o = opts || {};
  conteneur.innerHTML = `
    <div class="fk-riche">
      <div class="fk-riche-barre" role="toolbar" aria-label="Mise en forme">
        <select data-bloc title="Style du paragraphe" aria-label="Style du paragraphe">
          <option value="p">Paragraphe</option><option value="h2">Titre</option><option value="h3">Sous-titre</option>
          <option value="h4">Petit titre</option><option value="blockquote">Citation</option><option value="pre">Code</option>
        </select>
        <select data-police title="Police du texte sélectionné" aria-label="Police">
          <option value="">Police</option><option value="inherit">Par défaut</option>
          ${FK_POLICES.map(p => `<option value="${fkEchapper(p.valeur)}" style="font-family:${fkEchapper(p.valeur)}">${p.nom}</option>`).join('')}
        </select>
        <select data-taille title="Taille du texte sélectionné" aria-label="Taille du texte">
          <option value="">Taille</option><option value="defaut">Normale</option>
          ${FK_TAILLES.map(t => `<option value="${t}">${parseInt(t, 10)}</option>`).join('')}
        </select>
        <span class="fk-riche-sep"></span>
        <button type="button" data-cmd="bold" title="Gras (Ctrl+B)" aria-label="Gras"><b>G</b></button>
        <button type="button" data-cmd="italic" title="Italique (Ctrl+I)" aria-label="Italique"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Souligné (Ctrl+U)" aria-label="Souligné"><u>S</u></button>
        <button type="button" data-cmd="strikeThrough" title="Barré" aria-label="Barré"><s>ab</s></button>
        <span class="fk-riche-sep"></span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="couleur" title="Couleur du texte" aria-label="Couleur du texte"><span class="fk-riche-a">A</span><span class="fk-riche-pastille" data-apercu="couleur" style="background:#c0392b"></span></button>
          <span class="fk-riche-palette" data-palette="couleur" hidden>
            ${FK_COULEURS.map(c => `<button type="button" data-couleur="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}
            <label title="Autre couleur">🎨<input type="color" data-couleur-libre value="#c0392b"></label>
          </span>
        </span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="surlignage" title="Surligner" aria-label="Surligner">🖍️<span class="fk-riche-pastille" data-apercu="surlignage" style="background:#fff2a8"></span></button>
          <span class="fk-riche-palette" data-palette="surlignage" hidden>
            ${['#fff2a8', '#d4f5e4', '#dbeafe', '#fde2e2', '#f3e8ff', 'transparent'].map(c => `<button type="button" data-surlignage="${c}" style="background:${c === 'transparent' ? '#fff' : c}" aria-label="${c === 'transparent' ? 'Sans surlignage' : 'Surlignage ' + c}">${c === 'transparent' ? '✕' : ''}</button>`).join('')}
          </span>
        </span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="fond" title="Couleur de fond du paragraphe ou de l'encadré" aria-label="Couleur de fond">🎨<span class="fk-riche-pastille" data-apercu="fond" style="background:#e8f5ef"></span></button>
          <span class="fk-riche-palette" data-palette="fond" hidden>
            ${FK_FONDS.map(c => `<button type="button" data-fond="${c}" style="background:${c === 'transparent' ? '#fff' : c}" aria-label="${c === 'transparent' ? 'Sans fond' : 'Fond ' + c}">${c === 'transparent' ? '✕' : ''}</button>`).join('')}
            <label title="Autre couleur">🎨<input type="color" data-fond-libre value="#e8f5ef"></label>
          </span>
        </span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="bloc" title="Insérer un encadré coloré" aria-label="Insérer un encadré coloré">🟩 Encadré</button>
          <span class="fk-riche-palette fk-riche-liste" data-palette="bloc" hidden>
            ${FK_ENCADRES.map(b => `<button type="button" data-encadre="${b.cle}"><span class="fk-riche-puce" style="background:${b.fond}"></span>${b.icone} ${b.titre}</button>`).join('')}
            <button type="button" data-encadre="libre"><span class="fk-riche-puce" style="background:linear-gradient(90deg,#fde2e2,#dbeafe,#d4f5e4)"></span>🎨 Encadré de couleur libre…</button>
          </span>
        </span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="barre" title="Bloc avec barre latérale (citation, idée à mettre en valeur)" aria-label="Bloc avec barre latérale">▍ Bloc à barre</button>
          <span class="fk-riche-palette fk-riche-liste" data-palette="barre" hidden>
            ${FK_BARRES.map(b => `<button type="button" data-barre="${b.couleur}"><span class="fk-riche-puce" style="background:${b.couleur}"></span>Barre ${b.nom}</button>`).join('')}
            <button type="button" data-barre="retirer">✕ Retirer la barre du bloc</button>
          </span>
        </span>
        <span class="fk-riche-menu">
          <button type="button" data-menu="tableau" title="Tableau" aria-label="Tableau">▦ Tableau</button>
          <span class="fk-riche-palette fk-riche-liste" data-palette="tableau" hidden>
            <button type="button" data-tableau="inserer">➕ Insérer un tableau…</button>
            <button type="button" data-tableau="ligne-dessous">⬇︎ Ajouter une ligne dessous</button>
            <button type="button" data-tableau="ligne-dessus">⬆︎ Ajouter une ligne dessus</button>
            <button type="button" data-tableau="colonne-droite">➡︎ Ajouter une colonne à droite</button>
            <button type="button" data-tableau="colonne-gauche">⬅︎ Ajouter une colonne à gauche</button>
            <button type="button" data-tableau="suppr-ligne">✕ Supprimer la ligne</button>
            <button type="button" data-tableau="suppr-colonne">✕ Supprimer la colonne</button>
            <button type="button" data-tableau="suppr-tableau">🗑️ Supprimer le tableau</button>
          </span>
        </span>
        <span class="fk-riche-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Aligner à gauche" aria-label="Aligner à gauche">⬅︎</button>
        <button type="button" data-cmd="justifyCenter" title="Centrer" aria-label="Centrer">↔︎</button>
        <button type="button" data-cmd="justifyRight" title="Aligner à droite" aria-label="Aligner à droite">➡︎</button>
        <button type="button" data-cmd="justifyFull" title="Justifier" aria-label="Justifier">☰</button>
        <span class="fk-riche-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Liste à puces" aria-label="Liste à puces">• ≡</button>
        <button type="button" data-cmd="insertOrderedList" title="Liste numérotée" aria-label="Liste numérotée">1. ≡</button>
        <button type="button" data-cmd="createLink" title="Lien" aria-label="Insérer un lien">🔗</button>
        <button type="button" data-cmd="insertHorizontalRule" title="Séparateur" aria-label="Séparateur">―</button>
        <button type="button" data-cmd="removeFormat" title="Effacer la mise en forme" aria-label="Effacer la mise en forme">⌫</button>
        <button type="button" data-cmd="undo" title="Annuler (Ctrl+Z)" aria-label="Annuler">↶</button>
        <button type="button" data-cmd="redo" title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↷</button>
        <span class="fk-riche-sep"></span>
        <label class="fk-riche-import" title="Importer un fichier Markdown (.md) ou HTML (.html)">📥 Importer .md / .html<input type="file" data-import accept=".md,.markdown,.txt,.html,.htm,text/markdown,text/html,text/plain" hidden></label>
        <button type="button" data-coller title="Coller du Markdown ou du HTML">📋 Coller MD / HTML</button>
        <button type="button" data-source aria-pressed="false" title="Voir et modifier le code HTML">&lt;/&gt; Code</button>
        ${o.formationId || o.activites ? '<span class="fk-riche-sep"></span>' : ''}
        ${o.formationId ? '<button type="button" data-image-btn title="Insérer une image">🖼️ Image</button>' : ''}
        ${o.activites ? '<button type="button" data-activite-btn title="Insérer un test rapide ou un questionnaire à cet endroit de la leçon">🧭 Test / questionnaire</button>' : ''}
        ${o.diaporama ? `<span class="fk-riche-menu">
          <button type="button" data-menu="diapo" title="Diaporama et présentations PowerPoint" aria-label="Diaporama et présentations PowerPoint">🎞️ Diaporama</button>
          <span class="fk-riche-palette fk-riche-liste" data-palette="diapo" hidden>
            <button type="button" data-diapo="nouvelle">➕ Nouvelle diapositive ici</button>
            ${o.formationId ? '<button type="button" data-diapo="fichier">📊 Insérer un fichier PowerPoint ou PDF…</button>' : ''}
            <button type="button" data-diapo="lien">🔗 Insérer Google Slides / OneDrive…</button>
            <button type="button" data-diapo="apercu">👁️ Aperçu du diaporama</button>
          </span>
        </span>` : ''}
      </div>
      <div class="fk-riche-zone" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${fkEchapper(placeholder || 'Rédigez ici…')}"></div>
      <textarea class="fk-riche-source" spellcheck="false" aria-label="Code HTML" hidden></textarea>
    </div>`;
  const zone = conteneur.querySelector('.fk-riche-zone');
  const source = conteneur.querySelector('.fk-riche-source');
  const barre = conteneur.querySelector('.fk-riche-barre');
  zone.innerHTML = fkNettoyerHtml(htmlInitial || '');
  let modeSource = false;
  let selection = null;

  const memoriser = () => {
    const sel = window.getSelection();
    if (sel.rangeCount && zone.contains(sel.anchorNode)) selection = sel.getRangeAt(0).cloneRange();
  };
  const restaurer = () => {
    zone.focus();
    if (selection) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(selection); }
  };
  ['keyup', 'mouseup', 'input'].forEach(ev => zone.addEventListener(ev, memoriser));
  document.addEventListener('selectionchange', memoriser);
  // Les boutons ne volent pas la sélection du texte.
  barre.addEventListener('mousedown', e => { if (e.target.closest('button') && !e.target.closest('[data-source]')) e.preventDefault(); });

  const exec = (cmd, val) => {
    if (modeSource) { fkToast('Repassez en mode normal pour utiliser la mise en forme.', 'erreur'); return; }
    restaurer();
    try { document.execCommand('styleWithCSS', false, true); } catch (_e) { /* ancien navigateur */ }
    document.execCommand(cmd, false, val ?? null);
    memoriser();
  };

  barre.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.cmd === 'createLink') {
      const url = prompt('Adresse du lien (https://…)');
      if (url && /^https?:\/\//i.test(url)) exec('createLink', url);
      else if (url) fkToast('Le lien doit commencer par https://', 'erreur');
      return;
    }
    exec(b.dataset.cmd);
  }));
  barre.querySelector('[data-bloc]').addEventListener('change', e => { exec('formatBlock', e.target.value); e.target.value = 'p'; });

  // ----- Police et taille (26 septembre 2026) -----
  // S'appliquent au texte sélectionné (style en ligne font-family / font-size,
  // gardé par fkNettoyerHtml). Sans sélection, la police vaut pour la suite
  // de la frappe ; la taille, elle, demande une sélection.
  barre.querySelector('[data-police]').addEventListener('change', e => {
    const v = e.target.value; e.target.value = '';
    if (!v) return;
    exec('fontName', v);
    // Les anciennes polices à l'intérieur de la sélection cèdent la place.
    const sel = window.getSelection();
    if (sel.rangeCount && !sel.isCollapsed) {
      const r = sel.getRangeAt(0);
      zone.querySelectorAll('[style*="font-family"]').forEach(el => {
        const parent = el.parentElement && el.parentElement.closest('[style*="font-family"]');
        if (parent && zone.contains(parent) && r.intersectsNode(el) && parent.style.fontFamily.replace(/"/g, "'") === v.replace(/"/g, "'")) el.style.fontFamily = '';
      });
      zone.querySelectorAll('span:not([style]), span[style=""]').forEach(sp => sp.replaceWith(...sp.childNodes));
    }
    memoriser();
  });
  barre.querySelector('[data-taille]').addEventListener('change', e => {
    const v = e.target.value; e.target.value = '';
    if (!v) return;
    if (modeSource) { fkToast('Repassez en mode normal pour utiliser la mise en forme.', 'erreur'); return; }
    restaurer();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { fkToast('Sélectionnez d\'abord le texte à agrandir ou à réduire.', 'erreur'); return; }
    // Astuce classique : taille « 7 » provisoire, puis remplacée par la vraie taille.
    exec('fontSize', '7');
    const marques = [...zone.querySelectorAll('font[size="7"], [style*="xxx-large"]')];
    const gardes = [];
    marques.forEach(el => {
      let span = el;
      if (el.tagName === 'FONT') { span = document.createElement('span'); span.append(...el.childNodes); el.replaceWith(span); }
      span.style.fontSize = v === 'defaut' ? '' : v;
      span.querySelectorAll('[style*="font-size"]').forEach(d => { d.style.fontSize = ''; if (!d.getAttribute('style')) d.removeAttribute('style'); });
      span.querySelectorAll('font[size]').forEach(f => f.replaceWith(...f.childNodes));
      if (!span.getAttribute('style') && span.tagName === 'SPAN') { const enfants = [...span.childNodes]; span.replaceWith(...enfants); gardes.push(...enfants); } else gardes.push(span);
    });
    if (gardes.length) {
      const r = document.createRange(); r.setStartBefore(gardes[0]); r.setEndAfter(gardes[gardes.length - 1]);
      sel.removeAllRanges(); sel.addRange(r);
    }
    memoriser();
  });

  const fermerPalettes = () => barre.querySelectorAll('[data-palette]').forEach(p => { p.hidden = true; });
  barre.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const p = barre.querySelector(`[data-palette="${b.dataset.menu}"]`);
    const etait = !p.hidden;
    fermerPalettes();
    p.hidden = etait;
  }));
  document.addEventListener('click', e => { if (!barre.contains(e.target)) fermerPalettes(); });
  const appliquerCouleur = c => { exec('foreColor', c); barre.querySelector('[data-apercu="couleur"]').style.background = c; fermerPalettes(); };
  barre.querySelectorAll('[data-couleur]').forEach(b => b.addEventListener('click', () => appliquerCouleur(b.dataset.couleur)));
  barre.querySelector('[data-couleur-libre]').addEventListener('change', e => appliquerCouleur(e.target.value));
  barre.querySelectorAll('[data-surlignage]').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.surlignage;
    exec('hiliteColor', c);
    if (c !== 'transparent') barre.querySelector('[data-apercu="surlignage"]').style.background = c;
    fermerPalettes();
  }));

  // ----- Couleur de fond (25 septembre 2026) -----
  // S'applique au bloc où se trouve le curseur : l'encadré coloré s'il y en
  // a un, sinon la cellule de tableau, sinon le paragraphe/titre/élément de
  // liste. (Le surlignage 🖍️, lui, colore seulement le texte sélectionné.)
  function blocCourant(selecteur) {
    const sel = window.getSelection();
    let n = sel.rangeCount && zone.contains(sel.anchorNode) ? sel.anchorNode : (selection ? selection.startContainer : null);
    if (n && n.nodeType === 3) n = n.parentElement;
    const el = n && n.closest ? n.closest(selecteur) : null;
    return el && zone.contains(el) && el !== zone ? el : null;
  }
  const appliquerFond = c => {
    if (modeSource) return;
    restaurer();
    const cible = blocCourant('[data-bloc]') || blocCourant('td, th') || blocCourant('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div');
    if (!cible) { fkToast('Placez d\'abord le curseur dans le paragraphe à colorer.', 'erreur'); return; }
    cible.style.backgroundColor = c === 'transparent' ? '' : c;
    if (c !== 'transparent' && !cible.matches('[data-bloc], td, th')) { cible.style.padding = ''; cible.setAttribute('data-bloc', 'fond'); }
    if (c === 'transparent' && cible.getAttribute('data-bloc') === 'fond') cible.removeAttribute('data-bloc');
    if (c !== 'transparent') barre.querySelector('[data-apercu="fond"]').style.background = c;
    fermerPalettes(); memoriser();
  };
  barre.querySelectorAll('[data-fond]').forEach(b => b.addEventListener('click', () => appliquerFond(b.dataset.fond)));
  barre.querySelector('[data-fond-libre]').addEventListener('change', e => appliquerFond(e.target.value));

  // ----- Encadrés colorés -----
  function insererEncadre(fond, icone, titre) {
    const tete = titre ? `<p><strong>${fkEchapper(icone ? icone + ' ' : '')}${fkEchapper(titre)}</strong></p>` : '';
    inserer(`<div data-bloc="encadre" style="background-color: ${fond}">${tete}<p>Votre texte…</p></div><p><br></p>`);
    fermerPalettes();
  }
  barre.querySelectorAll('[data-encadre]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.encadre !== 'libre') { const e = FK_ENCADRES.find(x => x.cle === b.dataset.encadre); insererEncadre(e.fond, e.icone, e.titre); return; }
    fermerPalettes();
    const m = fkModale('Encadré de couleur', `
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Couleur de fond</span><input type="color" data-c value="#e8f0fb" style="width:100%;height:42px;border:1px solid #cfdbd6;border-radius:10px"></label>
        <label class="fk-champ"><span>Titre (facultatif)</span><input type="text" data-t maxlength="60" placeholder="Ex. Le saviez-vous ?"></label>
      </div>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Insérer</button></div>`);
    m.boite.querySelector('[data-ok]').addEventListener('click', () => {
      const c = m.boite.querySelector('[data-c]').value; const t = m.boite.querySelector('[data-t]').value.trim();
      m.fermer(); insererEncadre(c, '', t);
    });
  }));

  // ----- Blocs à barre latérale (25 septembre 2026) -----
  // Curseur dans un bloc à barre : change sa couleur (ou retire la barre).
  // Curseur dans un paragraphe/titre avec du texte : l'entoure d'une barre.
  // Sinon : insère un nouveau bloc vide à compléter.
  function actionBarre(couleur) {
    fermerPalettes();
    if (modeSource) { fkToast('Repassez en mode normal pour ajouter un bloc.', 'erreur'); return; }
    restaurer();
    const existant = blocCourant('blockquote');
    if (existant) {
      if (couleur === 'retirer') {
        const frag = document.createDocumentFragment();
        [...existant.childNodes].forEach(n => frag.appendChild(n));
        if (!existant.querySelector('p, h1, h2, h3, h4, ul, ol, div, table') && existant.textContent.trim()) {
          const p = document.createElement('p'); p.append(frag); existant.replaceWith(p);
        } else existant.replaceWith(frag);
      } else existant.style.borderLeftColor = couleur;
      memoriser(); return;
    }
    if (couleur === 'retirer') { fkToast('Le curseur n\'est pas dans un bloc à barre.', 'erreur'); return; }
    const para = blocCourant('p, h1, h2, h3, h4, h5, h6, pre');
    if (para && para.textContent.trim() && !para.closest('td, th, li')) {
      const bq = document.createElement('blockquote');
      bq.style.borderLeftColor = couleur;
      para.replaceWith(bq);
      bq.appendChild(para);
      memoriser(); return;
    }
    inserer(`<blockquote style="border-left-color: ${couleur}"><p>Votre texte…</p></blockquote><p><br></p>`);
  }
  barre.querySelectorAll('[data-barre]').forEach(b => b.addEventListener('click', () => actionBarre(b.dataset.barre)));

  // ----- Tableaux -----
  function actionTableau(action) {
    fermerPalettes();
    if (modeSource) { fkToast('Repassez en mode normal pour modifier un tableau.', 'erreur'); return; }
    if (action === 'inserer') {
      const m = fkModale('Insérer un tableau', `
        <div class="fk-grille-2">
          <label class="fk-champ"><span>Lignes</span><input type="number" data-l min="1" max="30" value="3"></label>
          <label class="fk-champ"><span>Colonnes</span><input type="number" data-c min="1" max="10" value="3"></label>
        </div>
        <label class="fk-case"><input type="checkbox" data-e checked> Première ligne = en-tête</label>
        <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Insérer</button></div>`);
      m.boite.querySelector('[data-ok]').addEventListener('click', () => {
        const nl = Math.min(30, Math.max(1, parseInt(m.boite.querySelector('[data-l]').value, 10) || 3));
        const nc = Math.min(10, Math.max(1, parseInt(m.boite.querySelector('[data-c]').value, 10) || 3));
        const entete = m.boite.querySelector('[data-e]').checked;
        const cell = t => `<${t}><br></${t}>`;
        const html = `<table>${entete ? `<thead><tr>${Array.from({ length: nc }, (_, i) => `<th>Titre ${i + 1}</th>`).join('')}</tr></thead>` : ''}<tbody>${Array.from({ length: entete ? Math.max(nl - 1, 1) : nl }, () => `<tr>${Array.from({ length: nc }, () => cell('td')).join('')}</tr>`).join('')}</tbody></table><p><br></p>`;
        m.fermer(); inserer(html);
      });
      return;
    }
    restaurer();
    const cellule = blocCourant('td, th');
    if (!cellule) { fkToast('Placez d\'abord le curseur dans une case du tableau.', 'erreur'); return; }
    const ligne = cellule.parentElement;
    const tableau = cellule.closest('table');
    const index = [...ligne.children].indexOf(cellule);
    if (action === 'ligne-dessous' || action === 'ligne-dessus') {
      const nouvelle = document.createElement('tr');
      [...ligne.children].forEach(() => { const td = document.createElement('td'); td.innerHTML = '<br>'; nouvelle.appendChild(td); });
      if (ligne.parentElement.tagName === 'THEAD') { const corps = tableau.tBodies[0] || tableau.appendChild(document.createElement('tbody')); corps.insertBefore(nouvelle, corps.firstChild); }
      else ligne.parentElement.insertBefore(nouvelle, action === 'ligne-dessous' ? ligne.nextSibling : ligne);
    } else if (action === 'colonne-droite' || action === 'colonne-gauche') {
      [...tableau.rows].forEach(tr => {
        const ref = tr.children[index];
        const c = document.createElement(tr.parentElement.tagName === 'THEAD' ? 'th' : 'td'); c.innerHTML = '<br>';
        tr.insertBefore(c, action === 'colonne-droite' ? (ref ? ref.nextSibling : null) : ref);
      });
    } else if (action === 'suppr-ligne') {
      if (tableau.rows.length <= 1) tableau.remove(); else ligne.remove();
    } else if (action === 'suppr-colonne') {
      if (ligne.children.length <= 1) tableau.remove(); else [...tableau.rows].forEach(tr => tr.children[index]?.remove());
    } else if (action === 'suppr-tableau') {
      tableau.remove();
    }
    memoriser();
  }
  barre.querySelectorAll('[data-tableau]').forEach(b => b.addEventListener('click', () => actionTableau(b.dataset.tableau)));

  // Insertion d'un morceau de HTML déjà nettoyé : à la position du curseur,
  // ou à la fin si le curseur n'est pas dans la zone.
  function inserer(html, remplacer) {
    if (modeSource) basculerSource();
    if (remplacer) { zone.innerHTML = html; memoriser(); return; }
    // Contenu en blocs (tableau, encadré, Markdown/HTML importé) : inséré
    // APRÈS le bloc de premier niveau où se trouve le curseur, jamais au
    // milieu d'un paragraphe ou d'une liste (execCommand('insertHTML')
    // découpe mal les blocs imbriqués).
    const modele = document.createElement('template');
    modele.innerHTML = html;
    const premier = modele.content.firstElementChild;
    let noeud = selection ? selection.startContainer : null;
    while (noeud && noeud.parentNode && noeud.parentNode !== zone) noeud = noeud.parentNode;
    if (noeud && noeud.parentNode === zone) zone.insertBefore(modele.content, noeud.nextSibling);
    else zone.appendChild(modele.content);
    // Curseur placé dans le premier élément inséré (1re case vide, sinon fin).
    // (repère non modifiable — test, saut de diapositive, présentation — : curseur dans le paragraphe qui suit)
    const repere = premier && premier.matches('[data-activite], [data-bloc="diapo"], [data-presentation]');
    const cible = premier && (repere ? premier.nextElementSibling : (premier.querySelector('td, [data-bloc] p:last-child, blockquote > p:last-child') || premier));
    if (cible) {
      const r = document.createRange(); r.selectNodeContents(cible); r.collapse(!cible.matches('td') ? false : true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); zone.focus();
    }
    memoriser();
  }

  barre.querySelector('[data-import]').addEventListener('change', async e => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    const ext = (fichier.name.split('.').pop() || '').toLowerCase();
    if (!['md', 'markdown', 'txt', 'html', 'htm'].includes(ext)) { fkToast('Formats acceptés : .md, .markdown, .txt, .html, .htm', 'erreur'); return; }
    if (fichier.size > 2 * 1024 * 1024) { fkToast('Fichier trop lourd (2 Mo maximum).', 'erreur'); return; }
    try {
      const texte = await fichier.text();
      // Page HTML complète (styles/scripts) : proposer de la garder telle quelle.
      if (o.surPageComplete && /^(html?|txt)$/.test(ext) && fkEstPageHtmlComplete(texte) && await o.surPageComplete(texte)) return;
      const html = await fkConvertirEnHtml(texte, ext === 'html' || ext === 'htm' ? 'html' : ext === 'txt' ? 'auto' : 'markdown');
      if (!html.trim()) { fkToast('Le fichier ne contient aucun texte exploitable.', 'erreur'); return; }
      const vide = !zone.textContent.trim();
      const remplacer = vide ? true : await fkConfirmer(`Remplacer tout le contenu actuel par « ${fichier.name} » ? (Annuler = ajouter à la position du curseur)`, 'Remplacer');
      inserer(html, remplacer);
      fkToast(`« ${fichier.name} » importé.`, 'succes');
    } catch (err) { fkToast(`Import impossible : ${err.message}`, 'erreur'); }
  });

  barre.querySelector('[data-coller]').addEventListener('click', () => {
    const m = fkModale('Coller du Markdown ou du HTML', `
      <label class="fk-champ"><span>Texte à convertir</span>
        <textarea data-texte style="min-height:220px;font-family:ui-monospace,Consolas,monospace;font-size:13px" placeholder="# Titre&#10;&#10;Un paragraphe avec du **gras**, de l'*italique* et une liste :&#10;- premier point&#10;- second point"></textarea></label>
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Format</span><select data-format>
          <option value="auto">Détection automatique</option><option value="markdown">Markdown</option><option value="html">HTML</option><option value="texte">Texte brut</option></select></label>
        <label class="fk-champ"><span>Où l'insérer ?</span><select data-ou>
          <option value="curseur">À la position du curseur</option><option value="remplacer">Remplacer tout le contenu</option></select></label>
      </div>
      <div class="fk-champ"><span>Aperçu</span><div class="fk-lecon-corps fk-riche-apercu" data-apercu-conv><p style="color:var(--f-muted)">L'aperçu s'affiche ici.</p></div></div>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Insérer</button></div>`, { protegee: true });
    m.boite.style.width = 'min(860px, 100%)';
    const txt = m.boite.querySelector('[data-texte]');
    const fmt = m.boite.querySelector('[data-format]');
    const apercu = m.boite.querySelector('[data-apercu-conv]');
    let minuteur = null;
    const majApercu = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(async () => {
        if (!txt.value.trim()) { apercu.innerHTML = '<p style="color:var(--f-muted)">L\'aperçu s\'affiche ici.</p>'; return; }
        try { apercu.innerHTML = await fkConvertirEnHtml(txt.value, fmt.value); } catch (err) { apercu.textContent = err.message; }
      }, 250);
    };
    txt.addEventListener('input', majApercu);
    fmt.addEventListener('change', majApercu);
    m.boite.querySelector('[data-ok]').addEventListener('click', async () => {
      if (!txt.value.trim()) { fkToast('Collez d\'abord un texte.', 'erreur'); return; }
      if (o.surPageComplete && fmt.value !== 'markdown' && fkEstPageHtmlComplete(txt.value)) {
        const code = txt.value;
        m.fermer();
        if (await o.surPageComplete(code)) return;
        inserer(await fkConvertirEnHtml(code, 'html'), false);
        return;
      }
      try {
        const html = await fkConvertirEnHtml(txt.value, fmt.value);
        m.fermer();
        inserer(html, m.boite.querySelector('[data-ou]').value === 'remplacer');
      } catch (err) { fkToast(`Conversion impossible : ${err.message}`, 'erreur'); }
    });
  });

  const btnSource = barre.querySelector('[data-source]');
  function basculerSource() {
    modeSource = !modeSource;
    if (modeSource) {
      source.value = lireHtmlPropre(true).replace(/></g, '>\n<');
      source.style.minHeight = Math.max(180, zone.offsetHeight) + 'px';
    } else {
      zone.innerHTML = fkNettoyerHtml(source.value);
    }
    source.hidden = !modeSource;
    zone.hidden = modeSource;
    btnSource.setAttribute('aria-pressed', String(modeSource));
    btnSource.classList.toggle('actif', modeSource);
    barre.classList.toggle('mode-source', modeSource);
  }
  btnSource.addEventListener('click', basculerSource);

  // Collage : on garde la mise en forme (HTML nettoyé) ; du Markdown collé
  // en texte brut est détecté et converti.
  zone.addEventListener('paste', async e => {
    const cd = e.clipboardData || window.clipboardData;
    const html = cd.getData('text/html');
    const texte = cd.getData('text/plain');
    e.preventDefault();
    // Code d'une page HTML collé (depuis un éditeur de code, le Bloc-notes…) : le
    // texte brut EST le code — même si l'éditeur de code a aussi fourni une version colorée.
    if (fkEstPageHtmlComplete(texte)) {
      if (o.surPageComplete && await o.surPageComplete(texte)) return;
      collerHtml(await fkConvertirEnHtml(texte, 'html'));
      return;
    }
    if (html) {
      let propre;
      if (fkEstHtmlBureautique(html)) {
        const r = fkPreparerHtmlBureautique(html);
        propre = fkNettoyerHtml(r.html);
        if (r.imagesPerdues) fkToast(`${r.imagesPerdues} image(s) de Word n'ont pas pu être reprises : ajoutez-les avec le bouton 🖼️ Image.`, 'erreur');
      } else if (/<style[\s>]/i.test(html)) propre = fkNettoyerHtml(await fkHtmlStylesEnLigne(html, zone.clientWidth || 860));
      else propre = fkNettoyerHtml(html);
      collerHtml(propre);
      return;
    }
    if (!html && /^\s*<(div|p|section|article|table|ul|ol|h[1-6]|span|main|header)\b[^>]*>[\s\S]*<\/\1>\s*$/i.test(texte)) {
      collerHtml(await fkConvertirEnHtml(texte, 'html'));
      return;
    }
    if (/^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:/m.test(texte)) {
      try { document.execCommand('insertHTML', false, await fkConvertirEnHtml(texte, 'markdown')); return; } catch (_e) { /* repli texte */ }
    }
    document.execCommand('insertText', false, texte);
  });

  // Collage : du contenu en blocs (paragraphes, titres, listes, tableaux)
  // remplace le paragraphe vide où se trouve le curseur, sinon s'insère juste
  // après le paragraphe courant ; du texte en ligne s'insère au curseur.
  // Insertion faite directement dans le document (et non par
  // execCommand('insertHTML'), qui perd une partie des styles).
  function collerHtml(propre) {
    const modele = document.createElement('template');
    modele.innerHTML = propre;
    const blocs = modele.content.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, div, figure, hr');
    const sel = window.getSelection();
    if (!blocs) { document.execCommand('insertHTML', false, propre); memoriser(); return; }
    let noeud = sel.rangeCount && zone.contains(sel.anchorNode) ? sel.anchorNode : null;
    if (sel.rangeCount && !sel.isCollapsed && zone.contains(sel.anchorNode)) sel.getRangeAt(0).deleteContents();
    while (noeud && noeud.parentNode && noeud.parentNode !== zone) noeud = noeud.parentNode;
    const dernier = modele.content.lastChild;
    if (noeud && noeud.parentNode === zone) {
      const vide = noeud.nodeType === 1 && !noeud.textContent.trim() && !noeud.querySelector('img, table, [data-activite]');
      if (vide) noeud.replaceWith(modele.content); else zone.insertBefore(modele.content, noeud.nextSibling);
    } else zone.appendChild(modele.content);
    if (dernier && dernier.parentNode) {
      const r = document.createRange(); r.selectNodeContents(dernier.nodeType === 1 ? dernier : dernier.parentNode); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
    memoriser();
  }

  // ----- Images au cœur de la leçon (25 septembre 2026) -----
  barre.querySelector('[data-image-btn]')?.addEventListener('click', () => {
    if (modeSource) { fkToast('Repassez en mode normal pour insérer une image.', 'erreur'); return; }
    const m = fkModale('Insérer une image', `
      <label class="fk-champ"><span>Image depuis votre appareil</span><input type="file" data-fichier accept="image/png,image/jpeg,image/webp,image/gif"><small>PNG, JPG, WEBP ou GIF, 5 Mo maximum.</small></label>
      <label class="fk-champ"><span>… ou adresse d'une image en ligne</span><input type="url" data-url placeholder="https://…"></label>
      <label class="fk-champ"><span>Description de l'image (pour l'accessibilité) *</span><input type="text" data-alt maxlength="200" placeholder="Ex. Schéma du ruban d'Excel"></label>
      <label class="fk-champ"><span>Légende (facultatif, affichée sous l'image)</span><input type="text" data-legende maxlength="200"></label>
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Taille</span><select data-taille><option value="petite">Petite</option><option value="moyenne" selected>Moyenne</option><option value="grande">Pleine largeur</option></select></label>
        <label class="fk-champ"><span>Position</span><select data-align><option value="left">À gauche</option><option value="center" selected>Centrée</option><option value="right">À droite</option></select></label>
      </div>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Insérer</button></div>`, { protegee: true });
    m.boite.querySelector('[data-ok]').addEventListener('click', async ev => {
      const fichier = m.boite.querySelector('[data-fichier]').files[0];
      let url = m.boite.querySelector('[data-url]').value.trim();
      const alt = m.boite.querySelector('[data-alt]').value.trim();
      const legende = m.boite.querySelector('[data-legende]').value.trim();
      if (!alt) { fkToast('Décrivez l\'image en quelques mots.', 'erreur'); return; }
      if (fichier) {
        const err = !/\.(png|jpe?g|webp|gif)$/i.test(fichier.name) ? 'Format accepté : PNG, JPG, WEBP ou GIF.' : fichier.size > 5 * 1024 * 1024 ? 'Image trop lourde (5 Mo maximum).' : null;
        if (err) { fkToast(err, 'erreur'); return; }
        ev.currentTarget.disabled = true; ev.currentTarget.textContent = 'Envoi…';
        const chemin = `lecons/${o.formationId}/${fkNomFichierSur(fichier.name)}`;
        const { error } = await supabaseClient.storage.from(FK_BUCKET_PUBLIC).upload(chemin, fichier, { contentType: fichier.type });
        if (error) { fkToast(fkMessageErreur(error), 'erreur'); ev.currentTarget.disabled = false; ev.currentTarget.textContent = 'Insérer'; return; }
        url = supabaseClient.storage.from(FK_BUCKET_PUBLIC).getPublicUrl(chemin).data.publicUrl;
      }
      if (!/^https:\/\//i.test(url)) { fkToast('Choisissez une image ou une adresse https://', 'erreur'); return; }
      const taille = m.boite.querySelector('[data-taille]').value;
      const align = m.boite.querySelector('[data-align]').value;
      m.fermer();
      inserer(`<figure data-image="${taille}" style="text-align: ${align}"><img src="${fkEchapper(url)}" alt="${fkEchapper(alt)}">${legende ? `<figcaption>${fkEchapper(legende)}</figcaption>` : ''}</figure><p><br></p>`);
    });
  });

  // ----- Diaporama et présentations PowerPoint (26 septembre 2026) -----
  // « ➕ Nouvelle diapositive » pose un repère <div data-bloc="diapo"> : chez
  // l'étudiant, la leçon est alors découpée en diapositives (Précédent /
  // Suivant, plein écran). Une présentation est un repère
  // <div data-presentation="pdf|pptx|lien" data-src="…" title="…"> remplacé
  // par une visionneuse à l'affichage.
  function decorerDiapos() {
    const diapos = [...zone.querySelectorAll('[data-bloc="diapo"]')];
    diapos.forEach((el, i) => {
      el.setAttribute('contenteditable', 'false');
      el.className = 'fk-diapo-repere';
      el.innerHTML = `<span>🎞️ Diapositive ${i + 2}</span><small>cliquer pour retirer ce saut</small>`;
    });
    zone.classList.toggle('fk-riche-diapos', diapos.length > 0);
    if (diapos.length) zone.dataset.diapo1 = '🎞️ Diapositive 1'; else delete zone.dataset.diapo1;
    zone.querySelectorAll('[data-presentation]').forEach(el => {
      el.setAttribute('contenteditable', 'false');
      el.className = 'fk-presentation-repere';
      const nat = { pdf: '📄 Présentation PDF', pptx: '📊 Présentation PowerPoint', lien: '🔗 Présentation en ligne' }[el.dataset.presentation] || '📊 Présentation';
      el.innerHTML = `<b>${nat}</b><br><span>${fkEchapper(el.getAttribute('title') || '')}</span><small>Cliquer pour retirer</small>`;
    });
  }
  zone.addEventListener('click', async e => {
    const d = e.target.closest('[data-bloc="diapo"], [data-presentation]');
    if (!d || !zone.contains(d)) return;
    const estDiapo = d.matches('[data-bloc="diapo"]');
    if (!await fkConfirmer(estDiapo ? 'Retirer ce saut de diapositive ? (le contenu est conservé)' : 'Retirer cette présentation de la leçon ?', 'Retirer')) return;
    d.remove(); decorerDiapos(); memoriser();
  });

  async function actionDiapo(action) {
    fermerPalettes();
    if (modeSource) { fkToast('Repassez en mode normal pour utiliser le diaporama.', 'erreur'); return; }
    if (action === 'nouvelle') {
      restaurer();
      inserer('<div data-bloc="diapo"></div><p><br></p>');
      decorerDiapos();
      if (zone.querySelectorAll('[data-bloc="diapo"]').length === 1) fkToast('Le contenu au-dessus du repère forme la diapositive 1, celui en dessous la diapositive 2.', 'succes');
      return;
    }
    if (action === 'apercu') {
      const t = document.createElement('div');
      t.className = 'fk-lecon-corps';
      t.innerHTML = lireHtmlPropre();
      const m = fkModale('Aperçu du diaporama', '<div data-ici></div><div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-primary" data-fermer>Fermer</button></div>');
      m.boite.style.width = 'min(960px, 100%)';
      m.boite.querySelector('[data-ici]').appendChild(t);
      t.querySelectorAll('[data-activite]').forEach(el => { el.className = 'fk-activite-repere'; el.innerHTML = '<b>🧭 Test / questionnaire</b><small>affiché ici pour l\'étudiant</small>'; });
      await fkPreparerCorpsLecon(t);
      if (!t.querySelector('.fk-diapo')) fkToast('Aucun saut de diapositive : la leçon s\'affichera sur une seule page.', 'erreur');
      return;
    }
    if (action === 'lien') {
      const m = fkModale('Présentation Google Slides / OneDrive', `
        <p style="margin-top:0;font-size:14px;color:var(--f-muted)">
          <b>Google Slides</b> : Fichier → Partager → Publier sur le Web → Intégrer, ou simplement le lien de partage (accès « Tous les utilisateurs disposant du lien »).<br>
          <b>PowerPoint en ligne / OneDrive</b> : Fichier → Partager → <b>Incorporer</b>, puis collez le code obtenu.</p>
        <label class="fk-champ"><span>Lien ou code d'intégration *</span><textarea data-l rows="3" placeholder="https://docs.google.com/presentation/d/…   ou   <iframe src=&quot;https://onedrive.live.com/embed?…&quot;>"></textarea></label>
        <label class="fk-champ"><span>Titre (facultatif)</span><input type="text" data-t maxlength="120"></label>
        <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Insérer</button></div>`, { protegee: true });
      m.boite.querySelector('[data-ok]').addEventListener('click', () => {
        const emb = fkUrlEmbedPresentation(m.boite.querySelector('[data-l]').value);
        if (!emb) { fkToast('Lien non reconnu. Sont acceptés : Google Slides, OneDrive, SharePoint et PowerPoint en ligne (adresse https).', 'erreur'); return; }
        const titre = m.boite.querySelector('[data-t]').value.trim() || emb.nom;
        m.fermer();
        inserer(`<div data-presentation="lien" data-src="${fkEchapper(emb.url)}" title="${fkEchapper(titre)}"></div><p><br></p>`);
        decorerDiapos();
      });
      return;
    }
    if (action === 'fichier') {
      const m = fkModale('Présentation PowerPoint ou PDF', `
        <p style="margin-top:0;font-size:14px;color:var(--f-muted)">L'étudiant la verra diapositive par diapositive, directement dans la leçon.
          <b>Conseil :</b> le <b>PDF</b> (dans PowerPoint : Fichier → Exporter → PDF) s'affiche partout, même avec une connexion faible, et garde exactement vos polices.
          Un fichier <b>.pptx</b> est affiché par la visionneuse en ligne de Microsoft.</p>
        <label class="fk-champ"><span>Fichier (.pdf, .pptx ou .ppt — 50 Mo maximum) *</span><input type="file" data-f accept=".pdf,.pptx,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"></label>
        <label class="fk-champ"><span>Titre (facultatif)</span><input type="text" data-t maxlength="120"></label>
        <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Envoyer et insérer</button></div>`, { protegee: true });
      m.boite.querySelector('[data-ok]').addEventListener('click', async ev => {
        const f = m.boite.querySelector('[data-f]').files[0];
        if (!f) { fkToast('Choisissez un fichier.', 'erreur'); return; }
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const types = { pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint' };
        if (!types[ext]) { fkToast('Formats acceptés : .pdf, .pptx, .ppt', 'erreur'); return; }
        if (f.size > 50 * 1024 * 1024) { fkToast('Fichier trop lourd (50 Mo maximum).', 'erreur'); return; }
        const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Envoi…';
        const chemin = `${o.formationId}/presentations/${fkNomFichierSur(f.name)}`;
        const { error } = await supabaseClient.storage.from(FK_BUCKET_PRIVE).upload(chemin, f, { contentType: types[ext] });
        if (error) { fkToast(fkMessageErreur(error), 'erreur'); btn.disabled = false; btn.textContent = 'Envoyer et insérer'; return; }
        const titre = m.boite.querySelector('[data-t]').value.trim() || f.name.replace(/\.[^.]+$/, '');
        m.fermer();
        inserer(`<div data-presentation="${ext === 'pdf' ? 'pdf' : 'pptx'}" data-src="fichier:${fkEchapper(chemin)}" title="${fkEchapper(titre)}"></div><p><br></p>`);
        decorerDiapos();
        fkToast('Présentation ajoutée. Pensez à enregistrer la leçon.', 'succes');
      });
    }
  }
  barre.querySelectorAll('[data-diapo]').forEach(b => b.addEventListener('click', () => actionDiapo(b.dataset.diapo)));

  // HTML propre : les repères (tests, diapositives, présentations) sont vidés
  // de l'habillage ajouté pour l'éditeur.
  function lireHtmlPropre(depuisZone) {
    const t = document.createElement('template');
    t.innerHTML = fkNettoyerHtml(modeSource && !depuisZone ? source.value : zone.innerHTML);
    t.content.querySelectorAll('[data-activite], [data-bloc="diapo"], [data-presentation]').forEach(el => { el.innerHTML = ''; el.removeAttribute('class'); });
    return t.innerHTML.trim();
  }

  // ----- Tests / questionnaires au cœur de la leçon -----
  // Dans le texte, un test est un simple repère <div data-activite="ID">
  // (non modifiable au clavier) ; son contenu (question, corrigé…) vit en base
  // (formation_activites_lecon). Cliquer sur le repère le modifie.
  function decorerActivites() {
    if (!o.activites) return;
    zone.querySelectorAll('[data-activite]').forEach(el => {
      const a = (o.activites.liste || []).find(x => String(x.id) === el.dataset.activite);
      el.setAttribute('contenteditable', 'false');
      el.className = 'fk-activite-repere';
      el.innerHTML = a ? `<b>${{ controle: '🧭 Point de contrôle', reflexion: '💭 Réflexion', questionnaire: '📋 Questionnaire d\'auto-évaluation', fiche: '📝 Fiche d\'exercice' }[a.nature]}${a.bloquant ? ' · 🔒 bloquant' : ''}</b><br><span>${fkEchapper(a.titre || a.enonce || '').slice(0, 140)}</span><small>Cliquer pour modifier · touche Suppr pour retirer</small>`
        : '<b>🧭 Test introuvable</b><small>Supprimez ce repère.</small>';
    });
  }
  zone.addEventListener('click', async e => {
    const el = e.target.closest('[data-activite]');
    if (!el || !o.activites) return;
    const a = await o.activites.editer(Number(el.dataset.activite));
    if (a === 'supprime') el.remove();
    decorerActivites();
  });
  barre.querySelector('[data-activite-btn]')?.addEventListener('click', async () => {
    if (modeSource) { fkToast('Repassez en mode normal pour insérer un test.', 'erreur'); return; }
    if (!o.activites.leconId) { fkToast('Enregistrez d\'abord la leçon, puis rouvrez-la pour ajouter un test.', 'erreur'); return; }
    const a = await o.activites.editer(null);
    if (a && a.id) { inserer(`<div data-activite="${a.id}"></div><p><br></p>`); decorerActivites(); }
  });
  decorerActivites();
  decorerDiapos();
  btnSource.addEventListener('click', () => { if (!modeSource) { decorerActivites(); decorerDiapos(); } });

  return {
    zone,
    idsActivites: () => [...new Set([...(modeSource ? new DOMParser().parseFromString(source.value, 'text/html') : zone).querySelectorAll('[data-activite]')].map(el => Number(el.dataset.activite)))],
    lireHtml: () => lireHtmlPropre(),
    desactiver: () => { zone.contentEditable = 'false'; barre.querySelectorAll('button, select, input').forEach(el => { el.disabled = true; }); }
  };
}

// ---------- Leçon « page HTML complète » (26 septembre 2026) ----------
// Demande : « pour n'importe quel code HTML, tout doit marcher parfaitement
// comme l'original » (mise en page, animations, minuteur en JavaScript…).
// La page est affichée TELLE QUELLE dans un cadre isolé :
//   sandbox="allow-scripts …" SANS allow-same-origin → les scripts de la page
//   tournent, mais dans une « origine » à part : ils ne peuvent ni lire la
//   session de l'étudiant, ni toucher au reste du site.
// Un petit script « pont » ajouté à la page :
//   - ajuste la hauteur du cadre à son contenu (pas de double barre de défilement) ;
//   - remplace localStorage/sessionStorage (interdits dans un cadre isolé) par
//     une copie gardée par le site, pour que les pages qui s'en servent marchent ;
//   - mémorise ce que l'étudiant écrit ou coche dans la page (exercices) et le
//     lui remet à sa prochaine visite (sur cet appareil) ;
//   - ouvre les liens externes dans un nouvel onglet.
function fkEstPageHtmlComplete(texte) {
  const t = String(texte || '');
  return /<script[\s>]/i.test(t) || (/<style[\s>]/i.test(t) && /<\/?(html|body|head)[\s>]/i.test(t)) || /^\s*<!doctype html/i.test(t);
}
function fkPontPageHtml(stockage) {
  const init = JSON.stringify(stockage || {}).replace(/</g, '\\u003c');
  return `<script>(function(){
var P=window.parent,D=document;
function memoire(init,persiste){var d=Object.assign({},init||{});return{
getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},
setItem:function(k,v){d[String(k)]=String(v);persiste&&P.postMessage({kekeli:'stockage',v:d},'*');},
removeItem:function(k){delete d[String(k)];persiste&&P.postMessage({kekeli:'stockage',v:d},'*');},
clear:function(){d={};persiste&&P.postMessage({kekeli:'stockage',v:d},'*');},
key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};}
try{Object.defineProperty(window,'localStorage',{value:memoire(${init},true),configurable:true});}catch(e){}
try{Object.defineProperty(window,'sessionStorage',{value:memoire({},false),configurable:true});}catch(e){}
function hauteur(){var b=D.body,h=Math.max(D.documentElement.scrollHeight,b?b.scrollHeight:0);P.postMessage({kekeli:'hauteur',h:h},'*');}
function champs(){return Array.prototype.slice.call(D.querySelectorAll('input:not([type=button]):not([type=submit]):not([type=file]),textarea,select'));}
function lire(){return champs().map(function(el){return(el.type==='checkbox'||el.type==='radio')?el.checked:el.value;});}
function envoyer(){P.postMessage({kekeli:'champs',v:lire()},'*');}
D.addEventListener('input',envoyer,true);D.addEventListener('change',envoyer,true);
D.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'||/^javascript:/i.test(h))return;a.setAttribute('target','_blank');a.setAttribute('rel','noopener');},true);
window.addEventListener('message',function(e){if(e.source!==P||!e.data||e.data.kekeli!=='restaurer')return;var v=e.data.v||[];champs().forEach(function(el,i){if(v[i]===undefined||v[i]===null)return;if(el.type==='checkbox'||el.type==='radio')el.checked=!!v[i];else el.value=v[i];});hauteur();});
window.addEventListener('load',function(){hauteur();P.postMessage({kekeli:'pret'},'*');});
window.addEventListener('resize',hauteur);
D.addEventListener('DOMContentLoaded',function(){hauteur();try{new ResizeObserver(hauteur).observe(D.documentElement);}catch(e){setInterval(hauteur,1000);}});
})();<\/script>`;
}
// Insère le pont tout au début de <head> (avant les scripts de la page).
function fkPageAvecPont(html, stockage) {
  const pont = fkPontPageHtml(stockage);
  const src = String(html || '');
  if (/<head[^>]*>/i.test(src)) return src.replace(/<head[^>]*>/i, m => m + pont);
  if (/<html[^>]*>/i.test(src)) return src.replace(/<html[^>]*>/i, m => m + '<head>' + pont + '</head>');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${pont}</head><body>${src}</body></html>`;
}
// Affiche la page dans `conteneur`. opts.cle : clé de mémorisation (réponses
// de l'étudiant, localStorage de la page) ; sans clé, rien n'est mémorisé.
function fkAfficherPageHtml(conteneur, html, opts) {
  const o = opts || {};
  const lireMemo = () => { try { return JSON.parse(localStorage.getItem(o.cle) || '{}'); } catch (_e) { return {}; } };
  const ecrireMemo = m => { try { localStorage.setItem(o.cle, JSON.stringify(m)); } catch (_e) { /* stockage plein ou interdit */ } };
  const memo = o.cle ? lireMemo() : {};
  const cadre = document.createElement('iframe');
  cadre.className = 'fk-page-html';
  cadre.title = o.titre || 'Contenu de la leçon';
  cadre.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads');
  cadre.setAttribute('allow', 'fullscreen; autoplay; clipboard-write');
  cadre.setAttribute('allowfullscreen', '');
  cadre.setAttribute('referrerpolicy', 'no-referrer');
  cadre.style.height = (o.hauteurInitiale || 600) + 'px';
  cadre.srcdoc = fkPageAvecPont(html, memo.stockage);
  let hausses = 0, derniere = 0, debut = Date.now();
  const ecoute = e => {
    if (e.source !== cadre.contentWindow || !e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (d.kekeli === 'hauteur') {
      const h = Math.min(60000, Math.max(120, Math.ceil(Number(d.h) || 0)));
      // Garde-fou : une page en « 100vh » pourrait grandir sans fin avec son cadre.
      if (h > derniere + 2) { hausses++; if (hausses > 40 && Date.now() - debut < 8000) return; }
      if (Math.abs(h - derniere) > 2) { derniere = h; cadre.style.height = h + 'px'; }
    } else if (d.kekeli === 'pret' && o.cle && Array.isArray(memo.champs)) {
      cadre.contentWindow.postMessage({ kekeli: 'restaurer', v: memo.champs }, '*');
    } else if (d.kekeli === 'champs' && o.cle && Array.isArray(d.v)) {
      memo.champs = d.v.map(v => (typeof v === 'string' ? v.slice(0, 20000) : !!v)).slice(0, 500); ecrireMemo(memo);
    } else if (d.kekeli === 'stockage' && o.cle && d.v && typeof d.v === 'object') {
      const s = JSON.stringify(d.v);
      if (s.length < 500000) { memo.stockage = d.v; ecrireMemo(memo); }
    }
  };
  window.addEventListener('message', ecoute);
  conteneur.innerHTML = '';
  conteneur.appendChild(cadre);
  // Nettoyage quand le cadre quitte la page (changement de leçon).
  const obs = new MutationObserver(() => { if (!cadre.isConnected) { window.removeEventListener('message', ecoute); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return cadre;
}

// ---------- Diaporama et présentations PowerPoint (26 septembre 2026) ----------
// Demande : « prévoir l'utilisation des dispositifs comme PowerPoint ».
// Trois possibilités, toutes insérées depuis le menu 🎞️ Diaporama de
// l'éditeur de leçon :
//   1. Diaporama intégré : des repères <div data-bloc="diapo"> découpent la
//      leçon en diapositives (Précédent / Suivant, clavier, glisser du doigt,
//      plein écran, ou « Tout afficher » sur une page).
//   2. Fichier PowerPoint (.pptx/.ppt) ou PDF exporté depuis PowerPoint,
//      rangé dans le bucket privé : PDF affiché page par page par PDF.js ;
//      .pptx affiché par la visionneuse en ligne de Microsoft (lien signé 1 h).
//   3. Lien Google Slides / OneDrive / SharePoint / PowerPoint en ligne :
//      seule une adresse reconstruite pour ces domaines est intégrée.
const FK_PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';

// Lien ou code <iframe> collé -> { url d'intégration sûre, nom } ou null.
function fkUrlEmbedPresentation(brut) {
  let s = String(brut || '').trim();
  const m = /src\s*=\s*["']([^"']+)["']/i.exec(s);
  if (m) s = m[1];
  s = s.replace(/&amp;/g, '&');
  let u;
  try { u = new URL(s); } catch (_e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'docs.google.com') {
    let g = /^\/presentation\/d\/e\/([\w-]{10,})/.exec(u.pathname);
    if (g) return { url: `https://docs.google.com/presentation/d/e/${g[1]}/embed?start=false&loop=false&delayms=5000`, nom: 'Google Slides' };
    g = /^\/presentation\/d\/([\w-]{10,})/.exec(u.pathname);
    if (g) return { url: `https://docs.google.com/presentation/d/${g[1]}/embed?start=false&loop=false&delayms=5000`, nom: 'Google Slides' };
    return null;
  }
  if (h === 'onedrive.live.com') {
    if (u.pathname.toLowerCase() === '/embed') return { url: u.toString(), nom: 'PowerPoint (OneDrive)' };
    const resid = u.searchParams.get('resid') || u.searchParams.get('id');
    if (!resid) return null;
    const e = new URL('https://onedrive.live.com/embed');
    e.searchParams.set('resid', resid);
    ['cid', 'authkey'].forEach(k => { if (u.searchParams.get(k)) e.searchParams.set(k, u.searchParams.get(k)); });
    e.searchParams.set('em', '2');
    return { url: e.toString(), nom: 'PowerPoint (OneDrive)' };
  }
  if (h === '1drv.ms') {
    if (!u.searchParams.has('em') && !u.searchParams.has('embed')) u.searchParams.set('embed', '1');
    return { url: u.toString(), nom: 'PowerPoint (OneDrive)' };
  }
  if (/^[a-z0-9-]+(-my)?\.sharepoint\.com$/.test(h)) {
    if (!/embed/i.test(u.search + u.pathname)) u.searchParams.set('action', 'embedview');
    return { url: u.toString(), nom: 'PowerPoint (SharePoint)' };
  }
  if (/^([a-z0-9-]+\.)?officeapps\.live\.com$/.test(h) && /^\/(op|p)\//i.test(u.pathname)) return { url: u.toString(), nom: 'PowerPoint en ligne' };
  return null;
}

function fkPleinEcran(el) {
  const actif = document.fullscreenElement || document.webkitFullscreenElement;
  if (actif) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (el.classList.contains('fk-plein-ecran')) { el.classList.remove('fk-plein-ecran'); document.body.classList.remove('fk-sans-defilement'); el.dispatchEvent(new Event('fkplein')); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  // iPhone : pas de plein écran pour un élément -> la visionneuse couvre la page.
  if (req) req.call(el).catch(() => { el.classList.add('fk-plein-ecran'); document.body.classList.add('fk-sans-defilement'); el.dispatchEvent(new Event('fkplein')); });
  else { el.classList.add('fk-plein-ecran'); document.body.classList.add('fk-sans-defilement'); el.dispatchEvent(new Event('fkplein')); }
}
function fkGlisser(el, gauche, droite) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    // stopPropagation : une présentation PDF dans une diapositive ne fait pas aussi tourner le diaporama.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.stopPropagation(); (dx < 0 ? droite : gauche)(); }
  });
}

// 1. Diaporama intégré. Retourne le contrôleur (ou null s'il n'y a pas de
// saut de diapositive). corps._fkDiapo.maj() est rappelé après chaque
// réponse à un test bloquant (une diapositive masquée ne peut être atteinte).
function fkDiaporama(corps) {
  const reperes = [...corps.querySelectorAll('[data-bloc="diapo"]')];
  if (!reperes.length) return null;
  const groupes = [[]];
  [...corps.childNodes].forEach(n => {
    if (n.nodeType === 1 && n.matches('[data-bloc="diapo"]')) { groupes.push([]); n.remove(); return; }
    groupes[groupes.length - 1].push(n);
  });
  corps.querySelectorAll('[data-bloc="diapo"]').forEach(n => n.remove()); // repères imbriqués
  const pleins = groupes.filter(g => g.some(n => n.nodeType === 1 || (n.textContent || '').trim()));
  if (pleins.length < 2) { pleins.forEach(g => g.forEach(n => corps.appendChild(n))); return null; }
  corps.innerHTML = '';
  pleins.forEach(g => { const s = document.createElement('section'); s.className = 'fk-diapo'; g.forEach(n => s.appendChild(n)); corps.appendChild(s); });

  const cadre = document.createElement('div');
  cadre.className = 'fk-diaporama-cadre';
  cadre.tabIndex = 0;
  cadre.setAttribute('role', 'region');
  cadre.setAttribute('aria-roledescription', 'diaporama');
  corps.before(cadre);
  cadre.appendChild(corps);
  corps.classList.add('fk-diaporama');
  cadre.insertAdjacentHTML('beforeend', `
    <div class="fk-diapo-progres" aria-hidden="true"><span></span></div>
    <div class="fk-diapo-nav">
      <button type="button" class="fk-btn fk-btn-outline fk-btn-petit" data-prec aria-label="Diapositive précédente">◀ <span>Précédent</span></button>
      <span class="fk-diapo-compteur" aria-live="polite"></span>
      <button type="button" class="fk-btn fk-btn-primary fk-btn-petit" data-suiv aria-label="Diapositive suivante"><span>Suivant</span> ▶</button>
      <span class="fk-diapo-outils">
        <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-plein title="Plein écran" aria-label="Plein écran">⛶</button>
        <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-tout title="Afficher toute la leçon sur une seule page" aria-pressed="false">📄 Tout afficher</button>
      </span>
    </div>`);
  const diapos = [...corps.children].filter(c => c.classList.contains('fk-diapo'));
  const btnP = cadre.querySelector('[data-prec]'), btnS = cadre.querySelector('[data-suiv]');
  const compteur = cadre.querySelector('.fk-diapo-compteur'), barreP = cadre.querySelector('.fk-diapo-progres span');
  let i = 0, tout = false;
  const maj = () => {
    diapos.forEach((d, k) => d.classList.toggle('actif', k === i));
    const suivanteMasquee = diapos[i + 1] && diapos[i + 1].hidden;
    btnP.disabled = i === 0;
    btnS.disabled = i >= diapos.length - 1 || suivanteMasquee;
    compteur.innerHTML = suivanteMasquee ? `${i + 1} / ${diapos.length} · <b>🔒 répondez au test pour continuer</b>` : `${i + 1} / ${diapos.length}`;
    barreP.style.width = `${((i + 1) / diapos.length) * 100}%`;
  };
  const aller = k => {
    if (tout || k < 0 || k >= diapos.length || diapos[k].hidden) return;
    i = k; maj();
    corps.scrollTop = 0;
    if (!document.fullscreenElement && !cadre.classList.contains('fk-plein-ecran')) {
      const haut = cadre.getBoundingClientRect().top;
      if (haut < 0) window.scrollBy({ top: haut - 80, behavior: 'smooth' });
    }
  };
  btnP.addEventListener('click', () => aller(i - 1));
  btnS.addEventListener('click', () => aller(i + 1));
  cadre.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); aller(i + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); aller(i - 1); }
    if (e.key === 'Escape' && cadre.classList.contains('fk-plein-ecran')) fkPleinEcran(cadre);
  });
  fkGlisser(corps, () => aller(i - 1), () => aller(i + 1));
  cadre.querySelector('[data-plein]').addEventListener('click', () => { fkPleinEcran(cadre); cadre.focus(); });
  cadre.querySelector('[data-tout]').addEventListener('click', e => {
    tout = !tout;
    corps.classList.toggle('fk-diaporama', !tout);
    cadre.classList.toggle('fk-diapo-tout', tout);
    e.currentTarget.setAttribute('aria-pressed', String(tout));
    e.currentTarget.textContent = tout ? '🎞️ Mode diaporama' : '📄 Tout afficher';
    maj();
  });
  maj();
  corps._fkDiapo = { maj, aller, diapos };
  return corps._fkDiapo;
}

// 2. Visionneuse PDF (PDF.js), page par page.
async function fkVisionneusePdf(el, url, titre) {
  el.innerHTML = `<div class="fk-pres-cadre" tabindex="0">
      <div class="fk-pres-tete"><b>📄 ${fkEchapper(titre || 'Présentation')}</b></div>
      <div class="fk-pres-scene"><canvas aria-label="${fkEchapper(titre || 'Présentation')}"></canvas><p class="fk-pres-charge">Chargement de la présentation…</p></div>
      <div class="fk-diapo-nav">
        <button type="button" class="fk-btn fk-btn-outline fk-btn-petit" data-prec aria-label="Diapositive précédente">◀ <span>Précédent</span></button>
        <span class="fk-diapo-compteur" aria-live="polite"></span>
        <button type="button" class="fk-btn fk-btn-primary fk-btn-petit" data-suiv aria-label="Diapositive suivante"><span>Suivant</span> ▶</button>
        <span class="fk-diapo-outils"><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-plein title="Plein écran" aria-label="Plein écran">⛶</button></span>
      </div></div>`;
  const cadre = el.querySelector('.fk-pres-cadre');
  const canvas = el.querySelector('canvas');
  const scene = el.querySelector('.fk-pres-scene');
  const compteur = el.querySelector('.fk-diapo-compteur');
  let doc, page = 1, rendu = null;
  try {
    await fkChargerScript(FK_PDFJS + 'pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = FK_PDFJS + 'pdf.worker.min.js';
    doc = await window.pdfjsLib.getDocument({ url, isEvalSupported: false }).promise;
  } catch (_e) {
    scene.innerHTML = `<p class="fk-alerte fk-alerte-attention">La présentation n'a pas pu être affichée. <a href="${fkEchapper(url)}" target="_blank" rel="noopener">Ouvrir le fichier</a></p>`;
    return;
  }
  el.querySelector('.fk-pres-charge')?.remove();
  const dessiner = async () => {
    const p = await doc.getPage(page);
    const plein = document.fullscreenElement === cadre || cadre.classList.contains('fk-plein-ecran');
    const base = p.getViewport({ scale: 1 });
    const largeur = scene.clientWidth || 800;
    const hauteurMax = plein ? window.innerHeight - 110 : Infinity;
    const echelle = Math.min(largeur / base.width, hauteurMax / base.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = p.getViewport({ scale: echelle * dpr });
    if (rendu) { try { rendu.cancel(); } catch (_e) { /* déjà fini */ } }
    canvas.width = vp.width; canvas.height = vp.height;
    canvas.style.width = `${vp.width / dpr}px`; canvas.style.height = `${vp.height / dpr}px`;
    rendu = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    try { await rendu.promise; } catch (_e) { /* rendu annulé */ }
    compteur.textContent = `${page} / ${doc.numPages}`;
    el.querySelector('[data-prec]').disabled = page <= 1;
    el.querySelector('[data-suiv]').disabled = page >= doc.numPages;
  };
  const aller = k => { if (k < 1 || k > doc.numPages) return; page = k; dessiner(); };
  el.querySelector('[data-prec]').addEventListener('click', () => aller(page - 1));
  el.querySelector('[data-suiv]').addEventListener('click', () => aller(page + 1));
  cadre.addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); aller(page + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); aller(page - 1); }
    if (e.key === 'Escape' && cadre.classList.contains('fk-plein-ecran')) fkPleinEcran(cadre);
  });
  fkGlisser(scene, () => aller(page - 1), () => aller(page + 1));
  el.querySelector('[data-plein]').addEventListener('click', () => { fkPleinEcran(cadre); cadre.focus(); });
  let minuteur;
  const redessiner = () => { clearTimeout(minuteur); minuteur = setTimeout(dessiner, 150); };
  window.addEventListener('resize', redessiner);
  document.addEventListener('fullscreenchange', redessiner);
  cadre.addEventListener('fkplein', redessiner);
  await dessiner();
}

// Remplace les repères de présentation par leur visionneuse.
async function fkRendrePresentations(corps) {
  const reperes = [...corps.querySelectorAll('[data-presentation]')];
  for (const el of reperes) {
    const nature = el.dataset.presentation;
    const src = el.getAttribute('data-src') || '';
    const titre = el.getAttribute('title') || '';
    el.removeAttribute('title');
    el.className = 'fk-presentation';
    el.innerHTML = '';
    const cadreIframe = (url, note) => `<div class="fk-pres-cadre fk-pres-iframe">
        <div class="fk-pres-tete"><b>📊 ${fkEchapper(titre || 'Présentation')}</b><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-plein title="Plein écran" aria-label="Plein écran">⛶</button></div>
        <div class="fk-video"><iframe src="${fkEchapper(url)}" title="${fkEchapper(titre || 'Présentation')}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>${note || ''}</div>`;
    if (nature === 'lien') {
      const emb = fkUrlEmbedPresentation(src);
      el.innerHTML = emb ? cadreIframe(emb.url) : '<p class="fk-alerte fk-alerte-attention">Présentation indisponible (lien non reconnu).</p>';
    } else if (nature === 'pdf' || nature === 'pptx') {
      const chemin = src.startsWith('fichier:') ? src.slice(8) : '';
      const url = /^\d+\/presentations\/[\w.-]+$/.test(chemin) ? await fkUrlFichier(chemin) : null;
      if (!url) { el.innerHTML = '<p class="fk-alerte fk-alerte-attention">Présentation indisponible.</p>'; continue; }
      if (nature === 'pdf') { fkVisionneusePdf(el, url, titre); continue; }
      el.innerHTML = cadreIframe(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
        `<p class="fk-pres-note">Affichage par la visionneuse Microsoft. Si rien n'apparaît, <a href="${fkEchapper(url)}" target="_blank" rel="noopener">téléchargez la présentation</a>.</p>`);
    } else { el.remove(); continue; }
    const btn = el.querySelector('[data-plein]');
    if (btn) btn.addEventListener('click', () => fkPleinEcran(el.querySelector('.fk-pres-cadre')));
  }
}

// À appeler sur le corps d'une leçon affichée (lecteur, aperçu).
async function fkPreparerCorpsLecon(corps) {
  fkDiaporama(corps);
  await fkRendrePresentations(corps);
}

// ---------- Ouverture progressive (26 septembre 2026) ----------
// « Un module par jour, pour empêcher de tout finir d'un coup » : un module ou
// une leçon peut s'ouvrir N jours après l'inscription de l'étudiant
// (delai_jours, à minuit heure du Bénin) et/ou pas avant une date
// (disponible_le). Le blocage réel est fait en base (formation_lecon_ouverte,
// formation_quiz_ouvert, calendrier_formation).
function fkChampsOuverture(o, quoi) {
  const date = o?.disponible_le ? new Date(o.disponible_le) : null;
  const iso = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
  return `<fieldset class="fk-carte fk-ouverture-champs"><legend>📅 Ouverture ${quoi === 'module' ? 'du module' : 'de la leçon'} (progression)</legend>
    <div class="fk-grille-2">
      <label class="fk-champ"><span>Ouvert … jours après l'inscription</span><input type="number" name="delai_jours" min="0" max="3650" placeholder="Dès l'inscription" value="${o?.delai_jours ?? ''}">
        <small>0 = le jour de l'inscription, 1 = le lendemain, 2 = le surlendemain… (à minuit). Vide = pas de délai.</small></label>
      <label class="fk-champ"><span>Pas avant le (facultatif)</span><input type="date" name="disponible_le" value="${iso}">
        <small>Même date pour tous les étudiants.</small></label>
    </div></fieldset>`;
}
function fkLireOuverture(fd) {
  const d = String(fd.get('delai_jours') ?? '').trim();
  const date = String(fd.get('disponible_le') ?? '').trim();
  return {
    delai_jours: d === '' ? null : Math.min(3650, Math.max(0, parseInt(d, 10) || 0)),
    disponible_le: date ? new Date(`${date}T00:00:00`).toISOString() : null
  };
}
function fkPastilleOuverture(o) {
  const morceaux = [];
  if (o?.delai_jours !== null && o?.delai_jours !== undefined) morceaux.push(o.delai_jours === 0 ? 'dès l\'inscription' : `J+${o.delai_jours}`);
  if (o?.disponible_le) morceaux.push(`dès le ${new Date(o.disponible_le).toLocaleDateString('fr-FR')}`);
  return morceaux.length ? `<span class="fk-pastille fk-pastille-ouverture" title="Ouverture progressive">📅 ${morceaux.join(' · ')}</span>` : '';
}
// « dans 2 jours », « demain à 00:00 »… pour une date d'ouverture future.
function fkQuandOuverture(iso) {
  const d = new Date(iso);
  const jours = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (jours <= 0) return `aujourd'hui à ${heure}`;
  if (jours === 1) return `demain à ${heure}`;
  return `le ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} (dans ${jours} jours)`;
}

// ---------- Paiement des formations : FedaPay / KkiaPay (26 septembre 2026) ----------
// Le navigateur ne décide jamais qu'un paiement a réussi : il demande à la
// fonction serveur « formation-paiement » de vérifier auprès du prestataire.
async function fkPaiementAppel(corps) {
  const { data, error } = await supabaseClient.functions.invoke('formation-paiement', { body: corps });
  if (error) {
    let msg = error.message || 'Le service de paiement ne répond pas.';
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_e) { /* réponse non JSON */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
function fkUrlRetourPaiement(formationId) {
  return new URL(`${FK_BASE}app/paiement.html?formation=${formationId}`, window.location.href).toString();
}
function fkChargerKkiapay() {
  if (window.openKkiapayWidget) return Promise.resolve();
  return new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.kkiapay.me/k.js';
    sc.onload = () => ok();
    sc.onerror = () => ko(new Error('Impossible de charger KkiaPay. Vérifiez votre connexion.'));
    document.head.appendChild(sc);
  });
}
const _fkKkia = { branche: false, fini: false };
// Ouvre la fenêtre de choix du moyen de paiement pour la formation `f`.
async function fkAcheterFormation(f) {
  const m = fkModale(`Acheter « ${f.titre} »`, `<div data-corps><p class="fk-chargement">Chargement des moyens de paiement…</p></div>
    <div class="fk-actions-form"><button class="fk-btn fk-btn-ghost" data-fermer>Annuler</button></div>`, { protegee: true });
  const corps = m.boite.querySelector('[data-corps]');
  let config;
  try { config = await fkPaiementAppel({ action: 'config' }); }
  catch (e) { corps.innerHTML = `<p class="fk-alerte fk-alerte-erreur">${fkEchapper(e.message)}</p>`; return; }
  const moyens = [
    ['fedapay', 'FedaPay', 'Mobile Money (MTN, Moov…) ou carte bancaire', '📱'],
    ['kkiapay', 'KkiaPay', 'Mobile Money, carte bancaire ou Wave', '💳']
  ].filter(([k]) => config[k] && config[k].disponible);
  if (!moyens.length) {
    corps.innerHTML = `<p class="fk-alerte fk-alerte-attention">Le paiement en ligne n'est pas encore activé sur KEKELI. Réessayez un peu plus tard.</p>`;
    return;
  }
  const enTest = moyens.some(([k]) => config[k].test);
  corps.innerHTML = `${enTest ? `<p class="fk-alerte fk-alerte-attention" data-mode-test>🧪 <b>Mode test</b> : aucun argent réel n'est débité. Utilisez les numéros de test du prestataire.</p>` : ''}
    <p style="margin:0 0 12px">Montant à payer : <b>${fkPrix(f.prix, f.devise)}</b></p>
    <div class="fk-moyens-paiement">${moyens.map(([k, nom, desc, ic]) => `<button type="button" class="fk-moyen-paiement" data-prestataire="${k}">
      <span class="fk-moyen-icone" aria-hidden="true">${ic}</span><span><b>${nom}</b><small>${desc}</small></span></button>`).join('')}</div>
    <p style="font-size:12px;color:var(--f-muted);margin:12px 0 0">🔒 Paiement sécurisé : KEKELI ne voit jamais votre code Mobile Money ni votre carte. L'accès s'ouvre dès que le paiement est confirmé.</p>
    <p data-etat class="fk-alerte fk-alerte-info" hidden></p>`;
  const etat = corps.querySelector('[data-etat]');
  const dire = (t, type) => { etat.hidden = false; etat.className = `fk-alerte fk-alerte-${type || 'info'}`; etat.textContent = t; };
  corps.querySelectorAll('[data-prestataire]').forEach(b => b.addEventListener('click', async () => {
    const prestataire = b.dataset.prestataire;
    corps.querySelectorAll('[data-prestataire]').forEach(x => { x.disabled = true; });
    dire('Préparation du paiement…');
    try {
      const r = await fkPaiementAppel({ action: 'initier', prestataire, formationId: f.id, retour: fkUrlRetourPaiement(f.id) });
      if (prestataire === 'fedapay') {
        dire('Redirection vers la page de paiement FedaPay…');
        window.location.href = r.url;
        return;
      }
      await fkChargerKkiapay();
      // Un seul jeu d'écouteurs par page : ils suivent toujours le DERNIER paiement ouvert.
      _fkKkia.paiementId = r.paiementId; _fkKkia.formationId = f.id; _fkKkia.dire = dire;
      _fkKkia.reactiver = () => corps.querySelectorAll('[data-prestataire]').forEach(x => { x.disabled = false; });
      if (!_fkKkia.branche) {
        _fkKkia.branche = true;
        window.addSuccessListener && window.addSuccessListener(async rep => {
          if (_fkKkia.fini) return; _fkKkia.fini = true;
          const pid = _fkKkia.paiementId, tx = rep && rep.transactionId;
          _fkKkia.dire('Paiement reçu, vérification en cours…');
          try { await fkPaiementAppel({ action: 'verifier', paiementId: pid, transactionId: tx }); } catch (_e) { /* la page de retour réessaie */ }
          window.location.href = `${fkUrlRetourPaiement(_fkKkia.formationId)}&paiement=${pid}${tx ? `&transaction=${encodeURIComponent(tx)}` : ''}`;
        });
        window.addFailedListener && window.addFailedListener(() => {
          if (_fkKkia.fini) return;
          _fkKkia.dire('Le paiement n\'a pas abouti. Vous pouvez réessayer.', 'erreur');
          _fkKkia.reactiver();
        });
      }
      window.openKkiapayWidget({
        amount: r.montant, key: r.cle, sandbox: !!r.sandbox, position: 'center', theme: '#0f7a5a',
        data: JSON.stringify({ paiementId: r.paiementId }), email: r.email || undefined, name: r.nom || undefined
      });
      dire('Terminez le paiement dans la fenêtre KkiaPay.');
      corps.querySelectorAll('[data-prestataire]').forEach(x => { x.disabled = false; });
    } catch (e) {
      dire(e.message, 'erreur');
      corps.querySelectorAll('[data-prestataire]').forEach(x => { x.disabled = false; });
    }
  }));
}

// ---------- Initialisation commune d'une page ----------
// 25 septembre 2026 : la plateforme de formation est fermée aux comptes
// élèves (enfants). Le blocage réel est fait en base (politiques
// restrictives *_interdit_eleves, est_compte_eleve()) ; ici on affiche
// simplement un message clair et on arrête le chargement de la page.
async function fkInitPage(actif) {
  fkRendrePied();
  const s = await fkSession();
  if (s.profil && s.profil.role === 'eleve') {
    document.getElementById('fkPied').innerHTML = '';
    document.getElementById('fkEntete').innerHTML = `<div class="fk-container fk-nav"><a class="fk-logo" href="${FK_RACINE}primaire.html"><img src="${FK_RACINE}assets/logo/logo.png" alt=""><div><strong>KEKELI</strong><small class="fk-logo-sous">Formation</small></div></a></div>`;
    document.getElementById('fkContenu').innerHTML = `<div class="fk-page"><div class="fk-container" style="max-width:640px">
      <div class="fk-carte fk-vide"><span class="fk-vide-icone">🔒</span>
        <h1 class="fk-titre-page">Espace réservé aux adultes</h1>
        <p>KEKELI Formation n'est pas accessible avec un compte élève.</p>
        <a class="fk-btn fk-btn-primary" href="${urlTableauDeBord('eleve')}">Retour à mon espace élève</a></div></div></div>`;
    throw new Error('KEKELI Formation : accès refusé aux comptes élèves.');
  }
  await fkRendreEntete(actif);
}
