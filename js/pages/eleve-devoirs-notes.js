// Page pages/eleve/devoirs-notes.html

let profilEleve = null;

(async function () {
  profilEleve = await requireRole('eleve');
  if (!profilEleve) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilEleve.id, badgeHtml: `🟢 ${echapperTexte(profilEleve.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
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
  let typePrincipalParDevoir = {};
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
    // 18 septembre 2026 (2e lot) : "Applique la couleur de fond aux
    // historiques des devoirs des élèves" — même blocsTous déjà chargé
    // ci-dessus, aucune requête supplémentaire (voir js/devoirs-notes-rendu.js).
    typePrincipalParDevoir = typePrincipalParDevoirDepuisBlocs(blocsTous);
  }

  const devoirsAvecStatut = (devoirs || []).map(d => d.seance_id
    ? { ...d, resumeBlocs: resumesParDevoir[d.id] || null, typeDevoir: typePrincipalParDevoir[d.id] || null }
    : { ...d, rendu: rendusParDevoir[d.id] || null });

  // Cartes de suivi (11 septembre 2026, demande explicite) : "rendu / en
  // cours / en retard" — désormais CLIQUABLES (11 septembre 2026, 2e
  // demande : "chaque carte [...] doit être cliquable et contenir ce qu'il
  // renseigne au lieu de présenter juste des statistiques") — voir
  // html_cartesStatutsDevoirs()/attacherEcouteursListeDevoirs() dans
  // js/devoirs-notes-rendu.js. "En cours" reprend le statut "à faire"
  // (l'intitulé neutre par défaut ne parle pas bien à un élève).
  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Mes devoirs et notes</h1>
      <p>Retrouve ici tes devoirs à rendre et tes évaluations.</p>
    </div>
    ${html_cartesStatutsDevoirs(devoirsAvecStatut, { libelleEnCours: 'En cours', interactif: true })}
    <div class="titre-section-pub">📚 Mes devoirs</div>
    ${html_legendeTypeDevoir()}
    <div id="zoneDevoirs">${html_listeDevoirs(devoirsAvecStatut, { interactif: true })}</div>
    <div class="titre-section-pub">📊 Mes notes</div>
    ${html_resumeNotesParMatiere(evaluations)}
  `;

  attacherEcouteursListeDevoirs(document.getElementById('contenu'), rendreDevoir);
}

// 19 septembre 2026 : "pour le devoir libre rendu, l'élève ne voit pas le
// contenu. Il doit voir le contenu et pouvoir répondre avec formatage" — la
// consigne (contenu du devoir) était jusqu'ici invisible au moment de
// répondre (aucun bouton "Détails" ne s'affichait avant le rendu, voir
// js/devoirs-notes-rendu.js), et la réponse se limitait à un simple
// textarea. Corrigé : la consigne est reprise en lecture seule en haut de
// cette modale (champ 'html', purement informatif — voir js/modal.js), et
// la réponse utilise désormais la même zone de texte riche (Gras/Italique/
// Listes/Couleurs) que la consigne côté enseignant/admin.
function rendreDevoir(devoirId, titreDevoir, consigne) {
  const champs = [];
  if (consigne) {
    champs.push({ nom: '_consigneLecture', type: 'html', label: '📋 Consigne du maître', valeur: contenuRicheInitialTexte(consigne) });
  }
  champs.push(
    { nom: 'contenu_reponse', label: 'Ta réponse', type: 'richtext', placeholder: 'Écris ta réponse ici...' },
    { nom: 'piece_jointe_url', label: 'Lien vers une pièce jointe (optionnel)', requis: false, placeholder: 'https://...' }
  );
  ouvrirModal({
    titre: `Rendre : ${titreDevoir}`,
    champs,
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
