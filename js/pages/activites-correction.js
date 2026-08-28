// Fichier partagé par pages/admin/activites.html et pages/enseignant/activites.html
// — la page définit au préalable `const ROLE_ACTIVITES = 'admin' | 'enseignant';`
// avant de charger ce script. Les blocs de type "activite" et les rendus des
// élèves (rendus_activites) sont filtrés automatiquement par la RLS selon le
// périmètre de l'utilisateur connecté (peut_gerer_classe_champ) : cette page
// n'a donc besoin d'aucune logique de permission côté client, seulement
// d'afficher ce que la base accepte déjà de lui renvoyer.

let profilActivites = null;
let blocsActivites = [];
let filtreClasseActivites = '';
let filtrePalierActivites = '';

const LIBELLES_PALIER_ACT = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };

function echapperAct(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

async function init() {
  profilActivites = ROLE_ACTIVITES === 'admin' ? await requireAdmin() : await requireRole('enseignant');
  if (!profilActivites) return;

  document.getElementById('zoneDroite').insertAdjacentHTML('afterbegin', ROLE_ACTIVITES === 'admin'
    ? `<span class="badge-utilisateur">${profilActivites.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperAct(profilActivites.prenom)}</span>`
    : `<span class="badge-utilisateur">🧑‍🏫 ${echapperAct(profilActivites.prenom)}</span>`);

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
  const { data, error } = await supabaseClient
    .from('blocs_seance')
    .select('id, contenu, palier, seance_id, seances(titre, sa_id, sa(titre, noeud_id, noeuds_parcours(classe_id, champ_formation_id, classes(nom), champs_formation(nom))))')
    .eq('type_bloc', 'activite')
    .is('devoir_id', null)
    .order('id', { ascending: false });

  if (error) { zone.innerHTML = `<p class="chargement">Erreur : ${echapperAct(error.message)}</p>`; return; }
  blocsActivites = data || [];

  if (!blocsActivites.length) {
    zone.innerHTML = `<p class="chargement">Aucune activité pour l'instant${ROLE_ACTIVITES === 'enseignant' ? ' dans votre périmètre' : ''} — créez un bloc "Activité" depuis l'éditeur de séance.</p>`;
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
    </div>

    ${blocsFiltres.length ? blocsFiltres.map(b => {
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
        <p style="margin:10px 0 12px;font-size:13px">${echapperAct(c.consigne || '')}</p>
        ${rendusBloc.length ? `<div class="liste-lignes">${rendusBloc.map(r => `
          <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;flex-wrap:wrap;gap:6px">
              <strong>${echapperAct(profilParId[r.eleve_id]?.prenom || '')} ${echapperAct(profilParId[r.eleve_id]?.nom || '')}</strong>
              ${r.corrige_le
                ? `<span class="statut-pill statut-publie">${r.note != null ? `${r.note}/${r.bareme}` : ''} ${r.appreciation ? ({ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' })[r.appreciation] : ''}</span>`
                : `<button class="btn btn-primaire" data-corriger-rendu="${r.id}" style="padding:5px 12px;font-size:12px">✏️ Corriger</button>`}
            </div>
            ${r.reponse_texte ? `<p style="margin:0;font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px;width:100%">${echapperAct(r.reponse_texte)}</p>` : ''}
            ${r.piece_jointe_url ? `<a href="${echapperAct(r.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Pièce jointe</a>` : ''}
            ${r.commentaire ? `<p style="margin:0;font-size:12px;color:var(--texte-gris)">💬 ${echapperAct(r.commentaire)}</p>` : ''}
          </div>`).join('')}</div>` : `<p style="font-size:12px;color:var(--texte-gris)">Aucun rendu pour l'instant.</p>`}
      </div>`;
    }).join('') : '<p class="chargement">Aucune activité pour ce filtre.</p>'}
  `;

  document.getElementById('selectClasseAct').addEventListener('change', (e) => { filtreClasseActivites = e.target.value; rendrePageActivites(); });
  document.getElementById('selectPalierAct').addEventListener('change', (e) => { filtrePalierActivites = e.target.value; rendrePageActivites(); });
  zone.querySelectorAll('[data-corriger-rendu]').forEach(btn => {
    btn.addEventListener('click', () => corrigerRendu(parseInt(btn.dataset.corrigerRendu, 10)));
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

init();
