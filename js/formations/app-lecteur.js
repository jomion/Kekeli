// Espace apprenant — lecteur de formation
// (pages/formations/app/formation.html?id=...&lecon=...|&quiz=...).
// Le contenu n'est lisible que si le serveur confirme l'inscription (RLS) ;
// les quiz passent par commencer_quiz / soumettre_quiz (correction serveur).

const FKL = { s: null, f: null, inscription: null, modules: [], lecons: [], quiz: [], ressources: [], faites: new Set(), reussis: new Set(), items: [], apercu: false, chrono: null };

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  FKL.s = s;
  await fkInitPage('apprentissage');
  const id = Number(fkParam('id')) || 0;
  const main = document.getElementById('fkContenu');

  const { data: f } = await supabaseClient.from('formations').select('id, slug, titre, formateur_id, statut').eq('id', id).maybeSingle();
  const { data: ins } = await supabaseClient.from('formation_inscriptions').select('*').eq('formation_id', id).eq('apprenant_id', s.profil.id).maybeSingle();
  const estProprio = f && (f.formateur_id === s.profil.id || s.estGestionnaire);
  if (!f || (!(ins && ins.statut !== 'annulee') && !estProprio)) {
    window.location.href = f ? `${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}` : `${FK_BASE}app/tableau-de-bord.html`;
    return;
  }
  FKL.f = f;
  FKL.inscription = ins;
  FKL.apercu = !ins;

  const [mods, lecs, qz, res, prog, tent, cal] = await Promise.all([
    supabaseClient.from('formation_modules').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_lecons').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_quiz').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_ressources').select('*').eq('formation_id', id).order('id'),
    supabaseClient.from('formation_progression_lecons').select('lecon_id, terminee').eq('formation_id', id).eq('apprenant_id', s.profil.id),
    supabaseClient.from('formation_tentatives_quiz').select('quiz_id, reussi').eq('formation_id', id).eq('apprenant_id', s.profil.id).eq('reussi', true),
    supabaseClient.rpc('calendrier_formation', { p_formation_id: id })
  ]);
  FKL.modules = mods.data || [];
  FKL.lecons = lecs.data || [];
  FKL.quiz = qz.data || [];
  // Ouverture progressive (26 septembre 2026) : les leçons pas encore ouvertes
  // ne sont pas lisibles (RLS) ; le calendrier fournit leur titre et leur date.
  FKL.cal = cal.data || null;
  if (FKL.cal) {
    const vues = new Set(FKL.lecons.map(l => l.id));
    (FKL.cal.lecons || []).forEach(c => {
      if (!vues.has(c.id)) FKL.lecons.push({ ...c, verrou: true });
      else if (!c.ouverte) FKL.lecons.find(l => l.id === c.id).verrou = true;
    });
    FKL.lecons.forEach(l => { const c = (FKL.cal.lecons || []).find(x => x.id === l.id); if (c) l.ouvre_le = c.ouvre_le; });
    FKL.lecons.sort((a, b) => (a.position - b.position) || (a.id - b.id));
    FKL.quiz.forEach(q => { const c = (FKL.cal.quiz || []).find(x => x.id === q.id); if (c && !c.ouvert) { q.verrou = true; q.ouvre_le = c.ouvre_le; } });
    FKL.modules.forEach(m => { const c = (FKL.cal.modules || []).find(x => x.id === m.id); if (c) m.ouvre_le = c.ouvre_le; });
  }
  FKL.ressources = res.data || [];
  (prog.data || []).filter(p => p.terminee).forEach(p => FKL.faites.add(p.lecon_id));
  (tent.data || []).forEach(t => FKL.reussis.add(t.quiz_id));
  FKL.modules.forEach(m => {
    FKL.lecons.filter(l => l.module_id === m.id).forEach(l => FKL.items.push({ type: 'lecon', id: l.id, module: m.id, obj: l }));
    FKL.quiz.filter(q => q.module_id === m.id).forEach(q => FKL.items.push({ type: 'quiz', id: q.id, module: m.id, obj: q }));
  });
  FKL.quiz.filter(q => !q.module_id).forEach(q => FKL.items.push({ type: 'quiz', id: q.id, module: null, obj: q }));
  document.title = `${f.titre} — KEKELI Formation`;

  main.innerHTML = `
    <div class="fk-lecteur" id="lecteur">
      <aside class="fk-lecteur-nav" aria-label="Sommaire de la formation">
        <div class="fk-lecteur-nav-tete">
          <div class="fk-tiroir-actions">
            <button class="fk-btn fk-btn-outline fk-btn-petit" data-nav-sens="-1" aria-label="Leçon précédente">◀ Précédent</button>
            <button class="fk-btn fk-btn-primary fk-btn-petit" data-nav-sens="1" aria-label="Leçon suivante">Suivant ▶</button>
            <button class="fk-btn fk-btn-ghost fk-btn-petit fk-tiroir-fermer" data-fermer-tiroir aria-label="Fermer le sommaire">✕</button>
          </div>
          <a class="fk-link" href="${FK_BASE}app/tableau-de-bord.html">← Mon apprentissage</a>
          <h2 style="margin-top:10px">${fkEchapper(f.titre)}</h2>
          ${FKL.apercu ? '<span class="fk-pastille en_revision">Mode aperçu (formateur)</span>' : `
            <div class="fk-progress"><span id="barreProg" style="width:${Math.round(ins.progression)}%"></span></div>
            <small style="color:var(--f-muted)" id="texteProg">${fkPourcentage(ins.progression)} terminé</small>`}
        </div>
        <div id="sommaire"></div>
        <div class="fk-tiroir-pied"><button class="fk-btn fk-btn-ghost fk-btn-petit" id="btnModeAffichage"></button></div>
      </aside>
      <div class="fk-voile-tiroir" data-fermer-tiroir></div>
      <button class="fk-bouton-nav-flottant" id="btnNavFlottant" aria-label="Leçons et navigation" title="Leçons et navigation"><span aria-hidden="true">☰</span><small id="navFlottantRang"></small></button>
      <section class="fk-lecteur-contenu" id="zoneLecon" tabindex="-1"></section>
    </div>`;
  rendreSommaire();
  brancherPleinEcran();

  // Élément de départ : paramètre d'URL, dernière leçon ouverte, ou premier non fait.
  let depart = null;
  if (fkParam('quiz')) depart = FKL.items.find(i => i.type === 'quiz' && i.id === Number(fkParam('quiz')));
  if (!depart && fkParam('lecon')) depart = FKL.items.find(i => i.type === 'lecon' && i.id === Number(fkParam('lecon')));
  if (!depart && ins?.derniere_lecon_id) depart = FKL.items.find(i => i.type === 'lecon' && i.id === ins.derniere_lecon_id);
  if (!depart) depart = FKL.items.find(i => !estFait(i) && !i.obj.verrou) || FKL.items.find(i => !i.obj.verrou) || FKL.items[0];
  if (depart) ouvrir(depart);
  else document.getElementById('zoneLecon').innerHTML = '<div class="fk-vide"><span class="fk-vide-icone">📭</span>Cette formation ne contient pas encore de leçon.</div>';
})();

// Affichage « plein écran » (26 septembre 2026) : la leçon occupe toute la page,
// sans l'en-tête du site ; un petit bouton fixe en haut à gauche ouvre le
// sommaire (leçons, Précédent / Suivant, retour à l'affichage classique).
// Choix mémorisé sur l'appareil ; plein écran par défaut.
function modePlein() { try { return localStorage.getItem('kekeli-lecteur-plein') !== '0'; } catch (_e) { return true; } }
function appliquerModeAffichage() {
  const plein = modePlein();
  document.body.classList.toggle('fk-plein', plein);
  const b = document.getElementById('btnModeAffichage');
  if (b) b.textContent = plein ? '⤡ Affichage classique (avec le menu du site)' : '⛶ Afficher les cours en plein écran';
}
function brancherPleinEcran() {
  const lecteur = document.getElementById('lecteur');
  const ouvrirTiroir = ouvert => lecteur.classList.toggle('nav-ouverte', ouvert);
  document.getElementById('btnNavFlottant').addEventListener('click', () => ouvrirTiroir(!lecteur.classList.contains('nav-ouverte')));
  lecteur.querySelectorAll('[data-fermer-tiroir]').forEach(b => b.addEventListener('click', () => ouvrirTiroir(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrirTiroir(false); });
  lecteur.querySelectorAll('[data-nav-sens]').forEach(b => b.addEventListener('click', () => {
    const i = FKL.items.findIndex(x => FKL.actuel && x.type === FKL.actuel.type && x.id === FKL.actuel.id);
    const cible = FKL.items[i + Number(b.dataset.navSens)];
    if (cible) { ouvrirTiroir(false); ouvrir(cible); }
  }));
  document.getElementById('btnModeAffichage').addEventListener('click', () => {
    try { localStorage.setItem('kekeli-lecteur-plein', modePlein() ? '0' : '1'); } catch (_e) { /* ignoré */ }
    appliquerModeAffichage();
    ouvrirTiroir(false);
  });
  appliquerModeAffichage();
}

function estFait(item) { return item.type === 'lecon' ? FKL.faites.has(item.id) : FKL.reussis.has(item.id); }

function rendreSommaire(actif) {
  const zone = document.getElementById('sommaire');
  zone.innerHTML = FKL.modules.map((m, i) => `
    <div class="fk-lecteur-module">Module ${i + 1} · ${fkEchapper(m.titre)}${m.ouvre_le && new Date(m.ouvre_le) > new Date() ? `<small class="fk-module-verrou">🔒 ouvre ${fkQuandOuverture(m.ouvre_le)}</small>` : ''}</div>
    ${FKL.items.filter(it => it.module === m.id).map(it => boutonItem(it, actif)).join('')}`).join('')
    + FKL.items.filter(it => it.module === null).map(it => boutonItem(it, actif)).join('');
  zone.querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => {
    const [type, id] = b.dataset.item.split(':');
    ouvrir(FKL.items.find(it => it.type === type && it.id === Number(id)));
    document.getElementById('lecteur').classList.remove('nav-ouverte');
  }));
}
function boutonItem(it, actif) {
  const estActif = actif && actif.type === it.type && actif.id === it.id;
  const icone = it.obj.verrou ? '🔒' : estFait(it) ? '✅' : it.type === 'quiz' ? '📝' : ({ video: '🎬', audio: '🎧', document: '📄' }[it.obj.type_contenu] || '📖');
  return `<button class="fk-lecteur-item ${estActif ? 'actif' : ''} ${it.obj.verrou ? 'verrou' : ''}" data-item="${it.type}:${it.id}" ${estActif ? 'aria-current="true"' : ''}>
    <span class="fk-etat" aria-hidden="true">${icone}</span>
    <span>${it.type === 'quiz' ? 'Quiz : ' : ''}${fkEchapper(it.obj.titre)}<small>${it.type === 'lecon' ? fkDuree(it.obj.duree_minutes) + (it.obj.est_obligatoire ? '' : ' · facultative') : `Réussite : ${it.obj.note_passage} %`}${estFait(it) ? ' · terminé' : ''}${it.obj.verrou && it.obj.ouvre_le ? ` · 🔒 ${new Date(it.obj.ouvre_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}</small></span>
  </button>`;
}

function majProgression(pct) {
  if (pct === null || pct === undefined || FKL.apercu) return;
  FKL.inscription.progression = pct;
  document.getElementById('barreProg').style.width = `${Math.round(pct)}%`;
  document.getElementById('texteProg').textContent = `${fkPourcentage(pct)} terminé`;
  if (Number(pct) >= 100) fkToast('🏆 Félicitations, vous avez terminé cette formation !', 'succes');
}

async function ouvrir(item) {
  if (FKL.chrono) { clearInterval(FKL.chrono); FKL.chrono = null; }
  FKL.actuel = item;
  const rang = FKL.items.findIndex(x => x.type === item.type && x.id === item.id);
  const r = document.getElementById('navFlottantRang'); if (r) r.textContent = `${rang + 1}/${FKL.items.length}`;
  document.querySelectorAll('[data-nav-sens="-1"]').forEach(b => { b.disabled = rang <= 0; });
  document.querySelectorAll('[data-nav-sens="1"]').forEach(b => { b.disabled = rang >= FKL.items.length - 1; });
  const u = new URL(window.location.href);
  u.searchParams.delete('lecon'); u.searchParams.delete('quiz');
  u.searchParams.set(item.type, item.id);
  history.replaceState(null, '', u);
  rendreSommaire(item);
  const zone = document.getElementById('zoneLecon');
  zone.innerHTML = '<div class="fk-chargement">Chargement…</div>';
  zone.classList.remove('fk-contenu-page');
  if (item.obj.verrou) afficherVerrou(item);
  else if (item.type === 'lecon') await afficherLecon(item); else await afficherQuiz(item);
  zone.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function navigation(item) {
  const i = FKL.items.findIndex(x => x.type === item.type && x.id === item.id);
  const prec = FKL.items[i - 1], suiv = FKL.items[i + 1];
  return `<div class="fk-lecteur-pied">
    ${prec ? `<button class="fk-btn fk-btn-ghost" data-aller="${prec.type}:${prec.id}">← Précédent</button>` : '<span></span>'}
    ${suiv ? `<button class="fk-btn fk-btn-outline" data-aller="${suiv.type}:${suiv.id}">Suivant →</button>` : `<a class="fk-btn fk-btn-outline" href="${FK_BASE}formation.html?slug=${encodeURIComponent(FKL.f.slug)}">Fiche de la formation</a>`}
  </div>`;
}
function brancherNavigation(zone) {
  zone.querySelectorAll('[data-aller]').forEach(b => b.addEventListener('click', () => {
    const [type, id] = b.dataset.aller.split(':');
    ouvrir(FKL.items.find(it => it.type === type && it.id === Number(id)));
  }));
}

// Élément pas encore ouvert (ouverture progressive) : date et compte à rebours.
function afficherVerrou(item) {
  const zone = document.getElementById('zoneLecon');
  const o = item.obj.ouvre_le ? new Date(item.obj.ouvre_le) : null;
  zone.innerHTML = `
    <button class="fk-btn fk-btn-ghost fk-btn-petit fk-lecteur-bascule" id="btnSommaire">☰ Sommaire</button>
    <div class="fk-carte fk-vide fk-verrou-page">
      <span class="fk-vide-icone">🔒</span>
      <h1 style="font-size:24px">${fkEchapper(item.obj.titre)}</h1>
      <p style="font-size:17px">${item.type === 'quiz' ? 'Ce quiz' : 'Cette leçon'} s'ouvrira <b>${o ? fkQuandOuverture(o.toISOString()) : 'bientôt'}</b>.</p>
      <p class="fk-compte-rebours" id="compteRebours" aria-live="polite"></p>
      <p style="color:var(--f-muted);max-width:520px;margin:10px auto 0">Votre formateur a prévu une progression régulière : prenez le temps de bien assimiler ce qui est déjà ouvert, puis revenez à la date indiquée.</p>
    </div>
    ${navigation(item)}`;
  zone.querySelector('#btnSommaire').addEventListener('click', () => document.getElementById('lecteur').classList.toggle('nav-ouverte'));
  brancherNavigation(zone);
  if (!o) return;
  const cr = zone.querySelector('#compteRebours');
  const tic = () => {
    const ms = o - new Date();
    if (ms <= 0) { clearInterval(FKL.chrono); FKL.chrono = null; window.location.reload(); return; }
    const h = Math.floor(ms / 3600000), mn = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
    cr.textContent = h < 48 ? `⏳ ${h} h ${String(mn).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s` : '';
  };
  tic();
  FKL.chrono = setInterval(tic, 1000);
}

async function afficherLecon(item) {
  const l = item.obj;
  const zone = document.getElementById('zoneLecon');
  if (!FKL.apercu) supabaseClient.rpc('enregistrer_acces_lecon', { p_lecon_id: l.id });
  const ressources = FKL.ressources.filter(r => r.lecon_id === l.id);
  const fait = FKL.faites.has(l.id);
  // Leçon « page HTML complète » : affichée telle quelle (voir fkAfficherPageHtml).
  const page = !!l.page_html;
  zone.classList.toggle('fk-contenu-page', page);
  zone.innerHTML = `
    <button class="fk-btn fk-btn-ghost fk-btn-petit fk-lecteur-bascule" id="btnSommaire">☰ Sommaire</button>
    ${page ? '' : `<h1>${fkEchapper(l.titre)}</h1>
    <p style="color:var(--f-muted);margin:0 0 10px">⏱️ ${fkDuree(l.duree_minutes)}${l.est_obligatoire ? '' : ' · leçon facultative'}</p>`}
    ${await fkHtmlVideo(l.video_url)}
    ${await fkHtmlAudio(l.audio_url)}
    ${page ? '<div class="fk-page-conteneur" data-page-html></div>' : `<div class="fk-lecon-corps">${fkNettoyerHtml(l.contenu)}</div>`}
    <div data-apres-corps>${ressources.length ? `<h2 style="font-size:18px;margin-top:26px">📎 Ressources</h2>${ressources.map(r => `
      <div class="fk-ressource"><span>📄 ${fkEchapper(r.nom)}</span>
        <button class="fk-btn fk-btn-outline fk-btn-petit" data-ressource="${r.id}">${r.telechargement_autorise ? '⬇️ Télécharger' : '👁️ Ouvrir'}</button></div>`).join('')}` : ''}
    ${FKL.apercu ? '' : `<div style="margin-top:26px"><button class="fk-btn ${fait ? 'fk-btn-ghost' : 'fk-btn-primary'}" id="btnFait">${fait ? '↩️ Marquer comme non terminée' : '✅ Marquer comme terminée'}</button></div>`}
    ${navigation(item)}</div>`;
  zone.querySelector('#btnSommaire').addEventListener('click', () => document.getElementById('lecteur').classList.toggle('nav-ouverte'));
  // Diaporama intégré et présentations PowerPoint / PDF / Google Slides (26 septembre 2026).
  if (page) fkAfficherPageHtml(zone.querySelector('[data-page-html]'), l.page_html, { cle: `kekeli-page-${FKL.s.profil.id}-${l.id}`, titre: l.titre });
  else {
    await fkPreparerCorpsLecon(zone.querySelector('.fk-lecon-corps'));
    await brancherActivitesLecon(zone, l.id);
  }
  zone.querySelectorAll('[data-ressource]').forEach(b => b.addEventListener('click', async () => {
    const r = ressources.find(x => x.id === Number(b.dataset.ressource));
    const url = await fkUrlFichier(r.chemin_fichier, r.telechargement_autorise);
    if (!url) { fkToast('Fichier indisponible.', 'erreur'); return; }
    window.open(url, '_blank', 'noopener');
  }));
  const btn = zone.querySelector('#btnFait');
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true;
    const nouveau = !FKL.faites.has(l.id);
    const { data, error } = await supabaseClient.rpc('marquer_lecon_terminee', { p_lecon_id: l.id, p_terminee: nouveau });
    btn.disabled = false;
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    if (nouveau) FKL.faites.add(l.id); else FKL.faites.delete(l.id);
    majProgression(data);
    const i = FKL.items.findIndex(x => x.type === 'lecon' && x.id === l.id);
    if (nouveau && FKL.items[i + 1]) ouvrir(FKL.items[i + 1]); else ouvrir(item);
  });
  brancherNavigation(zone);
}

async function afficherQuiz(item) {
  const zone = document.getElementById('zoneLecon');
  const { data, error } = await supabaseClient.rpc('quiz_pour_apprenant', { p_quiz_id: item.id });
  if (error) { zone.innerHTML = `<p class="fk-alerte fk-alerte-erreur">${fkEchapper(fkMessageErreur(error))}</p>${navigation(item)}`; brancherNavigation(zone); return; }
  const q = data.quiz;
  const meilleur = (data.tentatives || []).reduce((m, t) => Math.max(m, Number(t.pourcentage) || 0), 0);
  const reussi = (data.tentatives || []).some(t => t.reussi);
  const epuise = data.essais_restants === 0;
  zone.innerHTML = `
    <button class="fk-btn fk-btn-ghost fk-btn-petit fk-lecteur-bascule" id="btnSommaire">☰ Sommaire</button>
    <h1>📝 ${fkEchapper(q.titre)}</h1>
    ${q.description ? `<p>${fkEchapper(q.description)}</p>` : ''}
    <div class="fk-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="fk-stat"><small>Questions</small><strong>${data.questions.length}</strong></div>
      <div class="fk-stat"><small>Pour réussir</small><strong>${q.note_passage} %</strong></div>
      <div class="fk-stat"><small>Essais restants</small><strong>${data.essais_restants ?? '∞'}</strong></div>
      <div class="fk-stat"><small>Durée</small><strong>${q.duree_limite_minutes ? q.duree_limite_minutes + ' min' : 'Libre'}</strong></div>
    </div>
    ${data.tentatives.length ? `<div class="fk-alerte ${reussi ? 'fk-alerte-info' : 'fk-alerte-attention'}">${reussi ? '✅ Quiz réussi' : '⏳ Pas encore réussi'} · meilleur score : ${fkPourcentage(meilleur)} · ${data.tentatives.length} essai${data.tentatives.length > 1 ? 's' : ''}</div>` : ''}
    ${epuise ? '<div class="fk-alerte fk-alerte-erreur">Vous avez utilisé tous vos essais pour ce quiz.</div>'
      : `<button class="fk-btn fk-btn-primary" id="btnCommencer">${data.en_cours ? '▶ Reprendre le quiz' : data.tentatives.length ? '🔁 Nouvel essai' : '▶ Commencer le quiz'}</button>`}
    ${navigation(item)}`;
  zone.querySelector('#btnSommaire').addEventListener('click', () => document.getElementById('lecteur').classList.toggle('nav-ouverte'));
  brancherNavigation(zone);
  const btn = zone.querySelector('#btnCommencer');
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { data: t, error: e2 } = await supabaseClient.rpc('commencer_quiz', { p_quiz_id: item.id });
    if (e2) { btn.disabled = false; fkToast(fkMessageErreur(e2), 'erreur'); return; }
    passerQuiz(item, data, t);
  });
}

// ---------- Rendu d'une question selon son type (25 septembre 2026) ----------
// Tous les types du site KEKELI corrigés automatiquement. Les données
// reçues (qu.donnees) ne contiennent jamais la bonne réponse : éléments et
// banques de mots sont déjà mélangés par le serveur.
function htmlChampQuestion(qu) {
  const e = fkEchapper;
  const d = qu.donnees || {};
  const nom = `q${qu.id}`;
  switch (qu.type) {
    case 'choix_unique': case 'choix_multiple': case 'vrai_faux':
      return qu.reponses.map(r => `<label class="fk-choix"><input type="${qu.type === 'choix_multiple' ? 'checkbox' : 'radio'}" name="${nom}" value="${r.id}"> ${e(r.texte)}</label>`).join('');
    case 'reponse_courte':
      return `<label class="fk-sr" for="${nom}">Votre réponse</label><input class="fk-input" id="${nom}" type="text" data-rep maxlength="200" autocomplete="off" placeholder="Votre réponse">`;
    case 'reponse_numerique':
      return `<div style="display:flex;gap:8px;align-items:center"><label class="fk-sr" for="${nom}">Votre réponse</label><input class="fk-input" id="${nom}" type="text" inputmode="decimal" data-rep maxlength="30" style="max-width:220px" placeholder="Nombre">${d.unite ? `<span>${e(d.unite)}</span>` : ''}</div>`;
    case 'texte_a_trous': {
      let i = 0;
      return `<p class="fk-trous">${e(qu.enonce).split('___').map((morceau, k, tab) => morceau + (k < tab.length - 1 ? `<input class="fk-input fk-trou" type="text" data-trou="${i++}" aria-label="Trou ${i}" autocomplete="off">` : '')).join('')}</p>`;
    }
    case 'texte_a_trous_glisser': {
      let i = 0;
      const opts = `<option value="">…</option>${(d.banque || []).map(m => `<option>${e(m)}</option>`).join('')}`;
      return `<p class="fk-trous">${e(qu.enonce).split('___').map((morceau, k, tab) => morceau + (k < tab.length - 1 ? `<select class="fk-input fk-trou" data-trou="${i++}" aria-label="Trou ${i}">${opts}</select>` : '')).join('')}</p>
        <p class="fk-banque">Banque de mots : ${(d.banque || []).map(m => `<span>${e(m)}</span>`).join('')}</p>`;
    }
    case 'remise_en_ordre':
      return `<ol class="fk-ordre" data-ordre>${(d.elements || []).map(m => `<li data-val="${e(m)}"><span>${e(m)}</span>
        <span class="fk-ordre-btns"><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-haut aria-label="Monter">↑</button><button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-bas aria-label="Descendre">↓</button></span></li>`).join('')}</ol>`;
    case 'association':
      return `<div class="fk-assoc">${(d.gauche || []).map((g, i) => `<label class="fk-assoc-ligne"><span>${e(g)}</span><select class="fk-input" data-assoc="${i}"><option value="">— Relier à… —</option>${(d.droite || []).map(x => `<option>${e(x)}</option>`).join('')}</select></label>`).join('')}</div>`;
    case 'classement':
      return `<div class="fk-assoc">${(d.elements || []).map(el => `<label class="fk-assoc-ligne"><span>${e(el)}</span><select class="fk-input" data-classe="${e(el)}"><option value="">— Catégorie —</option>${(d.categories || []).map(c => `<option>${e(c)}</option>`).join('')}</select></label>`).join('')}</div>`;
    case 'intrus_lexical':
      return (d.series || []).map((s, si) => `<div class="fk-serie" role="radiogroup" aria-label="Série ${si + 1}"><small>Série ${si + 1}</small><div class="fk-mots">${(s.mots || []).map((m, mi) => `<label class="fk-mot-radio"><input type="radio" name="${nom}_${si}" value="${mi}"> ${e(m)}</label>`).join('')}</div></div>`).join('');
    case 'selection_mots':
      return `<div class="fk-mots">${(d.mots || []).map((m, i) => `<button type="button" class="fk-mot" data-mot="${i}" aria-pressed="false">${e(m)}</button>`).join('')}</div>`;
    default: return '<p>Type de question non pris en charge.</p>';
  }
}
function brancherChampQuestion(fs) {
  fs.querySelectorAll('[data-mot]').forEach(b => b.addEventListener('click', () => { const on = b.classList.toggle('choisi'); b.setAttribute('aria-pressed', String(on)); }));
  fs.querySelectorAll('[data-ordre] li').forEach(li => {
    li.querySelector('[data-haut]').addEventListener('click', () => { if (li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling); li.querySelector('[data-haut]').focus(); });
    li.querySelector('[data-bas]').addEventListener('click', () => { if (li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li); li.querySelector('[data-bas]').focus(); });
  });
}
// Lit la réponse d'une question ; renvoie { valeur, vide }.
function lireReponseQuestion(qu, fs) {
  const val = sel => [...fs.querySelectorAll(sel)];
  switch (qu.type) {
    case 'choix_unique': case 'choix_multiple': case 'vrai_faux': { const v = val(`[name="q${qu.id}"]:checked`).map(x => Number(x.value)); return { valeur: v, vide: !v.length }; }
    case 'reponse_courte': case 'reponse_numerique': { const v = fs.querySelector('[data-rep]').value.trim(); return { valeur: v, vide: !v }; }
    case 'texte_a_trous': case 'texte_a_trous_glisser': { const v = val('[data-trou]').map(x => x.value.trim()); return { valeur: v, vide: v.every(x => !x) }; }
    case 'remise_en_ordre': return { valeur: val('[data-ordre] li').map(li => li.dataset.val), vide: false };
    case 'association': { const v = val('[data-assoc]').map(x => x.value); return { valeur: v, vide: v.every(x => !x) }; }
    case 'classement': { const v = {}; val('[data-classe]').forEach(x => { if (x.value) v[x.dataset.classe] = x.value; }); return { valeur: v, vide: !Object.keys(v).length }; }
    case 'intrus_lexical': { const n = (qu.donnees?.series || []).length; const v = Array.from({ length: n }, (_, si) => fs.querySelector(`[name="q${qu.id}_${si}"]:checked`)?.value ?? null); return { valeur: v, vide: v.every(x => x === null) }; }
    case 'selection_mots': { const v = val('[data-mot].choisi').map(b => b.dataset.mot); return { valeur: v, vide: !v.length }; }
    default: return { valeur: null, vide: true };
  }
}
// Correction lisible d'une question (après réussite ou essais épuisés).
function htmlCorrectionQuestion(qu, c, rep) {
  const e = fkEchapper;
  if (!c) return '';
  if (FK_TYPES_CHOIX.includes(qu.type)) {
    return qu.reponses.map(r => {
      const bonne = (c.correctes || []).includes(r.id);
      const choisie = (rep || []).includes(r.id);
      return `<div class="fk-choix ${bonne ? 'juste' : choisie ? 'faux' : ''}">${bonne ? '✔' : choisie ? '✘' : '·'} ${e(r.texte)}</div>`;
    }).join('');
  }
  const a = c.attendu;
  const ligne = (etiq, v) => `<div class="fk-corr"><span>${etiq}</span> ${v}</div>`;
  const vous = v => ligne('Votre réponse :', `<b>${e(v === null || v === undefined || v === '' ? '—' : v)}</b>`);
  switch (qu.type) {
    case 'reponse_courte': return vous(rep) + ligne('Réponse attendue :', e((a || []).join(' ou ')));
    case 'reponse_numerique': return vous(rep) + ligne('Réponse attendue :', `${e(a.valeur)} ${e(a.unite || '')}${Number(a.tolerance) ? ` (± ${e(a.tolerance)})` : ''}`);
    case 'texte_a_trous': case 'texte_a_trous_glisser':
      return (a || []).map((att, i) => ligne(`Trou ${i + 1} :`, `${e((rep || [])[i] || '—')} → <b>${e(att)}</b>`)).join('');
    case 'remise_en_ordre': return ligne('Bon ordre :', `<ol style="margin:4px 0 0">${(a || []).map(x => `<li>${e(x)}</li>`).join('')}</ol>`);
    case 'association': return (a || []).map((p, i) => ligne(`${e(p.gauche)} ↔`, `<b>${e(p.droite)}</b>${(rep || [])[i] && (rep || [])[i] !== p.droite ? ` <small>(vous : ${e(rep[i])})</small>` : ''}`)).join('');
    case 'classement': return (a || []).map(el => ligne(`${e(el.texte)} →`, `<b>${e(el.categorie)}</b>${rep && rep[el.texte] && rep[el.texte] !== el.categorie ? ` <small>(vous : ${e(rep[el.texte])})</small>` : ''}`)).join('');
    case 'intrus_lexical': return (a || []).map((x, i) => ligne(`Série ${i + 1} — intrus :`, `<b>${e(x)}</b>`)).join('');
    case 'selection_mots': return ligne('Mots attendus :', `<b>${e((a || []).join(', '))}</b>`);
    default: return '';
  }
}

function passerQuiz(item, data, t) {
  const zone = document.getElementById('zoneLecon');
  const q = data.quiz;
  const enonceDansChamp = ['texte_a_trous', 'texte_a_trous_glisser', 'selection_mots'];
  const consigne = { texte_a_trous: 'Complétez le texte', texte_a_trous_glisser: 'Complétez avec les mots de la banque', selection_mots: 'Cliquez sur les bons mots', remise_en_ordre: 'remettez dans le bon ordre', association: 'reliez chaque élément', classement: 'classez chaque élément', intrus_lexical: 'trouvez l\'intrus de chaque série', choix_multiple: 'plusieurs réponses possibles' };
  zone.innerHTML = `
    <h1>📝 ${fkEchapper(q.titre)}</h1>
    ${q.duree_limite_minutes ? '<div class="fk-chrono" id="chrono" role="timer" aria-live="off"></div>' : ''}
    <form id="formQuiz">
      ${data.questions.map((qu, i) => `
        <fieldset class="fk-question" data-q="${qu.id}">
          <legend class="fk-sr">Question ${i + 1}</legend>
          <h3>${i + 1}. ${enonceDansChamp.includes(qu.type) ? fkEchapper(consigne[qu.type]) : fkEchapper(qu.enonce)} <small style="color:var(--f-muted);font-weight:500">(${qu.points} pt${qu.points > 1 ? 's' : ''}${!enonceDansChamp.includes(qu.type) && consigne[qu.type] ? ' · ' + consigne[qu.type] : ''})</small></h3>
          ${htmlChampQuestion(qu)}
        </fieldset>`).join('')}
      <button class="fk-btn fk-btn-primary" type="submit">Valider mes réponses</button>
    </form>`;
  const form = zone.querySelector('#formQuiz');
  form.querySelectorAll('fieldset[data-q]').forEach(brancherChampQuestion);
  if (q.duree_limite_minutes) {
    const fin = new Date(t.debute_le).getTime() + q.duree_limite_minutes * 60000;
    const chrono = zone.querySelector('#chrono');
    const tic = () => {
      const reste = Math.max(0, fin - Date.now());
      chrono.textContent = `⏱️ ${Math.floor(reste / 60000)}:${String(Math.floor(reste / 1000) % 60).padStart(2, '0')}`;
      if (reste <= 0) { clearInterval(FKL.chrono); FKL.chrono = null; fkToast('Temps écoulé : vos réponses sont envoyées.', 'erreur'); form.dataset.auto = '1'; form.requestSubmit(); }
    };
    tic();
    FKL.chrono = setInterval(tic, 1000);
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const reponses = {};
    let nonRepondues = 0;
    data.questions.forEach(qu => {
      const r = lireReponseQuestion(qu, form.querySelector(`fieldset[data-q="${qu.id}"]`));
      reponses[qu.id] = r.valeur;
      if (r.vide) nonRepondues++;
    });
    if (nonRepondues && form.dataset.auto !== '1' && !await fkConfirmer(`${nonRepondues} question(s) sans réponse. Valider quand même ?`, 'Valider')) return;
    if (FKL.chrono) { clearInterval(FKL.chrono); FKL.chrono = null; }
    form.querySelector('button[type=submit]').disabled = true;
    const { data: r, error } = await supabaseClient.rpc('soumettre_quiz', { p_tentative_id: t.tentative_id, p_reponses: reponses });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); form.querySelector('button[type=submit]').disabled = false; return; }
    if (r.reussi) FKL.reussis.add(item.id);
    if (!FKL.apercu) {
      const { data: ins } = await supabaseClient.from('formation_inscriptions').select('progression').eq('id', FKL.inscription.id).maybeSingle();
      if (ins) majProgression(ins.progression);
    }
    afficherResultat(item, data, r, reponses);
  });
}

function afficherResultat(item, data, r, reponses) {
  const zone = document.getElementById('zoneLecon');
  rendreSommaire(item);
  const correction = r.correction ? new Map(r.correction.map(c => [c.question_id, c])) : null;
  zone.innerHTML = `
    <h1>${r.reussi ? '🎉 Quiz réussi !' : '📝 Résultat du quiz'}</h1>
    <div class="fk-alerte ${r.reussi ? 'fk-alerte-info' : 'fk-alerte-attention'}" role="status">
      Score : <b>${r.score} / ${r.score_max}</b> (${fkPourcentage(r.pourcentage)}) — seuil de réussite ${r.note_passage} %.
      ${r.temps_depasse ? '<br>⏱️ Temps dépassé : cette tentative ne peut pas être validée.' : ''}
      ${!r.reussi && r.essais_restants !== null ? `<br>Essais restants : ${r.essais_restants}.` : ''}
    </div>
    ${correction ? data.questions.map((qu, i) => {
      const c = correction.get(qu.id);
      const icone = c?.juste ? '✅' : Number(c?.partiel) > 0 ? '🟡' : '❌';
      return `<div class="fk-question"><h3>${icone} ${i + 1}. ${fkEchapper(qu.enonce)}${c && !c.juste && Number(c.partiel) > 0 ? ` <small style="color:var(--f-muted);font-weight:500">(${Math.round(c.partiel * 100)} % juste)</small>` : ''}</h3>
        ${htmlCorrectionQuestion(qu, c, reponses[qu.id])}
        ${c?.explication ? `<p style="color:var(--f-muted);font-size:14px">💡 ${fkEchapper(c.explication)}</p>` : ''}</div>`;
    }).join('') : '<p style="color:var(--f-muted)">La correction détaillée s\'affiche lorsque le quiz est réussi ou quand tous vos essais sont utilisés. Relisez les leçons du module et réessayez !</p>'}
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${!r.reussi && r.essais_restants !== 0 ? '<button class="fk-btn fk-btn-primary" id="btnReessayer">🔁 Réessayer</button>' : ''}
    </div>
    ${navigation(item)}`;
  zone.querySelector('#btnReessayer')?.addEventListener('click', () => ouvrir(item));
  brancherNavigation(zone);
}

// ---------- Tests au cœur de la leçon (25 septembre 2026) ----------
// Chaque repère <div data-activite="ID"> du texte devient un petit test.
// Un test « bloquant » masque la suite de la leçon jusqu'à la réponse.
// Correction / retour faits par le serveur (repondre_activite) ; réponses
// enregistrées pour le formateur, sans note ni effet sur la progression.
async function brancherActivitesLecon(zone, leconId) {
  const corps = zone.querySelector('.fk-lecon-corps');
  const reperes = [...corps.querySelectorAll('[data-activite]')];
  if (!reperes.length) return;
  const { data } = await supabaseClient.rpc('activites_lecon', { p_lecon_id: leconId });
  const parId = new Map((data || []).map(a => [String(a.id), a]));
  reperes.forEach(el => {
    const a = parId.get(el.dataset.activite);
    if (!a) { el.remove(); return; }
    el.className = 'fk-activite';
    rendreActivite(el, a);
  });
  appliquerBlocages(zone);
}

function appliquerBlocages(zone) {
  const corps = zone.querySelector('.fk-lecon-corps');
  const enfants = [...corps.children];
  let bloque = false;
  corps.querySelector('.fk-activite-verrou')?.remove();
  enfants.forEach(enf => {
    if (enf.classList.contains('fk-activite-verrou')) return;
    enf.hidden = bloque;
    const act = enf.matches('.fk-activite') ? enf : enf.querySelector('.fk-activite');
    if (!bloque && act && act.dataset.bloquant === '1' && act.dataset.repondu !== '1') {
      bloque = true;
      enf.insertAdjacentHTML('afterend', '<p class="fk-activite-verrou">🔒 La suite de la leçon s\'affichera après votre réponse.</p>');
    }
  });
  // Pied de leçon (ressources, « terminée », navigation) masqué tant que c'est bloqué.
  zone.querySelectorAll('[data-apres-corps]').forEach(el => { el.hidden = bloque; });
  // Diaporama : « Suivant » reste grisé tant que la diapositive suivante est masquée.
  if (corps._fkDiapo) corps._fkDiapo.maj();
}

function rendreActivite(el, a) {
  const e = fkEchapper;
  const titres = { controle: '🧭 Point de contrôle', reflexion: '💭 Prenez un moment pour réfléchir', questionnaire: '📋 Questionnaire d\'auto-évaluation', fiche: '📝 Exercice' };
  el.dataset.bloquant = a.bloquant ? '1' : '0';
  el.dataset.repondu = a.ma_reponse !== null && a.ma_reponse !== undefined ? '1' : '0';
  const nom = `act${a.id}`;
  let champs = '';
  if (a.nature === 'controle') {
    if (['choix_unique', 'choix_multiple', 'vrai_faux'].includes(a.type)) {
      champs = a.donnees.choix.map((t, i) => `<label class="fk-choix" data-i="${i}"><input type="${a.type === 'choix_multiple' ? 'checkbox' : 'radio'}" name="${nom}" value="${i}"> ${e(t)}</label>`).join('');
    } else {
      champs = `<div style="display:flex;gap:8px;align-items:center"><input class="fk-input" type="text" data-rep ${a.type === 'reponse_numerique' ? 'inputmode="decimal" style="max-width:220px"' : ''} maxlength="200" placeholder="Votre réponse" aria-label="Votre réponse">${a.donnees.unite ? `<span>${e(a.donnees.unite)}</span>` : ''}</div>`;
    }
  } else if (a.nature === 'fiche') {
    // Fiche d'exercice (26 septembre 2026) : plusieurs questions, non notées.
    champs = `<div class="fk-fiche">${(a.donnees.champs || []).map((ch, i) => {
      const leg = `<legend>${i + 1}. ${e(ch.libelle || '').replace(/\n/g, '<br>')}${ch.obligatoire === false ? ' <small>(facultatif)</small>' : ''}</legend>`;
      let w;
      if (ch.type === 'trous') {
        // Texte à trous mis en forme par le formateur : chaque « ___ » devient une case.
        let k = 0;
        const html = fkNettoyerHtml(ch.libelle || '').split('___').map((m, j, t) => m + (j < t.length - 1 ? `<input class="fk-input fk-trou" type="text" data-trou-champ="${i}" data-k="${k++}" maxlength="200" autocomplete="off" aria-label="Trou ${k}">` : '')).join('');
        return `<fieldset class="fk-fiche-champ"><legend>${i + 1}. Complétez le texte${ch.obligatoire === false ? ' <small>(facultatif)</small>' : ''}</legend><div class="fk-lecon-corps fk-fiche-trous">${html}</div></fieldset>`;
      }
      if (ch.type === 'texte') w = `<input class="fk-input" type="text" data-champ="${i}" maxlength="500" aria-label="Réponse à la question ${i + 1}">`;
      else if (ch.type === 'paragraphe') w = `<textarea class="fk-input fk-fiche-lignes" data-champ="${i}" rows="${Math.min(10, Math.max(2, Number(ch.lignes) || 3))}" maxlength="3000" aria-label="Réponse à la question ${i + 1}"></textarea>`;
      else {
        const t = ch.type === 'choix' ? 'radio' : 'checkbox';
        w = `<div class="fk-fiche-options">${(ch.options || []).map((o, j) => `<label class="fk-choix"><input type="${t}" name="${nom}_${i}" value="${j}"> ${e(o)}</label>`).join('')}
          ${ch.autre ? `<label class="fk-choix fk-fiche-autre"><input type="${t}" name="${nom}_${i}" value="autre"> Autre : <input class="fk-input" type="text" data-autre="${i}" maxlength="300" aria-label="Autre : précisez"></label>` : ''}</div>`;
      }
      return `<fieldset class="fk-fiche-champ">${leg}${w}</fieldset>`;
    }).join('')}</div>`;
  } else if (a.nature === 'reflexion') {
    champs = `<textarea class="fk-input" data-rep rows="4" maxlength="3000" placeholder="Écrivez ce que vous pensez…" aria-label="Votre réponse"></textarea>`;
  } else {
    const ech = a.donnees.echelle || [];
    champs = `<div class="fk-questionnaire">${(a.donnees.items || []).map((it, i) => `
      <fieldset class="fk-q-item"><legend>${i + 1}. ${e(it)}</legend>
        <div class="fk-q-echelle">${ech.map((x, j) => `<label><input type="radio" name="${nom}_${i}" value="${j}"> <span>${e(x.texte)}</span></label>`).join('')}</div>
      </fieldset>`).join('')}</div>`;
  }
  el.innerHTML = `
    <div class="fk-activite-tete">${titres[a.nature]}${a.titre ? ` — ${e(a.titre)}` : ''}</div>
    <p class="fk-activite-enonce">${e(a.enonce).replace(/\n/g, '<br>')}</p>
    <form data-form>${champs}<div class="fk-activite-actions"><button class="fk-btn fk-btn-primary fk-btn-petit" type="submit">${a.nature === 'controle' ? 'Vérifier' : 'Valider'}</button></div></form>
    <div data-resultat></div>`;
  const form = el.querySelector('[data-form]');
  // « Autre : … » : écrire dans la zone coche la case.
  form.querySelectorAll('[data-autre]').forEach(t => t.addEventListener('input', () => {
    const c = form.querySelector(`[name="${nom}_${t.dataset.autre}"][value="autre"]`);
    if (c && t.value.trim()) c.checked = true;
  }));
  // Réponse déjà donnée : on la remet et on affiche le retour.
  if (el.dataset.repondu === '1') { remplir(form, a, a.ma_reponse); afficherRetour(el, a, a.resultat, a.ma_reponse); }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const rep = lireReponse(form, a);
    if (rep === null && a.nature === 'fiche') { fkToast(`Répondez à la question ${form._manque} avant de valider.`, 'erreur'); return; }
    if (rep === null) { fkToast(a.nature === 'questionnaire' ? 'Répondez à chaque affirmation.' : 'Répondez d\'abord à la question.', 'erreur'); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const { data: res, error } = await supabaseClient.rpc('repondre_activite', { p_activite_id: a.id, p_reponse: rep });
    btn.disabled = false;
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    el.dataset.repondu = '1';
    afficherRetour(el, a, res, rep);
    appliquerBlocages(document.getElementById('zoneLecon'));
  });
}

function lireReponse(form, a) {
  if (a.nature === 'fiche') {
    const champs = a.donnees.champs || [];
    const v = champs.map((ch, i) => {
      if (ch.type === 'texte' || ch.type === 'paragraphe') return (form.querySelector(`[data-champ="${i}"]`)?.value || '').trim();
      if (ch.type === 'trous') return [...form.querySelectorAll(`[data-trou-champ="${i}"]`)].map(x => x.value.trim());
      const coches = [...form.querySelectorAll(`[name="act${a.id}_${i}"]:checked`)];
      const autre = coches.some(x => x.value === 'autre') ? (form.querySelector(`[data-autre="${i}"]`)?.value || '').trim() : '';
      return { choix: coches.filter(x => x.value !== 'autre').map(x => Number(x.value)), autre };
    });
    const manque = champs.findIndex((ch, i) => ch.obligatoire !== false && (typeof v[i] === 'string' ? !v[i] : Array.isArray(v[i]) ? v[i].some(x => !x) : !v[i].choix.length && !v[i].autre));
    if (manque >= 0) { form._manque = manque + 1; return null; }
    return v;
  }
  if (a.nature === 'questionnaire') {
    const v = (a.donnees.items || []).map((_, i) => { const x = form.querySelector(`[name="act${a.id}_${i}"]:checked`); return x ? Number(x.value) : null; });
    return v.some(x => x === null) ? null : v;
  }
  if (a.nature === 'controle' && ['choix_unique', 'choix_multiple', 'vrai_faux'].includes(a.type)) {
    const v = [...form.querySelectorAll(`[name="act${a.id}"]:checked`)].map(x => Number(x.value));
    return v.length ? v : null;
  }
  const t = form.querySelector('[data-rep]').value.trim();
  return t ? t : null;
}
function remplir(form, a, rep) {
  if (a.nature === 'fiche') {
    (Array.isArray(rep) ? rep : []).forEach((r, i) => {
      if (typeof r === 'string') { const f = form.querySelector(`[data-champ="${i}"]`); if (f) f.value = r; return; }
      if (Array.isArray(r)) { form.querySelectorAll(`[data-trou-champ="${i}"]`).forEach((x, k) => { x.value = r[k] ?? ''; }); return; }
      if (!r || typeof r !== 'object') return;
      (r.choix || []).forEach(j => { const x = form.querySelector(`[name="act${a.id}_${i}"][value="${j}"]`); if (x) x.checked = true; });
      if (r.autre) {
        const x = form.querySelector(`[name="act${a.id}_${i}"][value="autre"]`); if (x) x.checked = true;
        const t = form.querySelector(`[data-autre="${i}"]`); if (t) t.value = r.autre;
      }
    });
    return;
  }
  if (a.nature === 'questionnaire' && Array.isArray(rep)) rep.forEach((j, i) => { const x = form.querySelector(`[name="act${a.id}_${i}"][value="${j}"]`); if (x) x.checked = true; });
  else if (Array.isArray(rep)) rep.forEach(j => { const x = form.querySelector(`[name="act${a.id}"][value="${j}"]`); if (x) x.checked = true; });
  else if (form.querySelector('[data-rep]')) form.querySelector('[data-rep]').value = rep ?? '';
}
function afficherRetour(el, a, res, rep) {
  const e = fkEchapper;
  const zone = el.querySelector('[data-resultat]');
  el.querySelector('button[type=submit]').textContent = a.nature === 'controle' ? 'Vérifier à nouveau' : 'Modifier ma réponse';
  if (!res) { zone.innerHTML = ''; return; }
  if (a.nature === 'controle') {
    el.querySelectorAll('.fk-choix').forEach(l => {
      const i = Number(l.dataset.i);
      l.classList.toggle('juste', (res.correctes || []).includes(i));
      l.classList.toggle('faux', Array.isArray(rep) && rep.includes(i) && !(res.correctes || []).includes(i));
    });
    const attendu = res.attendu ? (Array.isArray(res.attendu) ? res.attendu.join(' ou ') : `${res.attendu.valeur} ${res.attendu.unite || ''}`) : '';
    zone.innerHTML = `<div class="fk-activite-retour ${res.juste ? 'ok' : 'ko'}" role="status"><b>${res.juste ? '✅ Bonne réponse !' : '❌ Pas tout à fait.'}</b>
      ${!res.juste && attendu ? `<br>Réponse attendue : <b>${e(attendu)}</b>` : ''}
      ${res.explication ? `<p>💡 ${e(res.explication).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
  } else if (a.nature === 'fiche') {
    // Textes à trous avec réponses attendues : case verte / rouge + réponse attendue.
    el.querySelectorAll('.fk-trou-attendu').forEach(x => x.remove());
    let justes = 0, total = 0;
    Object.entries(res.trous || {}).forEach(([i, liste]) => {
      el.querySelectorAll(`[data-trou-champ="${i}"]`).forEach((inp, k) => {
        const c = liste[k];
        inp.classList.remove('juste', 'faux');
        if (!c || c.attendu == null) return;
        total++; if (c.juste) justes++;
        inp.classList.add(c.juste ? 'juste' : 'faux');
        if (!c.juste) inp.insertAdjacentHTML('afterend', `<small class="fk-trou-attendu">→ ${e(c.attendu)}</small>`);
      });
    });
    zone.innerHTML = `<div class="fk-activite-retour" role="status">${total ? `<b>Textes à trous : ${justes} / ${total} bonne${justes > 1 ? 's' : ''} réponse${justes > 1 ? 's' : ''}.</b><br>` : ''}<b>✔ Merci, vos réponses sont enregistrées.</b> Vous pourrez les relire et les modifier ici à tout moment.${res.retour ? `<p><b>Le mot du formateur :</b><br>${e(res.retour).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
  } else if (a.nature === 'reflexion') {
    zone.innerHTML = `<div class="fk-activite-retour" role="status"><b>✔ Merci, votre réponse est enregistrée.</b>${res.retour ? `<p><b>Le mot du formateur :</b><br>${e(res.retour).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
  } else {
    zone.innerHTML = `<div class="fk-activite-retour" role="status"><b>Votre score : ${e(res.score)} / ${e(res.score_max)}</b>
      ${res.interpretation ? `<p>${e(res.interpretation).replace(/\n/g, '<br>')}</p>` : ''}
      ${res.retour ? `<p>${e(res.retour).replace(/\n/g, '<br>')}</p>` : ''}
      <small style="color:var(--f-muted)">Ce questionnaire sert à mieux vous connaître : il n'est pas noté.</small></div>`;
  }
}
