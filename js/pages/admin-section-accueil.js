// Page pages/admin/section-accueil.html — réservée au super_admin.
//
// Gère les blocs du grand bandeau ("hero") de l'accueil publique
// (index.html) : titre, texte, et une image (upload) ou, à défaut, un emoji
// de secours. Le super admin peut en ajouter/retirer librement et les
// réordonner — voir js/accueil-hero.js pour l'affichage côté visiteur
// (carrousel si plusieurs blocs actifs), et la migration
// "ajoute_blocs_accueil_hero" pour le schéma et les policies RLS (même
// principe que bannieres_site : lecture publique limitée aux blocs actifs,
// lecture/écriture complètes réservées au super_admin via
// est_super_admin(auth.uid())).
//
// Les images sont stockées dans le bucket "kekeli-media" existant, sous
// accueil-hero/ — un dossier dont l'écriture est réservée au super_admin par
// des policies dédiées (voir la migration
// "restreint_dossier_accueil_hero_super_admin") sans toucher au reste du
// bucket.

let profilBH = null;
let blocsAccueilExistants = [];

function echapperBH(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function init() {
  profilBH = await requireAdmin();
  if (!profilBH) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilBH.id,
    badgeHtml: `${profilBH.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperBH(profilBH.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilBH.est_super_admin })
  });

  if (!profilBH.est_super_admin) {
    document.getElementById('contenu').innerHTML = `
      <div class="titre-page">Section d'accueil</div>
      <p class="message-erreur">⛔ Cette page est réservée au super administrateur.</p>
      <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
    return;
  }

  await chargerBlocsAccueil();
  afficherPageBH();
}

async function chargerBlocsAccueil() {
  const { data } = await supabaseClient.from('blocs_accueil_hero').select('*').order('ordre', { ascending: true });
  blocsAccueilExistants = data || [];
}

function afficherPageBH() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">🖼️ Section d'accueil (bandeau)</div>
    <div class="sous-titre-page">Le grand bandeau tout en haut de la page d'accueil publique (index.html). Plusieurs blocs actifs s'affichent en carrousel, l'un après l'autre.</div>

    <button class="btn btn-primaire" id="btnOuvrirFormulaireBH" style="margin-bottom:16px">➕ Ajouter un bloc</button>
    <div id="zoneFormulaireBH"></div>

    <div class="section-title-eleve" style="margin-top:8px">Blocs existants</div>
    <div class="liste-lignes" id="zoneListeBH"></div>
  `;
  document.getElementById('btnOuvrirFormulaireBH').addEventListener('click', () => ouvrirFormulaireBH());
  rendreListeBH();
}

function rendreListeBH() {
  const zone = document.getElementById('zoneListeBH');
  if (!blocsAccueilExistants.length) {
    zone.innerHTML = `<p style="color:var(--texte-gris)">Aucun bloc créé pour l'instant — le bandeau affiche le texte par défaut du site.</p>`;
    return;
  }
  zone.innerHTML = blocsAccueilExistants.map((b, i) => `
    <div class="ligne">
      ${b.image_url ? `<img class="miniature-bloc-accueil" src="${echapperBH(b.image_url)}" alt="">` : `<span class="miniature-bloc-accueil">${echapperBH(b.emoji || '☀️')}</span>`}
      <div style="flex:1;min-width:0">
        <span class="titre-ligne">${echapperBH(b.titre)}</span>
        <span class="statut-pill ${b.actif ? 'statut-publie' : 'statut-brouillon'}" style="margin-left:8px">${b.actif ? 'Actif' : 'Masqué'}</span>
        ${b.texte ? `<div style="font-size:12px;color:var(--texte-gris);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${echapperBH(b.texte)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-discret" data-monter-bh="${b.id}" ${i === 0 ? 'disabled' : ''} title="Monter" style="padding:6px 10px">↑</button>
        <button class="btn btn-discret" data-descendre-bh="${b.id}" ${i === blocsAccueilExistants.length - 1 ? 'disabled' : ''} title="Descendre" style="padding:6px 10px">↓</button>
        <button class="btn btn-discret" data-modifier-bh="${b.id}" style="padding:6px 12px;font-size:12px">✏️ Modifier</button>
        <button class="btn btn-discret" data-supprimer-bh="${b.id}" style="padding:6px 12px;font-size:12px;color:var(--rouge)">🗑️ Supprimer</button>
      </div>
    </div>`).join('');

  zone.querySelectorAll('[data-modifier-bh]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirFormulaireBH(blocsAccueilExistants.find(b => b.id === parseInt(btn.dataset.modifierBh, 10))));
  });
  zone.querySelectorAll('[data-supprimer-bh]').forEach(btn => {
    btn.addEventListener('click', () => supprimerBlocBH(parseInt(btn.dataset.supprimerBh, 10)));
  });
  zone.querySelectorAll('[data-monter-bh]').forEach(btn => {
    btn.addEventListener('click', () => deplacerBlocBH(parseInt(btn.dataset.monterBh, 10), -1));
  });
  zone.querySelectorAll('[data-descendre-bh]').forEach(btn => {
    btn.addEventListener('click', () => deplacerBlocBH(parseInt(btn.dataset.descendreBh, 10), 1));
  });
}

function ouvrirFormulaireBH(blocAEditer) {
  document.getElementById('btnOuvrirFormulaireBH').style.display = 'none';
  document.getElementById('zoneFormulaireBH').innerHTML = `
    <form id="formBH" class="formulaire-admin">
      <label>Titre<input type="text" name="titre" required maxlength="150" value="${echapperBH(blocAEditer?.titre || '')}"></label>

      <label style="margin-top:14px">Texte (optionnel)<textarea name="texte" rows="2" maxlength="400">${echapperBH(blocAEditer?.texte || '')}</textarea></label>

      <div class="rangee-champs" style="margin-top:14px">
        <label>Image (optionnelle)
          <input type="file" name="image" accept="image/*">
        </label>
        <label>Emoji de secours (si pas d'image)
          <input type="text" name="emoji" maxlength="4" placeholder="☀️" value="${echapperBH(blocAEditer?.emoji || '☀️')}">
        </label>
      </div>
      ${blocAEditer?.image_url ? `
        <img class="apercu-image-accueil" id="apercuImageBH" src="${echapperBH(blocAEditer.image_url)}" alt="">
        <label class="ligne-case"><input type="checkbox" name="retirer_image"> Retirer l'image actuelle (revenir à l'emoji de secours)</label>
      ` : `<img class="apercu-image-accueil" id="apercuImageBH" style="display:none" alt="">`}

      <label class="ligne-case"><input type="checkbox" name="actif" ${blocAEditer ? (blocAEditer.actif ? 'checked' : '') : 'checked'}> Actif (visible sur l'accueil)</label>

      <p class="message-erreur" id="erreurBH"></p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button type="button" class="btn btn-discret" id="btnAnnulerBH">Annuler</button>
        <button type="submit" class="btn btn-primaire" id="btnValiderBH">${blocAEditer ? 'Enregistrer' : 'Ajouter le bloc'}</button>
      </div>
    </form>
  `;

  document.querySelector('#formBH [name="image"]').addEventListener('change', (e) => {
    const fichier = e.target.files[0];
    const apercu = document.getElementById('apercuImageBH');
    if (!fichier) return;
    apercu.src = URL.createObjectURL(fichier);
    apercu.style.display = '';
  });
  document.getElementById('btnAnnulerBH').addEventListener('click', fermerFormulaireBH);
  document.getElementById('formBH').addEventListener('submit', (e) => enregistrerBlocBH(e, blocAEditer?.id));
}

function fermerFormulaireBH() {
  document.getElementById('zoneFormulaireBH').innerHTML = '';
  document.getElementById('btnOuvrirFormulaireBH').style.display = 'inline-flex';
}

async function enregistrerBlocBH(e, blocId) {
  e.preventDefault();
  const form = e.target;
  const erreurEl = document.getElementById('erreurBH');
  erreurEl.textContent = '';

  const donnees = new FormData(form);
  const titre = (donnees.get('titre') || '').toString().trim();
  if (!titre) { erreurEl.textContent = 'Le titre est obligatoire.'; return; }

  const btn = document.getElementById('btnValiderBH');
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  const payload = {
    titre,
    texte: (donnees.get('texte') || '').toString().trim() || null,
    emoji: (donnees.get('emoji') || '').toString().trim() || '☀️',
    actif: donnees.get('actif') === 'on',
    modifie_le: new Date().toISOString()
  };

  // Image : upload si un nouveau fichier a été choisi, sinon on garde
  // l'image existante (sauf si "Retirer l'image" est coché).
  const fichierImage = form.querySelector('[name="image"]').files[0];
  if (fichierImage) {
    const chemin = `accueil-hero/${Date.now()}-${fichierImage.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: erreurUpload } = await supabaseClient.storage.from('kekeli-media').upload(chemin, fichierImage, { upsert: false });
    if (erreurUpload) {
      btn.disabled = false; btn.textContent = blocId ? 'Enregistrer' : 'Ajouter le bloc';
      erreurEl.textContent = "Échec de l'envoi de l'image : " + erreurUpload.message;
      return;
    }
    payload.image_url = supabaseClient.storage.from('kekeli-media').getPublicUrl(chemin).data.publicUrl;
  } else if (donnees.get('retirer_image') === 'on') {
    payload.image_url = null;
  }

  if (!blocId) {
    payload.ordre = blocsAccueilExistants.length ? Math.max(...blocsAccueilExistants.map(b => b.ordre)) + 1 : 0;
  }

  const { error } = blocId
    ? await supabaseClient.from('blocs_accueil_hero').update(payload).eq('id', blocId)
    : await supabaseClient.from('blocs_accueil_hero').insert(payload);

  btn.disabled = false; btn.textContent = blocId ? 'Enregistrer' : 'Ajouter le bloc';

  if (error) { erreurEl.textContent = error.message; return; }

  fermerFormulaireBH();
  await chargerBlocsAccueil();
  rendreListeBH();
}

async function deplacerBlocBH(blocId, sens) {
  const i = blocsAccueilExistants.findIndex(b => b.id === blocId);
  const j = i + sens;
  if (i === -1 || j < 0 || j >= blocsAccueilExistants.length) return;

  const a = blocsAccueilExistants[i], b = blocsAccueilExistants[j];
  const [ordreA, ordreB] = [a.ordre, b.ordre];
  await Promise.all([
    supabaseClient.from('blocs_accueil_hero').update({ ordre: ordreB }).eq('id', a.id),
    supabaseClient.from('blocs_accueil_hero').update({ ordre: ordreA }).eq('id', b.id)
  ]);
  await chargerBlocsAccueil();
  rendreListeBH();
}

async function supprimerBlocBH(blocId) {
  if (!confirm('Supprimer ce bloc du bandeau ?')) return;
  const { error } = await supabaseClient.from('blocs_accueil_hero').delete().eq('id', blocId);
  if (error) { alert(error.message); return; }
  await chargerBlocsAccueil();
  rendreListeBH();
}

init();
