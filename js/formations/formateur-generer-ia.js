// Espace formateur — Créer une formation avec l'IA (pages/formations/formateur/generer-ia.html),
// 26 septembre 2026. IA de KEKELI : Gemini puis ChatGPT (fonction serveur « formation-ia-generer ») :
// 1) plan de la formation (débite les crédits, remboursés en cas d'échec) ;
// 2) rédaction des leçons, un module après l'autre (inclus dans le prix,
//    3 essais par module). La formation est créée en BROUILLON : le
//    formateur la relit et la modifie dans l'éditeur habituel.

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('formateur');
  const main = document.getElementById('fkContenu');
  const e = fkEchapper;
  if (!s.estGestionnaire && (!s.formateur || s.formateur.statut !== 'valide')) {
    main.innerHTML = `<div class="fk-page"><div class="fk-container"><div class="fk-carte fk-vide"><span class="fk-vide-icone">👨‍🏫</span>
      Réservé aux formateurs validés par KEKELI.<br><a class="fk-link" href="${FK_BASE}devenir-formateur.html">Devenir formateur →</a></div></div></div>`;
    return;
  }
  const appel = async corps => {
    const { data, error } = await supabaseClient.functions.invoke('formation-ia-generer', { body: corps });
    if (error) {
      let msg = error.message || 'Le service ne répond pas.';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_e) { /* réponse non JSON */ }
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container" style="max-width:860px">
      <a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a>
      <h1 class="fk-titre-page" style="margin-top:10px">🤖 Créer une formation avec l'IA</h1>
      <p class="fk-sous-titre">Décrivez votre formation : l'IA de KEKELI prépare le plan puis rédige chaque leçon. Vous relisez et modifiez tout ensuite, avant de la soumettre à KEKELI.</p>
      <div class="fk-ia-solde" data-solde>Chargement de vos crédits IA…</div>
      <form class="fk-carte" id="formGen" style="margin-top:14px">
        <label class="fk-champ"><span>Sujet de la formation *</span><input type="text" name="sujet" required minlength="5" maxlength="300" placeholder="Ex. Gérer son budget personnel et épargner avec un petit salaire"></label>
        <label class="fk-champ"><span>Public visé</span><input type="text" name="public" maxlength="300" placeholder="Ex. jeunes salariés, commerçants, enseignants débutants…"></label>
        <div class="fk-grille-3">
          <label class="fk-champ"><span>Niveau</span><select name="niveau">${Object.entries(FK_NIVEAUX).map(([k, v]) => `<option value="${k}" ${k === 'debutant' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="fk-champ"><span>Nombre de modules</span><input type="number" name="nbModules" min="2" max="8" value="4"></label>
          <label class="fk-champ"><span>Leçons par module</span><input type="number" name="leconsParModule" min="2" max="6" value="3"></label>
        </div>
        <label class="fk-champ"><span>Consignes pour l'IA (facultatif)</span><textarea name="consignes" maxlength="1500" style="min-height:80px" placeholder="Ex. ton motivant, exemples au Bénin et au Togo, montants en FCFA, une étude de cas par module…"></textarea></label>
        <div class="fk-actions-form"><a class="fk-btn fk-btn-ghost" href="credits-ia.html">🪙 Mes crédits IA</a><button class="fk-btn fk-btn-primary" type="submit">🤖 Générer la formation</button></div>
      </form>
      <div id="suivi"></div>
    </div></div>`;

  const zoneSolde = main.querySelector('[data-solde]');
  const form = document.getElementById('formGen');
  const suivi = document.getElementById('suivi');
  let est = null;
  try {
    est = await appel({ action: 'estimer' });
    if (est.gratuit) zoneSolde.innerHTML = '🛠️ Compte gestionnaire KEKELI : génération non facturée.';
    else zoneSolde.innerHTML = `🪙 Crédits disponibles : <b>${est.disponible}</b> — une formation complète coûte <b>${est.cout} crédits</b>.
      ${est.ok ? '' : `<br><span style="color:var(--f-danger)">Crédits insuffisants : <a class="fk-link" href="credits-ia.html">rechargez vos crédits IA</a>.</span>`}`;
    if (est.configure === false) zoneSolde.innerHTML += '<br><span style="color:var(--f-danger)">⚠️ L\'IA n\'est pas encore configurée sur KEKELI.</span>';
  } catch (err) { zoneSolde.innerHTML = `<span style="color:var(--f-danger)">${e(err.message)}</span>`; }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(form);
    const nbM = Number(fd.get('nbModules')) || 4, nbL = Number(fd.get('leconsParModule')) || 3;
    if (est && !est.gratuit && est.ok === false) { fkToast(est.erreur || 'Crédits IA insuffisants : rechargez vos crédits IA.', 'erreur'); return; }
    if (est && !est.gratuit && !await fkConfirmer(`Générer cette formation (${nbM} modules × ${nbL} leçons) pour ${est.cout} crédits IA ? En cas d'échec du plan, les crédits vous sont rendus.`, 'Générer')) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = '⏳ Préparation du plan…';
    suivi.innerHTML = '<div class="fk-carte" style="margin-top:14px"><div class="fk-chargement">L\'IA prépare le plan de votre formation (environ une minute)…</div></div>';
    let plan;
    try {
      plan = await appel({ action: 'plan', sujet: fd.get('sujet'), public: fd.get('public'), niveau: fd.get('niveau'), nbModules: nbM, leconsParModule: nbL, consignes: fd.get('consignes') });
    } catch (err) {
      suivi.innerHTML = `<p class="fk-alerte fk-alerte-erreur" style="margin-top:14px">${e(err.message)}${/crédit/i.test(err.message) ? ' <a class="fk-link" href="credits-ia.html">🪙 Recharger</a>' : ''}</p>`;
      btn.disabled = false; btn.textContent = '🤖 Générer la formation';
      return;
    }
    form.hidden = true;
    zoneSolde.hidden = true;
    const lien = `formation.html?id=${plan.formationId}&onglet=programme`;
    suivi.innerHTML = `<div class="fk-carte" style="margin-top:14px">
        <h2 style="margin-top:0">📘 ${e(plan.titre)}</h2>
        <p style="color:var(--f-muted)">Plan prêt ! L'IA rédige maintenant les leçons, module par module. Restez sur cette page (1 à 2 minutes par module).</p>
        <div class="fk-progress" style="margin:10px 0"><span data-barre style="width:0%"></span></div>
        <ol class="fk-gen-modules">${plan.modules.map(m => `<li data-mod="${m.index}"><span data-etat>⏳</span> <b>${e(m.titre)}</b> <small>(${m.nbLecons} leçons)</small> <span data-action></span></li>`).join('')}</ol>
        <div class="fk-actions-form"><a class="fk-btn fk-btn-primary" href="${lien}" data-ouvrir>✏️ Ouvrir la formation dans l'éditeur</a></div>
      </div>`;
    const barre = suivi.querySelector('[data-barre]');
    let faits = 0;
    const majBarre = () => { barre.style.width = `${Math.round(faits * 100 / plan.modules.length)}%`; };
    const genererModule = async m => {
      const li = suivi.querySelector(`[data-mod="${m.index}"]`);
      li.querySelector('[data-etat]').textContent = '✍️';
      li.querySelector('[data-action]').innerHTML = '<small style="color:var(--f-muted)">rédaction en cours…</small>';
      try {
        await appel({ action: 'module', generationId: plan.generationId, index: m.index });
        li.querySelector('[data-etat]').textContent = '✅';
        li.querySelector('[data-action]').innerHTML = '';
        faits++; majBarre();
        if (faits === plan.modules.length) finir();
        return true;
      } catch (err) {
        li.querySelector('[data-etat]').textContent = '⚠️';
        li.querySelector('[data-action]').innerHTML = `<small style="color:var(--f-danger)">${e(err.message)}</small> <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-reessayer>🔄 Réessayer</button>`;
        li.querySelector('[data-reessayer]').addEventListener('click', () => genererModule(m));
        return false;
      }
    };
    function finir() {
      suivi.querySelector('.fk-carte p').innerHTML = '🎉 <b>Votre formation est prête !</b> Relisez chaque leçon, ajoutez vos touches personnelles, des quiz, un prix, puis soumettez-la à KEKELI depuis l\'onglet « Publication ».';
    }
    for (const m of plan.modules) await genererModule(m);
    if (faits < plan.modules.length) {
      suivi.querySelector('.fk-carte p').innerHTML = 'Certains modules n\'ont pas pu être rédigés : cliquez sur « Réessayer » (sans frais supplémentaires), ou rédigez ces leçons vous-même dans l\'éditeur.';
    }
  });
})();
