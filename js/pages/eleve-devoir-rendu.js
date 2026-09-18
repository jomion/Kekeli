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
// 18 septembre 2026 (2e lot) : "L'enseignant doit recevoir, corriger et
// attribuer une note [...] L'élève pourra consulter la correction s'il
// valide son devoir." — ligne devoirs_blocs_validations pour CE devoir et CET
// élève, si le devoir a déjà été explicitement validé (bouton "📤 Valider mon
// devoir" ci-dessous) ; null tant qu'il ne l'a pas été. Voir la migration
// ajoute_validation_devoirs_blocs_et_notif.
let validationDevoirCourante = null;

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
  // Depuis le 11 septembre 2026 (2e requête groupée du jour), "exercice" n'est
  // PLUS un exercice structuré (voir js/editeur/devoir-blocs.js) : il rejoint
  // "activite" côté table (rendus_activites, réponse libre + correction à la
  // main) au lieu de reponses_exercices — "correction" ne recueille jamais
  // aucune réponse (contenu masqué/révélé uniquement, comme côté séance).
  const idsExercicesStructures = blocsDevoirCourant.filter(b => ['quiz', 'evaluation', 'activite'].includes(b.type_bloc)).map(b => b.id);
  // 'probleme' ajouté le 11 septembre 2026 (v2, remplacement) : partage
  // rendus_activites avec 'exercice'/'activite' (voir js/editeur/blocs.js) —
  // demande explicite du porteur du projet : le bloc Problème doit exister
  // aussi bien en séance qu'en devoir.
  const idsReponsesLibres = blocsDevoirCourant.filter(b => ['exercice', 'activite', 'probleme'].includes(b.type_bloc)).map(b => b.id);
  reponsesExistantesDevoir = {};
  rendusActivitesExistantsDevoir = {};
  formulairesReouvertsDevoir.clear();

  if (idsExercicesStructures.length) {
    const { data: reponses } = await supabaseClient
      .from('reponses_exercices').select('*').eq('eleve_id', profilEleveDevoir.id).in('bloc_id', idsExercicesStructures).order('numero_essai');
    (reponses || []).forEach(r => { (reponsesExistantesDevoir[r.bloc_id] ??= []).push(r); });
    await rafraichirAccesCorrectionIADevoir();
  }
  if (idsReponsesLibres.length) {
    const { data: rendus } = await supabaseClient
      .from('rendus_activites').select('*').eq('eleve_id', profilEleveDevoir.id).in('bloc_id', idsReponsesLibres).order('numero_essai');
    (rendus || []).forEach(r => { (rendusActivitesExistantsDevoir[r.bloc_id] ??= []).push(r); });
  }

  const { data: validation } = await supabaseClient
    .from('devoirs_blocs_validations').select('*').eq('devoir_id', devoirId).eq('eleve_id', profilEleveDevoir.id).maybeSingle();
  validationDevoirCourante = validation || null;

  rendreDevoir();
}

// 18 septembre 2026 (2e lot) : bouton "📤 Valider mon devoir" — signal
// explicite et unique (choisi par le porteur du projet parmi 2 options) que
// l'élève a terminé son devoir "à blocs" : jusque-là, chaque bloc s'envoyait
// séparément sans qu'aucun signal ne prévienne l'enseignant (cause du bug
// "le devoir rendu n'est pas reçu par l'enseignant"). L'insertion déclenche
// le trigger trg_notifier_devoir_blocs_valide (notifie devoirs.cree_par) ET
// débloque l'affichage d'un éventuel bloc "Correction" (voir plus bas).
// N'exige PAS que tout soit déjà corrigé (resume.toutCorrige) — seulement que
// chaque bloc ait reçu au moins une réponse (resume.nbRepondus === nbBlocs) :
// l'enseignant corrige ensuite, à son rythme, indépendamment de ce bouton.
async function validerDevoirEleve(devoirId) {
  if (!confirm('Valider et envoyer ce devoir à ton enseignant ? Tu ne pourras plus revenir en arrière.')) return;
  const { error } = await supabaseClient.from('devoirs_blocs_validations')
    .insert({ devoir_id: devoirId, eleve_id: profilEleveDevoir.id });
  if (error) return alert(error.message);
  await chargerDevoir();
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

  // 18 septembre 2026 (3e lot) : "le titre est plus long que le contenu,
  // faut harmoniser l'affichage" — l'en-tête (fil d'ariane + titre) n'avait
  // aucune limite de largeur et s'étirait sur toute la largeur de #contenu,
  // tandis que seule la colonne d'exercices ci-dessous était bornée à 720px
  // (style en ligne) : le titre paraissait donc plus "long" que les cartes
  // de contenu sous lui. Un seul conteneur, borné une fois pour toutes,
  // harmonise la largeur du titre, de la consigne et des blocs.
  document.getElementById('contenu').innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="fil-ariane-eleve"><a href="devoirs-notes.html">← Retour à mes devoirs</a></div>
      <div class="entete-seance-eleve">
        ${filAriane ? `<p style="margin:0 0 6px;font-size:12px;color:var(--text-gris)">${echapper(filAriane)}</p>` : ''}
        <h1 style="margin:0">${echapper(d.titre)}</h1>
        <p style="margin:6px 0 0;font-size:13px;color:var(--text-gris)">À rendre le ${new Date(d.date_limite).toLocaleDateString('fr-FR')}</p>
      </div>
      ${d.consigne ? `<div class="bloc-lecture" style="border-left-color:#94A3B8;margin-bottom:16px"><div class="contenu-riche-lecture">${contenuRicheInitial(d.consigne)}</div></div>` : ''}
      ${enteteNote}
      <div class="colonne-exercice-seance">
        ${blocsDevoirCourant.length ? blocsDevoirCourant.map(rendreBlocTravailDevoir).join('') : '<p style="color:var(--text-gris)">Ce devoir n\'a pas encore de contenu — reviens plus tard.</p>'}
      </div>
      ${html_zoneValidationDevoir(resume)}
    </div>
  `;

  attacherEcouteursExercicesDevoir();
  attacherEcouteursActivitesDevoir();
  attacherEcouteursProblemesDevoir();
  attacherEcouteursExercicesLibresDevoir();
  attacherEcouteursCorrectionsDevoir();
  attacherEcouteursRefaireDevoir();

  const btnValider = document.getElementById('btnValiderDevoirEleve');
  if (btnValider) btnValider.addEventListener('click', () => validerDevoirEleve(devoirCourant.id));
}

// Zone "📤 Valider mon devoir", sous la liste des blocs — voir
// validerDevoirEleve() ci-dessus. resume est null si le devoir n'a aucun
// bloc "notable" (uniquement un bloc "correction", cas très improbable mais
// géré proprement plutôt que de faire planter le rendu).
function html_zoneValidationDevoir(resume) {
  if (!resume || !resume.nbBlocs) return '';
  if (validationDevoirCourante) {
    return `<div class="recap-score" style="margin-top:18px;background:#E6F9EF;color:#0F7A45">
      ✅ Devoir envoyé le ${new Date(validationDevoirCourante.valide_le).toLocaleDateString('fr-FR')} — ton enseignant en a été prévenu.
    </div>`;
  }
  const pretAValider = resume.nbRepondus >= resume.nbBlocs;
  return `<div style="margin-top:20px;text-align:center;padding-top:16px;border-top:1px solid var(--bordure,#E2E8F0)">
    <button type="button" class="btn btn-filled" id="btnValiderDevoirEleve" ${pretAValider ? '' : 'disabled'}>📤 Valider mon devoir</button>
    <p style="font-size:12px;color:var(--text-gris);margin-top:6px">
      ${pretAValider
        ? 'Une fois validé, ton enseignant sera prévenu qu\'il peut corriger ton devoir.'
        : `Réponds à tous les blocs (${resume.nbRepondus}/${resume.nbBlocs}) avant de pouvoir valider.`}
    </p>
  </div>`;
}

// Bascule "🔓 Voir la correction" d'un bloc "correction" (11 septembre 2026)
// — purement côté client, aucun appel réseau, même principe que côté séance
// (js/pages/eleve-seance.js, attacherEcouteursCorrections).
function attacherEcouteursCorrectionsDevoir() {
  document.querySelectorAll('[data-bouton-correction-devoir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const zone = document.querySelector(`[data-zone-correction-devoir="${btn.dataset.boutonCorrectionDevoir}"]`);
      if (!zone) return;
      const estMasquee = zone.hidden;
      zone.hidden = !estMasquee;
      btn.textContent = estMasquee ? '🔼 Masquer la correction' : '🔓 Voir la correction';
    });
  });
}

function rendreBlocTravailDevoir(b) {
  const info = infoTypeDevoir(b.type_bloc);
  const c = b.contenu || {};
  // Bordure/texte theme-aware (var(--bleu-kekeli), voir js/pages/eleve-seance.js
  // pour l'explication complète — 5 septembre 2026, 7e lot), teinte de fond
  // sur la valeur hex (teinteClaire ne comprend pas les variables CSS).
  const couleur = c.couleurBloc || info.couleur || 'var(--bleu-kekeli)';
  const couleurFond = c.couleurBloc || info.couleur || '#0000D1';
  const libelle = c.libelle || info.label;

  // Bloc "Correction" (11 septembre 2026) : jamais de réponse à recueillir,
  // contenu masqué/révélé au clic — même gabarit que côté séance (voir
  // js/pages/eleve-seance.js, rendreBlocLecture).
  // 18 septembre 2026 (2e lot) : "L'élève pourra consulter la correction s'il
  // valide son devoir" — le bouton reste visible (pour que l'élève sache
  // qu'une correction existe) mais désactivé tant que validationDevoirCourante
  // est vide (voir validerDevoirEleve()).
  if (b.type_bloc === 'correction') {
    const corpsCorrection = validationDevoirCourante
      ? `<button type="button" class="btn btn-discret" data-bouton-correction-devoir="${b.id}">🔓 Voir la correction</button>
      <div class="contenu-riche-lecture" data-zone-correction-devoir="${b.id}" hidden>${contenuRicheInitial(c.texte)}</div>`
      : `<button type="button" class="btn btn-discret" disabled title="Disponible une fois ton devoir validé">🔒 Voir la correction</button>
      <p style="font-size:12px;color:var(--text-gris);margin:6px 0 0">Disponible une fois que tu auras validé ton devoir (bouton en bas de page).</p>`;
    return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">
      <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
      ${corpsCorrection}
    </div>`;
  }

  // Voir la même logique (et son explication) dans js/pages/eleve-seance.js :
  // une activité déjà rendue via l'ancien mode (texte libre) garde son
  // affichage legacy ; une nouvelle activité passe par le parcours structuré.
  // "exercice" (11 septembre 2026) n'est plus structuré du tout : réponse
  // libre + correction à la main, sur le même principe que "activite" —
  // voir rendreExerciceLibreDevoir ci-dessous.
  let corps;
  if (b.type_bloc === 'exercice') corps = rendreExerciceLibreDevoir(b, c);
  else if (b.type_bloc === 'probleme') corps = rendreProblemeDevoir(b, c);
  else {
    const aRenduLegacy = b.type_bloc === 'activite' && (rendusActivitesExistantsDevoir[b.id] || []).length > 0;
    corps = aRenduLegacy ? rendreActiviteDevoir(b, c) : rendreExerciceDevoir(b, c);
  }
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">
    <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
    ${corps}
  </div>`;
}

// Bloc "exercice" devenu texte libre (11 septembre 2026) : l'élève lit le
// texte rédigé par l'enseignant (c.texte, comme un bloc "Texte"), puis rend
// une réponse libre (+ pièce jointe optionnelle) — recueillie dans
// rendus_activites et corrigée À LA MAIN par l'enseignant (note/barème/
// appréciation/commentaire), exactement comme pour un bloc "activité" — voir
// attacherEcouteursExercicesLibresDevoir ci-dessous et
// ouvrirCorrectionActiviteDevoir dans js/devoirs-notes-rendu.js.
function rendreExerciceLibreDevoir(b, c) {
  const essais = rendusActivitesExistantsDevoir[b.id] || [];
  const dernier = essais[essais.length - 1];
  // Mode "HTML brut" (11 septembre 2026) — même cadre isolé que le bloc
  // "HTML libre" côté séance, voir html_editeurExerciceLibre dans blocs.js.
  const texteExercice = c.htmlBrut
    ? html_blocHtmlLibre(c.code, '')
    : `<div class="contenu-riche-lecture">${contenuRicheInitial(c.texte)}</div>`;

  if (dernier && !formulairesReouvertsDevoir.has(b.id)) {
    if (dernier.corrige_le) {
      return `
        ${texteExercice}
        <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px;white-space:pre-wrap">${echapper(dernier.reponse_texte || '')}</p>
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}${dernier.bareme ? `/${dernier.bareme}` : ''}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire-devoir="${b.id}" data-type-refaire-devoir="exercice_libre" style="margin-top:10px">🔄 Rendre une nouvelle réponse</button>`;
    }
    return `
      ${texteExercice}
      <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px;white-space:pre-wrap">${echapper(dernier.reponse_texte || '')}</p>
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${texteExercice}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel envoi (n°${essais.length + 1})</p>` : ''}
    <form data-form-exercice-libre-devoir="${b.id}" class="activite-lecture">
      <textarea name="reponse" required placeholder="Écris ta réponse ici..."></textarea>
      <input type="url" name="piece_jointe" placeholder="Lien vers une pièce jointe (optionnel)">
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
}

// Bloc "Problème" v2 côté devoir (11 septembre 2026, remplacement) — même
// mécanisme que rendreProbleme dans js/pages/eleve-seance.js (rendus_activites,
// grille de calcul posé interactive), voir js/editeur/blocs.js pour le moteur
// partagé. modeAffichage='corrige' reste un exemple entièrement résolu, en
// lecture seule (support de cours dans le devoir, pas un exercice à rendre).
function rendreProblemeDevoir(b, c) {
  if ((c.modeAffichage || 'eleve') === 'corrige') return html_lectureProbleme(c, b.id);

  const essais = rendusActivitesExistantsDevoir[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (dernier && !formulairesReouvertsDevoir.has(b.id)) {
    const reponseLignes = lireReponseProbleme(dernier.reponse_texte);
    if (dernier.corrige_le) {
      return `
        ${html_relectureProbleme(c, reponseLignes)}
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}/${dernier.bareme}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${libelleMedailleDevoir(dernier.medaille, dernier.numero_essai)}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire-devoir="${b.id}" data-type-refaire-devoir="probleme" style="margin-top:10px">🔄 Refaire ce problème</button>`;
    }
    return `
      ${html_relectureProbleme(c, reponseLignes)}
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-probleme-devoir="${b.id}" data-nb-lignes-probleme="${(Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : []).length}">
      ${html_formulaireProbleme(b, c)}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
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
    return `${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant — reviens plus tard.</p>`;
  }

  if (dernier && !formulairesReouvertsDevoir.has(b.id)) return rendreResultatExerciceDevoir(b, c, questions, dernier);

  if (!etatAccesCorrectionIADevoir.autorise) {
    return `
      ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
      <div class="acces-suspendu-exercice">
        🔒 La correction automatique des exercices est un service premium. Tu as utilisé tous tes essais gratuits — demande à un adulte de contacter l'administration pour souscrire (abonnement ou forfait).
      </div>
    `;
  }

  const noteEssai = etatAccesCorrectionIADevoir.source === 'essai_gratuit'
    ? `<p class="note-essai-gratuit">🎁 Essai gratuit — il te reste ${etatAccesCorrectionIADevoir.essais_restants} correction${etatAccesCorrectionIADevoir.essais_restants > 1 ? 's' : ''} offerte${etatAccesCorrectionIADevoir.essais_restants > 1 ? 's' : ''} après celle-ci.</p>`
    : '';

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
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
        ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
        <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}/${dernier.bareme}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire-devoir="${b.id}" data-type-refaire-devoir="activite" style="margin-top:10px">🔄 Refaire cette activité</button>`;
    }
    return `
      ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
      <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-activite-devoir="${b.id}" class="activite-lecture">
      <textarea name="reponse" required placeholder="Écris ta réponse ici..."></textarea>
      <input type="url" name="piece_jointe" placeholder="Lien vers une pièce jointe (optionnel)">
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
}

// Voir rendreEnonce dans js/pages/eleve-seance.js pour l'explication complète
// (types "plats" en texte brut vs énoncé riche pour tous les autres).
function rendreEnonceDevoir(q) {
  if (TYPES_ENONCE_PLAT.includes(q.type)) return echapper(q.enonce);
  return contenuRicheInitial(q.enonce);
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
    return `<div class="question-lecture" data-question-trous="${echapper(q.id)}"><p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}</div>`;
  }
  if (q.type === 'texte_a_trous_glisser') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<span class="zone-trou-glisser" data-trou-glisser-index="${idxTrou}"></span>`;
    }).join('');
    const banque = Array.isArray(q.banqueMots) ? q.banqueMots : [];
    const banqueMelangee = banque.map((m, idx) => ({ m, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture" data-question-trous-glisser="${echapper(q.id)}">
      <p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div class="banque-mots-glisser">
        ${banqueMelangee.map(({ m }) => `<button type="button" class="chip-glisser" draggable="true" data-mot-glisser="${echapper(m)}">${echapper(m)}</button>`).join('')}
      </div>
      <p class="note-aide-glisser">Glisse chaque mot dans le trou qui convient (ou touche un mot puis touche un trou).</p>
    </div>`;
  }
  if (q.type === 'selection_mots') {
    const mots = tokeniserMots(q.enonce || '');
    return `<div class="question-lecture" data-question-selection-mots="${echapper(q.id)}">
      <p class="question-enonce">${i + 1}. Clique sur le ou les mots corrects.</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div class="mots-selectionnables-lecture">
        ${mots.map((m, mi) => `<button type="button" class="chip-mot-choix" data-mot-choix-index="${mi}">${echapper(m)}</button>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'intrus_lexical') {
    const series = Array.isArray(q.series) ? q.series : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div class="series-intrus-lecture" data-intrus-question="${echapper(q.id)}">
        ${series.map((s, si) => {
          const mots = Array.isArray(s?.mots) ? s.mots : [];
          return `<div class="serie-intrus" data-serie-intrus-index="${si}">
            ${mots.map((m, mi) => `<label class="chip-mot-choix-radio"><input type="radio" name="intrus_${echapper(q.id)}_${si}" data-intrus-radio-index="${mi}" required> ${echapper(m)}</label>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'remise_en_ordre') {
    const options = Array.isArray(q.options) ? q.options : [];
    const ordreMele = options.map((opt, idx) => ({ opt, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <ol class="liste-remise-en-ordre" data-ordre-question="${echapper(q.id)}">
        ${ordreMele.map(({ opt, idx }) => `<li data-index-original="${idx}"><span>${echapper(opt)}</span><span class="fleches-ordre"><button type="button" data-monter title="Monter">▲</button><button type="button" data-descendre title="Descendre">▼</button></span></li>`).join('')}
      </ol>
    </div>`;
  }
  if (q.type === 'association') {
    const gauche = Array.isArray(q.gauche) ? q.gauche : [];
    const droite = Array.isArray(q.droite) ? q.droite : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div class="lignes-association" data-association-question="${echapper(q.id)}">
        ${gauche.map((g, idx) => `
          <div class="ligne-association" style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="flex:1">${echapper(g)}</span>
            <select data-association-choix-index="${idx}" required>
              <option value="">— Choisis —</option>
              ${droite.map((d, k) => `<option value="${k}">${echapper(d)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'qcm_multiple') {
    const options = Array.isArray(q.options) ? q.options : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div data-qcm-multiple-question="${echapper(q.id)}">
        ${options.map((opt, idx) => `<label style="display:block;margin-top:4px"><input type="checkbox" data-qcm-multiple-choix-index="${idx}"> ${echapper(opt)}</label>`).join('')}
      </div>
    </div>`;
  }
  if (q.type === 'classement') {
    const motsAClasser = Array.isArray(q.motsAClasser) ? q.motsAClasser : [];
    const categories = Array.isArray(q.categories) ? q.categories : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
      ${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}
      <div class="lignes-classement" data-classement-question="${echapper(q.id)}">
        ${motsAClasser.map((mot, idx) => `
          <div class="ligne-classement" style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="flex:1">${echapper(mot)}</span>
            <select data-classement-choix-index="${idx}" required>
              <option value="">— Choisis —</option>
              ${categories.map((cat, k) => `<option value="${k}">${echapper(cat)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
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
  } else if (q.type === 'reponse_numerique') {
    champ = `<input type="number" step="any" name="q_${echapper(q.id)}" required placeholder="Ta réponse...">`;
  } else if (q.type === 'vrai_faux_justifie') {
    champ = `<div class="vf-choix">
      <label><input type="radio" name="q_${echapper(q.id)}" value="true" required> Vrai</label>
      <label><input type="radio" name="q_${echapper(q.id)}" value="false" required> Faux</label>
    </div>
    <textarea name="q_${echapper(q.id)}_justification" required placeholder="Justifie ta réponse..." style="margin-top:8px"></textarea>`;
  } else {
    champ = `<textarea name="q_${echapper(q.id)}" required placeholder="Ta réponse..."></textarea>`;
  }
  return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
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

// Voir attacherEcouteursSelectionMots/attacherEcouteursTrousGlisser dans
// js/pages/eleve-seance.js pour l'explication complète (dupliquées ici, ces
// deux pages ne partageant pas de module commun).
function attacherEcouteursSelectionMotsDevoir(racine = document) {
  racine.querySelectorAll('.mots-selectionnables-lecture .chip-mot-choix').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
  });
}

function attacherEcouteursTrousGlisserDevoir(racine = document) {
  racine.querySelectorAll('[data-question-trous-glisser]').forEach(zoneQuestion => {
    const chips = Array.from(zoneQuestion.querySelectorAll('.chip-glisser'));
    let motArme = null;

    function armerMot(chip) {
      chips.forEach(c => c.classList.remove('chip-armee'));
      if (motArme === chip) { motArme = null; return; }
      motArme = chip;
      chip.classList.add('chip-armee');
    }

    function placerMot(trou, chip) {
      if (trou.dataset.motPlace) {
        const ancien = chips.find(c => c.hidden && c.dataset.motGlisser === trou.dataset.motPlace);
        if (ancien) ancien.hidden = false;
      }
      trou.textContent = chip.dataset.motGlisser;
      trou.dataset.motPlace = chip.dataset.motGlisser;
      trou.classList.add('trou-glisser-rempli');
      chip.hidden = true;
      chip.classList.remove('chip-armee');
      motArme = null;
    }

    function retirerMot(trou) {
      if (!trou.dataset.motPlace) return;
      const chip = chips.find(c => c.hidden && c.dataset.motGlisser === trou.dataset.motPlace);
      if (chip) chip.hidden = false;
      trou.textContent = '';
      delete trou.dataset.motPlace;
      trou.classList.remove('trou-glisser-rempli');
    }

    chips.forEach(chip => {
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', chip.dataset.motGlisser);
        e.dataTransfer.effectAllowed = 'move';
      });
      chip.addEventListener('click', () => armerMot(chip));
    });

    zoneQuestion.querySelectorAll('.zone-trou-glisser').forEach(trou => {
      trou.addEventListener('dragover', (e) => { e.preventDefault(); trou.classList.add('trou-glisser-survole'); });
      trou.addEventListener('dragleave', () => trou.classList.remove('trou-glisser-survole'));
      trou.addEventListener('drop', (e) => {
        e.preventDefault();
        trou.classList.remove('trou-glisser-survole');
        const motTexte = e.dataTransfer.getData('text/plain');
        const chip = chips.find(c => !c.hidden && c.dataset.motGlisser === motTexte);
        if (chip) placerMot(trou, chip);
      });
      trou.addEventListener('click', () => {
        if (motArme) { placerMot(trou, motArme); return; }
        retirerMot(trou);
      });
    });
  });
}

// Note/20 d'UNE activité, calculée à partir du pourcentage obtenu (score /
// score_max) — voir la même fonction et la même explication dans
// js/pages/eleve-seance.js (dupliquée ici, comme libelleMedaille/
// libelleMedailleDevoir, ces deux pages ne partageant pas de module commun).
function noteSur20DepuisScoreDevoir(score, scoreMax) {
  if (!scoreMax || !Number.isFinite(score) || !Number.isFinite(scoreMax)) return null;
  return Math.round((score / scoreMax) * 20 * 10) / 10;
}

function rendreResultatExerciceDevoir(b, c, questions, reponse) {
  // 18 septembre 2026 (4e lot) : `details`/`details_taches` (voir la Edge
  // Function corriger-exercice, moteur "tâches" depuis le 11 septembre) ne
  // contient JAMAIS de champ `correct`/`note`/`pointsMax` par question — ces
  // noms venaient d'un ancien modèle "1 point par question" déjà remplacé
  // côté séance (voir rendreResultatExercice dans eleve-seance.js). Faute de
  // ce correctif, `d.correct` restait toujours undefined ici et CHAQUE
  // question d'un devoir "à blocs" de type Évaluation/Activité affichait
  // systématiquement "⏳ En attente de correction", quel que soit le vrai
  // résultat — corrigé en reprenant tachesTotal/tachesReussies, comme côté
  // séance.
  const details = reponse.details_taches || reponse.details || {};
  const reponsesDonnees = reponse.reponses || {};
  const enAttente = reponse.statut === 'en_attente_ia';
  const note20 = enAttente ? null : noteSur20DepuisScoreDevoir(reponse.score, reponse.score_max);

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    <div class="recap-score">${enAttente ? '⏳ En cours de correction par un enseignant' : `📊 Score : ${reponse.score} / ${reponse.score_max}${note20 !== null ? ` (${note20}/20)` : ''}`}${libelleMedailleDevoir(reponse.medaille, reponse.numero_essai)}</div>
    ${questions.map((q, i) => {
      const d = details[q.id] || {};
      const tachesTotalQ = typeof d.tachesTotal === 'number' ? d.tachesTotal : 1;
      const tachesReussiesQ = typeof d.tachesReussies === 'number' ? d.tachesReussies : (d.correct ? 1 : 0);
      const classeResultat = d.corrigePar === 'en_attente' ? 'attente' : (tachesReussiesQ === tachesTotalQ ? 'correct' : tachesReussiesQ > 0 ? 'partiel' : 'incorrect');
      const donnee = reponsesDonnees[q.id];
      let texteReponse = '(sans réponse)';
      if (q.type === 'qcm') texteReponse = (q.options || [])[Number(donnee)] ?? texteReponse;
      else if (q.type === 'vrai_faux') texteReponse = donnee === undefined ? texteReponse : ((donnee === true || donnee === 'true') ? 'Vrai' : 'Faux');
      else if (q.type === 'texte_a_trous') texteReponse = Array.isArray(donnee) && donnee.length ? donnee.join(' / ') : texteReponse;
      else if (q.type === 'remise_en_ordre') texteReponse = Array.isArray(donnee) && donnee.length ? donnee.map(idx => (q.options || [])[idx]).join(' → ') : texteReponse;
      else if (q.type === 'association') texteReponse = Array.isArray(donnee) && donnee.length
        ? donnee.map((k, idx) => `${(q.gauche || [])[idx] ?? ''} → ${k != null ? ((q.droite || [])[k] ?? '?') : '(sans réponse)'}`).join(' ; ')
        : texteReponse;
      else if (q.type === 'qcm_multiple') texteReponse = Array.isArray(donnee) && donnee.length
        ? donnee.map(idx => (q.options || [])[idx]).filter(Boolean).join(', ')
        : texteReponse;
      else if (q.type === 'classement') texteReponse = Array.isArray(donnee) && donnee.length
        ? donnee.map((k, idx) => `${(q.motsAClasser || [])[idx] ?? ''} → ${k != null ? ((q.categories || [])[k] ?? '?') : '(sans réponse)'}`).join(' ; ')
        : texteReponse;
      else if (q.type === 'reponse_numerique') texteReponse = (donnee !== undefined && donnee !== null && donnee !== '') ? String(donnee) : texteReponse;
      else if (q.type === 'selection_mots') {
        const mots = tokeniserMots(q.enonce || '');
        texteReponse = Array.isArray(donnee) && donnee.length ? donnee.map(idx => mots[Number(idx)]).filter(Boolean).join(', ') : texteReponse;
      }
      else if (q.type === 'intrus_lexical') {
        const series = Array.isArray(q.series) ? q.series : [];
        texteReponse = Array.isArray(donnee) && donnee.length
          ? donnee.map((mi, si) => mi != null ? ((series[si]?.mots || [])[mi] ?? '?') : '(sans réponse)').join(' ; ')
          : texteReponse;
      }
      else if (q.type === 'texte_a_trous_glisser') texteReponse = Array.isArray(donnee) && donnee.length
        ? donnee.map(m => m || '(vide)').join(' / ')
        : texteReponse;
      else if (q.type === 'vrai_faux_justifie') texteReponse = (donnee && typeof donnee === 'object')
        ? `${donnee.reponse === true ? 'Vrai' : donnee.reponse === false ? 'Faux' : '(sans réponse)'} — ${donnee.justification || '(pas de justification)'}`
        : texteReponse;
      else if (donnee) texteReponse = donnee;
      const libelleTacheDevoir = d.corrigePar === 'en_attente'
        ? '⏳ En attente de correction'
        : (tachesTotalQ > 1
          ? `${tachesReussiesQ === tachesTotalQ ? '✅' : tachesReussiesQ > 0 ? '🟡' : '❌'} ${tachesReussiesQ}/${tachesTotalQ} tâche${tachesTotalQ > 1 ? 's' : ''} réussie${tachesReussiesQ > 1 ? 's' : ''}`
          : (tachesReussiesQ >= 1 ? '✅ Correct' : '❌ Incorrect'));
      // 18 septembre 2026 (4e lot) : même principe que côté séance (voir
      // rendreResultatExercice dans eleve-seance.js) — le commentaire
      // pédagogique de l'IA ne doit pas être plus permissif que la vraie
      // correction. Un devoir n'a pas de palier ni de bouton "Voir la
      // correction" par question : le repli retenu est le dernier essai
      // possible (ESSAIS_MAX = 3, voir corriger-exercice), au-delà duquel il
      // n'y a de toute façon plus rien à cacher.
      const peutVoirCommentaireQuestionDevoir = d.corrigePar === 'en_attente' || tachesReussiesQ === tachesTotalQ || reponse.numero_essai >= 3;
      return `<div class="question-lecture">
        <p class="question-enonce">${i + 1}. ${rendreEnonceDevoir(q)}</p>
        <p>Ta réponse : <strong>${echapper(texteReponse)}</strong></p>
        <div class="resultat-question ${classeResultat}">
          ${libelleTacheDevoir}
          ${(peutVoirCommentaireQuestionDevoir && d.commentaire) ? `<p style="margin:6px 0 0">${echapper(d.commentaire)}</p>` : ''}
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
  attacherEcouteursSelectionMotsDevoir();
  attacherEcouteursTrousGlisserDevoir();
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
        if (q.type === 'association') {
          const zone = form.querySelector(`[data-association-question="${CSS.escape(String(q.id))}"]`);
          const selects = zone ? Array.from(zone.querySelectorAll('[data-association-choix-index]')) : [];
          selects.sort((a, b) => parseInt(a.dataset.associationChoixIndex, 10) - parseInt(b.dataset.associationChoixIndex, 10));
          reponses[q.id] = selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
          return;
        }
        if (q.type === 'qcm_multiple') {
          const zone = form.querySelector(`[data-qcm-multiple-question="${CSS.escape(String(q.id))}"]`);
          const cases = zone ? Array.from(zone.querySelectorAll('[data-qcm-multiple-choix-index]')) : [];
          reponses[q.id] = cases.filter(cb => cb.checked).map(cb => parseInt(cb.dataset.qcmMultipleChoixIndex, 10));
          return;
        }
        if (q.type === 'classement') {
          const zone = form.querySelector(`[data-classement-question="${CSS.escape(String(q.id))}"]`);
          const selects = zone ? Array.from(zone.querySelectorAll('[data-classement-choix-index]')) : [];
          selects.sort((a, b) => parseInt(a.dataset.classementChoixIndex, 10) - parseInt(b.dataset.classementChoixIndex, 10));
          reponses[q.id] = selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
          return;
        }
        if (q.type === 'intrus_lexical') {
          const zone = form.querySelector(`[data-intrus-question="${CSS.escape(String(q.id))}"]`);
          const series = zone ? Array.from(zone.querySelectorAll('[data-serie-intrus-index]')) : [];
          series.sort((a, b) => parseInt(a.dataset.serieIntrusIndex, 10) - parseInt(b.dataset.serieIntrusIndex, 10));
          reponses[q.id] = series.map(s => {
            const coche = s.querySelector('input[data-intrus-radio-index]:checked');
            return coche ? parseInt(coche.dataset.intrusRadioIndex, 10) : null;
          });
          return;
        }
        if (q.type === 'selection_mots') {
          const zone = form.querySelector(`[data-question-selection-mots="${CSS.escape(String(q.id))}"]`);
          const chips = zone ? Array.from(zone.querySelectorAll('.chip-mot-choix')) : [];
          reponses[q.id] = chips.filter(c => c.classList.contains('selectionne')).map(c => c.dataset.motChoixIndex);
          return;
        }
        if (q.type === 'texte_a_trous_glisser') {
          const zone = form.querySelector(`[data-question-trous-glisser="${CSS.escape(String(q.id))}"]`);
          const trous = zone ? Array.from(zone.querySelectorAll('.zone-trou-glisser')) : [];
          trous.sort((a, b) => parseInt(a.dataset.trouGlisserIndex, 10) - parseInt(b.dataset.trouGlisserIndex, 10));
          reponses[q.id] = trous.map(t => t.dataset.motPlace || null);
          return;
        }
        if (q.type === 'vrai_faux_justifie') {
          const coche = form.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
          const justif = form.querySelector(`[name="q_${CSS.escape(String(q.id))}_justification"]`);
          reponses[q.id] = { reponse: coche ? coche.value === 'true' : null, justification: justif ? justif.value : '' };
          return;
        }
        const champCoche = form.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
        const champSimple = form.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], input[type=number][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
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

// Soumission du bloc "Problème" v2 côté devoir — mêmes principes que
// attacherEcouteursProblemes dans js/pages/eleve-seance.js (voir
// collecterReponseProbleme dans js/editeur/blocs.js pour le format JSON
// stocké dans reponse_texte).
function attacherEcouteursProblemesDevoir() {
  document.querySelectorAll('[data-form-probleme-devoir]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formProblemeDevoir, 10);
      const nbLignes = parseInt(form.dataset.nbLignesProbleme, 10) || 0;
      const reponseTexte = collecterReponseProbleme(form, nbLignes);
      const numeroEssai = (rendusActivitesExistantsDevoir[blocId] || []).length + 1;

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Envoi en cours...';

      const { data, error } = await supabaseClient.from('rendus_activites').insert({
        bloc_id: blocId, eleve_id: profilEleveDevoir.id, numero_essai: numeroEssai,
        reponse_texte: reponseTexte, piece_jointe_url: null
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

// Même mécanique que attacherEcouteursActivitesDevoir ci-dessus, pour le
// bloc "exercice" redevenu texte libre (11 septembre 2026) — table
// rendus_activites partagée, seul le sélecteur de formulaire diffère.
function attacherEcouteursExercicesLibresDevoir() {
  document.querySelectorAll('[data-form-exercice-libre-devoir]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formExerciceLibreDevoir, 10);
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
