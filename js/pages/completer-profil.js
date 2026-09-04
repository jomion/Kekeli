// Page pages/completer-profil.html
//
// Rattrape les comptes créés AVANT l'ajout de la localisation (et, pour
// l'enseignant, de l'École/Circonscription Scolaire/Zone Pédagogique/Classe) :
// tant que les champs obligatoires du rôle ne sont pas renseignés,
// requireRole() (js/auth-utilisateur.js) renvoie systématiquement ici, avec
// un paramètre ?retour=... pointant vers la page initialement demandée.
//
// Cette page ne demande PAS de mot de passe ni les champs habituels
// (nom/prénom/e-mail) : la session est déjà ouverte, on ne complète que
// les nouveaux champs.

let profilCP = null;
let autoriteCP = null;
let enseignantCP = null;

(async function () {
  profilCP = await chargerSessionEtProfil();
  if (!profilCP) return;

  // Un compte déjà complet (ou d'un rôle non concerné) n'a rien à faire ici.
  if (!ROLES_AVEC_LOCALISATION_OBLIGATOIRE.includes(profilCP.role)) {
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
  // Sexe ajouté le 4 septembre 2026 — n'est montré ici que pour les comptes
  // créés avant l'ajout de ce champ (les autres ne repassent pas par cette
  // page pour si peu, voir profilEstIncomplet dans js/auth-utilisateur.js).
  // Phrase d'intro reconstruite dynamiquement pour rester correcte quelle
  // que soit la combinaison de champs manquants.
  const sexeManquant = !profilCP.sexe;
  document.getElementById('champSexe').style.display = sexeManquant ? '' : 'none';
  if (!sexeManquant) document.getElementById('sexe').value = profilCP.sexe;

  const elementsAttendus = ['localisation'];
  if (sexeManquant) elementsAttendus.push('sexe');
  if (profilCP.role === 'enseignant') elementsAttendus.push('établissement', 'classe');
  const derniere = elementsAttendus.pop();
  document.getElementById('texteComplement').textContent = elementsAttendus.length ? `${elementsAttendus.join(', ')} et ${derniere}` : derniere;

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

    const aDejaUneClasse = (enseignantCP?.classes_assignees || []).length > 0;
    let aUneDemande = false;
    if (!aDejaUneClasse) {
      const { count } = await supabaseClient.from('demandes_classe_enseignant')
        .select('id', { count: 'exact', head: true }).eq('enseignant_id', profilCP.id);
      aUneDemande = !!count;
    }
    if (!aDejaUneClasse && !aUneDemande) {
      champClasse.style.display = '';
      const { data: classes } = await supabaseClient.from('classes').select('*').order('ordre');
      document.getElementById('classe').innerHTML = (classes || []).map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    } else {
      champClasse.style.display = 'none';
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
