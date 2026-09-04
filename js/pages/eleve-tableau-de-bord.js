// Page pages/eleve/tableau-de-bord.html

const LIBELLES_PALIER_TB = {
  azovi: { icone: '🌱', nom: 'Azɔ̀ví', couleur: '#2ECC71', desc: 'Niveau débutant' },
  devi:  { icone: '🪘', nom: 'Dèví', couleur: '#3498DB', desc: 'Niveau intermédiaire' },
  ogan:  { icone: '🦁', nom: 'Ògán', couleur: '#E67E22', desc: 'Niveau avancé' },
  axosu: { icone: '👑', nom: 'Axɔ́sú', couleur: '#9B59B6', desc: 'Niveau expert' }
};

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;

  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperTb(profil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const { data: fiche } = await supabaseClient.from('eleves').select('mascotte, classe_id').eq('id', profil.id).single();
  const mascotte = fiche?.mascotte || '🦁';

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).single();
    nomClasse = classe?.nom || '';
  }

  const [{ data: abonnements }, { data: niveauActuel }, { count: nbBadges }, { data: derniere }, { data: toutesDates }, { data: badgesRecentsIconesTb }] = await Promise.all([
    supabaseClient.from('abonnements_enseignant_eleve').select('*, enseignants(profils(prenom, nom))').eq('eleve_id', profil.id).eq('statut', 'accepte'),
    supabaseClient.rpc('niveau_agilite_actuel', { p_eleve_id: profil.id }),
    supabaseClient.from('badges_eleves').select('id', { count: 'exact', head: true }).eq('eleve_id', profil.id),
    supabaseClient.from('seances_terminees').select('seance_id, seances(titre)').eq('eleve_id', profil.id).order('termine_le', { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from('seances_terminees').select('termine_le').eq('eleve_id', profil.id),
    // Uniquement pour le panneau "Mes badges récents" du look premium (voir
    // rendreContenuPremiumTB) — évite d'alourdir apercuBadgesTb (bulle au
    // survol) qui n'a besoin que du nom.
    supabaseClient.from('badges_eleves').select('badges(nom, icone)').eq('eleve_id', profil.id).order('attribue_le', { ascending: false }).limit(4)
  ]);
  const enseignantsSuivis = abonnements || [];
  const serie = calculerSerieJoursTB((toutesDates || []).map(d => d.termine_le));

  // Avancement dans le programme (indicatif) : séances terminées / séances
  // publiées accessibles à la classe de l'élève. Distinct des paliers
  // d'agilité ci-dessous, qui mesurent la MAÎTRISE (activités réussies par
  // palier à l'intérieur des séances), pas juste l'avancement.
  let progressionPct = 0;
  if (fiche?.classe_id) {
    const { data: noeudsClasse } = await supabaseClient.from('noeuds_parcours').select('id').eq('classe_id', fiche.classe_id);
    const idsNoeuds = (noeudsClasse || []).map(n => n.id);
    const { data: saClasse } = idsNoeuds.length ? await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds) : { data: [] };
    const idsSA = (saClasse || []).map(s => s.id);
    const { count: totalPublie } = idsSA.length
      ? await supabaseClient.from('seances').select('id', { count: 'exact', head: true }).eq('statut', 'publie').in('sa_id', idsSA)
      : { count: 0 };
    const { count: totalTermine } = await supabaseClient
      .from('seances_terminees').select('id', { count: 'exact', head: true }).eq('eleve_id', profil.id);
    progressionPct = totalPublie ? Math.min(100, Math.round(((totalTermine || 0) / totalPublie) * 100)) : 0;
  }

  // Aperçu au survol (Task #34) : déploie le contenu important de chaque
  // carte d'action sans avoir besoin de cliquer — voir js/apercu-survol.js.
  let apercuMatieresTb = [];
  let apercuBadgesTb = [];
  let apercuDevoirsTb = [];
  if (fiche?.classe_id) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const [{ data: champsClasseTb }, { data: badgesRecentsTb }, { data: devoirsAVenirTb }] = await Promise.all([
      supabaseClient.from('classes_champs_formation').select('champs_formation(nom)').eq('classe_id', fiche.classe_id),
      supabaseClient.from('badges_eleves').select('badges(nom)').eq('eleve_id', profil.id).order('attribue_le', { ascending: false }).limit(6),
      supabaseClient.from('devoirs').select('titre, date_limite').eq('classe_id', fiche.classe_id).eq('statut', 'publie').gte('date_limite', aujourdhui).order('date_limite').limit(6)
    ]);
    apercuMatieresTb = (champsClasseTb || []).map(c => c.champs_formation?.nom).filter(Boolean);
    apercuBadgesTb = (badgesRecentsTb || []).map(b => b.badges?.nom).filter(Boolean);
    apercuDevoirsTb = (devoirsAVenirTb || []).map(d => `${d.titre} — ${new Date(d.date_limite).toLocaleDateString('fr-FR')}`);
  }

  const contenuCommunHaut = `
    <div class="profile-card-eleve">
      <h2 style="margin:0">👋 Content de te revoir, ${echapperTb(profil.prenom)} !</h2>
      <p style="color:var(--text-gris);margin:6px 0 0">${nomClasse ? `Classe : ${echapperTb(nomClasse)}` : ''}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
        <span style="font-size:14px;font-weight:600">Avancement dans le programme</span>
        <span style="font-weight:700;color:var(--bleu-kekeli)">${progressionPct}%</span>
      </div>
      <div class="progress-bar-bg-eleve"><div class="progress-bar-fill-eleve" style="width:${progressionPct}%"></div></div>
    </div>

    <div class="section-title-eleve" style="margin-bottom:2px">🎯 Paliers d'agilité</div>
    <p style="margin:0 0 12px;font-size:12px;color:var(--text-gris)">Ton niveau de maîtrise actuel, selon les activités réussies par palier dans chaque séance.</p>
    <div class="grille-paliers-tb">
      ${Object.entries(LIBELLES_PALIER_TB).map(([code, info]) => `
        <a href="matiere.html" class="palier-card-tb ${niveauActuel === code ? 'courant' : ''}" style="border-color:${info.couleur}">
          <div style="font-size:2rem;margin-bottom:.3rem">${info.icone}</div>
          <div style="font-weight:800">${info.nom}</div>
          <div style="font-size:12px;color:var(--text-gris)">${info.desc}${niveauActuel === code ? ' · Ton niveau actuel' : ''}</div>
        </a>`).join('')}
    </div>
  `;

  const carteMesCours = `
    <a href="matiere.html" class="carte-action-tb disponible carte-apercu-hover" style="text-decoration:none;color:inherit">
      <div class="icone-action-tb">📖</div>
      <h3>Mes cours</h3>
      <p>Découvrir les leçons de ta classe.</p>
      ${bulleApercuHtml('Tes matières', apercuMatieresTb)}
    </a>
    <a href="badges.html" class="carte-action-tb disponible carte-apercu-hover" style="text-decoration:none;color:inherit;display:block">
      <div class="icone-action-tb">🎯</div>
      <h3>Mes badges</h3>
      <p>Voir les badges que tu as obtenus.</p>
      ${bulleApercuHtml('Tes derniers badges', apercuBadgesTb)}
    </a>
    <a href="devoirs-notes.html" class="carte-action-tb disponible carte-apercu-hover" style="text-decoration:none;color:inherit;display:block">
      <div class="icone-action-tb">📊</div>
      <h3>Mes notes et devoirs</h3>
      <p>Voir mes devoirs à rendre et mes notes.</p>
      ${bulleApercuHtml('Devoirs à venir', apercuDevoirsTb)}
    </a>
  `;

  // Le look premium (voir css/theme-premium-eleve.css) remplace la colonne
  // de droite "stat-item" par un panneau plus visuel (donut de progression,
  // badges récents, série, aide) — même donnée déjà chargée ci-dessus,
  // aucune requête supplémentaire. Le formatage gratuit garde exactement
  // sa mise en page d'origine (dashboard-grid-eleve + widget-eleve).
  const estPremiumTb = document.body.classList.contains('theme-premium-actif');
  const badgesRecentsTb = (badgesRecentsIconesTb || []).filter(b => b.badges);

  document.getElementById('contenu').innerHTML = estPremiumTb ? `
    ${contenuCommunHaut}
    <div class="prem-mise-en-page-liste">
      <div>
        <div class="widget-eleve">
          <div class="section-title-eleve">👩‍🏫 Mes enseignants</div>
          ${enseignantsSuivis.length ? `<ul style="color:var(--text-gris);padding-left:20px;margin:0">
            ${enseignantsSuivis.map(a => `<li>${echapperTb(a.enseignants?.profils?.prenom || '')} ${echapperTb(a.enseignants?.profils?.nom || '')}</li>`).join('')}
          </ul>` : `<p style="color:var(--text-gris);margin:0">Aucun enseignant ne te suit pour l'instant.</p>`}
        </div>
        <div class="grille-actions-tb">${carteMesCours}</div>
      </div>
      <div class="prem-panneau-lateral">
        <div class="prem-carte-panneau">
          <h3>Mon avancement</h3>
          <div class="prem-donut" style="background:conic-gradient(var(--prem-primaire) ${progressionPct * 3.6}deg, var(--prem-primaire-clair) 0deg)">
            <div class="prem-donut-centre"><div class="prem-donut-pct">${progressionPct}%</div><div class="prem-donut-label">complété</div></div>
          </div>
          <div class="prem-stat-mini"><span>Niveau d'agilité</span><strong>${niveauActuel ? LIBELLES_PALIER_TB[niveauActuel].nom : 'Azɔ̀ví'}</strong></div>
          <div class="prem-stat-mini"><span>Badges obtenus</span><strong>${nbBadges || 0}</strong></div>
        </div>
        <div class="prem-carte-panneau">
          <h3>🏅 Mes badges récents</h3>
          <div class="prem-badges-mini">
            ${badgesRecentsTb.length ? badgesRecentsTb.map(b => `<span class="prem-badge-mini" title="${echapperTb(b.badges.nom)}">${echapperTb(b.badges.icone) || '🏅'}</span>`).join('') : '<p style="font-size:12px;color:var(--text-gris);margin:0">Pas encore de badge — continue tes efforts !</p>'}
          </div>
        </div>
        <div class="prem-carte-panneau prem-carte-serie">
          <h3>🔥 Garde le rythme !</h3>
          <p style="margin:0;font-size:13px">${serie > 0 ? `${serie} jour${serie > 1 ? 's' : ''} consécutif${serie > 1 ? 's' : ''} — continue comme ça !` : "Commence une séance aujourd'hui pour démarrer ta série !"}</p>
        </div>
        <div class="prem-carte-panneau prem-carte-aide">
          <h3>Besoin d'aide ?</h3>
          <p style="font-size:12px;color:var(--text-gris);margin:0 0 4px">Demande à ton enseignant ou à un adulte de la maison.</p>
          ${derniere ? `<a href="seance.html?id=${derniere.seance_id}" class="prem-btn-commencer">▶️ Reprendre ma leçon</a>` : ''}
        </div>
      </div>
    </div>
  ` : `
    ${contenuCommunHaut}
    <div class="dashboard-grid-eleve">
      <main>
        <div class="widget-eleve">
          <div class="section-title-eleve">👩‍🏫 Mes enseignants</div>
          ${enseignantsSuivis.length ? `<ul style="color:var(--text-gris);padding-left:20px;margin:0">
            ${enseignantsSuivis.map(a => `<li>${echapperTb(a.enseignants?.profils?.prenom || '')} ${echapperTb(a.enseignants?.profils?.nom || '')}</li>`).join('')}
          </ul>` : `<p style="color:var(--text-gris);margin:0">Aucun enseignant ne te suit pour l'instant.</p>`}
        </div>

        <div class="grille-actions-tb">${carteMesCours}</div>
      </main>

      <aside>
        <div class="widget-eleve">
          <div class="section-title-eleve">🏆 Mes récompenses</div>
          <div class="stat-item-eleve"><span>Série d'étude</span><strong>${serie > 0 ? `🔥 ${serie} jour${serie > 1 ? 's' : ''}` : '—'}</strong></div>
          <div class="stat-item-eleve"><span>Badges obtenus</span><strong>${nbBadges || 0}</strong></div>
          <div class="stat-item-eleve"><span>Niveau d'agilité</span><strong>${niveauActuel ? LIBELLES_PALIER_TB[niveauActuel].nom : 'Azɔ̀ví (débutant)'}</strong></div>
        </div>
        <div class="widget-eleve">
          <div class="section-title-eleve">📚 Dernier cours consulté</div>
          ${derniere ? `
            <p style="font-weight:600;margin:0 0 10px">${echapperTb(derniere.seances?.titre || '')}</p>
            <a href="seance.html?id=${derniere.seance_id}" class="btn btn-filled" style="display:block;text-align:center">Reprendre</a>
          ` : `<p style="color:var(--text-gris);margin:0">Tu n'as pas encore commencé de séance.</p>`}
        </div>
      </aside>
    </div>
  `;
})();

function calculerSerieJoursTB(horodatages) {
  if (!horodatages.length) return 0;
  const jours = [...new Set(horodatages.map(h => new Date(h).toISOString().slice(0, 10)))].sort().reverse();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (jours[0] !== aujourdhui && jours[0] !== hier) return 0;
  let serie = 1;
  for (let i = 0; i < jours.length - 1; i++) {
    const diff = (new Date(jours[i]) - new Date(jours[i + 1])) / 86400000;
    if (diff === 1) serie++; else break;
  }
  return serie;
}

function echapperTb(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
