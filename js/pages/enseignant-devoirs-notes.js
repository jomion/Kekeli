// Page pages/enseignant/devoirs-notes.html

let profilEnseignant = null;
let classesEnseignant = [];
let champsFormation = [];
let classeSelectionneeEns = null;
let champSelectionneEns = null;
let elevesSuivisIds = []; // élèves dont l'abonnement est accepté pour cet enseignant
let devoirOuvertEns = null; // id du devoir dont le panneau de rendus est déplié

(async function () {
  profilEnseignant = await requireRole('enseignant');
  if (!profilEnseignant) return;
  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profilEnseignant.id, badgeHtml: `🟢 ${echapperEns2(profilEnseignant.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });

  const { data: abonnements } = await supabaseClient
    .from('abonnements_enseignant_eleve')
    .select('eleve_id, eleves(classe_id)')
    .eq('enseignant_id', profilEnseignant.id).eq('statut', 'accepte');

  elevesSuivisIds = (abonnements || []).map(a => a.eleve_id);
  const idsClasses = [...new Set((abonnements || []).map(a => a.eleves?.classe_id).filter(Boolean))];

  if (idsClasses.length === 0) {
    document.getElementById('contenu').innerHTML = `
      <div class="carte-bienvenue"><h1>Aucun élève suivi</h1><p>Un parent doit d'abord vous demander le suivi de son enfant (avec votre e-mail), et vous devez l'accepter depuis votre tableau de bord.</p></div>`;
    return;
  }

  const [{ data: classes }, { data: champs }] = await Promise.all([
    supabaseClient.from('classes').select('*').in('id', idsClasses).order('ordre'),
    supabaseClient.from('champs_formation').select('*').order('nom')
  ]);
  classesEnseignant = classes || [];
  champsFormation = champs || [];
  classeSelectionneeEns = classesEnseignant[0]?.id;
  champSelectionneEns = champsFormation[0]?.id;

  afficherEntete();
  await afficherGestionEns();
})();

function afficherEntete() {
  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Devoirs &amp; notes</h1>
      <p>Sélectionnez une classe et un champ pour gérer les devoirs et attribuer des notes.</p>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <select id="selectClasseEns" style="padding:9px;border-radius:8px;border:2px solid var(--bordure)">
        ${classesEnseignant.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
      <select id="selectChampEns" style="padding:9px;border-radius:8px;border:2px solid var(--bordure)">
        ${champsFormation.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
    </div>
    <div id="zoneGestionEns"></div>
  `;
  document.getElementById('selectClasseEns').addEventListener('change', (e) => { classeSelectionneeEns = e.target.value; afficherGestionEns(); });
  document.getElementById('selectChampEns').addEventListener('change', (e) => { champSelectionneEns = e.target.value; afficherGestionEns(); });
}

async function afficherGestionEns() {
  const zone = document.getElementById('zoneGestionEns');
  zone.innerHTML = '<p style="color:var(--text-gris)">Chargement...</p>';

  const { data: eleves } = await supabaseClient.from('eleves').select('id, profils(prenom, nom)')
    .eq('classe_id', classeSelectionneeEns).in('id', elevesSuivisIds);
  const idsEleves = (eleves || []).map(e => e.id);
  const { data: devoirs } = await supabaseClient.from('devoirs').select('*, seances(titre)').eq('classe_id', classeSelectionneeEns).eq('champ_formation_id', champSelectionneEns).order('date_limite');
  const { data: evaluations } = idsEleves.length
    ? await supabaseClient.from('evaluations').select('*').in('eleve_id', idsEleves).eq('champ_formation_id', champSelectionneEns).order('cree_le', { ascending: false })
    : { data: [] };
  const { data: rendus } = devoirs && devoirs.length
    ? await supabaseClient.from('devoirs_rendus').select('devoir_id, eleve_id').in('devoir_id', devoirs.map(d => d.id))
    : { data: [] };
  const { data: destinatairesTous } = devoirs && devoirs.length
    ? await supabaseClient.from('devoirs_destinataires').select('devoir_id, eleve_id').in('devoir_id', devoirs.map(d => d.id))
    : { data: [] };

  const evalParEleve = {};
  (evaluations || []).forEach(e => { (evalParEleve[e.eleve_id] ??= []).push(e); });
  const rendusParDevoir = {};
  (rendus || []).forEach(r => { rendusParDevoir[r.devoir_id] = (rendusParDevoir[r.devoir_id] || 0) + 1; });
  const destinatairesParDevoir = {};
  (destinatairesTous || []).forEach(d => { (destinatairesParDevoir[d.devoir_id] ??= []).push(d.eleve_id); });

  let panneauRendusEns = '';
  if (devoirOuvertEns) {
    const devoirOuvert = (devoirs || []).find(d => d.id === devoirOuvertEns);
    if (devoirOuvert) {
      if (devoirOuvert.seance_id) {
        const { blocs, reponsesExercices, rendusActivites } = await donneesPanneauDevoirBlocs(devoirOuvertEns, idsEleves);
        const htmlRendus = (devoirOuvert.statut === 'publie' && blocs.length)
          ? html_gestionRendusDevoir(devoirOuvert, eleves, null, blocs, reponsesExercices, rendusActivites) : '';
        panneauRendusEns = html_panneauGestionDevoirBlocs(devoirOuvert, htmlRendus);
      } else {
        const { data: rendusDevoir } = await supabaseClient.from('devoirs_rendus').select('*').eq('devoir_id', devoirOuvertEns).in('eleve_id', idsEleves);
        panneauRendusEns = html_gestionRendusDevoir(devoirOuvert, eleves, rendusDevoir);
      }
    }
  }

  // Cartes de suivi enseignant (11 septembre 2026, demande explicite : "cré
  // aussi pour l'enseignant selon ses besoin pour faciliter l'affichage et le
  // suivi"). Contrairement à côté élève/parent, cette page ne calcule pas de
  // statut par devoir (à_faire/rendu/en_retard/corrigé — ça exigerait de
  // recharger tous les blocs/réponses de chaque devoir "à blocs" pour TOUS
  // les élèves suivis, coûteux) : on reste sur des compteurs simples, déjà
  // déductibles des données chargées ci-dessus (statut de publication,
  // échéance, réponses reçues pour les devoirs "texte libre").
  const maintenantEns = new Date();
  const devoirsListe = devoirs || [];
  const estPublieEns = (d) => !d.seance_id || d.statut === 'publie';
  const devoirsPublies = devoirsListe.filter(estPublieEns);
  const devoirsBrouillons = devoirsListe.filter(d => !estPublieEns(d));
  const devoirsEnRetard = devoirsListe.filter(d => estPublieEns(d) && d.date_limite && new Date(d.date_limite) < maintenantEns);
  const devoirsAvecReponses = devoirsListe.filter(d => !d.seance_id && (rendusParDevoir[d.id] || 0) > 0);
  // Cartes de suivi enseignant CLIQUABLES (11 septembre 2026, 2e demande :
  // "chaque carte [...] doit être cliquable et contenir ce qu'il renseigne").
  // La matière est déjà celle choisie dans le sélecteur ci-dessus — chaque
  // carte dépliée n'a donc besoin de lister que les devoirs concernés, sans
  // sous-groupage supplémentaire (une seule matière à la fois sur cette page).
  const cartesEns = [
    { cle: 'publies', devoirs: devoirsPublies, libelle: '📋 Devoirs publiés' },
    { cle: 'brouillons', devoirs: devoirsBrouillons, libelle: '📝 Brouillons (non visibles des élèves)', alerte: devoirsBrouillons.length > 0 },
    { cle: 'retard', devoirs: devoirsEnRetard, libelle: '⏰ Échéance dépassée', alerte: devoirsEnRetard.length > 0 },
    { cle: 'reponses', devoirs: devoirsAvecReponses, libelle: '📨 Réponses reçues (devoirs texte libre)' }
  ];
  // avecPanneau=false (cartes de statut, ci-dessous) : n'affiche jamais le
  // panneau déplié (correction de bug, 18 septembre 2026) — le même devoir
  // apparaît à la fois dans une carte de statut ET dans la liste "Devoirs"
  // plus bas ; l'ancienne version dupliquait le panneau (et son conteneur
  // data-editeur-blocs-devoir) aux deux endroits dès que ce devoir était
  // "ouvert", ce qui faisait que initEditeurBlocsDevoir() (zone.querySelector,
  // qui ne cible que la PREMIÈRE occurrence trouvée dans le DOM) initialisait
  // toujours celui de la carte de statut — souvent replié/invisible — et
  // laissait vide, sans le moindre bouton "+ Ajouter un bloc", celui de la
  // liste "Devoirs" que l'enseignant regarde réellement. Le bouton "Gérer"
  // reste cliquable dans une carte de statut (il ouvre bien le devoir), mais
  // le panneau lui-même ne s'affiche que dans la liste "Devoirs", seul
  // endroit où son conteneur existe désormais dans le DOM.
  const html_ligneDevoirEns = (d, avecPanneau) => {
    const estBlocs = !!d.seance_id;
    const sousLigne = estBlocs
      ? `${echapperEns2(d.seances?.titre || '')} · ${d.statut === 'publie' ? 'Publié' : 'Brouillon'} · à rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')}`
      : `À rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')} · ${rendusParDevoir[d.id] || 0}/${(eleves || []).length} rendus`;
    return `
    <div class="ligne-pub" style="flex-direction:column;align-items:stretch;gap:0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div><div class="titre-ligne-pub">${echapperEns2(d.titre)}</div><div class="sous-ligne-pub">${sousLigne}</div></div>
        <button type="button" class="btn btn-discret" data-toggle-rendus-ens="${d.id}" style="padding:6px 14px;font-size:12px">${devoirOuvertEns === d.id ? (avecPanneau ? '▲ Fermer' : '👇 Ouvert dans "Devoirs" ci-dessous') : (estBlocs ? '📂 Gérer' : '📋 Voir les rendus')}</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:11px;color:var(--text-gris)">${libelleDestinatairesDevoir((destinatairesParDevoir[d.id] || []).length, (eleves || []).length)}</span>
        <button type="button" class="btn btn-discret" data-destinataires-devoir="${d.id}" style="padding:2px 10px;font-size:11px">🎯 Destinataires</button>
        <button type="button" class="btn btn-discret" data-modifier-devoir="${d.id}" style="padding:2px 10px;font-size:11px">✏️ Modifier</button>
        <button type="button" class="btn btn-discret" data-supprimer-devoir="${d.id}" style="padding:2px 10px;font-size:11px;color:#B91C1C">🗑️ Supprimer</button>
      </div>
      ${(avecPanneau && devoirOuvertEns === d.id) ? panneauRendusEns : ''}
    </div>`;
  };
  const html_listeDevoirsEns = (liste, avecPanneau = true) => liste.length
    ? `<div class="liste-lignes-pub">${liste.map(d => html_ligneDevoirEns(d, avecPanneau)).join('')}</div>`
    : '<p style="color:var(--text-gris);font-size:14px">Aucun devoir dans cette situation.</p>';

  zone.innerHTML = `
    <div data-zone-cartes-statuts style="margin-bottom:20px">
      <div class="grille-taches-admin" style="margin-bottom:0">
        ${cartesEns.map(c => `
          <button type="button" class="pastille-tache-admin ${c.alerte ? 'a-traiter' : ''}" data-carte-statut="${c.cle}">
            <span class="chiffre-tache">${c.devoirs.length}</span>
            <span class="libelle-tache">${c.libelle} <span class="fleche-carte-statut">▾</span></span>
          </button>`).join('')}
      </div>
      ${cartesEns.map(c => `
        <div class="zone-detail-carte-statut" data-zone-carte-statut="${c.cle}" hidden style="margin-top:12px">
          ${html_listeDevoirsEns(c.devoirs, false)}
        </div>`).join('')}
    </div>
    <button class="btn btn-filled" id="btnNouveauDevoirEns" style="margin-bottom:20px">+ Nouveau devoir</button>

    <div class="titre-section-pub">Devoirs</div>
    ${html_listeDevoirsEns(devoirsListe)}

    <div class="titre-section-pub">Mes élèves suivis dans cette classe</div>
    <div class="liste-lignes-pub">${(eleves || []).map(e => `
      <div class="ligne-pub" style="align-items:flex-start;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div class="titre-ligne-pub">${e.profils?.prenom || ''} ${e.profils?.nom || ''}</div>
          <button class="btn btn-filled" data-noter-ens="${e.id}" style="padding:6px 14px;font-size:12px">+ Note</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${(evalParEleve[e.id] || []).map(ev => ev.type === 'appreciation'
            ? `<span class="pastille-statut pastille-${ev.appreciation}">${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[ev.appreciation]}</span>`
            : `<span class="pastille-note">${ev.valeur}/${ev.type === 'note_20' ? '20' : '10'}</span>`
          ).join('') || '<span style="font-size:12px;color:var(--text-gris)">Aucune note</span>'}
        </div>
      </div>`).join('')}</div>
  `;

  attacherEcouteursCartesStatutsDevoirs(zone);
  document.getElementById('btnNouveauDevoirEns').addEventListener('click', () => ouvrirNouveauDevoirEns(eleves || []));
  zone.querySelectorAll('[data-supprimer-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.supprimerDevoir, 10);
      const d = devoirsListe.find(x => x.id === id);
      supprimerDevoir(id, d?.titre, () => { if (devoirOuvertEns === id) devoirOuvertEns = null; afficherGestionEns(); });
    });
  });
  zone.querySelectorAll('[data-modifier-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.modifierDevoir, 10);
      const d = devoirsListe.find(x => x.id === id);
      if (d) ouvrirModificationDevoir(d, afficherGestionEns);
    });
  });
  zone.querySelectorAll('[data-noter-ens]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirNouvelleNoteEns(btn.dataset.noterEns));
  });
  zone.querySelectorAll('[data-toggle-rendus-ens]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.toggleRendusEns, 10);
      devoirOuvertEns = devoirOuvertEns === id ? null : id;
      afficherGestionEns();
    });
  });
  zone.querySelectorAll('[data-corriger-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      ouvrirCorrectionDevoir(parseInt(btn.dataset.corrigerDevoir, 10), profilEnseignant.id, afficherGestionEns);
    });
  });
  zone.querySelectorAll('[data-corriger-activite-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      ouvrirCorrectionActiviteDevoir(parseInt(btn.dataset.corrigerActiviteDevoir, 10), profilEnseignant.id, afficherGestionEns);
    });
  });
  zone.querySelectorAll('[data-corriger-probleme-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      ouvrirCorrectionProblemeDevoir(parseInt(btn.dataset.corrigerProblemeDevoir, 10), profilEnseignant.id, afficherGestionEns);
    });
  });
  zone.querySelectorAll('[data-toggle-statut-devoir]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabaseClient.from('devoirs')
        .update({ statut: btn.dataset.nouveauStatut }).eq('id', parseInt(btn.dataset.toggleStatutDevoir, 10));
      if (error) return alert(error.message);
      afficherGestionEns();
    });
  });
  zone.querySelectorAll('[data-destinataires-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      ouvrirSelectionDestinatairesDevoir(parseInt(btn.dataset.destinatairesDevoir, 10), eleves || [], afficherGestionEns);
    });
  });

  if (devoirOuvertEns) {
    const devoirOuvert = (devoirs || []).find(d => d.id === devoirOuvertEns);
    if (devoirOuvert && devoirOuvert.seance_id) {
      const conteneurBlocs = zone.querySelector(`[data-editeur-blocs-devoir="${devoirOuvertEns}"]`);
      if (conteneurBlocs) initEditeurBlocsDevoir(devoirOuvertEns, conteneurBlocs);
    }
  }
}

function ouvrirNouveauDevoirEns(eleves) {
  ouvrirChoixModeNouveauDevoir((mode) => {
    if (mode === 'texte_libre') ouvrirNouveauDevoirTexteLibreEns(eleves);
    else ouvrirNouveauDevoirBlocsEns(eleves);
  });
}

async function ouvrirNouveauDevoirBlocsEns(eleves) {
  const seances = await chargerSeancesPourMatiere(classeSelectionneeEns, champSelectionneEns);
  if (!seances.length) {
    alert("Aucune séance publiée n'existe pour cette matière dans cette classe. Créez (ou faites créer par un admin) une séance dans le parcours avant de donner un devoir à blocs — ou choisissez le mode texte libre.");
    return;
  }
  ouvrirModal({
    titre: 'Nouveau devoir à blocs',
    champs: [
      { nom: 'titre', label: 'Titre' },
      { nom: 'seance_id', label: 'Séance à évaluer', type: 'select', options: seances.map(s => ({ valeur: s.id, label: s.label })) },
      { nom: 'consigne', label: 'Consigne générale (optionnelle)', type: 'textarea', requis: false },
      { nom: 'date_limite', label: 'À rendre pour le', type: 'date' },
      {
        nom: 'destinataires', label: 'Destinataires', type: 'checkboxes',
        toutCocherLabel: 'Tous les élèves de la classe',
        options: eleves.map(e => ({ valeur: e.id, label: `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim() || '(sans nom)' })),
        valeur: eleves.map(e => e.id)
      }
    ],
    texteValider: 'Créer',
    onValider: async ({ titre, seance_id, consigne, date_limite, destinataires }) => {
      if (!destinataires.length) { alert('Sélectionnez au moins un élève, ou cochez "Tous les élèves de la classe".'); return; }
      const { data, error } = await supabaseClient.from('devoirs').insert({
        classe_id: classeSelectionneeEns, champ_formation_id: champSelectionneEns, titre, consigne: consigne || null,
        seance_id: parseInt(seance_id, 10), statut: 'brouillon',
        date_limite: new Date(date_limite).toISOString(), cree_par: profilEnseignant.id
      }).select().single();
      if (error) return alert(error.message);
      if (destinataires.length < eleves.length) {
        const { error: erreurDest } = await supabaseClient.from('devoirs_destinataires')
          .insert(destinataires.map(eleveId => ({ devoir_id: data.id, eleve_id: eleveId })));
        if (erreurDest) alert("Devoir créé, mais erreur lors de l'enregistrement des destinataires : " + erreurDest.message);
      }
      devoirOuvertEns = data.id;
      afficherGestionEns();
    }
  });
}

// Ancien mode restauré (lot 3, partie 3, volet 2) : réponse texte libre (+
// pièce jointe côté élève) corrigée à la main — table devoirs_rendus,
// jamais soumis au système d'abonnements premium. Publié immédiatement (pas
// d'étape de construction de blocs à attendre, contrairement au mode à
// blocs qui reste créé en brouillon).
function ouvrirNouveauDevoirTexteLibreEns(eleves) {
  ouvrirModal({
    titre: 'Nouveau devoir (texte libre)',
    champs: [
      { nom: 'titre', label: 'Titre' },
      { nom: 'consigne', label: 'Consigne', type: 'richtext' },
      { nom: 'date_limite', label: 'À rendre pour le', type: 'date' },
      {
        nom: 'destinataires', label: 'Destinataires', type: 'checkboxes',
        toutCocherLabel: 'Tous les élèves de la classe',
        options: eleves.map(e => ({ valeur: e.id, label: `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim() || '(sans nom)' })),
        valeur: eleves.map(e => e.id)
      }
    ],
    texteValider: 'Créer',
    onValider: async ({ titre, consigne, date_limite, destinataires }) => {
      if (!destinataires.length) { alert('Sélectionnez au moins un élève, ou cochez "Tous les élèves de la classe".'); return; }
      const { data, error } = await supabaseClient.from('devoirs').insert({
        classe_id: classeSelectionneeEns, champ_formation_id: champSelectionneEns, titre, consigne: consigne || null,
        seance_id: null, statut: 'publie',
        date_limite: new Date(date_limite).toISOString(), cree_par: profilEnseignant.id
      }).select().single();
      if (error) return alert(error.message);
      if (destinataires.length < eleves.length) {
        const { error: erreurDest } = await supabaseClient.from('devoirs_destinataires')
          .insert(destinataires.map(eleveId => ({ devoir_id: data.id, eleve_id: eleveId })));
        if (erreurDest) alert("Devoir créé, mais erreur lors de l'enregistrement des destinataires : " + erreurDest.message);
      }
      devoirOuvertEns = data.id;
      afficherGestionEns();
    }
  });
}

function ouvrirNouvelleNoteEns(eleveId) {
  ouvrirModal({
    titre: 'Nouvelle évaluation',
    champs: [
      { nom: 'type', label: 'Type', type: 'select', options: [
        { valeur: 'note_20', label: 'Note /20' }, { valeur: 'note_10', label: 'Note /10' }, { valeur: 'appreciation', label: 'Appréciation' }
      ] },
      { nom: 'valeur', label: 'Valeur (si note)', type: 'number', requis: false },
      { nom: 'appreciation', label: 'Appréciation (si appréciation)', type: 'select', requis: false, options: [
        { valeur: '', label: '—' }, { valeur: 'acquis', label: 'Acquis' }, { valeur: 'en_cours', label: "En cours d'acquisition" }, { valeur: 'non_acquis', label: 'Non acquis' }
      ] },
      { nom: 'commentaire', label: 'Commentaire', type: 'textarea', requis: false }
    ],
    texteValider: 'Enregistrer',
    onValider: async ({ type, valeur, appreciation, commentaire }) => {
      const { error } = await supabaseClient.from('evaluations').insert({
        eleve_id: eleveId, champ_formation_id: champSelectionneEns, type,
        valeur: type !== 'appreciation' ? parseFloat(valeur) : null,
        appreciation: type === 'appreciation' ? (appreciation || null) : null,
        commentaire: commentaire || null, cree_par: profilEnseignant.id
      });
      if (error) return alert(error.message);
      afficherGestionEns();
    }
  });
}

function echapperEns2(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
