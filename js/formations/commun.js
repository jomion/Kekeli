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
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width', 'border-collapse', 'width', 'padding'];
let _fkHookStyle = false;
function fkFiltrerStyle(style) {
  return String(style || '').split(';').map(d => {
    const i = d.indexOf(':');
    if (i < 0) return null;
    const prop = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).trim();
    let p2 = prop;
    let v2 = val.replace(/\s*!important\s*$/i, '');
    // « background: #ff0 » (Word) -> background-color, s'il ne contient qu'une couleur.
    if (prop === 'background' && /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i.test(v2)) p2 = 'background-color';
    if (!FK_STYLES_AUTORISES.includes(p2)) return null;
    if (!/^[#a-z0-9(),.%\s"'-]{1,120}$/i.test(v2) || /url|expression|var\(|attr\(|\\/i.test(v2)) return null;
    if (/^(windowtext|auto|initial|inherit)$/i.test(v2) && /color/.test(p2)) return null;
    if (p2 === 'font-size') { const m = /^([\d.]+)(pt|px|em|rem|%)$/i.exec(v2); if (!m || Number(m[1]) > ({ pt: 60, px: 80, em: 5, rem: 5, '%': 400 }[m[2].toLowerCase()])) return null; }
    if (['margin-left', 'padding-left', 'text-indent', 'padding', 'width'].includes(p2) && !/^(-?[\d.]+(pt|px|em|rem|cm|mm|in|%)?\s*){1,4}$/i.test(v2)) return null;
    if (p2 === 'width' && /^([\d.]+)(pt|px)$/i.test(v2) && parseFloat(v2) > 1000) v2 = '100%';
    return `${p2}: ${v2}`;
  }).filter(Boolean).join('; ');
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
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'data-bloc', 'data-activite', 'data-image', 'target', 'rel', 'type', 'checked', 'disabled'],
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

async function fkConvertirEnHtml(texte, format) {
  const f = format === 'auto' || !format ? fkDevinerFormat(texte) : format;
  if (f === 'markdown') return fkNettoyerHtml(await fkMarkdownVersHtml(texte));
  if (f === 'texte') return fkTexteVersHtml(texte);
  if (fkEstHtmlBureautique(texte)) return fkNettoyerHtml(fkPreparerHtmlBureautique(texte).html);
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
    const cible = premier && (premier.querySelector('td, [data-bloc] p:last-child, blockquote > p:last-child') || premier);
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
      source.value = fkNettoyerHtml(zone.innerHTML).replace(/></g, '>\n<');
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
    if (html) {
      let propre;
      if (fkEstHtmlBureautique(html)) {
        const r = fkPreparerHtmlBureautique(html);
        propre = fkNettoyerHtml(r.html);
        if (r.imagesPerdues) fkToast(`${r.imagesPerdues} image(s) de Word n'ont pas pu être reprises : ajoutez-les avec le bouton 🖼️ Image.`, 'erreur');
      } else propre = fkNettoyerHtml(html);
      collerHtml(propre);
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
      el.innerHTML = a ? `<b>${{ controle: '🧭 Point de contrôle', reflexion: '💭 Réflexion', questionnaire: '📋 Questionnaire d\'auto-évaluation' }[a.nature]}${a.bloquant ? ' · 🔒 bloquant' : ''}</b><br><span>${fkEchapper(a.titre || a.enonce || '').slice(0, 140)}</span><small>Cliquer pour modifier · touche Suppr pour retirer</small>`
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
  btnSource.addEventListener('click', () => { if (!modeSource) decorerActivites(); });

  return {
    zone,
    idsActivites: () => [...new Set([...(modeSource ? new DOMParser().parseFromString(source.value, 'text/html') : zone).querySelectorAll('[data-activite]')].map(el => Number(el.dataset.activite)))],
    lireHtml: () => {
      const t = document.createElement('template');
      t.innerHTML = fkNettoyerHtml(modeSource ? source.value : zone.innerHTML);
      t.content.querySelectorAll('[data-activite]').forEach(el => { el.innerHTML = ''; el.removeAttribute('class'); });
      return t.innerHTML.trim();
    },
    desactiver: () => { zone.contentEditable = 'false'; barre.querySelectorAll('button, select, input').forEach(el => { el.disabled = true; }); }
  };
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
