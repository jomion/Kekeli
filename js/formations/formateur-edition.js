// Espace formateur — gestion d'UNE formation
// (pages/formations/formateur/formation.html?id=...&onglet=...).
// Onglets : Informations · Programme (modules/leçons/ressources) · Quiz ·
// Apprenants · Publication. Toutes les écritures sont contrôlées côté
// serveur (RLS peut_editer_formation : propriétaire validé hors révision,
// ou gestionnaire KEKELI).

const FKE = { s: null, f: null, modules: [], lecons: [], ressources: [], quiz: [], categories: [], activites: [], onglet: 'infos', verrouille: false };

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
  const [mods, lecs, res, qz, cats, acts] = await Promise.all([
    supabaseClient.from('formation_modules').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_lecons').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_ressources').select('*').eq('formation_id', id).order('id'),
    supabaseClient.from('formation_quiz').select('*, formation_questions(id)').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_categories').select('id, nom, parent_id').eq('statut', 'actif').order('position'),
    supabaseClient.from('formation_activites_lecon').select('*').eq('formation_id', id).order('id')
  ]);
  FKE.modules = mods.data || [];
  FKE.lecons = lecs.data || [];
  FKE.ressources = res.data || [];
  FKE.quiz = qz.data || [];
  FKE.activites = acts.data || [];
  FKE.categories = cats.data || [];
}

async function recharger() {
  await chargerTout(FKE.f.id);
  rendrePage();
}

function rendrePage() {
  const f = FKE.f;
  const onglets = [['infos', '📝 Informations'], ['programme', '📚 Programme'], ['quiz', '✅ Quiz'], ['activites', '🧭 Tests en leçon'], ['apprenants', `👥 Apprenants (${f.nb_inscrits})`], ['publication', '🚀 Publication']];
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
  ({ infos: ongletInfos, programme: ongletProgramme, quiz: ongletQuiz, activites: ongletActivites, apprenants: ongletApprenants, publication: ongletPublication })[FKE.onglet]?.();
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
  const ed = fkEditeurRiche(document.getElementById('editeurDescription'), f.description, 'Présentez votre formation…', { formationId: f.id });
  if (FKE.verrouille) ed.desactiver();

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
  const ed = fkEditeurRiche(md.boite.querySelector('#editeurLecon'), l?.contenu, 'Rédigez le contenu de la leçon…', {
    formationId: FKE.f.id,
    diaporama: true,
    activites: l ? {
      leconId: l.id,
      get liste() { return FKE.activites; },
      editer: async id => modaleActivite(l.id, id ? FKE.activites.find(x => x.id === id) : null)
    } : { leconId: null, liste: [], editer: async () => null }
  });
  if (FKE.verrouille) ed.desactiver();
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
    // Tests retirés du texte de la leçon : supprimés aussi en base.
    if (l) {
      const gardes = new Set(ed.idsActivites());
      const orphelins = FKE.activites.filter(x => x.lecon_id === l.id && !gardes.has(x.id)).map(x => x.id);
      if (orphelins.length) await supabaseClient.from('formation_activites_lecon').delete().in('id', orphelins);
    }
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

function resumeQuestionHtml(x) {
  const c = x.config || {};
  const li = arr => `<ul style="margin:8px 0 0;padding-left:18px">${arr.map(v => `<li>${v}</li>`).join('')}</ul>`;
  const e = fkEchapper;
  switch (x.type) {
    case 'reponse_courte': return li((c.acceptees || []).map(a => `✅ ${e(a)}`));
    case 'reponse_numerique': return li([`✅ ${e(c.valeur)} ${e(c.unite || '')}${c.tolerance ? ` (± ${e(c.tolerance)})` : ''}`]);
    case 'texte_a_trous': return li((c.trous || []).map((t, i) => `Trou ${i + 1} : ✅ ${e((t || []).join(' / '))}`));
    case 'texte_a_trous_glisser': return li([...(c.trous || []).map((t, i) => `Trou ${i + 1} : ✅ ${e(t)}`), ...((c.banque || []).length ? [`Intrus : ${e(c.banque.join(', '))}`] : [])]);
    case 'remise_en_ordre': return `<ol style="margin:8px 0 0;padding-left:22px">${(c.elements || []).map(v => `<li>${e(v)}</li>`).join('')}</ol>`;
    case 'association': return li((c.paires || []).map(p => `${e(p.gauche)} ↔ ${e(p.droite)}`));
    case 'classement': return li((c.categories || []).map(cat => `<b>${e(cat)}</b> : ${e((c.elements || []).filter(el => el.categorie === cat).map(el => el.texte).join(', '))}`));
    case 'intrus_lexical': return li((c.series || []).map(s => (s.mots || []).map((m, i) => i === Number(s.intrus) ? `<b>✅ ${e(m)}</b>` : e(m)).join(', ')));
    case 'selection_mots': { const mots = fkMots(x.enonce); return li([`✅ ${e((c.corrects || []).map(i => mots[Number(i)]).filter(Boolean).join(', '))}`]); }
    default: return li((x.formation_reponses || []).map(r => `${r.est_correcte ? '✅' : '▫️'} ${e(r.texte)}`));
  }
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
          <span style="white-space:nowrap"><button class="fk-btn fk-btn-ghost fk-btn-petit" data-editer-q="${x.id}" ${FKE.verrouille ? 'disabled' : ''} aria-label="Modifier">✏️</button>
          <button class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-q="${x.id}" ${FKE.verrouille ? 'disabled' : ''} aria-label="Supprimer">🗑️</button></span></div>
        <small style="color:var(--f-muted)">${FK_TYPES_QUESTIONS[x.type]?.icone || ''} ${FK_TYPES_QUESTIONS[x.type]?.label || x.type} · ${x.points} pt${x.points > 1 ? 's' : ''}</small>
        ${resumeQuestionHtml(x)}
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

// Éditeur d'une question, tous types confondus. Les choix (QCM, vrai/faux)
// restent dans formation_reponses ; les autres types rangent leur corrigé
// dans formation_questions.config (jamais envoyé aux étudiants : le serveur
// n'en extrait que la partie publique, voir formation_question_publique).
function modaleQuestion(q, x, nb) {
  const e = fkEchapper;
  const cfg = JSON.parse(JSON.stringify(x?.config || {}));
  let reponses = x && x.formation_reponses.length ? x.formation_reponses.map(r => ({ texte: r.texte, ok: r.est_correcte })) : [{ texte: '', ok: true }, { texte: '', ok: false }];
  let paires = (cfg.paires || []).length ? cfg.paires : [{ gauche: '', droite: '' }, { gauche: '', droite: '' }];
  let elementsClassement = (cfg.elements && cfg.elements[0] && typeof cfg.elements[0] === 'object') ? cfg.elements : [{ texte: '', categorie: '' }, { texte: '', categorie: '' }];
  let corrects = new Set((cfg.corrects || []).map(String));
  const md = fkModale(x ? 'Modifier la question' : 'Nouvelle question', `
    <form>
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Type de question</span><select name="type">
          ${Object.entries(FK_TYPES_QUESTIONS).map(([k, v]) => `<option value="${k}" ${k === (x?.type || 'choix_unique') ? 'selected' : ''}>${v.icone} ${v.label}</option>`).join('')}</select></label>
        <label class="fk-champ"><span>Points</span><input type="number" name="points" min="1" max="20" value="${x?.points || 1}"></label>
      </div>
      <label class="fk-champ"><span>Énoncé *</span><textarea name="enonce" required maxlength="2000" style="min-height:90px">${e(x?.enonce || '')}</textarea><small data-aide-enonce></small></label>
      <div data-corps></div>
      <label class="fk-champ" style="margin-top:14px"><span>Explication (affichée avec la correction)</span><textarea name="explication" maxlength="1000" style="min-height:70px">${e(x?.explication || '')}</textarea></label>
      <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-annuler>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
    </form>`, { protegee: true });
  md.boite.style.width = 'min(820px, 100%)';
  const form = md.boite.querySelector('form');
  const corps = md.boite.querySelector('[data-corps]');
  const aide = md.boite.querySelector('[data-aide-enonce]');
  const type = () => form.type.value;
  const lignes = t => String(t || '').split('\n').map(v => v.trim()).filter(Boolean);

  function dessiner() {
    const t = type();
    aide.textContent = {
      texte_a_trous: 'Écrivez ___ (3 tirets bas) à la place de chaque mot à trouver.',
      texte_a_trous_glisser: 'Écrivez ___ (3 tirets bas) à la place de chaque mot ; l\'étudiant le choisira dans une banque de mots.',
      selection_mots: 'Texte simple : l\'étudiant cliquera sur les bons mots. Cochez-les ci-dessous.'
    }[t] || '';
    if (FK_TYPES_CHOIX.includes(t)) {
      const unique = t !== 'choix_multiple';
      corps.innerHTML = `<span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Réponses (cochez la ou les bonnes)</span>
        ${reponses.map((r, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input type="${unique ? 'radio' : 'checkbox'}" name="bonne" ${r.ok ? 'checked' : ''} data-i="${i}" aria-label="Bonne réponse">
          <input class="fk-input" type="text" value="${e(r.texte)}" data-texte="${i}" maxlength="300" placeholder="Réponse ${i + 1}" ${t === 'vrai_faux' ? 'readonly' : ''}>
          ${t === 'vrai_faux' ? '' : `<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-r="${i}" aria-label="Retirer">✕</button>`}</div>`).join('')}
        ${t === 'vrai_faux' ? '' : '<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-ajout-r>＋ Ajouter une réponse</button>'}`;
      corps.querySelectorAll('[data-texte]').forEach(inp => inp.addEventListener('input', () => { reponses[Number(inp.dataset.texte)].texte = inp.value; }));
      corps.querySelectorAll('[name=bonne]').forEach(inp => inp.addEventListener('change', () => {
        if (unique) reponses.forEach((r, i) => { r.ok = i === Number(inp.dataset.i); }); else reponses[Number(inp.dataset.i)].ok = inp.checked;
      }));
      corps.querySelectorAll('[data-suppr-r]').forEach(b => b.addEventListener('click', () => { reponses.splice(Number(b.dataset.supprR), 1); dessiner(); }));
      corps.querySelector('[data-ajout-r]')?.addEventListener('click', () => { if (reponses.length < 8) { reponses.push({ texte: '', ok: false }); dessiner(); } });
    } else if (t === 'reponse_courte') {
      corps.innerHTML = `<label class="fk-champ"><span>Réponses acceptées (une par ligne)</span><textarea data-c="acceptees" style="min-height:80px" placeholder="Porto-Novo">${e((cfg.acceptees || []).join('\n'))}</textarea>
        <small>Majuscules, accents, tirets et ponctuation ne sont pas pris en compte (« porto novo » = « Porto-Novo »).</small></label>`;
    } else if (t === 'reponse_numerique') {
      corps.innerHTML = `<div class="fk-grille-3">
        <label class="fk-champ"><span>Réponse exacte *</span><input type="number" step="any" data-c="valeur" value="${e(cfg.valeur ?? '')}"></label>
        <label class="fk-champ"><span>Tolérance (±)</span><input type="number" step="any" min="0" data-c="tolerance" value="${e(cfg.tolerance ?? 0)}"></label>
        <label class="fk-champ"><span>Unité (affichée)</span><input type="text" maxlength="20" data-c="unite" value="${e(cfg.unite || '')}" placeholder="kg, FCFA, m²…"></label></div>
        <small style="color:var(--f-muted)">La virgule est acceptée comme séparateur décimal (3,5 = 3.5).</small>`;
    } else if (t === 'texte_a_trous') {
      const n = fkNbTrous(form.enonce.value);
      const trous = cfg.trous || [];
      corps.innerHTML = n ? Array.from({ length: n }, (_, i) => `<label class="fk-champ"><span>Trou ${i + 1} — réponse(s) acceptée(s), séparées par |</span>
        <input type="text" data-trou="${i}" value="${e((trous[i] || []).join(' | '))}" placeholder="chat | chaton"></label>`).join('')
        : '<p class="fk-alerte fk-alerte-info">Ajoutez des ___ dans l\'énoncé pour créer les trous.</p>';
      corps.querySelectorAll('[data-trou]').forEach(inp => inp.addEventListener('input', () => {
        cfg.trous = cfg.trous || []; cfg.trous[Number(inp.dataset.trou)] = inp.value.split('|').map(v => v.trim()).filter(Boolean);
      }));
    } else if (t === 'texte_a_trous_glisser') {
      const n = fkNbTrous(form.enonce.value);
      const trous = cfg.trous || [];
      corps.innerHTML = (n ? Array.from({ length: n }, (_, i) => `<label class="fk-champ"><span>Trou ${i + 1} — bon mot</span>
        <input type="text" data-trou="${i}" value="${e(trous[i] || '')}"></label>`).join('') : '<p class="fk-alerte fk-alerte-info">Ajoutez des ___ dans l\'énoncé pour créer les trous.</p>')
        + `<label class="fk-champ"><span>Mots intrus ajoutés à la banque (séparés par une virgule, facultatif)</span><input type="text" data-c="banque" value="${e((cfg.banque || []).join(', '))}" placeholder="mange, dort"></label>`;
      corps.querySelectorAll('[data-trou]').forEach(inp => inp.addEventListener('input', () => { cfg.trous = cfg.trous || []; cfg.trous[Number(inp.dataset.trou)] = inp.value.trim(); }));
    } else if (t === 'remise_en_ordre') {
      corps.innerHTML = `<label class="fk-champ"><span>Éléments dans le BON ordre (un par ligne)</span><textarea data-c="elements" style="min-height:110px" placeholder="Allumer l'ordinateur&#10;Ouvrir Excel&#10;Créer un classeur">${e((cfg.elements || []).join('\n'))}</textarea>
        <small>Ils seront mélangés pour l'étudiant, qui devra les remettre dans cet ordre.</small></label>`;
    } else if (t === 'association') {
      corps.innerHTML = `<span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Paires à relier</span>
        ${paires.map((p, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input class="fk-input" type="text" data-g="${i}" value="${e(p.gauche)}" placeholder="Élément ${i + 1}" maxlength="200">
          <span aria-hidden="true">↔</span>
          <input class="fk-input" type="text" data-d="${i}" value="${e(p.droite)}" placeholder="Correspondance" maxlength="200">
          <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-p="${i}" aria-label="Retirer">✕</button></div>`).join('')}
        <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-ajout-p>＋ Ajouter une paire</button>`;
      corps.querySelectorAll('[data-g]').forEach(inp => inp.addEventListener('input', () => { paires[Number(inp.dataset.g)].gauche = inp.value; }));
      corps.querySelectorAll('[data-d]').forEach(inp => inp.addEventListener('input', () => { paires[Number(inp.dataset.d)].droite = inp.value; }));
      corps.querySelectorAll('[data-suppr-p]').forEach(b => b.addEventListener('click', () => { paires.splice(Number(b.dataset.supprP), 1); dessiner(); }));
      corps.querySelector('[data-ajout-p]').addEventListener('click', () => { if (paires.length < 12) { paires.push({ gauche: '', droite: '' }); dessiner(); } });
    } else if (t === 'classement') {
      const cats = cfg.categories || [];
      corps.innerHTML = `<label class="fk-champ"><span>Catégories (une par ligne, au moins deux)</span><textarea data-cats style="min-height:70px" placeholder="Fruit&#10;Légume">${e(cats.join('\n'))}</textarea></label>
        <span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Éléments à classer</span>
        ${elementsClassement.map((el, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input class="fk-input" type="text" data-el="${i}" value="${e(el.texte)}" placeholder="Élément ${i + 1}" maxlength="200">
          <select class="fk-input" data-elcat="${i}" style="max-width:40%"><option value="">— Catégorie —</option>${cats.map(c => `<option ${c === el.categorie ? 'selected' : ''}>${e(c)}</option>`).join('')}</select>
          <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-suppr-el="${i}" aria-label="Retirer">✕</button></div>`).join('')}
        <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-ajout-el>＋ Ajouter un élément</button>`;
      corps.querySelector('[data-cats]').addEventListener('change', ev => { cfg.categories = lignes(ev.target.value); dessiner(); });
      corps.querySelectorAll('[data-el]').forEach(inp => inp.addEventListener('input', () => { elementsClassement[Number(inp.dataset.el)].texte = inp.value; }));
      corps.querySelectorAll('[data-elcat]').forEach(sel => sel.addEventListener('change', () => { elementsClassement[Number(sel.dataset.elcat)].categorie = sel.value; }));
      corps.querySelectorAll('[data-suppr-el]').forEach(b => b.addEventListener('click', () => { elementsClassement.splice(Number(b.dataset.supprEl), 1); dessiner(); }));
      corps.querySelector('[data-ajout-el]').addEventListener('click', () => { if (elementsClassement.length < 20) { elementsClassement.push({ texte: '', categorie: '' }); dessiner(); } });
    } else if (t === 'intrus_lexical') {
      const txt = (cfg.series || []).map(s => (s.mots || []).map((m, i) => (i === Number(s.intrus) ? '*' : '') + m).join(', ')).join('\n');
      corps.innerHTML = `<label class="fk-champ"><span>Séries de mots (une série par ligne, mots séparés par une virgule, intrus précédé de *)</span>
        <textarea data-c="series" style="min-height:100px" placeholder="chat, chien, *table, lapin&#10;rouge, *vite, bleu, vert">${e(txt)}</textarea></label>`;
    } else if (t === 'selection_mots') {
      const mots = fkMots(form.enonce.value);
      corps.innerHTML = mots.length ? `<span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Cliquez sur les bons mots</span>
        <div class="fk-mots">${mots.map((m, i) => `<button type="button" class="fk-mot ${corrects.has(String(i)) ? 'choisi' : ''}" data-mot="${i}" aria-pressed="${corrects.has(String(i))}">${e(m)}</button>`).join('')}</div>`
        : '<p class="fk-alerte fk-alerte-info">Écrivez d\'abord le texte dans l\'énoncé.</p>';
      corps.querySelectorAll('[data-mot]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.mot; corrects.has(k) ? corrects.delete(k) : corrects.add(k);
        b.classList.toggle('choisi'); b.setAttribute('aria-pressed', String(corrects.has(k)));
      }));
    }
  }

  form.type.addEventListener('change', () => {
    if (type() === 'vrai_faux') reponses = [{ texte: 'Vrai', ok: true }, { texte: 'Faux', ok: false }];
    else if (type() === 'choix_unique') { let vu = false; reponses.forEach(r => { if (r.ok && !vu) vu = true; else r.ok = false; }); }
    dessiner();
  });
  let minuteur = null;
  form.enonce.addEventListener('input', () => {
    if (!['texte_a_trous', 'texte_a_trous_glisser', 'selection_mots'].includes(type())) return;
    if (type() === 'selection_mots') corrects = new Set();
    clearTimeout(minuteur); minuteur = setTimeout(dessiner, 400);
  });
  md.boite.querySelector('[data-annuler]').addEventListener('click', () => { md.fermer(); modaleQuestions(q); });
  dessiner();

  function lireConfig() {
    const t = type();
    const champ = k => corps.querySelector(`[data-c="${k}"]`)?.value ?? '';
    if (t === 'reponse_courte') { const a = lignes(champ('acceptees')); return a.length ? { acceptees: a } : 'Indiquez au moins une réponse acceptée.'; }
    if (t === 'reponse_numerique') {
      const v = parseFloat(String(champ('valeur')).replace(',', '.'));
      if (!Number.isFinite(v)) return 'Indiquez la réponse exacte (un nombre).';
      return { valeur: v, tolerance: Math.abs(parseFloat(String(champ('tolerance')).replace(',', '.')) || 0), unite: champ('unite').trim() };
    }
    if (t === 'texte_a_trous') {
      const n = fkNbTrous(form.enonce.value);
      const trous = Array.from({ length: n }, (_, i) => (corps.querySelector(`[data-trou="${i}"]`)?.value || '').split('|').map(v => v.trim()).filter(Boolean));
      if (!n) return 'Ajoutez au moins un ___ dans l\'énoncé.';
      if (trous.some(tr => !tr.length)) return 'Indiquez une réponse pour chaque trou.';
      return { trous };
    }
    if (t === 'texte_a_trous_glisser') {
      const n = fkNbTrous(form.enonce.value);
      const trous = Array.from({ length: n }, (_, i) => (corps.querySelector(`[data-trou="${i}"]`)?.value || '').trim());
      if (!n) return 'Ajoutez au moins un ___ dans l\'énoncé.';
      if (trous.some(tr => !tr)) return 'Indiquez le bon mot pour chaque trou.';
      return { trous, banque: champ('banque').split(',').map(v => v.trim()).filter(Boolean) };
    }
    if (t === 'remise_en_ordre') { const el = lignes(champ('elements')); return el.length >= 2 ? { elements: el } : 'Au moins deux éléments à ordonner.'; }
    if (t === 'association') {
      const p = paires.map(x2 => ({ gauche: x2.gauche.trim(), droite: x2.droite.trim() })).filter(x2 => x2.gauche && x2.droite);
      return p.length >= 2 ? { paires: p } : 'Au moins deux paires complètes.';
    }
    if (t === 'classement') {
      const cats = lignes(corps.querySelector('[data-cats]').value);
      const els = elementsClassement.map(x2 => ({ texte: x2.texte.trim(), categorie: x2.categorie })).filter(x2 => x2.texte);
      if (cats.length < 2) return 'Au moins deux catégories.';
      if (els.length < 2) return 'Au moins deux éléments à classer.';
      if (els.some(x2 => !cats.includes(x2.categorie))) return 'Choisissez une catégorie pour chaque élément.';
      if (new Set(els.map(x2 => x2.texte.toLowerCase())).size !== els.length) return 'Chaque élément à classer doit être différent.';
      return { categories: cats, elements: els };
    }
    if (t === 'intrus_lexical') {
      const series = lignes(champ('series')).map(l => {
        const mots = l.split(',').map(v => v.trim()).filter(Boolean);
        const intrus = mots.findIndex(m => m.startsWith('*'));
        return { mots: mots.map(m => m.replace(/^\*/, '').trim()), intrus };
      });
      if (!series.length) return 'Ajoutez au moins une série.';
      if (series.some(s => s.mots.length < 3 || s.intrus < 0)) return 'Chaque série : au moins 3 mots, dont un intrus marqué par *.';
      return { series };
    }
    if (t === 'selection_mots') {
      const max = fkMots(form.enonce.value).length;
      const c = [...corrects].filter(i => Number(i) < max).sort((a, b) => a - b);
      return c.length ? { corrects: c } : 'Cliquez sur au moins un mot correct.';
    }
    return {};
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const t = type();
    let propres = [];
    let config = {};
    if (FK_TYPES_CHOIX.includes(t)) {
      propres = reponses.map(r => ({ ...r, texte: r.texte.trim() })).filter(r => r.texte);
      if (propres.length < 2) { fkToast('Au moins deux réponses.', 'erreur'); return; }
      if (!propres.some(r => r.ok)) { fkToast('Cochez au moins une bonne réponse.', 'erreur'); return; }
    } else {
      config = lireConfig();
      if (typeof config === 'string') { fkToast(config, 'erreur'); return; }
    }
    const donnees = { enonce: form.enonce.value.trim(), type: t, points: Math.max(1, parseInt(form.points.value, 10) || 1), explication: form.explication.value.trim() || null, config };
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
    if (propres.length) {
      const { error: e3 } = await supabaseClient.from('formation_reponses').insert(propres.map((r, i) => ({ question_id: qid, texte: r.texte, est_correcte: r.ok, position: i + 1 })));
      if (e3) { fkToast(fkMessageErreur(e3), 'erreur'); return; }
    }
    md.fermer();
    await recharger();
    modaleQuestions(q);
  });
}

// ---------------------------------------------------------------- Tests en leçon
// 25 septembre 2026 : tests rapides / réflexions / questionnaires
// d'auto-évaluation insérés au cœur d'une leçon (voir fkEditeurRiche,
// bouton 🧭). Enregistrés dans formation_activites_lecon ; réponses des
// étudiants visibles ici par le formateur, sans note.
const FK_ECHELLES = {
  accord: [['Pas du tout d\'accord', 1], ['Plutôt pas d\'accord', 2], ['Ni l\'un ni l\'autre', 3], ['Plutôt d\'accord', 4], ['Tout à fait d\'accord', 5]],
  frequence: [['Jamais', 1], ['Rarement', 2], ['Parfois', 3], ['Souvent', 4], ['Toujours', 5]],
  ouinon: [['Non', 0], ['Oui', 1]],
  intensite: [['Pas du tout', 0], ['Un peu', 1], ['Moyennement', 2], ['Beaucoup', 3]]
};

// « Coller un exercice » (26 septembre 2026) : transforme un exercice écrit
// pour le papier en fiche interactive. Reconnaît le titre « Exercice — … »,
// la consigne, les questions « 1. » / « 2) », les cases ☐ □ [ ] (dont
// « Autre : … ») et les lignes pointillées à compléter (leur nombre donne la
// hauteur de la zone de réponse).
function fkAnalyserExercice(texte) {
  const CASE = /[☐□▢❏❑◻⬜☑✓]|\[\s?\]/;
  const CASES = /[☐□▢❏❑◻⬜☑]|\[\s?\]/g;
  const pointilles = l => /^[\s.…_·\-–]+$/.test(l) && /([.…_·]\s*){4,}/.test(l);
  const lignes = String(texte || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n');
  let titre = '';
  const consigne = [];
  const champs = [];
  let cur = null;
  for (const brut of lignes) {
    const l = brut.trim();
    if (!l) continue;
    const q = /^(\d{1,2})\s*[.)°]\s*(.*)$/.exec(l);
    if (q) { cur = { libelle: q[2].trim(), options: [], autre: false, vides: 0 }; champs.push(cur); continue; }
    if (pointilles(l)) { if (cur) cur.vides++; continue; }
    if (CASE.test(l)) {
      if (!cur) { cur = { libelle: '', options: [], autre: false, vides: 0 }; champs.push(cur); }
      const morceaux = l.split(CASES);
      const avant = morceaux.shift().trim();
      if (avant) cur.libelle += (cur.libelle ? '\n' : '') + avant;
      morceaux.forEach(m => {
        const t = m.replace(/[\s.…_·]+$/, '').replace(/\s*:$/, '').trim();
        if (!t) return;
        if (/^autres?\b/i.test(t)) cur.autre = true; else cur.options.push(t);
      });
      continue;
    }
    if (cur) cur.libelle += (cur.libelle ? '\n' : '') + l.replace(/\s*[.…_]{4,}\s*$/, m => { cur.vides++; return ''; });
    else if (!titre && !consigne.length && /^(exercice|activité|fiche|atelier|test)\b/i.test(l)) titre = l.replace(/^exercice\s*\d*\s*[—–:-]\s*/i, '').trim() || l;
    else consigne.push(l);
  }
  return {
    titre: titre.slice(0, 120),
    consigne: consigne.join('\n').slice(0, 1000),
    champs: champs.slice(0, 30).map(c => {
      const base = { libelle: c.libelle.trim().slice(0, 500) || 'Question', obligatoire: true };
      if (c.options.length || c.autre) return { ...base, type: 'cases', options: c.options.slice(0, 15), autre: c.autre };
      if (c.vides === 1) return { ...base, type: 'texte' };
      return { ...base, type: 'paragraphe', lignes: Math.min(10, Math.max(3, c.vides + 1)) };
    })
  };
}

function modaleActivite(leconId, a) {
  return new Promise(resolve => {
    const e = fkEchapper;
    const c = JSON.parse(JSON.stringify(a?.config || {}));
    let choix = (c.choix || []).length ? c.choix : [{ texte: '', correcte: true }, { texte: '', correcte: false }];
    const echelleTexte = (c.echelle || FK_ECHELLES.accord.map(([t, p]) => ({ texte: t, points: p }))).map(x => `${x.texte} = ${x.points}`).join('\n');
    const itemsTexte = (c.items || []).map(i => (i.inverse ? '(-) ' : '') + i.texte).join('\n');
    const interpTexte = (c.interpretations || []).map(t => `${t.min}-${t.max} : ${t.message}`).join('\n');
    // Fiche d'exercice : liste des questions (modifiée sur place).
    let champs = (c.champs || []).length ? c.champs : [{ type: 'texte', libelle: '', obligatoire: true }];
    const md = fkModale(a ? 'Modifier le test' : 'Insérer un test dans la leçon', `
      <form>
        <label class="fk-champ"><span>Genre de test</span><select name="nature">
          <option value="controle" ${a?.nature === 'controle' || !a ? 'selected' : ''}>🧭 Point de contrôle — une question avec une bonne réponse, corrigée tout de suite</option>
          <option value="reflexion" ${a?.nature === 'reflexion' ? 'selected' : ''}>💭 Réflexion — question ouverte, puis votre commentaire s'affiche</option>
          <option value="questionnaire" ${a?.nature === 'questionnaire' ? 'selected' : ''}>📋 Questionnaire d'auto-évaluation — plusieurs affirmations notées sur une échelle</option>
          <option value="fiche" ${a?.nature === 'fiche' ? 'selected' : ''}>📝 Fiche d'exercice — plusieurs questions : lignes à compléter, cases à cocher… (non notée)</option>
        </select></label>
        <label class="fk-champ"><span>Titre (facultatif)</span><input type="text" name="titre" maxlength="120" value="${e(a?.titre || '')}" placeholder="Ex. Faisons le point"></label>
        <label class="fk-case"><input type="checkbox" name="bloquant" ${a ? (a.bloquant ? 'checked' : '') : 'checked'}> 🔒 Bloquant : la suite de la leçon reste cachée tant que l'étudiant n'a pas répondu</label>
        <div data-corps></div>
        <div class="fk-actions-form">
          ${a ? '<button type="button" class="fk-btn fk-btn-danger" data-suppr style="margin-right:auto">🗑️ Supprimer ce test</button>' : ''}
          <button type="button" class="fk-btn fk-btn-ghost" data-annuler>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
      </form>`, { protegee: true });
    md.boite.style.width = 'min(820px, 100%)';
    const form = md.boite.querySelector('form');
    const corps = md.boite.querySelector('[data-corps]');
    const fin = v => { md.fermer(); resolve(v); };
    md.boite.querySelector('[data-annuler]').addEventListener('click', () => fin(null));
    md.boite.querySelector('[data-suppr]')?.addEventListener('click', async () => {
      if (!await fkConfirmer('Supprimer ce test et les réponses déjà données ?', 'Supprimer')) return;
      const { error } = await supabaseClient.from('formation_activites_lecon').delete().eq('id', a.id);
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      FKE.activites = FKE.activites.filter(x => x.id !== a.id);
      fin('supprime');
    });

    function dessiner() {
      const n = form.nature.value;
      if (n === 'controle') {
        const t = corps.querySelector('[name=type]')?.value || a?.type || 'choix_unique';
        corps.innerHTML = `
          <label class="fk-champ"><span>Type de question</span><select name="type">
            ${['choix_unique', 'choix_multiple', 'vrai_faux', 'reponse_courte', 'reponse_numerique'].map(k => `<option value="${k}" ${k === t ? 'selected' : ''}>${FK_TYPES_QUESTIONS[k].icone} ${FK_TYPES_QUESTIONS[k].label}</option>`).join('')}</select></label>
          <label class="fk-champ"><span>Question *</span><textarea name="enonce" required maxlength="1000" style="min-height:70px">${e(form.dataset.enonce ?? a?.enonce ?? '')}</textarea></label>
          <div data-reponses></div>
          <label class="fk-champ"><span>Explication (affichée après la réponse)</span><textarea name="explication" maxlength="1500" style="min-height:70px">${e(a?.explication || '')}</textarea></label>`;
        corps.querySelector('[name=type]').addEventListener('change', () => { if (corps.querySelector('[name=type]').value === 'vrai_faux') choix = [{ texte: 'Vrai', correcte: true }, { texte: 'Faux', correcte: false }]; dessinerReponses(); });
        dessinerReponses();
      } else if (n === 'reflexion') {
        corps.innerHTML = `
          <label class="fk-champ"><span>Question posée à l'étudiant *</span><textarea name="enonce" required maxlength="1000" style="min-height:70px" placeholder="Ex. Qu'est-ce qui vous empêche le plus souvent de commencer une tâche ?">${e(a?.enonce || '')}</textarea></label>
          <label class="fk-champ"><span>Votre commentaire, affiché après sa réponse</span><textarea name="explication" maxlength="2000" style="min-height:90px" placeholder="Ex. Beaucoup de personnes répondent…">${e(a?.explication || '')}</textarea></label>`;
      } else if (n === 'fiche') {
        corps.innerHTML = `
          <div class="fk-alerte fk-alerte-info" style="font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span style="flex:1;min-width:220px">📋 L'exercice est déjà écrit (Word, PDF…) ? Collez-le : les questions numérotées, les cases ☐ et les lignes pointillées sont reconnues.</span>
            <button type="button" class="fk-btn fk-btn-outline fk-btn-petit" data-coller-fiche>📋 Coller un exercice</button></div>
          <label class="fk-champ"><span>Consigne</span><textarea name="enonce" maxlength="1000" style="min-height:60px" placeholder="Ex. Choisissez une tâche importante que vous repoussez actuellement. Répondez avec sincérité.">${e(form.dataset.enonce ?? a?.enonce ?? '')}</textarea></label>
          <div data-champs></div>
          <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-plus-champ style="margin-bottom:14px">＋ Ajouter une question</button>
          <label class="fk-champ"><span>Votre commentaire, affiché après l'envoi (facultatif)</span><textarea name="explication" maxlength="2000" style="min-height:70px" placeholder="Ex. Relisez votre réponse à la question 5 : c'est votre premier pas.">${e(a?.explication || '')}</textarea></label>`;
        dessinerChamps();
        corps.querySelector('[data-plus-champ]').addEventListener('click', () => {
          if (champs.length >= 30) { fkToast('30 questions au maximum.', 'erreur'); return; }
          champs.push({ type: 'texte', libelle: '', obligatoire: true }); dessinerChamps();
          corps.querySelector(`[data-i="${champs.length - 1}"] [data-k="libelle"]`)?.focus();
        });
        corps.querySelector('[data-coller-fiche]').addEventListener('click', collerExercice);
      } else {
        corps.innerHTML = `
          <label class="fk-champ"><span>Consigne *</span><textarea name="enonce" required maxlength="1000" style="min-height:60px" placeholder="Ex. Pour chaque affirmation, indiquez à quel point elle vous correspond.">${e(a?.enonce || '')}</textarea></label>
          <label class="fk-champ"><span>Affirmations (une par ligne ; « (-) » devant une affirmation dont les points sont inversés)</span>
            <textarea name="items" style="min-height:110px" placeholder="Je remets souvent à plus tard ce qui me paraît difficile.&#10;(-) Je commence mes tâches dès que possible.">${e(itemsTexte)}</textarea></label>
          <div class="fk-grille-2">
            <label class="fk-champ"><span>Échelle de réponse</span><select name="preset">
              <option value="">— Choisir un modèle —</option><option value="accord">Accord (1 à 5)</option><option value="frequence">Fréquence (Jamais → Toujours)</option>
              <option value="intensite">Intensité (0 à 3)</option><option value="ouinon">Oui / Non</option></select>
              <small>Ou modifiez directement ci-dessous : « libellé = points ».</small></label>
            <label class="fk-champ"><span>Libellés et points</span><textarea name="echelle" style="min-height:110px">${e(echelleTexte)}</textarea></label>
          </div>
          <label class="fk-champ"><span>Interprétation du score total (une tranche par ligne : « min-max : message »)</span>
            <textarea name="interpretations" style="min-height:90px" placeholder="0-10 : Vous gérez bien votre temps.&#10;11-20 : Quelques habitudes à surveiller.&#10;21-40 : La procrastination vous freine : les leçons suivantes vont vous aider.">${e(interpTexte)}</textarea></label>
          <label class="fk-champ"><span>Commentaire général affiché après le questionnaire (facultatif)</span><textarea name="explication" maxlength="2000" style="min-height:70px">${e(a?.explication || '')}</textarea></label>`;
        corps.querySelector('[name=preset]').addEventListener('change', ev => {
          const p = FK_ECHELLES[ev.target.value]; if (!p) return;
          corps.querySelector('[name=echelle]').value = p.map(([t, pts]) => `${t} = ${pts}`).join('\n');
        });
      }
    }
    function dessinerChamps() {
      const z = corps.querySelector('[data-champs]');
      const types = [['texte', '✏️ Réponse courte (une ligne)'], ['paragraphe', '📝 Réponse sur plusieurs lignes'], ['cases', '☑️ Cases à cocher (plusieurs choix)'], ['choix', '🔘 Choix unique']];
      z.innerHTML = champs.map((ch, i) => `<div class="fk-fiche-edit" data-i="${i}">
          <div class="fk-fiche-edit-tete"><b>Question ${i + 1}</b>
            <select class="fk-input" data-k="type" aria-label="Type de réponse">${types.map(([v, l]) => `<option value="${v}" ${ch.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="fk-fiche-edit-outils">
              <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-bouger="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
              <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-bouger="1" ${i === champs.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
              <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-retirer-champ aria-label="Retirer la question">✕</button></span></div>
          <textarea class="fk-input" data-k="libelle" rows="2" maxlength="500" placeholder="Ex. Ma tâche :">${e(ch.libelle || '')}</textarea>
          ${ch.type === 'paragraphe' ? `<label class="fk-case" style="margin-top:8px;align-items:center">Nombre de lignes pour répondre <input class="fk-input" type="number" data-k="lignes" min="2" max="10" value="${Number(ch.lignes) || 3}" style="width:80px"></label>` : ''}
          ${['cases', 'choix'].includes(ch.type) ? `<label class="fk-champ" style="margin:8px 0 6px"><span>Choix proposés (un par ligne)</span><textarea class="fk-input" data-k="options" rows="4" placeholder="Elle me paraît trop difficile&#10;Je ne sais pas par où commencer">${e((ch.options || []).join('\n'))}</textarea></label>
            <label class="fk-case"><input type="checkbox" data-k="autre" ${ch.autre ? 'checked' : ''}> Ajouter « Autre : … » avec une zone à compléter</label>` : ''}
          <label class="fk-case" style="margin:6px 0 0"><input type="checkbox" data-k="obligatoire" ${ch.obligatoire !== false ? 'checked' : ''}> Réponse obligatoire</label>
        </div>`).join('');
      z.querySelectorAll('.fk-fiche-edit').forEach(bloc => {
        const i = Number(bloc.dataset.i);
        bloc.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input', () => {
          const k = inp.dataset.k;
          if (k === 'options') champs[i].options = inp.value.split('\n');
          else if (inp.type === 'checkbox') champs[i][k] = inp.checked;
          else champs[i][k] = inp.value;
          if (k === 'type') dessinerChamps();
        }));
        bloc.querySelectorAll('[data-bouger]').forEach(b => b.addEventListener('click', () => {
          const j = i + Number(b.dataset.bouger);
          [champs[i], champs[j]] = [champs[j], champs[i]]; dessinerChamps();
        }));
        bloc.querySelector('[data-retirer-champ]').addEventListener('click', () => {
          if (champs.length <= 1) { fkToast('Une fiche contient au moins une question.', 'erreur'); return; }
          champs.splice(i, 1); dessinerChamps();
        });
      });
    }
    function collerExercice() {
      const m = fkModale('Coller un exercice', `
        <p style="margin-top:0;font-size:14px;color:var(--f-muted)">Collez tout l'exercice (depuis Word, un PDF, un courriel…). Sont reconnus : le titre « Exercice — … », la consigne, les questions numérotées « 1. », les cases ☐ (et « Autre : … ») et les lignes pointillées « ……… » à compléter. Vous pourrez tout retoucher ensuite.</p>
        <textarea class="fk-input" data-txt style="min-height:260px;font-size:13px" placeholder="Exercice — Mon profil de procrastination&#10;&#10;Choisissez une tâche importante que vous repoussez actuellement.&#10;&#10;1. Ma tâche :&#10;……………………………………&#10;&#10;2. Je la repousse principalement parce que :&#10;☐ Elle me paraît trop difficile   ☐ J'ai peur d'échouer   ☐ Autre : ………"></textarea>
        <p data-bilan style="font-size:14px;font-weight:700;color:var(--f-primary-dark);min-height:20px"></p>
        <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button type="button" class="fk-btn fk-btn-primary" data-ok>Utiliser cet exercice</button></div>`, { protegee: true });
      m.boite.style.width = 'min(760px, 100%)';
      const txt = m.boite.querySelector('[data-txt]');
      const bilan = m.boite.querySelector('[data-bilan]');
      txt.addEventListener('input', () => {
        const r = fkAnalyserExercice(txt.value);
        bilan.textContent = r.champs.length ? `✔ ${r.champs.length} question(s) reconnue(s) : ${r.champs.map((c, i) => `${i + 1}. ${c.type === 'texte' ? 'une ligne' : c.type === 'paragraphe' ? `${c.lignes} lignes` : `${(c.options || []).length} case(s)${c.autre ? ' + Autre' : ''}`}`).join(' · ')}` : 'Aucune question numérotée trouvée pour le moment.';
      });
      m.boite.querySelector('[data-ok]').addEventListener('click', async () => {
        const r = fkAnalyserExercice(txt.value);
        if (!r.champs.length) { fkToast('Aucune question numérotée (« 1. … ») n\'a été trouvée.', 'erreur'); return; }
        const dejaRempli = champs.some(ch => (ch.libelle || '').trim());
        if (dejaRempli && !await fkConfirmer('Remplacer les questions déjà saisies par celles de l\'exercice collé ?', 'Remplacer')) return;
        champs = r.champs;
        if (r.titre && !form.titre.value.trim()) form.titre.value = r.titre;
        if (r.consigne) corps.querySelector('[name=enonce]').value = r.consigne;
        m.fermer();
        dessinerChamps();
        fkToast(`${r.champs.length} question(s) ajoutée(s). Vérifiez-les puis enregistrez.`, 'succes');
      });
    }
    function dessinerReponses() {
      const zone = corps.querySelector('[data-reponses]');
      const t = corps.querySelector('[name=type]').value;
      if (['choix_unique', 'choix_multiple', 'vrai_faux'].includes(t)) {
        const unique = t !== 'choix_multiple';
        zone.innerHTML = `<span style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">Réponses (cochez la ou les bonnes)</span>
          ${choix.map((r, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <input type="${unique ? 'radio' : 'checkbox'}" name="bonne" ${r.correcte ? 'checked' : ''} data-i="${i}" aria-label="Bonne réponse">
            <input class="fk-input" type="text" value="${e(r.texte)}" data-t="${i}" maxlength="300" placeholder="Réponse ${i + 1}" ${t === 'vrai_faux' ? 'readonly' : ''}>
            ${t === 'vrai_faux' ? '' : `<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-x="${i}" aria-label="Retirer">✕</button>`}</div>`).join('')}
          ${t === 'vrai_faux' ? '' : '<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-plus>＋ Ajouter une réponse</button>'}`;
        zone.querySelectorAll('[data-t]').forEach(inp => inp.addEventListener('input', () => { choix[Number(inp.dataset.t)].texte = inp.value; }));
        zone.querySelectorAll('[name=bonne]').forEach(inp => inp.addEventListener('change', () => {
          if (unique) choix.forEach((r, i) => { r.correcte = i === Number(inp.dataset.i); }); else choix[Number(inp.dataset.i)].correcte = inp.checked;
        }));
        zone.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { choix.splice(Number(b.dataset.x), 1); dessinerReponses(); }));
        zone.querySelector('[data-plus]')?.addEventListener('click', () => { if (choix.length < 8) { choix.push({ texte: '', correcte: false }); dessinerReponses(); } });
      } else if (t === 'reponse_courte') {
        zone.innerHTML = `<label class="fk-champ"><span>Réponses acceptées (une par ligne)</span><textarea data-acc style="min-height:70px">${e((c.acceptees || []).join('\n'))}</textarea></label>`;
      } else {
        zone.innerHTML = `<div class="fk-grille-3"><label class="fk-champ"><span>Réponse exacte *</span><input type="number" step="any" data-val value="${e(c.valeur ?? '')}"></label>
          <label class="fk-champ"><span>Tolérance (±)</span><input type="number" step="any" min="0" data-tol value="${e(c.tolerance ?? 0)}"></label>
          <label class="fk-champ"><span>Unité</span><input type="text" data-unite maxlength="20" value="${e(c.unite || '')}"></label></div>`;
      }
    }
    form.nature.addEventListener('change', () => { form.dataset.enonce = corps.querySelector('[name=enonce]')?.value || ''; dessiner(); });
    dessiner();

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const n = form.nature.value;
      let enonce = corps.querySelector('[name=enonce]').value.trim();
      if (!enonce && n === 'fiche') enonce = 'Complétez cet exercice.';
      if (!enonce) { fkToast('Écrivez la question ou la consigne.', 'erreur'); return; }
      let type = n, config = {};
      const lignes = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);
      if (n === 'controle') {
        type = corps.querySelector('[name=type]').value;
        if (['choix_unique', 'choix_multiple', 'vrai_faux'].includes(type)) {
          const propres = choix.map(r => ({ texte: r.texte.trim(), correcte: !!r.correcte })).filter(r => r.texte);
          if (propres.length < 2 || !propres.some(r => r.correcte)) { fkToast('Au moins deux réponses, dont une bonne.', 'erreur'); return; }
          config = { choix: propres };
        } else if (type === 'reponse_courte') {
          const acc = lignes(corps.querySelector('[data-acc]').value);
          if (!acc.length) { fkToast('Indiquez au moins une réponse acceptée.', 'erreur'); return; }
          config = { acceptees: acc };
        } else {
          const v = parseFloat(String(corps.querySelector('[data-val]').value).replace(',', '.'));
          if (!Number.isFinite(v)) { fkToast('Indiquez la réponse exacte.', 'erreur'); return; }
          config = { valeur: v, tolerance: Math.abs(parseFloat(String(corps.querySelector('[data-tol]').value).replace(',', '.')) || 0), unite: corps.querySelector('[data-unite]').value.trim() };
        }
      } else if (n === 'questionnaire') {
        const items = lignes(corps.querySelector('[name=items]').value).map(x => ({ texte: x.replace(/^\(-\)\s*/, ''), inverse: /^\(-\)/.test(x) }));
        const echelle = lignes(corps.querySelector('[name=echelle]').value).map(x => { const i = x.lastIndexOf('='); return { texte: (i > 0 ? x.slice(0, i) : x).trim(), points: i > 0 ? Number(x.slice(i + 1).replace(',', '.')) : NaN }; });
        if (!items.length) { fkToast('Ajoutez au moins une affirmation.', 'erreur'); return; }
        if (echelle.length < 2 || echelle.some(x => !x.texte || !Number.isFinite(x.points))) { fkToast('Échelle : au moins deux lignes « libellé = points ».', 'erreur'); return; }
        const interpretations = [];
        for (const x of lignes(corps.querySelector('[name=interpretations]').value)) {
          const m = x.match(/^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*:\s*(.+)$/);
          if (!m) { fkToast(`Interprétation mal écrite : « ${x} » (attendu : min-max : message).`, 'erreur'); return; }
          interpretations.push({ min: Number(m[1].replace(',', '.')), max: Number(m[2].replace(',', '.')), message: m[3].trim() });
        }
        config = { items, echelle, interpretations };
      } else if (n === 'fiche') {
        type = 'fiche';
        const propres = champs.map(ch => ({
          type: ch.type, libelle: String(ch.libelle || '').trim(), obligatoire: ch.obligatoire !== false,
          ...(ch.type === 'paragraphe' ? { lignes: Math.min(10, Math.max(2, Number(ch.lignes) || 3)) } : {}),
          ...(['cases', 'choix'].includes(ch.type) ? { options: (ch.options || []).map(o => String(o).trim()).filter(Boolean).slice(0, 15), autre: !!ch.autre } : {})
        }));
        const sansTitre = propres.findIndex(ch => !ch.libelle);
        if (sansTitre >= 0) { fkToast(`Écrivez l'intitulé de la question ${sansTitre + 1}.`, 'erreur'); return; }
        const sansChoix = propres.findIndex(ch => ['cases', 'choix'].includes(ch.type) && ch.options.length + (ch.autre ? 1 : 0) < 2);
        if (sansChoix >= 0) { fkToast(`Question ${sansChoix + 1} : proposez au moins deux choix.`, 'erreur'); return; }
        config = { champs: propres };
      }
      const donnees = { lecon_id: leconId, nature: n, type, titre: form.titre.value.trim() || null, enonce, config,
        explication: corps.querySelector('[name=explication]').value.trim() || null, bloquant: form.bloquant.checked };
      const res = a ? await supabaseClient.from('formation_activites_lecon').update(donnees).eq('id', a.id).select().single()
        : await supabaseClient.from('formation_activites_lecon').insert(donnees).select().single();
      if (res.error) { fkToast(fkMessageErreur(res.error), 'erreur'); return; }
      FKE.activites = [...FKE.activites.filter(x => x.id !== res.data.id), res.data];
      fin(res.data);
    });
  });
}

// Onglet « Tests en leçon » : réponses des étudiants (sans note).
async function ongletActivites() {
  const zone = document.getElementById('zoneOnglet');
  zone.innerHTML = '<div class="fk-chargement">Chargement…</div>';
  const { data, error } = await supabaseClient.rpc('reponses_activites_formation', { p_formation_id: FKE.f.id });
  if (error) { zone.innerHTML = `<p class="fk-alerte fk-alerte-erreur">${fkEchapper(fkMessageErreur(error))}</p>`; return; }
  const parActivite = new Map();
  (data || []).forEach(r => { if (!parActivite.has(r.activite_id)) parActivite.set(r.activite_id, { ...r, reponses: [] }); if (r.apprenant) parActivite.get(r.activite_id).reponses.push(r); });
  const e = fkEchapper;
  const lire = (a, r) => {
    const act = FKE.activites.find(x => x.id === a.activite_id);
    if (a.nature === 'reflexion') return `<span style="white-space:pre-wrap">${e(r.reponse)}</span>`;
    if (a.nature === 'fiche') {
      const ch = act?.config?.champs || [];
      return `<ol class="fk-fiche-reponses">${(Array.isArray(r.reponse) ? r.reponse : []).map((x, i) => {
        const c = ch[i] || {};
        const t = typeof x === 'string' ? x : [...(x?.choix || []).map(j => (c.options || [])[j]).filter(Boolean), ...(x?.autre ? [`Autre : ${x.autre}`] : [])].join(' · ');
        return `<li><b>${e(c.libelle || `Question ${i + 1}`)}</b><br><span style="white-space:pre-wrap">${t ? e(t) : '<i style="color:var(--f-muted)">sans réponse</i>'}</span></li>`;
      }).join('')}</ol>`;
    }
    if (a.nature === 'questionnaire') return `Score <b>${e(r.resultat?.score)}</b> / ${e(r.resultat?.score_max)}${r.resultat?.interpretation ? ` — ${e(r.resultat.interpretation)}` : ''}`;
    const txt = Array.isArray(r.reponse) && act?.config?.choix ? r.reponse.map(i => act.config.choix[i]?.texte).filter(Boolean).join(', ') : r.reponse;
    return `${r.resultat?.juste ? '✅' : '❌'} ${e(txt)}`;
  };
  zone.innerHTML = parActivite.size ? [...parActivite.values()].map(a => `
    <section class="fk-carte">
      <h3>${{ controle: '🧭', reflexion: '💭', questionnaire: '📋', fiche: '📝' }[a.nature]} ${e(a.titre || a.enonce)}</h3>
      <p style="color:var(--f-muted);font-size:13px;margin:-4px 0 10px">Leçon « ${e(a.lecon_titre)} » · ${a.reponses.length} réponse${a.reponses.length > 1 ? 's' : ''}${a.nature === 'controle' && a.reponses.length ? ` · ${Math.round(a.reponses.filter(r => r.resultat?.juste).length * 100 / a.reponses.length)} % de bonnes réponses` : ''}</p>
      ${a.reponses.length ? `<div class="fk-table-wrap"><table class="fk-table"><thead><tr><th>Étudiant</th><th>Réponse</th><th>Essais</th><th>Date</th></tr></thead><tbody>
        ${a.reponses.map(r => `<tr><td>${e(r.apprenant)}</td><td>${lire(a, r)}</td><td>${r.nb_essais}</td><td>${fkDate(r.maj_le)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="fk-vide" style="padding:8px">Pas encore de réponse.</p>'}
    </section>`).join('') : '<div class="fk-carte fk-vide"><span class="fk-vide-icone">🧭</span>Aucun test dans vos leçons pour le moment.<br>Dans l\'éditeur d\'une leçon, utilisez le bouton « 🧭 Test / questionnaire » pour en insérer un à l\'endroit voulu.</div>';
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
