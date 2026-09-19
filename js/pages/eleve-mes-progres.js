// Page pages/eleve/mes-progres.html
// Nouvelle page "Mes progrès" (19 septembre 2026, demande "Active les pages
// mes progrès et favoris. Mes progrès affiche la courbe de progression" +
// clarification AskUserQuestion, réponse "Les deux") : une courbe de
// progression DANS LE TEMPS EN PLUS d'un détail de progression PAR MATIÈRE
// (même principe que l'avancement global déjà affiché sur le tableau de
// bord — voir progressionPct dans js/pages/eleve-tableau-de-bord.js — mais
// recalculé ICI matière par matière). Aucune nouvelle table : tout est
// recalculé à partir de données déjà existantes (seances_terminees,
// noeuds_parcours, sa, seances). Courbe dessinée à la main en SVG (aucune
// bibliothèque de graphiques n'est utilisée sur ce projet).
//
// Courbe revue le même jour suite à "La courbe du progrès est trop
// simpliste. Je veux un vrai graphe progressif au cours de l'année" :
// remplace le cumul "10 dernières semaines" par un vrai suivi de l'ANNÉE
// SCOLAIRE en cours (septembre à juin), un point par mois, avec courbe
// lissée, zone remplie, grille et repères d'axes — toujours en SVG fait
// main, mais avec un rendu de graphique complet.

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

// Les 10 mois d'une année scolaire type (septembre à juin), dans l'ordre —
// septembre = mois calendaire 8 (0-indexé), d'où le calcul ci-dessous.
const MOIS_ANNEE_SCOLAIRE_PROGRES = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin'];

// Cumule le nombre de séances terminées mois après mois, DEPUIS LE DÉBUT DE
// L'ANNÉE SCOLAIRE EN COURS (le cumul repart donc à 0 à chaque rentrée de
// septembre — "un vrai graphe progressif au cours de l'année", pas un
// cumul de toute la scolarité). Un seul point par mois déjà entamé
// (septembre → mois courant inclus) ; les mois pas encore atteints
// n'ont pas de point (mais restent affichés sur l'axe, voir
// rendreCourbeProgres) — la courbe s'arrête donc à "aujourd'hui".
function construireDonneesCourbeProgres(dates) {
  const aujourdhui = new Date();
  const anneeDebut = aujourdhui.getMonth() >= 8 ? aujourdhui.getFullYear() : aujourdhui.getFullYear() - 1;
  const debutAnneeScolaire = `${anneeDebut}-09-01`;
  const moisCourantAbsolu = aujourdhui.getFullYear() * 12 + aujourdhui.getMonth();
  const debutAnneeScolaireAbsolu = anneeDebut * 12 + 8; // septembre = mois 8

  const parJour = {};
  (dates || []).forEach(d => {
    const jour = (d || '').slice(0, 10);
    if (!jour || jour < debutAnneeScolaire) return; // hors année scolaire en cours
    parJour[jour] = (parJour[jour] || 0) + 1;
  });
  const joursTries = Object.keys(parJour).sort();

  let curseur = 0;
  let cumul = 0;
  const points = [];
  for (let i = 0; i < MOIS_ANNEE_SCOLAIRE_PROGRES.length; i++) {
    const moisAbsolu = debutAnneeScolaireAbsolu + i;
    if (moisAbsolu > moisCourantAbsolu) break; // mois pas encore atteint
    const anneeMois = Math.floor(moisAbsolu / 12);
    const moisCalendaire = moisAbsolu % 12;
    const estMoisCourant = moisAbsolu === moisCourantAbsolu;
    const borneJour = (estMoisCourant ? aujourdhui : new Date(anneeMois, moisCalendaire + 1, 0)).toISOString().slice(0, 10);
    while (curseur < joursTries.length && joursTries[curseur] <= borneJour) {
      cumul += parJour[joursTries[curseur]];
      curseur++;
    }
    points.push({ moisIndex: i, cumul, estMoisCourant });
  }
  return points;
}

// Arrondit une valeur maximale à un palier "propre" pour des graduations
// lisibles (1/2/5 × une puissance de 10) — évite des graduations du genre
// "0, 3.4, 6.8...".
function maxNiceProgres(valeur) {
  if (valeur <= 4) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(valeur)));
  const normalise = valeur / magnitude;
  const palier = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
  return palier * magnitude;
}

// Courbe lissée (Catmull-Rom → Béziers cubiques, tension standard) pour un
// rendu de "vrai graphique" plutôt qu'une ligne brisée point à point.
function cheminLisseProgres(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function rendreCourbeProgres(points) {
  const largeur = 700, hauteur = 280;
  const margeGauche = 34, margeDroite = 14, margeHaut = 16, margeBas = 30;
  const zoneX0 = margeGauche, zoneX1 = largeur - margeDroite;
  const zoneY0 = margeHaut, zoneY1 = hauteur - margeBas;
  const nbMois = MOIS_ANNEE_SCOLAIRE_PROGRES.length;
  const xMois = (i) => zoneX0 + (i / (nbMois - 1)) * (zoneX1 - zoneX0);

  const maxCumul = maxNiceProgres(Math.max(...points.map(p => p.cumul), 1));
  const yValeur = (v) => zoneY1 - (v / maxCumul) * (zoneY1 - zoneY0);

  // Grille + graduations Y (0/25/50/75/100 % du maximum "propre").
  const grille = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = zoneY1 - f * (zoneY1 - zoneY0);
    const valeur = Math.round(f * maxCumul);
    return `<line x1="${zoneX0}" y1="${y}" x2="${zoneX1}" y2="${y}" stroke="var(--bordure)" stroke-width="1" stroke-dasharray="${f === 0 ? '0' : '3,3'}"></line>
      <text x="${zoneX0 - 8}" y="${y + 3}" font-size="10" text-anchor="end" fill="var(--text-gris)">${valeur}</text>`;
  }).join('');

  // Repères des 10 mois de l'année scolaire, TOUJOURS tous affichés (même
  // ceux pas encore atteints), pour que le graphe montre bien "l'année"
  // entière et pas seulement les données déjà là.
  const axeMois = MOIS_ANNEE_SCOLAIRE_PROGRES.map((libelle, i) => {
    const atteint = points.some(p => p.moisIndex === i);
    return `<text x="${xMois(i)}" y="${hauteur - 8}" font-size="10.5" text-anchor="middle" fill="${atteint ? 'var(--text-gris)' : 'var(--bordure)'}">${libelle}</text>`;
  }).join('');

  if (!points.length) {
    return `
      <svg viewBox="0 0 ${largeur} ${hauteur}" class="progres-svg-courbe" role="img" aria-label="Graphique de progression de l'année scolaire, pas encore de données">
        ${grille}${axeMois}
      </svg>
      <p style="text-align:center;color:var(--text-gris);font-size:13px;margin:6px 0 0">Termine ta première séance pour commencer ta courbe de progression !</p>
    `;
  }

  const coordPoints = points.map(p => [xMois(p.moisIndex), yValeur(p.cumul)]);

  if (points.length === 1) {
    const [x, y] = coordPoints[0];
    return `
      <svg viewBox="0 0 ${largeur} ${hauteur}" class="progres-svg-courbe" role="img" aria-label="Graphique de progression de l'année scolaire">
        ${grille}${axeMois}
        <circle cx="${x}" cy="${y}" r="5" fill="var(--bleu-kekeli)"><title>${points[0].cumul} séance${points[0].cumul > 1 ? 's' : ''} terminée${points[0].cumul > 1 ? 's' : ''}</title></circle>
      </svg>
      <p style="text-align:center;color:var(--text-gris);font-size:13px;margin:6px 0 0">Ta courbe s'affichera au fil des mois — continue comme ça !</p>
    `;
  }

  const cheminCourbe = cheminLisseProgres(coordPoints);
  const cheminAire = `${cheminCourbe} L${coordPoints[coordPoints.length - 1][0]},${zoneY1} L${coordPoints[0][0]},${zoneY1} Z`;
  const dernierPoint = points[points.length - 1];
  const [xDernier, yDernier] = coordPoints[coordPoints.length - 1];

  const cercles = points.map((p, i) => {
    const [x, y] = coordPoints[i];
    const dernier = i === points.length - 1;
    return `<circle cx="${x}" cy="${y}" r="${dernier ? 5.5 : 3.5}" fill="${dernier ? 'var(--bleu-kekeli)' : 'white'}" stroke="var(--bleu-kekeli)" stroke-width="2"><title>${MOIS_ANNEE_SCOLAIRE_PROGRES[p.moisIndex]} — ${p.cumul} séance${p.cumul > 1 ? 's' : ''} terminée${p.cumul > 1 ? 's' : ''}</title></circle>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${largeur} ${hauteur}" class="progres-svg-courbe" role="img" aria-label="Graphique de progression de l'année scolaire : nombre cumulé de séances terminées, mois après mois">
      <defs>
        <linearGradient id="degradeProgresCourbe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--bleu-kekeli)" stop-opacity="0.32"></stop>
          <stop offset="100%" stop-color="var(--bleu-kekeli)" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${grille}
      <path d="${cheminAire}" fill="url(#degradeProgresCourbe)"></path>
      <path d="${cheminCourbe}" fill="none" stroke="var(--bleu-kekeli)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></path>
      ${cercles}
      <text x="${Math.min(xDernier + 8, largeur - 12)}" y="${Math.max(yDernier - 10, 12)}" font-size="11" font-weight="700" text-anchor="${xDernier > largeur - 60 ? 'end' : 'start'}" fill="var(--bleu-kekeli)">${dernierPoint.cumul}</text>
      ${axeMois}
    </svg>
    <p style="text-align:center;color:var(--text-gris);font-size:13px;margin:6px 0 0">Nombre cumulé de séances terminées depuis la rentrée, mois après mois</p>
  `;
}

function echapperProgresEleve(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
