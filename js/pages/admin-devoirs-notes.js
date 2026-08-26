// Page pages/admin/devoirs-notes.html

let profilAdminDN = null;
let classeSelectionnee = null;
let champSelectionne = null;

async function init() {
  profilAdminDN = await requireAdmin();
  if (!profilAdminDN) return;

  document.getElementById('zoneDroite').insertAdjacentHTML('afterbegin', `
    <span class="badge-utilisateur">${profilAdminDN.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profilAdminDN.prenom}</span>
  `);

  const [{ data: classes }, { data: champs }] = await Promise.all([
    supabaseClient.from('classes').select('*').order('ordre'),
    supabaseClient.from('champs_formation').select('*').order('nom')
  ]);

  document.getElementById('contenu').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <select id="selectClasse" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Choisir une classe —</option>
        ${(classes || []).map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
      <select id="selectChamp" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Choisir un champ —</option>
        ${(champs || []).map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
    </div>
    <div id="zoneGestion"></div>
  `;

  const majSelection = async () => {
    classeSelectionnee = document.getElementById('selectClasse').value || null;
    champSelectionne = document.getElementById('selectChamp').value || null;
    if (classeSelectionnee && champSelectionne) await afficherGestion();
    else document.getElementById('zoneGestion').innerHTML = '';
  };
  document.getElementById('selectClasse').addEventListener('change', majSelection);
  document.getElementById('selectChamp').addEventListener('change', majSelection);
}

async function afficherGestion() {
  const zone = document.getElementById('zoneGestion');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  const { data: eleves } = await supabaseClient.from('eleves').select('id, profils:id(prenom, nom)').eq('classe_id', classeSelectionnee);
  const { data: devoirs } = await supabaseClient.from('devoirs').select('*').eq('classe_id', classeSelectionnee).eq('champ_formation_id', champSelectionne).order('date_limite');
  const idsEleves = (eleves || []).map(e => e.id);
  const { data: evaluations } = idsEleves.length
    ? await supabaseClient.from('evaluations').select('*').in('eleve_id', idsEleves).eq('champ_formation_id', champSelectionne).order('cree_le', { ascending: false })
    : { data: [] };
  const { data: rendus } = devoirs && devoirs.length
    ? await supabaseClient.from('devoirs_rendus').select('devoir_id, eleve_id').in('devoir_id', devoirs.map(d => d.id))
    : { data: [] };

  const evalParEleve = {};
  (evaluations || []).forEach(e => { (evalParEleve[e.eleve_id] ??= []).push(e); });
  const rendusParDevoir = {};
  (rendus || []).forEach(r => { rendusParDevoir[r.devoir_id] = (rendusParDevoir[r.devoir_id] || 0) + 1; });

  zone.innerHTML = `
    <button class="btn btn-accent" id="btnNouveauDevoir" style="margin-bottom:20px">+ Nouveau devoir</button>
    <div class="titre-cycle" style="margin-top:0">Devoirs</div>
    ${(devoirs && devoirs.length) ? `<div class="liste-lignes">${devoirs.map(d => `
      <div class="ligne">
        <div><div class="titre-ligne">${echapperAdmin(d.titre)}</div><span style="font-size:12px;color:var(--texte-gris)">À rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')} · ${rendusParDevoir[d.id] || 0}/${(eleves || []).length} rendus</span></div>
      </div>`).join('')}</div>` : '<p class="chargement">Aucun devoir.</p>'}

    <div class="titre-cycle">Élèves de la classe</div>
    <div class="liste-lignes">${(eleves || []).map(e => `
      <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div class="titre-ligne">${e.profils?.prenom || ''} ${e.profils?.nom || ''}</div>
          <button class="btn btn-primaire" data-noter="${e.id}" style="padding:6px 14px;font-size:12px">+ Note</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${(evalParEleve[e.id] || []).map(ev => `<span class="statut-pill ${ev.type === 'appreciation' ? '' : 'statut-publie'}" style="background:${ev.type === 'appreciation' ? '#F1F5F9' : 'var(--bleu-clair)'};color:var(--bleu-principal)">
            ${ev.type === 'appreciation' ? { acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[ev.appreciation] : `${ev.valeur}/${ev.type === 'note_20' ? '20' : '10'}`}
          </span>`).join('') || '<span style="font-size:12px;color:var(--texte-gris)">Aucune note</span>'}
        </div>
      </div>`).join('')}</div>
  `;

  document.getElementById('btnNouveauDevoir').addEventListener('click', ouvrirNouveauDevoir);
  zone.querySelectorAll('[data-noter]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirNouvelleNote(btn.dataset.noter));
  });
}

function ouvrirNouveauDevoir() {
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
        classe_id: classeSelectionnee, champ_formation_id: champSelectionne, titre, consigne: consigne || null,
        date_limite: new Date(date_limite).toISOString(), cree_par: profilAdminDN.id
      });
      if (error) return alert(error.message);
      afficherGestion();
    }
  });
}

function ouvrirNouvelleNote(eleveId) {
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
        eleve_id: eleveId, champ_formation_id: champSelectionne, type,
        valeur: type !== 'appreciation' ? parseFloat(valeur) : null,
        appreciation: type === 'appreciation' ? (appreciation || null) : null,
        commentaire: commentaire || null, cree_par: profilAdminDN.id
      });
      if (error) return alert(error.message);
      afficherGestion();
    }
  });
}

function echapperAdmin(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
