// Espace formateur — Mes crédits IA (pages/formations/formateur/credits-ia.html), 26 septembre 2026.
// Solde, essai gratuit, abonnement en cours, achat d'un pack ou d'un
// abonnement (FedaPay / KkiaPay via fkPayer), historique des mouvements.
// Tous les calculs et débits sont faits côté serveur (formation_ia_*).

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

  const [{ data: compte, error }, { data: mvts }] = await Promise.all([
    supabaseClient.rpc('formation_ia_mon_compte'),
    supabaseClient.from('formation_ia_mouvements').select('*').eq('formateur_id', s.profil.id).order('cree_le', { ascending: false }).limit(50)
  ]);
  if (error || !compte) {
    main.innerHTML = `<div class="fk-page"><div class="fk-container"><p class="fk-alerte fk-alerte-erreur">${e(fkMessageErreur(error))}</p></div></div>`;
    return;
  }
  const c = compte;
  const dispo = c.solde + c.credits_abonnement;
  const ligneMvt = m => {
    const total = m.credits + m.abonnement;
    const parts = [
      total ? `${total > 0 ? '+' : ''}${total} crédit(s)` : '',
      m.essai ? `${m.essai > 0 ? '+' : ''}${m.essai} question(s) d'essai` : ''
    ].filter(Boolean).join(' · ') || '—';
    const d = m.details || {};
    const info = m.type === 'usage_quiz' ? `${d.questions || ''} question(s)` : m.type === 'usage_formation' ? e(d.sujet || '') : m.type === 'ajustement' ? e(d.motif || '') : d.montant ? fcfa(d.montant) + (d.mode === 'test' ? ' (test)' : '') : '';
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
      <div class="fk-stats">
        <div class="fk-stat"><small>Crédits disponibles</small><strong>${dispo}</strong></div>
        <div class="fk-stat"><small>Questions d'essai offertes</small><strong>${c.essai_restant}</strong></div>
        <div class="fk-stat"><small>Abonnement</small><strong style="font-size:18px">${c.abonnement_fin ? `${c.credits_abonnement} crédit(s)<br><small>jusqu'au ${fkDate(c.abonnement_fin)}</small>` : 'Aucun'}</strong></div>
        <div class="fk-stat"><small>Crédits achetés (packs)</small><strong>${c.solde}</strong></div>
      </div>
      <div class="fk-alerte fk-alerte-info">💡 Tarifs : <b>${c.credits_par_question} crédit(s)</b> par question de quiz générée · <b>${c.credits_formation} crédits</b> pour une formation complète (plan + leçons rédigées).
        Les crédits de l'abonnement sont utilisés en premier et expirent à la fin de la période ; les crédits des packs n'expirent pas.
        En cas d'échec de l'IA, rien n'est décompté.</div>

      <section class="fk-carte" style="margin-top:18px">
        <h2>🛒 Packs de crédits</h2>
        ${(c.packs || []).length ? `<div class="fk-offres-ia">${c.packs.map(p => `<div class="fk-offre-ia">
            <h3>${e(p.nom)}</h3><div class="fk-offre-credits">${p.credits} crédits</div><div class="fk-offre-prix">${fcfa(p.prix)}</div>
            <small>≈ ${Math.floor(p.credits / Math.max(1, c.credits_formation))} formation(s) complète(s) ou ${Math.floor(p.credits / Math.max(1, c.credits_par_question))} questions</small>
            <button class="fk-btn fk-btn-primary fk-btn-bloc" data-pack="${p.id}">Acheter</button></div>`).join('')}</div>`
          : '<p class="fk-vide" style="padding:10px">Aucun pack disponible pour le moment.</p>'}
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>📅 Abonnement mensuel</h2>
        <p style="color:var(--f-muted);font-size:14px;margin-top:0">Un quota de crédits chaque mois, pour ceux qui créent régulièrement. Pas de prélèvement automatique : vous renouvelez quand vous voulez (la durée s'ajoute à la période en cours).</p>
        ${(c.offres || []).length ? `<div class="fk-offres-ia">${c.offres.map(o => `<div class="fk-offre-ia">
            <h3>${e(o.nom)}</h3><div class="fk-offre-credits">${o.credits_mensuels} crédits / ${o.duree_jours} jours</div><div class="fk-offre-prix">${fcfa(o.prix)}</div>
            <button class="fk-btn fk-btn-primary fk-btn-bloc" data-offre="${o.id}">${c.abonnement_fin ? 'Renouveler' : "S'abonner"}</button></div>`).join('')}</div>`
          : '<p class="fk-vide" style="padding:10px">Aucun abonnement proposé pour le moment.</p>'}
      </section>

      <section class="fk-carte" style="margin-top:18px">
        <h2>🧾 Historique</h2>
        ${(mvts || []).length ? `<div class="fk-table-wrap"><table class="fk-tableau-revenus"><thead><tr><th>Date</th><th>Opération</th><th>Détail</th><th class="n">Crédits</th></tr></thead>
          <tbody>${mvts.map(ligneMvt).join('')}</tbody></table></div>` : '<p class="fk-vide" style="padding:10px">Aucune opération pour le moment.</p>'}
      </section>
    </div></div>`;

  main.querySelectorAll('[data-pack]').forEach(b => b.addEventListener('click', () => {
    const p = c.packs.find(x => x.id === Number(b.dataset.pack));
    fkPayer({ titre: `Acheter « ${p.nom} »`, montant: fcfa(p.prix), note: `${p.credits} crédits IA, sans date d'expiration.`, corps: { objet: 'ia_pack', produitId: p.id } });
  }));
  main.querySelectorAll('[data-offre]').forEach(b => b.addEventListener('click', () => {
    const o = c.offres.find(x => x.id === Number(b.dataset.offre));
    fkPayer({ titre: `${c.abonnement_fin ? 'Renouveler' : 'Souscrire'} « ${o.nom} »`, montant: fcfa(o.prix), note: `${o.credits_mensuels} crédits IA pendant ${o.duree_jours} jours.`, corps: { objet: 'ia_abonnement', produitId: o.id } });
  }));
})();
