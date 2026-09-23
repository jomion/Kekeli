// Requête P, partie 2 (24 septembre 2026) : "Entraînement IA" — questions
// INÉDITES générées par IA à partir du contenu réel de la classe et des
// séances, mais toujours relues et validées par un administrateur avant
// qu'un élève ne puisse y jouer (pages/admin/questions-ia-jeux.html), pour
// les 3 jeux reliés aux vraies séances (Français, ES, EST — voir
// js/jeux/moteur-jeu-arcade.js).
//
// 24 septembre 2026, septième lot ("Retire le bouton entrainement IA et
// mélange simplement les questions IA avec celles existant déjà") : le
// bouton manuel "🤖 Entraînement IA" (initEntrainementIA, ci-dessous jusqu'à
// cette date) est RETIRÉ. Les questions IA validées sont désormais tirées au
// sort dans la même rotation que le contenu réel, sans action de l'élève —
// voir choisirPalier()/lancer() dans js/jeux/coquille-jeu-arcade.js, qui
// décide, à chaque choix de palier, si la prochaine partie sera une vraie
// ronde ou une question IA (coup de sort 50/50 si les deux existent, IA
// seule si le contenu réel est épuisé/absent, jamais d'IA sinon). Ce fichier
// reste par ailleurs INCHANGÉ : la garantie structurelle d'absence d'impact
// formel (ci-dessous) tient toujours après cette fusion, puisque c'est
// encore et uniquement lancerEntrainementIA() qui exécute une partie IA.
//
// Décision produit reconfirmée le même jour (clarification avant
// développement) : le service Premium payant dédié "entrainement_ia" est
// RETIRÉ — l'entraînement IA est désormais entièrement gratuit, comme le
// reste du contenu des 3 jeux (voir la Edge Function "jeu-ia-questions",
// dont la vérification etat_acces_service a été retirée côté serveur, et
// js/pages/admin-abonnements.js, dont le libellé de catalogue a été retiré —
// aucun plan tarifaire ni abonnement ne référençait ce service au moment du
// retrait, vérifié directement en base avant suppression).
// - "Entraînement libre, sans impact formel" (non négociable, reconfirmé
//   explicitement même après la fusion dans la rotation normale) : ce mode
//   ne touche JAMAIS reponses_exercices, essais, médailles, paliers, badges
//   ni compétences — il ne réutilise donc PAS jeuSoumettreRonde/
//   jeuValiderTache (js/jeux/moteur-jeu-arcade.js), qui persistent la
//   notation réelle des séances. Rien n'est persisté ici.
//
// Ce fichier est volontairement autonome (pas une extension de
// coquille-jeu-arcade.js) : le mode normal (vraies séances, notation réelle,
// déjà testé et critique) n'est pas modifié d'un octet. Il réutilise
// uniquement des fonctions de rendu/lecture déjà éprouvées et chargées par
// les mêmes pages : jeuRendreChampQuestion/jeuAttacherTousEcouteurs/
// jeuLireReponseQuestion/jeuTexteBonneReponse (js/jeux/rendu-questions-jeu.js,
// qui dépend lui-même de js/editeur/blocs.js) et JEU_PALIERS
// (js/jeux/moteur-jeu-arcade.js) — tous déjà chargés avant ce fichier sur
// chaque page de jeu.
//
// Utilisation, depuis js/jeux/coquille-jeu-arcade.js (choisirPalier/lancer),
// via config.entrainementIA passé à creerJeuArcade() par
// js/pages/eleve-jeu-es.js/eleve-jeu-est.js/eleve-jeu-atelier-francais.js :
//   entrainementIA: { champFormationId: 3 }                    // ES/EST
//   entrainementIA: { champFormationId: 1, avecCategorie: true } // Français
// `jeu` (premier argument de lancerEntrainementIA/eiaDisciplineActuelle) est
// un objet { els, etat } — l'objet complet renvoyé par creerJeuArcade()
// avant sa fusion dans la rotation, ou (depuis cette fusion) le { els, etat }
// interne de coquille-jeu-arcade.js, structurellement identique pour
// l'usage qu'en fait ce fichier (jeu.etat.palier/categorie, jamais jeu.init).

// eiaCompterQuestionsDisponibles : appel réseau DUPLIQUÉ (action "lister",
// même Edge Function que lancerEntrainementIA ci-dessous) plutôt que
// partagé, à dessein — sur le modèle déjà établi par ce projet (voir la
// remarque équivalente dans js/pages/admin-questions-ia-jeux.js) : ne prend
// aucun risque de régression sur lancerEntrainementIA, déjà testée et
// éprouvée, en la gardant totalement à l'écart de ce nouveau chemin de
// comptage utilisé par choisirPalier() pour décider du mode de la ronde.
async function eiaCompterQuestionsDisponibles({ champFormationId, palier, discipline }) {
  if (!champFormationId || !palier) return { count: 0 };
  try {
    const { data, error } = await supabaseClient.functions.invoke('jeu-ia-questions', {
      body: { action: 'lister', champFormationId, palier, discipline: discipline || '' },
    });
    if (error || data?.error) return { count: 0 };
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    return { count: questions.length };
  } catch (_e) {
    // Panne réseau/Edge Function : jamais bloquant, se comporte comme
    // "aucune question IA disponible" — la rotation retombe sur le contenu
    // réel exactement comme avant cette fusion.
    return { count: 0 };
  }
}

function eiaDisciplineActuelle(jeu, config) {
  if (!config.avecCategorie) return null;
  const categorie = jeu.etat && jeu.etat.categorie;
  return (categorie && categorie !== 'all') ? categorie : null;
}

function eiaOverlay() {
  let overlay = document.getElementById('eiaOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'eiaOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,20,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div id="eiaBoite" style="background:#161329;color:#fff;border-radius:14px;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div id="eiaCorps"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermerEiaOverlay(); });
  return overlay;
}

function fermerEiaOverlay() {
  const overlay = document.getElementById('eiaOverlay');
  if (overlay) overlay.remove();
}

async function lancerEntrainementIA(jeu, config) {
  if (!jeu.etat || !jeu.etat.palier) {
    alert("Choisis d'abord un niveau ci-dessus, puis relance l'entraînement IA.");
    return;
  }
  const palier = jeu.etat.palier;
  const discipline = eiaDisciplineActuelle(jeu, config);
  const overlay = eiaOverlay();
  const corps = document.getElementById('eiaCorps');
  corps.innerHTML = `<p style="text-align:center">⏳ Recherche de questions d'entraînement...</p>`;

  const { data, error } = await supabaseClient.functions.invoke('jeu-ia-questions', {
    body: { action: 'lister', champFormationId: config.champFormationId, palier, discipline },
  });

  // 24 septembre 2026 (septième lot) : plus de branche "accès premium
  // requis" ici — l'Entraînement IA est désormais gratuit (voir la note en
  // tête de fichier et la Edge Function jeu-ia-questions, dont la
  // vérification etat_acces_service a été retirée côté serveur). Un échec
  // reste toujours possible (réseau, Edge Function en panne) et reste géré
  // ci-dessous, sans distinction de cause particulière.
  if (error || data?.error) {
    corps.innerHTML = `<p>${echapper(data?.error || "Impossible de charger l'entraînement IA pour le moment.")}</p>
      <button type="button" class="jeu-btn-start" id="eiaBtnFermer" style="margin-top:12px">Fermer</button>`;
    document.getElementById('eiaBtnFermer').addEventListener('click', fermerEiaOverlay);
    return;
  }

  // { ...l.question, id: l.id } — écrase volontairement l'id interne du
  // JSON question (une chaîne générée à l'insertion côté admin, voir
  // construireQuestionDepuisIAQia dans js/pages/admin-questions-ia-jeux.js)
  // par l'id RÉEL de la ligne questions_ia_generees (l.id, numérique) :
  // jeuRendreChampQuestion/jeuLireReponseQuestion (js/jeux/rendu-questions-
  // jeu.js) ne se servent de q.id que comme jeton opaque pour leurs
  // sélecteurs DOM, donc l'écraser ici ne casse rien côté affichage — mais
  // c'est cet id qu'il faut renvoyer tel quel à l'action "corriger" de
  // jeu-ia-questions (questionId), qui l'utilise pour retrouver la ligne et
  // son corrigé en base. Sans cette réécriture, "corriger" recevait l'id
  // interne (non numérique) et échouait systématiquement.
  const questions = Array.isArray(data?.questions) ? data.questions.map(l => ({ ...l.question, id: l.id })) : [];
  if (!questions.length) {
    const p = JEU_PALIERS.find(x => x.code === palier);
    corps.innerHTML = `
      <h3 style="margin-top:0">🤖 Entraînement IA</h3>
      <p class="jeu-message-accueil">Aucune question inédite disponible pour l'instant au niveau ${p ? p.nom : palier} — reviens plus tard, ou choisis un autre niveau${config.avecCategorie ? '/une autre catégorie' : ''}.</p>
      <button type="button" class="jeu-btn-start" id="eiaBtnFermer" style="margin-top:12px">Fermer</button>`;
    document.getElementById('eiaBtnFermer').addEventListener('click', fermerEiaOverlay);
    return;
  }

  // Mélange l'ordre des questions à chaque lancement, pour ne pas toujours
  // débuter par les mêmes — purement cosmétique, aucun impact sur la notation
  // (il n'y en a pas ici).
  const ordre = questions.map((_, i) => i).sort(() => Math.random() - 0.5);
  const etatRonde = { index: 0, bonnes: 0, total: ordre.length };
  await eiaAfficherQuestion(jeu, corps, questions, ordre, etatRonde);
}

async function eiaAfficherQuestion(jeu, corps, questions, ordre, etatRonde) {
  const q = questions[ordre[etatRonde.index]];
  corps.innerHTML = `
    <h3 style="margin-top:0">🤖 Entraînement IA — Question ${etatRonde.index + 1}/${etatRonde.total}</h3>
    <div id="eiaZoneQuestion">${jeuRendreChampQuestion(q, 0, { masquerNumero: true })}</div>
    <div id="eiaFeedback" style="min-height:24px;margin-top:10px;font-weight:700"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
      <button type="button" class="jeu-btn-start" id="eiaBtnQuitter" style="background:#374151">Quitter</button>
      <button type="button" class="jeu-btn-start" id="eiaBtnValider">Valider</button>
    </div>`;
  jeuAttacherTousEcouteurs(document.getElementById('eiaZoneQuestion'));
  document.getElementById('eiaBtnQuitter').addEventListener('click', fermerEiaOverlay);

  const btnValider = document.getElementById('eiaBtnValider');
  btnValider.addEventListener('click', async () => {
    const reponse = jeuLireReponseQuestion(document.getElementById('eiaZoneQuestion'), q);
    btnValider.disabled = true;
    btnValider.textContent = '⏳...';

    const { data, error } = await supabaseClient.functions.invoke('jeu-ia-questions', {
      body: { action: 'corriger', questionId: q.id, reponse },
    });

    const feedback = document.getElementById('eiaFeedback');
    if (error || data?.error) {
      feedback.textContent = "Impossible de vérifier ta réponse pour l'instant.";
      feedback.style.color = '#f87171';
      btnValider.disabled = false;
      btnValider.textContent = 'Valider';
      return;
    }

    if (data.correct) {
      etatRonde.bonnes++;
      feedback.textContent = '✅ Bonne réponse !';
      feedback.style.color = '#4ade80';
      try { jouerSonReussite(); } catch (_e) { /* son optionnel */ }
    } else {
      feedback.textContent = '❌ Pas tout à fait — continue, ce n\'est qu\'un entraînement.';
      feedback.style.color = '#f87171';
      try { jouerSonEchec(); } catch (_e) { /* son optionnel */ }
    }

    btnValider.textContent = etatRonde.index + 1 < etatRonde.total ? 'Question suivante ➜' : 'Voir le bilan';
    btnValider.disabled = false;
    btnValider.onclick = async () => {
      etatRonde.index++;
      if (etatRonde.index < etatRonde.total) {
        await eiaAfficherQuestion(jeu, corps, questions, ordre, etatRonde);
      } else {
        eiaAfficherBilan(corps, jeu, etatRonde, questions, ordre);
      }
    };
  }, { once: true });
}

function eiaAfficherBilan(corps, jeu, etatRonde, questions, ordre) {
  corps.innerHTML = `
    <h3 style="margin-top:0">🤖 Bilan de l'entraînement IA</h3>
    <p style="font-size:16px">Tu as bien répondu à <strong>${etatRonde.bonnes}</strong> question${etatRonde.bonnes > 1 ? 's' : ''} sur ${etatRonde.total}.</p>
    <p style="font-size:13px;color:#a1a1c0">Cet entraînement est libre : il n'a aucun impact sur tes paliers, badges ou compétences.</p>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
      <button type="button" class="jeu-btn-start" id="eiaBtnFermerBilan" style="background:#374151">Fermer</button>
      <button type="button" class="jeu-btn-start" id="eiaBtnRejouer">🔄 Rejouer</button>
    </div>`;
  document.getElementById('eiaBtnFermerBilan').addEventListener('click', fermerEiaOverlay);
  document.getElementById('eiaBtnRejouer').addEventListener('click', () => {
    const nouvelOrdre = questions.map((_, i) => i).sort(() => Math.random() - 0.5);
    eiaAfficherQuestion(jeu, corps, questions, nouvelOrdre, { index: 0, bonnes: 0, total: nouvelOrdre.length });
  });
}
