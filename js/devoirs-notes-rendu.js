// Rendu partagé pour l'affichage des devoirs et des notes
// (utilisé par pages/eleve/devoirs-notes.html et pages/parent/devoirs-notes.html,
// et par les panneaux de gestion admin/enseignant)

const LIBELLES_STATUT_DEVOIR = { a_faire: 'À faire', rendu: 'Rendu', en_retard: 'En retard', corrige: 'Corrigé' };
const LIBELLES_APPRECIATION = { acquis: 'Acquis', en_cours: 'En cours d\'acquisition', non_acquis: 'Non acquis' };
const LIBELLES_MEDAILLE_DN = { bronze: '🥉', argent: '🥈', or: '🥇', diamant: '💎' };

function echapperTexte(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function formaterDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Résume la réponse d'UN élève à UN devoir "à blocs" (exercice/quiz/évaluation/
// activité — voir js/editeur/devoir-blocs.js), pour affichage compact (liste,
// panneau enseignant) sans avoir à ré-analyser le détail de chaque bloc partout.
// blocs : lignes blocs_seance (devoir_id = ce devoir).
// reponses : lignes reponses_exercices de CET élève pour ces blocs (tous essais).
// rendus : lignes rendus_activites de CET élève pour ces blocs (tous essais).
// La note retenue par bloc est celle du DERNIER essai (les essais sont
// illimités — c'est la réponse la plus récente qui compte pour la note).
function resumerDevoirBlocs(blocs, reponses, rendus) {
  if (!blocs || !blocs.length) return null;

  const dernierParBloc = (lignes) => {
    const m = {};
    (lignes || []).forEach(l => {
      if (!m[l.bloc_id] || l.numero_essai > m[l.bloc_id].numero_essai) m[l.bloc_id] = l;
    });
    return m;
  };
  const dernieresReponses = dernierParBloc(reponses);
  const dernieresActivites = dernierParBloc(rendus);

  let fractionsCumulees = 0;
  let nbNotes = 0;
  let nbRepondus = 0;
  let toutCorrige = true;

  blocs.forEach(b => {
    if (b.type_bloc === 'activite') {
      const r = dernieresActivites[b.id];
      if (!r) { toutCorrige = false; return; }
      nbRepondus++;
      if (!r.corrige_le || r.note == null || !r.bareme) { toutCorrige = false; return; }
      fractionsCumulees += r.note / r.bareme;
      nbNotes++;
    } else {
      const r = dernieresReponses[b.id];
      if (!r) { toutCorrige = false; return; }
      nbRepondus++;
      if (r.statut === 'en_attente_ia' || r.score_max == null || r.score_max <= 0) { toutCorrige = false; return; }
      fractionsCumulees += r.score / r.score_max;
      nbNotes++;
    }
  });

  return {
    nbBlocs: blocs.length,
    nbRepondus,
    noteSur20: nbNotes ? Math.round((fractionsCumulees / nbNotes) * 20 * 10) / 10 : null,
    toutCorrige: toutCorrige && nbNotes === blocs.length,
  };
}

// devoirs: [{...devoir, champs_formation:{nom}, rendu: {...}|null, resumeBlocs: {...}|null}]
// - rendu : ligne devoirs_rendus (devoir "texte" historique, sans bloc).
// - resumeBlocs : résultat de resumerDevoirBlocs (devoir "à blocs" — voir plus haut).
// Un devoir n'a jamais les deux à la fois. Affiché en tableau, groupé par
// matière, pour rester lisible même avec plusieurs matières et devoirs à la fois.
function html_listeDevoirs(devoirs, options = {}) {
  if (!devoirs || devoirs.length === 0) return '<p style="color:var(--text-gris);font-size:14px">Aucun devoir pour l\'instant.</p>';

  const parMatiere = {};
  devoirs.forEach(d => { (parMatiere[d.champs_formation?.nom || 'Autre'] ??= []).push(d); });

  return Object.entries(parMatiere).map(([matiere, liste]) => `
    <div class="groupe-matiere-devoirs" style="margin-bottom:22px">
      <div style="font-size:13px;font-weight:800;color:var(--bleu-kekeli,var(--bleu-principal,#0000D1));text-transform:uppercase;letter-spacing:.3px;margin-bottom:8px">${echapperTexte(matiere)}</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="text-align:left;border-bottom:2px solid var(--bordure,#E2E8F0)">
              <th style="padding:6px 8px">Devoir</th>
              <th style="padding:6px 8px">À rendre le</th>
              <th style="padding:6px 8px">Statut</th>
              <th style="padding:6px 8px">Note</th>
              <th style="padding:6px 8px"></th>
            </tr>
          </thead>
          <tbody>${liste.map(d => html_ligneDevoirTableau(d, options)).join('')}</tbody>
        </table>
      </div>
    </div>
  `).join('');
}

// Calcule le statut d'UN devoir (parmi LIBELLES_STATUT_DEVOIR) — extrait de
// html_ligneDevoirTableau le 11 septembre 2026 pour être réutilisable par
// compterStatutsDevoirs() (cartes de suivi élève/parent) sans dupliquer la
// logique. d : un élément de la liste "devoirsAvecStatut" déjà construite
// par les pages appelantes (voir js/pages/eleve-devoirs-notes.js et
// js/pages/parent-devoirs-notes.js) — d.resumeBlocs pour un devoir "à
// blocs", d.rendu pour un devoir "texte libre" (jamais les deux à la fois).
function calculerStatutDevoir(d) {
  const maintenant = new Date();
  const resume = d.resumeBlocs;
  if (resume) {
    const enRetard = resume.nbRepondus < resume.nbBlocs && new Date(d.date_limite) < maintenant;
    return resume.nbRepondus === 0 ? (enRetard ? 'en_retard' : 'a_faire') : (resume.toutCorrige ? 'corrige' : 'rendu');
  }
  const enRetard = !d.rendu && new Date(d.date_limite) < maintenant;
  return d.rendu ? d.rendu.statut : (enRetard ? 'en_retard' : 'a_faire');
}

// Cartes de suivi (11 septembre 2026, demande explicite : "cré des cartes
// pour devoir rendu, en cours, en retard") — compte, pour une liste de
// devoirs déjà enrichie (même forme que celle passée à html_listeDevoirs),
// combien sont dans chaque statut. Toujours les 4 clés de LIBELLES_STATUT_DEVOIR,
// même à 0, pour un affichage de cartes stable.
function compterStatutsDevoirs(devoirs) {
  const compte = { a_faire: 0, rendu: 0, en_retard: 0, corrige: 0 };
  (devoirs || []).forEach(d => { compte[calculerStatutDevoir(d)]++; });
  return compte;
}

// Cartes HTML (voir .grille-taches-admin/.pastille-tache-admin, css/style.css
// et css/style-public.css) à partir du résultat de compterStatutsDevoirs().
// titreCarte : libellé affiché à la place de "À faire" pour ce statut, quand
// on veut le mot "En cours" plutôt que "À faire" côté élève/parent (même
// donnée, juste un intitulé plus parlant pour ce contexte précis).
function html_cartesStatutsDevoirs(compte, options = {}) {
  const libelleAFaire = options.libelleEnCours || LIBELLES_STATUT_DEVOIR.a_faire;
  const cartes = [
    { cle: 'a_faire', libelle: `📌 ${libelleAFaire}` },
    { cle: 'rendu', libelle: '📤 Rendus' },
    { cle: 'en_retard', libelle: '⏰ En retard', alerte: compte.en_retard > 0 },
    { cle: 'corrige', libelle: '✅ Corrigés' }
  ];
  return `<div class="grille-taches-admin" style="margin-bottom:18px">
    ${cartes.map(c => `
      <div class="pastille-tache-admin ${c.alerte ? 'a-traiter' : ''}">
        <span class="chiffre-tache">${compte[c.cle] || 0}</span>
        <span class="libelle-tache">${c.libelle}</span>
      </div>`).join('')}
  </div>`;
}

function html_ligneDevoirTableau(d, options) {
  const resume = d.resumeBlocs;
  const statut = calculerStatutDevoir(d);
  const note = resume
    ? (resume.toutCorrige && resume.noteSur20 != null ? `${resume.noteSur20}/20` : '—')
    : (d.rendu?.note != null ? `${d.rendu.note}/20` : '—');

  const idDetail = `detail-devoir-${d.id}`;
  let actionCell;
  if (resume) {
    actionCell = options.interactif
      ? `<a href="devoir.html?id=${d.id}" class="btn btn-discret" style="padding:4px 10px;font-size:12px;white-space:nowrap">${resume.nbRepondus === 0 ? '📝 Faire' : (resume.toutCorrige ? '👁️ Revoir' : '✏️ Continuer')}</a>`
      : (resume.nbRepondus > 0 ? `<button type="button" class="btn btn-discret" data-toggle-detail="${idDetail}" style="padding:4px 10px;font-size:12px">Détails</button>` : '');
  } else {
    actionCell = (options.interactif && !d.rendu)
      ? `<button class="btn btn-discret" data-rendre-devoir="${d.id}" data-titre-devoir="${echapperTexte(d.titre)}" style="padding:4px 10px;font-size:12px;white-space:nowrap">📤 Rendre</button>`
      : (d.consigne || d.rendu ? `<button type="button" class="btn btn-discret" data-toggle-detail="${idDetail}" style="padding:4px 10px;font-size:12px">Détails</button>` : '');
  }

  return `
    <tr style="border-bottom:1px solid var(--bordure,#E2E8F0)">
      <td style="padding:8px">${echapperTexte(d.titre)}</td>
      <td style="padding:8px;white-space:nowrap">${formaterDate(d.date_limite)}</td>
      <td style="padding:8px"><span class="pastille-statut pastille-${statut}">${LIBELLES_STATUT_DEVOIR[statut]}</span></td>
      <td style="padding:8px;font-weight:700">${note}</td>
      <td style="padding:8px;text-align:right">${actionCell}</td>
    </tr>
    <tr class="ligne-detail-devoir" id="${idDetail}" style="display:none">
      <td colspan="5" style="padding:0 8px 12px;background:#F9FAFB">
        ${d.consigne ? `<p style="margin:8px 0;font-size:13px"><strong>Consigne :</strong> ${echapperTexte(d.consigne)}</p>` : ''}
        ${resume ? `<p style="margin:8px 0 0;font-size:12px;color:var(--text-gris,var(--texte-gris,#64748B))">${resume.nbRepondus}/${resume.nbBlocs} bloc${resume.nbBlocs > 1 ? 's' : ''} répondu${resume.nbRepondus > 1 ? 's' : ''}${resume.nbRepondus > 0 && !resume.toutCorrige ? ' — en attente de correction' : ''}</p>` : ''}
        ${!resume && d.rendu?.contenu_reponse ? `<div style="background:white;border-radius:8px;padding:8px 10px;margin-bottom:6px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:var(--text-gris,var(--texte-gris,#64748B));text-transform:uppercase">Réponse rendue</p>
          <p style="margin:0;font-size:13px;white-space:pre-wrap">${echapperTexte(d.rendu.contenu_reponse)}</p>
        </div>` : ''}
        ${!resume && d.rendu?.piece_jointe_url ? `<a href="${echapperTexte(d.rendu.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Voir la pièce jointe rendue</a>` : ''}
        ${!resume && d.rendu && !d.rendu.corrige_le ? `<p style="margin:6px 0 0;font-size:12px;color:#B8860B">⏳ En attente de correction</p>` : ''}
        ${!resume && d.rendu?.corrige_le && d.rendu.commentaire_correction ? `<div style="background:#E6FBFF;border-radius:8px;padding:8px 10px;margin-top:6px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:var(--bleu-kekeli,var(--bleu-principal,#0000D1));text-transform:uppercase">Appréciation du maître</p>
          <p style="margin:0;font-size:13px">${echapperTexte(d.rendu.commentaire_correction)}</p>
        </div>` : ''}
      </td>
    </tr>`;
}

// À appeler après avoir inséré le HTML de html_listeDevoirs dans le DOM, pour
// activer les boutons "Détails" (dépliage de la ligne). Les boutons "Rendre"
// restent gérés par la page appelante (elle seule connaît le profil élève).
function attacherEcouteursDetailsDevoirs(conteneurEl) {
  conteneurEl.querySelectorAll('[data-toggle-detail]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ligne = document.getElementById(btn.dataset.toggleDetail);
      if (ligne) ligne.style.display = ligne.style.display === 'none' ? 'table-row' : 'none';
    });
  });
}

// Calcule automatiquement, pour une classe et une matière (champ de formation)
// données, la liste des séances déjà publiées dans le parcours — permet à
// l'enseignant/admin de choisir la séance à évaluer sans jamais taper un ID.
// Parcours : noeuds_parcours (classe+champ) -> sa -> seances (statut publié).
async function chargerSeancesPourMatiere(classeId, champId) {
  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id')
    .eq('classe_id', classeId).eq('champ_formation_id', champId);
  const idsNoeuds = (noeuds || []).map(n => n.id);
  if (!idsNoeuds.length) return [];

  const { data: sas } = await supabaseClient.from('sa').select('id, titre, ordre').in('noeud_id', idsNoeuds);
  const idsSA = (sas || []).map(s => s.id);
  if (!idsSA.length) return [];

  const { data: seances } = await supabaseClient.from('seances').select('id, titre, ordre, sa_id')
    .in('sa_id', idsSA).eq('statut', 'publie');

  const saParId = {};
  (sas || []).forEach(s => { saParId[s.id] = s; });

  return (seances || [])
    .map(se => ({
      id: se.id,
      label: `${saParId[se.sa_id]?.titre || ''} — ${se.titre}`,
      ordreSA: saParId[se.sa_id]?.ordre ?? 0,
      ordreSeance: se.ordre
    }))
    .sort((a, b) => a.ordreSA - b.ordreSA || a.ordreSeance - b.ordreSeance);
}

// Calcule resumerDevoirBlocs() pour chaque devoir "à blocs" d'une liste, à
// partir des blocs/réponses/rendus de TOUS ces devoirs déjà chargés en une
// seule fois (évite une requête par devoir) — utilisé côté élève et parent
// pour construire le tableau html_listeDevoirs sans N+1 requêtes.
function resumerDevoirsBlocsEnLot(idsDevoirsBlocs, blocsTous, reponsesTous, rendusTous) {
  const blocsParDevoir = {};
  (blocsTous || []).forEach(b => { (blocsParDevoir[b.devoir_id] ??= []).push(b); });
  const idsBlocsParDevoir = {};
  Object.entries(blocsParDevoir).forEach(([devoirId, blocs]) => { idsBlocsParDevoir[devoirId] = new Set(blocs.map(b => b.id)); });

  const resumes = {};
  (idsDevoirsBlocs || []).forEach(devoirId => {
    const blocs = blocsParDevoir[devoirId] || [];
    const idsBlocs = idsBlocsParDevoir[devoirId] || new Set();
    const reponses = (reponsesTous || []).filter(r => idsBlocs.has(r.bloc_id));
    const rendus = (rendusTous || []).filter(r => idsBlocs.has(r.bloc_id));
    resumes[devoirId] = resumerDevoirBlocs(blocs, reponses, rendus);
  });
  return resumes;
}

// Charge les blocs d'un devoir "à blocs" ainsi que les réponses/rendus déjà
// donnés par les élèves suivis, pour construire le panneau de gestion.
async function donneesPanneauDevoirBlocs(devoirId, idsEleves) {
  const { data: blocs } = await supabaseClient.from('blocs_seance').select('*').eq('devoir_id', devoirId).order('ordre');
  const idsBlocs = (blocs || []).map(b => b.id);
  if (!idsBlocs.length || !idsEleves || !idsEleves.length) {
    return { blocs: blocs || [], reponsesExercices: [], rendusActivites: [] };
  }
  const [{ data: reponsesExercices }, { data: rendusActivites }] = await Promise.all([
    supabaseClient.from('reponses_exercices').select('*').in('bloc_id', idsBlocs).in('eleve_id', idsEleves),
    supabaseClient.from('rendus_activites').select('*').in('bloc_id', idsBlocs).in('eleve_id', idsEleves)
  ]);
  return { blocs: blocs || [], reponsesExercices: reponsesExercices || [], rendusActivites: rendusActivites || [] };
}

// Panneau affiché sous un devoir "à blocs" (seance_id renseigné) dans les
// espaces enseignant/admin : bascule brouillon/publié, zone d'édition des
// blocs (à monter séparément avec initEditeurBlocsDevoir sur le conteneur
// data-editeur-blocs-devoir), puis — une fois publié — le panneau des
// rendus/corrections (htmlRendus, déjà construit par html_gestionRendusDevoir).
function html_panneauGestionDevoirBlocs(devoir, htmlRendus) {
  const grisRepli = 'var(--text-gris,var(--texte-gris,#64748B))';
  const bleuRepli = 'var(--bleu-kekeli,var(--bleu-principal,#0000D1))';
  const estPublie = devoir.statut === 'publie';

  return `<div style="margin:8px 0 16px;padding:12px 14px;background:#F9FAFB;border-radius:8px;border:1px solid ${grisRepli}22">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-size:12px;color:${grisRepli}">
        <strong>Séance évaluée :</strong> ${devoir.seances ? echapperTexte(devoir.seances.titre) : '—'}
      </div>
      <button type="button" class="btn ${estPublie ? 'btn-discret' : ''}" data-toggle-statut-devoir="${devoir.id}" data-nouveau-statut="${estPublie ? 'brouillon' : 'publie'}"
        style="${estPublie ? '' : `background:${bleuRepli};color:white;`}padding:6px 14px;font-size:12px;border:none;border-radius:8px;cursor:pointer">
        ${estPublie ? '↩️ Repasser en brouillon' : '🚀 Publier ce devoir'}
      </button>
    </div>
    ${!estPublie ? `<p style="margin:0 0 10px;font-size:12px;color:#B8860B">⚠️ En brouillon : les élèves ne voient pas encore ce devoir. Ajoutez vos blocs (exercices, quiz, évaluation, activité) puis publiez.</p>` : ''}
    ${devoir.consigne ? `<p style="margin:0 0 10px;font-size:13px;color:${grisRepli}"><strong>Consigne générale :</strong> ${echapperTexte(devoir.consigne)}</p>` : ''}
    <div data-editeur-blocs-devoir="${devoir.id}" style="margin-bottom:12px"></div>
    ${estPublie ? (htmlRendus || '') : ''}
  </div>`;
}

// ===== Gestion / correction (enseignant & admin) =====
// Panneau affiché sous un devoir dans les espaces enseignant/admin, listant
// chaque élève concerné avec sa réponse rendue et un accès à la correction.
// Écrit avec des styles en ligne (et des var() à repli en cascade) car ce
// fichier est partagé entre des pages qui n'utilisent pas la même feuille
// de style (css/style.css côté admin, css/style-public.css côté enseignant).
//
// blocs/reponsesExercices/rendusActivites ne sont fournis que pour un devoir
// "à blocs" (sinon undefined/vide, et on retombe sur l'ancien panneau texte).
function html_gestionRendusDevoir(devoir, eleves, rendusLegacy, blocs, reponsesExercices, rendusActivites) {
  const grisRepli = 'var(--text-gris,var(--texte-gris,#64748B))';
  const bleuRepli = 'var(--bleu-kekeli,var(--bleu-principal,#0000D1))';

  if (blocs && blocs.length) {
    return html_gestionRendusDevoirBlocs(devoir, eleves, blocs, reponsesExercices, rendusActivites, grisRepli, bleuRepli);
  }

  const rendusParEleve = {};
  (rendusLegacy || []).forEach(r => { rendusParEleve[r.eleve_id] = r; });

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

function html_gestionRendusDevoirBlocs(devoir, eleves, blocs, reponsesExercices, rendusActivites, grisRepli, bleuRepli) {
  const reponsesParEleve = {}; // eleveId -> blocId -> [essais]
  (reponsesExercices || []).forEach(r => { ((reponsesParEleve[r.eleve_id] ??= {})[r.bloc_id] ??= []).push(r); });
  const activitesParEleve = {};
  (rendusActivites || []).forEach(r => { ((activitesParEleve[r.eleve_id] ??= {})[r.bloc_id] ??= []).push(r); });
  const dernier = (map, blocId) => { const l = map[blocId]; return l && l.length ? l[l.length - 1] : null; };

  return `<div style="margin:8px 0 16px;padding:12px 14px;background:#F9FAFB;border-radius:8px;border:1px solid ${grisRepli}22">
    ${devoir.consigne ? `<p style="margin:0 0 10px;font-size:13px;color:${grisRepli}"><strong>Consigne générale :</strong> ${echapperTexte(devoir.consigne)}</p>` : ''}
    ${(eleves && eleves.length) ? eleves.map(e => {
      const reponsesBloc = reponsesParEleve[e.id] || {};
      const activitesBloc = activitesParEleve[e.id] || {};
      const resume = resumerDevoirBlocs(blocs, Object.values(reponsesBloc).flat(), Object.values(activitesBloc).flat());
      const nomEleve = `${echapperTexte(e.profils?.prenom || '')} ${echapperTexte(e.profils?.nom || '')}`;
      const aCorriger = blocs.some(b => b.type_bloc === 'activite' && dernier(activitesBloc, b.id) && !dernier(activitesBloc, b.id).corrige_le);
      const couleurBadge = resume.nbRepondus === 0 ? grisRepli : (aCorriger ? '#B8860B' : bleuRepli);
      const texteBadge = resume.nbRepondus === 0
        ? 'Pas encore rendu'
        : `${resume.nbRepondus}/${resume.nbBlocs} bloc${resume.nbBlocs > 1 ? 's' : ''}${resume.toutCorrige && resume.noteSur20 != null ? ` · ${resume.noteSur20}/20` : (aCorriger ? ' · à corriger' : '')}`;

      return `<details style="padding:8px 0;border-top:1px solid ${grisRepli}22">
        <summary style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer">
          <strong style="font-size:13px">${nomEleve}</strong>
          <span style="font-size:11px;font-weight:700;color:${couleurBadge}">${texteBadge}</span>
        </summary>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
          ${blocs.map(b => {
            const info = infoType(b.type_bloc);
            const c = b.contenu || {};
            const libelleBloc = `${info.icone} ${echapperTexte(c.libelle || info.label)}`;
            if (b.type_bloc === 'activite') {
              const r = dernier(activitesBloc, b.id);
              if (!r) return `<div style="font-size:12px;color:${grisRepli}">${libelleBloc} — pas encore rendu</div>`;
              return `<div style="background:white;padding:8px;border-radius:6px">
                <div style="font-size:11px;font-weight:700;color:${grisRepli};text-transform:uppercase">${libelleBloc}${r.numero_essai > 1 ? ` (essai ${r.numero_essai})` : ''}</div>
                ${r.reponse_texte ? `<p style="margin:4px 0;font-size:13px;white-space:pre-wrap">${echapperTexte(r.reponse_texte)}</p>` : ''}
                ${r.piece_jointe_url ? `<a href="${echapperTexte(r.piece_jointe_url)}" target="_blank" rel="noopener" style="font-size:12px">📎 Pièce jointe</a>` : ''}
                ${r.corrige_le
                  ? `<p style="margin:4px 0 0;font-size:12px;color:${bleuRepli};font-weight:700">✅ ${r.note != null ? `${r.note}/${r.bareme}` : 'Corrigé'}${r.appreciation ? ` — ${LIBELLES_APPRECIATION[r.appreciation] || ''}` : ''}</p>
                    ${r.commentaire ? `<p style="margin:2px 0 0;font-size:12px;color:${grisRepli}">💬 ${echapperTexte(r.commentaire)}</p>` : ''}`
                  : `<button type="button" class="btn" data-corriger-activite-devoir="${r.id}" style="background:${bleuRepli};color:white;padding:4px 10px;font-size:11px;margin-top:4px">✏️ Corriger</button>`}
              </div>`;
            }
            const r = dernier(reponsesBloc, b.id);
            if (!r) return `<div style="font-size:12px;color:${grisRepli}">${libelleBloc} — pas encore répondu</div>`;
            return `<div style="background:white;padding:8px;border-radius:6px;font-size:12px">
              <div style="font-weight:700;color:${grisRepli};text-transform:uppercase;font-size:11px">${libelleBloc}${r.numero_essai > 1 ? ` (essai ${r.numero_essai})` : ''}</div>
              ${r.statut === 'en_attente_ia' ? '⏳ En attente de correction (IA indisponible)' : `📊 ${r.score}/${r.score_max}${r.medaille ? ` · ${LIBELLES_MEDAILLE_DN[r.medaille] || ''}` : ''}`}
            </div>`;
          }).join('')}
        </div>
      </details>`;
    }).join('') : `<p style="font-size:12px;color:${grisRepli};margin:0">Aucun élève dans cette classe pour l'instant.</p>`}
  </div>`;
}

// Résume le ciblage d'un devoir pour affichage compact dans les panneaux
// enseignant/admin (ex. "🎯 Tous les élèves" ou "🎯 3 élève(s) sélectionné(s)").
// nbDestinataires : nombre de lignes dans devoirs_destinataires pour ce devoir
// (0 = pas de ciblage précis = visible par toute la classe).
function libelleDestinatairesDevoir(nbDestinataires, nbElevesClasse) {
  return nbDestinataires > 0
    ? `🎯 ${nbDestinataires} élève${nbDestinataires > 1 ? 's' : ''} sélectionné${nbDestinataires > 1 ? 's' : ''}`
    : `🎯 Tous les élèves${nbElevesClasse ? ` (${nbElevesClasse})` : ''}`;
}

// Ouvre la sélection des destinataires d'un devoir : soit tous les élèves de
// la classe (comportement historique, aucune ligne stockée), soit une liste
// précise (voir table devoirs_destinataires et devoir_cible_eleve() côté
// base — RLS + edge function corriger-exercice appliquent le même ciblage).
// eleves : lignes { id, profils:{prenom,nom} } de la classe concernée.
async function ouvrirSelectionDestinatairesDevoir(devoirId, eleves, onValide) {
  const { data: destinatairesActuels, error: erreurLecture } = await supabaseClient
    .from('devoirs_destinataires').select('eleve_id').eq('devoir_id', devoirId);
  if (erreurLecture) { alert(erreurLecture.message); return; }
  const idsActuels = (destinatairesActuels || []).map(d => d.eleve_id);
  const tousParDefaut = idsActuels.length === 0;

  ouvrirModal({
    titre: '🎯 Destinataires du devoir',
    champs: [{
      nom: 'destinataires', label: 'Élèves concernés', type: 'checkboxes',
      toutCocherLabel: 'Tous les élèves de la classe',
      options: eleves.map(e => ({ valeur: e.id, label: `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim() || '(sans nom)' })),
      valeur: tousParDefaut ? eleves.map(e => e.id) : idsActuels
    }],
    texteValider: 'Enregistrer',
    onValider: async ({ destinataires }) => {
      if (!destinataires.length) {
        alert('Sélectionnez au moins un élève, ou cochez "Tous les élèves de la classe".');
        return;
      }
      const tousCoches = destinataires.length === eleves.length;
      const { error: erreurSuppr } = await supabaseClient.from('devoirs_destinataires').delete().eq('devoir_id', devoirId);
      if (erreurSuppr) { alert(erreurSuppr.message); return; }
      if (!tousCoches) {
        const { error } = await supabaseClient.from('devoirs_destinataires')
          .insert(destinataires.map(eleveId => ({ devoir_id: devoirId, eleve_id: eleveId })));
        if (error) { alert(error.message); return; }
      }
      onValide();
    }
  });
}

// Avant de créer un devoir, l'enseignant/admin choisit son mode — l'ancien
// mode "texte libre" a été restauré (lot 3, partie 3, volet 2) à côté du
// mode "à blocs" :
// - texte_libre : l'élève écrit sa réponse (et peut joindre un fichier) via
//   devoirs_rendus, corrigée à la main par l'enseignant — gratuit, jamais
//   soumis au système d'abonnements.
// - blocs : exercices/quiz/évaluation/activité avec correction automatique
//   (js/editeur/devoir-blocs.js), réservé aux élèves/familles abonnées ou en
//   essai gratuit — la vérification se fait au moment même où l'élève valide
//   chaque bloc (etat_acces_service / consommer_usage_service côté
//   corriger-exercice), exactement comme pour les exercices d'une séance :
//   aucune vérification supplémentaire n'est nécessaire à la création.
// onChoisi(mode) est appelé avec 'texte_libre' ou 'blocs'.
function ouvrirChoixModeNouveauDevoir(onChoisi) {
  const grisRepli = 'var(--text-gris,var(--texte-gris,#64748B))';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite">
      <h3>Nouveau devoir</h3>
      <p style="font-size:13px;color:${grisRepli};margin-top:-8px">Choisissez le mode de ce devoir.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
        <button type="button" class="btn" data-mode-devoir="texte_libre" style="text-align:left;padding:14px;border:1px solid var(--bordure,#E2E8F0);border-radius:10px;background:white;cursor:pointer">
          <div style="font-weight:800;font-size:14px">📝 Mode simple (texte libre)</div>
          <div style="font-size:12px;color:${grisRepli};margin-top:2px">L'élève écrit sa réponse (et peut joindre un fichier) ; vous la corrigez vous-même. Gratuit, aucun abonnement requis.</div>
        </button>
        <button type="button" class="btn" data-mode-devoir="blocs" style="text-align:left;padding:14px;border:1px solid var(--bordure,#E2E8F0);border-radius:10px;background:white;cursor:pointer">
          <div style="font-weight:800;font-size:14px">🧩 Mode à blocs (exercices, quiz, évaluation, activité)</div>
          <div style="font-size:12px;color:${grisRepli};margin-top:2px">Correction automatique dès que l'élève valide. Réservé aux élèves/familles abonnées (ou en essai gratuit) — vérifié au moment de la correction, comme pour les exercices d'une séance.</div>
        </button>
      </div>
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  document.addEventListener('keydown', function echap(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } });

  overlay.querySelectorAll('[data-mode-devoir]').forEach(btn => {
    btn.addEventListener('click', () => { fermer(); onChoisi(btn.dataset.modeDevoir); });
  });
}

// Ouvre le formulaire de correction pour un rendu "texte" (devoir sans bloc),
// puis appelle onValide() (généralement pour rafraîchir l'affichage).
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

// Ouvre le formulaire de correction d'un bloc "activité" appartenant à un
// devoir "à blocs" (même table rendus_activites que les activités de séance).
function ouvrirCorrectionActiviteDevoir(renduId, correcteurId, onValide) {
  ouvrirModal({
    titre: 'Corriger cette activité',
    champs: [
      { nom: 'note', label: 'Note (optionnelle, sur 20)', type: 'number', requis: false },
      { nom: 'appreciation', label: 'Appréciation (optionnelle)', type: 'select', requis: false,
        options: [{ valeur: '', label: '— Aucune —' }, { valeur: 'acquis', label: 'Acquis' }, { valeur: 'en_cours', label: 'En cours' }, { valeur: 'non_acquis', label: 'Non acquis' }] },
      { nom: 'commentaire', label: 'Commentaire (optionnel)', type: 'textarea', requis: false, placeholder: "Retour pour l'élève..." }
    ],
    texteValider: 'Enregistrer la correction',
    onValider: async ({ note, appreciation, commentaire }) => {
      const { error } = await supabaseClient.from('rendus_activites').update({
        note: note ? parseFloat(note) : null,
        appreciation: appreciation || null,
        commentaire: commentaire || null,
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
