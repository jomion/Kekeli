// Espace formateur — Créer une formation avec l'IA (pages/formations/formateur/generer-ia.html),
// 26 septembre 2026. IA de KEKELI : Gemini puis ChatGPT (fonction serveur « formation-ia-generer »).
// Deux façons de générer (27 septembre 2026), selon le pack ou l'abonnement :
//  • « Module par module » (tous les packs et l'abonnement) : l'IA prépare le
//    plan (petit prix), puis le formateur choisit quand faire rédiger chaque
//    module (prix par module, débité au clic, rendu si l'IA échoue) ;
//  • « Formation complète d'un coup » (Pack Pro et abonnement mensuel) : un
//    prix unique, moins cher que la somme des modules ; l'IA rédige tout.
// La formation est créée en BROUILLON : le formateur la relit et la modifie
// dans l'éditeur habituel. Les générations inachevées se reprennent ici.

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
      let code = '';
      try { const j = await error.context.json(); if (j && j.error) { msg = j.error; code = j.code || ''; } } catch (_e) { /* réponse non JSON */ }
      const err = new Error(msg); err.code = code; throw err;
    }
    if (data && data.error) { const err = new Error(data.error); err.code = data.code || ''; throw err; }
    return data;
  };

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container" style="max-width:860px">
      <a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a>
      <h1 class="fk-titre-page" style="margin-top:10px">🤖 Créer une formation avec l'IA</h1>
      <p class="fk-sous-titre">Décrivez votre formation : l'IA de KEKELI prépare le plan puis rédige les leçons. Vous relisez et modifiez tout ensuite, avant de la soumettre à KEKELI.</p>
      <div class="fk-ia-solde" data-solde>Chargement de vos crédits IA…</div>
      <div id="reprendre"></div>
      <form class="fk-carte" id="formGen" style="margin-top:14px">
        <label class="fk-champ"><span>Sujet de la formation *</span><input type="text" name="sujet" required minlength="5" maxlength="300" placeholder="Ex. Gérer son budget personnel et épargner avec un petit salaire"></label>
        <label class="fk-champ"><span>Public visé</span><input type="text" name="public" maxlength="300" placeholder="Ex. jeunes salariés, commerçants, enseignants débutants…"></label>
        <div class="fk-grille-3">
          <label class="fk-champ"><span>Niveau</span><select name="niveau">${Object.entries(FK_NIVEAUX).map(([k, v]) => `<option value="${k}" ${k === 'debutant' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="fk-champ"><span>Nombre de modules</span><input type="number" name="nbModules" min="2" max="8" value="4"></label>
          <label class="fk-champ"><span>Leçons par module</span><input type="number" name="leconsParModule" min="2" max="6" value="3"></label>
        </div>
        <label class="fk-champ"><span>Consignes pour l'IA (facultatif)</span><textarea name="consignes" maxlength="1500" style="min-height:80px" placeholder="Ex. ton motivant, exemples au Bénin et au Togo, montants en FCFA, une étude de cas par module…"></textarea></label>
        <fieldset class="fk-modes-gen" data-modes><legend>Comment générer ?</legend><div class="fk-chargement">…</div></fieldset>
        <div class="fk-actions-form"><a class="fk-btn fk-btn-ghost" href="credits-ia.html">🪙 Mes crédits IA</a><button class="fk-btn fk-btn-primary" type="submit">🤖 Générer</button></div>
      </form>
      <div id="suivi"></div>
    </div></div>`;

  const zoneSolde = main.querySelector('[data-solde]');
  const zoneModes = main.querySelector('[data-modes]');
  const form = document.getElementById('formGen');
  const suivi = document.getElementById('suivi');
  const btnGen = form.querySelector('[type=submit]');
  let est = null;

  const coutTotalModule = () => {
    const nbM = Number(form.nbModules.value) || 4;
    return est ? est.coutPlan + nbM * est.coutModule : 0;
  };
  function dessinerModes() {
    if (!est) return;
    const nbM = Number(form.nbModules.value) || 4;
    const gratuit = est.gratuit;
    const prix = n => gratuit ? 'non facturé' : `${n} crédits`;
    const economie = coutTotalModule() - est.coutComplet;
    const choisi = (form.querySelector('[name=mode]:checked') || {}).value || (est.complet ? 'complet' : 'module');
    zoneModes.innerHTML = `<legend>Comment générer ?</legend>
      <label class="fk-mode-gen ${est.module ? '' : 'fk-outil-verrou'}">
        <input type="radio" name="mode" value="module" ${choisi === 'module' || !est.complet ? 'checked' : ''} ${est.module ? '' : 'disabled'}>
        <span><b>🧩 Module par module</b> <small class="fk-offre-niveau">Tous les packs et l'abonnement</small><br>
        Plan : <b>${prix(est.coutPlan)}</b>, puis <b>${prix(est.coutModule)}</b> par module, quand vous le décidez.
        ${gratuit ? '' : `<small>(${nbM} modules = ${coutTotalModule()} crédits au total)</small>`}
        ${est.module ? '' : '<br>🔒 <a class="fk-link" href="credits-ia.html#offres">Choisissez un pack pour l\'activer</a>'}</span></label>
      <label class="fk-mode-gen ${est.complet ? '' : 'fk-outil-verrou'}">
        <input type="radio" name="mode" value="complet" ${choisi === 'complet' && est.complet ? 'checked' : ''} ${est.complet ? '' : 'disabled'}>
        <span><b>⚡ Formation complète d'un coup</b> <small class="fk-offre-niveau">Pack Pro et abonnement mensuel</small><br>
        Plan et toutes les leçons rédigés automatiquement : <b>${prix(est.coutComplet)}</b> pour toute la formation.
        ${!gratuit && economie > 0 ? `<span class="fk-bonus">Vous économisez ${economie} crédits</span>` : ''}
        ${est.complet ? '' : '<br>🔒 <a class="fk-link" href="credits-ia.html#offres">Passez au Pack Pro ou à l\'abonnement</a>'}</span></label>`;
    btnGen.disabled = !est.module && !est.complet;
  }
  form.nbModules.addEventListener('input', dessinerModes);

  try {
    est = await appel({ action: 'estimer' });
    if (est.gratuit) zoneSolde.innerHTML = '🛠️ Compte gestionnaire KEKELI : génération non facturée, tous les modes disponibles.';
    else zoneSolde.innerHTML = `🪙 Crédits disponibles : <b>${est.disponible}</b> <a class="fk-link" href="credits-ia.html">Recharger</a>`;
    if (est.configure === false) zoneSolde.innerHTML += '<br><span style="color:var(--f-danger)">⚠️ L\'IA n\'est pas encore configurée sur KEKELI.</span>';
    dessinerModes();
  } catch (err) { zoneSolde.innerHTML = `<span style="color:var(--f-danger)">${e(err.message)}</span>`; zoneModes.hidden = true; }

  // Générations inachevées (surtout en mode module par module) : reprise.
  try {
    const { generations } = await appel({ action: 'en_cours' });
    if (generations && generations.length) {
      const zone = document.getElementById('reprendre');
      zone.innerHTML = `<div class="fk-carte" style="margin-top:14px"><h2 style="margin-top:0;font-size:18px">⏯️ Formations à terminer</h2>
        ${generations.map(g => `<div class="fk-reprise"><span><b>${e(g.titre || 'Formation')}</b> <small>${g.modules.filter(m => m.fait).length}/${g.modules.length} modules rédigés · ${g.mode === 'module' ? '🧩 module par module' : '⚡ complète'}</small></span>
          <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-reprendre="${g.id}">Continuer</button></div>`).join('')}</div>`;
      zone.querySelectorAll('[data-reprendre]').forEach(b => b.addEventListener('click', () => {
        const g = generations.find(x => String(x.id) === b.dataset.reprendre);
        form.hidden = true; zone.hidden = true;
        afficherSuivi({ generationId: g.id, formationId: g.formationId, titre: g.titre, mode: g.mode, coutModule: est && !est.gratuit ? est.coutModule : 0, modules: g.modules });
      }));
    }
  } catch (_e) { /* pas bloquant */ }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(form);
    const mode = fd.get('mode');
    if (!mode) { fkToast('Choisissez comment générer la formation.', 'erreur'); return; }
    const nbM = Number(fd.get('nbModules')) || 4, nbL = Number(fd.get('leconsParModule')) || 3;
    if (est && !est.gratuit) {
      const cout = mode === 'complet' ? est.coutComplet : est.coutPlan;
      if (cout > est.disponible) { fkToast(`Crédits IA insuffisants : il faut ${cout} crédits, vous en avez ${est.disponible}.`, 'erreur'); return; }
      const texte = mode === 'complet'
        ? `Générer toute la formation (${nbM} modules × ${nbL} leçons) pour ${est.coutComplet} crédits IA ? En cas d'échec du plan, les crédits vous sont rendus.`
        : `Préparer le plan (${nbM} modules × ${nbL} leçons) pour ${est.coutPlan} crédits IA ? Ensuite, chaque module rédigé coûtera ${est.coutModule} crédits, seulement quand vous le demanderez.`;
      if (!await fkConfirmer(texte, 'Générer')) return;
    }
    btnGen.disabled = true; btnGen.textContent = '⏳ Préparation du plan…';
    suivi.innerHTML = '<div class="fk-carte" style="margin-top:14px"><div class="fk-chargement">L\'IA prépare le plan de votre formation (environ une minute)…</div></div>';
    let plan;
    try {
      plan = await appel({ action: 'plan', mode, sujet: fd.get('sujet'), public: fd.get('public'), niveau: fd.get('niveau'), nbModules: nbM, leconsParModule: nbL, consignes: fd.get('consignes') });
    } catch (err) {
      suivi.innerHTML = `<p class="fk-alerte fk-alerte-erreur" style="margin-top:14px">${e(err.message)}${/crédit/i.test(err.message) || err.code === 'NIVEAU' ? ' <a class="fk-link" href="credits-ia.html#offres">🪙 Voir les offres</a>' : ''}</p>`;
      btnGen.disabled = false; btnGen.textContent = '🤖 Générer';
      return;
    }
    form.hidden = true;
    document.getElementById('reprendre').hidden = true;
    afficherSuivi(plan);
  });

  // Affiche le suivi des modules : mode complet = rédaction automatique de
  // tous les modules ; module par module = un bouton par module (payé au clic).
  function afficherSuivi(plan) {
    zoneSolde.hidden = plan.mode !== 'module';
    const lien = `formation.html?id=${plan.formationId}&onglet=programme`;
    const parModule = plan.mode === 'module';
    let faits = plan.modules.filter(m => m.fait).length;
    suivi.innerHTML = `<div class="fk-carte" style="margin-top:14px">
        <h2 style="margin-top:0">📘 ${e(plan.titre || 'Formation')}</h2>
        <p style="color:var(--f-muted)" data-msg>${parModule
          ? `Plan prêt ! Faites rédiger les modules un par un, quand vous voulez${plan.coutModule ? ` (${plan.coutModule} crédits par module, rendus si l'IA échoue)` : ''}. Vous pouvez aussi revenir plus tard : la formation est enregistrée en brouillon.`
          : 'Plan prêt ! L\'IA rédige maintenant les leçons, module par module. Restez sur cette page (1 à 2 minutes par module).'}</p>
        <div class="fk-progress" style="margin:10px 0"><span data-barre style="width:0%"></span></div>
        <ol class="fk-gen-modules">${plan.modules.map(m => `<li data-mod="${m.index}"><span data-etat>${m.fait ? '✅' : parModule ? '📝' : '⏳'}</span> <b>${e(m.titre)}</b> <small>(${m.nbLecons} leçons)</small> <span data-action></span></li>`).join('')}</ol>
        <div class="fk-actions-form"><a class="fk-btn fk-btn-primary" href="${lien}" data-ouvrir>✏️ Ouvrir la formation dans l'éditeur</a></div>
      </div>`;
    const barre = suivi.querySelector('[data-barre]');
    const msg = suivi.querySelector('[data-msg]');
    const majBarre = () => { barre.style.width = `${Math.round(faits * 100 / plan.modules.length)}%`; };
    majBarre();
    const boutonModule = (li, m) => {
      li.querySelector('[data-action]').innerHTML = `<button type="button" class="fk-btn fk-btn-primary fk-btn-petit" data-rediger>✍️ Rédiger ce module${plan.coutModule ? ` (${plan.coutModule} crédits)` : ''}</button>`;
      li.querySelector('[data-rediger]').addEventListener('click', async () => {
        if (plan.coutModule && !await fkConfirmer(`Faire rédiger le module « ${m.titre} » pour ${plan.coutModule} crédits IA ?`, 'Rédiger')) return;
        genererModule(m);
      });
    };
    const genererModule = async m => {
      const li = suivi.querySelector(`[data-mod="${m.index}"]`);
      li.querySelector('[data-etat]').textContent = '✍️';
      li.querySelector('[data-action]').innerHTML = '<small style="color:var(--f-muted)">rédaction en cours (1 à 2 minutes)…</small>';
      suivi.querySelectorAll('[data-rediger]').forEach(b => { b.disabled = true; });
      try {
        await appel({ action: 'module', generationId: plan.generationId, index: m.index });
        m.fait = true;
        li.querySelector('[data-etat]').textContent = '✅';
        li.querySelector('[data-action]').innerHTML = '';
        faits++; majBarre();
        if (parModule && est && !est.gratuit) { est.disponible -= plan.coutModule; zoneSolde.innerHTML = `🪙 Crédits disponibles : <b>${est.disponible}</b> <a class="fk-link" href="credits-ia.html">Recharger</a>`; }
        if (faits === plan.modules.length) finir();
        return true;
      } catch (err) {
        li.querySelector('[data-etat]').textContent = '⚠️';
        li.querySelector('[data-action]').innerHTML = `<small style="color:var(--f-danger)">${e(err.message)}</small> <button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-reessayer>🔄 Réessayer</button>
          ${err.code === 'CREDITS' ? ' <a class="fk-link" href="credits-ia.html">🪙 Recharger</a>' : ''}`;
        li.querySelector('[data-reessayer]').addEventListener('click', () => genererModule(m));
        return false;
      } finally {
        suivi.querySelectorAll('[data-rediger]').forEach(b => { b.disabled = false; });
      }
    };
    function finir() {
      msg.innerHTML = '🎉 <b>Votre formation est prête !</b> Relisez chaque leçon, ajoutez vos touches personnelles, des quiz, un prix, puis soumettez-la à KEKELI depuis l\'onglet « Publication ».';
    }
    if (faits === plan.modules.length) { finir(); return; }
    if (parModule) {
      plan.modules.filter(m => !m.fait).forEach(m => boutonModule(suivi.querySelector(`[data-mod="${m.index}"]`), m));
      return;
    }
    (async () => {
      for (const m of plan.modules.filter(x => !x.fait)) await genererModule(m);
      if (faits < plan.modules.length) msg.innerHTML = 'Certains modules n\'ont pas pu être rédigés : cliquez sur « Réessayer » (sans frais supplémentaires), ou rédigez ces leçons vous-même dans l\'éditeur.';
    })();
  }
})();
