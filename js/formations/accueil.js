// Page d'accueil de la plateforme de formation (pages/formations/index.html).
// Reprend la maquette du porteur du projet, alimentée par les VRAIES données :
// catégories actives, formations publiées les plus suivies, statistiques.

(async function () {
  await fkInitPage('accueil');
  const main = document.getElementById('fkContenu');
  const s = await fkSession();

  const [{ data: categories }, { data: populairesBrut }, { data: recentes }] = await Promise.all([
    supabaseClient.from('formation_categories').select('id, nom, slug, icone, parent_id').eq('statut', 'actif').is('parent_id', null).order('position'),
    supabaseClient.from('formations').select(FK_SELECT_CARTE).eq('statut', 'publiee').eq('visibilite', 'publique')
      .order('nb_inscrits', { ascending: false }).order('publiee_le', { ascending: false }).limit(24),
    supabaseClient.from('formations').select('id, slug, titre, nb_lecons, duree_minutes, image_couverture').eq('statut', 'publiee')
      .eq('visibilite', 'publique').order('publiee_le', { ascending: false }).limit(3)
  ]);

  // Mise en avant (avantage Pro / Premium) : leurs formations passent devant, 8 affichées.
  const populaires = fkMettreEnAvant(populairesBrut).slice(0, 8);
  // Carte du héro : la vraie progression de l'apprenant connecté, sinon
  // les dernières formations publiées.
  let carteHero = '';
  if (s.profil) {
    const { data: mes } = await supabaseClient.from('formation_inscriptions')
      .select('progression, formation_id, formations(id, titre, nb_lecons, duree_minutes, image_couverture)')
      .eq('apprenant_id', s.profil.id).in('statut', ['active', 'terminee']).order('inscrit_le', { ascending: false }).limit(3);
    if (mes && mes.length) {
      const moyenne = mes.reduce((t, x) => t + Number(x.progression), 0) / mes.length;
      carteHero = `
        <div class="fk-mini-header"><span>Mon apprentissage</span><strong>${fkPourcentage(moyenne)}</strong></div>
        <div class="fk-progress"><span style="width:${Math.round(moyenne)}%"></span></div>
        ${mes.map(x => `
          <a class="fk-mini-course" href="${FK_BASE}app/formation.html?id=${x.formation_id}">
            <div class="fk-mini-thumb" style="${x.formations?.image_couverture ? `background-image:url('${fkEchapper(x.formations.image_couverture)}')` : ''}"></div>
            <div><b>${fkEchapper(x.formations?.titre)}</b><small>${x.formations?.nb_lecons || 0} leçons • ${fkDuree(x.formations?.duree_minutes)}</small></div>
            <strong>${fkPourcentage(x.progression)}</strong>
          </a>`).join('')}`;
    }
  }
  if (!carteHero) {
    carteHero = (recentes && recentes.length) ? `
        <div class="fk-mini-header"><span>🆕 Nouvelles formations</span></div>
        ${recentes.map(f => `
          <a class="fk-mini-course" href="${FK_BASE}formation.html?slug=${encodeURIComponent(f.slug)}">
            <div class="fk-mini-thumb" style="${f.image_couverture ? `background-image:url('${fkEchapper(f.image_couverture)}')` : ''}"></div>
            <div><b>${fkEchapper(f.titre)}</b><small>${f.nb_lecons} leçons • ${fkDuree(f.duree_minutes)}</small></div>
            <strong>→</strong>
          </a>`).join('')}` : `
        <div class="fk-mini-header"><span>Votre parcours</span></div>
        <div class="fk-mini-course"><div class="fk-mini-thumb"></div><div><b>1. Choisissez une formation</b><small>Catalogue par catégorie</small></div><strong>🔎</strong></div>
        <div class="fk-mini-course"><div class="fk-mini-thumb"></div><div><b>2. Apprenez à votre rythme</b><small>Leçons, vidéos, ressources</small></div><strong>▶</strong></div>
        <div class="fk-mini-course"><div class="fk-mini-thumb"></div><div><b>3. Validez vos acquis</b><small>Quiz et progression</small></div><strong>✓</strong></div>`;
  }

  const totalInscrits = (populaires || []).reduce((t, f) => t + (f.nb_inscrits || 0), 0);
  const estFormateur = s.formateur && s.formateur.statut === 'valide';

  main.innerHTML = `
    <div class="fk-topbar"><div class="fk-container">
      <span>🎓 Apprenez auprès de formateurs qualifiés</span>
      <span>${estFormateur ? `<a href="${FK_BASE}formateur/tableau-de-bord.html">Accéder à mon espace formateur</a>` : `<a href="${FK_BASE}devenir-formateur.html">Devenez formateur et partagez votre savoir</a>`}</span>
    </div></div>

    <section class="fk-hero">
      <div class="fk-container fk-hero-grid">
        <div>
          <span class="fk-badge">PLATEFORME DE FORMATION EN LIGNE</span>
          <h1>Apprenez.<br><span>Formez.</span><br>Partagez.</h1>
          <p>Découvrez des formations créées par des personnes passionnées par leur domaine, développez de nouvelles compétences et partagez à votre tour votre savoir.</p>
          <div class="fk-hero-actions">
            <a class="fk-btn fk-btn-primary" href="${FK_BASE}catalogue.html">🎓 Trouver une formation</a>
            <a class="fk-btn fk-btn-secondary" href="${estFormateur ? FK_BASE + 'formateur/tableau-de-bord.html' : FK_BASE + 'devenir-formateur.html'}">👨‍🏫 ${estFormateur ? 'Mon espace formateur' : 'Devenir formateur'}</a>
          </div>
        </div>
        <div class="fk-hero-card"><div class="fk-hero-screen">${carteHero}</div></div>
      </div>
    </section>

    <section class="fk-section" id="categories">
      <div class="fk-container">
        <div class="fk-section-head">
          <div><h2>Explorez par catégorie</h2><p>Trouvez rapidement le domaine dans lequel vous souhaitez progresser.</p></div>
          <a class="fk-link" href="${FK_BASE}catalogue.html">Voir toutes les formations →</a>
        </div>
        <div class="fk-categories">
          ${(categories || []).map(c => `<a class="fk-category" href="${FK_BASE}catalogue.html?categorie=${encodeURIComponent(c.slug)}"><div class="fk-icon" aria-hidden="true">${fkEchapper(c.icone || '📘')}</div><b>${fkEchapper(c.nom)}</b></a>`).join('')}
        </div>
      </div>
    </section>

    <section class="fk-section" id="formations" style="padding-top:0">
      <div class="fk-container">
        <div class="fk-section-head">
          <div><h2>Formations populaires</h2><p>Les formations actuellement les plus suivies.</p></div>
          <a class="fk-link" href="${FK_BASE}catalogue.html?tri=populaires">Voir toutes les formations →</a>
        </div>
        <div class="fk-courses" id="grillePopulaires">
          ${(populaires || []).length ? '' : `<div class="fk-carte fk-vide" style="grid-column:1/-1"><span class="fk-vide-icone">🌱</span>Les premières formations arrivent bientôt.<br>Vous êtes expert d'un domaine ? <a class="fk-link" href="${FK_BASE}devenir-formateur.html">Proposez la vôtre →</a></div>`}
        </div>
      </div>
    </section>

    <section class="fk-section fk-section-blanche" id="comment">
      <div class="fk-container">
        <div class="fk-section-head"><div><h2>Comment fonctionne KEKELI Formation ?</h2><p>Une expérience simple pour apprendre et transmettre.</p></div></div>
        <div class="fk-steps">
          <div class="fk-step"><div class="fk-step-num">1</div><h3>Choisissez</h3><p>Recherchez une formation adaptée à vos besoins et à votre niveau.</p></div>
          <div class="fk-step"><div class="fk-step-num">2</div><h3>Apprenez</h3><p>Suivez les leçons, regardez les vidéos et téléchargez les ressources.</p></div>
          <div class="fk-step"><div class="fk-step-num">3</div><h3>Pratiquez</h3><p>Répondez aux quiz pour mesurer vos progrès, à votre rythme.</p></div>
          <div class="fk-step"><div class="fk-step-num">4</div><h3>Terminez</h3><p>Validez toutes les leçons et les quiz : votre formation est terminée et vous recevez votre certificat, vérifiable en ligne.</p></div>
        </div>
      </div>
    </section>

    <section class="fk-section" id="formateur">
      <div class="fk-container fk-trainer">
        <div>
          <span class="fk-badge">DEVENEZ FORMATEUR</span>
          <h2 style="font-size:36px;margin:16px 0;line-height:1.15">Votre savoir peut devenir une formation.</h2>
          <p style="color:var(--f-muted);line-height:1.7">Vous maîtrisez un métier, une compétence ou un domaine particulier ? Créez votre formation, partagez votre expertise et accompagnez des apprenants.</p>
          <div class="fk-check">Créez vos propres formations, module par module</div>
          <div class="fk-check">Ajoutez vidéos, audios, documents et quiz</div>
          <div class="fk-check">Suivez la progression de vos apprenants</div>
          <div class="fk-check">Chaque formation est vérifiée par KEKELI avant publication</div>
          <a class="fk-btn fk-btn-primary" style="margin-top:15px" href="${estFormateur ? FK_BASE + 'formateur/tableau-de-bord.html' : FK_BASE + 'devenir-formateur.html'}">Commencer à former</a>
        </div>
        <div class="fk-trainer-box">
          <h2 style="margin-top:0">Un espace pensé pour les formateurs</h2>
          <p>Depuis votre tableau de bord, vous créez vos modules, organisez vos leçons, préparez vos quiz, soumettez votre formation à validation et suivez vos apprenants.</p>
          <div style="background:rgba(255,255,255,.09);padding:18px;border-radius:15px;margin-top:22px">
            <small>SUR KEKELI FORMATION</small>
            <h2 style="margin:8px 0">${(populaires || []).length} formation${(populaires || []).length > 1 ? 's' : ''} à la une</h2>
            <p style="margin:0">${totalInscrits} inscription${totalInscrits > 1 ? 's' : ''} aux formations les plus suivies</p>
          </div>
        </div>
      </div>
    </section>

    <div class="fk-cta">
      <div><h2>Prêt à commencer votre apprentissage ?</h2><p>Découvrez les formations disponibles sur KEKELI.</p></div>
      <a class="fk-btn fk-btn-secondary" href="${FK_BASE}catalogue.html">Explorer les formations</a>
    </div>`;

  if ((populaires || []).length) {
    const grille = document.getElementById('grillePopulaires');
    const favoris = await fkChargerFavoris(s.profil?.id);
    grille.innerHTML = populaires.map(f => fkCarteFormation(f, { favori: favoris.has(f.id) })).join('');
    fkBrancherFavoris(grille, favoris, s.profil?.id);
  }
})();
