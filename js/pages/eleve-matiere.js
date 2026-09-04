// Page pages/eleve/matiere.html
// Parcours de l'élève dans le contenu de sa classe : Matière → (niveaux de
// l'arborescence : Thème/Unité/Semaine/Dossier, selon la matière) → Situation
// d'Apprentissage → Séances, avec verrouillage séquentiel simple entre
// séances (etat_seances_sa). Les paliers d'agilité (azovi/devi/ogan/axosu)
// ne groupent plus les séances : ils gèrent le déblocage progressif des
// activités À L'INTÉRIEUR d'une séance — voir eleve-seance.js. Un élève ne
// voit jamais que le contenu publié de sa propre classe (RLS sur
// seances/blocs_seance).
//
// Chaque niveau de l'arborescence est cliquable (carte, et fil d'ariane) :
// on peut arriver directement sur un niveau précis via les paramètres d'URL
// ?champId=&noeudId=&saId= — utilisé par le fil d'ariane de la page séance
// (js/pages/eleve-seance.js) pour permettre de remonter à n'importe quel
// niveau depuis une séance.

let profilEleveMat = null;
let classeIdEleve = null;
let etatMat = { champ: null, cheminNoeuds: [], sa: null }; // cheminNoeuds : [{id, titre}] du plus haut au plus bas

const PRESENTATION_CHAMPS_ELEVE = {
  francais:     { icone: '📚' }, mathematique: { icone: '📐' }, es: { icone: '🌍' },
  est:          { icone: '🔬' }, ea: { icone: '🎨' }, eps: { icone: '⚽' }
};

(async function () {
  profilEleveMat = await requireRole('eleve');
  if (!profilEleveMat) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilEleveMat.id, badgeHtml: `🟢 ${echapper(profilEleveMat.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilEleveMat.id).single();
  classeIdEleve = fiche?.classe_id;
  if (!classeIdEleve) {
    document.getElementById('contenu').innerHTML = '<p style="text-align:center;color:var(--text-gris)">Aucune classe ne t\'est encore associée — demande à un adulte de vérifier ton inscription.</p>';
    return;
  }

  // Arrivée directe sur un niveau précis (depuis le fil d'ariane d'une séance).
  const params = new URLSearchParams(window.location.search);
  const champId = params.get('champId');
  const noeudId = params.get('noeudId');
  const saId = params.get('saId');

  const premiumMat = document.body.classList.contains('theme-premium-actif');

  if (champId) {
    const { data: champ } = await supabaseClient.from('champs_formation').select('id, nom, code').eq('id', champId).single();
    if (champ) {
      etatMat.champ = champ;
      if (noeudId) etatMat.cheminNoeuds = await remonterAncetresNoeudMat(parseInt(noeudId, 10));

      // Look premium : toujours la vue "hero + onglets Unité + chronologie
      // aplatie" du modèle fourni, quel que soit le point d'entrée (matière
      // seule depuis la sidebar, ou lien profond noeudId/saId depuis le fil
      // d'ariane d'une séance) — voir afficherMatierePremium ci-dessous.
      if (premiumMat) {
        if (etatMat.cheminNoeuds.length) {
          const onglet = ongletDepuisCheminMat(etatMat.cheminNoeuds);
          etatMat.cheminNoeuds = onglet ? [onglet] : [];
        }
        await afficherMatierePremium();
        return;
      }

      if (saId) {
        const { data: sa } = await supabaseClient.from('sa').select('*').eq('id', saId).single();
        if (sa) { etatMat.sa = sa; await afficherSeancesListe(); return; }
      }
      await afficherNiveau();
      return;
    }
  }

  afficherChamps();
})();

// Reflète l'état de navigation courant (champ/niveau/SA) dans l'URL, sans
// recharger la page — cette page pilote toute sa navigation en mémoire
// (etatMat), sans jamais toucher à l'URL une fois passée l'arrivée initiale
// (voir le bloc ?champId=&noeudId=&saId= en haut de ce fichier). Résultat :
// "📌 Épingler cette page" (js/entete-navigation.js), qui capture
// window.location.pathname+search au moment du clic, capturait toujours
// l'adresse d'arrivée (ou une adresse nue) — jamais l'endroit réellement
// affiché après avoir cliqué plus loin dans l'arborescence. Appelée au
// début de chacun des trois rendus d'écran (afficherChamps/afficherNiveau/
// afficherSeancesListe), qui sont le point de passage unique de tout
// changement de etatMat.
function synchroniserUrlMat() {
  const params = new URLSearchParams();
  if (etatMat.champ) params.set('champId', etatMat.champ.id);
  if (etatMat.cheminNoeuds.length) params.set('noeudId', etatMat.cheminNoeuds[etatMat.cheminNoeuds.length - 1].id);
  if (etatMat.sa) params.set('saId', etatMat.sa.id);
  const nouvelle = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  history.replaceState(null, '', nouvelle);
}

// Remonte la chaîne parent_id d'un noeud jusqu'à la racine (voir la fonction
// jumelle côté séance : eleve-seance.js#remonterCheminNoeudsEleve).
async function remonterAncetresNoeudMat(id) {
  const chemin = [];
  let n = id;
  let garde = 0;
  while (n && garde++ < 20) {
    const { data: noeud } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, titre').eq('id', n).single();
    if (!noeud) break;
    chemin.unshift({ id: noeud.id, titre: noeud.titre });
    n = noeud.parent_id;
  }
  return chemin;
}

function filArianeMat(segments) {
  return `<div class="fil-ariane-eleve">${segments.map((s, i) => {
    const dernier = i === segments.length - 1;
    return dernier ? `<span>${echapper(s.label)}</span>` : `<a data-fil-mat="${i}">${echapper(s.label)}</a> › `;
  }).join('')}</div>`;
}

function segmentsArianeMat() {
  const segments = [{ label: '🏠 Mes matières' }];
  if (etatMat.champ) segments.push({ label: etatMat.champ.nom });
  etatMat.cheminNoeuds.forEach(n => segments.push({ label: n.titre }));
  if (etatMat.sa) segments.push({ label: etatMat.sa.titre });
  return segments;
}

function attacherFilAriane() {
  document.querySelectorAll('[data-fil-mat]').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.filMat, 10);
      if (i === 0) { etatMat = { champ: null, cheminNoeuds: [], sa: null }; afficherChamps(); return; }
      if (i === 1) {
        etatMat.cheminNoeuds = [];
        etatMat.sa = null;
        if (document.body.classList.contains('theme-premium-actif')) { afficherMatierePremium(); return; }
        afficherNiveau();
        return;
      }
      // i - 2 = index dans cheminNoeuds du niveau cliqué : on tronque la
      // chaîne à ce niveau (inclus) et on réaffiche ses propres enfants.
      etatMat.cheminNoeuds = etatMat.cheminNoeuds.slice(0, i - 1);
      etatMat.sa = null;
      afficherNiveau();
    });
  });
}

async function afficherChamps() {
  synchroniserUrlMat();
  const conteneur = document.getElementById('contenu');
  conteneur.innerHTML = filArianeMat([{ label: '🏠 Mes matières' }]) + '<div class="chargement">Chargement...</div>';

  const { data } = await supabaseClient
    .from('classes_champs_formation').select('champs_formation(id, nom, code)').eq('classe_id', classeIdEleve);
  const champs = (data || []).map(d => d.champs_formation);

  // Aperçu au survol (Task #34) : les niveaux racine de chaque matière
  // (Thème/Unité/Semaine/Dossier selon la matière), pour un avant-goût du
  // contenu sans avoir à cliquer — voir js/apercu-survol.js.
  const idsChampsMat = champs.map(c => c.id);
  let racinesParChampMat = {};
  if (idsChampsMat.length) {
    const { data: racines } = await supabaseClient.from('noeuds_parcours')
      .select('titre, champ_formation_id').eq('classe_id', classeIdEleve).in('champ_formation_id', idsChampsMat).is('parent_id', null).order('ordre');
    (racines || []).forEach(n => { (racinesParChampMat[n.champ_formation_id] ??= []).push(n.titre); });
  }

  conteneur.innerHTML = `
    ${filArianeMat([{ label: '🏠 Mes matières' }])}
    <div class="carte-bienvenue"><h1 style="margin:0">Choisis une matière</h1></div>
    <div class="grille-champs-eleve" id="grilleChampsMat">
      ${champs.map(c => `<div class="carte-champ-eleve carte-apercu-hover" data-champ-id="${c.id}">
        <div class="icone-champ-eleve">${(PRESENTATION_CHAMPS_ELEVE[c.code] || {}).icone || '📘'}</div>
        <strong>${echapper(c.nom)}</strong>
        ${bulleApercuHtml('Au programme', (racinesParChampMat[c.id] || []).slice(0, 6), echapper)}
      </div>`).join('') || '<p style="color:var(--text-gris)">Aucune matière pour ta classe pour l\'instant.</p>'}
    </div>
  `;
  attacherFilAriane();
  document.getElementById('grilleChampsMat').querySelectorAll('[data-champ-id]').forEach(el => {
    el.addEventListener('click', () => {
      etatMat.champ = champs.find(c => String(c.id) === el.dataset.champId);
      etatMat.cheminNoeuds = [];
      etatMat.sa = null;
      if (document.body.classList.contains('theme-premium-actif')) { afficherMatierePremium(); return; }
      afficherNiveau();
    });
  });
}

// Affiche le contenu d'un niveau de l'arborescence (les sous-niveaux et/ou
// les SA rattachées directement à ce niveau) — ou, quand cheminNoeuds est
// vide, les niveaux racine de la matière choisie.
async function afficherNiveau() {
  synchroniserUrlMat();
  const conteneur = document.getElementById('contenu');
  const segments = segmentsArianeMat();
  conteneur.innerHTML = filArianeMat(segments) + '<div class="chargement">Chargement...</div>';

  const parentId = etatMat.cheminNoeuds.length ? etatMat.cheminNoeuds[etatMat.cheminNoeuds.length - 1].id : null;

  let requeteNoeuds = supabaseClient.from('noeuds_parcours').select('id, titre, type_noeud')
    .eq('classe_id', classeIdEleve).eq('champ_formation_id', etatMat.champ.id).order('ordre');
  requeteNoeuds = parentId ? requeteNoeuds.eq('parent_id', parentId) : requeteNoeuds.is('parent_id', null);
  const { data: noeuds } = await requeteNoeuds;

  let sas = [];
  if (parentId) {
    const { data } = await supabaseClient.from('sa').select('*').eq('noeud_id', parentId).order('ordre');
    sas = data || [];
  }

  conteneur.innerHTML = `
    ${filArianeMat(segments)}
    <div class="carte-bienvenue"><h1 style="margin:0">${echapper(etatMat.cheminNoeuds.length ? etatMat.cheminNoeuds[etatMat.cheminNoeuds.length - 1].titre : etatMat.champ.nom)}</h1></div>
    ${(noeuds && noeuds.length) ? `<div class="grille-champs-eleve" id="grilleNiveauxMat">${noeuds.map(n => `
      <div class="carte-champ-eleve" data-noeud-id="${n.id}">
        <div class="icone-champ-eleve">📂</div>
        <strong>${echapper(n.titre)}</strong>
      </div>`).join('')}</div>` : ''}
    ${(sas && sas.length) ? `<div class="grille-sa-eleve" id="grilleSaMat" style="margin-top:16px">${sas.map(s => `
      <div class="carte-sa-eleve" data-sa-id="${s.id}">
        <div>
          <div class="session-title-eleve">${s.numero ? `SA${s.numero} — ` : ''}${echapper(s.titre)}</div>
          ${s.description ? `<p style="margin:2px 0 0;font-size:13px;color:var(--text-gris)">${echapper(s.description)}</p>` : ''}
        </div>
        <span style="font-size:20px">➔</span>
      </div>`).join('')}</div>` : ''}
    ${(!noeuds || !noeuds.length) && (!sas || !sas.length) ? '<p style="color:var(--text-gris)">Rien à afficher ici pour l\'instant.</p>' : ''}
  `;
  attacherFilAriane();

  const grilleNiveaux = document.getElementById('grilleNiveauxMat');
  if (grilleNiveaux) grilleNiveaux.querySelectorAll('[data-noeud-id]').forEach(el => {
    el.addEventListener('click', () => {
      const n = noeuds.find(x => String(x.id) === el.dataset.noeudId);
      etatMat.cheminNoeuds.push(n);
      afficherNiveau();
    });
  });
  const grilleSA = document.getElementById('grilleSaMat');
  if (grilleSA) grilleSA.querySelectorAll('[data-sa-id]').forEach(el => {
    el.addEventListener('click', () => {
      etatMat.sa = sas.find(x => String(x.id) === el.dataset.saId);
      afficherSeancesListe();
    });
  });
}

async function afficherSeancesListe() {
  synchroniserUrlMat();
  const conteneur = document.getElementById('contenu');
  const segments = segmentsArianeMat();
  conteneur.innerHTML = filArianeMat(segments) + '<div class="chargement">Chargement...</div>';

  const { data: seances } = await supabaseClient.rpc('etat_seances_sa', {
    p_eleve_id: profilEleveMat.id, p_sa_id: etatMat.sa.id
  });

  // Le look premium (voir css/theme-premium-eleve.css) n'utilise jamais cette
  // fonction : le point d'entrée premium passe directement par
  // afficherMatierePremium (voir plus bas), qui prend en charge tous les
  // cas (matière seule, ou lien profond noeudId/saId) — voir le bloc
  // `if (premiumMat)` au tout début de ce fichier. Le formatage gratuit
  // garde exactement sa liste actuelle, inchangée.
  conteneur.innerHTML = `
    ${filArianeMat(segments)}
    <div class="subject-header">
      <div>
        <h1 style="margin:0 0 4px">${echapper(etatMat.sa.titre)}</h1>
        <p style="margin:0;color:var(--text-gris)">${(seances || []).length} séance${(seances || []).length > 1 ? 's' : ''}</p>
      </div>
    </div>
    <div class="session-list-eleve">
      ${(seances || []).map((s, i) => {
        const classe = s.verrouille ? 'locked' : s.termine ? 'completed' : 'active';
        const icone = s.verrouille ? '🔒' : s.termine ? '✅' : '▶️';
        const bouton = s.verrouille
          ? `<button class="btn-palier-eleve" style="background:var(--bordure);color:var(--text-gris);cursor:not-allowed" disabled>Verrouillé</button>`
          : `<a class="btn-palier-eleve" style="background:${s.termine ? '#22A559' : 'var(--bleu-kekeli)'}" href="seance.html?id=${s.id}">${s.termine ? 'Revoir' : 'Continuer'}</a>`;
        return `<div class="session-card-eleve ${classe}">
          <div class="session-icon-eleve">${icone}</div>
          <div class="session-content-eleve">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-gris)">Séance ${i + 1}</div>
            <div class="session-title-eleve">${echapper(s.titre)}</div>
            ${s.discipline ? `<span style="display:inline-block;margin-top:2px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:${iconeSeanceMat(s.discipline).couleur}22;color:${iconeSeanceMat(s.discipline).couleur}">${echapper(s.discipline)}</span>` : ''}
          </div>
          <div>${bouton}</div>
        </div>`;
      }).join('') || '<p style="color:var(--text-gris)">Aucune séance pour l\'instant.</p>'}
    </div>
  `;
  attacherFilAriane();
}

// ===== Look premium — vue "hero + onglets Unité + chronologie
// aplatie" du modèle fourni (kekeli_modele_dashboard.html), avec les
// matières et l'arborescence RÉELLES de la classe. Remplace, pour l'espace
// premium, tout le cheminement à niveaux (afficherNiveau/afficherSeancesListe
// ci-dessus, gardés inchangés pour le thème gratuit) par un point d'entrée
// unique une fois la matière choisie : les "onglets Unité" (voir
// ongletsMatierePremium) et, pour l'onglet actif, la liste aplatie de TOUTES
// les séances de ses SA descendantes (voir collecterSaDescendantesMat),
// quelle que soit la profondeur réelle de l'arborescence de la matière.
//
// Même structure de données déjà utilisée ailleurs (RPC etat_seances_sa,
// table seances_epinglees) : aucune nouvelle table, aucune nouvelle
// fonction serveur.

const STRUCTURES_IMPOSEES_ELEVE = { francais: ['theme', 'unite', 'semaine'] };

// Petit jeu d'icônes (voir ICONES_PREM/iconePrem, js/theme-premium-eleve.js)
// utilisé pour décorer chaque onglet Unité — purement décoratif (aucune
// signification pédagogique), cycle par position pour varier visuellement
// comme dans le modèle fourni (❤️/🛡️/👥/🎵 y jouent le même rôle).
const ICONES_ONGLET_UNITE_MAT = ['coeur', 'boussole', 'utilisateur', 'livreOuvert'];

// Depuis une chaîne d'ancêtres (remonterAncetresNoeudMat, du plus haut au
// plus bas), retrouve le noeud "onglet Unité" correspondant : le 2e niveau
// pour une matière à structure imposée à plusieurs niveaux (Français :
// Thème → Unité → Semaine ; l'onglet est l'Unité), ou le niveau racine pour
// toute autre matière (Mathématiques : Dossier, directement à la racine).
function ongletDepuisCheminMat(chemin) {
  const structure = STRUCTURES_IMPOSEES_ELEVE[etatMat.champ.code];
  if (structure && structure.length > 1 && chemin.length >= 2) return chemin[1];
  return chemin[0] || null;
}

// Liste des onglets "Unité" pour la matière courante (etatMat.champ) :
// - Structure imposée à plusieurs niveaux (Français) : toutes les Unités,
//   tous Thèmes confondus (2 thèmes réels actuellement), triées par ordre du
//   Thème parent puis ordre propre — pas d'écran "Thème" séparé : la
//   maquette n'a qu'une seule rangée d'onglets, donc on aplatit directement.
// - Sinon (Mathématiques, et toute matière future à un seul niveau) : les
//   noeuds racine eux-mêmes (ex: les Dossiers).
// `type_noeud` est conservé sur chaque onglet retourné : sert à composer le
// petit libellé "Unité 1"/"Dossier 1" affiché en gras dans la pilule (voir
// libellesOngletMat), la vraie SI (titre du noeud) restant affichée dessous.
async function ongletsMatierePremium() {
  const structure = STRUCTURES_IMPOSEES_ELEVE[etatMat.champ.code];
  if (structure && structure.length > 1) {
    const [{ data: racines }, { data: onglets }] = await Promise.all([
      supabaseClient.from('noeuds_parcours').select('id, ordre')
        .eq('classe_id', classeIdEleve).eq('champ_formation_id', etatMat.champ.id).eq('type_noeud', structure[0]).order('ordre'),
      supabaseClient.from('noeuds_parcours').select('id, titre, parent_id, ordre, type_noeud')
        .eq('classe_id', classeIdEleve).eq('champ_formation_id', etatMat.champ.id).eq('type_noeud', structure[1]).order('ordre'),
    ]);
    const ordreRacine = new Map((racines || []).map(r => [r.id, r.ordre]));
    return (onglets || []).slice().sort((a, b) =>
      (ordreRacine.get(a.parent_id) ?? 0) - (ordreRacine.get(b.parent_id) ?? 0) || a.ordre - b.ordre);
  }
  const { data: racines } = await supabaseClient.from('noeuds_parcours').select('id, titre, ordre, type_noeud')
    .eq('classe_id', classeIdEleve).eq('champ_formation_id', etatMat.champ.id).is('parent_id', null).order('ordre');
  return racines || [];
}

// Libellé en gras affiché dans la pilule d'onglet ("Unité 1", "Dossier 1"...)
// à partir du type_noeud réel du noeud et de sa position (1-based) dans la
// liste déjà aplatie/triée des onglets — jamais codé en dur par matière.
function libelleOrdinalOngletMat(typeNoeud, position) {
  const mot = (typeNoeud || 'Unité');
  return mot.charAt(0).toUpperCase() + mot.slice(1) + ' ' + position;
}

// Récupère, sous un noeud "onglet" donné, TOUTES les SA qui en dépendent —
// aussi profond que l'arborescence aille (récursif : gère aussi bien
// Français, où les SA sont sous Semaine, que Mathématiques, où les SA sont
// directement sous le Dossier, sans rien coder en dur sur la profondeur).
// `chemin` accumule les titres des noeuds intermédiaires traversés (hors
// onglet lui-même), pour construire le repère affiché sous chaque séance.
async function collecterSaDescendantesMat(noeudId, chemin) {
  const [{ data: saDirectes }, { data: enfants }] = await Promise.all([
    supabaseClient.from('sa').select('*').eq('noeud_id', noeudId).order('ordre'),
    supabaseClient.from('noeuds_parcours').select('id, titre, ordre').eq('parent_id', noeudId).order('ordre'),
  ]);
  let resultat = (saDirectes || []).map(sa => ({ sa, chemin }));
  for (const enfant of (enfants || [])) {
    resultat = resultat.concat(await collecterSaDescendantesMat(enfant.id, [...chemin, enfant.titre]));
  }
  return resultat;
}

// Icône + couleur de la vignette de chaque carte séance, devinées à partir
// du texte de discipline (mots-clés, accents ignorés) — purement pour
// varier visuellement comme dans le modèle fourni (livre rose/vocabulaire,
// livre ouvert bleu/lecture, plume verte/conjugaison...). Repli générique
// (planche orange) pour toute discipline qui ne correspond à aucun mot-clé.
const PALETTE_ICONE_SEANCE_MAT = [
  { motsCles: ['vocabulaire'], icone: 'livre', couleur: '#F43F5E' },
  { motsCles: ['lecture'], icone: 'livreOuvert', couleur: '#3B5EFF' },
  { motsCles: ['conjugaison', 'grammaire', 'orthographe'], icone: 'plume', couleur: '#22C55E' },
];
function normaliserTexteMat(texte) { return (texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function iconeSeanceMat(discipline) {
  const n = normaliserTexteMat(discipline);
  const trouve = PALETTE_ICONE_SEANCE_MAT.find(p => p.motsCles.some(m => n.includes(m)));
  return trouve || { icone: 'planche', couleur: '#F59E0B' };
}

const NB_SEANCES_INITIAL_MAT = 6;

async function afficherMatierePremium() {
  const conteneur = document.getElementById('contenu');
  conteneur.innerHTML = filArianeMat(segmentsArianeMat()) + '<div class="chargement">Chargement...</div>';

  const onglets = await ongletsMatierePremium();
  const infoChamp = PRESENTATION_CHAMPS_ELEVE[etatMat.champ.code] || {};

  if (!onglets.length) {
    synchroniserUrlMat();
    conteneur.innerHTML = filArianeMat(segmentsArianeMat()) + `
      <div class="prem-hero-matiere">
        <div class="prem-hero-matiere-texte">
          <div class="prem-hero-matiere-mini">${echapper(etatMat.champ.nom)}</div>
          <h1>Bientôt disponible</h1>
          <p>Aucun contenu n'est encore publié pour cette matière — reviens un peu plus tard !</p>
        </div>
        <div class="prem-hero-matiere-illustration">${infoChamp.icone || '📘'}</div>
      </div>`;
    attacherFilAriane();
    return;
  }

  const ongletActifId = etatMat.cheminNoeuds.length ? etatMat.cheminNoeuds[0].id : onglets[0].id;
  const ongletActif = onglets.find(o => o.id === ongletActifId) || onglets[0];
  const positionOngletActif = onglets.findIndex(o => o.id === ongletActif.id);
  etatMat.cheminNoeuds = [{ id: ongletActif.id, titre: ongletActif.titre }];
  synchroniserUrlMat();

  const entreesSa = await collecterSaDescendantesMat(ongletActif.id, []);
  const listesParSa = await Promise.all(entreesSa.map(({ sa }) =>
    supabaseClient.rpc('etat_seances_sa', { p_eleve_id: profilEleveMat.id, p_sa_id: sa.id })
  ));
  const [{ data: pins }, { data: titresContenu }] = await Promise.all([
    supabaseClient.from('seances_epinglees').select('seance_id').eq('utilisateur_id', profilEleveMat.id),
    // 🔖 "Titre du contenu" (seances.titre_contenu) : pas renvoyé par
    // etat_seances_sa (qui ne porte que id/titre/ordre/discipline/termine/
    // verrouille) — récupéré séparément pour l'afficher en étiquette repère
    // (comme sur pages/seances.html), une fois qu'on connaît les id de séance.
    entreesSa.length
      ? supabaseClient.from('seances').select('id, titre_contenu').eq('sa_id', ongletActif.id) // filtré plus bas par id réel
      : Promise.resolve({ data: [] }),
  ]);
  const idsEpingles = new Set((pins || []).map(p => p.seance_id));

  let seances = [];
  entreesSa.forEach(({ sa, chemin }, i) => {
    const saLabel = sa.numero ? `SA ${sa.numero}` : sa.titre;
    (listesParSa[i].data || []).forEach(s => {
      seances.push({ ...s, chemin, saLabel, semaine: chemin[chemin.length - 1] || null, epinglee: idsEpingles.has(s.id) });
    });
  });
  // Complète titre_contenu séance par séance (la requête groupée ci-dessus ne
  // couvre qu'un sa_id à la fois par construction du schéma — on va donc
  // chercher, pour l'ensemble des séances déjà collectées, leur éventuel
  // repère en une seule requête .in(), plus fiable que le filtre approximatif
  // du Promise.all ci-dessus).
  if (seances.length) {
    const { data: reperes } = await supabaseClient.from('seances').select('id, titre_contenu').in('id', seances.map(s => s.id));
    const parId = new Map((reperes || []).map(r => [r.id, r.titre_contenu]));
    seances.forEach(s => { s.titreContenu = parId.get(s.id) || null; });
  }

  const total = seances.length;
  const termines = seances.filter(s => s.termine).length;
  const enCours = seances.filter(s => !s.termine && !s.verrouille).length;
  const aVenir = seances.filter(s => s.verrouille).length;
  const pct = total ? Math.round((termines / total) * 100) : 0;
  const semainesDispo = [...new Set(seances.map(s => s.semaine).filter(Boolean))];
  const typesDispo = [...new Set(seances.map(s => s.discipline).filter(Boolean))];

  const [{ data: badgesRecents }, { data: datesTerminees }] = await Promise.all([
    supabaseClient.from('badges_eleves').select('badges(nom, icone)').eq('eleve_id', profilEleveMat.id).order('attribue_le', { ascending: false }).limit(3),
    supabaseClient.from('seances_terminees').select('termine_le').eq('eleve_id', profilEleveMat.id)
  ]);
  const serieMat = calculerSerieJoursMat((datesTerminees || []).map(d => d.termine_le));
  const badgesRecentsMat = (badgesRecents || []).filter(b => b.badges);

  conteneur.innerHTML = `
    ${filArianeMat(segmentsArianeMat())}
    <div class="prem-hero-matiere">
      <div class="prem-hero-matiere-texte">
        <div class="prem-hero-matiere-mini">${echapper(etatMat.champ.nom)}</div>
        <h1>Explore, apprends<br>et progresse !</h1>
        <p>Découvre des séances interactives et amusantes.</p>
      </div>
      <div class="prem-hero-matiere-illustration">${infoChamp.icone || '📘'}</div>
    </div>

    ${onglets.length > 1 ? `<div class="prem-onglets-rangee">
      <button type="button" class="prem-onglets-fleche" id="premOngletsGauche" aria-label="Défiler vers la gauche">${iconePrem('chevronGauche', 16)}</button>
      <div class="prem-onglets-unite" id="premOngletsUnite">
        ${onglets.map((o, i) => `<button type="button" class="prem-onglet-unite${o.id === ongletActif.id ? ' actif' : ''}" data-onglet-noeud="${o.id}">
          <span class="prem-onglet-unite-icone">${iconePrem(ICONES_ONGLET_UNITE_MAT[i % ICONES_ONGLET_UNITE_MAT.length], 15)}</span>
          <span>
            <div class="prem-onglet-unite-titre">${echapper(libelleOrdinalOngletMat(o.type_noeud, i + 1))}</div>
            <div class="prem-onglet-unite-sous">${echapper(o.titre)}</div>
          </span>
        </button>`).join('')}
      </div>
      <button type="button" class="prem-onglets-fleche" id="premOngletsDroite" aria-label="Défiler vers la droite">${iconePrem('chevronDroite', 16)}</button>
    </div>` : ''}

    <div class="prem-barre-filtres">
      ${semainesDispo.length > 1 ? `<select id="premFiltreSemaineMat"><option value="">Toutes les semaines</option>${semainesDispo.map(s => `<option value="${echapper(s)}">${echapper(s)}</option>`).join('')}</select>` : ''}
      ${typesDispo.length > 1 ? `<select id="premFiltreTypeMat"><option value="">Tous les types</option>${typesDispo.map(t => `<option value="${echapper(t)}">${echapper(t)}</option>`).join('')}</select>` : ''}
      <div class="prem-champ-recherche-mat">${iconePrem('recherche', 15)}<input type="search" id="premRechercheMat" placeholder="Rechercher une séance..."></div>
      <select id="premTriSeancesMat">
        <option value="ordre">Ordre du parcours</option>
        <option value="alpha">Alphabétique</option>
      </select>
      <div class="prem-vue-toggle">
        <button type="button" class="actif" id="premVueDetaillee" title="Vue détaillée">${iconePrem('grille', 15)}</button>
        <button type="button" id="premVueCompacte" title="Vue compacte">${iconePrem('liste', 15)}</button>
      </div>
    </div>

    <div class="prem-mise-en-page-liste">
      <div>
        <div class="prem-liste-seances" id="premListeSeancesMat"></div>
        <button type="button" class="prem-lien-voir-plus" id="premVoirPlusMat" hidden>Voir plus de séances ${iconePrem('chevronBas', 13)}</button>
      </div>
      <div class="prem-panneau-lateral">
        <div class="prem-carte-panneau">
          <h3>Mon progrès en ${echapper(etatMat.champ.nom)}</h3>
          <div class="prem-donut" style="background:conic-gradient(var(--prem-bleu) ${pct * 3.6}deg, var(--prem-bleu-clair) 0deg)">
            <div class="prem-donut-centre"><div class="prem-donut-pct">${pct}%</div><div class="prem-donut-label">Progression</div></div>
          </div>
          <div class="prem-legende-progres">
            <div class="prem-legende-ligne"><span class="prem-legende-puce" style="background:var(--prem-bleu)"></span><strong>${termines}</strong> Séances terminées</div>
            <div class="prem-legende-ligne"><span class="prem-legende-puce" style="background:var(--prem-orange)"></span><strong>${enCours}</strong> En cours</div>
            <div class="prem-legende-ligne"><span class="prem-legende-puce" style="background:#B7BECF"></span><strong>${aVenir}</strong> À venir</div>
          </div>
          <button type="button" class="prem-btn-plein bientot" title="Bientôt disponible" onclick="return false">${iconePrem('progres', 15)} Voir mes progrès</button>
        </div>
        <div class="prem-carte-panneau">
          <h3>Mes badges récents</h3>
          <div class="prem-badges-mini">
            ${badgesRecentsMat.length ? badgesRecentsMat.map(b => `<span class="prem-badge-mini" title="${echapper(b.badges.nom)}">${echapper(b.badges.icone) || '🏅'}</span>`).join('') : '<p style="font-size:12px;color:var(--prem-texte-gris);margin:0">Pas encore de badge.</p>'}
          </div>
          <a class="prem-btn-contour" href="badges.html">Voir tous mes badges</a>
        </div>
        <div class="prem-carte-panneau prem-carte-serie">
          <div class="prem-carte-serie-emoji">🏆</div>
          <div class="prem-carte-serie-titre">${serieMat > 0 ? 'Garde le rythme !' : 'À toi de jouer !'}</div>
          <p class="prem-carte-serie-texte">${serieMat > 0 ? `Tu es sur la bonne voie. ${serieMat} jour${serieMat > 1 ? 's' : ''} consécutif${serieMat > 1 ? 's' : ''} !` : "Termine une séance aujourd'hui pour démarrer ta série !"}</p>
        </div>
        <div class="prem-carte-panneau prem-carte-aide">
          <div class="prem-carte-aide-icone">${iconePrem('casque', 22)}</div>
          <h3>Besoin d'aide ?</h3>
          <p>Consulte la fiche d'aide ou contacte ton enseignant.</p>
          <button type="button" class="prem-btn-contour bientot" title="Bientôt disponible" onclick="return false">Obtenir de l'aide</button>
        </div>
      </div>
    </div>
  `;

  attacherFilAriane();

  document.querySelectorAll('[data-onglet-noeud]').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = onglets.find(x => String(x.id) === btn.dataset.ongletNoeud);
      if (o) { etatMat.cheminNoeuds = [{ id: o.id, titre: o.titre }]; afficherMatierePremium(); }
    });
  });

  const rangeeOnglets = document.getElementById('premOngletsUnite');
  const btnOngletsGauche = document.getElementById('premOngletsGauche');
  const btnOngletsDroite = document.getElementById('premOngletsDroite');
  if (rangeeOnglets && btnOngletsGauche && btnOngletsDroite) {
    btnOngletsGauche.addEventListener('click', () => rangeeOnglets.scrollBy({ left: -220, behavior: 'smooth' }));
    btnOngletsDroite.addEventListener('click', () => rangeeOnglets.scrollBy({ left: 220, behavior: 'smooth' }));
    // Centre l'onglet actif visible au chargement (utile quand il y a plus
    // d'onglets que la largeur disponible).
    const boutonActif = rangeeOnglets.querySelector('.prem-onglet-unite.actif');
    if (boutonActif && positionOngletActif > 1) boutonActif.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  const conteneurListe = document.getElementById('premListeSeancesMat');
  const btnVoirPlus = document.getElementById('premVoirPlusMat');
  let seancesAffichees = 0;

  function rendreSectionListeMat(liste) {
    seancesAffichees = Math.min(NB_SEANCES_INITIAL_MAT, liste.length);
    conteneurListe.innerHTML = htmlListeSeancesPremiumMat(liste.slice(0, seancesAffichees), ongletActif.titre, positionOngletActif + 1);
    attacherEpinglageMat(liste);
    if (liste.length > seancesAffichees) {
      btnVoirPlus.hidden = false;
      btnVoirPlus.onclick = () => {
        seancesAffichees = liste.length;
        conteneurListe.innerHTML = htmlListeSeancesPremiumMat(liste, ongletActif.titre, positionOngletActif + 1);
        attacherEpinglageMat(liste);
        btnVoirPlus.hidden = true;
      };
    } else {
      btnVoirPlus.hidden = true;
    }
  }

  const champRecherche = document.getElementById('premRechercheMat');
  const selectTri = document.getElementById('premTriSeancesMat');
  const selectSemaine = document.getElementById('premFiltreSemaineMat');
  const selectType = document.getElementById('premFiltreTypeMat');
  function reappliquerFiltresMat() {
    const texte = (champRecherche.value || '').toLowerCase();
    let liste = seances.filter(s => (s.titre || '').toLowerCase().includes(texte));
    if (selectSemaine && selectSemaine.value) liste = liste.filter(s => s.semaine === selectSemaine.value);
    if (selectType && selectType.value) liste = liste.filter(s => s.discipline === selectType.value);
    if (selectTri.value === 'alpha') liste = [...liste].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    rendreSectionListeMat(liste);
  }
  if (champRecherche) champRecherche.addEventListener('input', reappliquerFiltresMat);
  if (selectTri) selectTri.addEventListener('change', reappliquerFiltresMat);
  if (selectSemaine) selectSemaine.addEventListener('change', reappliquerFiltresMat);
  if (selectType) selectType.addEventListener('change', reappliquerFiltresMat);

  const btnVueDetaillee = document.getElementById('premVueDetaillee');
  const btnVueCompacte = document.getElementById('premVueCompacte');
  if (btnVueDetaillee && btnVueCompacte) {
    btnVueDetaillee.addEventListener('click', () => {
      conteneurListe.classList.remove('compact');
      btnVueDetaillee.classList.add('actif'); btnVueCompacte.classList.remove('actif');
    });
    btnVueCompacte.addEventListener('click', () => {
      conteneurListe.classList.add('compact');
      btnVueCompacte.classList.add('actif'); btnVueDetaillee.classList.remove('actif');
    });
  }

  function attacherEpinglageMat(liste) {
    document.querySelectorAll('[data-epingler-mat]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.epinglerMat, 10);
        const s = (liste || seances).find(x => x.id === id);
        if (!s) return;
        if (s.epinglee) {
          await supabaseClient.from('seances_epinglees').delete().eq('utilisateur_id', profilEleveMat.id).eq('seance_id', id);
        } else {
          await supabaseClient.from('seances_epinglees').insert({ utilisateur_id: profilEleveMat.id, seance_id: id });
        }
        s.epinglee = !s.epinglee;
        const jumelle = seances.find(x => x.id === id);
        if (jumelle && jumelle !== s) jumelle.epinglee = s.epinglee;
        btn.classList.toggle('epinglee', s.epinglee);
        btn.title = s.epinglee ? 'Retirer des épinglées' : 'Épingler cette séance';
        btn.innerHTML = iconePrem(s.epinglee ? 'coeur' : 'coeur', 15);
      });
    });
  }
  rendreSectionListeMat(seances);
}

function htmlListeSeancesPremiumMat(seances, titreOnglet, positionOnglet) {
  return (seances || []).map((s, i) => {
    const classeItem = s.verrouille ? 'verrouille' : s.termine ? 'termine' : '';
    const { icone, couleur } = iconeSeanceMat(s.discipline);
    const boutonTexte = s.verrouille ? 'Verrouillé' : s.termine ? 'Revoir' : 'Commencer';
    const bouton = s.verrouille
      ? `<span class="prem-btn-commencer verrouille">${iconePrem('fermer', 13)} ${boutonTexte}</span>`
      : `<a class="prem-btn-commencer ${s.termine ? 'termine' : ''}" href="seance.html?id=${s.id}">${iconePrem('jouer', 12)} ${boutonTexte}</a>`;
    // "Thème : {onglet réel} • Unité N • {chemin intermédiaire...} • SA N" —
    // reproduit le repère à 4 segments du modèle fourni, en restant générique
    // (chemin/positionOnglet viennent des vraies données, jamais figés).
    const segmentsMeta = [
      titreOnglet ? `Thème : ${titreOnglet}` : null,
      positionOnglet ? `Unité ${positionOnglet}` : null,
      ...(s.chemin || []),
      s.saLabel,
    ].filter(Boolean);
    return `<div class="prem-timeline-item ${classeItem}">
      <div class="prem-timeline-num">${s.verrouille ? iconePrem('fermer', 13) : i + 1}</div>
      <div class="prem-carte-seance ${classeItem}">
        <div class="prem-carte-seance-icone" style="background:${couleur}">${iconePrem(icone, 20)}</div>
        <div class="prem-carte-seance-corps">
          <div class="prem-carte-seance-titre">${echapper(s.titre)}</div>
          <div class="prem-carte-seance-repere">${echapper(segmentsMeta.join(' • '))}</div>
          <div class="prem-tags-seance">
            ${s.discipline ? `<span class="prem-tag">${echapper(s.discipline)}</span>` : ''}
            ${s.titreContenu ? `<span class="prem-tag flag">${iconePrem('drapeau', 12)} ${echapper(s.titreContenu)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="prem-carte-seance-epingle${s.epinglee ? ' epinglee' : ''}" data-epingler-mat="${s.id}" title="${s.epinglee ? 'Retirer des épinglées' : 'Épingler cette séance'}">${iconePrem('coeur', 15)}</button>
        ${bouton}
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--prem-texte-gris)">Aucune séance pour l\'instant.</p>';
}

function calculerSerieJoursMat(horodatages) {
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

function echapper(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
