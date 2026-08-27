// Page pages/enseignant/devoirs-notes.html

let profilEnseignant = null;
let classesEnseignant = [];
let champsFormation = [];
let classeSelectionneeEns = null;
let champSelectionneEns = null;
let elevesSuivisIds = []; // élèves dont l'abonnement est accepté pour cet enseignant

(async function () {
  profilEnseignant = await requireRole('enseignant');
  if (!profilEnseignant) return;

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
  const { data: devoirs } = await supabaseClient.from('devoirs').select('*').eq('classe_id', classeSelectionneeEns).eq('champ_formation_id', champSelectionneEns).order('date_limite');
  const idsEleves = (eleves || []).map(e => e.id);
  const { data: evaluations } = idsEleves.length
    ? await supabaseClient.from('evaluations').select('*').in('eleve_id', idsEleves).eq('champ_formation_id', champSelectionneEns).order('cree_le', { ascending: false })
    : { data: [] };
  const { data: rendus } = devoirs && devoirs.length
    ? await supabaseClient.from('devoirs_rendus').select('devoir_id, eleve_id').in('devoir_id', devoirs.map(d => d.id))
    : { data: [] };

  const evalParEleve = {};
  (evaluations || []).forEach(e => { (evalParEleve[e.eleve_id] ??= []).push(e); });
  const rendusParDevoir = {};
  (rendus || []).forEach(r => { rendusParDevoir[r.devoir_id] = (rendusParDevoir[r.devoir_id] || 0) + 1; });

  zone.innerHTML = `
    <button class="btn btn-filled" id="btnNouveauDevoirEns" style="margin-bottom:20px">+ Nouveau devoir</button>

    <div class="titre-section-pub">Devoirs</div>
    ${(devoirs && devoirs.length) ? `<div class="liste-lignes-pub">${devoirs.map(d => `
      <div class="ligne-pub">
        <div><div class="titre-ligne-pub">${echapperEns2(d.titre)}</div><div class="sous-ligne-pub">À rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')} · ${rendusParDevoir[d.id] || 0}/${(eleves || []).length} rendus</div></div>
      </div>`).join('')}</div>` : '<p style="color:var(--text-gris);font-size:14px">Aucun devoir.</p>'}

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

  document.getElementById('btnNouveauDevoirEns').addEventListener('click', ouvrirNouveauDevoirEns);
  zone.querySelectorAll('[data-noter-ens]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirNouvelleNoteEns(btn.dataset.noterEns));
  });
}

function ouvrirNouveauDevoirEns() {
  ouvrirModal({
    titre: 'Nouveau devoir',
    champs: [
      { nom: 'titre', label: 'Titre' },
      { nom: 'consigne', label: 'Consigne', type: 'textarea', requis: false },
      { nom: 'date_limite', label: 'À rendre pour le', type: 'date' }
    ],
    texteValider: 'Créer',
    onValider: async ({ titre, consigne, date_limite }) => {
      const { error } = await supabaseClient.from('devoirs').insert({
        classe_id: classeSelectionneeEns, champ_formation_id: champSelectionneEns, titre, consigne: consigne || null,
        date_limite: new Date(date_limite).toISOString(), cree_par: profilEnseignant.id
      });
      if (error) return alert(error.message);
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
