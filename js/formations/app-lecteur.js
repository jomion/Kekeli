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

  const [mods, lecs, qz, res, prog, tent] = await Promise.all([
    supabaseClient.from('formation_modules').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_lecons').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_quiz').select('*').eq('formation_id', id).order('position').order('id'),
    supabaseClient.from('formation_ressources').select('*').eq('formation_id', id).order('id'),
    supabaseClient.from('formation_progression_lecons').select('lecon_id, terminee').eq('formation_id', id).eq('apprenant_id', s.profil.id),
    supabaseClient.from('formation_tentatives_quiz').select('quiz_id, reussi').eq('formation_id', id).eq('apprenant_id', s.profil.id).eq('reussi', true)
  ]);
  FKL.modules = mods.data || [];
  FKL.lecons = lecs.data || [];
  FKL.quiz = qz.data || [];
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
          <a class="fk-link" href="${FK_BASE}app/tableau-de-bord.html">← Mon apprentissage</a>
          <h2 style="margin-top:10px">${fkEchapper(f.titre)}</h2>
          ${FKL.apercu ? '<span class="fk-pastille en_revision">Mode aperçu (formateur)</span>' : `
            <div class="fk-progress"><span id="barreProg" style="width:${Math.round(ins.progression)}%"></span></div>
            <small style="color:var(--f-muted)" id="texteProg">${fkPourcentage(ins.progression)} terminé</small>`}
        </div>
        <div id="sommaire"></div>
      </aside>
      <section class="fk-lecteur-contenu" id="zoneLecon" tabindex="-1"></section>
    </div>`;
  rendreSommaire();

  // Élément de départ : paramètre d'URL, dernière leçon ouverte, ou premier non fait.
  let depart = null;
  if (fkParam('quiz')) depart = FKL.items.find(i => i.type === 'quiz' && i.id === Number(fkParam('quiz')));
  if (!depart && fkParam('lecon')) depart = FKL.items.find(i => i.type === 'lecon' && i.id === Number(fkParam('lecon')));
  if (!depart && ins?.derniere_lecon_id) depart = FKL.items.find(i => i.type === 'lecon' && i.id === ins.derniere_lecon_id);
  if (!depart) depart = FKL.items.find(i => !estFait(i)) || FKL.items[0];
  if (depart) ouvrir(depart);
  else document.getElementById('zoneLecon').innerHTML = '<div class="fk-vide"><span class="fk-vide-icone">📭</span>Cette formation ne contient pas encore de leçon.</div>';
})();

function estFait(item) { return item.type === 'lecon' ? FKL.faites.has(item.id) : FKL.reussis.has(item.id); }

function rendreSommaire(actif) {
  const zone = document.getElementById('sommaire');
  zone.innerHTML = FKL.modules.map((m, i) => `
    <div class="fk-lecteur-module">Module ${i + 1} · ${fkEchapper(m.titre)}</div>
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
  const icone = estFait(it) ? '✅' : it.type === 'quiz' ? '📝' : ({ video: '🎬', audio: '🎧', document: '📄' }[it.obj.type_contenu] || '📖');
  return `<button class="fk-lecteur-item ${estActif ? 'actif' : ''}" data-item="${it.type}:${it.id}" ${estActif ? 'aria-current="true"' : ''}>
    <span class="fk-etat" aria-hidden="true">${icone}</span>
    <span>${it.type === 'quiz' ? 'Quiz : ' : ''}${fkEchapper(it.obj.titre)}<small>${it.type === 'lecon' ? fkDuree(it.obj.duree_minutes) + (it.obj.est_obligatoire ? '' : ' · facultative') : `Réussite : ${it.obj.note_passage} %`}${estFait(it) ? ' · terminé' : ''}</small></span>
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
  const u = new URL(window.location.href);
  u.searchParams.delete('lecon'); u.searchParams.delete('quiz');
  u.searchParams.set(item.type, item.id);
  history.replaceState(null, '', u);
  rendreSommaire(item);
  const zone = document.getElementById('zoneLecon');
  zone.innerHTML = '<div class="fk-chargement">Chargement…</div>';
  if (item.type === 'lecon') await afficherLecon(item); else await afficherQuiz(item);
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

async function afficherLecon(item) {
  const l = item.obj;
  const zone = document.getElementById('zoneLecon');
  if (!FKL.apercu) supabaseClient.rpc('enregistrer_acces_lecon', { p_lecon_id: l.id });
  const ressources = FKL.ressources.filter(r => r.lecon_id === l.id);
  const fait = FKL.faites.has(l.id);
  zone.innerHTML = `
    <button class="fk-btn fk-btn-ghost fk-btn-petit fk-lecteur-bascule" id="btnSommaire">☰ Sommaire</button>
    <h1>${fkEchapper(l.titre)}</h1>
    <p style="color:var(--f-muted);margin:0 0 10px">⏱️ ${fkDuree(l.duree_minutes)}${l.est_obligatoire ? '' : ' · leçon facultative'}</p>
    ${await fkHtmlVideo(l.video_url)}
    ${await fkHtmlAudio(l.audio_url)}
    <div class="fk-lecon-corps">${fkNettoyerHtml(l.contenu)}</div>
    ${ressources.length ? `<h2 style="font-size:18px;margin-top:26px">📎 Ressources</h2>${ressources.map(r => `
      <div class="fk-ressource"><span>📄 ${fkEchapper(r.nom)}</span>
        <button class="fk-btn fk-btn-outline fk-btn-petit" data-ressource="${r.id}">${r.telechargement_autorise ? '⬇️ Télécharger' : '👁️ Ouvrir'}</button></div>`).join('')}` : ''}
    ${FKL.apercu ? '' : `<div style="margin-top:26px"><button class="fk-btn ${fait ? 'fk-btn-ghost' : 'fk-btn-primary'}" id="btnFait">${fait ? '↩️ Marquer comme non terminée' : '✅ Marquer comme terminée'}</button></div>`}
    ${navigation(item)}`;
  zone.querySelector('#btnSommaire').addEventListener('click', () => document.getElementById('lecteur').classList.toggle('nav-ouverte'));
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

function passerQuiz(item, data, t) {
  const zone = document.getElementById('zoneLecon');
  const q = data.quiz;
  zone.innerHTML = `
    <h1>📝 ${fkEchapper(q.titre)}</h1>
    ${q.duree_limite_minutes ? '<div class="fk-chrono" id="chrono" role="timer" aria-live="off"></div>' : ''}
    <form id="formQuiz">
      ${data.questions.map((qu, i) => `
        <fieldset class="fk-question" data-q="${qu.id}">
          <legend class="fk-sr">Question ${i + 1}</legend>
          <h3>${i + 1}. ${fkEchapper(qu.enonce)} <small style="color:var(--f-muted);font-weight:500">(${qu.points} pt${qu.points > 1 ? 's' : ''}${qu.type === 'choix_multiple' ? ' · plusieurs réponses possibles' : ''})</small></h3>
          ${qu.reponses.map(r => `<label class="fk-choix" data-r="${r.id}"><input type="${qu.type === 'choix_multiple' ? 'checkbox' : 'radio'}" name="q${qu.id}" value="${r.id}"> ${fkEchapper(r.texte)}</label>`).join('')}
        </fieldset>`).join('')}
      <button class="fk-btn fk-btn-primary" type="submit">Valider mes réponses</button>
    </form>`;
  const form = zone.querySelector('#formQuiz');
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
    data.questions.forEach(qu => { reponses[qu.id] = [...form.querySelectorAll(`[name="q${qu.id}"]:checked`)].map(x => Number(x.value)); });
    const nonRepondues = data.questions.filter(qu => !reponses[qu.id].length).length;
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
      return `<div class="fk-question"><h3>${c?.juste ? '✅' : '❌'} ${i + 1}. ${fkEchapper(qu.enonce)}</h3>
        ${qu.reponses.map(rep => {
          const bonne = c?.correctes.includes(rep.id);
          const choisie = (reponses[qu.id] || []).includes(rep.id);
          return `<div class="fk-choix ${bonne ? 'juste' : choisie ? 'faux' : ''}">${bonne ? '✔' : choisie ? '✘' : '·'} ${fkEchapper(rep.texte)}</div>`;
        }).join('')}
        ${c?.explication ? `<p style="color:var(--f-muted);font-size:14px">💡 ${fkEchapper(c.explication)}</p>` : ''}</div>`;
    }).join('') : '<p style="color:var(--f-muted)">La correction détaillée s\'affiche lorsque le quiz est réussi ou quand tous vos essais sont utilisés. Relisez les leçons du module et réessayez !</p>'}
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${!r.reussi && r.essais_restants !== 0 ? '<button class="fk-btn fk-btn-primary" id="btnReessayer">🔁 Réessayer</button>' : ''}
    </div>
    ${navigation(item)}`;
  zone.querySelector('#btnReessayer')?.addEventListener('click', () => ouvrir(item));
  brancherNavigation(zone);
}
