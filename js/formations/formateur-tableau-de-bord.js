// Espace formateur — tableau de bord (pages/formations/formateur/tableau-de-bord.html).
// Réservé aux formateurs validés (sinon renvoi vers « Devenir formateur »).

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('formateur');
  const main = document.getElementById('fkContenu');
  if (!s.formateur || s.formateur.statut !== 'valide') {
    main.innerHTML = `<div class="fk-page"><div class="fk-container"><div class="fk-carte fk-vide"><span class="fk-vide-icone">👨‍🏫</span>
      ${s.formateur ? `Votre profil formateur est « ${FK_STATUTS_FORMATEUR[s.formateur.statut]} ».` : "Vous n'êtes pas encore formateur."}<br>
      <a class="fk-link" href="${FK_BASE}devenir-formateur.html">Voir ma candidature →</a></div></div></div>`;
    return;
  }

  const [{ data: formations }, { data: categories }, { data: revenus }, { data: parPaiement }, { data: comFormateur }, { data: nivFormateur }, { data: compteIA }] = await Promise.all([
    supabaseClient.from('formations').select('id, slug, titre, statut, prix, devise, nb_lecons, nb_inscrits, note_moyenne, nb_avis, duree_minutes, motif_refus, maj_le, image_couverture, formation_categories(nom, icone)')
      .eq('formateur_id', s.profil.id).order('maj_le', { ascending: false }),
    supabaseClient.from('formation_categories').select('id, nom, parent_id').eq('statut', 'actif').order('position'),
    supabaseClient.rpc('formation_revenus_formateur'),
    supabaseClient.from('formation_parametres_paiement').select('commission_pct').eq('id', 1).maybeSingle(),
    supabaseClient.rpc('formation_commission_formateur', { p_id: s.profil.id }),
    supabaseClient.rpc('formation_niveau_formateur', { p_id: s.profil.id }),
    supabaseClient.rpc('formation_ia_mon_compte')
  ]);
  const titreFo = fkTitreFormateur(compteIA || { niveau: Number(nivFormateur) || 0 });
  const niveauFo = Number(nivFormateur) || 0;
  const NA = FK_NIVEAUX_AVANTAGES;
  const ventes = (revenus || []).filter(r => Number(r.nb_ventes) || Number(r.nb_ventes_test));
  const commission = Number(comFormateur ?? parPaiement?.commission_pct ?? 15);
  const totalFormateur = ventes.reduce((t, r) => t + Number(r.part_formateur || 0), 0);
  const nbVentes = ventes.reduce((t, r) => t + Number(r.nb_ventes || 0), 0);
  const nbTests = ventes.reduce((t, r) => t + Number(r.nb_ventes_test || 0), 0);
  const fcfa = n => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
  const liste = formations || [];
  const publiees = liste.filter(f => f.statut === 'publiee');
  const apprenants = liste.reduce((t, f) => t + f.nb_inscrits, 0);
  const notees = liste.filter(f => f.nb_avis);
  const moyenne = notees.length ? notees.reduce((t, f) => t + Number(f.note_moyenne) * f.nb_avis, 0) / notees.reduce((t, f) => t + f.nb_avis, 0) : null;

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <div class="fk-section-head">
        <div><h1 class="fk-titre-page">Bonjour ${fkEchapper(s.profil.prenom)} 👋</h1><p>Votre espace formateur KEKELI.</p></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="fk-btn fk-btn-ghost" href="profil.html">🪪 Mon profil formateur</a>
          <a class="fk-btn fk-btn-ghost" href="${FK_BASE}formateur.html?slug=${encodeURIComponent(s.formateur.slug)}">👁️ Profil public</a>
          <a class="fk-btn fk-btn-ghost" href="credits-ia.html">🪙 Crédits IA</a>
          <a class="fk-btn fk-btn-outline" href="generer-ia.html">🤖 Génération IA</a>
          <button class="fk-btn fk-btn-primary" id="btnNouvelle">＋ Nouvelle formation</button>
        </div>
      </div>
      <div class="fk-niveau-actuel fk-niveau-${niveauFo}">
        ${`<span><b>${fkEchapper(titreFo.icone)} ${fkEchapper(titreFo.titre)}</b>${compteIA && compteIA.pack_actif ? ` (${fkEchapper(compteIA.pack_actif.nom)})` : !niveauFo ? ' (Pack Gratuit)' : ''} — commission KEKELI de <b>${String(commission).replace('.', ',')} %</b>${compteIA && compteIA.acces_offert ? (compteIA.acces_offert_fin ? ` jusqu'au ${fkDate(compteIA.acces_offert_fin)}` : '') : niveauFo && compteIA && compteIA.avantages_fin ? ` jusqu'au ${fkDate(compteIA.avantages_fin)}` : ''}.${niveauFo ? '' : ' Un pack payant réduit la commission et débloque codes promo, assistance IA, mise en forme avancée, statistiques, certificats personnalisés…'}</span>`}
        <a class="fk-btn fk-btn-ghost fk-btn-petit" href="credits-ia.html#offres">${niveauFo >= 3 ? 'Mes avantages' : '🎁 Voir les avantages'}</a>
      </div>
      <div class="fk-stats">
        <div class="fk-stat"><small>Formations</small><strong>${liste.length}</strong></div>
        <div class="fk-stat"><small>Publiées</small><strong>${publiees.length}</strong></div>
        <div class="fk-stat"><small>Apprenants inscrits</small><strong>${apprenants}</strong></div>
        <div class="fk-stat"><small>Mes revenus</small><strong>${fcfa(totalFormateur)}</strong></div>
        <div class="fk-stat"><small>Note moyenne</small><strong>${moyenne ? moyenne.toFixed(1).replace('.', ',') + ' ★' : '—'}</strong></div>
      </div>
      <div class="fk-alerte fk-alerte-info">💡 Parcours : créez votre formation → ajoutez modules, leçons et quiz → soumettez-la. L'équipe KEKELI la vérifie avant publication.</div>
      <section class="fk-carte">
        <h2>Mes formations</h2>
        ${liste.length ? `<div class="fk-table-wrap"><table class="fk-table">
          <thead><tr><th>Formation</th><th>Statut</th><th>Leçons</th><th>Apprenants</th><th>Note</th><th>Prix</th><th></th></tr></thead>
          <tbody>${liste.map(f => `<tr>
            <td><b>${fkEchapper(f.titre)}</b><br><small style="color:var(--f-muted)">${fkEchapper(f.formation_categories?.nom || 'Sans catégorie')} · modifiée le ${fkDate(f.maj_le)}</small>
              ${f.statut === 'refusee' && f.motif_refus ? `<br><small style="color:var(--f-danger)">Motif : ${fkEchapper(f.motif_refus)}</small>` : ''}</td>
            <td><span class="fk-pastille ${f.statut}">${FK_STATUTS_FORMATION[f.statut]}</span></td>
            <td>${f.nb_lecons}</td><td>${f.nb_inscrits}</td>
            <td>${f.nb_avis ? `${Number(f.note_moyenne).toFixed(1)} ★ (${f.nb_avis})` : '—'}</td>
            <td>${fkPrix(f.prix, f.devise)}</td>
            <td style="white-space:nowrap"><a class="fk-btn fk-btn-primary fk-btn-petit" href="formation.html?id=${f.id}">Gérer</a>
              <a class="fk-btn fk-btn-ghost fk-btn-petit" href="${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}" title="Voir la fiche">👁️</a></td>
          </tr>`).join('')}</tbody></table></div>`
        : `<div class="fk-vide"><span class="fk-vide-icone">🌱</span>Vous n'avez pas encore de formation.<br><button class="fk-btn fk-btn-primary" style="margin-top:12px" data-nouvelle>Créer ma première formation</button></div>`}
      </section>
      <section class="fk-carte" id="revenus" style="margin-top:18px">
        <h2>💰 Revenus</h2>
        <p style="color:var(--f-muted);font-size:14px;margin-top:0">Pour chaque vente, KEKELI garde une commission de <b>${String(commission).replace('.', ',')} %</b> ; le reste vous revient. Les ventes en <span class="fk-badge-test">mode test</span> ne sont pas de l'argent réel et ne comptent pas dans vos revenus.</p>
        ${ventes.length ? `<div class="fk-table-wrap"><table class="fk-tableau-revenus">
          <thead><tr><th>Formation</th><th class="n">Prix</th><th class="n">Ventes</th><th class="n">Total encaissé</th><th class="n">Commission KEKELI</th><th class="n">Votre part</th><th>Dernière vente</th></tr></thead>
          <tbody>${ventes.map(r => `<tr><td><b>${fkEchapper(r.titre)}</b>${Number(r.nb_ventes_test) ? ` <span class="fk-badge-test">${r.nb_ventes_test} test</span>` : ''}</td>
            <td class="n">${fcfa(r.prix)}</td><td class="n">${r.nb_ventes}</td><td class="n">${fcfa(r.total_ventes)}</td>
            <td class="n">${fcfa(r.part_kekeli)}</td><td class="n"><b>${fcfa(r.part_formateur)}</b></td>
            <td>${r.derniere_vente ? fkDate(r.derniere_vente) : '—'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td><b>Total</b></td><td></td><td class="n"><b>${nbVentes}</b></td><td></td><td></td><td class="n"><b>${fcfa(totalFormateur)}</b></td><td>${nbTests ? `<span class="fk-badge-test">${nbTests} vente(s) test</span>` : ''}</td></tr></tfoot>
        </table></div>` : `<p class="fk-vide" style="padding:10px">Aucune vente pour le moment. Les ventes de vos formations payantes apparaîtront ici.</p>`}
      </section>
    </div></div>`;

  main.querySelectorAll('#btnNouvelle, [data-nouvelle]').forEach(b => b.addEventListener('click', ouvrirCreation));

  function ouvrirCreation() {
    const cats = categories || [];
    const options = cats.filter(c => !c.parent_id).map(p => `<option value="${p.id}">${fkEchapper(p.nom)}</option>
      ${cats.filter(c => c.parent_id === p.id).map(c => `<option value="${c.id}">&nbsp;&nbsp;↳ ${fkEchapper(c.nom)}</option>`).join('')}`).join('');
    const m = fkModale('Nouvelle formation', `
      <form id="formCreation">
        <label class="fk-champ"><span>Titre *</span><input type="text" name="titre" required minlength="5" maxlength="120" placeholder="Ex. Excel pour débutants"></label>
        <label class="fk-champ"><span>Catégorie</span><select name="categorie"><option value="">— Choisir —</option>${options}</select></label>
        <label class="fk-champ"><span>Niveau</span><select name="niveau">${Object.entries(FK_NIVEAUX).map(([k, v]) => `<option value="${k}" ${k === 'tous' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="fk-actions-form"><button type="button" class="fk-btn fk-btn-ghost" data-fermer>Annuler</button><button class="fk-btn fk-btn-primary" type="submit">Créer</button></div>
      </form>`);
    m.boite.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { data, error } = await supabaseClient.from('formations').insert({
        formateur_id: s.profil.id, titre: fd.get('titre').trim(), categorie_id: fd.get('categorie') ? Number(fd.get('categorie')) : null,
        niveau: fd.get('niveau')
      }).select('id').single();
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      window.location.href = `formation.html?id=${data.id}`;
    });
  }
})();
