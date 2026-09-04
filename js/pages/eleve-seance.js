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
let etatPaliersSeance = []; // [{palier, nb_total, nb_reussies, deverrouille}] — vide si la séance n'utilise pas les paliers
let formulairesReouverts = new Set(); // bloc_id pour lesquels l'élève a cliqué "Refaire" (affiche un formulaire vierge malgré un essai existant)

const TYPES_TRAVAIL = ['exercice', 'quiz', 'evaluation', 'activite'];
const LIBELLES_PALIER_ELEVE = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const LIBELLES_MEDAILLE = { bronze: '🥉 Bronze', argent: '🥈 Argent', or: '🥇 Or', diamant: '💎 Diamant' };

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
  const idsExercices = blocsCourants.filter(b => ['exercice', 'quiz', 'evaluation', 'activite'].includes(b.type_bloc)).map(b => b.id);
  const idsActivites = blocsCourants.filter(b => b.type_bloc === 'activite').map(b => b.id);
  reponsesExistantes = {};
  rendusActivitesExistants = {};
  formulairesReouverts.clear();

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
    ? (await supabaseClient.rpc('etat_paliers_seance', { p_eleve_id: profilEleveSeance.id, p_seance_id: seanceId })).data || []
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

function rendre() {
  const tousBlocsTop = blocsCourants.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const blocsGeneraux = tousBlocsTop.filter(b => !b.palier);
  const blocsLecture = blocsGeneraux.filter(b => !TYPES_TRAVAIL.includes(b.type_bloc));
  const blocsTravail = blocsGeneraux.filter(b => TYPES_TRAVAIL.includes(b.type_bloc));

  const blocsParPalier = {};
  tousBlocsTop.filter(b => b.palier).forEach(b => { (blocsParPalier[b.palier] ??= []).push(b); });
  const aDesPaliers = etatPaliersSeance.some(p => p.nb_total > 0);

  // Arborescence complète dans la miniature (fil d'ariane), suivie de la
  // discipline de la séance en grand (demande explicite du 4 septembre
  // 2026 : ni le titre de la séance ni le nom de la séquence/SA ne doivent
  // apparaître dans l'affichage — seule la discipline reste visible ; le
  // champ "titre" continue d'exister en base et reste utilisé tel quel par
  // l'IA pour générer le contenu, voir js/pages/editeur-seance.js). Chaque
  // niveau (sauf le dernier) est cliquable et ramène directement à ce niveau
  // sur pages/eleve/matiere.html — voir js/pages/eleve-matiere.js.
  const segmentsArbo = [];
  if (cheminSeance.classeNom) segmentsArbo.push({ label: cheminSeance.classeNom });
  if (cheminSeance.champNom) segmentsArbo.push({ label: cheminSeance.champNom, href: cheminSeance.champId ? `matiere.html?champId=${cheminSeance.champId}` : null });
  (cheminSeance.cheminNoeuds || []).forEach(n => segmentsArbo.push({
    label: n.titre, href: cheminSeance.champId ? `matiere.html?champId=${cheminSeance.champId}&noeudId=${n.id}` : null
  }));
  segmentsArbo.push({ label: seanceCourante.discipline || seanceCourante.titre }); // niveau actuel — pas de lien ; discipline seule (repli sur le titre si non renseignée)

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
  // dans la colonne de droite, cette colonne resterait vide alors que la
  // grille réserve quand même la moitié de la largeur pour elle — ce qui
  // rétrécit la colonne de lecture par rapport à la section "Paliers" plus
  // bas (qui, elle, prend toute la largeur). On repasse alors sur une seule
  // colonne pleine largeur pour que tout s'aligne au même niveau.
  const colonneExerciceVide = blocsTravail.length === 0 && aDesPaliers;

  document.getElementById('contenu').innerHTML = `
    <div class="fil-ariane-eleve"><a href="matiere.html">← Retour à mes matières</a></div>
    <div class="entete-seance-eleve">
      <p style="margin:0" class="miniature-arborescence-eleve">${filAriane}</p>
      <h1 class="titre-seance-eleve">${echapper(seanceCourante.discipline || seanceCourante.titre)}</h1>
    </div>

    <div class="zone-travail-seance"${colonneExerciceVide ? ' style="grid-template-columns:1fr"' : ''}>
      <div class="colonne-lecture-seance">
        ${blocsLecture.length ? blocsLecture.map(b => rendreBlocLecture(b)).join('') : '<p style="color:var(--text-gris)">Aucun support de cours pour cette séance.</p>'}
        ${boutonMarquerTermine}
      </div>
      ${colonneExerciceVide ? '' : `<div class="colonne-exercice-seance">
        ${blocsTravail.length ? blocsTravail.map(rendreBlocTravail).join('') : '<div class="bloc-lecture" style="border-left-color:#94A3B8"><p style="color:var(--text-gris);margin:0">Aucun exercice ni activité pour cette séance — profite bien de la lecture !</p></div>'}
      </div>`}
    </div>

    ${aDesPaliers ? html_sectionPaliers(blocsParPalier) : ''}
  `;

  attacherEcouteursExercices();
  attacherEcouteursActivites();
  attacherEcouteursRefaire();
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
    ${etatPaliersSeance.filter(p => p.nb_total > 0).map(p => {
      const libelle = LIBELLES_PALIER_ELEVE[p.palier] || p.palier;
      const blocs = (blocsParPalier[p.palier] || []).sort((a, b) => a.ordre - b.ordre);
      if (!p.deverrouille) {
        return `<div class="bloc-lecture" style="border-left-color:#94A3B8;opacity:.7;margin-top:14px">
          <div class="bloc-lecture-titre">🔒 ${libelle}</div>
          <p style="margin:0;color:var(--text-gris);font-size:13px">Termine d'abord le palier précédent (toutes les activités réussies, sauf une au maximum) pour débloquer celui-ci.</p>
        </div>`;
      }
      return `<div class="bloc-lecture" style="border-left-color:var(--bleu-kekeli);margin-top:14px">
        <div class="bloc-lecture-titre">${libelle} — ${p.nb_reussies}/${p.nb_total} réussi${p.nb_reussies > 1 ? 's' : ''}</div>
        ${blocs.map(b => TYPES_TRAVAIL.includes(b.type_bloc) ? rendreBlocTravail(b) : rendreBlocLecture(b)).join('')}
      </div>`;
    }).join('')}
  `;
}

function rendreBlocTravail(b) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || '#0000D1';
  const libelle = c.libelle || info.label;
  // Un bloc "activite" créé AVANT la refonte des Activités (texte libre,
  // corrigé à la main par un enseignant) continue de s'afficher via
  // rendreActivite tant qu'il a déjà un rendu dans rendus_activites — ça
  // évite de faire disparaître un travail déjà rendu/corrigé. Toute NOUVELLE
  // activité (pas encore de rendu legacy) passe par le parcours structuré
  // (questions + corrigé auto), comme un exercice/quiz/évaluation.
  const aRenduLegacy = b.type_bloc === 'activite' && (rendusActivitesExistants[b.id] || []).length > 0;
  const corps = aRenduLegacy ? rendreActivite(b, c) : rendreExercice(b, c);
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">
    <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
    ${corps}
  </div>`;
}

function rendreBlocLecture(b, estEnfant = false) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || '#0000D1';
  // Le bloc "Contenu" (valeur interne 'titre') est masqué à l'élève par
  // défaut — voir le même choix dans js/pages/editeur-seance.js (htmlBloc,
  // rendreBlocApercu) et la case "Titre visible" de l'éditeur.
  const afficherTitre = typeof c.afficherTitre === 'boolean' ? c.afficherTitre : b.type_bloc !== 'titre';
  const libelle = c.libelle || info.label;
  let corps = '';

  if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div class="contenu-riche-lecture">${contenuRicheInitial(c.texte)}</div>`;
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
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">${contenuInterieur}</div>`;
}

function libelleMedaille(medaille, numeroEssai) {
  if (!medaille || numeroEssai > 2) return '';
  const marque = numeroEssai === 2 ? ' <span style="font-size:11px;opacity:.75">· 2ᵉ essai</span>' : '';
  return ` <span class="badge-palier-seance" style="background:#FEF3C7;color:#92620A">${LIBELLES_MEDAILLE[medaille]}${marque}</span>`;
}

function rendreExercice(b, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  const essais = reponsesExistantes[b.id] || [];
  const dernier = essais[essais.length - 1];

  if (!questions.length) {
    return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant — reviens plus tard.</p>`;
  }

  if (dernier && !formulairesReouverts.has(b.id)) return rendreResultatExercice(b, c, questions, dernier);

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
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-exercice="${b.id}">
      ${questions.map((q, i) => rendreChampQuestion(q, i)).join('')}
      <button type="submit" class="btn btn-filled bouton-valider-exercice">✅ Valider mes réponses</button>
    </form>
  `;
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
        ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
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
      ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
      <p style="font-size:13px;background:#F9F9F9;padding:8px;border-radius:6px">${echapper(dernier.reponse_texte || '')}</p>
      <p style="font-size:12px;color:var(--text-gris);margin-top:8px">⏳ En attente de correction.</p>`;
  }

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    ${essais.length ? `<p style="font-size:12px;color:var(--text-gris)">Nouvel essai (n°${essais.length + 1})</p>` : ''}
    <form data-form-activite="${b.id}" class="activite-lecture">
      <textarea name="reponse" required placeholder="Écris ta réponse ici..."></textarea>
      <input type="url" name="piece_jointe" placeholder="Lien vers une pièce jointe (optionnel)">
      <button type="submit" class="btn btn-filled bouton-valider-exercice">📤 Rendre mon travail</button>
    </form>
  `;
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
  if (q.type === 'remise_en_ordre') {
    const options = Array.isArray(q.options) ? q.options : [];
    const ordreMele = options.map((opt, idx) => ({ opt, idx })).sort(() => Math.random() - 0.5);
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
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
      <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
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
      <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
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
      <p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>
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
  } else {
    champ = `<textarea name="q_${echapper(q.id)}" required placeholder="Ta réponse..."></textarea>`;
  }
  return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
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

function rendreResultatExercice(b, c, questions, reponse) {
  const details = reponse.details || {};
  const reponsesDonnees = reponse.reponses || {};
  const enAttente = reponse.statut === 'en_attente_ia';
  const note20 = enAttente ? null : noteSur20DepuisScore(reponse.score, reponse.score_max);

  return `
    ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
    <div class="recap-score">${enAttente ? '⏳ En cours de correction par un enseignant' : `📊 Score : ${reponse.score} / ${reponse.score_max}${note20 !== null ? ` (${note20}/20)` : ''}`}${libelleMedaille(reponse.medaille, reponse.numero_essai)}</div>
    ${questions.map((q, i) => {
      const d = details[q.id] || {};
      const classeResultat = d.correct === true ? 'correct' : d.correct === false ? 'incorrect' : 'attente';
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
    ${!enAttente ? `<button type="button" class="btn btn-discret" data-refaire="${b.id}" data-type-refaire="exercice" style="margin-top:10px">🔄 Refaire cet exercice</button>` : ''}
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

function attacherEcouteursExercices() {
  attacherEcouteursListesOrdre();
  document.querySelectorAll('[data-form-exercice]').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const blocId = parseInt(form.dataset.formExercice, 10);
      const bloc = blocsCourants.find(x => x.id === blocId);
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
        const champCoche = form.querySelector(`[name="q_${CSS.escape(String(q.id))}"]:checked`);
        const champSimple = form.querySelector(`input[type=text][name="q_${CSS.escape(String(q.id))}"], textarea[name="q_${CSS.escape(String(q.id))}"]`);
        const champ = champCoche || champSimple;
        if (!champ) return;
        reponses[q.id] = (q.type === 'vrai_faux') ? (champ.value === 'true') : champ.value;
      });

      const boutonValider = form.querySelector('button[type=submit]');
      boutonValider.disabled = true;
      boutonValider.textContent = 'Correction en cours...';

      const numeroEssai = (reponsesExistantes[blocId] || []).length + 1;

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
        });
        formulairesReouverts.delete(blocId);
        await rafraichirAccesCorrectionIA();
        const aDesPaliers = blocsCourants.some(x => x.palier);
        if (aDesPaliers) {
          etatPaliersSeance = (await supabaseClient.rpc('etat_paliers_seance', { p_eleve_id: profilEleveSeance.id, p_seance_id: seanceCourante.id })).data || [];
        }
        rendre();
      } catch (e) {
        alert(e.message || "Une erreur est survenue pendant la correction.");
        boutonValider.disabled = false;
        boutonValider.textContent = '✅ Valider mes réponses';
      }
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
