// Catalogue des formations (pages/formations/catalogue.html) :
// recherche, catégories (et sous-catégories), niveau, gratuites, tri,
// pagination (12 par page). Les filtres vivent dans l'URL pour être partageables.

const FK_PAR_PAGE = 12;

(async function () {
  await fkInitPage('catalogue');
  const main = document.getElementById('fkContenu');
  const s = await fkSession();
  const params = new URLSearchParams(window.location.search);
  const filtres = {
    q: (params.get('q') || '').trim(),
    categorie: params.get('categorie') || '',
    niveau: params.get('niveau') || '',
    gratuit: params.get('gratuit') === '1',
    tri: params.get('tri') || 'recents',
    page: Math.max(1, parseInt(params.get('page'), 10) || 1)
  };

  const { data: categories } = await supabaseClient.from('formation_categories')
    .select('id, nom, slug, icone, parent_id').eq('statut', 'actif').order('position');
  const cats = categories || [];
  const parents = cats.filter(c => !c.parent_id);
  const catChoisie = cats.find(c => c.slug === filtres.categorie);

  let titre = 'Toutes les formations';
  if (filtres.gratuit) titre = 'Formations gratuites';
  if (filtres.tri === 'populaires') titre = 'Formations populaires';
  if (catChoisie) titre = `${catChoisie.icone || ''} ${catChoisie.nom}`;
  if (filtres.q) titre = `Résultats pour « ${filtres.q} »`;
  document.title = `${titre} — KEKELI Formation`;

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container">
      <h1 class="fk-titre-page">${fkEchapper(titre)}</h1>
      <p class="fk-sous-titre" id="resume">&nbsp;</p>
      <div class="fk-categories" style="margin-bottom:22px">
        <a class="fk-category ${!catChoisie ? 'actif' : ''}" href="${lienAvec({ categorie: '', page: '' })}"><div class="fk-icon" aria-hidden="true">✨</div><b>Toutes</b></a>
        ${parents.map(c => `<a class="fk-category ${catChoisie && (catChoisie.id === c.id || catChoisie.parent_id === c.id) ? 'actif' : ''}" href="${lienAvec({ categorie: c.slug, page: '' })}"><div class="fk-icon" aria-hidden="true">${fkEchapper(c.icone || '📘')}</div><b>${fkEchapper(c.nom)}</b></a>`).join('')}
      </div>
      <form class="fk-filtres" id="formFiltres">
        <label class="fk-sr" for="fQ">Recherche</label>
        <input id="fQ" type="search" name="q" placeholder="Mot-clé…" value="${fkEchapper(filtres.q)}">
        <label class="fk-sr" for="fCat">Catégorie</label>
        <select id="fCat" name="categorie">
          <option value="">Toutes les catégories</option>
          ${parents.map(p => `<option value="${p.slug}" ${p.slug === filtres.categorie ? 'selected' : ''}>${fkEchapper(p.nom)}</option>
            ${cats.filter(c => c.parent_id === p.id).map(c => `<option value="${c.slug}" ${c.slug === filtres.categorie ? 'selected' : ''}>&nbsp;&nbsp;↳ ${fkEchapper(c.nom)}</option>`).join('')}`).join('')}
        </select>
        <label class="fk-sr" for="fNiv">Niveau</label>
        <select id="fNiv" name="niveau"><option value="">Tous niveaux</option>
          ${Object.entries(FK_NIVEAUX).filter(([k]) => k !== 'tous').map(([k, v]) => `<option value="${k}" ${k === filtres.niveau ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label class="fk-sr" for="fTri">Trier par</label>
        <select id="fTri" name="tri">
          <option value="recents" ${filtres.tri === 'recents' ? 'selected' : ''}>Plus récentes</option>
          <option value="populaires" ${filtres.tri === 'populaires' ? 'selected' : ''}>Plus suivies</option>
          <option value="note" ${filtres.tri === 'note' ? 'selected' : ''}>Mieux notées</option>
          <option value="prix" ${filtres.tri === 'prix' ? 'selected' : ''}>Prix croissant</option>
        </select>
        <label class="fk-case" style="margin:0"><input type="checkbox" name="gratuit" value="1" ${filtres.gratuit ? 'checked' : ''}> Gratuites uniquement</label>
        <button class="fk-btn fk-btn-primary" type="submit">Filtrer</button>
      </form>
      <div class="fk-courses" id="grille"><div class="fk-chargement" style="grid-column:1/-1">Chargement…</div></div>
      <nav class="fk-pagination" id="pagination" aria-label="Pages"></nav>
    </div></div>`;

  document.getElementById('formFiltres').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (v) p.set(k, v);
    window.location.search = p.toString();
  });

  // Requête
  let req = supabaseClient.from('formations').select(FK_SELECT_CARTE, { count: 'exact' })
    .eq('statut', 'publiee').eq('visibilite', 'publique');
  if (catChoisie) {
    const ids = [catChoisie.id, ...cats.filter(c => c.parent_id === catChoisie.id).map(c => c.id)];
    req = req.in('categorie_id', ids);
  }
  if (filtres.niveau) req = req.eq('niveau', filtres.niveau);
  if (filtres.gratuit) req = req.eq('prix', 0);
  if (filtres.q) {
    const q = filtres.q.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
    if (q) req = req.or(`titre.ilike.%${q}%,sous_titre.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (filtres.tri === 'populaires') req = req.order('nb_inscrits', { ascending: false });
  else if (filtres.tri === 'note') req = req.order('note_moyenne', { ascending: false, nullsFirst: false });
  else if (filtres.tri === 'prix') req = req.order('prix', { ascending: true });
  req = req.order('publiee_le', { ascending: false });
  const debut = (filtres.page - 1) * FK_PAR_PAGE;
  const { data, count, error } = await req.range(debut, debut + FK_PAR_PAGE - 1);

  const grille = document.getElementById('grille');
  if (error) { grille.innerHTML = `<p class="fk-alerte fk-alerte-erreur" style="grid-column:1/-1">${fkEchapper(fkMessageErreur(error))}</p>`; return; }
  document.getElementById('resume').textContent = `${count || 0} formation${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`;
  if (!data.length) {
    grille.innerHTML = `<div class="fk-carte fk-vide" style="grid-column:1/-1"><span class="fk-vide-icone">🔎</span>Aucune formation ne correspond à ces critères.<br><a class="fk-link" href="${FK_BASE}catalogue.html">Voir toutes les formations</a></div>`;
    return;
  }
  const favoris = await fkChargerFavoris(s.profil?.id);
  // Tri par défaut : les formations des formateurs Pro / Premium d'abord (avantage « mise en avant »).
  const liste = filtres.tri ? data : fkMettreEnAvant(data);
  grille.innerHTML = liste.map(f => fkCarteFormation(f, { favori: favoris.has(f.id) })).join('');
  fkBrancherFavoris(grille, favoris, s.profil?.id);

  const nbPages = Math.ceil((count || 0) / FK_PAR_PAGE);
  if (nbPages > 1) {
    document.getElementById('pagination').innerHTML = Array.from({ length: nbPages }, (_, i) => i + 1)
      .map(n => n === filtres.page
        ? `<span class="fk-btn fk-btn-primary fk-btn-petit" aria-current="page">${n}</span>`
        : `<a class="fk-btn fk-btn-ghost fk-btn-petit" href="${lienAvec({ page: n })}">${n}</a>`).join('');
  }

  function lienAvec(modifs) {
    const p = new URLSearchParams(window.location.search);
    Object.entries(modifs).forEach(([k, v]) => { if (v === '' || v === null) p.delete(k); else p.set(k, v); });
    const qs = p.toString();
    return `${FK_BASE}catalogue.html${qs ? '?' + qs : ''}`;
  }
})();
