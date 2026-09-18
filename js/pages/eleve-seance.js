// Page pages/eleve/seance.html
// Vue élève en lecture d'une séance publiée, sur le modèle "2 colonnes" :
// à gauche le support de cours (texte, règle, exemples...), à droite le
// travail à faire (exercice/quiz/évaluation à correction automatique, ou
// activité à rendre pour correction manuelle). Réutilise les utilitaires de
// js/editeur/blocs.js (infoType, teinteClaire, echapper...) volontairement
// partagés entre l'éditeur et la vue élève.
//
// Paliers d'agilité : un bloc (exercice/quiz/évaluation/activité) peut être
// tagué d'un palier (azovi/devi/ogan/axosu). Les blocs sans palier restent
// dans les 2 colonnes classiques ; les blocs avec palier sont regroupés dans
// une section dédiée en bas de page, débloqués progressivement (cf.
// etat_paliers_seance côté base — un palier se débloque quand le précédent a
// toutes ses activités réussies, sauf une au maximum).
//
// Essais multiples : l'élève peut refaire un exercice/activité autant de
// fois qu'il veut, mais seuls les essais 1 et 2 comptent pour la médaille
// (🥉/🥈/🥇/💎) — au-delà, c'est de l'entraînement libre.

let profilEleveSeance = null;
let seanceCourante = null;
let cheminSeance = null; // { classeNom, champNom, saTitre }
let blocsCourants = [];
let reponsesExistantes = {}; // bloc_id -> [lignes reponses_exercices] triées par numero_essai
let rendusActivitesExistants = {}; // bloc_id -> [lignes rendus_activites] triées par numero_essai
let etatAccesCorrectionIA = { autorise: false }; // service premium "correction_ia" (cf. consommer_usage_service en base)
let seanceDejaTerminee = false;
// [{palier, nb_taches_total, nb_taches_reussies, taux, tainted, reussi, deverrouille}]
// — vide si la séance n'utilise pas les paliers. Vient de etat_paliers_seance_v2
// (lot "Activité et Paliers", 11 septembre 2026) : raisonne en TÂCHES, pas en
// nombre de blocs — voir js/pages/eleve-seance.js#rendre / html_sectionPaliers.
let etatPaliersSeance = [];
let formulairesReouverts = new Set(); // bloc_id pour lesquels l'élève a cliqué "Refaire" (affiche un formulaire vierge malgré un essai existant)
// Masquage des activités (lot "Activité et Paliers") : par défaut, tous les
// blocs "à faire" (TYPES_TRAVAIL + sections Paliers) restent masqués tant que
// l'élève n'a pas cliqué sur "Passer aux activités" — sauf s'il a déjà
// commencé (au moins une réponse/rendu existant), auquel cas on ne re-masque
// jamais un travail déjà entamé. Remis à false à chaque chargement de séance
// (voir charger()) : le masquage est une mise en scène "on lit le cours
// d'abord", pas une préférence à mémoriser dans le temps.
let activitesDeverrouilleesManuel = false;
// État "consultation de correction" en cours par bloc (bloc_id -> {corrige, taintee})
// — rempli après un appel réussi à consulter_correction_exercice(), pour
// afficher la vraie bonne réponse (voir rendreResultatExercice) sans la
// re-demander en boucle au serveur.
let correctionsConsultees = {};
// Petit message de félicitations/encouragement affiché juste après une
// soumission (voir soumettreExercice) — bloc_id -> texte, effacé au
// prochain chargement de séance pour ne pas s'afficher indéfiniment.
let messagesApresEssai = {};
// Déverrouillage PROGRESSIF des questions, réservé aux blocs tagués d'un
// palier (le cahier des charges du 11 septembre 2026 ne demande la
// progression question par question QUE "pour chaque palier" — les
// exercices/quiz/évaluations hors palier gardent le formulaire classique
// à soumission unique). bloc_id -> { index, reponses } — `index` est la
// question actuellement affichée (validée en direct via l'action
// 'valider_tache', sans consommer d'essai ni de quota) ; une fois
// index >= nb questions, toutes les réponses collectées dans `reponses`
// sont soumises ensemble via soumettreExercice (essai réel, notation
// serveur qui recalcule tout — la validation en direct n'est qu'un guide
// pour l'élève, jamais la source de vérité). Remis à zéro à chaque
// chargement de séance et après chaque soumission réelle.
let progressionPalier = {};

// 11 septembre 2026 : 'exercice' retiré de la liste des blocs "travail" —
// c'est désormais un bloc de texte libre (lecture), voir rendreBlocLecture
// et le nouveau bloc 'correction' (masqué, révélé par un bouton) juste après.
// 'probleme' ajouté le même jour (remplacement v2 du bloc Problème) : en
// mode "élève" il devient un exercice interactif à rendre (comme "activité"),
// donc doit passer par la colonne "à faire" plutôt que la colonne lecture —
// voir rendreBlocTravail/rendreProbleme plus bas.
const TYPES_TRAVAIL = ['quiz', 'evaluation', 'activite', 'probleme'];
const LIBELLES_PALIER_ELEVE = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
// Couleurs "pleines" (fond dense) des sections Paliers, demandées le 5
// septembre 2026 pour remplacer le bandeau bleu unique — l'axosu est ici
// rouge (différent du violet utilisé ailleurs, ex. tableau de bord/jeux
// éducatifs, ce que le porteur du projet sait — cf. LISEZ-MOI).
const COULEURS_PALIER_ELEVE = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#9A3412', axosu: '#B91C1C' };
const LIBELLES_MEDAILLE = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or', diamant: '💎 Diamant' };
// Cette pastille est un simple repère de note (couleur calculée par
// calculer_medaille() côté base à partir du score du bloc, indépendamment de
// la validation du palier) — ce n'est PAS le "badge spécial" décerné à la
// validation d'un palier entier (≥ 66,7 %, voir js/pages/eleve-badges.js).
// On utilise donc ici les icônes carrées plates "badge_<couleur>" (assets/
// badges/badge-*.jpg, nomenclature du 11 septembre 2026) et JAMAIS les
// vraies coupes "trophee_<couleur>", réservées exclusivement au trophée
// d'excellence (≥ 90 %, 1er essai) pour ne pas laisser croire qu'une simple
// note de bloc vaut un trophée.
const IMAGE_MEDAILLE = { bronze: 'badge-bronze.jpg', argent: 'badge-argent.jpg', or: 'badge-or.jpg', diamant: 'badge-diamant.jpg' };

(async function () {
  profilEleveSeance = await requireRole('eleve');
  if (!profilEleveSeance) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilEleveSeance.id, badgeHtml: `🟢 ${echapper(profilEleveSeance.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await charger();
})();

// Remonte la chaîne parent_id d'un noeud (celui qui porte la SA de la
// séance) jusqu'à la racine, pour afficher l'arborescence complète dans le
// fil d'ariane (miniature) — quelle que soit la profondeur réelle de la
// matière (ex: Thème > Unité > Semaine pour le français, juste Dossier pour
// les maths). Retourne [{id, titre}] dans l'ordre racine → feuille (chaque
// niveau garde son id pour permettre de cliquer dessus — voir rendre() —
// et sauter directement à ce niveau sur pages/eleve/matiere.html).
async function remonterCheminNoeudsEleve(noeudDepart) {
  const chemin = [];
  let n = noeudDepart;
  let garde = 0; // filet de sécurité si une chaîne de parent_id bouclait par erreur
  while (n && garde++ < 20) {
    chemin.unshift({ id: n.id, titre: n.titre });
    if (!n.parent_id) break;
    const { data: parent } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, titre').eq('id', n.parent_id).single();
    n = parent;
  }
  return chemin;
}

async function charger() {
  const params = new URLSearchParams(window.location.search);
  const seanceId = parseInt(params.get('id'), 10);
  const conteneur = document.getElementById('contenu');
  if (!seanceId) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Séance introuvable.</p>';
    return;
  }

  const { data: seance, error: erreurSeance } = await supabaseClient
    .from('seances').select('*, sa(titre, noeud_id, noeuds_parcours(id, parent_id, titre, classe_id, champ_formation_id, classes(nom), champs_formation(nom)))').eq('id', seanceId).maybeSingle();
  if (erreurSeance || !seance) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Cette séance est introuvable ou n\'est pas (ou plus) publiée.</p>';
    return;
  }
  seanceCourante = seance;
  const noeud = seance.sa?.noeuds_parcours;
  cheminSeance = {
    classeNom: noeud?.classes?.nom || '',
    champId: noeud?.champ_formation_id || null,
    champNom: noeud?.champs_formation?.nom || '',
    // Arborescence complète (Thème/Unité/Semaine/Dossier...) remontée depuis
    // le noeud immédiat de la SA jusqu'à la racine — quel que soit le nombre
    // de niveaux, pour un fil d'ariane fidèle même quand la structure change
    // d'une matière à l'autre (voir remonterCheminNoeudsEleve ci-dessous).
    // Le dernier élément est le noeud qui porte directement la SA.
    cheminNoeuds: await remonterCheminNoeudsEleve(noeud),
    saTitre: seance.sa?.titre || ''
  };

  const { data: blocs, error: erreurBlocs } = await supabaseClient
    .from('blocs_seance').select('*').eq('seance_id', seanceId).order('ordre');
  if (erreurBlocs) {
    conteneur.innerHTML = `<p class="message-erreur-auth">Erreur : ${echapper(erreurBlocs.message)}</p>`;
    return;
  }
  // Un bloc "brouillon" (ex: un résumé IA pas encore relu par un admin) ne
  // doit jamais apparaître ici, même si la séance est déjà publiée — la RLS
  // le bloque déjà côté base, ce filtre est une seconde barrière côté client.
  blocsCourants = (blocs || []).filter(b => b.statut_bloc !== 'brouillon');

  // Depuis la refonte des Activités, un bloc "activite" est noté comme un
  // exercice (questions + corrigé) — on récupère donc aussi ses réponses
  // dans reponses_exercices. idsActivites (rendus_activites) reste nécessaire
  // en parallèle pour l'historique des anciennes activités (texte libre
  // corrigé à la main) créées avant cette refonte — voir rendreBlocTravail.
  const idsExercices = blocsCourants.filter(b => ['quiz', 'evaluation', 'activite'].includes(b.type_bloc)).map(b => b.id);
  // 'probleme' ajouté le 11 septembre 2026 (v2) : partage rendus_activites
  // avec 'activite' — même table, mêmes colonnes (voir js/editeur/blocs.js).
  const idsActivites = blocsCourants.filter(b => b.type_bloc === 'activite' || b.type_bloc === 'probleme').map(b => b.id);
  reponsesExistantes = {};
  rendusActivitesExistants = {};
  formulairesReouverts.clear();
  activitesDeverrouilleesManuel = false;
  correctionsConsultees = {};
  messagesApresEssai = {};
  progressionPalier = {};

  if (idsExercices.length) {
    const { data: reponses } = await supabaseClient
      .from('reponses_exercices').select('*').eq('eleve_id', profilEleveSeance.id).in('bloc_id', idsExercices).order('numero_essai');
    (reponses || []).forEach(r => { (reponsesExistantes[r.bloc_id] ??= []).push(r); });
    await rafraichirAccesCorrectionIA();
  }
  if (idsActivites.length) {
    const { data: rendus } = await supabaseClient
      .from('rendus_activites').select('*').eq('eleve_id', profilEleveSeance.id).in('bloc_id', idsActivites).order('numero_essai');
    (rendus || []).forEach(r => { (rendusActivitesExistants[r.bloc_id] ??= []).push(r); });
  }

  const { data: termine } = await supabaseClient
    .from('seances_terminees').select('id').eq('eleve_id', profilEleveSeance.id).eq('seance_id', seanceId).maybeSingle();
  seanceDejaTerminee = !!termine;

  const aDesPaliers = blocsCourants.some(b => b.palier);
  etatPaliersSeance = aDesPaliers
    ? (await supabaseClient.rpc('etat_paliers_seance_v2', { p_eleve_id: profilEleveSeance.id, p_seance_id: seanceId })).data || []
    : [];

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

// Un bloc "à faire" est déjà entamé s'il a au moins une réponse/rendu
// enregistré — dans ce cas on ne le remasque JAMAIS (le masquage sert à ne
// pas montrer le travail avant que l'élève ait choisi de commencer, pas à
// cacher un travail déjà en cours).
function blocDejaEntame(b) {
  return (reponsesExistantes[b.id] || []).length > 0 || (rendusActivitesExistants[b.id] || []).length > 0;
}

function rendre() {
  const tousBlocsTop = blocsCourants.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const blocsGeneraux = tousBlocsTop.filter(b => !b.palier);
  const blocsLecture = blocsGeneraux.filter(b => !TYPES_TRAVAIL.includes(b.type_bloc));
  const blocsTravail = blocsGeneraux.filter(b => TYPES_TRAVAIL.includes(b.type_bloc));

  const blocsParPalier = {};
  tousBlocsTop.filter(b => b.palier).forEach(b => { (blocsParPalier[b.palier] ??= []).push(b); });
  const aDesPaliers = etatPaliersSeance.some(p => p.nb_taches_total > 0);

  // Masquage "Passer aux activités" (lot Activité et Paliers, 11 septembre
  // 2026) : par défaut, tous les blocs à faire (généraux + paliers) restent
  // verrouillés/masqués tant que l'élève n'a pas cliqué sur le bouton dédié,
  // sauf s'il a déjà commencé au moins l'un d'entre eux (voir blocDejaEntame).
  const blocsATravaillerTous = [...blocsTravail, ...tousBlocsTop.filter(b => b.palier)];
  const activitesVisibles = activitesDeverrouilleesManuel || blocsATravaillerTous.length === 0 || blocsATravaillerTous.some(blocDejaEntame);

  // Arborescence complète dans la miniature (fil d'ariane), suivie du
  // badge de discipline puis du titre de la séance en grand (titre_contenu
  // si renseigné par l'admin, sinon le titre brut — la discipline seule,
  // utilisée du 4 au 5 septembre 2026, rendait indiscernables deux séances
  // d'une même discipline ; elle reste affichée, mais désormais en badge
  // AVANT le titre plutôt qu'en petit texte gris après, retour du
  // 5 septembre 2026). Chaque niveau (sauf le dernier) est cliquable et
  // ramène directement à ce niveau sur pages/eleve/matiere.html — voir
  // js/pages/eleve-matiere.js.
  const segmentsArbo = [];
  if (cheminSeance.classeNom) segmentsArbo.push({ label: cheminSeance.classeNom });
  if (cheminSeance.champNom) segmentsArbo.push({ label: cheminSeance.champNom, href: cheminSeance.champId ? `matiere.html?champId=${cheminSeance.champId}` : null });
  (cheminSeance.cheminNoeuds || []).forEach(n => segmentsArbo.push({
    label: n.titre, href: cheminSeance.champId ? `matiere.html?champId=${cheminSeance.champId}&noeudId=${n.id}` : null
  }));
  segmentsArbo.push({ label: seanceCourante.discipline || seanceCourante.titre_contenu || seanceCourante.titre }); // niveau actuel — pas de lien

  const filAriane = segmentsArbo.map((s, i) => {
    const dernier = i === segmentsArbo.length - 1;
    const texte = echapper(s.label);
    return (s.href && !dernier) ? `<a href="${s.href}">${texte}</a>` : `<span>${texte}</span>`;
  }).join(' <span class="sep-arbo-eleve">›</span> ');

  const boutonMarquerTermine = (blocsTravail.length === 0 && !aDesPaliers)
    ? (seanceDejaTerminee
        ? `<p class="bouton-marquer-termine" style="color:#22A559;font-weight:700">✅ Séance terminée</p>`
        : `<button class="btn btn-filled bouton-marquer-termine" id="btnMarquerTermine">✅ J'ai terminé cette séance</button>`)
    : '';

  // Quand cette séance n'a aucun exercice "général" (hors paliers) à afficher
  // dans la colonne de droite, cette colonne resterait vide (ou ne contient
  // qu'un message "Aucun exercice ni activité") alors que la grille réserve
  // quand même la moitié de la largeur pour elle — ce qui rétrécit la
  // colonne de lecture, et rend la mise en page bancale, par rapport à la
  // section "Paliers" plus bas (qui, elle, prend toute la largeur). On
  // repasse alors sur une seule colonne pleine largeur pour que tout
  // s'aligne au même niveau. Avant le 11 septembre 2026, ce repli ne se
  // déclenchait pas quand la séance n'avait NI palier NI exercice général
  // (cas exact d'une séance "sans activité") — c'était précisément la
  // séance qui "s'affiche mal" signalée : colonne de droite orpheline,
  // réduisant la colonne de lecture de moitié pour un simple message.
  const colonneExerciceVide = blocsTravail.length === 0;

  // Bouton "Passer aux activités" (masquage par défaut) : tant qu'il n'a pas
  // été cliqué (et qu'au moins un bloc à faire existe), on n'affiche ni la
  // colonne exercices ni la section Paliers — juste ce bouton, sous la
  // lecture. Une fois cliqué, activitesDeverrouilleesManuel reste vrai pour
  // le reste de la visite (jusqu'au prochain chargement de la page).
  const htmlColonneExercice = !activitesVisibles
    ? `<div class="bloc-lecture" style="border-left-color:#94A3B8;text-align:center">
        <p style="color:var(--text-gris);margin:0 0 10px">Les exercices et activités de cette séance sont prêts.</p>
        <button type="button" class="btn btn-filled" id="btnPasserAuxActivites">▶️ Passer aux activités</button>
      </div>`
    : (blocsTravail.length ? blocsTravail.map(rendreBlocTravail).join('') : '<div class="bloc-lecture" style="border-left-color:#94A3B8"><p style="color:var(--text-gris);margin:0">Aucun exercice ni activité pour cette séance — profite bien de la lecture !</p></div>');

  document.getElementById('contenu').innerHTML = `
    <div class="fil-ariane-eleve"><a href="matiere.html">← Retour à mes matières</a></div>
    <div class="entete-seance-eleve">
      <p style="margin:0" class="miniature-arborescence-eleve">${filAriane}</p>
      ${seanceCourante.discipline ? `<span class="badge-discipline-seance">${echapper(seanceCourante.discipline)}</span>` : ''}
      <h1 class="titre-seance-eleve">${echapper(seanceCourante.titre_contenu || seanceCourante.titre)}</h1>
    </div>

    <div class="zone-travail-seance"${colonneExerciceVide ? ' style="grid-template-columns:1fr"' : ''}>
      <div class="colonne-lecture-seance">
        ${blocsLecture.length ? blocsLecture.map(b => rendreBlocLecture(b)).join('') : '<p style="color:var(--text-gris)">Aucun support de cours pour cette séance.</p>'}
        ${boutonMarquerTermine}
      </div>
      ${(blocsTravail.length === 0 && !activitesVisibles && aDesPaliers) ? '' : `<div class="colonne-exercice-seance">${htmlColonneExercice}</div>`}
    </div>

    ${(!activitesVisibles && blocsTravail.length === 0 && aDesPaliers) ? `<div style="margin-top:24px">${htmlColonneExercice}</div>` : ''}
    ${(aDesPaliers && activitesVisibles) ? html_sectionPaliers(blocsParPalier) : ''}
  `;

  const btnPasser = document.getElementById('btnPasserAuxActivites');
  if (btnPasser) btnPasser.addEventListener('click', () => { activitesDeverrouilleesManuel = true; rendre(); });

  attacherEcouteursExercices();
  attacherEcouteursActivites();
  attacherEcouteursProblemes();
  attacherEcouteursRefaire();
  attacherEcouteursRepriseRates();
  attacherEcouteursCorrections();
  const btnMarquerTermine = document.getElementById('btnMarquerTermine');
  if (btnMarquerTermine) btnMarquerTermine.addEventListener('click', async () => {
    btnMarquerTermine.disabled = true;
    const { error } = await supabaseClient.from('seances_terminees')
      .insert({ eleve_id: profilEleveSeance.id, seance_id: seanceCourante.id });
    if (error && error.code !== '23505') { alert(error.message); btnMarquerTermine.disabled = false; return; }
    btnMarquerTermine.textContent = '✅ Séance terminée !';
  });
}

function html_sectionPaliers(blocsParPalier) {
  return `
    <div class="section-title-eleve" style="margin-top:24px">🎯 Paliers de cette séance</div>
    ${etatPaliersSeance.filter(p => p.nb_taches_total > 0).map(p => {
      const libelle = LIBELLES_PALIER_ELEVE[p.palier] || p.palier;
      const blocs = (blocsParPalier[p.palier] || []).sort((a, b) => a.ordre - b.ordre);
      if (!p.deverrouille) {
        return `<div class="bloc-lecture" style="border-left-color:#94A3B8;opacity:.7;margin-top:14px">
          <div class="bloc-lecture-titre">🔒 ${libelle} — ${p.nb_taches_total} tâche${p.nb_taches_total > 1 ? 's' : ''}</div>
          <p style="margin:0;color:var(--text-gris);font-size:13px">Termine d'abord le palier précédent (au moins 66,7% des tâches réussies) pour débloquer celui-ci.</p>
        </div>`;
      }
      const couleurPalier = COULEURS_PALIER_ELEVE[p.palier] || 'var(--bleu-kekeli)';
      // Chaque palier affiche, EN HAUT de sa section, le nombre total de
      // tâches à mener (demande explicite du cahier des charges) suivi du
      // taux déjà obtenu — pas le nombre de blocs/questions, qui n'est plus
      // l'unité de calcul depuis ce lot (voir etat_paliers_seance_v2 côté
      // base : une question peut valoir plusieurs tâches).
      const etatTexte = p.reussi
        ? `✅ Réussi — ${p.nb_taches_reussies}/${p.nb_taches_total} tâche${p.nb_taches_total > 1 ? 's' : ''} (${p.taux}%)`
        : `${p.nb_taches_reussies}/${p.nb_taches_total} tâche${p.nb_taches_total > 1 ? 's' : ''} réussie${p.nb_taches_reussies > 1 ? 's' : ''}${p.taux != null ? ` (${p.taux}%)` : ''}`;
      // La couleur du palier ne colore QUE la section (bordure + titre), pas
      // un fond plein — retour du 5 septembre 2026 (7e lot), sur demande
      // explicite : "Pour les palier la couleur doit être uniquement pour
      // la section. Tout ce qui vient s'ajouter comme activité doit avoir
      // sa propre background". Chaque activité à l'intérieur garde donc son
      // propre encadré/fond (rendreBlocTravail/rendreBlocLecture, inchangés).
      return `<div class="bloc-lecture carte-palier-eleve" style="border-left-color:${couleurPalier};background:${teinteClaire(couleurPalier, 0.04)};margin-top:14px">
        <div class="bloc-lecture-titre" style="color:${couleurPalier}">${libelle} — ${etatTexte}</div>
        ${p.tainted ? `<p style="margin:0 0 10px;color:#92620A;font-size:13px">⚠️ La correction a été consultée avant une réussite à 100% — ce palier ne peut plus être validé, mais tu peux continuer à t'entraîner.</p>` : ''}
        ${blocs.map(b => TYPES_TRAVAIL.includes(b.type_bloc) ? rendreBlocTravail(b) : rendreBlocLecture(b)).join('')}
      </div>`;
    }).join('')}
  `;
}

function rendreBlocTravail(b) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  // Bordure/texte : var(--bleu-kekeli) plutôt que le bleu figé, pour qu'un
  // bloc sans couleur propre suive automatiquement le thème rose des élèves
  // filles (demande explicite du 5 septembre 2026, 7e lot : "bordure rose
  // pour les filles et bleu pour les garçons") — même mécanisme déjà en
  // place ailleurs sur le site (voir "Thème rose pour les élèves filles").
  // Le calcul de la teinte de fond (`couleurFond`), lui, reste sur la valeur
  // hexadécimale : `teinteClaire()` ne sait pas interpréter une variable CSS.
  const couleur = c.couleurBloc || info.couleur || 'var(--bleu-kekeli)';
  const couleurFond = c.couleurBloc || info.couleur || '#0000D1';
  const libelle = c.libelle || info.label;
  // Un bloc "activite" créé AVANT la refonte des Activités (texte libre,
  // corrigé à la main par un enseignant) continue de s'afficher via
  // rendreActivite tant qu'il a déjà un rendu dans rendus_activites — ça
  // évite de faire disparaître un travail déjà rendu/corrigé. Toute NOUVELLE
  // activité (pas encore de rendu legacy) passe par le parcours structuré
  // (questions + corrigé auto), comme un exercice/quiz/évaluation.
  const aRenduLegacy = b.type_bloc === 'activite' && (rendusActivitesExistants[b.id] || []).length > 0;
  const corps = b.type_bloc === 'probleme' ? rendreProbleme(b, c) : (aRenduLegacy ? rendreActivite(b, c) : rendreExercice(b, c));
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">
    <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
    ${corps}
  </div>`;
}

function rendreBlocLecture(b, estEnfant = false) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  // Même principe que rendreBlocTravail ci-dessus (bordure/texte theme-aware,
  // teinte de fond sur la valeur hex).
  const couleur = c.couleurBloc || info.couleur || 'var(--bleu-kekeli)';
  const couleurFond = c.couleurBloc || info.couleur || '#0000D1';
  // Le bloc "Contenu" (valeur interne 'titre') est masqué à l'élève par
  // défaut — voir le même choix dans js/pages/editeur-seance.js (htmlBloc,
  // rendreBlocApercu) et la case "Titre visible" de l'éditeur.
  const afficherTitre = typeof c.afficherTitre === 'boolean' ? c.afficherTitre : b.type_bloc !== 'titre';
  const libelle = c.libelle || info.label;
  let corps = '';

  // Bloc "Correction" (11 septembre 2026) : pensé pour suivre un bloc
  // Exercice libre — contenu masqué par défaut, révélé par l'élève via un
  // bouton (décision prise avec le porteur du projet), sur le même principe
  // que "👁️ Voir le contenu" déjà utilisé ailleurs sur le site (ex.
  // js/pages/seances.js) : simple bascule de l'attribut `hidden`, pas de
  // rechargement réseau puisque le contenu est déjà dans le bloc.
  if (b.type_bloc === 'correction') {
    corps = `
      <button type="button" class="btn btn-discret" data-bouton-correction="${b.id}">🔓 Voir la correction</button>
      <div class="contenu-riche-lecture" data-zone-correction="${b.id}" hidden>${contenuRicheInitial(c.texte)}</div>`;
  }
  // Bloc "Exercice" en mode HTML brut (11 septembre 2026) — même cadre isolé
  // (iframe sandbox) que le bloc "HTML libre", voir html_editeurExerciceLibre
  // dans js/editeur/blocs.js et html_blocHtmlLibre plus bas dans ce fichier.
  else if (b.type_bloc === 'exercice' && c.htmlBrut) corps = html_blocHtmlLibre(c.code, libelle);
  else if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div class="contenu-riche-lecture">${contenuRicheInitial(c.texte)}</div>`;
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
  else if (b.type_bloc === 'html_libre') corps = html_blocHtmlLibre(c.code, libelle);
  else if (b.type_bloc === 'probleme') corps = html_lectureProbleme(c);
  else corps = `<p>${echapper(c.consigne || c.texte || '')}</p>`;

  const enfants = blocsCourants.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
  const contenuInterieur = `
    ${afficherTitre ? `<div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>` : ''}
    ${corps}
    ${enfants.length ? `<div style="margin-top:10px">${enfants.filter(x => !TYPES_TRAVAIL.includes(x.type_bloc)).map(x => rendreBlocLecture(x, true)).join('')}</div>` : ''}
  `;
  // Un bloc rattaché à une section (Titre/Consigne) n'a pas sa propre carte :
  // il s'affiche dans le prolongement direct du contenu parent, parfaitement
  // aligné avec lui (pas de fond, pas de bordure, pas de padding qui décale).
  if (estEnfant) return contenuInterieur;
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">${contenuInterieur}</div>`;
}

function libelleMedaille(medaille, numeroEssai) {
  if (!medaille || numeroEssai > 2) return '';
  const marque = numeroEssai === 2 ? ' <span style="font-size:11px;opacity:.75">· 2ᵉ essai</span>' : '';
  const image = IMAGE_MEDAILLE[medaille]
    ? `<img src="${RACINE_SITE}assets/badges/${IMAGE_MEDAILLE[medaille]}" alt="" width="16" height="16" style="display:inline-block;vertical-align:middle;object-fit:contain;margin-right:3px">` : '';
  return ` <span class="badge-palier-seance" style="background:#FEF3C7;color:#92620A">${image}${LIBELLES_MEDAILLE[medaille]}${marque}</span>`;
}

// 18 septembre 2026 (2e lot) : "A la réussite d'un palier à 100% présente le
// trophée complet animé à l'écran avant que l'enfant poursuive" — overlay
// plein écran ajouté directement à document.body (PAS à #contenu, que le
// prochain rendre() réécrit intégralement) : il survit donc au rendu du
// résultat qui suit immédiatement dans soumettreExercice(), et ne se ferme
// que par un geste explicite de l'enfant ("Continuer"). Réutilise la médaille
// déjà existante de ce palier (assets/badges/medaille-<palier>.jpg, voir
// aussi pages/eleve/badges.html) — aucun nouvel asset, juste une animation
// CSS (agrandissement + brillance + confettis, voir css/style-public.css).
function afficherTropheePalierPleinEcran(palier) {
  const ancien = document.getElementById('overlayTropheePalier');
  if (ancien) ancien.remove();
  const libelle = LIBELLES_PALIER_ELEVE[palier] || palier;
  const overlay = document.createElement('div');
  overlay.id = 'overlayTropheePalier';
  overlay.className = 'overlay-trophee-palier';
  const confettis = Array.from({ length: 9 }, () => '🎉').concat(['🎊', '✨']).map(e => `<span>${e}</span>`).join('');
  overlay.innerHTML = `
    <div class="carte-trophee-palier">
      <div class="confettis-trophee" aria-hidden="true">${confettis}</div>
      <img src="${RACINE_SITE}assets/badges/medaille-${palier}.jpg" alt="" class="image-trophee-palier">
      <p class="titre-trophee-palier">🏆 Palier réussi à 100 % !</p>
      <p class="sous-titre-trophee-palier">${echapper(libelle)}</p>
      <button type="button" class="btn btn-filled" id="btnFermerTropheePalier">Continuer</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('btnFermerTropheePalier').addEventListener('click', () => overlay.remove());
}

function rendreExercice(b, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  const essais = reponsesExistantes[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (!questions.length) {
    return `${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant — reviens plus tard.</p>`;
  }

  if (dernier && !formulairesReouverts.has(b.id)) return rendreResultatExercice(b, c, questions, dernier);

  if (!etatAccesCorrectionIA.autorise) {
    return `
      ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
      <div class="acces-suspendu-exercice">
        🔒 La correction automatique des exercices est un service premium. Tu as utilisé tous tes essais gratuits — demande à un adulte de contacter l'administration pour souscrire (abonnement ou forfait).
      </div>
    `;
  }

  const noteEssai = etatAccesCorrectionIA.source === 'essai_gratuit'
    ? `<p class="note-essai-gratuit">🎁 Essai gratuit — il te reste ${etatAccesCorrectionIA.essais_restants} correction${etatAccesCorrectionIA.essais_restants > 1 ? 's' : ''} offerte${etatAccesCorrectionIA.essais_restants > 1 ? 's' : ''} après celle-ci.</p>`
    : '';

  // Progression question par question — réservée aux blocs tagués d'un
  // palier (cahier des charges du 11 septembre 2026 : "Pour chaque palier
  // les question seront abordées progressivement"). Les exercices/quiz/
  // évaluations SANS palier gardent le formulaire classique ci-dessous.
  if (b.palier) return rendreExerciceProgressif(b, c, questions, essais.length, noteEssai);

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    ${noteEssai}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-exercice="${b.id}">
      ${questions.map((q, i) => rendreChampQuestion(q, i)).join('')}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">✅ Valider mes réponses</button>
    </form>
  `;
}

// Formulaire "progressif" d'un palier : une seule question affichée à la
// fois. Chaque question est vérifiée en direct (action 'valider_tache' de
// l'Edge Function corriger-exercice — aucun essai consommé, aucun quota
// Premium débité, aucune écriture en base) : un son + un petit message
// accompagne systématiquement la validation ou le rejet (cahier des
// charges : "chaque validation ou rejet doit être accompagné d'un son"),
// et la question suivante ne se déverrouille qu'une fois la précédente
// validée ("tant que la précédente n'est pas validée, la suivante n'est
// pas activée"). Une fois toutes les questions travaillées, un dernier
// bouton soumet l'ensemble des réponses collectées à la VRAIE correction
// (soumettreExercice ci-dessous) — c'est cette soumission-là, jamais la
// validation en direct, qui consomme un essai et déclenche paliers/badges.
function rendreExerciceProgressif(b, c, questions, nbEssaisPrecedents, noteEssai) {
  const etat = (progressionPalier[b.id] ??= { index: 0, reponses: {} });
  // 18 septembre 2026 (2e lot) : "Quand il valide un panier il a la
  // possibilité de reprendre uniquement les tâches ratées" — etat.sousListe,
  // posé par demarrerRepriseTachesRatees() ci-dessous, restreint ce même
  // moteur de progression aux seules questions ratées du dernier essai ; la
  // soumission finale (data-soumettre-palier) fusionne ces réponses avec
  // celles déjà correctes (etat.reponsesBase) — voir attacherEcouteursExercices.
  const listeActive = etat.sousListe || questions;
  const enReprise = !!etat.sousListe;
  const toutesValidees = etat.index >= listeActive.length;
  const enTete = enReprise
    ? `<p style="font-size:12px;color:var(--text-gris)">🔁 Reprise des tâches ratées — ${!toutesValidees ? `question ${etat.index + 1}/${listeActive.length}` : 'terminé'}</p>`
    : `<p style="font-size:12px;color:var(--text-gris)">${nbEssaisPrecedents ? `Nouvel essai (n°${nbEssaisPrecedents + 1})` : ''}${(!toutesValidees && nbEssaisPrecedents) ? ' — ' : ''}${!toutesValidees ? `Question ${etat.index + 1}/${listeActive.length}` : ''}</p>`;

  if (toutesValidees) {
    return `
      ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
      ${noteEssai}
      ${enTete}
      <p style="color:#22A559;font-weight:700;margin:0 0 10px">✅ Toutes les questions ont été travaillées !</p>
      <button type="button" class="btn btn-filled bouton-valider-exercice" data-soumettre-palier="${b.id}">📤 Valider tout le palier</button>
    `;
  }

  const q = listeActive[etat.index];
  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    ${noteEssai}
    ${enTete}
    <div data-progression-question="${b.id}">
      ${rendreChampQuestion(q, etat.index)}
      <div data-feedback-tache="${b.id}" class="feedback-tache-progressive" hidden></div>
      <button type="button" class="btn btn-filled bouton-valider-exercice" data-valider-tache="${b.id}">✅ Valider cette réponse</button>
    </div>
  `;
}

// 18 septembre 2026 (2e lot) : démarre une reprise ciblée sur les seules
// questions ratées au DERNIER essai (details_taches, déjà écrit par
// corriger-exercice) — les réponses déjà correctes de ce dernier essai sont
// conservées telles quelles (etat.reponsesBase) et fusionnées à la
// soumission finale, qui compte comme un essai normal (numeroEssai
// s'incrémente dans soumettreExercice, comme n'importe quelle soumission —
// décision explicite du porteur du projet : "compte comme un essai normal").
function demarrerRepriseTachesRatees(blocId) {
  const bloc = blocsCourants.find(x => x.id === blocId);
  const questions = Array.isArray(bloc?.contenu?.questions) ? bloc.contenu.questions : [];
  const essais = reponsesExistantes[blocId] || [];
  const dernier = essais[essais.length - 1];
  if (!dernier) return;
  const details = dernier.details_taches || dernier.details || {};
  const reponsesDonnees = dernier.reponses || {};
  const questionsRatees = questions.filter(q => {
    const d = details[q.id] || {};
    const tachesTotal = typeof d.tachesTotal === 'number' ? d.tachesTotal : 1;
    const tachesReussies = typeof d.tachesReussies === 'number' ? d.tachesReussies : (d.correct ? 1 : 0);
    return tachesReussies < tachesTotal;
  });
  if (!questionsRatees.length) return;
  const reponsesBase = { ...reponsesDonnees };
  questionsRatees.forEach(q => { delete reponsesBase[q.id]; });
  progressionPalier[blocId] = { index: 0, reponses: {}, sousListe: questionsRatees, reponsesBase };
  formulairesReouverts.add(blocId);
  rendre();
}

function attacherEcouteursRepriseRates() {
  document.querySelectorAll('[data-reprendre-rates]').forEach(btn => {
    btn.addEventListener('click', () => demarrerRepriseTachesRatees(parseInt(btn.dataset.reprendreRates, 10)));
  });
}

// Une "activité" n'a pas de correction automatique : l'élève rend un texte
// (et/ou un lien de pièce jointe), un enseignant/admin corrige ensuite à la
// main (note et/ou appréciation) — voir js/pages/activites-correction.js.
function rendreActivite(b, c) {
  const essais = rendusActivitesExistants[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (dernier && !formulairesReouverts.has(b.id)) {
    if (dernier.corrige_le) {
      return `
        ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
        <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}/${dernier.bareme}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${libelleMedaille(dernier.medaille, dernier.numero_essai)}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire="${b.id}" data-type-refaire="activite" style="margin-top:10px">🔄 Refaire cette activité</button>`;
    }
    return `
      ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
      <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-activite="${b.id}" class="activite-lecture">
      <textarea name="reponse" required placeholder="Écris ta réponse ici..."></textarea>
      <input type="url" name="piece_jointe" placeholder="Lien vers une pièce jointe (optionnel)">
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
}

// Bloc "Problème" v2 (11 septembre 2026, remplacement) — même mécanisme que
// "activité" ci-dessus (rendus_activites, correction manuelle par un
// enseignant/admin), mais avec un formulaire de grille de calcul posé
// (voir html_formulaireProbleme/html_relectureProbleme dans js/editeur/blocs.js)
// au lieu d'un simple textarea. modeAffichage='corrige' reste un exemple
// entièrement résolu, en LECTURE SEULE, jamais soumissible (l'enseignant l'a
// choisi comme support de cours plutôt que comme exercice à rendre).
function rendreProbleme(b, c) {
  if ((c.modeAffichage || 'eleve') === 'corrige') return html_lectureProbleme(c, b.id);

  const essais = rendusActivitesExistants[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (dernier && !formulairesReouverts.has(b.id)) {
    const reponseLignes = lireReponseProbleme(dernier.reponse_texte);
    if (dernier.corrige_le) {
      return `
        ${html_relectureProbleme(c, reponseLignes)}
        <div class="carte-note-activite">
          ✅ Corrigé${dernier.note != null ? ` — <strong>${dernier.note}/${dernier.bareme}</strong>` : ''}
          ${dernier.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[dernier.appreciation]}` : ''}
          ${libelleMedaille(dernier.medaille, dernier.numero_essai)}
          ${dernier.commentaire ? `<p style="margin:6px 0 0">💬 ${echapper(dernier.commentaire)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-discret" data-refaire="${b.id}" data-type-refaire="probleme" style="margin-top:10px">🔄 Refaire ce problème</button>`;
    }
    return `
      ${html_relectureProbleme(c, reponseLignes)}
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-probleme="${b.id}" data-nb-lignes-probleme="${(Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : []).length}">
      ${html_formulaireProbleme(b, c)}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
}

// Énoncé affiché à l'élève : les types "plats" (voir TYPES_ENONCE_PLAT dans
// js/editeur/blocs.js, chargé avant ce fichier) restent en texte brut échappé
// (ils sont parsés littéralement — "___" ou tokenisation par mot), tous les
// autres types profitent du contenu riche saisi par l'enseignant (gras,
// italique, listes, couleurs...), avec le même filet de sécurité que côté
// éditeur pour l'ancien contenu sans HTML (contenuRicheInitial).
function rendreEnonce(q) {
  if (TYPES_ENONCE_PLAT.includes(q.type)) return echapper(q.enonce);
  return contenuRicheInitial(q.enonce);
}

function rendreChampQuestion(q, i) {
  // Texte à trous : les champs de saisie sont intégrés directement dans
  // l'énoncé (à la place de chaque "___"), pas dans un bloc "champ" séparé.
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
  // Glisser-déposer : mêmes "___" que le texte à trous, mais chaque trou est
  // une zone de dépôt (drag & drop natif + solution de repli tactile
  // "toucher le mot puis toucher le trou", câblée dans
  // attacherEcouteursTrousGlisser ci-dessous) au lieu d'un champ de saisie
  // libre — voir js/editeur/blocs.js pour le modèle de données (q.banqueMots).
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
  // Sélection de mots dans un texte : l'énoncé est tokenisé en mots cliquables
  // (tokeniserMots, identique à l'éditeur pour que les index correspondent) ;
  // l'élève touche les mots qu'il juge corrects.
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
  // Intrus lexical : plusieurs séries de mots, l'élève choisit l'intrus de
  // chaque série (bouton radio). La bonne réponse n'est jamais dans q.series
  // (voir js/editeur/blocs.js) — uniquement dans le corrigé privé côté serveur.
  if (q.type === 'intrus_lexical') {
    const series = Array.isArray(q.series) ? q.series : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
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
      <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
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
      <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
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
      <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
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
      <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
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
  return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
}

// Boutons ▲▼ d'une liste "remise en ordre" : déplace le <li> dans le DOM
// (l'ordre du DOM EST la réponse, lue au moment de la soumission — voir
// attacherEcouteursExercices ci-dessous).
function attacherEcouteursListesOrdre(racine = document) {
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

// Sélection de mots dans un texte : simple bascule visuelle par clic/toucher,
// la classe "selectionne" est relue directement à la soumission (voir
// attacherEcouteursExercices ci-dessous) — pas d'état JS séparé à maintenir.
function attacherEcouteursSelectionMots(racine = document) {
  racine.querySelectorAll('.mots-selectionnables-lecture .chip-mot-choix').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
  });
}

// Glisser-déposer les mots dans le texte : drag & drop HTML5 natif, ET une
// solution de repli tactile "toucher un mot pour l'armer, puis toucher un
// trou pour l'y déposer" — le drag natif est peu fiable sur les tablettes
// probablement utilisées à l'école primaire. Le mot placé est stocké dans
// data-mot-place sur la zone de trou, relu tel quel à la soumission.
function attacherEcouteursTrousGlisser(racine = document) {
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
      // Si ce trou contenait déjà un mot, on le remet dans la banque.
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
// score_max) — demandé le 04/09/2026 : jusque-là, seul le pourcentage
// (score/score_max) était affiché ; le devoir dans son ensemble avait bien
// une note/20 (moyenne des pourcentages de tous ses blocs, voir
// js/devoirs-notes-rendu.js), mais pas chaque activité individuellement.
// Même formule que l'agrégat devoir, appliquée à un seul résultat : pas de
// moyenne ici, juste ce pourcentage-là ramené sur 20.
function noteSur20DepuisScore(score, scoreMax) {
  if (!scoreMax || !Number.isFinite(score) || !Number.isFinite(scoreMax)) return null;
  return Math.round((score / scoreMax) * 20 * 10) / 10;
}

// Bonne réponse "lisible" d'une question, pour l'affichage de la correction
// (consulter_correction_exercice — voir attacherEcouteursCorrections) une
// fois celle-ci autorisée (3e essai, ou 100% dès le 1er/2e essai). Miroir
// de la lecture de la réponse ÉLÈVE ci-dessous, mais à partir du corrigé
// (c.bonneReponse) plutôt que de reponsesDonnees.
function texteBonneReponse(q, cq) {
  if (!cq) return '';
  const br = cq.bonneReponse;
  if (q.type === 'qcm') return (q.options || [])[Number(br)] ?? String(br ?? '');
  if (q.type === 'vrai_faux') return (br === true || br === 'true') ? 'Vrai' : 'Faux';
  if (q.type === 'reponse_courte') return Array.isArray(br) ? br.join(' / ') : String(br ?? '');
  if (q.type === 'reponse_numerique') {
    const attendu = (br && typeof br === 'object') ? br : {};
    return `${attendu.valeur ?? ''}${attendu.tolerance ? ` (± ${attendu.tolerance})` : ''}`;
  }
  if (q.type === 'texte_a_trous' || q.type === 'texte_a_trous_glisser') {
    return Array.isArray(br) ? br.map(v => Array.isArray(v) ? v[0] : v).join(' / ') : '';
  }
  if (q.type === 'remise_en_ordre') return Array.isArray(br) ? br.map(v => (q.options || [])[v] ?? v).join(' → ') : '';
  if (q.type === 'association') return Array.isArray(br) ? br.map((v, i) => `${(q.gauche || [])[i] ?? ''} → ${(q.droite || [])[v] ?? v}`).join(' ; ') : '';
  if (q.type === 'classement') return Array.isArray(br) ? br.map((v, i) => `${(q.motsAClasser || [])[i] ?? ''} → ${(q.categories || [])[v] ?? v}`).join(' ; ') : '';
  if (q.type === 'intrus_lexical') return Array.isArray(br) ? br.map((v, i) => (q.series?.[i]?.mots || [])[v] ?? v).join(' ; ') : '';
  if (q.type === 'qcm_multiple') return Array.isArray(br) ? br.map(v => (q.options || [])[v] ?? v).join(', ') : '';
  if (q.type === 'selection_mots') {
    const mots = tokeniserMots(q.enonce || '');
    return Array.isArray(br) ? br.map(v => mots[Number(v)]).filter(Boolean).join(', ') : '';
  }
  return cq.bareme ? `Barème : ${cq.bareme}` : '';
}

function rendreResultatExercice(b, c, questions, reponse) {
  const details = reponse.details_taches || reponse.details || {};
  const reponsesDonnees = reponse.reponses || {};
  const enAttente = reponse.statut === 'en_attente_ia';
  const nbTaches = reponse.nb_taches ?? reponse.score_max;
  const nbTachesReussies = reponse.nb_taches_reussies ?? reponse.score;
  // La note/20 reste réservée au 1er essai (cahier des charges : "La note
  // sur 20 sera octroyée automatiquement ... seulement au premier essai") —
  // aux essais suivants, seul le badge "réussi ✅" compte, jamais de note.
  const note20 = (enAttente || reponse.numero_essai !== 1) ? null : noteSur20DepuisScore(nbTachesReussies, nbTaches);
  const message = messagesApresEssai[b.id];
  const correctionInfo = correctionsConsultees[b.id];
  // Correction consultable : au 3e essai (dernier essai possible), ou plus
  // tôt si l'élève a déjà tout réussi (cahier des charges : "Les réponses
  // ne seront accessibles qu'au 3e essai à moins pour celui qui a validé à
  // 100% et veut consulter avant de progresser").
  const peutVoirCorrection = !enAttente && (reponse.numero_essai >= 3 || (nbTaches > 0 && nbTachesReussies === nbTaches));
  // 18 septembre 2026 (2e lot) : "reprendre uniquement les tâches ratées" —
  // réservé aux blocs de palier (mode progressif), tant qu'il reste au moins
  // une tâche ratée à ce dernier essai.
  const peutReprendreRates = !enAttente && !!b.palier && nbTaches > 0 && nbTachesReussies < nbTaches;

  return `
    ${c.consigne ? `<div class="contenu-riche-lecture">${contenuRicheInitial(c.consigne)}</div>` : ''}
    ${message ? `<p class="message-apres-essai">${echapper(message)}</p>` : ''}
    <div class="recap-score">${enAttente ? '⏳ En cours de correction par un enseignant' : `📊 ${nbTachesReussies}/${nbTaches} tâche${nbTaches > 1 ? 's' : ''} réussie${nbTachesReussies > 1 ? 's' : ''}${note20 !== null ? ` — note : ${note20}/20` : ''}`}${libelleMedaille(reponse.medaille, reponse.numero_essai)}</div>
    ${questions.map((q, i) => {
      const d = details[q.id] || {};
      // Une question peut valoir plusieurs TÂCHES (texte à trous, association,
      // classement...) — voir evaluerTaches côté Edge Function : on affiche
      // alors le nombre de tâches réussies SUR cette question précise, sans
      // jamais annuler toute la question si une partie seulement est ratée
      // (règle explicite du cahier des charges).
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
      const libelleTache = d.corrigePar === 'en_attente'
        ? '⏳ En attente de correction'
        : (tachesTotalQ > 1
          ? `${tachesReussiesQ === tachesTotalQ ? '✅' : tachesReussiesQ > 0 ? '🟡' : '❌'} ${tachesReussiesQ}/${tachesTotalQ} tâche${tachesTotalQ > 1 ? 's' : ''} réussie${tachesReussiesQ > 1 ? 's' : ''}`
          : (tachesReussiesQ >= 1 ? '✅ Correct' : '❌ Incorrect'));
      const correctionQuestion = (correctionInfo?.autorise && correctionInfo.corrige) ? correctionInfo.corrige[q.id] : null;
      return `<div class="question-lecture">
        <p class="question-enonce">${i + 1}. ${rendreEnonce(q)}</p>
        <p>Ta réponse : <strong>${echapper(texteReponse)}</strong></p>
        <div class="resultat-question ${classeResultat}">
          ${libelleTache}
          ${d.commentaire ? `<p style="margin:6px 0 0">${echapper(d.commentaire)}</p>` : ''}
          ${correctionQuestion ? `<p class="bonne-reponse-corrigee" style="margin:6px 0 0">🔓 Bonne réponse : <strong>${echapper(texteBonneReponse(q, correctionQuestion))}</strong>${correctionQuestion.commentaire ? ` — ${echapper(correctionQuestion.commentaire)}` : ''}</p>` : ''}
        </div>
      </div>`;
    }).join('')}
    ${!enAttente ? `<div class="actions-resultat-exercice" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px">
      ${peutReprendreRates ? `<button type="button" class="btn btn-filled" data-reprendre-rates="${b.id}">🔁 Reprendre les tâches ratées</button>` : ''}
      <button type="button" class="btn btn-discret" data-refaire="${b.id}" data-type-refaire="exercice">🔄 Refaire cet exercice</button>
      ${(peutVoirCorrection && !correctionInfo) ? `<button type="button" class="btn btn-discret" data-voir-correction="${b.id}">🔓 Voir la correction</button>` : ''}
      ${(correctionInfo && !correctionInfo.autorise) ? `<span style="font-size:12px;color:var(--text-gris)">${echapper(correctionInfo.erreur || '')}</span>` : ''}
    </div>` : ''}
  `;
}

function attacherEcouteursRefaire() {
  document.querySelectorAll('[data-refaire]').forEach(btn => {
    btn.addEventListener('click', () => {
      formulairesReouverts.add(parseInt(btn.dataset.refaire, 10));
      rendre();
    });
  });
}

// Bloc "Correction" : bascule simple d'affichage, rien à recharger (le
// contenu est déjà dans le HTML, juste masqué par l'attribut `hidden`).
function attacherEcouteursCorrections() {
  document.querySelectorAll('[data-bouton-correction]').forEach(btn => {
    btn.addEventListener('click', () => {
      const zone = document.querySelector(`[data-zone-correction="${btn.dataset.boutonCorrection}"]`);
      if (!zone) return;
      const estMasquee = zone.hidden;
      zone.hidden = !estMasquee;
      btn.textContent = estMasquee ? '🔼 Masquer la correction' : '🔓 Voir la correction';
    });
  });

  // "Voir la correction" d'un exercice/quiz/évaluation à correction auto
  // (bouton affiché uniquement au 3e essai, ou avant en cas de réussite à
  // 100% — cf. peutVoirCorrection dans rendreResultatExercice). Passe par
  // la fonction RPC consulter_correction_exercice, qui pose elle-même la
  // marque "correction consultée" utilisée pour geler le palier tant que
  // le taux réel n'atteint pas 100% (voir bloc_etat_taches côté base).
  document.querySelectorAll('[data-voir-correction]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const blocId = parseInt(btn.dataset.voirCorrection, 10);
      btn.disabled = true;
      btn.textContent = 'Chargement...';
      try {
        const { data, error } = await supabaseClient.rpc('consulter_correction_exercice', { p_bloc_id: blocId });
        if (error) throw new Error(error.message || "Impossible d'afficher la correction pour l'instant.");
        if (data?.erreur && data.autorise !== true) {
          correctionsConsultees[blocId] = { autorise: false, erreur: data.erreur };
        } else {
          correctionsConsultees[blocId] = data;
          // La consultation peut "geler" le palier (correction vue avant
          // 100%) — on rafraîchit donc aussi l'état des paliers affiché.
          const bloc = blocsCourants.find(x => x.id === blocId);
          if (bloc?.palier) {
            etatPaliersSeance = (await supabaseClient.rpc('etat_paliers_seance_v2', { p_eleve_id: profilEleveSeance.id, p_seance_id: seanceCourante.id })).data || [];
          }
        }
        rendre();
      } catch (e) {
        alert(e.message || "Une erreur est survenue.");
        btn.disabled = false;
        btn.textContent = '🔓 Voir la correction';
      }
    });
  });
}

// Lit la réponse donnée par l'élève pour UNE question, quel que soit son
// type — extrait le 11 septembre 2026 de l'ancien gestionnaire de
// soumission (qui dupliquait ce switch) pour être partagé par le
// formulaire classique ET par la validation en direct question par
// question (voir rendreExerciceProgressif / [data-valider-tache]
// ci-dessous). `racine` est le conteneur dans lequel chercher les champs —
// un <form> pour le formulaire classique, ou le <div data-progression-
// question> pour le mode progressif (les deux portent les mêmes attributs
// data-*/name sur leurs champs).
function lireReponseQuestion(racine, q) {
  if (q.type === 'texte_a_trous') {
    const champsTrou = racine.querySelectorAll(`[data-question-trous="${CSS.escape(String(q.id))}"] .champ-trou`);
    return Array.from(champsTrou).map(inp => inp.value);
  }
  if (q.type === 'remise_en_ordre') {
    const liste = racine.querySelector(`[data-ordre-question="${CSS.escape(String(q.id))}"]`);
    return liste ? Array.from(liste.children).map(li => parseInt(li.dataset.indexOriginal, 10)) : [];
  }
  if (q.type === 'association') {
    const zone = racine.querySelector(`[data-association-question="${CSS.escape(String(q.id))}"]`);
    const selects = zone ? Array.from(zone.querySelectorAll('[data-association-choix-index]')) : [];
    selects.sort((a, b) => parseInt(a.dataset.associationChoixIndex, 10) - parseInt(b.dataset.associationChoixIndex, 10));
    return selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
  }
  if (q.type === 'qcm_multiple') {
    const zone = racine.querySelector(`[data-qcm-multiple-question="${CSS.escape(String(q.id))}"]`);
    const cases = zone ? Array.from(zone.querySelectorAll('[data-qcm-multiple-choix-index]')) : [];
    return cases.filter(cb => cb.checked).map(cb => parseInt(cb.dataset.qcmMultipleChoixIndex, 10));
  }
  if (q.type === 'classement') {
    const zone = racine.querySelector(`[data-classement-question="${CSS.escape(String(q.id))}"]`);
    const selects = zone ? Array.from(zone.querySelectorAll('[data-classement-choix-index]')) : [];
    selects.sort((a, b) => parseInt(a.dataset.classementChoixIndex, 10) - parseInt(b.dataset.classementChoixIndex, 10));
    return selects.map(sel => sel.value === '' ? null : parseInt(sel.value, 10));
  }
  if (q.type === 'intrus_lexical') {
    const zone = racine.querySelector(`[data-intrus-question="${CSS.escape(String(q.id))}"]`);
    const series = zone ? Array.from(zone.querySelectorAll('[data-serie-intrus-index]')) : [];
    series.sort((a, b) => parseInt(a.dataset.serieIntrusIndex, 10) - parseInt(b.dataset.serieIntrusIndex, 10));
    return series.map(s => {
      const coche = s.querySelector('input[data-intrus-radio-index]:checked');
      return coche ? parseInt(coche.dataset.intrusRadioIndex, 10) : null;
    });
  }
  if (q.type === 'selection_mots') {
    const zone = racine.querySelector(`[data-question-selection-mots="${CSS.escape(String(q.id))}"]`);
    const chips = zone ? Array.from(zone.querySelectorAll('.chip-mot-choix')) : [];
    return chips.filter(c => c.classList.contains('selectionne')).map(c => c.dataset.motChoixIndex);
  }
  if (q.type === 'texte_a_trous_glisser') {
    const zone = racine.querySelector(`[data-question-trous-glisser="${CSS.escape(String(q.id))}"]`);
    const trous = zone ? Array.from(zone.querySelectorAll('.zone-trou-glisser')) : [];
    trous.sort((a, b) => parseInt(a.dataset.trouGlisserIndex, 10) - parseInt(b.dataset.trouGlisserIndex, 10));
    return trous.map(t => t.dataset.motPlace || null);
  }
  if (q.type === 'vrai_faux_justifie') {
    const coche = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
    const justif = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}_justification"]`);
    return { reponse: coche ? coche.value === 'true' : null, justification: justif ? justif.value : '' };
  }
  const champCoche = racine.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
  const champSimple = racine.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], input[type=number][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
  const champ = champCoche || champSimple;
  if (!champ) return undefined;
  return (q.type === 'vrai_faux') ? (champ.value === 'true') : champ.value;
}

// Soumission RÉELLE d'un exercice/quiz/évaluation (consomme un essai et le
// quota Premium, recalcule paliers/badges/note côté serveur) — partagée
// par le formulaire classique (blocs sans palier) et par le bouton final
// "Valider tout le palier" du mode progressif (blocs avec palier). C'est
// la SEULE fonction qui écrit une réponse en base : la validation en
// direct question par question (valider_tache) n'est qu'un guide, jamais
// la source de vérité.
async function soumettreExercice(blocId, reponses, boutonUi) {
  const bloc = blocsCourants.find(x => x.id === blocId);
  const numeroEssai = (reponsesExistantes[blocId] || []).length + 1;
  if (boutonUi) { boutonUi.disabled = true; boutonUi.textContent = 'Correction en cours...'; }

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

    (reponsesExistantes[blocId] ??= []).push({
      bloc_id: blocId, eleve_id: profilEleveSeance.id, reponses,
      score: data.score, score_max: data.score_max, details: data.details, statut: data.statut,
      numero_essai: numeroEssai, medaille: data.medaille ?? null,
      nb_taches: data.nbTaches, nb_taches_reussies: data.nbTachesReussies, details_taches: data.detailsTaches,
    });
    formulairesReouverts.delete(blocId);
    delete progressionPalier[blocId];
    await rafraichirAccesCorrectionIA();

    // Son + message de résultat (cahier des charges : "chaque validation ou
    // rejet doit être accompagné d'un son ... et d'un message de
    // félicitation ... ou d'un message d'encouragement selon le cas").
    const totalTaches = data.nbTaches;
    const reussiesTaches = data.nbTachesReussies;
    const reussiteTotale = data.statut !== 'en_attente_ia' && typeof totalTaches === 'number' && totalTaches > 0 && reussiesTaches === totalTaches;
    let message;
    if (data.statut === 'en_attente_ia') {
      message = '⏳ Ta réponse est en cours de correction par un enseignant.';
    } else if (reussiteTotale) {
      jouerSonReussite();
      message = numeroEssai === 1 ? '🎉 Parfait, toutes les tâches réussies du premier coup !' : '🎉 Bravo, toutes les tâches sont réussies !';
      // 18 septembre 2026 (2e lot) : trophée plein écran à la réussite à 100%
      // — y compris dès le 1er essai (voir afficherTropheePalierPleinEcran
      // ci-dessus) ; réservé aux blocs de palier, où cette réussite débloque
      // vraiment une progression (un exercice sans palier n'a pas de palier
      // à célébrer).
      if (bloc?.palier) afficherTropheePalierPleinEcran(bloc.palier);
    } else if (reussiesTaches > 0) {
      jouerSonReussite();
      message = '🙂 Bien joué, continue comme ça !';
    } else {
      jouerSonEchec();
      message = numeroEssai >= 3
        ? '📖 Tu as utilisé tes 3 essais — regarde la correction pour comprendre tes erreurs.'
        : '💪 Ne lâche rien, tu vas y arriver au prochain essai !';
    }

    // Si ce bloc appartient à un palier, on rafraîchit son état (taux,
    // déverrouillage du palier suivant) et on ajoute le son/message propre
    // à une RÉUSSITE DE PALIER (distincte de la réussite de CET exercice —
    // un palier peut compter plusieurs blocs).
    if (bloc?.palier) {
      const reussiAvant = !!etatPaliersSeance.find(p => p.palier === bloc.palier)?.reussi;
      etatPaliersSeance = (await supabaseClient.rpc('etat_paliers_seance_v2', { p_eleve_id: profilEleveSeance.id, p_seance_id: seanceCourante.id })).data || [];
      const etatApres = etatPaliersSeance.find(p => p.palier === bloc.palier);
      if (etatApres?.reussi && !reussiAvant) {
        jouerSonPalier();
        message += ` 🏆 Palier ${LIBELLES_PALIER_ELEVE[bloc.palier] || bloc.palier} débloqué${numeroEssai === 1 ? ' — badges obtenus au 1er essai !' : ' !'}`;
      }
    }

    messagesApresEssai[blocId] = message;
    rendre();
  } catch (e) {
    alert(e.message || "Une erreur est survenue pendant la correction.");
    if (boutonUi) { boutonUi.disabled = false; boutonUi.textContent = boutonUi.dataset.soumettrePalier ? '📤 Valider tout le palier' : '✅ Valider mes réponses'; }
  }
}

function attacherEcouteursExercices() {
  attacherEcouteursListesOrdre();
  attacherEcouteursSelectionMots();
  attacherEcouteursTrousGlisser();

  // Formulaire classique (blocs SANS palier) : toutes les questions sont
  // déjà affichées, un seul bouton soumet tout d'un coup.
  document.querySelectorAll('[data-form-exercice]').forEach(form => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formExercice, 10);
      const bloc = blocsCourants.find(x => x.id === blocId);
      const questions = Array.isArray(bloc?.contenu?.questions) ? bloc.contenu.questions : [];
      const reponses = {};
      questions.forEach(q => {
        const valeur = lireReponseQuestion(form, q);
        if (valeur !== undefined) reponses[q.id] = valeur;
      });
      soumettreExercice(blocId, reponses, form.querySelector('button[type=submit]'));
    });
  });

  // Validation EN DIRECT d'une question (mode progressif, blocs avec
  // palier) — action 'valider_tache' : aucun essai consommé, aucune
  // écriture, juste un aperçu pour guider l'élève. Voir
  // rendreExerciceProgressif ci-dessus pour le HTML produit.
  document.querySelectorAll('[data-valider-tache]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const blocId = parseInt(btn.dataset.validerTache, 10);
      const bloc = blocsCourants.find(x => x.id === blocId);
      const questions = Array.isArray(bloc?.contenu?.questions) ? bloc.contenu.questions : [];
      const etat = (progressionPalier[blocId] ??= { index: 0, reponses: {} });
      const q = (etat.sousListe || questions)[etat.index];
      if (!q) return;
      const racine = btn.closest(`[data-progression-question="${blocId}"]`);
      const reponse = lireReponseQuestion(racine, q);
      const zoneFeedback = racine.querySelector(`[data-feedback-tache="${blocId}"]`);
      const texteOriginal = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Vérification...';
      try {
        const { data, error } = await supabaseClient.functions.invoke('corriger-exercice', {
          body: { blocId, action: 'valider_tache', questionId: q.id, reponse },
        });
        if (error) throw new Error(error.message || "Impossible de vérifier ta réponse pour l'instant.");
        if (data?.error) throw new Error(data.error);

        etat.reponses[q.id] = reponse;
        zoneFeedback.hidden = false;

        // Types corrigés par IA (reponse_longue, vrai_faux_justifie) : pas de
        // notation en direct (coût), on avance dès qu'une réponse est fournie
        // (la vraie note sera calculée à la soumission finale du palier).
        if (typeof data.rempli === 'boolean') {
          if (data.rempli) {
            jouerSonReussite();
            zoneFeedback.className = 'feedback-tache-progressive feedback-ok';
            zoneFeedback.textContent = '📝 Réponse enregistrée — elle sera corrigée à la validation finale du palier.';
            etat.index++;
            setTimeout(rendre, 700);
          } else {
            jouerSonEchec();
            zoneFeedback.className = 'feedback-tache-progressive feedback-echec';
            zoneFeedback.textContent = '✏️ Écris une réponse avant de continuer.';
            btn.disabled = false;
            btn.textContent = texteOriginal;
          }
          return;
        }

        const tachesTotal = data.tachesTotal ?? 1;
        const tachesReussies = data.tachesReussies ?? 0;
        if (tachesReussies === tachesTotal) {
          jouerSonReussite();
          zoneFeedback.className = 'feedback-tache-progressive feedback-ok';
          zoneFeedback.textContent = tachesTotal > 1 ? `✅ Bravo — ${tachesReussies}/${tachesTotal} réussies !` : '✅ Bonne réponse !';
          etat.index++;
          setTimeout(rendre, 700);
        } else if (tachesReussies > 0) {
          jouerSonReussite();
          zoneFeedback.className = 'feedback-tache-progressive feedback-partiel';
          zoneFeedback.textContent = `🙂 ${tachesReussies}/${tachesTotal} réussies — bien joué, on continue !`;
          etat.index++;
          setTimeout(rendre, 900);
        } else {
          jouerSonEchec();
          zoneFeedback.className = 'feedback-tache-progressive feedback-echec';
          zoneFeedback.textContent = "❌ Ce n'est pas encore ça — réessaie !";
          btn.disabled = false;
          btn.textContent = texteOriginal;
        }
      } catch (e) {
        alert(e.message || "Une erreur est survenue.");
        btn.disabled = false;
        btn.textContent = texteOriginal;
      }
    });
  });

  // Bouton final du mode progressif : soumet à la VRAIE correction toutes
  // les réponses déjà collectées question par question.
  document.querySelectorAll('[data-soumettre-palier]').forEach(btn => {
    btn.addEventListener('click', () => {
      const blocId = parseInt(btn.dataset.soumettrePalier, 10);
      const etat = progressionPalier[blocId] || { reponses: {} };
      // Reprise des tâches ratées (voir demarrerRepriseTachesRatees) : fusion
      // des réponses déjà correctes (reponsesBase) avec celles qui viennent
      // d'être retravaillées (etat.reponses) — pour une soumission "à froid"
      // sans reprise, reponsesBase est simplement vide.
      const reponsesFinales = { ...(etat.reponsesBase || {}), ...etat.reponses };
      soumettreExercice(blocId, reponsesFinales, btn);
    });
  });
}

function attacherEcouteursActivites() {
  document.querySelectorAll('[data-form-activite]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formActivite, 10);
      const reponseTexte = form.querySelector('[name=reponse]').value.trim();
      const pieceJointe = form.querySelector('[name=piece_jointe]').value.trim();
      const numeroEssai = (rendusActivitesExistants[blocId] || []).length + 1;

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Envoi en cours...';

      const { data, error } = await supabaseClient.from('rendus_activites').insert({
        bloc_id: blocId, eleve_id: profilEleveSeance.id, numero_essai: numeroEssai,
        reponse_texte: reponseTexte, piece_jointe_url: pieceJointe || null
      }).select().single();

      if (error) {
        alert(error.message);
        boutonValider.disabled = false;
        boutonValider.textContent = '📤 Rendre mon travail';
        return;
      }
      (rendusActivitesExistants[blocId] ??= []).push(data);
      formulairesReouverts.delete(blocId);
      rendre();
    });
  });
}

// Soumission du bloc "Problème" v2 — collecte toutes les cases de la grille
// de chaque étape (voir collecterReponseProbleme dans js/editeur/blocs.js) et
// les enregistre en JSON dans rendus_activites.reponse_texte, exactement
// comme le texte libre d'une "activité" (même table, même mécanisme de
// correction manuelle par la suite).
function attacherEcouteursProblemes() {
  document.querySelectorAll('[data-form-probleme]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formProbleme, 10);
      const nbLignes = parseInt(form.dataset.nbLignesProbleme, 10) || 0;
      const reponseTexte = collecterReponseProbleme(form, nbLignes);
      const numeroEssai = (rendusActivitesExistants[blocId] || []).length + 1;

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Envoi en cours...';

      const { data, error } = await supabaseClient.from('rendus_activites').insert({
        bloc_id: blocId, eleve_id: profilEleveSeance.id, numero_essai: numeroEssai,
        reponse_texte: reponseTexte, piece_jointe_url: null
      }).select().single();

      if (error) {
        alert(error.message);
        boutonValider.disabled = false;
        boutonValider.textContent = '📤 Rendre mon travail';
        return;
      }
      (rendusActivitesExistants[blocId] ??= []).push(data);
      formulairesReouverts.delete(blocId);
      rendre();
    });
  });
}
