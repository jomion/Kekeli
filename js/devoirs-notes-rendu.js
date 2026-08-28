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
// Le devoir est désormais un vrai va-et-vient : l'élève voit la consigne,
// rend une réponse via un formulaire (plus un prompt()), et retrouve ici la
// correction (note + commentaire) une fois le maître passé dessus.
function html_listeDevoirs(devoirs, options = {}) {
  if (!devoirs || devoirs.length === 0) return '<p style="color:var(--text-gris);font-size:14px">Aucun devoir pour l\'instant.</p>';

  return `<div class="liste-lignes-pub">${devoirs.map(d => {
    const maintenant = new Date();
    const enRetard = !d.rendu && new Date(d.date_limite) < maintenant;
    const statut = d.rendu ? d.rendu.statut : (enRetard ? 'en_retard' : 'a_faire');
    const peutRendre = options.interactif && !d.rendu;
    const corrige = d.rendu && !!d.rendu.corrige_le;

    return `<div class="ligne-pub" style="flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <div class="titre-ligne-pub">${echapperTexte(d.titre)}${d.champs_formation ? ` <span style="font-weight:400;color:var(--text-gris)">— ${echapperTexte(d.champs_formation.nom)}</span>` : ''}</div>
          <div class="sous-ligne-pub">À rendre pour le ${formaterDate(d.date_limite)}${d.rendu?.note != null ? ` · Note : ${d.rendu.note}/20` : ''}</div>
        </div>
        <span class="pastille-statut pastille-${statut}">${LIBELLES_STATUT_DEVOIR[statut]}</span>
      </div>
      ${d.consigne ? `<p style="margin:0;font-size:13px"><strong>Consigne :</strong> ${echapperTexte(d.consigne)}</p>` : ''}
      ${d.rendu?.contenu_reponse ? `<div style="background:#F1F5F9;border-radius:8px;padding:8px 10px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:var(--text-gris);text-transform:uppercase">Réponse rendue</p>
        <p style="margin:0;font-size:13px;white-space:pre-wrap">${echapperTexte(d.rendu.contenu_reponse)}</p>
      </div>` : ''}
      ${d.rendu?.piece_jointe_url ? `<a href="${echapperTexte(d.rendu.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Voir la pièce jointe rendue</a>` : ''}
      ${d.rendu && !corrige ? `<p style="margin:0;font-size:12px;color:#B8860B">⏳ En attente de correction</p>` : ''}
      ${corrige && d.rendu.commentaire_correction ? `<div style="background:#E6FBFF;border-radius:8px;padding:8px 10px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:var(--bleu-kekeli);text-transform:uppercase">Appréciation du maître</p>
        <p style="margin:0;font-size:13px">${echapperTexte(d.rendu.commentaire_correction)}</p>
      </div>` : ''}
      ${peutRendre ? `<button class="btn btn-filled" data-rendre-devoir="${d.id}" data-titre-devoir="${echapperTexte(d.titre)}" style="align-self:flex-start;padding:6px 14px;font-size:12px">📤 Rendre mon devoir</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ===== Gestion / correction (enseignant & admin) =====
// Panneau affiché sous un devoir dans les espaces enseignant/admin, listant
// chaque élève concerné avec sa réponse rendue et un bouton de correction.
// Écrit avec des styles en ligne (et des var() à repli en cascade) car ce
// fichier est partagé entre des pages qui n'utilisent pas la même feuille
// de style (css/style.css côté admin, css/style-public.css côté enseignant).
function html_gestionRendusDevoir(devoir, eleves, rendus) {
  const grisRepli = 'var(--text-gris,var(--texte-gris,#64748B))';
  const bleuRepli = 'var(--bleu-kekeli,var(--bleu-principal,#0000D1))';
  const rendusParEleve = {};
  (rendus || []).forEach(r => { rendusParEleve[r.eleve_id] = r; });

  return `<div style="margin:8px 0 16px;padding:12px 14px;background:#F9FAFB;border-radius:8px;border:1px solid ${grisRepli}22">
    ${devoir.consigne ? `<p style="margin:0 0 10px;font-size:13px;color:${grisRepli}"><strong>Consigne :</strong> ${echapperTexte(devoir.consigne)}</p>` : ''}
    ${(eleves && eleves.length) ? eleves.map(e => {
      const r = rendusParEleve[e.id];
      const nomEleve = `${echapperTexte(e.profils?.prenom || '')} ${echapperTexte(e.profils?.nom || '')}`;
      return `<div style="padding:8px 0;border-top:1px solid ${grisRepli}22;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:13px">${nomEleve}</strong>
          ${!r
            ? `<span style="font-size:11px;color:${grisRepli}">Pas encore rendu</span>`
            : r.corrige_le
              ? `<span style="font-size:11px;font-weight:700;color:${bleuRepli}">${r.note != null ? `${r.note}/20` : 'Corrigé'}</span>`
              : `<button type="button" class="btn" data-corriger-devoir="${r.id}" style="background:${bleuRepli};color:white;padding:5px 12px;font-size:12px">✏️ Corriger</button>`}
        </div>
        ${r?.contenu_reponse ? `<p style="margin:0;font-size:13px;background:white;padding:8px;border-radius:6px;white-space:pre-wrap">${echapperTexte(r.contenu_reponse)}</p>` : ''}
        ${r?.piece_jointe_url ? `<a href="${echapperTexte(r.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Pièce jointe</a>` : ''}
        ${r?.commentaire_correction ? `<p style="margin:0;font-size:12px;color:${grisRepli}">💬 ${echapperTexte(r.commentaire_correction)}</p>` : ''}
      </div>`;
    }).join('') : `<p style="font-size:12px;color:${grisRepli};margin:0">Aucun élève dans cette classe pour l'instant.</p>`}
  </div>`;
}

// Ouvre le formulaire de correction pour un rendu donné, puis appelle
// onValide() (généralement pour rafraîchir l'affichage) une fois enregistré.
function ouvrirCorrectionDevoir(renduId, correcteurId, onValide) {
  ouvrirModal({
    titre: 'Corriger ce devoir',
    champs: [
      { nom: 'note', label: 'Note (optionnelle, sur 20)', type: 'number', requis: false },
      { nom: 'commentaire_correction', label: 'Appréciation (optionnelle)', type: 'textarea', requis: false, placeholder: "Retour pour l'élève..." }
    ],
    texteValider: 'Enregistrer la correction',
    onValider: async ({ note, commentaire_correction }) => {
      const { error } = await supabaseClient.from('devoirs_rendus').update({
        note: note ? parseFloat(note) : null,
        commentaire_correction: commentaire_correction || null,
        statut: 'corrige',
        corrige_par: correcteurId,
        corrige_le: new Date().toISOString()
      }).eq('id', renduId);
      if (error) return alert(error.message);
      onValide();
    }
  });
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
