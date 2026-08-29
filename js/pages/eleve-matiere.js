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

  if (champId) {
    const { data: champ } = await supabaseClient.from('champs_formation').select('id, nom, code').eq('id', champId).single();
    if (champ) {
      etatMat.champ = champ;
      if (noeudId) etatMat.cheminNoeuds = await remonterAncetresNoeudMat(parseInt(noeudId, 10));
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
      if (i === 1) { etatMat.cheminNoeuds = []; etatMat.sa = null; afficherNiveau(); return; }
      // i - 2 = index dans cheminNoeuds du niveau cliqué : on tronque la
      // chaîne à ce niveau (inclus) et on réaffiche ses propres enfants.
      etatMat.cheminNoeuds = etatMat.cheminNoeuds.slice(0, i - 1);
      etatMat.sa = null;
      afficherNiveau();
    });
  });
}

async function afficherChamps() {
  const conteneur = document.getElementById('contenu');
  conteneur.innerHTML = filArianeMat([{ label: '🏠 Mes matières' }]) + '<div class="chargement">Chargement...</div>';

  const { data } = await supabaseClient
    .from('classes_champs_formation').select('champs_formation(id, nom, code)').eq('classe_id', classeIdEleve);
  const champs = (data || []).map(d => d.champs_formation);

  conteneur.innerHTML = `
    ${filArianeMat([{ label: '🏠 Mes matières' }])}
    <div class="carte-bienvenue"><h1 style="margin:0">Choisis une matière</h1></div>
    <div class="grille-champs-eleve" id="grilleChampsMat">
      ${champs.map(c => `<div class="carte-champ-eleve" data-champ-id="${c.id}">
        <div class="icone-champ-eleve">${(PRESENTATION_CHAMPS_ELEVE[c.code] || {}).icone || '📘'}</div>
        <strong>${echapper(c.nom)}</strong>
      </div>`).join('') || '<p style="color:var(--text-gris)">Aucune matière pour ta classe pour l\'instant.</p>'}
    </div>
  `;
  attacherFilAriane();
  document.getElementById('grilleChampsMat').querySelectorAll('[data-champ-id]').forEach(el => {
    el.addEventListener('click', () => {
      etatMat.champ = champs.find(c => String(c.id) === el.dataset.champId);
      etatMat.cheminNoeuds = [];
      etatMat.sa = null;
      afficherNiveau();
    });
  });
}

// Affiche le contenu d'un niveau de l'arborescence (les sous-niveaux et/ou
// les SA rattachées directement à ce niveau) — ou, quand cheminNoeuds est
// vide, les niveaux racine de la matière choisie.
async function afficherNiveau() {
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
  const conteneur = document.getElementById('contenu');
  const segments = segmentsArianeMat();
  conteneur.innerHTML = filArianeMat(segments) + '<div class="chargement">Chargement...</div>';

  const { data: seances } = await supabaseClient.rpc('etat_seances_sa', {
    p_eleve_id: profilEleveMat.id, p_sa_id: etatMat.sa.id
  });

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
            ${s.discipline ? `<div style="font-size:12px;color:var(--text-gris)">${echapper(s.discipline)}</div>` : ''}
          </div>
          <div>${bouton}</div>
        </div>`;
      }).join('') || '<p style="color:var(--text-gris)">Aucune séance pour l\'instant.</p>'}
    </div>
  `;
  attacherFilAriane();
}

function echapper(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
