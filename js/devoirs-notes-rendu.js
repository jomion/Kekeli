// Rendu partagé pour l'affichage des devoirs et des notes
// (utilisé par pages/eleve/devoirs-notes.html et pages/parent/devoirs-notes.html)

const LIBELLES_STATUT_DEVOIR = { a_faire: 'À faire', rendu: 'Rendu', en_retard: 'En retard', corrige: 'Corrigé' };
const LIBELLES_APPRECIATION = { acquis: 'Acquis', en_cours: 'En cours d\'acquisition', non_acquis: 'Non acquis' };

function echapperTexte(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function formaterDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// devoirs: [{...devoir, champs_formation:{nom}, rendu: {...} | null}]
function html_listeDevoirs(devoirs, options = {}) {
  if (!devoirs || devoirs.length === 0) return '<p style="color:var(--text-gris);font-size:14px">Aucun devoir pour l\'instant.</p>';

  return `<div class="liste-lignes-pub">${devoirs.map(d => {
    const maintenant = new Date();
    const enRetard = !d.rendu && new Date(d.date_limite) < maintenant;
    const statut = d.rendu ? d.rendu.statut : (enRetard ? 'en_retard' : 'a_faire');
    const peutRendre = options.interactif && !d.rendu;

    return `<div class="ligne-pub">
      <div>
        <div class="titre-ligne-pub">${echapperTexte(d.titre)}${d.champs_formation ? ` <span style="font-weight:400;color:var(--text-gris)">— ${echapperTexte(d.champs_formation.nom)}</span>` : ''}</div>
        <div class="sous-ligne-pub">À rendre pour le ${formaterDate(d.date_limite)}${d.rendu?.note != null ? ` · Note : ${d.rendu.note}` : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="pastille-statut pastille-${statut}">${LIBELLES_STATUT_DEVOIR[statut]}</span>
        ${peutRendre ? `<button class="btn btn-filled" data-rendre-devoir="${d.id}" style="padding:6px 14px;font-size:12px">Marquer rendu</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

// evaluations: [{...evaluation, champs_formation:{nom}}]
function html_listeEvaluations(evaluations) {
  if (!evaluations || evaluations.length === 0) return '<p style="color:var(--text-gris);font-size:14px">Aucune note pour l\'instant.</p>';

  return `<div class="liste-lignes-pub">${evaluations.map(e => {
    const valeurAffichee = e.type === 'appreciation'
      ? `<span class="pastille-statut pastille-${e.appreciation}">${LIBELLES_APPRECIATION[e.appreciation]}</span>`
      : `<span class="pastille-note">${e.valeur} / ${e.type === 'note_20' ? '20' : '10'}</span>`;
    return `<div class="ligne-pub">
      <div>
        <div class="titre-ligne-pub">${e.champs_formation ? echapperTexte(e.champs_formation.nom) : 'Évaluation'}</div>
        <div class="sous-ligne-pub">${formaterDate(e.cree_le)}${e.commentaire ? ' · ' + echapperTexte(e.commentaire) : ''}</div>
      </div>
      ${valeurAffichee}
    </div>`;
  }).join('')}</div>`;
}
