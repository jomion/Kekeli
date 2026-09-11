// Fichier chargé par pages/admin/activites.html — la correction des
// activités est réservée aux administrateurs qui en ont explicitement le
// droit (rôle admin personnalisé avec "peut_corriger_activites", ou
// super_admin qui a tous les droits). Ce n'est plus accessible aux
// enseignants (voir migration
// "retire_edition_seance_et_correction_activites_aux_enseignants") : dès
// qu'une activité est proposée par un administrateur habilité, c'est lui
// (ou un autre administrateur habilité) qui la corrige — plus l'enseignant.
// Les blocs de type "activite" et les rendus des élèves (rendus_activites)
// restent filtrés par la RLS (admin_peut_corriger_activites côté base) :
// cette page vérifie aussi le droit côté client pour afficher un message
// clair plutôt qu'une page vide si l'admin connecté n'a pas ce droit.

let profilActivites = null;
let blocsActivites = [];
let filtreClasseActivites = '';
let filtrePalierActivites = '';
let triActivites = 'recent'; // 'recent' | 'a_corriger' | 'classe'

const LIBELLES_PALIER_ACT = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };

function echapperAct(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

async function init() {
  profilActivites = await requireAdmin();
  if (!profilActivites) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilActivites.id,
    badgeHtml: `${profilActivites.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperAct(profilActivites.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilActivites.est_super_admin })
  });

  const { data: aLeDroit } = await supabaseClient.rpc('admin_a_droit', { p_id: profilActivites.id, p_droit: 'corriger_activites' });
  if (!aLeDroit) {
    document.getElementById('contenu').innerHTML = `<p class="chargement">⛔ Cette page est réservée aux administrateurs habilités à corriger les activités. Demandez au super administrateur de vous attribuer ce droit (page "Rôles administrateurs").</p>`;
    return;
  }

  await chargerActivites();
}

async function chargerActivites() {
  const zone = document.getElementById('contenu');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  // Les activités de devoir (blocs_seance.devoir_id renseigné) sont exclues
  // ici : elles ont leur propre écran de correction dans le panneau de
  // gestion du devoir (onglet "Devoirs & notes" — js/devoirs-notes-rendu.js,
  // ouvrirCorrectionActiviteDevoir), où le contexte (devoir, élève, note
  // globale) est clair. Les lister aussi ici les afficherait sans classe ni
  // séance (elles n'ont pas de seance_id), ce qui serait confus.
  // Depuis le remplacement du bloc "Problème" (11 septembre 2026), les blocs
  // 'probleme' de séance atterrissent aussi ici — même écran, mais leur
  // correction se fait via une note détaillée par étape (voir
  // ouvrirCorrectionProbleme) plutôt que le champ "note" unique générique.
  const { data, error } = await supabaseClient
    .from('blocs_seance')
    .select('id, type_bloc, contenu, palier, seance_id, seances(titre, sa_id, sa(titre, noeud_id, noeuds_parcours(classe_id, champ_formation_id, classes(nom), champs_formation(nom))))')
    .in('type_bloc', ['activite', 'probleme'])
    .is('devoir_id', null)
    .order('id', { ascending: false });

  if (error) { zone.innerHTML = `<p class="chargement">Erreur : ${echapperAct(error.message)}</p>`; return; }
  blocsActivites = data || [];

  if (!blocsActivites.length) {
    zone.innerHTML = `<p class="chargement">Aucune activité pour l'instant — créez un bloc "Activité" ou "Problème" depuis l'éditeur de séance.</p>`;
    return;
  }

  await rendrePageActivites();
}

async function rendrePageActivites() {
  const zone = document.getElementById('contenu');

  const noeud = (b) => b.seances?.sa?.noeuds_parcours;
  const classesDispo = [...new Map(blocsActivites.map(b => [noeud(b)?.classe_id, noeud(b)?.classes?.nom]).filter(([id]) => id)).entries()];

  const blocsFiltres = blocsActivites.filter(b =>
    (!filtreClasseActivites || String(noeud(b)?.classe_id) === filtreClasseActivites) &&
    (!filtrePalierActivites || b.palier === filtrePalierActivites)
  );

  const idsBlocs = blocsFiltres.map(b => b.id);
  const { data: rendus } = idsBlocs.length
    ? await supabaseClient.from('rendus_activites').select('*').in('bloc_id', idsBlocs).order('soumis_le', { ascending: false })
    : { data: [] };
  const idsEleves = [...new Set((rendus || []).map(r => r.eleve_id))];
  const { data: profilsEleves } = idsEleves.length
    ? await supabaseClient.from('profils').select('id, prenom, nom').in('id', idsEleves)
    : { data: [] };
  const profilParId = {};
  (profilsEleves || []).forEach(p => { profilParId[p.id] = p; });
  const rendusParBloc = {};
  (rendus || []).forEach(r => { (rendusParBloc[r.bloc_id] ??= []).push(r); });

  // Tris (Task #36) : par défaut les plus récentes d'abord (comme avant),
  // ou en priorité celles qui ont le plus de rendus à corriger — utile dès
  // qu'il y a beaucoup d'activités à traiter — ou groupées par classe.
  const enAttenteDe = (b) => (rendusParBloc[b.id] || []).filter(r => !r.corrige_le).length;
  const blocsTries = [...blocsFiltres].sort((a, b) => {
    if (triActivites === 'a_corriger') return enAttenteDe(b) - enAttenteDe(a);
    if (triActivites === 'classe') return (noeud(a)?.classes?.nom || '').localeCompare(noeud(b)?.classes?.nom || '', 'fr');
    return b.id - a.id; // 'recent'
  });

  zone.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <select id="selectClasseAct" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Toutes les classes —</option>
        ${classesDispo.map(([id, nom]) => `<option value="${id}" ${filtreClasseActivites === String(id) ? 'selected' : ''}>${echapperAct(nom)}</option>`).join('')}
      </select>
      <select id="selectPalierAct" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Tous les paliers —</option>
        ${Object.entries(LIBELLES_PALIER_ACT).map(([v, l]) => `<option value="${v}" ${filtrePalierActivites === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <select id="selectTriAct" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="recent" ${triActivites === 'recent' ? 'selected' : ''}>Plus récentes d'abord</option>
        <option value="a_corriger" ${triActivites === 'a_corriger' ? 'selected' : ''}>À corriger en priorité</option>
        <option value="classe" ${triActivites === 'classe' ? 'selected' : ''}>Par classe</option>
      </select>
    </div>

    ${blocsTries.length ? blocsTries.map(b => {
      const c = b.contenu || {};
      const rendusBloc = rendusParBloc[b.id] || [];
      const enAttente = rendusBloc.filter(r => !r.corrige_le).length;
      return `
      <div class="carte-plan" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <h4 style="margin:0 0 4px">${echapperAct(b.seances?.titre || '')} ${b.palier ? `<span class="statut-pill" style="background:var(--bleu-clair);color:var(--bleu-principal)">${LIBELLES_PALIER_ACT[b.palier] || b.palier}</span>` : ''}</h4>
            <p style="margin:0;font-size:12px;color:var(--texte-gris)">${echapperAct(noeud(b)?.classes?.nom || '')} · ${echapperAct(noeud(b)?.champs_formation?.nom || '')} · ${echapperAct(b.seances?.sa?.titre || '')}</p>
          </div>
          ${enAttente ? `<span class="statut-pill" style="background:#FFF3E0;color:#B8860B">${enAttente} à corriger</span>` : ''}
        </div>
        <p style="margin:10px 0 12px;font-size:13px">${b.type_bloc === 'probleme' ? contenuRicheInitial(c.enonce || '') : echapperAct(c.consigne || '')}</p>
        ${rendusBloc.length ? `<div class="liste-lignes">${rendusBloc.map(r => `
          <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;flex-wrap:wrap;gap:6px">
              <strong>${echapperAct(profilParId[r.eleve_id]?.prenom || '')} ${echapperAct(profilParId[r.eleve_id]?.nom || '')}</strong>
              ${r.corrige_le
                ? `<span class="statut-pill statut-publie">${r.note != null ? `${r.note}/${r.bareme}` : ''} ${r.appreciation ? ({ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' })[r.appreciation] : ''}</span>`
                : `<button class="btn btn-primaire" data-corriger-rendu="${r.id}" data-type-bloc-rendu="${b.type_bloc}" style="padding:5px 12px;font-size:12px">✏️ Corriger</button>`}
            </div>
            ${(r.reponse_texte && b.type_bloc !== 'probleme') ? `<p style="margin:0;font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px;width:100%">${echapperAct(r.reponse_texte)}</p>` : ''}
            ${r.piece_jointe_url ? `<a href="${echapperAct(r.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Pièce jointe</a>` : ''}
            ${r.commentaire ? `<p style="margin:0;font-size:12px;color:var(--texte-gris)">💬 ${echapperAct(r.commentaire)}</p>` : ''}
          </div>`).join('')}</div>` : `<p style="font-size:12px;color:var(--texte-gris)">Aucun rendu pour l'instant.</p>`}
      </div>`;
    }).join('') : '<p class="chargement">Aucune activité pour ce filtre.</p>'}
  `;

  document.getElementById('selectClasseAct').addEventListener('change', (e) => { filtreClasseActivites = e.target.value; rendrePageActivites(); });
  document.getElementById('selectPalierAct').addEventListener('change', (e) => { filtrePalierActivites = e.target.value; rendrePageActivites(); });
  document.getElementById('selectTriAct').addEventListener('change', (e) => { triActivites = e.target.value; rendrePageActivites(); });
  zone.querySelectorAll('[data-corriger-rendu]').forEach(btn => {
    const renduId = parseInt(btn.dataset.corrigerRendu, 10);
    if (btn.dataset.typeBlocRendu === 'probleme') {
      btn.addEventListener('click', () => {
        const rendu = blocsActivites.flatMap(bl => rendusParBloc[bl.id] || []).find(r => r.id === renduId);
        const bloc = blocsActivites.find(bl => (rendusParBloc[bl.id] || []).some(r => r.id === renduId));
        if (bloc && rendu) ouvrirCorrectionProbleme(bloc, rendu, profilParId[rendu.eleve_id]);
      });
    } else {
      btn.addEventListener('click', () => corrigerRendu(renduId));
    }
  });
}

function corrigerRendu(renduId) {
  ouvrirModal({
    titre: 'Corriger cette activité',
    champs: [
      { nom: 'note', label: 'Note (optionnelle)', type: 'number', requis: false, placeholder: 'Sur 20' },
      { nom: 'appreciation', label: 'Appréciation (optionnelle)', type: 'select', requis: false,
        options: [{ valeur: '', label: '— Aucune —' }, { valeur: 'acquis', label: 'Acquis' }, { valeur: 'en_cours', label: 'En cours' }, { valeur: 'non_acquis', label: 'Non acquis' }] },
      { nom: 'commentaire', label: 'Commentaire (optionnel)', type: 'textarea', requis: false, placeholder: 'Retour pour l\'élève...' }
    ],
    texteValider: 'Enregistrer la correction',
    onValider: async ({ note, appreciation, commentaire }) => {
      const { error } = await supabaseClient.from('rendus_activites').update({
        note: note ? parseFloat(note) : null,
        appreciation: appreciation || null,
        commentaire: commentaire || null,
        corrige_par: profilActivites.id,
        corrige_le: new Date().toISOString()
      }).eq('id', renduId);
      if (error) return alert(error.message);
      rendrePageActivites();
    }
  });
}

// Correction détaillée d'un rendu de bloc "Problème" (v2, 11 septembre
// 2026) : une note libre par étape et par colonne (Solution/Équation/
// Résultat, sans maximum fixe), sommées automatiquement pour donner la note
// finale — demande explicite du porteur du projet. Modale bespoke (pas
// ouvrirModal, qui ne gère pas une liste de champs dynamique) construite
// autour du corps partagé html_formulaireCorrectionProbleme (js/editeur/blocs.js),
// pour rester identique à l'équivalent côté devoir (js/devoirs-notes-rendu.js,
// ouvrirCorrectionProblemeDevoir).
function ouvrirCorrectionProbleme(bloc, rendu, profilEleve) {
  const c = bloc.contenu || {};
  const lignes = Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : [];
  const reponseLignes = lireReponseProbleme(rendu.reponse_texte);
  const detailsExistants = rendu.details_notation || {};

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite modal-boite-large">
      <h3>Corriger le problème — ${echapperAct(profilEleve?.prenom || '')} ${echapperAct(profilEleve?.nom || '')}</h3>
      <form id="formCorrectionProbleme">
        ${html_formulaireCorrectionProbleme(c, reponseLignes, detailsExistants)}
        <label class="champ-modal">Appréciation (optionnelle)
          <select name="appreciation">
            <option value="" ${!rendu.appreciation ? 'selected' : ''}>— Aucune —</option>
            <option value="acquis" ${rendu.appreciation === 'acquis' ? 'selected' : ''}>Acquis</option>
            <option value="en_cours" ${rendu.appreciation === 'en_cours' ? 'selected' : ''}>En cours</option>
            <option value="non_acquis" ${rendu.appreciation === 'non_acquis' ? 'selected' : ''}>Non acquis</option>
          </select>
        </label>
        <label class="champ-modal">Commentaire (optionnel)
          <textarea name="commentaire" placeholder="Retour pour l'élève...">${echapperAct(rendu.commentaire || '')}</textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
          <button type="submit" class="btn btn-primaire">Enregistrer la correction</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

  const form = overlay.querySelector('#formCorrectionProbleme');
  attacherMiseAJourTotalCorrectionProbleme(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const details = collecterDetailsNotationProbleme(form, lignes.length);
    const note = sommeNotesDetailleesProbleme(details);
    const appreciation = form.querySelector('[name="appreciation"]').value;
    const commentaire = form.querySelector('[name="commentaire"]').value;
    const { error } = await supabaseClient.from('rendus_activites').update({
      note,
      details_notation: details,
      appreciation: appreciation || null,
      commentaire: commentaire || null,
      corrige_par: profilActivites.id,
      corrige_le: new Date().toISOString()
    }).eq('id', rendu.id);
    if (error) return alert(error.message);
    fermer();
    rendrePageActivites();
  });
}

init();
