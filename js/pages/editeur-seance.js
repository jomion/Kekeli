// Page pages/editeur-seance.html
// Éditeur à blocs pour une séance (cahier des charges §6)

const idSeance = new URLSearchParams(window.location.search).get('id');
let seance = null;
let chaineNavigation = null; // { sa, noeud, classe_id, champ_id, classeNom, champNom }
let blocs = [];
let profilAdmin = null;
let peutEditer = false;
let peutValider = false;
let minuteriesSauvegarde = {}; // debounce par bloc

// Sections dépliées (persiste tant que la page reste ouverte, pour ne pas
// tout refermer à chaque sauvegarde/ajout).
const sectionsOuvertes = new Set();

// État du glisser-déposer, partagé entre tous les conteneurs (racine +
// chaque section) pour empêcher un déplacement d'un conteneur à un autre
// (non géré pour l'instant — on affinera les profondeurs plus tard).
let dragEtat = { element: null, conteneurOrigine: null };

const contenu = document.getElementById('contenu');
const filAriane = document.getElementById('filAriane');

async function init() {
  profilAdmin = await requireAdmin();
  if (!profilAdmin) return;

  document.getElementById('zoneDroite').innerHTML = `
    <span class="badge-utilisateur">${profilAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profilAdmin.prenom}</span>
    <a href="navigation.html" class="btn btn-discret">← Navigation</a>
    <button class="btn btn-discret" onclick="deconnecterAdmin()">Déconnexion</button>
  `;

  if (!idSeance) { contenu.innerHTML = '<p class="message-erreur">Aucune séance spécifiée.</p>'; return; }

  await chargerSeanceEtContexte();
  if (!seance) { contenu.innerHTML = '<p class="message-erreur">Séance introuvable ou accès refusé.</p>'; return; }

  peutEditer = await appelerPermission('peut_editer_perimetre');
  peutValider = await appelerPermission('peut_valider_perimetre');

  if (!peutEditer) {
    contenu.innerHTML = '<p class="message-erreur">Vous n\'avez pas les droits d\'édition sur ce contenu (classe/champ hors de votre périmètre).</p>';
    return;
  }

  await chargerBlocs();
  rendreFilAriane();
  rendre();
}

async function appelerPermission(nomFonction) {
  const { data } = await supabaseClient.rpc(nomFonction, {
    p_id: profilAdmin.id, p_classe_id: chaineNavigation.classe_id, p_champ_id: chaineNavigation.champ_id
  });
  return !!data;
}

async function chargerSeanceEtContexte() {
  const { data: s, error } = await supabaseClient.from('seances').select('*').eq('id', idSeance).single();
  if (error || !s) return;
  seance = s;

  const { data: sa } = await supabaseClient.from('sa').select('*').eq('id', s.sa_id).single();
  const { data: noeud } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', sa.noeud_id).single();
  const { data: classe } = await supabaseClient.from('classes').select('*').eq('id', noeud.classe_id).single();
  const { data: champ } = await supabaseClient.from('champs_formation').select('*').eq('id', noeud.champ_formation_id).single();

  chaineNavigation = { sa, noeud, classe_id: noeud.classe_id, champ_id: noeud.champ_formation_id, classeNom: classe.nom, champNom: champ.nom };
}

function rendreFilAriane() {
  // Chaque niveau (immédiat ou éloigné) est cliquable et ramène à la navigation.
  filAriane.innerHTML = `
    <span class="segment" data-retour="navigation.html" title="Retour à la liste des classes">${echapper(chaineNavigation.classeNom)}</span><span class="sep">›</span>
    <span class="segment" data-retour="navigation.html" title="Retour à ce champ de formation">${echapper(chaineNavigation.champNom)}</span><span class="sep">›</span>
    <span class="segment" data-retour="navigation.html" title="Retour à cette Situation d'Apprentissage">${echapper(chaineNavigation.sa.titre)}</span><span class="sep">›</span>
    <span class="segment actif">${echapper(seance.titre)}</span>`;

  filAriane.querySelectorAll('[data-retour]').forEach(el => {
    el.addEventListener('click', () => { window.location.href = el.dataset.retour; });
  });
}

async function chargerBlocs() {
  const { data, error } = await supabaseClient.from('blocs_seance').select('*').eq('seance_id', idSeance).order('ordre');
  if (error) { console.error(error); return; }
  blocs = data;
}

// --- RENDU GÉNÉRAL -------------------------------------------------------

function rendre() {
  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

  contenu.innerHTML = `
    <div class="barre-editeur">
      <div>
        <h2 style="margin:0 0 4px;color:var(--bleu-principal)">${echapper(seance.titre)}</h2>
        <input type="text" id="inputDiscipline" placeholder="Discipline (ex: Lecture, Grammaire, Conjugaison...)" value="${echapper(seance.discipline)}"
          style="border:1px solid var(--bordure);border-radius:6px;padding:4px 8px;font-size:12px;margin:4px 0;width:260px">
        <br><span class="infos-sauvegarde" id="infoSauvegarde">Dernier enregistrement : ${seance.modifie_le ? new Date(seance.modifie_le).toLocaleString('fr-FR') : '—'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select class="statut-select" id="selectStatut">
          ${Object.entries(pillsStatut).map(([v, l]) => `<option value="${v}" ${seance.statut === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        ${(peutValider && seance.statut !== 'publie') ? `<button class="btn btn-primaire" id="btnValider">✅ Valider et publier</button>` : ''}
        <button class="btn btn-discret" onclick="dupliquerSeance()">📑 Dupliquer la séance</button>
        <button class="btn btn-accent" onclick="ouvrirApercu()">👁️ Aperçu élève</button>
      </div>
    </div>

    <div id="listeBlocs"></div>

    <div class="menu-ajout">
      <button class="btn btn-primaire" onclick="basculerMenuAjout()">+ Ajouter un élément</button>
      <div class="liste-types" id="listeTypes">
        ${TYPES_BLOCS.map(t => `<button data-ajouter-type="${t.valeur}">${t.icone} ${t.label} <span style="color:var(--texte-gris);font-size:11px">— ${t.usage}</span></button>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('selectStatut').addEventListener('change', gererChangementStatut);
  const btnValider = document.getElementById('btnValider');
  if (btnValider) btnValider.addEventListener('click', async () => {
    const { error } = await supabaseClient.from('seances').update({ statut: 'publie' }).eq('id', seance.id);
    if (error) return alert(error.message);
    seance.statut = 'publie';
    rendre();
  });
  document.getElementById('inputDiscipline').addEventListener('change', async (e) => {
    seance.discipline = e.target.value || null;
    await supabaseClient.from('seances').update({ discipline: seance.discipline }).eq('id', seance.id);
    afficherSauvegarde();
  });
  document.getElementById('listeTypes').addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-ajouter-type]');
    if (bouton) ajouterBloc(bouton.dataset.ajouterType, null);
  });

  rendreListeBlocs();
}

function basculerMenuAjout() {
  document.getElementById('listeTypes').classList.toggle('ouvert');
}

// --- LISTE DES BLOCS (imbrication + glisser-déposer) ----------------------

function rendreListeBlocs() {
  const conteneurBlocs = document.getElementById('listeBlocs');
  const topNiveau = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);

  conteneurBlocs.innerHTML = topNiveau.length
    ? topNiveau.map(b => htmlBloc(b)).join('')
    : '<p class="chargement">Aucun bloc pour l\'instant — cliquez sur « + Ajouter un élément ».</p>';

  blocs.forEach(b => attacherEcouteursBloc(b));

  activerGlisserDeposer(conteneurBlocs, null);
  document.querySelectorAll('[data-conteneur-enfants]').forEach(c => {
    activerGlisserDeposer(c, parseInt(c.dataset.conteneurEnfants, 10));
  });
}

function htmlBloc(b) {
  const info = infoType(b.type_bloc);
  const estSection = TYPES_SECTIONS.includes(b.type_bloc);
  const enfants = estSection ? blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre) : [];
  const ouvert = sectionsOuvertes.has(b.id);

  return `
    <div class="bloc" draggable="true" data-bloc-id="${b.id}">
      <div class="bloc-entete">
        <span class="bloc-type">${info.icone} ${info.label}</span>
        <div class="bloc-actions">
          <button title="Dupliquer" data-action-bloc="dupliquer">📑</button>
          <button title="Supprimer" data-action-bloc="supprimer">🗑️</button>
        </div>
      </div>
      <div class="bloc-corps">${html_editeurBloc(b)}</div>
      ${estSection ? `
        <div class="zone-section">
          <button type="button" class="btn btn-discret" data-toggle-section="${b.id}">${ouvert ? '▾' : '▸'} Contenu (${enfants.length} bloc${enfants.length > 1 ? 's' : ''})</button>
          <div class="sous-blocs" data-conteneur-enfants="${b.id}" style="display:${ouvert ? 'block' : 'none'}">
            ${enfants.map(e => htmlBloc(e)).join('')}
            <button class="btn btn-accent" style="margin-top:8px" data-ajouter-dans-section="${b.id}" type="button">+ Ajouter un bloc ici</button>
          </div>
        </div>` : ''}
    </div>`;
}

function attacherEcouteursBloc(bloc) {
  const el = document.querySelector(`.bloc[data-bloc-id="${bloc.id}"]`);
  if (!el) return;

  // Champs simples (texte, url, légende, nom, formule, consigne...)
  el.querySelectorAll(':scope > .bloc-corps [data-champ]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      bloc.contenu = { ...bloc.contenu, [champEl.dataset.champ]: champEl.value };
      programmerSauvegardeBloc(bloc);
    });
  });

  // Éditeur de texte riche
  const zoneRiche = el.querySelector(':scope > .bloc-corps [data-champ-riche]');
  if (zoneRiche) {
    const sauverContenuRiche = () => {
      bloc.contenu = { ...bloc.contenu, [zoneRiche.dataset.champRiche]: zoneRiche.innerHTML };
      programmerSauvegardeBloc(bloc);
    };
    zoneRiche.addEventListener('input', sauverContenuRiche);

    const barreOutils = el.querySelector(':scope > .bloc-corps .barre-outils-texte');
    if (barreOutils) {
      barreOutils.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
          zoneRiche.focus();
          if (btn.dataset.cmd === 'hiliteColor') {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('hiliteColor', false, btn.dataset.valeur);
          } else if (btn.dataset.cmd === 'foreColor') {
            document.execCommand('foreColor', false, btn.dataset.valeur);
          } else {
            document.execCommand(btn.dataset.cmd, false, null);
          }
          sauverContenuRiche();
        });
      });
      const selectPolice = barreOutils.querySelector('[data-cmd-select="fontName"]');
      if (selectPolice) selectPolice.addEventListener('change', () => {
        zoneRiche.focus();
        document.execCommand('fontName', false, selectPolice.value);
        sauverContenuRiche();
      });
    }
  }

  // Palier
  const selectPalier = el.querySelector(':scope > .bloc-corps [data-champ-palier]');
  if (selectPalier) {
    selectPalier.addEventListener('change', () => {
      bloc.palier = selectPalier.value || null;
      programmerSauvegardeBloc(bloc);
    });
  }

  attacherEcouteursTableau(el, bloc);

  // Sections : déplier/replier + ajouter un bloc à l'intérieur
  const boutonToggleSection = el.querySelector(`:scope > .zone-section [data-toggle-section="${bloc.id}"]`);
  if (boutonToggleSection) boutonToggleSection.addEventListener('click', () => {
    const conteneurEnfants = el.querySelector(`[data-conteneur-enfants="${bloc.id}"]`);
    const ouvert = sectionsOuvertes.has(bloc.id);
    if (ouvert) sectionsOuvertes.delete(bloc.id); else sectionsOuvertes.add(bloc.id);
    conteneurEnfants.style.display = ouvert ? 'none' : 'block';
    boutonToggleSection.textContent = boutonToggleSection.textContent.replace(ouvert ? '▾' : '▸', ouvert ? '▸' : '▾');
  });
  const boutonAjouterDansSection = el.querySelector(`:scope > .zone-section [data-ajouter-dans-section="${bloc.id}"]`);
  if (boutonAjouterDansSection) boutonAjouterDansSection.addEventListener('click', () => ouvrirAjoutBlocDansSection(bloc.id));

  // Actions dupliquer / supprimer
  el.querySelectorAll(':scope > .bloc-entete [data-action-bloc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.actionBloc === 'dupliquer') dupliquerBloc(bloc);
      if (btn.dataset.actionBloc === 'supprimer') supprimerBloc(bloc);
    });
  });
}

function ouvrirAjoutBlocDansSection(parentBlocId) {
  ouvrirModal({
    titre: 'Ajouter un bloc dans cette section',
    champs: [{
      nom: 'type', label: 'Type de bloc', type: 'select',
      options: TYPES_BLOCS.map(t => ({ valeur: t.valeur, label: `${t.icone} ${t.label}` }))
    }],
    texteValider: 'Ajouter',
    onValider: ({ type }) => ajouterBloc(type, parentBlocId)
  });
}

// --- TABLEAU : cellules, lignes/colonnes, en-tête, bordures, fusion -------

function attacherEcouteursTableau(el, bloc) {
  const c = () => bloc.contenu || {};

  el.querySelectorAll(':scope > .bloc-corps [data-tableau-ligne]').forEach(cellEl => {
    cellEl.addEventListener('input', () => {
      const i = parseInt(cellEl.dataset.tableauLigne, 10);
      const j = parseInt(cellEl.dataset.tableauColonne, 10);
      const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
      lignes[i][j] = cellEl.value;
      bloc.contenu = { ...c(), lignes };
      programmerSauvegardeBloc(bloc);
    });
  });

  const declencherRerendu = (nouveauxChamps) => {
    bloc.contenu = { ...c(), ...nouveauxChamps };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  };

  const boutonLigne = el.querySelector(':scope > .bloc-corps [data-action="ajouter-ligne"]');
  if (boutonLigne) boutonLigne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    lignes.push(lignes[0].map(() => ''));
    declencherRerendu({ lignes });
  });
  const boutonSupprimerLigne = el.querySelector(':scope > .bloc-corps [data-action="supprimer-ligne"]');
  if (boutonSupprimerLigne) boutonSupprimerLigne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    if (lignes.length <= 1) return alert('Le tableau doit garder au moins une ligne.');
    lignes.pop();
    declencherRerendu({ lignes, fusions: (c().fusions || []).filter(f => f.ligne < lignes.length) });
  });
  const boutonColonne = el.querySelector(':scope > .bloc-corps [data-action="ajouter-colonne"]');
  if (boutonColonne) boutonColonne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l, '']);
    declencherRerendu({ lignes });
  });
  const boutonSupprimerColonne = el.querySelector(':scope > .bloc-corps [data-action="supprimer-colonne"]');
  if (boutonSupprimerColonne) boutonSupprimerColonne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    if (lignes[0].length <= 1) return alert('Le tableau doit garder au moins une colonne.');
    const derniereColonne = lignes[0].length - 1;
    lignes.forEach(l => l.pop());
    declencherRerendu({ lignes, fusions: (c().fusions || []).filter(f => f.colonneFin < derniereColonne) });
  });
  const boutonSupprimerTitreTableau = el.querySelector(':scope > .bloc-corps [data-action="supprimer-titre-tableau"]');
  if (boutonSupprimerTitreTableau) boutonSupprimerTitreTableau.addEventListener('click', () => declencherRerendu({ titre: '' }));

  const caseEntete = el.querySelector(':scope > .bloc-corps [data-champ-entete]');
  if (caseEntete) caseEntete.addEventListener('change', () => declencherRerendu({ entete: caseEntete.checked }));

  const caseBordures = el.querySelector(':scope > .bloc-corps [data-champ-bordures]');
  if (caseBordures) caseBordures.addEventListener('change', () => declencherRerendu({ bordures: caseBordures.checked }));

  el.querySelectorAll(':scope > .bloc-corps [data-action="couleur-entete"]').forEach(btn => {
    btn.addEventListener('click', () => declencherRerendu({ couleurEntete: btn.dataset.valeur }));
  });

  el.querySelectorAll(':scope > .bloc-corps [data-action="fusionner-cellule"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ligne = parseInt(btn.dataset.ligne, 10);
      const colonne = parseInt(btn.dataset.colonne, 10);
      const fusions = [...(c().fusions || []), { ligne, colonneDebut: colonne, colonneFin: colonne + 1 }];
      declencherRerendu({ fusions });
    });
  });
  el.querySelectorAll(':scope > .bloc-corps [data-action="separer-cellule"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ligne = parseInt(btn.dataset.ligne, 10);
      const colonne = parseInt(btn.dataset.colonne, 10);
      const fusions = (c().fusions || []).filter(f => !(f.ligne === ligne && f.colonneDebut === colonne));
      declencherRerendu({ fusions });
    });
  });
}

// --- GLISSER-DÉPOSER (scopé par conteneur : racine ou une section) --------

function activerGlisserDeposer(conteneur, parentBlocId) {
  const blocsDirects = [...conteneur.querySelectorAll(':scope > .bloc')];

  blocsDirects.forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      dragEtat = { element: el, conteneurOrigine: conteneur };
      el.classList.add('en-glissement');
    });
    el.addEventListener('dragend', (e) => {
      e.stopPropagation();
      el.classList.remove('en-glissement');
      dragEtat = { element: null, conteneurOrigine: null };
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragEtat.element || dragEtat.element === el || dragEtat.conteneurOrigine !== conteneur) return; // pas de déplacement entre conteneurs pour l'instant
      const rect = el.getBoundingClientRect();
      const apres = (e.clientY - rect.top) > rect.height / 2;
      conteneur.insertBefore(dragEtat.element, apres ? el.nextSibling : el);
    });
    el.addEventListener('drop', (e) => {
      e.stopPropagation();
      if (dragEtat.conteneurOrigine === conteneur) enregistrerNouvelOrdre(conteneur);
    });
  });
}

async function enregistrerNouvelOrdre(conteneur) {
  const idsOrdonnes = [...conteneur.querySelectorAll(':scope > .bloc')].map(el => parseInt(el.dataset.blocId, 10));
  idsOrdonnes.forEach((id, index) => {
    const b = blocs.find(x => x.id === id);
    if (b) b.ordre = index;
  });
  for (const id of idsOrdonnes) {
    const b = blocs.find(x => x.id === id);
    await supabaseClient.from('blocs_seance').update({ ordre: b.ordre }).eq('id', id);
  }
  afficherSauvegarde();
}

// --- SAUVEGARDE (debounce par bloc) ----------------------------------------

function programmerSauvegardeBloc(bloc) {
  clearTimeout(minuteriesSauvegarde[bloc.id]);
  minuteriesSauvegarde[bloc.id] = setTimeout(async () => {
    await supabaseClient.from('blocs_seance').update({ contenu: bloc.contenu, palier: bloc.palier }).eq('id', bloc.id);
    await supabaseClient.from('seances').update({ modifie_le: new Date().toISOString(), modifie_par: profilAdmin.id }).eq('id', seance.id);
    afficherSauvegarde();
  }, 700);
}

function afficherSauvegarde() {
  const el = document.getElementById('infoSauvegarde');
  if (el) el.textContent = `Dernier enregistrement : ${new Date().toLocaleString('fr-FR')}`;
}

// --- AJOUT / DUPLICATION / SUPPRESSION DE BLOCS -----------------------------

async function ajouterBloc(type, parentBlocId) {
  document.getElementById('listeTypes').classList.remove('ouvert');
  const fratrie = blocs.filter(b => (b.parent_bloc_id || null) === (parentBlocId || null));
  const ordreMax = fratrie.length ? Math.max(...fratrie.map(b => b.ordre)) : -1;
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: type, contenu: {}, ordre: ordreMax + 1, parent_bloc_id: parentBlocId || null
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);
  if (parentBlocId) sectionsOuvertes.add(parentBlocId);
  rendreListeBlocs();
  afficherSauvegarde();
}

async function dupliquerBloc(bloc) {
  const fratrie = blocs.filter(b => (b.parent_bloc_id || null) === (bloc.parent_bloc_id || null));
  const ordreMax = Math.max(...fratrie.map(b => b.ordre));
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: bloc.type_bloc, contenu: bloc.contenu, palier: bloc.palier,
    ordre: ordreMax + 1, parent_bloc_id: bloc.parent_bloc_id || null
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);
  rendreListeBlocs();
  // Note : les sous-blocs d'une section dupliquée ne sont pas encore
  // copiés automatiquement — à affiner avec les règles de profondeur.
}

function supprimerBloc(bloc) {
  const nbEnfants = blocs.filter(b => b.parent_bloc_id === bloc.id).length;
  confirmerAction(nbEnfants ? `Supprimer ce bloc et les ${nbEnfants} bloc(s) qu'il contient ?` : 'Supprimer ce bloc ?', async () => {
    const { error } = await supabaseClient.from('blocs_seance').delete().eq('id', bloc.id);
    if (error) return alert(error.message);
    blocs = blocs.filter(b => b.id !== bloc.id && b.parent_bloc_id !== bloc.id);
    rendreListeBlocs();
  });
}

// --- STATUT (brouillon / publié / archivé) ----------------------------------

async function gererChangementStatut(e) {
  const nouveauStatut = e.target.value;
  if (nouveauStatut === 'publie' && !peutValider) {
    alert("Vous n'avez pas les droits de validation nécessaires pour publier cette séance. Elle reste en l'état actuel.");
    e.target.value = seance.statut;
    return;
  }
  const { error } = await supabaseClient.from('seances').update({ statut: nouveauStatut }).eq('id', seance.id);
  if (error) { alert(error.message); e.target.value = seance.statut; return; }
  seance.statut = nouveauStatut;
  afficherSauvegarde();
}

// --- DUPLICATION DE SÉANCE ---------------------------------------------------

function dupliquerSeance() {
  confirmerAction('Dupliquer cette séance (avec tous ses blocs) ?', async () => {
    const { data: nouvelleSeance, error } = await supabaseClient.from('seances').insert({
      sa_id: seance.sa_id, titre: seance.titre + ' (copie)', statut: 'brouillon', ordre: seance.ordre + 1,
      cree_par: profilAdmin.id
    }).select().single();
    if (error) return alert(error.message);

    // On duplique d'abord les blocs de premier niveau, puis leurs enfants,
    // pour reconstituer les sections avec leur contenu.
    const correspondance = {}; // ancien id -> nouvel id
    const topNiveau = blocs.filter(b => !b.parent_bloc_id);
    for (const b of topNiveau) {
      const { data: copie } = await supabaseClient.from('blocs_seance').insert({
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier, ordre: b.ordre
      }).select().single();
      correspondance[b.id] = copie.id;
    }
    const enfants = blocs.filter(b => b.parent_bloc_id);
    for (const b of enfants) {
      await supabaseClient.from('blocs_seance').insert({
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier,
        ordre: b.ordre, parent_bloc_id: correspondance[b.parent_bloc_id] || null
      });
    }
    window.location.href = `editeur-seance.html?id=${nouvelleSeance.id}`;
  });
}

// --- APERÇU ÉLÈVE (lecture seule, dans un nouvel onglet) ---------------------

function ouvrirApercu() {
  const fenetre = window.open('', '_blank');

  function rendreBlocApercu(b) {
    const info = infoType(b.type_bloc);
    const c = b.contenu || {};
    let corps = '';
    if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div>${contenuRicheInitial(c.texte)}</div>`;
    else if (b.type_bloc === 'titre') corps = `<h3>${echapper(c.texte)}</h3>`;
    else if (b.type_bloc === 'consigne') corps = `<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'autre') corps = `${c.nom ? `<p style="font-weight:700">${echapper(c.nom)}</p>` : ''}<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" style="max-width:100%;border-radius:8px"><p><em>${echapper(c.legende)}</em></p>`;
    else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank">${echapper(c.legende) || c.url}</a></p>`;
    else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank">${echapper(c.nom)}</a></p>`;
    else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
    else if (b.type_bloc === 'tableau') {
      const fusions = c.fusions || [];
      const masquee = (i, j) => fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
      const colspan = (i, j) => { const f = fusions.find(f => f.ligne === i && f.colonneDebut === j); return f ? (f.colonneFin - f.colonneDebut + 1) : 1; };
      const bordure = c.bordures === false ? 'none' : '1px solid #E2E8F0';
      const lignesHtml = (c.lignes || []).map((l, i) => {
        const style = c.entete && i === 0 ? ` style="background:${c.couleurEntete || '#F4F7F9'};font-weight:800;color:#003366"` : '';
        return `<tr${style}>${l.map((cel, j) => masquee(i, j) ? '' : `<td ${colspan(i, j) > 1 ? `colspan="${colspan(i, j)}"` : ''} style="border:${bordure};padding:6px">${echapper(cel)}</td>`).join('')}</tr>`;
      }).join('');
      corps = `${c.titre ? `<p style="font-weight:700;margin-bottom:6px">${echapper(c.titre)}</p>` : ''}<table style="border-collapse:collapse;width:100%">${lignesHtml}</table>`;
    }
    else corps = `<p>${echapper(c.consigne)}</p>${b.palier ? `<p><em>Palier : ${b.palier}</em></p>` : ''}`;

    const enfants = blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
    return `<div style="margin-bottom:18px;padding:14px;border-left:4px solid #003366;background:#F4F7F9;border-radius:8px">
      <div style="font-size:12px;font-weight:bold;color:#003366;text-transform:uppercase">${info.icone} ${info.label}</div>
      ${corps}
      ${enfants.length ? `<div style="margin-left:16px;margin-top:10px;border-left:2px dashed #E2E8F0;padding-left:12px">${enfants.map(rendreBlocApercu).join('')}</div>` : ''}
    </div>`;
  }

  const topNiveau = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const html = topNiveau.map(rendreBlocApercu).join('');

  fenetre.document.write(`
    <html><head><meta charset="UTF-8"><title>Aperçu — ${echapper(seance.titre)}</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:30px auto;padding:0 20px;color:#1E293B}</style>
    </head><body><h1 style="color:#003366">${echapper(seance.titre)}</h1>${html}</body></html>`);
  fenetre.document.close();
}

init();
