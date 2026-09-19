// Page pages/eleve/mes-progres.html
// Nouvelle page "Mes progrès" (19 septembre 2026, demande "Active les pages
// mes progrès et favoris. Mes progrès affiche la courbe de progression" +
// clarification AskUserQuestion, réponse "Les deux") : une courbe de
// progression DANS LE TEMPS (nombre cumulé de séances terminées, semaine
// après semaine) EN PLUS d'un détail de progression PAR MATIÈRE (même
// principe que l'avancement global déjà affiché sur le tableau de bord —
// voir progressionPct dans js/pages/eleve-tableau-de-bord.js — mais
// recalculé ICI matière par matière). Aucune nouvelle table : tout est
// recalculé à partir de données déjà existantes (seances_terminees,
// noeuds_parcours, sa, seances). Courbe dessinée à la main en SVG (aucune
// bibliothèque de graphiques n'est utilisée sur ce projet).

let profilProgresEleve = null;

(async function () {
  profilProgresEleve = await requireRole('eleve');
  if (!profilProgresEleve) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilProgresEleve.id, badgeHtml: `🟢 ${echapperProgresEleve(profilProgresEleve.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const conteneur = document.getElementById('contenu');

  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilProgresEleve.id).maybeSingle();
  if (!fiche?.classe_id) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Aucune classe ne t\'est encore associée — demande à un adulte de vérifier ton inscription.</p>';
    return;
  }

  const [{ data: champsLies }, { data: noeudsClasse }, { data: terminees }] = await Promise.all([
    supabaseClient.from('classes_champs_formation').select('champs_formation(id, nom, code)').eq('classe_id', fiche.classe_id),
    supabaseClient.from('noeuds_parcours').select('id, champ_formation_id').eq('classe_id', fiche.classe_id),
    supabaseClient.from('seances_terminees').select('seance_id, termine_le').eq('eleve_id', profilProgresEleve.id),
  ]);
  const champs = (champsLies || []).map(c => c.champs_formation).filter(Boolean);
  const idsNoeuds = (noeudsClasse || []).map(n => n.id);
  const champParNoeud = new Map((noeudsClasse || []).map(n => [n.id, n.champ_formation_id]));

  const { data: saClasse } = idsNoeuds.length
    ? await supabaseClient.from('sa').select('id, noeud_id').in('noeud_id', idsNoeuds)
    : { data: [] };
  const champParSA = new Map((saClasse || []).map(s => [s.id, champParNoeud.get(s.noeud_id)]));
  const idsSA = (saClasse || []).map(s => s.id);

  const { data: seancesPubliees } = idsSA.length
    ? await supabaseClient.from('seances').select('id, sa_id').eq('statut', 'publie').in('sa_id', idsSA)
    : { data: [] };
  const champParSeance = new Map((seancesPubliees || []).map(s => [s.id, champParSA.get(s.sa_id)]));

  const idsTermineesPubliees = (terminees || [])
    .map(t => t.seance_id)
    .filter(id => champParSeance.has(id));

  // Détail par matière : compte des séances publiées / terminées propres à
  // chaque champ (jamais un simple total global divisé arbitrairement).
  const detailParChamp = champs.map(champ => {
    const totalPublie = (seancesPubliees || []).filter(s => champParSeance.get(s.id) === champ.id).length;
    const totalTermine = idsTermineesPubliees.filter(id => champParSeance.get(id) === champ.id).length;
    const pct = totalPublie ? Math.min(100, Math.round((totalTermine / totalPublie) * 100)) : 0;
    return { champ, totalPublie, totalTermine, pct };
  });

  const pointsCourbe = construireDonneesCourbeProgres((terminees || []).map(t => t.termine_le));

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1>📈 Mes progrès</h1>
      <p>Ta progression dans le temps, et le détail matière par matière.</p>
    </div>

    <div class="section-title-eleve">Ma progression dans le temps</div>
    <div class="widget-eleve">
      ${rendreCourbeProgres(pointsCourbe)}
    </div>

    <div class="section-title-eleve" style="margin-top:22px">Ma progression par matière</div>
    <div class="widget-eleve">
      ${detailParChamp.length ? detailParChamp.map(d => `
        <div class="progres-ligne-matiere">
          <div class="progres-ligne-matiere-entete">
            <span>${(typeof PRESENTATION_CHAMPS_PREMIUM !== 'undefined' && PRESENTATION_CHAMPS_PREMIUM[d.champ.code] && PRESENTATION_CHAMPS_PREMIUM[d.champ.code].icone) || '📘'} ${echapperProgresEleve(d.champ.nom)}</span>
            <strong>${d.pct}%</strong>
          </div>
          <div class="progress-bar-bg-eleve"><div class="progress-bar-fill-eleve" style="width:${d.pct}%"></div></div>
          <div class="progres-ligne-matiere-compte">${d.totalTermine} / ${d.totalPublie} séance${d.totalPublie > 1 ? 's' : ''} terminée${d.totalTermine > 1 ? 's' : ''}</div>
        </div>
      `).join('') : '<p style="color:var(--text-gris);margin:0">Aucune matière associée à ta classe pour l\'instant.</p>'}
    </div>
  `;
})();

// Regroupe les dates de fin de séance par semaine (lundi comme 1er jour),
// cumule le nombre de séances terminées semaine après semaine (le cumul
// n'est JAMAIS remis à zéro : il inclut tout l'historique antérieur, même
// quand on ne garde ensuite que les dernières semaines pour l'affichage),
// et ne conserve que les 10 dernières semaines pour rester lisible.
function construireDonneesCourbeProgres(dates) {
  if (!dates || !dates.length) return [];
  const parJour = {};
  dates.forEach(d => {
    const jour = (d || '').slice(0, 10);
    if (!jour) return;
    parJour[jour] = (parJour[jour] || 0) + 1;
  });
  const parSemaine = {};
  Object.keys(parJour).sort().forEach(jour => {
    const dt = new Date(jour + 'T00:00:00');
    const decalage = (dt.getDay() + 6) % 7; // 0 = lundi
    const lundi = new Date(dt);
    lundi.setDate(dt.getDate() - decalage);
    const cle = lundi.toISOString().slice(0, 10);
    parSemaine[cle] = (parSemaine[cle] || 0) + parJour[jour];
  });
  const semaines = Object.keys(parSemaine).sort();
  let cumul = 0;
  const points = semaines.map(cle => { cumul += parSemaine[cle]; return { semaine: cle, cumul }; });
  const NB_MAX_SEMAINES_COURBE = 10;
  return points.length > NB_MAX_SEMAINES_COURBE ? points.slice(points.length - NB_MAX_SEMAINES_COURBE) : points;
}

function rendreCourbeProgres(points) {
  if (points.length < 2) {
    return `<p style="text-align:center;color:var(--text-gris);margin:20px 0">
      ${points.length === 1 ? "Continue à terminer des séances pour voir ta courbe apparaître !" : "Termine ta première séance pour commencer ta courbe de progression !"}
    </p>`;
  }
  const largeur = 640, hauteur = 200, marge = 30;
  const maxCumul = Math.max(...points.map(p => p.cumul), 1);
  const pas = (largeur - marge * 2) / (points.length - 1);
  const coord = (i, valeur) => {
    const x = marge + i * pas;
    const y = hauteur - marge - (valeur / maxCumul) * (hauteur - marge * 2);
    return [x, y];
  };
  const chemin = points.map((p, i) => coord(i, p.cumul).join(',')).join(' ');
  const cercles = points.map((p, i) => {
    const [x, y] = coord(i, p.cumul);
    return `<circle cx="${x}" cy="${y}" r="4" fill="var(--bleu-kekeli)"></circle>`;
  }).join('');
  const etiquettes = points.map((p, i) => {
    const [x] = coord(i, p.cumul);
    const dt = new Date(p.semaine + 'T00:00:00');
    const libelle = dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    return `<text x="${x}" y="${hauteur - 6}" font-size="10" text-anchor="middle" fill="var(--text-gris)">${libelle}</text>`;
  }).join('');
  return `
    <svg viewBox="0 0 ${largeur} ${hauteur}" class="progres-svg-courbe" role="img" aria-label="Courbe du nombre de séances terminées au fil des semaines">
      <polyline points="${chemin}" fill="none" stroke="var(--bleu-kekeli)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${cercles}
      ${etiquettes}
    </svg>
    <p style="text-align:center;color:var(--text-gris);font-size:13px;margin:6px 0 0">Nombre total de séances terminées, semaine après semaine</p>
  `;
}

function echapperProgresEleve(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
