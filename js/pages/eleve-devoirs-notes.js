// Page pages/eleve/devoirs-notes.html

let profilEleve = null;

(async function () {
  profilEleve = await requireRole('eleve');
  if (!profilEleve) return;
  await charger();
})();

async function charger() {
  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilEleve.id).single();

  const [{ data: devoirs }, { data: rendus }, { data: evaluations }] = await Promise.all([
    fiche?.classe_id
      ? supabaseClient.from('devoirs').select('*, champs_formation(nom)').eq('classe_id', fiche.classe_id).order('date_limite')
      : Promise.resolve({ data: [] }),
    supabaseClient.from('devoirs_rendus').select('*').eq('eleve_id', profilEleve.id),
    supabaseClient.from('evaluations').select('*, champs_formation(nom)').eq('eleve_id', profilEleve.id).order('cree_le', { ascending: false })
  ]);

  const rendusParDevoir = {};
  (rendus || []).forEach(r => { rendusParDevoir[r.devoir_id] = r; });

  const idsDevoirsBlocs = (devoirs || []).filter(d => d.seance_id).map(d => d.id);
  let resumesParDevoir = {};
  if (idsDevoirsBlocs.length) {
    const { data: blocsTous } = await supabaseClient.from('blocs_seance').select('*').in('devoir_id', idsDevoirsBlocs).order('ordre');
    const idsBlocsTous = (blocsTous || []).map(b => b.id);
    const [{ data: reponsesTous }, { data: rendusTous }] = idsBlocsTous.length
      ? await Promise.all([
          supabaseClient.from('reponses_exercices').select('*').eq('eleve_id', profilEleve.id).in('bloc_id', idsBlocsTous),
          supabaseClient.from('rendus_activites').select('*').eq('eleve_id', profilEleve.id).in('bloc_id', idsBlocsTous)
        ])
      : [{ data: [] }, { data: [] }];
    resumesParDevoir = resumerDevoirsBlocsEnLot(idsDevoirsBlocs, blocsTous, reponsesTous, rendusTous);
  }

  const devoirsAvecStatut = (devoirs || []).map(d => d.seance_id
    ? { ...d, resumeBlocs: resumesParDevoir[d.id] || null }
    : { ...d, rendu: rendusParDevoir[d.id] || null });

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Mes devoirs et notes</h1>
      <p>Retrouve ici tes devoirs à rendre et tes évaluations.</p>
    </div>
    <div class="titre-section-pub">📚 Mes devoirs</div>
    <div id="zoneDevoirs">${html_listeDevoirs(devoirsAvecStatut, { interactif: true })}</div>
    <div class="titre-section-pub">📊 Mes notes</div>
    ${html_listeEvaluations(evaluations)}
  `;

  const zoneDevoirs = document.getElementById('zoneDevoirs');
  attacherEcouteursDetailsDevoirs(zoneDevoirs);
  zoneDevoirs.querySelectorAll('[data-rendre-devoir]').forEach(btn => {
    btn.addEventListener('click', () => rendreDevoir(parseInt(btn.dataset.rendreDevoir, 10), btn.dataset.titreDevoir));
  });
}

function rendreDevoir(devoirId, titreDevoir) {
  ouvrirModal({
    titre: `Rendre : ${titreDevoir}`,
    champs: [
      { nom: 'contenu_reponse', label: 'Ta réponse', type: 'textarea', placeholder: 'Écris ta réponse ici...' },
      { nom: 'piece_jointe_url', label: 'Lien vers une pièce jointe (optionnel)', requis: false, placeholder: 'https://...' }
    ],
    texteValider: 'Envoyer au maître',
    onValider: async ({ contenu_reponse, piece_jointe_url }) => {
      const { error } = await supabaseClient.from('devoirs_rendus').insert({
        devoir_id: devoirId, eleve_id: profilEleve.id, statut: 'rendu',
        contenu_reponse, piece_jointe_url: piece_jointe_url || null, rendu_le: new Date().toISOString()
      });
      if (error) return alert(error.message);
      await charger();
    }
  });
}
