// Page pages/completer-profil.html — "Mon profil"
//
// Depuis le 12 septembre 2026 : ce n'est plus une page de blocage. L'inscription
// (pages/inscription.html) ne demande plus que l'essentiel (nom, prénom,
// identifiant, e-mail, mot de passe — et, pour l'enseignant, école + classe) ;
// le sexe et la localisation (Département/Commune/Arrondissement...) sont
// optionnels et se renseignent ICI, à tout moment, volontairement — la page
// est accessible depuis pages/parametres.html ("👤 Mon profil"), jamais
// imposée par une redirection forcée (requireRole() ne redirige plus ici).
//
// Elle affiche TOUJOURS l'ensemble des champs applicables au rôle (pré-remplis
// avec ce qui est déjà enregistré), plutôt que seulement les champs manquants
// comme avant cette date — l'utilisateur peut aussi bien compléter que
// corriger une information déjà saisie.
//
// Cette page ne demande PAS de mot de passe ni les champs de l'inscription
// (nom/prénom/e-mail/identifiant) : la session est déjà ouverte, on ne
// modifie que sexe/localisation (et, pour l'enseignant, l'école/la classe
// s'il n'en a pas encore).

let profilCP = null;
let autoriteCP = null;
let enseignantCP = null;

(async function () {
  profilCP = await chargerSessionEtProfil();
  if (!profilCP) return;

  // Rôles sans ces champs (élève, admin...) : rien à faire ici.
  if (!ROLES_AVEC_LOCALISATION.includes(profilCP.role)) {
    window.location.href = urlTableauDeBord(profilCP.role);
    return;
  }

  document.getElementById('badgeUtilisateur').textContent = `${profilCP.prenom} ${profilCP.nom}`;

  if (profilCP.role === 'autorite_pedagogique') {
    const { data } = await supabaseClient.from('autorites_pedagogiques').select('*').eq('id', profilCP.id).single();
    autoriteCP = data;
  }
  if (profilCP.role === 'enseignant') {
    const { data } = await supabaseClient.from('enseignants').select('*').eq('id', profilCP.id).single();
    enseignantCP = data;
  }

  await initialiserFormulaireCP();
})();

async function initialiserFormulaireCP() {
  // Depuis le 12 septembre 2026 : le champ Sexe est toujours affiché (et
  // pré-rempli s'il est déjà connu) — cette page n'est plus limitée aux
  // seuls champs manquants, elle permet de compléter ET de corriger.
  document.getElementById('sexe').value = profilCP.sexe || '';

  document.getElementById('texteComplement').textContent = 'localisation, sexe' + (profilCP.role === 'enseignant' ? ', établissement et classe' : '');

  initialiserCascadeGeoBenin(document.getElementById('departement'), document.getElementById('commune'), document.getElementById('arrondissement'), document.getElementById('circonscriptionScolaire'));
  document.getElementById('departement').value = profilCP.departement || '';
  document.getElementById('commune').innerHTML = (COMMUNES_PAR_DEPARTEMENT[profilCP.departement] || [])
    .map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('commune').value = profilCP.commune || '';
  document.getElementById('commune').disabled = false;
  document.getElementById('arrondissement').innerHTML = (ARRONDISSEMENTS_PAR_COMMUNE[profilCP.commune] || [])
    .map(a => `<option value="${a}">${a}</option>`).join('');
  document.getElementById('arrondissement').value = profilCP.arrondissement || '';
  document.getElementById('arrondissement').disabled = false;
  document.getElementById('circonscriptionScolaire').innerHTML = (CIRCONSCRIPTIONS_PAR_COMMUNE[profilCP.commune] || [])
    .map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('circonscriptionScolaire').disabled = false;
  document.getElementById('zonePedagogique').innerHTML = ZONES_PEDAGOGIQUES.map(z => `<option value="${z}">${z}</option>`).join('');

  const champCommune = document.getElementById('champCommune');
  const champArrondissement = document.getElementById('champArrondissement');
  const champCirconscription = document.getElementById('champCirconscription');
  const champZone = document.getElementById('champZone');
  const champEcole = document.getElementById('champEcole');
  const champClasse = document.getElementById('champClasse');

  if (profilCP.role === 'parent') {
    champCommune.style.display = '';
    champArrondissement.style.display = '';
    champCirconscription.style.display = 'none';
    champZone.style.display = 'none';
    champEcole.style.display = 'none';
    champClasse.style.display = 'none';
  } else if (profilCP.role === 'enseignant') {
    champCommune.style.display = '';
    champArrondissement.style.display = '';
    champCirconscription.style.display = '';
    champZone.style.display = '';
    champEcole.style.display = '';
    document.getElementById('circonscriptionScolaire').value = enseignantCP?.circonscription_scolaire || '';
    document.getElementById('zonePedagogique').value = enseignantCP?.zone_pedagogique || '';
    document.getElementById('ecole').value = enseignantCP?.ecole || '';

    const classesAssigneesCP = enseignantCP?.classes_assignees || [];
    const aDejaUneClasse = classesAssigneesCP.length > 0;
    const { data: demandesClasseCP } = await supabaseClient.from('demandes_classe_enseignant')
      .select('*').eq('enseignant_id', profilCP.id);
    const aUneDemande = (demandesClasseCP || []).length > 0;
    if (!aDejaUneClasse && !aUneDemande) {
      champClasse.style.display = '';
      const { data: classes } = await supabaseClient.from('classes').select('*').order('ordre');
      document.getElementById('classe').innerHTML = (classes || []).map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    } else {
      champClasse.style.display = 'none';
    }

    // 19 septembre 2026 : seule la toute première classe (ci-dessus, à
    // l'inscription/première visite du profil) est attribuée automatiquement
    // — une classe supplémentaire passe toujours par une demande à valider
    // par l'administration. Le bouton correspondant, auparavant sur le
    // tableau de bord enseignant, est relogé ici, dans "Mon profil".
    if (aDejaUneClasse) {
      await afficherBlocClasseSupplementaireCP(classesAssigneesCP, demandesClasseCP || []);
      document.getElementById('btnDemanderClasseCP').addEventListener('click', demanderClasseSupplementaireCP);
    }
  } else {
    // autorite_pedagogique : les champs affichés dépendent de la fonction
    // choisie à l'inscription (non modifiable ici).
    const champs = FONCTIONS_AUTORITE_PEDAGOGIQUE[autoriteCP?.fonction] || {};
    champCommune.style.display = champs.commune ? '' : 'none';
    champArrondissement.style.display = champs.arrondissement ? '' : 'none';
    champCirconscription.style.display = champs.circonscriptionScolaire ? '' : 'none';
    champZone.style.display = champs.zonePedagogique ? '' : 'none';
    champEcole.style.display = champs.ecole ? '' : 'none';
    champClasse.style.display = 'none';
    document.getElementById('circonscriptionScolaire').value = autoriteCP?.circonscription_scolaire || '';
    document.getElementById('zonePedagogique').value = autoriteCP?.zone_pedagogique || '';
    document.getElementById('ecole').value = autoriteCP?.ecole || '';
  }

  document.getElementById('formCompleterProfil').addEventListener('submit', enregistrerCompletionCP);
}

// 19 septembre 2026 : demande d'une classe SUPPLÉMENTAIRE (au-delà de la
// toute première, attribuée automatiquement) — soumise à l'administration,
// exactement comme l'ancien bouton "+ Demander une classe" du tableau de
// bord enseignant (js/pages/enseignant-tableau-de-bord.js), désormais logé
// ici, dans "Mon profil".
async function afficherBlocClasseSupplementaireCP(classesAssignees, demandesClasse) {
  const bloc = document.getElementById('blocClasseSupplementaireCP');
  const select = document.getElementById('classeSupplementaire');
  const btn = document.getElementById('btnDemanderClasseCP');
  const message = document.getElementById('messageClasseSupplementaireCP');

  const demandesEnAttente = demandesClasse.filter(d => d.statut === 'en_attente');
  const { data: toutesClasses } = await supabaseClient.from('classes').select('*').order('ordre');
  const classesDisponibles = (toutesClasses || []).filter(c => !classesAssignees.includes(c.id) && !demandesEnAttente.some(d => d.classe_id === c.id));

  const nomsAssignees = (toutesClasses || []).filter(c => classesAssignees.includes(c.id)).map(c => c.nom).join(', ');
  const nomsEnAttente = (toutesClasses || []).filter(c => demandesEnAttente.some(d => d.classe_id === c.id)).map(c => c.nom).join(', ');

  bloc.style.display = '';
  message.innerHTML = [
    nomsAssignees ? `Classe(s) déjà accordée(s) : <strong>${nomsAssignees}</strong>.` : '',
    nomsEnAttente ? `Demande(s) en attente de validation par l'administration : <strong>${nomsEnAttente}</strong>.` : ''
  ].filter(Boolean).join('<br>');

  if (!classesDisponibles.length) {
    select.style.display = 'none';
    btn.style.display = 'none';
    if (!nomsEnAttente) message.innerHTML += (message.innerHTML ? '<br>' : '') + "Aucune classe supplémentaire disponible pour l'instant.";
    return;
  }

  select.style.display = '';
  btn.style.display = '';
  btn.disabled = false; btn.textContent = "Envoyer la demande à l'administration";
  select.innerHTML = classesDisponibles.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
}

// Écouteur de clic attaché UNE SEULE FOIS (voir initialiserFormulaireCP) —
// afficherBlocClasseSupplementaireCP ci-dessus ne fait que rafraîchir
// l'affichage, jamais réattacher d'écouteur, pour éviter un double-envoi si
// l'enseignant demande plusieurs classes l'une après l'autre.
async function demanderClasseSupplementaireCP() {
  const select = document.getElementById('classeSupplementaire');
  const btn = document.getElementById('btnDemanderClasseCP');
  const message = document.getElementById('messageClasseSupplementaireCP');
  if (!select.value) return;

  btn.disabled = true; btn.textContent = 'Envoi...';
  const { error } = await supabaseClient.from('demandes_classe_enseignant').insert({
    enseignant_id: profilCP.id, classe_id: parseInt(select.value, 10)
  });
  if (error) {
    message.innerHTML = error.message;
    btn.disabled = false; btn.textContent = "Envoyer la demande à l'administration";
    return;
  }
  const { data: enseignantMaj } = await supabaseClient.from('enseignants').select('*').eq('id', profilCP.id).single();
  enseignantCP = enseignantMaj;
  const { data: demandesMaj } = await supabaseClient.from('demandes_classe_enseignant').select('*').eq('enseignant_id', profilCP.id);
  await afficherBlocClasseSupplementaireCP(enseignantMaj?.classes_assignees || [], demandesMaj || []);
}

async function enregistrerCompletionCP(e) {
  e.preventDefault();
  const messageErreur = document.getElementById('messageErreur');
  const btn = document.getElementById('btnCompleter');
  messageErreur.textContent = '';
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  function echec(msg) {
    messageErreur.textContent = msg || "Impossible d'enregistrer. Réessayez.";
    btn.disabled = false; btn.textContent = 'Enregistrer';
  }

  const departement = document.getElementById('departement').value;
  const commune = document.getElementById('commune').value;
  const arrondissement = document.getElementById('arrondissement').value.trim();

  const majProfil = { departement: departement || null };
  if (document.getElementById('champCommune').style.display !== 'none') majProfil.commune = commune || null;
  if (document.getElementById('champArrondissement').style.display !== 'none') majProfil.arrondissement = arrondissement || null;
  if (document.getElementById('champSexe').style.display !== 'none') majProfil.sexe = document.getElementById('sexe').value || null;

  const { error: erreurProfil } = await supabaseClient.from('profils').update(majProfil).eq('id', profilCP.id);
  if (erreurProfil) return echec(erreurProfil.message);

  if (profilCP.role === 'enseignant') {
    const { error: erreurEns } = await supabaseClient.from('enseignants').update({
      ecole: document.getElementById('ecole').value.trim() || null,
      circonscription_scolaire: document.getElementById('circonscriptionScolaire').value.trim() || null,
      zone_pedagogique: document.getElementById('zonePedagogique').value || null
    }).eq('id', profilCP.id);
    if (erreurEns) return echec(erreurEns.message);

    if (document.getElementById('champClasse').style.display !== 'none' && document.getElementById('classe').value) {
      const { error: erreurClasse } = await supabaseClient.rpc('attribuer_classe_initiale_enseignant', {
        p_classe_id: parseInt(document.getElementById('classe').value, 10)
      });
      if (erreurClasse) return echec(erreurClasse.message);
    }
  } else if (profilCP.role === 'autorite_pedagogique') {
    const champs = FONCTIONS_AUTORITE_PEDAGOGIQUE[autoriteCP?.fonction] || {};
    const majAutorite = {};
    if (champs.circonscriptionScolaire) majAutorite.circonscription_scolaire = document.getElementById('circonscriptionScolaire').value.trim() || null;
    if (champs.zonePedagogique) majAutorite.zone_pedagogique = document.getElementById('zonePedagogique').value || null;
    if (champs.ecole) majAutorite.ecole = document.getElementById('ecole').value.trim() || null;
    if (Object.keys(majAutorite).length) {
      const { error: erreurAutorite } = await supabaseClient.from('autorites_pedagogiques').update(majAutorite).eq('id', profilCP.id);
      if (erreurAutorite) return echec(erreurAutorite.message);
    }
  }

  const retour = new URLSearchParams(window.location.search).get('retour');
  window.location.href = (retour && retour.startsWith('/')) ? retour : urlTableauDeBord(profilCP.role);
}
