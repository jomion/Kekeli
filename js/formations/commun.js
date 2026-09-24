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
function fkNettoyerHtml(html) {
  if (!html) return '';
  if (window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'img', 'code', 'pre', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'sub', 'sup'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan'],
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/|\.)/i
    });
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
  return `${FK_RACINE}pages/inscription.html?role=apprenant&retour=${encodeURIComponent(relatif)}`;
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
  const lienEspaceKekeli = p && p.role !== 'apprenant'
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
              <a href="${FK_RACINE}index.html">🏠 Site KEKELI</a>
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
          <a href="${FK_RACINE}index.html">Site éducatif KEKELI</a>
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

// ---------- Éditeur riche minimal ----------
function fkEditeurRiche(conteneur, htmlInitial, placeholder) {
  conteneur.innerHTML = `
    <div class="fk-riche">
      <div class="fk-riche-barre" role="toolbar" aria-label="Mise en forme">
        <button type="button" data-cmd="bold" title="Gras"><b>G</b></button>
        <button type="button" data-cmd="italic" title="Italique"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Souligné"><u>S</u></button>
        <button type="button" data-cmd="formatBlock" data-val="h3" title="Sous-titre">Titre</button>
        <button type="button" data-cmd="formatBlock" data-val="p" title="Paragraphe">¶</button>
        <button type="button" data-cmd="insertUnorderedList" title="Liste à puces">• Liste</button>
        <button type="button" data-cmd="insertOrderedList" title="Liste numérotée">1. Liste</button>
        <button type="button" data-cmd="formatBlock" data-val="blockquote" title="Citation">❝</button>
        <button type="button" data-cmd="createLink" title="Lien">🔗</button>
        <button type="button" data-cmd="removeFormat" title="Effacer la mise en forme">⌫</button>
      </div>
      <div class="fk-riche-zone" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${fkEchapper(placeholder || 'Rédigez ici…')}"></div>
    </div>`;
  const zone = conteneur.querySelector('.fk-riche-zone');
  zone.innerHTML = fkNettoyerHtml(htmlInitial || '');
  conteneur.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
    zone.focus();
    if (b.dataset.cmd === 'createLink') {
      const url = prompt('Adresse du lien (https://…)');
      if (url && /^https?:\/\//i.test(url)) document.execCommand('createLink', false, url);
      return;
    }
    document.execCommand(b.dataset.cmd, false, b.dataset.val || null);
  }));
  zone.addEventListener('paste', e => {
    e.preventDefault();
    const texte = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, texte);
  });
  return { zone, lireHtml: () => fkNettoyerHtml(zone.innerHTML).trim() };
}

// ---------- Initialisation commune d'une page ----------
async function fkInitPage(actif) {
  fkRendrePied();
  await fkRendreEntete(actif);
}
