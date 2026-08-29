// Page pages/eleve/devoir.html
// Réalisation d'un devoir "à blocs" (exercice/quiz/évaluation/activité) par
// l'élève, dans un vrai éditeur de réponses — pas une simple zone de texte.
// Réutilise le même moteur que la page séance (js/pages/eleve-seance.js) :
// mêmes tables reponses_exercices/rendus_activites, même edge function
// corriger-exercice (qui sait déjà distinguer un bloc de séance d'un bloc
// de devoir), mêmes types de question (js/editeur/blocs.js). Volontairement
// plus simple qu'une séance : pas de 2 colonnes, pas de paliers d'agilité
// (un devoir est une liste de blocs à faire d'affilée), et un récapitulatif
// de note global en haut de page (resumerDevoirBlocs, js/devoirs-notes-rendu.js).

let profilEleveDevoir = null;
let devoirCourant = null;
let blocsDevoirCourant = [];
let reponsesExistantesDevoir = {}; // bloc_id -> [lignes reponses_exercices] triées par numero_essai
let rendusActivitesExistantsDevoir = {}; // bloc_id -> [lignes rendus_activites] triées par numero_essai
let etatAccesCorrectionIADevoir = { autorise: false };
let formulairesReouvertsDevoir = new Set();

const LIBELLES_MEDAILLE_DEVOIR = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or', diamant: '💎 Diamant' };

(async function () {
  profilEleveDevoir = await requireRole('eleve');
  if (!profilEleveDevoir) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilEleveDevoir.id, badgeHtml: `🟢 ${echapper(profilEleveDevoir.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await chargerDevoir();
})();

async function chargerDevoir() {
  const params = new URLSearchParams(window.location.search);
  const devoirId = parseInt(params.get('id'), 10);
  const conteneur = document.getElementById('contenu');
  if (!devoirId) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Devoir introuvable.</p>';
    return;
  }

  const { data: devoir, error } = await supabaseClient
    .from('devoirs').select('*, champs_formation(nom), seances(titre)').eq('id', devoirId).maybeSingle();
  if (error || !devoir || !devoir.seance_id) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Ce devoir est introuvable, n\'est pas (ou plus) publié, ou n\'est pas un devoir à faire ici (vérifie l\'onglet "Devoirs & notes" pour un devoir plus ancien).</p>';
    return;
  }
  devoirCourant = devoir;

  const { data: blocs, error: erreurBlocs } = await supabaseClient
    .from('blocs_seance').select('*').eq('devoir_id', devoirId).order('ordre');
  if (erreurBlocs) {
    conteneur.innerHTML = `<p class="message-erreur-auth">Erreur : ${echapper(erreurBlocs.message)}</p>`;
    return;
  }
  blocsDevoirCourant = blocs || [];

  // Depuis la refonte des Activités, un bloc "activite" est noté comme un
  // exercice (questions + corrigé) — voir la même note dans js/pages/eleve-seance.js.
  const idsExercices = blocsDevoirCourant.filter(b => ['exercice', 'quiz', 'evaluation', 'activite'].includes(b.type_bloc)).map(b => b.id);
  const idsActivites = blocsDevoirCourant.filter(b => b.type_bloc === 'activite').map(b => b.id);
  reponsesExistantesDevoir = {};
  rendusActivitesExistantsDevoir = {};
  formulairesReouvertsDevoir.clear();

  if (idsExercices.length) {
    const { data: reponses } = await supabaseClient
      .from('reponses_exercices').select('*').eq('eleve_id', profilEleveDevoir.id).in('bloc_id', idsExercices).order('numero_essai');
    (reponses || []).forEach(r => { (reponsesExistantesDevoir[r.bloc_id] ??= []).push(r); });
    await rafraichirAccesCorrectionIADevoir();
  }
  if (idsActivites.length) {
    const { data: rendus } = await supabaseClient
      .from('rendus_activites').select('*').eq('eleve_id', profilEleveDevoir.id).in('bloc_id', idsActivites).order('numero_essai');
    (rendus || []).forEach(r => { (rendusActivitesExistantsDevoir[r.bloc_id] ??= []).push(r); });
  }

  rendreDevoir();
}

async function rafraichirAccesCorrectionIADevoir() {
  const { data: etatAcces } = await supabaseClient.rpc('etat_acces_service', {
    p_eleve_id: profilEleveDevoir.id, p_service: 'correction_ia',
  });
  etatAccesCorrectionIADevoir = etatAcces || { autorise: false };
}

function rendreDevoir() {
  const d = devoirCourant;
  const resume = resumerDevoirBlocs(blocsDevoirCourant,
    Object.values(reponsesExistantesDevoir).flat(), Object.values(rendusActivitesExistantsDevoir).flat());

  const filAriane = [d.champs_formation?.nom, d.seances?.titre].filter(Boolean).join(' › ');

  const enteteNote = (resume && resume.nbRepondus > 0)
    ? `<div class="recap-score" style="margin-bottom:16px">
        ${resume.toutCorrige && resume.noteSur20 != null
          ? `📊 Note actuelle : <strong>${resume.noteSur20}/20</strong>`
          : `⏳ ${resume.nbRepondus}/${resume.nbBlocs} bloc${resume.nbBlocs > 1 ? 's' : ''} rendu${resume.nbRepondus > 1 ? 's' : ''} — en attente de correction`}
      </div>`
    : '';

  document.getElementById('contenu').innerHTML = `
    <div class="fil-ariane-eleve"><a href="devoirs-notes.html">← Retour à mes devoirs</a></div>
    <div class="entete-seance-eleve">
      ${filAriane ? `<p style="margin:0 0 6px;font-size:12px;color:var(--text-gris)">${echapper(filAriane)}</p>` : ''}
      <h1 style="margin:0">${echapper(d.titre)}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:var(--text-gris)">À rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')}</p>
    </div>
    ${d.consigne ? `<div class="bloc-lecture" style="border-left-color:#94A3B8;margin-bottom:16px"><p style="margin:0">${echapper(d.consigne)}</p></div>` : ''}
    ${enteteNote}
    <div class="colonne-exercice-seance" style="max-width:720px">
      ${blocsDevoirCourant.length ? blocsDevoirCourant.map(rendreBlocTravailDevoir).join('') : '<p style="color:var(--text-gris)">Ce devoir n\'a pas encore de contenu — reviens plus tard.</p>'}
    </div>
  `;

  attacherEcouteursExercicesDevoir();
  attacherEcouteursActivitesDevoir();
  attacherEcouteursRefaireDevoir();
}

function rendreBlocTravailDevoir(b) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || '#0000D1';
  const libelle = c.libelle || info.label;
  // Voir la même logique (et son explication) dans js/pages/eleve-seance.js :
  // une activité déjà rendue via l'ancien mode (texte libre) garde son
  // affichage legacy ; une nouvelle activité passe par le parcours structuré.
  const aRenduLegacy = b.type_bloc === 'activite' && (rendusActivitesExistantsDevoir[b.id] || []).length > 0;
  const corps = aRenduLegacy ? rendreActiviteDevoir(b, c) : rendreExerciceDevoir(b, c);
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">
    <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
    ${corps}
  </div>`;
}

function libelleMedailleDevoir(medaille, numeroEssai) {
  if (!medaille || numeroEssai > 2) return '';
  const marque = numeroEssai === 2 ? ' <span style="font-size:11px;opacity:.75">· 2ᵉ essai</span>' : '';
  return ` <span class="badge-palier-seance" style="background:#FEF3C7;color:#92620A">${LIBELLES_MEDAILLE_DEVOIR[medaille]}${marque}</span>`;
}

function rendreExerciceDevoir(b, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  const essais = reponsesExistantesDevoir[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (!questions.length) {
    return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant — reviens plus tard.</p>`;
  }

  if (dernier && !formulairesReouvertsDevoir.has(b.id)) return rendreResultatExerciceDevoir(b, c, questions, dernier);

  if (!etatAccesCorrectionIADevoir.autorise) {
    return `
      ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
      <div class="acces-suspendu-exercice">
        🔒 La correction automatique des exercices est un service premium. Tu as utilisé tous tes essais gratuits — demande à un adulte de contacter l'administration pour souscrire (abonnement ou forfait).
      </div>
    `;
  }

  const noteEssai = etatAccesCorrectionIADevoir.source === 'essai_gratuit'
    ? `<p class="note-essai-gratuit">🎁 Essai gratuit — il te reste ${etatAccesCorrectionIADevoir.essais_restants} correction${etatAccesCorrectionIADevoir.essais_restants > 1 ? 's' : ''} offerte${etatAccesCorrectionIADevoir.essais_restants > 1 ? 's' : ''} après celle-ci.</p>`
    : '';

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    ${noteEssai}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-exercice-devoir="${b.id}">
      ${questions.map((q, i) => rendreChampQuestionDevoir(q, i)).join('')}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">✅ Valider mes réponses</button>
    </form>
  `;
}

// Une "activité" n'a pas de correction automatique : l'élève rend un texte
// (et/ou un lien de pièce jointe), un enseignant/admin corrige ensuite à la
// main (note et/ou appréciation) — voir js/pages/activites-correction.js et
// le panneau de gestion du devoir (js/devoirs-notes-rendu.js).
function rendreActiviteDevoir(b, c) {
  const essais = rendusActivitesExistantsDevoir[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (dernier && !formulairesReouvertsDevoir.has(b.id)) {
    if (dernier.corrige_le) {
      return `
        ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
        <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}/${dernier.bareme}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire-devoir="${b.id}" data-type-refaire-devoir="activite" style="margin-top:10px">🔄 Refaire cette activité</button>`;
    }
    return `
      ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
      <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-activite-devoir="${b.id}" class="activite-lecture">
      <textarea name="reponse" required placeholder="Écris ta réponse ici..."></textarea>
      <input type="url" name="piece_jointe" placeholder="Lien vers une pièce jointe (optionnel)">
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
}

function rendreChampQuestionDevoir(q, i) {
  if (q.type === 'texte_a_trous') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<input type="text" class="champ-trou" data-trou-index="${idxTrou}" required style="width:110px;display:inline-block;margin:0 4px">`;
    }).join('');
    return `<div class="question-lecture" data-question-trous="${echapper(q.id)}"><p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p></div>`;
  }
  if (q.type === 'remise_en_ordre') {
    const options = Array.isArray(q.options) ? q.options : [];
    const ordreMele = options.map((opt, idx) => ({ opt, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
      <ol class="liste-remise-en-ordre" data-ordre-question="${echapper(q.id)}">
        ${ordreMele.map(({ opt, idx }) => `<li data-index-original="${idx}"><span>${echapper(opt)}</span><span class="fleches-ordre"><button type="button" data-monter title="Monter">▲</button><button type="button" data-descendre title="Descendre">▼</button></span></li>`).join('')}
      </ol>
    </div>`;
  }
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

function attacherEcouteursListesOrdreDevoir(racine = document) {
  racine.querySelectorAll('.liste-remise-en-ordre').forEach(liste => {
    liste.querySelectorAll('button[data-monter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const li = btn.closest('li');
        const precedent = li.previousElementSibling;
        if (precedent) liste.insertBefore(li, precedent);
      });
    });
    liste.querySelectorAll('button[data-descendre]').forEach(btn => {
      btn.addEventListener('click', () => {
        const li = btn.closest('li');
        const suivant = li.nextElementSibling;
        if (suivant) liste.insertBefore(suivant, li);
      });
    });
  });
}

function rendreResultatExerciceDevoir(b, c, questions, reponse) {
  const details = reponse.details || {};
  const reponsesDonnees = reponse.reponses || {};
  const enAttente = reponse.statut === 'en_attente_ia';

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    <div class="recap-score">${enAttente ? '⏳ En cours de correction par un enseignant' : `📊 Score : ${reponse.score} / ${reponse.score_max}`}${libelleMedailleDevoir(reponse.medaille, reponse.numero_essai)}</div>
    ${questions.map((q, i) => {
      const d = details[q.id] || {};
      const classeResultat = d.correct === true ? 'correct' : d.correct === false ? 'incorrect' : 'attente';
      const donnee = reponsesDonnees[q.id];
      let texteReponse = '(sans réponse)';
      if (q.type === 'qcm') texteReponse = (q.options || [])[Number(donnee)] ?? texteReponse;
      else if (q.type === 'vrai_faux') texteReponse = donnee === undefined ? texteReponse : ((donnee === true || donnee === 'true') ? 'Vrai' : 'Faux');
      else if (q.type === 'texte_a_trous') texteReponse = Array.isArray(donnee) && donnee.length ? donnee.join(' / ') : texteReponse;
      else if (q.type === 'remise_en_ordre') texteReponse = Array.isArray(donnee) && donnee.length ? donnee.map(idx => (q.options || [])[idx]).join(' → ') : texteReponse;
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
    ${!enAttente ? `<button type="button" class="btn btn-discret" data-refaire-devoir="${b.id}" data-type-refaire-devoir="exercice" style="margin-top:10px">🔄 Refaire cet exercice</button>` : ''}
  `;
}

function attacherEcouteursRefaireDevoir() {
  document.querySelectorAll('[data-refaire-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      formulairesReouvertsDevoir.add(parseInt(btn.dataset.refaireDevoir, 10));
      rendreDevoir();
    });
  });
}

function attacherEcouteursExercicesDevoir() {
  attacherEcouteursListesOrdreDevoir();
  document.querySelectorAll('[data-form-exercice-devoir]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formExerciceDevoir, 10);
      const bloc = blocsDevoirCourant.find(x => x.id === blocId);
      const questions = Array.isArray(bloc?.contenu?.questions) ? bloc.contenu.questions : [];

      const reponses = {};
      questions.forEach(q => {
        if (q.type === 'texte_a_trous') {
          const champsTrou = form.querySelectorAll(`[data-question-trous="${CSS.escape(String(q.id))}"] .champ-trou`);
          reponses[q.id] = Array.from(champsTrou).map(inp => inp.value);
          return;
        }
        if (q.type === 'remise_en_ordre') {
          const liste = form.querySelector(`[data-ordre-question="${CSS.escape(String(q.id))}"]`);
          reponses[q.id] = liste ? Array.from(liste.children).map(li => parseInt(li.dataset.indexOriginal, 10)) : [];
          return;
        }
        const champCoche = form.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
        const champSimple = form.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
        const champ = champCoche || champSimple;
        if (!champ) return;
        reponses[q.id] = (q.type === 'vrai_faux') ? (champ.value === 'true') : champ.value;
      });

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Correction en cours...';

      const numeroEssai = (reponsesExistantesDevoir[blocId] || []).length + 1;

      try {
        const { data, error } = await supabaseClient.functions.invoke('corriger-exercice', { body: { blocId, reponses, numeroEssai } });
        if (error) {
          let message = error.message || "Le service de correction n'a pas répondu.";
          try {
            const corps = await error.context?.json?.();
            if (corps?.error) message = corps.error;
          } catch (_ignore) { /* on garde le message par défaut */ }
          throw new Error(message);
        }
        if (data?.error) throw new Error(data.error);

        (reponsesExistantesDevoir[blocId] ??= []).push({
          bloc_id: blocId, eleve_id: profilEleveDevoir.id, reponses,
          score: data.score, score_max: data.score_max, details: data.details, statut: data.statut,
          numero_essai: numeroEssai, medaille: data.medaille ?? null,
        });
        formulairesReouvertsDevoir.delete(blocId);
        await rafraichirAccesCorrectionIADevoir();
        rendreDevoir();
      } catch (e) {
        alert(e.message || "Une erreur est survenue pendant la correction.");
        boutonValider.disabled = false;
        boutonValider.textContent = '✅ Valider mes réponses';
      }
    });
  });
}

function attacherEcouteursActivitesDevoir() {
  document.querySelectorAll('[data-form-activite-devoir]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formActiviteDevoir, 10);
      const reponseTexte = form.querySelector('[name=reponse]').value.trim();
      const pieceJointe = form.querySelector('[name=piece_jointe]').value.trim();
      const numeroEssai = (rendusActivitesExistantsDevoir[blocId] || []).length + 1;

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Envoi en cours...';

      const { data, error } = await supabaseClient.from('rendus_activites').insert({
        bloc_id: blocId, eleve_id: profilEleveDevoir.id, numero_essai: numeroEssai,
        reponse_texte: reponseTexte, piece_jointe_url: pieceJointe || null
      }).select().single();

      if (error) {
        alert(error.message);
        boutonValider.disabled = false;
        boutonValider.textContent = '📤 Rendre mon travail';
        return;
      }
      (rendusActivitesExistantsDevoir[blocId] ??= []).push(data);
      formulairesReouvertsDevoir.delete(blocId);
      rendreDevoir();
    });
  });
}
