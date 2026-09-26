// Espace formateur — Mes crédits IA (pages/formations/formateur/credits-ia.html), 26 septembre 2026.
// Solde, essai gratuit, abonnement en cours, achat d'un pack ou d'un
// abonnement (FedaPay / KkiaPay via fkPayer), historique des mouvements.
// Tous les calculs et débits sont faits côté serveur (formation_ia_*).
// 26 septembre 2026 : avantages des packs / de l'abonnement (niveaux Plus,
// Pro, Premium), bonus de crédits, prix de lancement, parrainage.

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('formateur');
  const main = document.getElementById('fkContenu');
  const e = fkEchapper;
  const fcfa = n => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
  const LIB = {
    achat_pack: '🛒 Achat de pack', abonnement: '📅 Abonnement', usage_quiz: '🧠 Questions de quiz',
    usage_formation: '🤖 Formation générée', remboursement: '↩️ Remboursement', ajustement: '🛠️ Ajustement KEKELI'
  };

  // Parrainage : lien ?parrain=CODE reçu d'un autre formateur.
  const codeParrain = fkParam('parrain');
  if (codeParrain) {
    const { data: rp } = await supabaseClient.rpc('formation_ia_definir_parrain', { p_code: codeParrain });
    if (rp && rp.ok && !rp.deja) fkToast('🎁 Parrainage enregistré : vous recevrez des crédits offerts à votre premier achat.', 'succes');
    else if (rp && !rp.ok && rp.erreur) fkToast(rp.erreur, 'erreur');
  }

  const [{ data: compte, error }, { data: mvts }] = await Promise.all([
    supabaseClient.rpc('formation_ia_mon_compte'),
    supabaseClient.from('formation_ia_mouvements').select('*').eq('formateur_id', s.profil.id).order('cree_le', { ascending: false }).limit(50)
  ]);
  if (error || !compte) {
  main.innerHTML = `<div class="fk-page"><div class="fk-container"><p class="fk-alerte fk-alerte-erreur">${e(fkMessageErreur(error))}</p></div></div>`;
    return;
  }
  const c = compte;
  const N = FK_NIVEAUX_AVANTAGES;
  const com = c.commissions || [15, 13, 12, 10];
  const AVANTAGES = [
    [1, '💸', `Commission KEKELI réduite sur vos ventes`, n => `${String(com[n]).replace('.', ',')} %`],
    [1, '🏷️', 'Codes promo pour vos formations'],
    [1, '✍️', 'IA : texte de vente + messages WhatsApp / Facebook'],
    [1, '🔤', "IA : correction de l'orthographe et du style"],
    [1, '📌', 'IA : résumé automatique des leçons'],
    [1, '🧩', `IA : créer une formation module par module (${c.credits_plan} crédits le plan + ${c.credits_module} par module)`],
    [3, '⚡', `IA : formation complète générée d'un coup (${c.credits_formation} crédits, moins cher)`, n => {
      const liste = [...(c.packs || []).filter(p => p.niveau === n), ...(c.offres || []).filter(o => o.niveau === n)];
      const avec = liste.filter(x => x.generation_complete);
      if (!liste.length || !avec.length) return '—';
      return avec.length === liste.length ? '✅' : `✅ <small>${e(avec.map(x => x.nom).join(', '))}</small>`;
    }],
    [2, '✨', 'Badge Pro et mise en avant dans le catalogue'],
    [2, '📈', 'Statistiques avancées (décrochage, réussite)'],
    [2, '🧭', 'IA : tests en leçon générés automatiquement'],
    [2, '🎞️', "IA : diaporama créé à partir d'une leçon"],
    [2, '🎓', 'Certificats personnalisés (logo, signature)'],
    [3, '📣', 'Messages groupés à vos apprenants'],
    [3, '🔁', 'Crédits du mois non utilisés reportés 30 jours'],
    [3, '⚡', 'Validation prioritaire de vos formations']
  ];
  const niveauActuel = Number(c.niveau) || 0;
  const cellule = (a, n) => a[3] ? `<td class="c">${n || a[0] === 1 ? a[3](n) : '—'}</td>` : `<td class="c">${n >= a[0] ? '✅' : '—'}</td>`;
  const offresDuNiveau = n => [...(c.packs || []).filter(p => p.niveau === n).map(p => p.nom), ...(c.offres || []).filter(o => o.niveau === n).map(o => o.nom)];
  const prixHtml = x => x.prix_lancement ? `<s style="color:var(--f-muted);font-weight:400;font-size:14px">${fcfa(x.prix)}</s> ${fcfa(x.prix_lancement)}<br><small class="fk-lancement">🚀 Prix de lancement — ${x.places_lancement} place(s) restante(s)</small>` : fcfa(x.prix);
  const avantagesHtml = (niveau, jours) => niveau ? `<div class="fk-offre-niveau">${N[niveau].icone} Avantages <b>${N[niveau].nom}</b>${jours ? ` pendant ${jours} jours` : ''}</div>` : '';
  const lienParrain = `${new URL('credits-ia.html', window.location.href).toString().split('?')[0]}?parrain=${encodeURIComponent(c.code_parrain || '')}`;

  const dispo = c.solde + c.credits_abonnement;
  const ligneMvt = m => {
    const total = m.credits + m.abonnement;
    const parts = [
      total ? `${total > 0 ? '+' : ''}${total} crédit(s)` : '',
      m.essai ? `${m.essai > 0 ? '+' : ''}${m.essai} question(s) d'essai` : ''
    ].filter(Boolean).join(' · ') || '—';
    const d = m.details || {};
    const info = m.type === 'usage_quiz' ? `${d.questions || ''} question(s)` : m.type === 'usage_formation' ? e(d.sujet ? `${d.mode === 'module' ? '🧩 Plan : ' : '⚡ '}${d.sujet}` : d.module ? `🧩 Module ${d.module} : ${d.titre || ''}` : '') : m.type === 'ajustement' ? e(d.motif || '') : d.montant ? fcfa(d.montant) + (d.mode === 'test' ? ' (test)' : '') : '';
    return `<tr><td>${fkDate(m.cree_le)}</td><td>${LIB[m.type] || e(m.type)}${d.rembourse ? ' <small>(remboursé)</small>' : ''}</td><td>${info}</td><td class="n ${total + m.essai < 0 ? 'neg' : 'pos'}">${parts}</td></tr>`;
  };

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a>
      <div class="fk-section-head" style="margin-top:10px">
        <div><h1 class="fk-titre-page">🪙 Mes crédits IA</h1>
          <p>Générez des questions de quiz et des formations complètes avec l'IA de KEKELI.</p></div>
        <a class="fk-btn fk-btn-primary" href="generer-ia.html">🤖 Créer une formation avec l'IA</a>
      </div>
      ${c.actif === false ? '<p class="fk-alerte fk-alerte-attention">La génération par IA est momentanément désactivée par KEKELI.</p>' : ''}
      <div class="fk-niveau-actuel fk-niveau-${niveauActuel}">
        ${niveauActuel ? `<b>${N[niveauActuel].icone} Vous êtes ${N[niveauActuel].nom}</b> jusqu'au ${fkDate(c.avantages_fin)} — commission KEKELI de ${String(com[niveauActuel]).replace('.', ',')} % sur vos ventes.${c.generation_complete_fin ? ` ⚡ Génération complète jusqu'au ${fkDate(c.generation_complete_fin)}.` : ''}`
          : `Vous êtes au niveau <b>Standard</b> (commission ${String(com[0]).replace('.', ',')} %). Un pack ou l'abonnement débloque des avantages pour vendre plus et gagner plus.`}
      </div>
      <div class="fk-stats">
        <div class="fk-stat"><small>Crédits disponibles</small><strong>${dispo}</strong></div>
        <div class="fk-stat"><small>Questions d'essai offertes</small><strong>${c.essai_restant}</strong></div>
        <div class="fk-stat"><small>Abonnement</small><strong style="font-size:18px">${c.abonnement_fin ? `${c.credits_abonnement} crédit(s)<br><small>jusqu'au ${fkDate(c.abonnement_fin)}</small>` : 'Aucun'}</strong></div>
        <div class="fk-stat"><small>Crédits achetés (packs)</small><strong>${c.solde}</strong></div>
      </div>
      <div class="fk-alerte fk-alerte-info">💡 Tarifs : <b>${c.credits_par_question} crédit(s)</b> par question de quiz générée · formation <b>module par module</b> : ${c.credits_plan} crédits le plan puis ${c.credits_module} par module rédigé ·
        formation <b>complète d'un coup</b> (Pack Pro et abonnement) : ${c.credits_formation} crédits.
        Les crédits de l'abonnement sont utilisés en premier et expirent à la fin de la période ; les crédits des packs n'expirent pas.
        En cas d'échec de l'IA, rien n'est décompté.</div>

      <section class="fk-carte" style="margin-top:18px" id="offres">
        <h2>🎁 Les avantages inclus</h2>
        <div class="fk-table-wrap"><table class="fk-tableau-avantages">
          <thead><tr><th></th>${[0, 1, 2, 3].map(n => `<th class="c${n === niveauActuel ? ' actuel' : ''}">${n ? `${N[n].icone} ${N[n].nom}` : 'Standard'}<br><small>${n ? e(offresDuNiveau(n).join(' · ') || '—') : 'gratuit'}</small></th>`).join('')}</tr></thead>
          <tbody>${AVANTAGES.map(a => `<tr><td>${a[1]} ${e(a[2])}</td>${[0, 1, 2, 3].map(n => cellule(a, n)).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p style="font-size:13px;color:var(--f-muted);margin-bottom:0">Les avantages commencent dès le paiement confirmé. Un achat de même niveau prolonge la durée ; un niveau inférieur ne vous fait jamais redescendre.</p>
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>🛒 Packs de crédits</h2>
        ${(c.packs || []).length ? `<div class="fk-offres-ia">${c.packs.map(p => `<div class="fk-offre-ia">
            <h3>${e(p.nom)}</h3><div class="fk-offre-credits">${p.credits} crédits${p.bonus_credits ? ` <span class="fk-bonus">+${p.bonus_credits} offerts</span>` : ''}</div><div class="fk-offre-prix">${prixHtml(p)}</div>
            ${avantagesHtml(p.niveau, p.duree_avantages_jours)}
            ${p.generation_complete ? '<div class="fk-offre-niveau">⚡ Génération complète d\'une formation incluse</div>' : '<div class="fk-offre-niveau">🧩 Génération module par module</div>'}
            <small>≈ ${Math.floor((p.credits + (p.bonus_credits || 0)) / Math.max(1, c.credits_module))} modules rédigés ou ${Math.floor(p.credits / Math.max(1, c.credits_par_question))} questions</small>
            <button class="fk-btn fk-btn-primary fk-btn-bloc" data-pack="${p.id}">Acheter</button></div>`).join('')}</div>`
          : '<p class="fk-vide" style="padding:10px">Aucun pack disponible pour le moment.</p>'}
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>📅 Abonnement mensuel</h2>
        <p style="color:var(--f-muted);font-size:14px;margin-top:0">Un quota de crédits chaque mois, pour ceux qui créent régulièrement. Pas de prélèvement automatique : vous renouvelez quand vous voulez (la durée s'ajoute à la période en cours).</p>
        ${(c.offres || []).length ? `<div class="fk-offres-ia">${c.offres.map(o => `<div class="fk-offre-ia">
            <h3>${e(o.nom)}</h3><div class="fk-offre-credits">${o.credits_mensuels} crédits / ${o.duree_jours} jours${o.bonus_credits ? ` <span class="fk-bonus">+${o.bonus_credits} offerts</span>` : ''}</div><div class="fk-offre-prix">${prixHtml(o)}</div>
            ${avantagesHtml(o.niveau, o.duree_jours)}
            ${o.generation_complete ? '<div class="fk-offre-niveau">⚡ Génération complète d\'une formation incluse</div>' : ''}
            <button class="fk-btn fk-btn-primary fk-btn-bloc" data-offre="${o.id}">${c.abonnement_fin ? 'Renouveler' : "S'abonner"}</button></div>`).join('')}</div>`
          : '<p class="fk-vide" style="padding:10px">Aucun abonnement proposé pour le moment.</p>'}
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>🤝 Parrainez un formateur</h2>
        <p style="margin-top:0">Partagez votre lien : quand un formateur fait son premier achat de crédits, vous recevez <b>${c.bonus_parrain} crédits</b> et lui <b>${c.bonus_filleul} crédits</b> offerts.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="fk-input" readonly value="${e(lienParrain)}" style="flex:1;min-width:240px" data-lien-parrain>
          <button type="button" class="fk-btn fk-btn-outline" data-copier-parrain>📋 Copier</button>
          <a class="fk-btn fk-btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Rejoins-moi sur KEKELI Formation pour créer et vendre tes formations en ligne ! Avec ce lien, tu reçois ${c.bonus_filleul} crédits IA offerts : ${lienParrain}`)}">💬 WhatsApp</a></div>
        <small style="color:var(--f-muted)">Votre code : <b>${e(c.code_parrain || '')}</b></small>
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>🧾 Historique</h2>
        ${(mvts || []).length ? `<div class="fk-table-wrap"><table class="fk-tableau-revenus"><thead><tr><th>Date</th><th>Opération</th><th>Détail</th><th class="n">Crédits</th></tr></thead>
          <tbody>${mvts.map(ligneMvt).join('')}</tbody></table></div>` : '<p class="fk-vide" style="padding:10px">Aucune opération pour le moment.</p>'}
      </section>
    </div></div>`;

  main.querySelectorAll('[data-pack]').forEach(b => b.addEventListener('click', () => {
    const p = c.packs.find(x => x.id === Number(b.dataset.pack));
    fkPayer({ titre: `Acheter « ${p.nom} »`, montant: fcfa(p.prix_lancement || p.prix),
      note: `${p.credits + (p.bonus_credits || 0)} crédits IA, sans date d'expiration${p.niveau ? ` + avantages ${N[p.niveau].nom} pendant ${p.duree_avantages_jours} jours` : ''}${p.generation_complete ? ' + génération complète de formations' : ''}.`,
      corps: { objet: 'ia_pack', produitId: p.id } });
  }));
  main.querySelectorAll('[data-offre]').forEach(b => b.addEventListener('click', () => {
    const o = c.offres.find(x => x.id === Number(b.dataset.offre));
    fkPayer({ titre: `${c.abonnement_fin ? 'Renouveler' : 'Souscrire'} « ${o.nom} »`, montant: fcfa(o.prix_lancement || o.prix),
      note: `${o.credits_mensuels} crédits IA pendant ${o.duree_jours} jours${o.bonus_credits ? ` + ${o.bonus_credits} crédits offerts` : ''}${o.niveau ? ` + avantages ${N[o.niveau].nom}` : ''}.`,
      corps: { objet: 'ia_abonnement', produitId: o.id } });
  }));
  const btnCopier = main.querySelector('[data-copier-parrain]');
  if (btnCopier) btnCopier.addEventListener('click', async () => {
    const champ = main.querySelector('[data-lien-parrain]');
    try { await navigator.clipboard.writeText(champ.value); } catch (_e) { champ.select(); document.execCommand('copy'); }
    fkToast('Lien copié !', 'succes');
  });
  if (location.hash === '#offres') document.getElementById('offres')?.scrollIntoView();
})();
