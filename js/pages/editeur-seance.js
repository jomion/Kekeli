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
  filAriane.innerHTML = `
    <span class="segment" onclick="window.location.href='navigation.html'">${chaineNavigation.classeNom}</span><span class="sep">›</span>
    <span class="segment">${chaineNavigation.champNom}</span><span class="sep">›</span>
    <span class="segment">${chaineNavigation.sa.titre}</span><span class="sep">›</span>
    <span class="segment actif">${seance.titre}</span>`;
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
        <h2 style="margin:0 0 4px;color:var(--bleu-principal)">${seance.titre}</h2>
        <input type="text" id="inputDiscipline" placeholder="Discipline (ex: Lecture, Grammaire, Conjugaison...)" value="${(seance.discipline || '').replace(/"/g, '&quot;')}"
          style="border:1px solid var(--bordure);border-radius:6px;padding:4px 8px;font-size:12px;margin:4px 0;width:260px">
        <br><span class="infos-sauvegarde" id="infoSauvegarde">Dernier enregistrement : ${seance.modifie_le ? new Date(seance.modifie_le).toLocaleString('fr-FR') : '—'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select class="statut-select" id="selectStatut">
          ${Object.entries(pillsStatut).map(([v, l]) => `<option value="${v}" ${seance.statut === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
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
  document.getElementById('inputDiscipline').addEventListener('change', async (e) => {
    seance.discipline = e.target.value || null;
    await supabaseClient.from('seances').update({ discipline: seance.discipline }).eq('id', seance.id);
    afficherSauvegarde();
  });
  document.getElementById('listeTypes').addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-ajouter-type]');
    if (bouton) ajouterBloc(bouton.dataset.ajouterType);
  });

  rendreListeBlocs();
}

function basculerMenuAjout() {
  document.getElementById('listeTypes').classList.toggle('ouvert');
}

// --- LISTE DES BLOCS (avec glisser-déposer) -------------------------------

function rendreListeBlocs() {
  const conteneurBlocs = document.getElementById('listeBlocs');
  if (blocs.length === 0) {
    conteneurBlocs.innerHTML = '<p class="chargement">Aucun bloc pour l\'instant — cliquez sur « + Ajouter un élément ».</p>';
    return;
  }

  conteneurBlocs.innerHTML = blocs.map(b => {
    const info = infoType(b.type_bloc);
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
      </div>`;
  }).join('');

  blocs.forEach(b => attacherEcouteursBloc(b));
  activerGlisserDeposer();
}

function attacherEcouteursBloc(bloc) {
  const el = document.querySelector(`.bloc[data-bloc-id="${bloc.id}"]`);
  if (!el) return;

  // Champs simples (texte, url, légende, nom, formule, consigne...)
  el.querySelectorAll('[data-champ]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      bloc.contenu = { ...bloc.contenu, [champEl.dataset.champ]: champEl.value };
      programmerSauvegardeBloc(bloc);
    });
  });

  // Palier
  const selectPalier = el.querySelector('[data-champ-palier]');
  if (selectPalier) {
    selectPalier.addEventListener('change', () => {
      bloc.palier = selectPalier.value || null;
      programmerSauvegardeBloc(bloc);
    });
  }

  // Tableau : cellules
  el.querySelectorAll('[data-tableau-ligne]').forEach(cellEl => {
    cellEl.addEventListener('input', () => {
      const i = parseInt(cellEl.dataset.tableauLigne, 10);
      const j = parseInt(cellEl.dataset.tableauColonne, 10);
      const lignes = (bloc.contenu.lignes || [['', ''], ['', '']]).map(l => [...l]);
      lignes[i][j] = cellEl.value;
      bloc.contenu = { ...bloc.contenu, lignes };
      programmerSauvegardeBloc(bloc);
    });
  });
  const boutonLigne = el.querySelector('[data-action="ajouter-ligne"]');
  if (boutonLigne) boutonLigne.addEventListener('click', () => {
    const lignes = (bloc.contenu.lignes || [['', ''], ['', '']]).map(l => [...l]);
    lignes.push(lignes[0].map(() => ''));
    bloc.contenu = { ...bloc.contenu, lignes };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  });
  const boutonColonne = el.querySelector('[data-action="ajouter-colonne"]');
  if (boutonColonne) boutonColonne.addEventListener('click', () => {
    const lignes = (bloc.contenu.lignes || [['', ''], ['', '']]).map(l => [...l, '']);
    bloc.contenu = { ...bloc.contenu, lignes };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  });

  // Actions dupliquer / supprimer
  el.querySelectorAll('[data-action-bloc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.actionBloc === 'dupliquer') dupliquerBloc(bloc);
      if (btn.dataset.actionBloc === 'supprimer') supprimerBloc(bloc);
    });
  });
}

// --- GLISSER-DÉPOSER -------------------------------------------------------

function activerGlisserDeposer() {
  const conteneurBlocs = document.getElementById('listeBlocs');
  let elementGlisse = null;

  conteneurBlocs.querySelectorAll('.bloc').forEach(el => {
    el.addEventListener('dragstart', () => { elementGlisse = el; el.classList.add('en-glissement'); });
    el.addEventListener('dragend', () => { el.classList.remove('en-glissement'); });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!elementGlisse || elementGlisse === el) return;
      const rect = el.getBoundingClientRect();
      const apres = (e.clientY - rect.top) > rect.height / 2;
      conteneurBlocs.insertBefore(elementGlisse, apres ? el.nextSibling : el);
    });
    el.addEventListener('drop', () => enregistrerNouvelOrdre());
  });
}

async function enregistrerNouvelOrdre() {
  const idsOrdonnes = [...document.querySelectorAll('#listeBlocs .bloc')].map(el => parseInt(el.dataset.blocId, 10));
  idsOrdonnes.forEach((id, index) => {
    const b = blocs.find(x => x.id === id);
    if (b) b.ordre = index;
  });
  blocs.sort((a, b) => a.ordre - b.ordre);
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

async function ajouterBloc(type) {
  document.getElementById('listeTypes').classList.remove('ouvert');
  const ordreMax = blocs.length ? Math.max(...blocs.map(b => b.ordre)) : -1;
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: type, contenu: {}, ordre: ordreMax + 1
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);
  rendreListeBlocs();
  afficherSauvegarde();
}

async function dupliquerBloc(bloc) {
  const ordreMax = Math.max(...blocs.map(b => b.ordre));
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: bloc.type_bloc, contenu: bloc.contenu, palier: bloc.palier, ordre: ordreMax + 1
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);
  rendreListeBlocs();
}

async function supprimerBloc(bloc) {
  if (!confirm('Supprimer ce bloc ?')) return;
  const { error } = await supabaseClient.from('blocs_seance').delete().eq('id', bloc.id);
  if (error) return alert(error.message);
  blocs = blocs.filter(b => b.id !== bloc.id);
  rendreListeBlocs();
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

async function dupliquerSeance() {
  if (!confirm('Dupliquer cette séance (avec tous ses blocs) ?')) return;
  const { data: nouvelleSeance, error } = await supabaseClient.from('seances').insert({
    sa_id: seance.sa_id, titre: seance.titre + ' (copie)', statut: 'brouillon', ordre: seance.ordre + 1,
    cree_par: profilAdmin.id
  }).select().single();
  if (error) return alert(error.message);

  for (const b of blocs) {
    await supabaseClient.from('blocs_seance').insert({
      seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier, ordre: b.ordre
    });
  }
  window.location.href = `editeur-seance.html?id=${nouvelleSeance.id}`;
}

// --- APERÇU ÉLÈVE (lecture seule, dans un nouvel onglet) ---------------------

function ouvrirApercu() {
  const fenetre = window.open('', '_blank');
  const html = blocs.map(b => {
    const info = infoType(b.type_bloc);
    const c = b.contenu || {};
    let corps = '';
    if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<p>${echapper(c.texte).replace(/\n/g, '<br>')}</p>`;
    else if (b.type_bloc === 'titre') corps = `<h3>${echapper(c.texte)}</h3>`;
    else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" style="max-width:100%;border-radius:8px"><p><em>${echapper(c.legende)}</em></p>`;
    else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank">${echapper(c.legende) || c.url}</a></p>`;
    else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank">${echapper(c.nom)}</a></p>`;
    else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
    else if (b.type_bloc === 'tableau') corps = `<table border="1" cellpadding="6" style="border-collapse:collapse">${(c.lignes || []).map(l => `<tr>${l.map(cel => `<td>${echapper(cel)}</td>`).join('')}</tr>`).join('')}</table>`;
    else corps = `<p>${echapper(c.consigne)}</p>${b.palier ? `<p><em>Palier : ${b.palier}</em></p>` : ''}`;
    return `<div style="margin-bottom:18px;padding:14px;border-left:4px solid #003366;background:#F4F7F9;border-radius:8px">
      <div style="font-size:12px;font-weight:bold;color:#003366;text-transform:uppercase">${info.icone} ${info.label}</div>
      ${corps}
    </div>`;
  }).join('');

  fenetre.document.write(`
    <html><head><meta charset="UTF-8"><title>Aperçu — ${seance.titre}</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:30px auto;padding:0 20px;color:#1E293B}</style>
    </head><body><h1 style="color:#003366">${seance.titre}</h1>${html}</body></html>`);
  fenetre.document.close();
}

init();
