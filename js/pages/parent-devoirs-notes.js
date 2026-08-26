// Page pages/parent/devoirs-notes.html

let profilParentDN = null;
let enfantsDN = [];
let enfantSelectionneId = null;

(async function () {
  profilParentDN = await requireRole('parent');
  if (!profilParentDN) return;

  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilParentDN.id);
  const ids = (liens || []).map(l => l.eleve_id);

  if (ids.length === 0) {
    document.getElementById('contenu').innerHTML = `
      <div class="carte-bienvenue"><h1>Aucun enfant inscrit</h1><p>Inscrivez d'abord un enfant depuis votre tableau de bord.</p></div>`;
    return;
  }

  const { data: profils } = await supabaseClient.from('profils').select('id, prenom, nom').in('id', ids);
  enfantsDN = profils || [];
  enfantSelectionneId = enfantsDN[0]?.id;

  await afficher();
})();

async function afficher() {
  const enfant = enfantsDN.find(e => e.id === enfantSelectionneId);
  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', enfantSelectionneId).single();

  const [{ data: devoirs }, { data: rendus }, { data: evaluations }] = await Promise.all([
    fiche?.classe_id
      ? supabaseClient.from('devoirs').select('*, champs_formation(nom)').eq('classe_id', fiche.classe_id).order('date_limite')
      : Promise.resolve({ data: [] }),
    supabaseClient.from('devoirs_rendus').select('*').eq('eleve_id', enfantSelectionneId),
    supabaseClient.from('evaluations').select('*, champs_formation(nom)').eq('eleve_id', enfantSelectionneId).order('cree_le', { ascending: false })
  ]);

  const rendusParDevoir = {};
  (rendus || []).forEach(r => { rendusParDevoir[r.devoir_id] = r; });
  const devoirsAvecStatut = (devoirs || []).map(d => ({ ...d, rendu: rendusParDevoir[d.id] || null }));

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Suivi devoirs et notes</h1>
      <p>Consultez les devoirs et notes de ${enfantsDN.length > 1 ? 'chacun de vos enfants' : 'votre enfant'}.</p>
    </div>

    ${enfantsDN.length > 1 ? `<div class="selecteur-enfant" id="selecteurEnfant">
      ${enfantsDN.map(e => `<button class="${e.id === enfantSelectionneId ? 'actif' : ''}" data-enfant="${e.id}">${e.prenom} ${e.nom}</button>`).join('')}
    </div>` : `<p style="font-weight:700;color:var(--noir-kekeli)">${enfant.prenom} ${enfant.nom}</p>`}

    <div class="titre-section-pub">📚 Devoirs</div>
    ${html_listeDevoirs(devoirsAvecStatut, { interactif: false })}
    <div class="titre-section-pub">📊 Notes</div>
    ${html_listeEvaluations(evaluations)}
  `;

  const selecteur = document.getElementById('selecteurEnfant');
  if (selecteur) selecteur.querySelectorAll('[data-enfant]').forEach(btn => {
    btn.addEventListener('click', () => { enfantSelectionneId = btn.dataset.enfant; afficher(); });
  });
}
