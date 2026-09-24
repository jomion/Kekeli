// Espace formateur — gestion d'UNE formation
// (pages/formations/formateur/formation.html?id=...&onglet=...).
// Onglets : Informations · Programme (modules/leçons/ressources) · Quiz ·
// Apprenants · Publication. Toutes les écritures sont contrôlées côté
// serveur (RLS peut_editer_formation : propriétaire validé hors révision,
// ou gestionnaire KEKELI).

const FKE = { s: null, f: null, modules: [], lecons: [], ressources: [], quiz: [], categories: [], onglet: 'infos', verrouille: false };

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  FKE.s = s;
  await fkInitPage('formateur');
  const id = Number(fkParam('id'));
  FKE.onglet = fkParam('onglet') || 'infos';
  await chargerTout(id);
  if (!FKE.f) {
    document.getElementById('fkContenu').innerHTML = `<div class="fk-page"><div class="fk-container"><div class="fk-carte fk-vide"><span class="fk-vide-icone">🔒</span>Formation introuvable ou accès refusé.<br><a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a></div></div></div>`;
    return;
  }
  rendrePage();
})();

async function chargerTout(id) {
  const { data: f } = await supabaseClient.from('formations').select('*').eq('id', id || 0).maybeSingle();
  if (!f || (f.formateur_id !== FKE.s.profil.id && !FKE.s.estGestionnaire)) { FKE.f = null; return; }
  FKE.f = f;
  FKE.verrouille = f.statut === 'en_revision' && !FKE.s.estGestionnaire;
  const [mods, lecs, res, qz, cats] = await Promise.all([
    supabaseClient.from('formation_modules').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_lecons').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_ressources').select('*').eq('formation_id', id).order('id'),
    supabaseClient.from('formation_quiz').select('*, formation_questions(id)').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_categories').select('id, nom, parent_id').eq('statut', 'actif').order('position')
  ]);
  FKE.modules = mods.data || [];
  FKE.lecons = lecs.data || [];
  FKE.ressources = res.data || [];
  FKE.quiz = qz.data || [];
  FKE.categories = cats.data || [];
}

async function recharger() {
  await chargerTout(FKE.f.id);
  rendrePage();
}

function rendrePage() {
  const f = FKE.f;
  const onglets = [['infos', '📝 Informations'], ['programme', '📚 Programme'], ['quiz', '✅ Quiz'], ['apprenants', `👥 Apprenants (${f.nb_inscrits})`], ['publication', '🚀 Publication']];
  document.getElementById('fkContenu').innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a>
      <div class="fk-section-head" style="margin-top:10px">
        <div><h1 class="fk-titre-page">${fkEchapper(f.titre)}</h1>
          <p><span class="fk-pastille ${f.statut}">${FK_STATUTS_FORMATION[f.statut]}</span> · ${f.nb_lecons} leçon${f.nb_lecons > 1 ? 's' : ''} · ${fkDuree(f.duree_minutes)}</p></div>
        <a class="fk-btn fk-btn-ghost" href="${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}">👁️ Voir la fiche</a>
      </div>
      ${FKE.verrouille ? `<div class="fk-alerte fk-alerte-attention">⏳ Cette formation est en cours de validation par KEKELI : elle ne peut pas être modifiée pour le moment. Vous pouvez annuler la soumission depuis l'onglet « Publication ».</div>` : ''}
      ${f.statut === 'refusee' && f.motif_refus ? `<div class="fk-alerte fk-alerte-erreur">❌ À revoir : ${fkEchapper(f.motif_refus)}</div>` : ''}
      ${f.statut === 'publiee' ? `<div class="fk-alerte fk-alerte-info">✅ Formation publiée. Vos modifications sont visibles immédiatement par les apprenants.</div>` : ''}
      <div class="fk-onglets" role="tablist">${onglets.map(([k, l]) => `<button role="tab" aria-selected="${k === FKE.onglet}" class="${k === FKE.onglet ? 'actif' : ''}" data-onglet="${k}">${l}</button>`).join('')}</div>
      <div id="zoneOnglet"></div>
    </div></div>`;
  document.querySelectorAll('[data-onglet]').forEach(b => b.addEventListener('click', () => {
    FKE.onglet = b.dataset.onglet;
    const u = new URL(window.location.href); u.searchParams.set('onglet', FKE.onglet); history.replaceState(null, '', u);
    rendrePage();
  }));
  ({ infos: ongletInfos, programme: ongletProgramme, quiz: ongletQuiz, apprenants: ongletApprenants, publication: ongletPublication })[FKE.onglet]?.();
  if (FKE.verrouille) document.querySelectorAll('#zoneOnglet [data-edition]').forEach(el => { el.disabled = true; });
}

function optionsCategories(selection) {
  const cats = FKE.categories;
  return `<option value="">— Choisir —</option>` + cats.filter(c => !c.parent_id).map(p => `<option value="${p.id}" ${p.id === selection ? 'selected' : ''}>${fkEchapper(p.nom)}</option>
    ${cats.filter(c => c.parent_id === p.id).map(c => `<option value="${c.id}" ${c.id === selection ? 'selected' : ''}>&nbsp;&nbsp;↳ ${fkEchapper(c.nom)}</option>`).join('')}`).join('');
}

// ---------------------------------------------------------------- Infos
function ongletInfos() {
  const f = FKE.f;
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = `
    <form class="fk-carte" id="formInfos">
      <div class="fk-grille-2">
        <div>
          <label class="fk-champ"><span>Titre *</span><input type="text" name="titre" required minlength="5" maxlength="120" value="${fkEchapper(f.titre)}"></label>
          <label class="fk-champ"><span>Sous-titre</span><input type="text" name="sous_titre" maxlength="200" value="${fkEchapper(f.sous_titre || '')}" placeholder="Une phrase qui donne envie"></label>
          <label class="fk-champ"><span>Catégorie *</span><select name="categorie_id">${optionsCategories(f.categorie_id)}</select></label>
          <div class="fk-grille-2">
            <label class="fk-champ"><span>Niveau</span><select name="niveau">${Object.entries(FK_NIVEAUX).map(([k, v]) => `<option value="${k}" ${k === f.niveau ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="fk-champ"><span>Langue</span><select name="langue">${[['fr', 'Français'], ['en', 'Anglais'], ['fon', 'Fon'], ['yo', 'Yoruba']].map(([k, v]) => `<option value="${k}" ${k === f.langue ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          </div>
          <div class="fk-grille-2">
            <label class="fk-champ"><span>Prix (FCFA)</span><input type="number" name="prix" min="0" step="100" value="${f.prix}"><small>0 = gratuite. Le paiement en ligne arrive bientôt : une formation payante restera fermée aux inscriptions d'ici là.</small></label>
            <label class="fk-champ"><span>Visibilité</span><select name="visibilite"><option value="publique" ${f.visibilite === 'publique' ? 'selected' : ''}>Publique (catalogue)</option><option value="non_listee" ${f.visibilite === 'non_listee' ? 'selected' : ''}>Non listée (lien direct)</option></select></label>
          </div>
        </div>
        <div>
          <span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Image de couverture</span>
          <div class="fk-cover ${fkStyleCouverture(f).classe}" id="apercuCouverture" style="border-radius:14px;${fkStyleCouverture(f).style}"></div>
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="margin-top:10px;cursor:pointer">📷 Choisir une image<input type="file" id="fichierCouverture" accept="image/png,image/jpeg,image/webp" hidden data-edition></label>
          <small style="display:block;color:var(--f-muted);margin-top:6px">Format paysage conseillé (1280×720), 5 Mo max.</small>
          <label class="fk-champ" style="margin-top:14px"><span>Vidéo de présentation</span><input type="url" name="video_promo" placeholder="Lien YouTube ou Vimeo" value="${fkEchapper(f.video_promo || '')}"></label>
        </div>
      </div>
      <div class="fk-champ"><span>Description * <small style="display:inline;font-weight:400">(50 caractères minimum : objectifs, public visé, prérequis…)</small></span><div id="editeurDescription"></div></div>
      <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" type="submit" data-edition>Enregistrer</button></div>
    </form>`;
  const ed = fkEditeurRiche(document.getElementById('editeurDescription'), f.description, 'Présentez votre formation…');
  if (FKE.verrouille) ed.zone.contentEditable = 'false';

  document.getElementById('formInfos').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const video = (fd.get('video_promo') || '').trim();
    if (video && !fkIdYoutube(video) && !fkIdVimeo(video)) { fkToast('Vidéo de présentation : collez un lien YouTube ou Vimeo.', 'erreur'); return; }
    const prix = Math.max(0, parseInt(fd.get('prix'), 10) || 0);
    const { error } = await supabaseClient.from('formations').update({
      titre: fd.get('titre').trim(), sous_titre: fd.get('sous_titre').trim() || null,
      categorie_id: fd.get('categorie_id') ? Number(fd.get('categorie_id')) : null, niveau: fd.get('niveau'), langue: fd.get('langue'),
      prix, visibilite: fd.get('visibilite'), video_promo: video || null, description: ed.lireHtml() || null
    }).eq('id', f.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    fkToast('Informations enregistrées.', 'succes');
    await recharger();
  });

  document.getElementById('fichierCouverture').addEventListener('change', async e => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    const err = fkVerifierFichier(fichier, 'image');
    if (err) { fkToast(err, 'erreur'); return; }
    const chemin = `couvertures/${f.id}/${fkNomFichierSur(fichier.name)}`;
    const { error } = await supabaseClient.storage.from(FK_BUCKET_PUBLIC).upload(chemin, fichier, { contentType: fichier.type });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    const url = supabaseClient.storage.from(FK_BUCKET_PUBLIC).getPublicUrl(chemin).data.publicUrl;
    const { error: e2 } = await supabaseClient.from('formations').update({ image_couverture: url }).eq('id', f.id);
    if (e2) { fkToast(fkMessageErreur(e2), 'erreur'); return; }
    fkToast('Couverture mise à jour.', 'succes');
    await recharger();
  });
}

// ---------------------------------------------------------------- Programme
function iconeLecon(t) { return { video: '🎬', audio: '🎧', document: '📄', mixte: '🧩' }[t] || '📖'; }

function ongletProgramme() {
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = `
    <div class="fk-section-head" style="margin-bottom:14px"><div><h2 style="font-size:20px">Modules et leçons</h2><p>Organisez votre formation en modules, puis ajoutez des leçons dans chaque module.</p></div>
      <button class="fk-btn fk-btn-primary" id="btnModule" data-edition>＋ Ajouter un module</button></div>
    ${FKE.modules.length ? FKE.modules.map((m, i) => {
      const lecons = FKE.lecons.filter(l => l.module_id === m.id);
      return `<div class="fk-module">
        <div class="fk-module-tete"><span>Module ${i + 1} — ${fkEchapper(m.titre)}</span>
          <span class="fk-outils" style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-monter-module="${m.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter le module" data-edition>↑</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-descendre-module="${m.id}" ${i === FKE.modules.length - 1 ? 'disabled' : ''} aria-label="Descendre le module" data-edition>↓</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-editer-module="${m.id}" data-edition>✏️</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-supprimer-module="${m.id}" aria-label="Supprimer le module" data-edition>🗑️</button>
          </span></div>
        ${lecons.map((l, j) => `<div class="fk-lecon-ligne">
          <span class="fk-lecon-titre"><span aria-hidden="true">${iconeLecon(l.type_contenu)}</span><span>${fkEchapper(l.titre)}</span>
            ${l.est_apercu ? '<span class="fk-pastille publiee">Aperçu gratuit</span>' : ''}${!l.est_obligatoire ? '<span class="fk-pastille">Facultative</span>' : ''}</span>
          <span class="fk-outils"><small>${fkDuree(l.duree_minutes)}</small>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-monter-lecon="${l.id}" ${j === 0 ? 'disabled' : ''} aria-label="Monter" data-edition>↑</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-descendre-lecon="${l.id}" ${j === lecons.length - 1 ? 'disabled' : ''} aria-label="Descendre" data-edition>↓</button>
            <button class="fk-btn fk-btn-outline fk-btn-petit" data-editer-lecon="${l.id}">✏️ Modifier</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit" data-supprimer-lecon="${l.id}" aria-label="Supprimer" data-edition>🗑️</button></span>
        </div>`).join('')}
        <div class="fk-lecon-ligne"><button class="fk-btn fk-btn-ghost fk-btn-petit" data-ajouter-lecon="${m.id}" data-edition>＋ Ajouter une leçon</button></div>
      </div>`;
    }).join('') : '<div class="fk-carte fk-vide"><span class="fk-vide-icone">📚</span>Commencez par créer un premier module (ex. « Introduction »).</div>'}`;

  zone.querySelector('#btnModule').addEventListener('click', () => modaleModule(null));
  zone.querySelectorAll('[data-editer-module]').forEach(b => b.addEventListener('click', () => modaleModule(FKE.modules.find(m => m.id === Number(b.dataset.editerModule)))));
  zone.querySelectorAll('[data-supprimer-module]').forEach(b => b.addEventListener('click', async () => {
    const m = FKE.modules.find(x => x.id === Number(b.dataset.supprimerModule));
    if (!await fkConfirmer(`Supprimer le module « ${m.titre} » et toutes ses leçons ?`, 'Supprimer')) return;
    const { error } = await supabaseClient.from('formation_modules').delete().eq('id', m.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    await recharger();
  }));
  zone.querySelectorAll('[data-monter-module],[data-descendre-module]').forEach(b => b.addEventListener('click', () =>
    deplacer('formation_modules', FKE.modules, Number(b.dataset.monterModule || b.dataset.descendreModule), b.dataset.monterModule ? -1 : 1)));
  zone.querySelectorAll('[data-monter-lecon],[data-descendre-lecon]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.monterLecon || b.dataset.descendreLecon);
    const l = FKE.lecons.find(x => x.id === id);
    deplacer('formation_lecons', FKE.lecons.filter(x => x.module_id === l.module_id), id, b.dataset.monterLecon ? -1 : 1);
  }));
  zone.querySelectorAll('[data-ajouter-lecon]').forEach(b => b.addEventListener('click', () => modaleLecon(null, Number(b.dataset.ajouterLecon))));
  zone.querySelectorAll('[data-editer-lecon]').forEach(b => b.addEventListener('click', () => modaleLecon(FKE.lecons.find(l => l.id === Number(b.dataset.editerLecon)))));
  zone.querySelectorAll('[data-supprimer-lecon]').forEach(b => b.addEventListener('click', async () => {
    const l = FKE.lecons.find(x => x.id === Number(b.dataset.supprimerLecon));
    if (!await fkConfirmer(`Supprimer la leçon « ${l.titre} » ?`, 'Supprimer')) return;
    const fichiers = FKE.ressources.filter(r => r.lecon_id === l.id).map(r => r.chemin_fichier);
    [l.video_url, l.audio_url].forEach(u => { if (u && u.startsWith('fichier:')) fichiers.push(u.slice(8)); });
    const { error } = await supabaseClient.from('formation_lecons').delete().eq('id', l.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    if (fichiers.length) await supabaseClient.storage.from(FK_BUCKET_PRIVE).remove(fichiers);
    await recharger();
  }));
}

// Réordonne en réattribuant des positions 1..n après l'échange.
async function deplacer(table, liste, id, sens) {
  const ordre = [...liste];
  const i = ordre.findIndex(x => x.id === id);
  const j = i + sens;
  if (j < 0 || j >= ordre.length) return;
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  const maj = ordre.map((x, k) => supabaseClient.from(table).update({ position: k + 1 }).eq('id', x.id));
  const res = await Promise.all(maj);
  const err = res.find(r => r.error);
  if (err) fkToast(fkMessageErreur(err.error), 'erreur');
  await recharger();
}

function modaleModule(m) {
  const md = fkModale(m ? 'Modifier le module' : 'Nouveau module', `
    <form>
      <label class="fk-champ"><span>Titre *</span><input type="text" name="titre" required maxlength="150" value="${fkEchapper(m?.titre || '')}"></label>
      <label class="fk-champ"><span>Description</span><textarea name="description" maxlength="1000">${fkEchapper(m?.description || '')}</textarea></label>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
    </form>`);
  md.boite.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const donnees = { titre: fd.get('titre').trim(), description: fd.get('description').trim() || null };
    const { error } = m
      ? await supabaseClient.from('formation_modules').update(donnees).eq('id', m.id)
      : await supabaseClient.from('formation_modules').insert({ ...donnees, formation_id: FKE.f.id, position: FKE.modules.length + 1 });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    md.fermer();
    await recharger();
  });
}

function modaleLecon(l, moduleId) {
  const ressources = l ? FKE.ressources.filter(r => r.lecon_id === l.id) : [];
  const video = l?.video_url || '';
  const audio = l?.audio_url || '';
  const md = fkModale(l ? 'Modifier la leçon' : 'Nouvelle leçon', `
    <form id="formLecon">
      <label class="fk-champ"><span>Titre *</span><input type="text" name="titre" required maxlength="150" value="${fkEchapper(l?.titre || '')}"></label>
      <div class="fk-grille-3">
        <label class="fk-champ"><span>Type</span><select name="type_contenu">${[['texte', '📖 Texte'], ['video', '🎬 Vidéo'], ['audio', '🎧 Audio'], ['document', '📄 Document'], ['mixte', '🧩 Mixte']].map(([k, v]) => `<option value="${k}" ${k === (l?.type_contenu || 'texte') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="fk-champ"><span>Durée (min)</span><input type="number" name="duree_minutes" min="0" max="600" value="${l?.duree_minutes || 5}"></label>
        <label class="fk-champ"><span>Module</span><select name="module_id">${FKE.modules.map(m => `<option value="${m.id}" ${m.id === (l?.module_id || moduleId) ? 'selected' : ''}>${fkEchapper(m.titre)}</option>`).join('')}</select></label>
      </div>
      <label class="fk-case"><input type="checkbox" name="est_apercu" ${l?.est_apercu ? 'checked' : ''}> Aperçu gratuit (visible par tous sur la fiche de la formation)</label>
      <label class="fk-case"><input type="checkbox" name="est_obligatoire" ${l ? (l.est_obligatoire ? 'checked' : '') : 'checked'}> Leçon obligatoire (compte dans la progression)</label>
      <fieldset class="fk-carte" style="padding:14px;margin:6px 0 14px"><legend style="font-weight:700;padding:0 6px">🎬 Vidéo</legend>
        <label class="fk-champ"><span>Lien YouTube / Vimeo</span><input type="url" name="video_lien" placeholder="https://…" value="${video.startsWith('fichier:') ? '' : fkEchapper(video)}"></label>
        <div>${video.startsWith('fichier:') ? `<span class="fk-pastille publiee">Fichier vidéo hébergé</span> <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-retirer="video">Retirer</button>` : ''}
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer">⬆️ Envoyer un fichier vidéo (MP4, 50 Mo)<input type="file" data-media="video" accept="video/mp4,video/webm" hidden></label>
          <span data-etat="video" style="font-size:13px;color:var(--f-muted)"></span></div>
      </fieldset>
      <fieldset class="fk-carte" style="padding:14px;margin:0 0 14px"><legend style="font-weight:700;padding:0 6px">🎧 Audio</legend>
        <div>${audio.startsWith('fichier:') ? `<span class="fk-pastille publiee">Fichier audio hébergé</span> <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-retirer="audio">Retirer</button>` : ''}
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer">⬆️ Envoyer un fichier audio (MP3, M4A…)<input type="file" data-media="audio" accept="audio/*" hidden></label>
          <span data-etat="audio" style="font-size:13px;color:var(--f-muted)"></span></div>
      </fieldset>
      <div class="fk-champ"><span>Contenu de la leçon</span><div id="editeurLecon"></div></div>
      <fieldset class="fk-carte" style="padding:14px;margin:0 0 14px"><legend style="font-weight:700;padding:0 6px">📎 Ressources téléchargeables</legend>
        ${l ? `<div id="listeRessources">${ressources.map(r => `<div class="fk-ressource"><span>📄 ${fkEchapper(r.nom)} <small style="color:var(--f-muted)">${r.taille_octets ? (r.taille_octets / 1048576).toFixed(1) + ' Mo' : ''}</small></span><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-ressource="${r.id}">🗑️</button></div>`).join('') || '<p style="font-size:13px;color:var(--f-muted)">Aucune ressource.</p>'}</div>
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer">⬆️ Ajouter un document (PDF, Word, Excel…)<input type="file" id="fichierRessource" hidden></label>`
        : '<p style="font-size:13px;color:var(--f-muted);margin:0">Enregistrez d\'abord la leçon pour pouvoir y joindre des documents.</p>'}
      </fieldset>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Fermer</button><button class="fk-btn fk-btn-primary" type="submit" ${FKE.verrouille ? 'disabled' : ''}>Enregistrer la leçon</button></div>
    </form>`, { protegee: true });
  md.boite.style.width = 'min(860px, 100%)';
  const ed = fkEditeurRiche(md.boite.querySelector('#editeurLecon'), l?.contenu, 'Rédigez le contenu de la leçon…');
  const medias = { video: video.startsWith('fichier:') ? video : null, audio: audio.startsWith('fichier:') ? audio : null };
  const aSupprimer = [];

  md.boite.querySelectorAll('[data-retirer]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.retirer;
    if (medias[k]) aSupprimer.push(medias[k].slice(8));
    medias[k] = null;
    b.previousElementSibling.remove(); b.remove();
  }));
  md.boite.querySelectorAll('[data-media]').forEach(inp => inp.addEventListener('change', async () => {
    const k = inp.dataset.media;
    const fichier = inp.files[0];
    if (!fichier) return;
    const err = fkVerifierFichier(fichier, k);
    const etat = md.boite.querySelector(`[data-etat="${k}"]`);
    if (err) { fkToast(err, 'erreur'); return; }
    etat.textContent = '⏳ Envoi en cours…';
    const chemin = `${FKE.f.id}/${k === 'video' ? 'videos' : 'audio'}/${fkNomFichierSur(fichier.name)}`;
    const { error } = await supabaseClient.storage.from(FK_BUCKET_PRIVE).upload(chemin, fichier, { contentType: fichier.type });
    if (error) { etat.textContent = ''; fkToast(fkMessageErreur(error), 'erreur'); return; }
    if (medias[k]) aSupprimer.push(medias[k].slice(8));
    medias[k] = `fichier:${chemin}`;
    etat.textContent = `✅ ${fichier.name} envoyé (sera enregistré avec la leçon)`;
    if (k === 'video') md.boite.querySelector('[name=video_lien]').value = '';
  }));

  const inpRes = md.boite.querySelector('#fichierRessource');
  if (inpRes) inpRes.addEventListener('change', async () => {
    const fichier = inpRes.files[0];
    if (!fichier) return;
    const err = fkVerifierFichier(fichier, 'document');
    if (err) { fkToast(err, 'erreur'); return; }
    const chemin = `${FKE.f.id}/ressources/${fkNomFichierSur(fichier.name)}`;
    const { error } = await supabaseClient.storage.from(FK_BUCKET_PRIVE).upload(chemin, fichier, { contentType: fichier.type || undefined });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    const { data: r, error: e2 } = await supabaseClient.from('formation_ressources').insert({
      lecon_id: l.id, nom: fichier.name.slice(0, 150), chemin_fichier: chemin, type_fichier: fichier.type || null, taille_octets: fichier.size
    }).select().single();
    if (e2) { await supabaseClient.storage.from(FK_BUCKET_PRIVE).remove([chemin]); fkToast(fkMessageErreur(e2), 'erreur'); return; }
    FKE.ressources.push(r);
    const liste = md.boite.querySelector('#listeRessources');
    if (liste.querySelector('p')) liste.innerHTML = '';
    liste.insertAdjacentHTML('beforeend', `<div class="fk-ressource"><span>📄 ${fkEchapper(r.nom)}</span><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-ressource="${r.id}">🗑️</button></div>`);
    brancherSuppressionRessources();
    fkToast('Document ajouté.', 'succes');
  });
  function brancherSuppressionRessources() {
    md.boite.querySelectorAll('[data-suppr-ressource]').forEach(b => {
      if (b.dataset.branche) return;
      b.dataset.branche = '1';
      b.addEventListener('click', async () => {
        const r = FKE.ressources.find(x => x.id === Number(b.dataset.supprRessource));
        const { error } = await supabaseClient.from('formation_ressources').delete().eq('id', r.id);
        if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
        await supabaseClient.storage.from(FK_BUCKET_PRIVE).remove([r.chemin_fichier]);
        FKE.ressources = FKE.ressources.filter(x => x.id !== r.id);
        b.closest('.fk-ressource').remove();
      });
    });
  }
  brancherSuppressionRessources();

  md.boite.querySelector('#formLecon').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lien = (fd.get('video_lien') || '').trim();
    if (lien && !fkIdYoutube(lien) && !fkIdVimeo(lien) && !/^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(lien)) {
      fkToast('Lien vidéo : YouTube, Vimeo ou lien direct .mp4 en https.', 'erreur'); return;
    }
    const donnees = {
      titre: fd.get('titre').trim(), type_contenu: fd.get('type_contenu'), module_id: Number(fd.get('module_id')),
      duree_minutes: Math.max(0, parseInt(fd.get('duree_minutes'), 10) || 0),
      est_apercu: !!fd.get('est_apercu'), est_obligatoire: !!fd.get('est_obligatoire'),
      contenu: ed.lireHtml() || null,
      video_url: lien || medias.video || null, audio_url: medias.audio || null
    };
    if (lien && medias.video) aSupprimer.push(medias.video.slice(8));
    let res;
    if (l) res = await supabaseClient.from('formation_lecons').update(donnees).eq('id', l.id).select().single();
    else res = await supabaseClient.from('formation_lecons').insert({ ...donnees, formation_id: FKE.f.id, position: FKE.lecons.filter(x => x.module_id === donnees.module_id).length + 1 }).select().single();
    if (res.error) { fkToast(fkMessageErreur(res.error), 'erreur'); return; }
    if (aSupprimer.length) await supabaseClient.storage.from(FK_BUCKET_PRIVE).remove(aSupprimer);
    fkToast('Leçon enregistrée.', 'succes');
    md.fermer();
    await recharger();
    if (!l) modaleLecon(FKE.lecons.find(x => x.id === res.data.id)); // pour joindre des documents
  });
}

// ---------------------------------------------------------------- Quiz
function ongletQuiz() {
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = `
    <div class="fk-section-head" style="margin-bottom:14px"><div><h2 style="font-size:20px">Quiz d'évaluation</h2><p>Chaque quiz est rattaché à un module. Les bonnes réponses ne sont jamais envoyées aux apprenants avant la correction.</p></div>
      <button class="fk-btn fk-btn-primary" id="btnQuiz" data-edition ${FKE.modules.length ? '' : 'disabled'}>＋ Nouveau quiz</button></div>
    ${!FKE.modules.length ? '<div class="fk-alerte fk-alerte-info">Créez d\'abord un module dans l\'onglet « Programme ».</div>' : ''}
    ${FKE.quiz.length ? `<div class="fk-table-wrap fk-carte"><table class="fk-table"><thead><tr><th>Quiz</th><th>Module</th><th>Questions</th><th>Réussite</th><th>Essais</th><th>Durée</th><th></th></tr></thead><tbody>
      ${FKE.quiz.map(q => `<tr><td><b>${fkEchapper(q.titre)}</b></td><td>${fkEchapper(FKE.modules.find(m => m.id === q.module_id)?.titre || '—')}</td>
        <td>${q.formation_questions.length}</td><td>${q.note_passage} %</td><td>${q.essais_autorises || 'Illimités'}</td><td>${q.duree_limite_minutes ? q.duree_limite_minutes + ' min' : '—'}</td>
        <td style="white-space:nowrap"><button class="fk-btn fk-btn-primary fk-btn-petit" data-questions="${q.id}">Questions</button>
          <button class="fk-btn fk-btn-ghost fk-btn-petit" data-editer-quiz="${q.id}" data-edition>⚙️</button>
          <button class="fk-btn fk-btn-ghost fk-btn-petit" data-supprimer-quiz="${q.id}" data-edition aria-label="Supprimer">🗑️</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="fk-carte fk-vide"><span class="fk-vide-icone">✅</span>Aucun quiz pour le moment (facultatif).</div>'}`;
  zone.querySelector('#btnQuiz').addEventListener('click', () => modaleQuiz(null));
  zone.querySelectorAll('[data-editer-quiz]').forEach(b => b.addEventListener('click', () => modaleQuiz(FKE.quiz.find(q => q.id === Number(b.dataset.editerQuiz)))));
  zone.querySelectorAll('[data-questions]').forEach(b => b.addEventListener('click', () => modaleQuestions(FKE.quiz.find(q => q.id === Number(b.dataset.questions)))));
  zone.querySelectorAll('[data-supprimer-quiz]').forEach(b => b.addEventListener('click', async () => {
    const q = FKE.quiz.find(x => x.id === Number(b.dataset.supprimerQuiz));
    if (!await fkConfirmer(`Supprimer le quiz « ${q.titre} » et toutes ses questions ?`, 'Supprimer')) return;
    const { error } = await supabaseClient.from('formation_quiz').delete().eq('id', q.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    await recharger();
  }));
}

function modaleQuiz(q) {
  const md = fkModale(q ? 'Paramètres du quiz' : 'Nouveau quiz', `
    <form>
      <label class="fk-champ"><span>Titre *</span><input type="text" name="titre" required maxlength="150" value="${fkEchapper(q?.titre || '')}"></label>
      <label class="fk-champ"><span>Module *</span><select name="module_id">${FKE.modules.map(m => `<option value="${m.id}" ${m.id === q?.module_id ? 'selected' : ''}>${fkEchapper(m.titre)}</option>`).join('')}</select><small>Le quiz apparaît à la fin de ce module.</small></label>
      <label class="fk-champ"><span>Consigne</span><textarea name="description" maxlength="1000">${fkEchapper(q?.description || '')}</textarea></label>
      <div class="fk-grille-3">
        <label class="fk-champ"><span>Score pour réussir (%)</span><input type="number" name="note_passage" min="0" max="100" value="${q?.note_passage ?? 70}"></label>
        <label class="fk-champ"><span>Essais autorisés</span><input type="number" name="essais_autorises" min="0" max="20" value="${q?.essais_autorises ?? 3}"><small>0 = illimités</small></label>
        <label class="fk-champ"><span>Durée limite (min)</span><input type="number" name="duree" min="0" max="240" value="${q?.duree_limite_minutes || 0}"><small>0 = sans limite</small></label>
      </div>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
    </form>`);
  md.boite.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const duree = parseInt(fd.get('duree'), 10) || 0;
    const donnees = {
      titre: fd.get('titre').trim(), module_id: Number(fd.get('module_id')), description: fd.get('description').trim() || null,
      note_passage: Math.min(100, Math.max(0, parseInt(fd.get('note_passage'), 10) || 0)),
      essais_autorises: Math.max(0, parseInt(fd.get('essais_autorises'), 10) || 0), duree_limite_minutes: duree > 0 ? duree : null
    };
    const res = q ? await supabaseClient.from('formation_quiz').update(donnees).eq('id', q.id).select().single()
      : await supabaseClient.from('formation_quiz').insert({ ...donnees, formation_id: FKE.f.id, position: FKE.quiz.length + 1 }).select().single();
    if (res.error) { fkToast(fkMessageErreur(res.error), 'erreur'); return; }
    md.fermer();
    await recharger();
    if (!q) modaleQuestions(FKE.quiz.find(x => x.id === res.data.id));
  });
}

async function modaleQuestions(q) {
  const { data: questions, error } = await supabaseClient.from('formation_questions')
    .select('*, formation_reponses(*)').eq('quiz_id', q.id).order('position').order('id');
  if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
  const liste = (questions || []).map(x => ({ ...x, formation_reponses: (x.formation_reponses || []).sort((a, b) => a.position - b.position || a.id - b.id) }));
  const md = fkModale(`Questions — ${q.titre}`, `
    <div id="listeQuestions">${liste.length ? liste.map((x, i) => `
      <div class="fk-question">
        <div style="display:flex;justify-content:space-between;gap:10px"><h3>${i + 1}. ${fkEchapper(x.enonce)}</h3>
          <span style="white-space:nowrap"><button class="fk-btn fk-btn-ghost fk-btn-petit" data-editer-q="${x.id}" ${FKE.verrouille ? 'disabled' : ''}>✏️</button>
          <button class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-q="${x.id}" ${FKE.verrouille ? 'disabled' : ''} aria-label="Supprimer">🗑️</button></span></div>
        <small style="color:var(--f-muted)">${{ choix_unique: 'Choix unique', choix_multiple: 'Choix multiple', vrai_faux: 'Vrai / Faux' }[x.type]} · ${x.points} pt${x.points > 1 ? 's' : ''}</small>
        <ul style="margin:8px 0 0;padding-left:18px">${x.formation_reponses.map(r => `<li>${r.est_correcte ? '✅' : '▫️'} ${fkEchapper(r.texte)}</li>`).join('')}</ul>
      </div>`).join('') : '<p class="fk-vide">Aucune question.</p>'}</div>
    <div class="fk-actions-form"><button class="fk-btn fk-btn-ghost" data-fermer>Fermer</button><button class="fk-btn fk-btn-primary" id="btnAjoutQ" ${FKE.verrouille ? 'disabled' : ''}>＋ Ajouter une question</button></div>`);
  md.boite.style.width = 'min(820px, 100%)';
  md.boite.querySelector('#btnAjoutQ').addEventListener('click', () => { md.fermer(); modaleQuestion(q, null, liste.length); });
  md.boite.querySelectorAll('[data-editer-q]').forEach(b => b.addEventListener('click', () => { md.fermer(); modaleQuestion(q, liste.find(x => x.id === Number(b.dataset.editerQ)), liste.length); }));
  md.boite.querySelectorAll('[data-suppr-q]').forEach(b => b.addEventListener('click', async () => {
    if (!await fkConfirmer('Supprimer cette question ?', 'Supprimer')) return;
    const { error: e2 } = await supabaseClient.from('formation_questions').delete().eq('id', Number(b.dataset.supprQ));
    if (e2) { fkToast(fkMessageErreur(e2), 'erreur'); return; }
    md.fermer();
    await recharger();
    modaleQuestions(q);
  }));
}

function modaleQuestion(q, x, nb) {
  let reponses = x ? x.formation_reponses.map(r => ({ texte: r.texte, ok: r.est_correcte })) : [{ texte: '', ok: true }, { texte: '', ok: false }];
  const md = fkModale(x ? 'Modifier la question' : 'Nouvelle question', `
    <form>
      <label class="fk-champ"><span>Énoncé *</span><textarea name="enonce" required maxlength="1000" style="min-height:80px">${fkEchapper(x?.enonce || '')}</textarea></label>
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Type</span><select name="type">
          <option value="choix_unique" ${x?.type === 'choix_unique' ? 'selected' : ''}>Choix unique</option>
          <option value="choix_multiple" ${x?.type === 'choix_multiple' ? 'selected' : ''}>Choix multiple</option>
          <option value="vrai_faux" ${x?.type === 'vrai_faux' ? 'selected' : ''}>Vrai / Faux</option></select></label>
        <label class="fk-champ"><span>Points</span><input type="number" name="points" min="1" max="20" value="${x?.points || 1}"></label>
      </div>
      <span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Réponses (cochez la ou les bonnes)</span>
      <div id="zoneReponses"></div>
      <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" id="btnAjoutR">＋ Ajouter une réponse</button>
      <label class="fk-champ" style="margin-top:14px"><span>Explication (affichée avec la correction)</span><textarea name="explication" maxlength="1000" style="min-height:70px">${fkEchapper(x?.explication || '')}</textarea></label>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-annuler>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
    </form>`, { protegee: true });
  const form = md.boite.querySelector('form');
  const zoneR = md.boite.querySelector('#zoneReponses');
  const type = () => form.type.value;
  function dessiner() {
    const unique = type() !== 'choix_multiple';
    zoneR.innerHTML = reponses.map((r, i) => `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input type="${unique ? 'radio' : 'checkbox'}" name="bonne" ${r.ok ? 'checked' : ''} data-i="${i}" aria-label="Bonne réponse">
        <input class="fk-input" type="text" value="${fkEchapper(r.texte)}" data-texte="${i}" maxlength="300" placeholder="Réponse ${i + 1}" ${type() === 'vrai_faux' ? 'readonly' : ''}>
        ${type() === 'vrai_faux' ? '' : `<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-r="${i}" aria-label="Retirer">✕</button>`}
      </div>`).join('');
    zoneR.querySelectorAll('[data-texte]').forEach(inp => inp.addEventListener('input', () => { reponses[Number(inp.dataset.texte)].texte = inp.value; }));
    zoneR.querySelectorAll('[name=bonne]').forEach(inp => inp.addEventListener('change', () => {
      if (unique) reponses.forEach((r, i) => { r.ok = i === Number(inp.dataset.i); });
      else reponses[Number(inp.dataset.i)].ok = inp.checked;
    }));
    zoneR.querySelectorAll('[data-suppr-r]').forEach(b => b.addEventListener('click', () => { reponses.splice(Number(b.dataset.supprR), 1); dessiner(); }));
    md.boite.querySelector('#btnAjoutR').style.display = type() === 'vrai_faux' ? 'none' : '';
  }
  form.type.addEventListener('change', () => {
    if (type() === 'vrai_faux') reponses = [{ texte: 'Vrai', ok: true }, { texte: 'Faux', ok: false }];
    else if (type() === 'choix_unique') { let vu = false; reponses.forEach(r => { if (r.ok && !vu) vu = true; else r.ok = false; }); }
    dessiner();
  });
  md.boite.querySelector('#btnAjoutR').addEventListener('click', () => { if (reponses.length < 8) { reponses.push({ texte: '', ok: false }); dessiner(); } });
  md.boite.querySelector('[data-annuler]').addEventListener('click', () => { md.fermer(); modaleQuestions(q); });
  dessiner();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const propres = reponses.map(r => ({ ...r, texte: r.texte.trim() })).filter(r => r.texte);
    if (propres.length < 2) { fkToast('Au moins deux réponses.', 'erreur'); return; }
    if (!propres.some(r => r.ok)) { fkToast('Cochez au moins une bonne réponse.', 'erreur'); return; }
    const donnees = { enonce: form.enonce.value.trim(), type: type(), points: Math.max(1, parseInt(form.points.value, 10) || 1), explication: form.explication.value.trim() || null };
    let qid = x?.id;
    if (x) {
      const { error } = await supabaseClient.from('formation_questions').update(donnees).eq('id', x.id);
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      const { error: e2 } = await supabaseClient.from('formation_reponses').delete().eq('question_id', x.id);
      if (e2) { fkToast(fkMessageErreur(e2), 'erreur'); return; }
    } else {
      const { data, error } = await supabaseClient.from('formation_questions').insert({ ...donnees, quiz_id: q.id, position: nb + 1 }).select('id').single();
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      qid = data.id;
    }
    const { error: e3 } = await supabaseClient.from('formation_reponses').insert(propres.map((r, i) => ({ question_id: qid, texte: r.texte, est_correcte: r.ok, position: i + 1 })));
    if (e3) { fkToast(fkMessageErreur(e3), 'erreur'); return; }
    md.fermer();
    await recharger();
    modaleQuestions(q);
  });
}

// ---------------------------------------------------------------- Apprenants
async function ongletApprenants() {
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = '<div class="fk-chargement">Chargement…</div>';
  const { data, error } = await supabaseClient.rpc('apprenants_formation', { p_formation_id: FKE.f.id });
  if (error) { zone.innerHTML = `<p class="fk-alerte fk-alerte-erreur">${fkEchapper(fkMessageErreur(error))}</p>`; return; }
  const liste = data || [];
  const termines = liste.filter(a => a.statut === 'terminee').length;
  const moyenne = liste.length ? liste.reduce((t, a) => t + Number(a.progression), 0) / liste.length : 0;
  zone.innerHTML = `
    <div class="fk-stats">
      <div class="fk-stat"><small>Inscrits</small><strong>${liste.length}</strong></div>
      <div class="fk-stat"><small>Ont terminé</small><strong>${termines}</strong></div>
      <div class="fk-stat"><small>Progression moyenne</small><strong>${fkPourcentage(moyenne)}</strong></div>
      <div class="fk-stat"><small>Taux de complétion</small><strong>${liste.length ? fkPourcentage(termines * 100 / liste.length) : '—'}</strong></div>
    </div>
    <div class="fk-carte">${liste.length ? `<div class="fk-table-wrap"><table class="fk-table"><thead><tr><th>Apprenant</th><th>Progression</th><th>Statut</th><th>Inscrit le</th><th>Dernière activité</th></tr></thead><tbody>
      ${liste.map(a => `<tr><td>${fkEchapper(a.prenom)} ${fkEchapper(a.nom)}</td>
        <td style="min-width:140px"><div class="fk-progress"><span style="width:${Math.round(a.progression)}%"></span></div><small>${fkPourcentage(a.progression)}</small></td>
        <td><span class="fk-pastille ${a.statut}">${{ active: 'En cours', terminee: 'Terminée', annulee: 'Annulée', suspendue: 'Suspendue' }[a.statut]}</span></td>
        <td>${fkDate(a.inscrit_le)}</td><td>${fkDate(a.derniere_activite)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="fk-vide">Aucun apprenant inscrit pour le moment.</p>'}</div>`;
}

// ---------------------------------------------------------------- Publication
function ongletPublication() {
  const f = FKE.f;
  const verifs = [
    [f.titre && f.titre.length >= 5, 'Un titre'],
    [!!f.categorie_id, 'Une catégorie'],
    [(f.description || '').length >= 50, 'Une description (50 caractères minimum)'],
    [FKE.modules.length > 0, 'Au moins un module'],
    [FKE.modules.length > 0 && FKE.modules.every(m => FKE.lecons.some(l => l.module_id === m.id)), 'Au moins une leçon dans chaque module'],
    [FKE.quiz.every(q => q.formation_questions.length > 0), 'Au moins une question dans chaque quiz'],
    [!!f.image_couverture, 'Une image de couverture (conseillé)', true]
  ];
  const pret = verifs.every(([ok, , conseil]) => ok || conseil);
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = `
    <div class="fk-grille-2">
      <section class="fk-carte"><h2>Liste de vérification</h2>
        <ul style="list-style:none;padding:0;margin:0;line-height:2">${verifs.map(([ok, l, conseil]) => `<li>${ok ? '✅' : conseil ? '💡' : '⬜'} ${l}</li>`).join('')}</ul>
        <p style="font-size:13px;color:var(--f-muted)">KEKELI vérifie aussi que chaque question a au moins deux réponses dont une correcte.</p>
      </section>
      <section class="fk-carte"><h2>Statut : <span class="fk-pastille ${f.statut}">${FK_STATUTS_FORMATION[f.statut]}</span></h2>
        ${f.statut === 'brouillon' || f.statut === 'refusee' ? `
          <p>Quand votre formation est prête, soumettez-la : l'équipe KEKELI la vérifie (qualité, exactitude, droits d'auteur) puis la publie. Vous serez notifié(e).</p>
          <button class="fk-btn fk-btn-primary" id="btnSoumettre" ${pret ? '' : 'disabled'}>🚀 Soumettre pour validation</button>` : ''}
        ${f.statut === 'en_revision' ? `<p>Soumise le ${fkDate(f.soumise_le)}. Vous serez notifié(e) de la décision.</p>
          <button class="fk-btn fk-btn-outline" id="btnAnnuler">↩️ Annuler la soumission (pour modifier)</button>` : ''}
        ${f.statut === 'publiee' ? `<p>Publiée le ${fkDate(f.publiee_le)}. ${f.nb_inscrits} apprenant${f.nb_inscrits > 1 ? 's' : ''} inscrit${f.nb_inscrits > 1 ? 's' : ''}.</p>
          <a class="fk-btn fk-btn-primary" href="${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}">Voir la fiche publique</a>` : ''}
        ${f.statut === 'archivee' ? '<p>Cette formation a été archivée par KEKELI. Contactez l\'administration pour plus d\'informations.</p>' : ''}
        ${(f.statut === 'brouillon' || f.statut === 'refusee') && f.nb_inscrits === 0 ? `<hr style="border:0;border-top:1px solid var(--f-border);margin:20px 0">
          <button class="fk-btn fk-btn-danger fk-btn-petit" id="btnSupprimer">🗑️ Supprimer cette formation</button>` : ''}
      </section>
    </div>`;
  zone.querySelector('#btnSoumettre')?.addEventListener('click', async () => {
    if (!await fkConfirmer('Soumettre cette formation à l\'équipe KEKELI ? Elle ne sera plus modifiable pendant la vérification.', 'Soumettre')) return;
    const { error } = await supabaseClient.rpc('soumettre_formation', { p_id: f.id });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    fkToast('Formation soumise ! Vous serez notifié(e) de la décision.', 'succes');
    await recharger();
  });
  zone.querySelector('#btnAnnuler')?.addEventListener('click', async () => {
    const { error } = await supabaseClient.rpc('annuler_soumission_formation', { p_id: f.id });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    await recharger();
  });
  zone.querySelector('#btnSupprimer')?.addEventListener('click', async () => {
    if (!await fkConfirmer(`Supprimer définitivement « ${f.titre} » ? Cette action est irréversible.`, 'Supprimer')) return;
    const { data: fichiers } = await supabaseClient.from('formation_ressources').select('chemin_fichier').eq('formation_id', f.id);
    const chemins = (fichiers || []).map(x => x.chemin_fichier);
    FKE.lecons.forEach(l => [l.video_url, l.audio_url].forEach(u => { if (u && u.startsWith('fichier:')) chemins.push(u.slice(8)); }));
    const { error } = await supabaseClient.from('formations').delete().eq('id', f.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    if (chemins.length) await supabaseClient.storage.from(FK_BUCKET_PRIVE).remove(chemins);
    window.location.href = 'tableau-de-bord.html';
  });
}
