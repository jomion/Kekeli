// Page pages/admin/bannieres.html — réservée au super_admin.
//
// Gère la bannière dynamique affichée en haut de TOUTES les pages du site
// (accueil publique + tous les espaces connectés) — voir js/banniere-site.js
// pour l'affichage côté visiteur/utilisateur, et la migration
// "bannieres_site_dynamiques" pour le schéma et les policies RLS (lecture
// publique limitée aux bannières actives ; lecture/écriture complètes
// réservées au super_admin via est_super_admin(auth.uid())).
//
// Une seule bannière s'affiche à la fois par visiteur : si plusieurs
// bannières actives ciblent son rôle en même temps, la plus récemment créée
// l'emporte (voir le tri dans js/banniere-site.js) — inutile en pratique de
// garder plusieurs bannières actives simultanément pour la même audience.

const TYPES_BANNIERE = [
  { valeur: 'info', label: 'ℹ️ Information (bleu)' },
  { valeur: 'succes', label: '✅ Bonne nouvelle (vert)' },
  { valeur: 'alerte', label: '⚠️ Avertissement (orange)' },
  { valeur: 'urgence', label: '🚨 Urgent (rouge)' }
];

const ROLES_CIBLABLES = [
  { valeur: 'visiteur', label: 'Visiteurs non connectés (accueil)' },
  { valeur: 'eleve', label: 'Élèves' },
  { valeur: 'parent', label: 'Parents' },
  { valeur: 'enseignant', label: 'Enseignants' },
  { valeur: 'autorite_pedagogique', label: 'Autorités pédagogiques' },
  { valeur: 'admin', label: 'Administrateurs' }
];

let profilBannieres = null;
let bannieresExistantes = [];

function echapperBan(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// datetime-local <-> ISO : datetime-local n'a pas de fuseau, on travaille en
// heure locale du navigateur des deux côtés (cohérent pour un seul admin qui
// programme ses propres bannières).
function versDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function versIso(datetimeLocal) {
  if (!datetimeLocal) return null;
  const d = new Date(datetimeLocal);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function statutBanniere(b) {
  if (!b.actif) return { texte: 'Brouillon', classe: 'statut-brouillon' };
  const maintenant = Date.now();
  if (b.date_debut && new Date(b.date_debut).getTime() > maintenant) return { texte: 'Programmée', classe: 'statut-archive' };
  if (b.date_fin && new Date(b.date_fin).getTime() < maintenant) return { texte: 'Expirée', classe: 'statut-archive' };
  return { texte: 'Active maintenant', classe: 'statut-publie' };
}

async function init() {
  profilBannieres = await requireAdmin();
  if (!profilBannieres) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilBannieres.id,
    badgeHtml: `${profilBannieres.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperBan(profilBannieres.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilBannieres.est_super_admin })
  });

  if (!profilBannieres.est_super_admin) {
    document.getElementById('contenu').innerHTML = `
      <div class="titre-page">Bannière du site</div>
      <p class="message-erreur">⛔ Cette page est réservée au super administrateur.</p>
      <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
    return;
  }

  await chargerBannieres();
  afficherPageBannieres();
}

async function chargerBannieres() {
  const { data } = await supabaseClient.from('bannieres_site').select('*').order('cree_le', { ascending: false });
  bannieresExistantes = data || [];
}

function afficherPageBannieres() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">📣 Bannière du site</div>
    <div class="sous-titre-page">Affichée en haut de toutes les pages (accueil public et tous les espaces connectés), ciblable par rôle.</div>

    <button class="btn btn-primaire" id="btnOuvrirFormulaireBanniere" style="margin-bottom:16px">➕ Créer une bannière</button>
    <div id="zoneFormulaireBanniere"></div>

    <div class="section-title-eleve" style="margin-top:8px">Bannières existantes</div>
    <div class="liste-lignes" id="zoneListeBannieres"></div>
  `;
  document.getElementById('btnOuvrirFormulaireBanniere').addEventListener('click', () => ouvrirFormulaireBanniere());
  rendreListeBannieres();
}

function rendreListeBannieres() {
  document.getElementById('zoneListeBannieres').innerHTML = bannieresExistantes.length ? bannieresExistantes.map(b => {
    const statut = statutBanniere(b);
    const cibles = (b.roles_cibles && b.roles_cibles.length)
      ? b.roles_cibles.map(r => echapperBan((ROLES_CIBLABLES.find(x => x.valeur === r) || {}).label || r)).join(', ')
      : 'Tout le monde';
    return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperBan(b.message)}</span>
        <span class="meta-seance-admin">
          <span class="statut-pill ${statut.classe}">${statut.texte}</span>
          <span class="badge-droit">${(TYPES_BANNIERE.find(t => t.valeur === b.type) || {}).label || b.type}</span>
        </span>
        <span class="meta-seance-admin">🎯 ${cibles}${b.date_debut ? ` · à partir du ${new Date(b.date_debut).toLocaleString('fr-FR')}` : ''}${b.date_fin ? ` · jusqu'au ${new Date(b.date_fin).toLocaleString('fr-FR')}` : ''}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-discret" data-modifier-banniere="${b.id}" style="padding:6px 12px;font-size:12px">✏️ Modifier</button>
        <button class="btn btn-discret" data-supprimer-banniere="${b.id}" style="padding:6px 12px;font-size:12px;color:var(--rouge)">🗑️ Supprimer</button>
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--texte-gris)">Aucune bannière créée pour l'instant.</p>`;

  document.querySelectorAll('[data-modifier-banniere]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirFormulaireBanniere(bannieresExistantes.find(b => b.id === parseInt(btn.dataset.modifierBanniere, 10))));
  });
  document.querySelectorAll('[data-supprimer-banniere]').forEach(btn => {
    btn.addEventListener('click', () => supprimerBanniere(parseInt(btn.dataset.supprimerBanniere, 10)));
  });
}

function ouvrirFormulaireBanniere(banniereAEditer) {
  document.getElementById('btnOuvrirFormulaireBanniere').style.display = 'none';
  const ciblesActuelles = banniereAEditer?.roles_cibles || [];
  const toutLeMondeCoche = ciblesActuelles.length === 0;

  document.getElementById('zoneFormulaireBanniere').innerHTML = `
    <form id="formBanniere" class="formulaire-admin">
      <label>Message<textarea name="message" rows="2" required maxlength="300">${echapperBan(banniereAEditer?.message || '')}</textarea></label>

      <div class="rangee-champs">
        <label>Type
          <select name="type">
            ${TYPES_BANNIERE.map(t => `<option value="${t.valeur}" ${(banniereAEditer?.type || 'info') === t.valeur ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </label>
        <label><input type="checkbox" name="actif" ${banniereAEditer ? (banniereAEditer.actif ? 'checked' : '') : 'checked'}> Publiée (visible dès que les conditions ci-dessous sont remplies)</label>
      </div>

      <div class="rangee-champs">
        <label>Lien optionnel — adresse<input type="url" name="lien_url" placeholder="https://..." value="${echapperBan(banniereAEditer?.lien_url || '')}"></label>
        <label>Texte du lien<input type="text" name="lien_texte" placeholder="En savoir plus" value="${echapperBan(banniereAEditer?.lien_texte || '')}"></label>
      </div>

      <div class="rangee-champs">
        <label>Début (optionnel)<input type="datetime-local" name="date_debut" value="${versDatetimeLocal(banniereAEditer?.date_debut)}"></label>
        <label>Fin (optionnelle)<input type="datetime-local" name="date_fin" value="${versDatetimeLocal(banniereAEditer?.date_fin)}"></label>
      </div>
      <p class="note-future" style="margin-top:-6px">Laissez vide pour un affichage sans date de début/fin précise.</p>

      <div class="encadre-perimetre" style="margin-top:10px">
        <label><input type="checkbox" id="checkToutLeMonde" ${toutLeMondeCoche ? 'checked' : ''}> Afficher à tout le monde (visiteurs et tous les rôles connectés)</label>
        <div class="grille-cases" id="zoneCiblesRole" style="margin-top:10px;${toutLeMondeCoche ? 'display:none' : ''}">
          ${ROLES_CIBLABLES.map(r => `
            <label>
              <input type="checkbox" name="cible" value="${r.valeur}" ${ciblesActuelles.includes(r.valeur) ? 'checked' : ''}>
              ${echapperBan(r.label)}
            </label>`).join('')}
        </div>
      </div>

      <p class="message-erreur" id="erreurBanniere"></p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button type="button" class="btn btn-discret" id="btnAnnulerBanniere">Annuler</button>
        <button type="submit" class="btn btn-primaire" id="btnValiderBanniere">${banniereAEditer ? 'Enregistrer' : 'Créer la bannière'}</button>
      </div>
    </form>
  `;

  document.getElementById('checkToutLeMonde').addEventListener('change', (e) => {
    document.getElementById('zoneCiblesRole').style.display = e.target.checked ? 'none' : '';
  });
  document.getElementById('btnAnnulerBanniere').addEventListener('click', fermerFormulaireBanniere);
  document.getElementById('formBanniere').addEventListener('submit', (e) => enregistrerBanniere(e, banniereAEditer?.id));
}

function fermerFormulaireBanniere() {
  document.getElementById('zoneFormulaireBanniere').innerHTML = '';
  document.getElementById('btnOuvrirFormulaireBanniere').style.display = 'inline-flex';
}

async function enregistrerBanniere(e, banniereId) {
  e.preventDefault();
  const form = e.target;
  const erreurEl = document.getElementById('erreurBanniere');
  erreurEl.textContent = '';

  const donnees = new FormData(form);
  const toutLeMonde = document.getElementById('checkToutLeMonde').checked;
  const ciblesCochees = toutLeMonde ? [] : [...form.querySelectorAll('[name="cible"]:checked')].map(el => el.value);

  if (!toutLeMonde && ciblesCochees.length === 0) {
    erreurEl.textContent = 'Cochez au moins un rôle, ou "Afficher à tout le monde".';
    return;
  }

  const payload = {
    message: (donnees.get('message') || '').toString().trim(),
    type: donnees.get('type'),
    lien_url: (donnees.get('lien_url') || '').toString().trim() || null,
    lien_texte: (donnees.get('lien_texte') || '').toString().trim() || null,
    roles_cibles: toutLeMonde ? null : ciblesCochees,
    actif: donnees.get('actif') === 'on',
    date_debut: versIso(donnees.get('date_debut')),
    date_fin: versIso(donnees.get('date_fin')),
    maj_le: new Date().toISOString()
  };

  if (!payload.message) { erreurEl.textContent = 'Le message est obligatoire.'; return; }
  if (payload.date_debut && payload.date_fin && payload.date_debut > payload.date_fin) {
    erreurEl.textContent = 'La date de fin doit être après la date de début.';
    return;
  }
  if (!banniereId) payload.cree_par = profilBannieres.id;

  const btn = document.getElementById('btnValiderBanniere');
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  const { error } = banniereId
    ? await supabaseClient.from('bannieres_site').update(payload).eq('id', banniereId)
    : await supabaseClient.from('bannieres_site').insert(payload);

  btn.disabled = false; btn.textContent = banniereId ? 'Enregistrer' : 'Créer la bannière';

  if (error) { erreurEl.textContent = error.message; return; }

  fermerFormulaireBanniere();
  await chargerBannieres();
  rendreListeBannieres();
}

async function supprimerBanniere(banniereId) {
  if (!confirm('Supprimer cette bannière ?')) return;
  const { error } = await supabaseClient.from('bannieres_site').delete().eq('id', banniereId);
  if (error) { alert(error.message); return; }
  await chargerBannieres();
  rendreListeBannieres();
}

init();
