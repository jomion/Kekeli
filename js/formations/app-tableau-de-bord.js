// Espace apprenant — Mon apprentissage (pages/formations/app/tableau-de-bord.html).
// Formations en cours, terminées, favoris. Ouvert à tout compte adulte connecté.

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('apprentissage');
  const main = document.getElementById('fkContenu');

  const [{ data: inscriptions }, { data: favorisLignes }] = await Promise.all([
    supabaseClient.from('formation_inscriptions')
      .select(`id, statut, progression, inscrit_le, termine_le, derniere_lecon_id, formation_id, formations(${FK_SELECT_CARTE})`)
      .eq('apprenant_id', s.profil.id).neq('statut', 'annulee').order('inscrit_le', { ascending: false }),
    supabaseClient.from('formation_favoris').select(`formation_id, formations(${FK_SELECT_CARTE}, statut)`).eq('apprenant_id', s.profil.id).order('cree_le', { ascending: false })
  ]);
  const liste = (inscriptions || []).filter(i => i.formations);
  const enCours = liste.filter(i => i.statut !== 'terminee');
  const terminees = liste.filter(i => i.statut === 'terminee');
  const favoris = (favorisLignes || []).map(x => x.formations).filter(f => f && f.statut === 'publiee');
  const onglet = fkParam('onglet') || 'en-cours';
  const derniere = enCours.find(i => Number(i.progression) > 0) || enCours[0];

  const carteSuivi = i => {
    const f = i.formations;
    const cv = fkStyleCouverture(f);
    return `<article class="fk-course">
      <a href="${FK_BASE}app/formation.html?id=${f.id}" class="fk-cover ${cv.classe}" style="${cv.style};height:120px" aria-hidden="true" tabindex="-1">
        ${f.formation_categories ? `<span class="fk-tag">${fkEchapper(f.formation_categories.nom)}</span>` : ''}</a>
      <div class="fk-course-body">
        <h3><a href="${FK_BASE}app/formation.html?id=${f.id}">${fkEchapper(f.titre)}</a></h3>
        ${f.formateurs ? `<div class="fk-formateur-nom">par ${fkEchapper(f.formateurs.nom_affiche)}</div>` : ''}
        <div class="fk-progress" style="margin:8px 0 6px"><span style="width:${Math.round(i.progression)}%"></span></div>
        <div class="fk-meta"><span>${fkPourcentage(i.progression)} terminé</span><span>${i.statut === 'terminee' ? `🏆 le ${fkDate(i.termine_le)}` : `inscrit le ${fkDate(i.inscrit_le)}`}</span></div>
        <div class="fk-price" style="margin-top:14px"><span>${i.statut === 'terminee' ? fkBoutonCertificat(f.id) : ''}</span><a class="fk-btn fk-btn-primary fk-btn-petit" href="${FK_BASE}app/formation.html?id=${f.id}">${i.statut === 'terminee' ? 'Revoir' : Number(i.progression) > 0 ? '▶ Continuer' : '▶ Commencer'}</a></div>
      </div></article>`;
  };
  const vide = (icone, texte) => `<div class="fk-carte fk-vide" style="grid-column:1/-1"><span class="fk-vide-icone">${icone}</span>${texte}<br><a class="fk-btn fk-btn-primary" style="margin-top:12px" href="${FK_BASE}catalogue.html">Explorer les formations</a></div>`;

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <h1 class="fk-titre-page">Mon apprentissage</h1>
      <p class="fk-sous-titre">Bonjour ${fkEchapper(s.profil.prenom)}, reprenez là où vous vous êtes arrêté(e).</p>
      ${s.profil.role === 'eleve' ? '<div class="fk-alerte fk-alerte-info">Les formations sont réservées aux comptes adultes.</div>' : ''}
      ${fkCartesActions([
        derniere ? { href: `${FK_BASE}app/formation.html?id=${derniere.formations.id}`, icone: '▶️', titre: 'Continuer', texte: `${fkEchapper(derniere.formations.titre)} · ${fkPourcentage(derniere.progression)}`, couleur: 'vert' } : null,
        { attr: 'data-aller-onglet="en-cours"', icone: '📚', titre: 'Formations en cours', texte: liste.length ? `Progression moyenne : ${fkPourcentage(liste.reduce((t, i) => t + Number(i.progression), 0) / liste.length)}` : 'Aucune pour le moment', badge: enCours.length, couleur: 'bleu' },
        { attr: 'data-aller-onglet="terminees"', icone: '🏆', titre: 'Terminées et certificats', texte: 'Téléchargez vos certificats.', badge: terminees.length, couleur: 'or' },
        { attr: 'data-aller-onglet="favoris"', icone: '❤️', titre: 'Mes favoris', texte: 'Les formations que vous avez gardées.', badge: favoris.length, couleur: 'rose' },
        { href: `${FK_BASE}catalogue.html`, icone: '🔎', titre: 'Explorer le catalogue', texte: 'Trouvez votre prochaine formation.', couleur: 'violet' },
        { href: `${FK_BASE}catalogue.html?gratuit=1`, icone: '🎁', titre: 'Formations gratuites', texte: 'Pour apprendre sans rien payer.', couleur: 'vert' },
        s.formateur && s.formateur.statut === 'valide'
          ? { href: `${FK_BASE}formateur/tableau-de-bord.html`, icone: '👨‍🏫', titre: 'Mon espace formateur', texte: 'Créer et gérer mes formations.', couleur: 'orange' }
          : { href: `${FK_BASE}devenir-formateur.html`, icone: '👨‍🏫', titre: 'Devenir formateur', texte: 'Partagez votre savoir et gagnez de l\'argent.', couleur: 'orange' }
      ])}
      <div class="fk-onglets" role="tablist">
        ${[['en-cours', `▶ En cours (${enCours.length})`], ['terminees', `🏆 Terminées (${terminees.length})`], ['favoris', `❤️ Favoris (${favoris.length})`]]
          .map(([k, l]) => `<button role="tab" data-onglet="${k}" class="${k === onglet ? 'actif' : ''}" aria-selected="${k === onglet}">${l}</button>`).join('')}
      </div>
      <div class="fk-courses" id="grille"></div>
    </div></div>`;

  function afficher(o) {
    const grille = document.getElementById('grille');
    document.querySelectorAll('[data-onglet]').forEach(b => { b.classList.toggle('actif', b.dataset.onglet === o); b.setAttribute('aria-selected', String(b.dataset.onglet === o)); });
    if (o === 'terminees') grille.innerHTML = terminees.length ? terminees.map(carteSuivi).join('') : vide('🏆', 'Aucune formation terminée pour le moment.');
    else if (o === 'favoris') {
      const ids = new Set(favoris.map(f => f.id));
      grille.innerHTML = favoris.length ? favoris.map(f => fkCarteFormation(f, { favori: true })).join('') : vide('❤️', 'Ajoutez des formations à vos favoris avec le cœur 🤍.');
      fkBrancherFavoris(grille, ids, s.profil.id);
    } else grille.innerHTML = enCours.length ? enCours.map(carteSuivi).join('') : vide('📘', 'Vous ne suivez encore aucune formation.');
    const u = new URL(window.location.href); u.searchParams.set('onglet', o); history.replaceState(null, '', u);
  }
  document.querySelectorAll('[data-onglet]').forEach(b => b.addEventListener('click', () => afficher(b.dataset.onglet)));
  document.querySelectorAll('[data-aller-onglet]').forEach(b => b.addEventListener('click', () => { afficher(b.dataset.allerOnglet); document.getElementById('grille').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  afficher(onglet);
})();
