// Page pages/eleve/seance.html
// Vue élève en lecture d'une séance publiée : affiche tous les blocs (texte,
// image, tableau...) et, pour les blocs exercice/quiz/évaluation, propose un
// formulaire de réponse (ou le résultat déjà obtenu). Réutilise les
// utilitaires de js/editeur/blocs.js (infoType, teinteClaire, echapper...)
// qui sont volontairement partagés entre l'éditeur et la vue élève.

let profilEleveSeance = null;
let seanceCourante = null;
let blocsCourants = [];
let reponsesExistantes = {}; // bloc_id -> ligne reponses_exercices
let etatAccesCorrectionIA = { autorise: false }; // service premium "correction_ia" (cf. consommer_usage_service en base)

(async function () {
  profilEleveSeance = await requireRole('eleve');
  if (!profilEleveSeance) return;
  initClocheNotifications('zoneCloche', profilEleveSeance.id);
  await charger();
})();

async function charger() {
  const params = new URLSearchParams(window.location.search);
  const seanceId = parseInt(params.get('id'), 10);
  const conteneur = document.getElementById('contenu');
  if (!seanceId) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Séance introuvable.</p>';
    return;
  }

  const { data: seance, error: erreurSeance } = await supabaseClient
    .from('seances').select('*').eq('id', seanceId).maybeSingle();
  if (erreurSeance || !seance) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Cette séance est introuvable ou n\'est pas (ou plus) publiée.</p>';
    return;
  }
  seanceCourante = seance;

  const { data: blocs, error: erreurBlocs } = await supabaseClient
    .from('blocs_seance').select('*').eq('seance_id', seanceId).order('ordre');
  if (erreurBlocs) {
    conteneur.innerHTML = `<p class="message-erreur-auth">Erreur : ${echapper(erreurBlocs.message)}</p>`;
    return;
  }
  blocsCourants = blocs || [];

  const idsExercices = blocsCourants.filter(b => ['exercice', 'quiz', 'evaluation'].includes(b.type_bloc)).map(b => b.id);
  reponsesExistantes = {};
  if (idsExercices.length) {
    const { data: reponses } = await supabaseClient
      .from('reponses_exercices').select('*').eq('eleve_id', profilEleveSeance.id).in('bloc_id', idsExercices);
    (reponses || []).forEach(r => { reponsesExistantes[r.bloc_id] = r; });

    await rafraichirAccesCorrectionIA();
  }

  rendre();
}

// Correction automatique = service premium (abonnement, forfait ou essai
// gratuit limité — cf. la fonction SQL etat_acces_service). On vérifie l'accès
// une fois par chargement de page pour afficher tout de suite le bon message,
// plutôt que de laisser l'élève remplir tout un exercice avant de découvrir
// qu'il n'y a plus d'accès.
async function rafraichirAccesCorrectionIA() {
  const { data: etatAcces } = await supabaseClient.rpc('etat_acces_service', {
    p_eleve_id: profilEleveSeance.id, p_service: 'correction_ia',
  });
  etatAccesCorrectionIA = etatAcces || { autorise: false };
}

function rendre() {
  const topNiveau = blocsCourants.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const enTeteDiscipline = seanceCourante.discipline
    ? `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#FFCC00;background:#003366;display:inline-block;padding:4px 12px;border-radius:6px;margin-bottom:10px">${echapper(seanceCourante.discipline)}</div>`
    : '';

  document.getElementById('contenu').innerHTML = `
    <div class="fil-ariane-eleve"><a href="../navigation.html">← Retour à mes cours</a></div>
    <div class="carte-bienvenue">
      ${enTeteDiscipline}
      <h1>${echapper(seanceCourante.titre)}</h1>
    </div>
    ${topNiveau.map(rendreBlocLecture).join('') || '<p style="color:var(--text-gris)">Cette séance ne contient encore aucun contenu.</p>'}
  `;

  attacherEcouteursExercices();
}

function rendreBlocLecture(b) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || '#0000D1';
  const afficherTitre = !(c.afficherTitre === false);
  const libelle = c.libelle || info.label;
  let corps = '';

  if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div>${contenuRicheInitial(c.texte)}</div>`;
  else if (b.type_bloc === 'titre') corps = `<h3 style="margin:0">${echapper(c.texte)}</h3>`;
  else if (b.type_bloc === 'consigne') corps = `<p>${echapper(c.texte)}</p>`;
  else if (b.type_bloc === 'autre') corps = `${c.nom ? `<p style="font-weight:700">${echapper(c.nom)}</p>` : ''}<p>${echapper(c.texte)}</p>`;
  else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" alt=""><p><em>${echapper(c.legende)}</em></p>`;
  else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.legende) || c.url}</a></p>`;
  else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.nom)}</a></p>`;
  else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
  else if (b.type_bloc === 'tableau') {
    const fusions = c.fusions || [];
    const masquee = (i, j) => fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
    const colspan = (i, j) => { const f = fusions.find(f => f.ligne === i && f.colonneDebut === j); return f ? (f.colonneFin - f.colonneDebut + 1) : 1; };
    const couleurEntete = c.couleurEntete || '#F4F7F9';
    const texteEntete = c.couleurEntete ? texteContrastant(c.couleurEntete) : '#003366';
    const lignesHtml = (c.lignes || []).map((l, i) => {
      const style = c.entete && i === 0 ? ` style="background:${couleurEntete};font-weight:800;color:${texteEntete}"` : '';
      return `<tr${style}>${l.map((cel, j) => masquee(i, j) ? '' : `<td ${colspan(i, j) > 1 ? `colspan="${colspan(i, j)}"` : ''}>${echapper(cel)}</td>`).join('')}</tr>`;
    }).join('');
    corps = `${c.titre ? `<p style="font-weight:700;margin-bottom:6px">${echapper(c.titre)}</p>` : ''}<table>${lignesHtml}</table>`;
  }
  else if (['exercice', 'quiz', 'evaluation'].includes(b.type_bloc)) corps = rendreExercice(b, c);
  else corps = `<p>${echapper(c.consigne)}</p>`;

  const enfants = blocsCourants.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">
    ${afficherTitre ? `<div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>` : ''}
    ${corps}
    ${enfants.length ? `<div style="margin-left:16px;margin-top:10px;border-left:2px dashed var(--bordure);padding-left:12px">${enfants.map(rendreBlocLecture).join('')}</div>` : ''}
  </div>`;
}

function rendreExercice(b, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  const dejaRepondu = reponsesExistantes[b.id];

  if (!questions.length) {
    return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant — reviens plus tard.</p>`;
  }

  if (dejaRepondu) return rendreResultatExercice(c, questions, dejaRepondu);

  if (!etatAccesCorrectionIA.autorise) {
    return `
      ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
      <div class="acces-suspendu-exercice">
        🔒 La correction automatique des exercices est un service premium. Tu as utilisé tous tes essais gratuits — demande à un adulte de contacter l'administration pour souscrire (abonnement ou forfait).
      </div>
    `;
  }

  const noteEssai = etatAccesCorrectionIA.source === 'essai_gratuit'
    ? `<p class="note-essai-gratuit">🎁 Essai gratuit — il te reste ${etatAccesCorrectionIA.essais_restants} correction${etatAccesCorrectionIA.essais_restants > 1 ? 's' : ''} offerte${etatAccesCorrectionIA.essais_restants > 1 ? 's' : ''} après celle-ci.</p>`
    : '';

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    ${noteEssai}
    <form data-form-exercice="${b.id}">
      ${questions.map((q, i) => rendreChampQuestion(q, i)).join('')}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">✅ Valider mes réponses</button>
    </form>
  `;
}

function rendreChampQuestion(q, i) {
  let champ = '';
  if (q.type === 'qcm') {
    champ = (q.options || []).map((opt, idx) => `<label><input type="radio" name="q_${echapper(q.id)}" value="${idx}" required> ${echapper(opt)}</label>`).join('');
  } else if (q.type === 'vrai_faux') {
    champ = `<div class="vf-choix">
      <label><input type="radio" name="q_${echapper(q.id)}" value="true" required> Vrai</label>
      <label><input type="radio" name="q_${echapper(q.id)}" value="false" required> Faux</label>
    </div>`;
  } else if (q.type === 'reponse_courte') {
    champ = `<input type="text" name="q_${echapper(q.id)}" required placeholder="Ta réponse...">`;
  } else {
    champ = `<textarea name="q_${echapper(q.id)}" required placeholder="Ta réponse..."></textarea>`;
  }
  return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>${champ}</div>`;
}

function rendreResultatExercice(c, questions, reponse) {
  const details = reponse.details || {};
  const reponsesDonnees = reponse.reponses || {};
  const enAttente = reponse.statut === 'en_attente_ia';

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    <div class="recap-score">${enAttente ? '⏳ En cours de correction par un enseignant' : `📊 Score : ${reponse.score} / ${reponse.score_max}`}</div>
    ${questions.map((q, i) => {
      const d = details[q.id] || {};
      const classeResultat = d.correct === true ? 'correct' : d.correct === false ? 'incorrect' : 'attente';
      const donnee = reponsesDonnees[q.id];
      let texteReponse = '(sans réponse)';
      if (q.type === 'qcm') texteReponse = (q.options || [])[Number(donnee)] ?? texteReponse;
      else if (q.type === 'vrai_faux') texteReponse = donnee === undefined ? texteReponse : ((donnee === true || donnee === 'true') ? 'Vrai' : 'Faux');
      else if (donnee) texteReponse = donnee;
      return `<div class="question-lecture">
        <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
        <p>Ta réponse : <strong>${echapper(texteReponse)}</strong></p>
        <div class="resultat-question ${classeResultat}">
          ${d.correct === true ? '✅ Correct' : d.correct === false ? '❌ Incorrect' : '⏳ En attente de correction'}
          ${typeof d.note === 'number' ? ` — ${d.note}/${d.pointsMax} point(s)` : (d.pointsMax ? ` (sur ${d.pointsMax} point(s))` : '')}
          ${d.commentaire ? `<p style="margin:6px 0 0">${echapper(d.commentaire)}</p>` : ''}
        </div>
      </div>`;
    }).join('')}
  `;
}

function attacherEcouteursExercices() {
  document.querySelectorAll('[data-form-exercice]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formExercice, 10);
      const bloc = blocsCourants.find(x => x.id === blocId);
      const questions = Array.isArray(bloc?.contenu?.questions) ? bloc.contenu.questions : [];

      const reponses = {};
      questions.forEach(q => {
        const champCoche = form.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
        const champSimple = form.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
        const champ = champCoche || champSimple;
        if (!champ) return;
        reponses[q.id] = (q.type === 'vrai_faux') ? (champ.value === 'true') : champ.value;
      });

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Correction en cours...';

      try {
        const { data, error } = await supabaseClient.functions.invoke('corriger-exercice', { body: { blocId, reponses } });
        if (error) {
          let message = error.message || "Le service de correction n'a pas répondu.";
          try {
            const corps = await error.context?.json?.();
            if (corps?.error) message = corps.error;
          } catch (_ignore) { /* on garde le message par défaut */ }
          throw new Error(message);
        }
        if (data?.error) throw new Error(data.error);

        reponsesExistantes[blocId] = {
          bloc_id: blocId, eleve_id: profilEleveSeance.id, reponses,
          score: data.score, score_max: data.score_max, details: data.details, statut: data.statut,
        };
        await rafraichirAccesCorrectionIA();
        rendre();
      } catch (e) {
        alert(e.message || "Une erreur est survenue pendant la correction.");
        boutonValider.disabled = false;
        boutonValider.textContent = '✅ Valider mes réponses';
      }
    });
  });
}
