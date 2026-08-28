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
  const devoirsAvecStatut = (devoirs || []).map(d => ({ ...d, rendu: rendusParDevoir[d.id] || null }));

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

  document.getElementById('zoneDevoirs').querySelectorAll('[data-rendre-devoir]').forEach(btn => {
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
