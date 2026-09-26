// Fiche publique d'une formation (pages/formations/formation.html?slug=...).
// Programme (titres seulement, via programme_formation_public), leçons
// d'aperçu gratuites, formateur, avis, inscription. SEO : titre, meta,
// Open Graph, URL canonique et données structurées schema.org/Course.

(async function () {
  await fkInitPage('catalogue');
  const main = document.getElementById('fkContenu');
  const s = await fkSession();
  const slug = fkParam('slug');
  const id = fkParam('id');

  let req = supabaseClient.from('formations').select(`*, formation_categories(id, nom, slug, icone), formateurs(id, nom_affiche, slug, titre_professionnel, biographie, photo_url, niveau_pro, pro_fin)`);
  req = slug ? req.eq('slug', slug) : req.eq('id', Number(id) || 0);
  const { data: f } = await req.maybeSingle();
  if (!f) {
    main.innerHTML = `<div class="fk-page"><div class="fk-container"><div class="fk-carte fk-vide"><span class="fk-vide-icone">🔍</span>Cette formation est introuvable ou n'est plus disponible.<br><a class="fk-link" href="${FK_BASE}catalogue.html">Voir le catalogue →</a></div></div></div>`;
    return;
  }

  const [{ data: programme }, { data: avis }, inscriptionRes, favoris] = await Promise.all([
    supabaseClient.rpc('programme_formation_public', { p_id: f.id }),
    supabaseClient.from('formation_avis').select('id, apprenant_id, nom_affiche, note, commentaire, cree_le').eq('formation_id', f.id).eq('statut', 'publie').order('cree_le', { ascending: false }).limit(30),
    s.profil ? supabaseClient.from('formation_inscriptions').select('id, statut, progression').eq('formation_id', f.id).eq('apprenant_id', s.profil.id).maybeSingle() : Promise.resolve({ data: null }),
    fkChargerFavoris(s.profil?.id)
  ]);
  const inscription = inscriptionRes.data;
  const modules = programme || [];
  const nbQuiz = modules.reduce((t, m) => t + (m.quiz || []).length, 0);
  const estProprio = s.profil && f.formateur_id === s.profil.id;
  const cat = f.formation_categories;
  const fo = f.formateurs;

  appliquerSeo(f);

  const cv = fkStyleCouverture(f);
  main.innerHTML = `
    ${f.statut !== 'publiee' ? `<div class="fk-alerte fk-alerte-attention" style="margin:0;border-radius:0;text-align:center">👁️ Aperçu — cette formation est « ${FK_STATUTS_FORMATION[f.statut]} » et n'est pas visible du public.</div>` : ''}
    <section class="fk-fiche-hero"><div class="fk-container fk-fiche-grid">
      <div>
        <nav aria-label="Fil d'Ariane" style="font-size:13px;color:#cfe3dc"><a href="${FK_BASE}catalogue.html">Formations</a>${cat ? ` › <a href="${FK_BASE}catalogue.html?categorie=${encodeURIComponent(cat.slug)}">${fkEchapper(cat.nom)}</a>` : ''}</nav>
        <h1>${fkEchapper(f.titre)}</h1>
        ${f.sous_titre ? `<p>${fkEchapper(f.sous_titre)}</p>` : ''}
        <div class="fk-rating">${fkEtoiles(f.note_moyenne, f.nb_avis)}</div>
        <div class="fk-meta">
          <span>👥 ${f.nb_inscrits} apprenant${f.nb_inscrits > 1 ? 's' : ''}</span>
          <span>📚 ${f.nb_lecons} leçon${f.nb_lecons > 1 ? 's' : ''}</span>
          <span>⏱️ ${fkDuree(f.duree_minutes)}</span>
          <span>📈 ${FK_NIVEAUX[f.niveau]}</span>
          <span>🌐 ${f.langue === 'fr' ? 'Français' : fkEchapper(f.langue)}</span>
        </div>
        ${fo ? `<p style="margin-top:14px;font-size:15px">Formateur : <a class="fk-lien-clair" href="${FK_BASE}formateur.html?slug=${encodeURIComponent(fo.slug)}">${fkEchapper(fo.nom_affiche)}</a> ${fkBadgePro(fo)}</p>` : ''}
      </div>
      <aside class="fk-fiche-achat">
        <div class="fk-cover ${cv.classe}" style="${cv.style}">${f.image_couverture ? '' : `<div class="fk-symbol">${fkEchapper(cat?.icone || '🎓')}</div>`}</div>
        <div class="fk-fiche-achat-corps">
          <div class="fk-fiche-prix">${fkPrix(f.prix, f.devise)}</div>
          <div id="zoneAction"></div>
          <button class="fk-btn fk-btn-ghost fk-btn-bloc" style="margin-top:10px" id="btnFavori" aria-pressed="${favoris.has(f.id)}">${favoris.has(f.id) ? '❤️ Dans vos favoris' : '🤍 Ajouter aux favoris'}</button>
          <ul style="padding-left:18px;margin:16px 0 0;color:var(--f-muted);font-size:14px;line-height:1.9">
            <li>${modules.length} module${modules.length > 1 ? 's' : ''}, ${f.nb_lecons} leçon${f.nb_lecons > 1 ? 's' : ''}</li>
            ${nbQuiz ? `<li>${nbQuiz} quiz d'évaluation</li>` : ''}
            <li>Accès à votre rythme, sur mobile et ordinateur</li>
            <li>Suivi de votre progression</li>
          </ul>
        </div>
      </aside>
    </div></section>

    <div class="fk-container fk-fiche-corps">
      <div>
        <section class="fk-carte"><h2>À propos de cette formation</h2>
          <div class="fk-description">${fkNettoyerHtml(f.description) || '<p>Description à venir.</p>'}</div>
          ${f.video_promo ? await fkHtmlVideo(f.video_promo) : ''}
        </section>
        <section class="fk-carte"><h2>Programme</h2>
          ${modules.length ? modules.map((m, i) => `
            <div class="fk-module">
              <div class="fk-module-tete"><span>Module ${i + 1} — ${fkEchapper(m.titre)}</span><small>${m.lecons.length} leçon${m.lecons.length > 1 ? 's' : ''}</small></div>
              ${m.lecons.map(l => `
                <div class="fk-lecon-ligne">
                  <span class="fk-lecon-titre"><span aria-hidden="true">${iconeType(l.type_contenu)}</span><span>${fkEchapper(l.titre)}</span></span>
                  <span class="fk-outils">${l.est_apercu ? `<button class="fk-btn fk-btn-outline fk-btn-petit" data-apercu="${l.id}">▶ Aperçu gratuit</button>` : ''}<small>${fkDuree(l.duree_minutes)}</small></span>
                </div>`).join('')}
              ${(m.quiz || []).map(q => `<div class="fk-lecon-ligne"><span class="fk-lecon-titre"><span aria-hidden="true">📝</span><span>Quiz : ${fkEchapper(q.titre)}</span></span><small>${q.nb_questions} question${q.nb_questions > 1 ? 's' : ''}</small></div>`).join('')}
            </div>`).join('') : '<p class="fk-vide">Programme en cours de préparation.</p>'}
        </section>
        <section class="fk-carte" id="sectionAvis"><h2>Avis des apprenants</h2><div id="zoneAvis"></div></section>
      </div>
      <aside>
        ${fo ? `<section class="fk-carte"><h2>Votre formateur</h2>
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
            <div class="fk-avatar" style="width:64px;height:64px;font-size:24px;${fo.photo_url ? `background-image:url('${fkEchapper(fo.photo_url)}')` : ''}">${fo.photo_url ? '' : fkEchapper((fo.nom_affiche || '?')[0])}</div>
            <div><b>${fkEchapper(fo.nom_affiche)}</b> ${fkBadgePro(fo)}<br><small style="color:var(--f-muted)">${fkEchapper(fo.titre_professionnel || '')}</small></div>
          </div>
          <p style="color:var(--f-muted);font-size:14px;line-height:1.6">${fkEchapper((fo.biographie || '').slice(0, 280))}${(fo.biographie || '').length > 280 ? '…' : ''}</p>
          <a class="fk-link" href="${FK_BASE}formateur.html?slug=${encodeURIComponent(fo.slug)}">Voir le profil →</a>
        </section>` : ''}
      </aside>
    </div>`;

  rendreAction();
  rendreAvis();

  document.getElementById('btnFavori').addEventListener('click', async e => {
    if (!s.profil) { window.location.href = fkUrlConnexion(); return; }
    const on = favoris.has(f.id);
    const { error } = on
      ? await supabaseClient.from('formation_favoris').delete().eq('apprenant_id', s.profil.id).eq('formation_id', f.id)
      : await supabaseClient.from('formation_favoris').insert({ apprenant_id: s.profil.id, formation_id: f.id });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    on ? favoris.delete(f.id) : favoris.add(f.id);
    e.currentTarget.textContent = on ? '🤍 Ajouter aux favoris' : '❤️ Dans vos favoris';
    e.currentTarget.setAttribute('aria-pressed', String(!on));
  });

  main.querySelectorAll('[data-apercu]').forEach(b => b.addEventListener('click', () => ouvrirApercu(Number(b.dataset.apercu))));

  function rendreAction() {
    const zone = document.getElementById('zoneAction');
    if (estProprio) {
      zone.innerHTML = `<a class="fk-btn fk-btn-primary fk-btn-bloc" href="${FK_BASE}formateur/formation.html?id=${f.id}">✏️ Modifier ma formation</a>`;
    } else if (inscription && inscription.statut !== 'annulee') {
      zone.innerHTML = `<a class="fk-btn fk-btn-primary fk-btn-bloc" href="${FK_BASE}app/formation.html?id=${f.id}">${Number(inscription.progression) > 0 ? '▶ Continuer' : '▶ Commencer'} la formation</a>
        <div class="fk-progress" style="margin-top:12px"><span style="width:${Math.round(inscription.progression)}%"></span></div>
        <small style="color:var(--f-muted)">${fkPourcentage(inscription.progression)} terminé</small>`;
    } else if (f.statut !== 'publiee') {
      zone.innerHTML = `<button class="fk-btn fk-btn-primary fk-btn-bloc" disabled>Inscriptions fermées</button>`;
    } else if (f.prix > 0) {
      if (!s.profil) {
        zone.innerHTML = `<a class="fk-btn fk-btn-primary fk-btn-bloc" href="${fkUrlInscription()}">💳 Créer un compte pour acheter</a>
          <a class="fk-btn fk-btn-ghost fk-btn-bloc" style="margin-top:8px" href="${fkUrlConnexion()}">J'ai déjà un compte</a>`;
      } else if (s.profil.role === 'eleve') {
        zone.innerHTML = `<p class="fk-alerte fk-alerte-info">Les formations sont réservées aux comptes adultes.</p>`;
      } else {
        zone.innerHTML = `<button class="fk-btn fk-btn-primary fk-btn-bloc" id="btnAcheter">💳 Acheter — ${fkPrix(f.prix, f.devise)}</button>
          <p style="font-size:13px;color:var(--f-muted);margin:8px 0 0">Mobile Money (MTN, Moov, Wave…) ou carte bancaire. Accès immédiat après paiement.</p>`;
        document.getElementById('btnAcheter').addEventListener('click', () => fkAcheterFormation(f));
      }
    } else if (!s.profil) {
      zone.innerHTML = `<a class="fk-btn fk-btn-primary fk-btn-bloc" href="${fkUrlInscription()}">S'inscrire gratuitement</a>
        <a class="fk-btn fk-btn-ghost fk-btn-bloc" style="margin-top:8px" href="${fkUrlConnexion()}">J'ai déjà un compte</a>`;
    } else if (s.profil.role === 'eleve') {
      zone.innerHTML = `<p class="fk-alerte fk-alerte-info">Les formations sont réservées aux comptes adultes.</p>`;
    } else {
      zone.innerHTML = `<button class="fk-btn fk-btn-primary fk-btn-bloc" id="btnInscrire">S'inscrire gratuitement</button>`;
      document.getElementById('btnInscrire').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        const { error } = await supabaseClient.rpc('s_inscrire_formation', { p_id: f.id });
        if (error) { fkToast(fkMessageErreur(error), 'erreur'); e.currentTarget.disabled = false; return; }
        window.location.href = `${FK_BASE}app/formation.html?id=${f.id}`;
      });
    }
  }

  function rendreAvis() {
    const zone = document.getElementById('zoneAvis');
    const liste = avis || [];
    const monAvis = s.profil ? liste.find(a => a.apprenant_id === s.profil.id) : null;
    let html = '';
    if (inscription && inscription.statut !== 'annulee') {
      html += `<form id="formAvis" class="fk-carte" style="background:#f8faf9;margin-bottom:12px">
        <h3>${monAvis ? 'Modifier mon avis' : 'Donner mon avis'}</h3>
        <div class="fk-etoiles-choix" role="radiogroup" aria-label="Note">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} étoile${n > 1 ? 's' : ''}" data-note="${n}">★</button>`).join('')}</div>
        <label class="fk-champ" style="margin-top:10px"><span class="fk-sr">Commentaire</span><textarea name="commentaire" maxlength="1500" placeholder="Qu'avez-vous pensé de cette formation ?">${fkEchapper(monAvis?.commentaire || '')}</textarea></label>
        <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" type="submit">Publier</button></div>
      </form>`;
    }
    html += liste.length ? liste.map(a => `<div class="fk-avis"><b>${fkEchapper(a.nom_affiche || 'Apprenant')}</b> <span class="fk-rating" style="margin:0 6px">${'★'.repeat(a.note)}${'☆'.repeat(5 - a.note)}</span><small style="color:var(--f-muted)">${fkDate(a.cree_le)}</small>${a.commentaire ? `<p>${fkEchapper(a.commentaire)}</p>` : ''}</div>`).join('')
      : '<p class="fk-vide" style="padding:10px">Aucun avis pour le moment.</p>';
    zone.innerHTML = html;

    const form = document.getElementById('formAvis');
    if (!form) return;
    let note = monAvis?.note || 0;
    const etoiles = [...form.querySelectorAll('[data-note]')];
    const maj = () => etoiles.forEach(b => { const on = Number(b.dataset.note) <= note; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(Number(b.dataset.note) === note)); });
    etoiles.forEach(b => b.addEventListener('click', () => { note = Number(b.dataset.note); maj(); }));
    maj();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!note) { fkToast('Choisissez une note de 1 à 5 étoiles.', 'erreur'); return; }
      const commentaire = form.commentaire.value.trim() || null;
      const { error } = monAvis
        ? await supabaseClient.from('formation_avis').update({ note, commentaire }).eq('id', monAvis.id)
        : await supabaseClient.from('formation_avis').insert({ apprenant_id: s.profil.id, formation_id: f.id, note, commentaire });
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      fkToast('Merci pour votre avis !', 'succes');
      setTimeout(() => window.location.reload(), 700);
    });
  }

  async function ouvrirApercu(lid) {
    const { data: l } = await supabaseClient.from('formation_lecons').select('*').eq('id', lid).maybeSingle();
    if (!l) { fkToast('Aperçu indisponible.', 'erreur'); return; }
    const corps = `${await fkHtmlVideo(l.video_url)}${await fkHtmlAudio(l.audio_url)}${l.page_html ? '<div data-page-html></div>' : `<div class="fk-lecon-corps">${fkNettoyerHtml(l.contenu)}</div>`}
      <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" data-fermer>Fermer</button></div>`;
    const m = fkModale(`Aperçu : ${l.titre}`, corps);
    m.boite.style.width = l.page_html ? 'min(1200px, 100%)' : 'min(860px, 100%)';
    if (l.page_html) fkAfficherPageHtml(m.boite.querySelector('[data-page-html]'), l.page_html, { titre: l.titre });
    else await fkPreparerCorpsLecon(m.boite.querySelector('.fk-lecon-corps'));
  }

  function iconeType(t) { return { video: '🎬', audio: '🎧', document: '📄', mixte: '🧩' }[t] || '📖'; }

  function appliquerSeo(f) {
    const desc = (f.sous_titre || (f.description || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 160);
    document.title = `${f.titre} — KEKELI Formation`;
    const meta = (attr, cle, val) => {
      let el = document.head.querySelector(`meta[${attr}="${cle}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, cle); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };
    meta('name', 'description', desc);
    meta('property', 'og:title', f.titre);
    meta('property', 'og:description', desc);
    meta('property', 'og:type', 'website');
    if (f.image_couverture) meta('property', 'og:image', f.image_couverture);
    const canon = document.createElement('link');
    canon.rel = 'canonical';
    canon.href = new URL(`formation.html?slug=${encodeURIComponent(f.slug)}`, window.location.href).toString();
    document.head.appendChild(canon);
    if (f.statut !== 'publiee') meta('name', 'robots', 'noindex');
    const ld = {
      '@context': 'https://schema.org', '@type': 'Course', name: f.titre, description: desc, inLanguage: f.langue,
      provider: { '@type': 'Organization', name: 'KEKELI' },
      offers: { '@type': 'Offer', category: f.prix > 0 ? 'Paid' : 'Free', price: f.prix, priceCurrency: f.devise === 'XOF' ? 'XOF' : f.devise },
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: `PT${f.duree_minutes || 0}M` }
    };
    if (f.formateurs) ld.creator = { '@type': 'Person', name: f.formateurs.nom_affiche };
    if (f.nb_avis) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(f.note_moyenne), reviewCount: f.nb_avis };
    const sc = document.createElement('script');
    sc.type = 'application/ld+json';
    sc.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');
    document.head.appendChild(sc);
  }
})();
