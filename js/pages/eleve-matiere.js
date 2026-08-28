// Page pages/eleve/matiere.html
// Parcours de l'élève dans le contenu de sa classe : Matière → Situation
// d'Apprentissage → Séances, avec verrouillage séquentiel simple entre
// séances (etat_seances_sa). Les paliers d'agilité (azovi/devi/ogan/axosu)
// ne groupent plus les séances : ils gèrent le déblocage progressif des
// activités À L'INTÉRIEUR d'une séance — voir eleve-seance.js. Un élève ne
// voit jamais que le contenu publié de sa propre classe (RLS sur
// seances/blocs_seance).

let profilEleveMat = null;
let classeIdEleve = null;
let etatMat = { champ: null, sa: null };

const PRESENTATION_CHAMPS_ELEVE = {
  francais:     { icone: '📚' }, mathematique: { icone: '📐' }, es: { icone: '🌍' },
  est:          { icone: '🔬' }, ea: { icone: '🎨' }, eps: { icone: '⚽' }
};

(async function () {
  profilEleveMat = await requireRole('eleve');
  if (!profilEleveMat) return;
  initClocheNotifications('zoneCloche', profilEleveMat.id);

  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilEleveMat.id).single();
  classeIdEleve = fiche?.classe_id;
  if (!classeIdEleve) {
    document.getElementById('contenu').innerHTML = '<p style="text-align:center;color:var(--text-gris)">Aucune classe ne t\'est encore associée — demande à un adulte de vérifier ton inscription.</p>';
    return;
  }

  afficherChamps();
})();

function filArianeMat(segments) {
  return `<div class="fil-ariane-eleve">${segments.map((s, i) => {
    const dernier = i === segments.length - 1;
    return dernier ? `<span>${echapper(s.label)}</span>` : `<a data-fil-mat="${i}">${echapper(s.label)}</a> › `;
  }).join('')}</div>`;
}

function attacherFilAriane(nb) {
  document.querySelectorAll('[data-fil-mat]').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.filMat, 10);
      if (i === 0) { etatMat = { champ: null, sa: null }; afficherChamps(); }
      else if (i === 1) { etatMat.sa = null; afficherSA(); }
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
      afficherSA();
    });
  });
}

async function afficherSA() {
  const conteneur = document.getElementById('contenu');
  const segments = [{ label: '🏠 Mes matières' }, { label: etatMat.champ.nom }];
  conteneur.innerHTML = filArianeMat(segments) + '<div class="chargement">Chargement...</div>';

  const { data: noeuds } = await supabaseClient
    .from('noeuds_parcours').select('id, titre').eq('classe_id', classeIdEleve).eq('champ_formation_id', etatMat.champ.id);
  const idsNoeuds = (noeuds || []).map(n => n.id);
  const titreNoeud = {};
  (noeuds || []).forEach(n => { titreNoeud[n.id] = n.titre; });

  const { data: sas } = idsNoeuds.length
    ? await supabaseClient.from('sa').select('*').in('noeud_id', idsNoeuds).order('ordre')
    : { data: [] };

  conteneur.innerHTML = `
    ${filArianeMat(segments)}
    <div class="carte-bienvenue"><h1 style="margin:0">${echapper(etatMat.champ.nom)} — choisis un sujet</h1></div>
    <div class="grille-sa-eleve" id="grilleSaMat">
      ${(sas || []).map(s => `<div class="carte-sa-eleve" data-sa-id="${s.id}">
        <div>
          <div class="session-title-eleve">${s.numero ? `SA${s.numero} — ` : ''}${echapper(s.titre)}</div>
          ${s.description ? `<p style="margin:2px 0 0;font-size:13px;color:var(--text-gris)">${echapper(s.description)}</p>` : ''}
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-gris)">${echapper(titreNoeud[s.noeud_id] || '')}</p>
        </div>
        <span style="font-size:20px">➔</span>
      </div>`).join('') || '<p style="color:var(--text-gris)">Rien à afficher pour cette matière pour l\'instant.</p>'}
    </div>
  `;
  attacherFilAriane();
  document.getElementById('grilleSaMat').querySelectorAll('[data-sa-id]').forEach(el => {
    el.addEventListener('click', () => {
      etatMat.sa = (sas || []).find(s => String(s.id) === el.dataset.saId);
      afficherSeancesListe();
    });
  });
}

async function afficherSeancesListe() {
  const conteneur = document.getElementById('contenu');
  const segments = [{ label: '🏠 Mes matières' }, { label: etatMat.champ.nom }, { label: etatMat.sa.titre }];
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
