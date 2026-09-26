// Profil public d'un formateur (pages/formations/formateur.html?slug=...).

(async function () {
  await fkInitPage('catalogue');
  const main = document.getElementById('fkContenu');
  const s = await fkSession();
  const { data: fo } = await supabaseClient.from('formateurs')
    .select('id, slug, nom_affiche, titre_professionnel, biographie, expertise, experience, site_web, photo_url, statut, niveau_pro, pro_fin')
    .eq('slug', fkParam('slug') || '').maybeSingle();
  if (!fo || fo.statut !== 'valide') {
    main.innerHTML = `<div class="fk-page"><div class="fk-container"><div class="fk-carte fk-vide"><span class="fk-vide-icone">👤</span>Ce formateur est introuvable.<br><a class="fk-link" href="${FK_BASE}catalogue.html">Voir les formations →</a></div></div></div>`;
    return;
  }
  document.title = `${fo.nom_affiche} — Formateur KEKELI`;
  const { data: formations } = await supabaseClient.from('formations').select(FK_SELECT_CARTE)
    .eq('formateur_id', fo.id).eq('statut', 'publiee').eq('visibilite', 'publique').order('publiee_le', { ascending: false });
  const liste = formations || [];
  const totalApprenants = liste.reduce((t, f) => t + (f.nb_inscrits || 0), 0);
  const notees = liste.filter(f => f.nb_avis);
  const moyenne = notees.length ? notees.reduce((t, f) => t + Number(f.note_moyenne) * f.nb_avis, 0) / notees.reduce((t, f) => t + f.nb_avis, 0) : null;

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <section class="fk-carte">
        <div class="fk-profil-tete">
          <div class="fk-avatar" style="${fo.photo_url ? `background-image:url('${fkEchapper(fo.photo_url)}')` : ''}">${fo.photo_url ? '' : fkEchapper((fo.nom_affiche || '?')[0])}</div>
          <div>
            <span class="fk-badge">FORMATEUR KEKELI</span>
            <h1 class="fk-titre-page" style="margin-top:8px">${fkEchapper(fo.nom_affiche)} ${fkBadgePro(fo)}</h1>
            <p style="margin:0;color:var(--f-muted)">${fkEchapper(fo.titre_professionnel || fo.expertise || '')}</p>
            ${fo.site_web && /^https?:\/\//i.test(fo.site_web) ? `<a class="fk-link" href="${fkEchapper(fo.site_web)}" rel="noopener nofollow" target="_blank">🌐 Site web</a>` : ''}
          </div>
        </div>
        <div class="fk-stats" style="margin:22px 0 0">
          <div class="fk-stat"><small>Formations</small><strong>${liste.length}</strong></div>
          <div class="fk-stat"><small>Apprenants</small><strong>${totalApprenants}</strong></div>
          <div class="fk-stat"><small>Note moyenne</small><strong>${moyenne ? moyenne.toFixed(1).replace('.', ',') + ' ★' : '—'}</strong></div>
          <div class="fk-stat"><small>Expertise</small><strong style="font-size:15px">${fkEchapper(fo.expertise || '—')}</strong></div>
        </div>
      </section>
      <div class="fk-grille-2" style="margin-top:18px">
        <section class="fk-carte"><h2>Biographie</h2><div class="fk-description">${fkTexteVersHtml(fo.biographie)}</div></section>
        <section class="fk-carte"><h2>Expérience</h2><div class="fk-description">${fo.experience ? fkTexteVersHtml(fo.experience) : '<p style="color:var(--f-muted)">Non renseignée.</p>'}</div></section>
      </div>
      <h2 style="margin:34px 0 16px">Formations de ${fkEchapper(fo.nom_affiche)}</h2>
      <div class="fk-courses" id="grille">${liste.length ? '' : '<p class="fk-vide" style="grid-column:1/-1">Aucune formation publiée pour le moment.</p>'}</div>
    </div></div>`;
  if (liste.length) {
    const grille = document.getElementById('grille');
    const favoris = await fkChargerFavoris(s.profil?.id);
    grille.innerHTML = liste.map(f => fkCarteFormation(f, { favori: favoris.has(f.id) })).join('');
    fkBrancherFavoris(grille, favoris, s.profil?.id);
  }
})();
