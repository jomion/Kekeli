// Page pages/parent/tableau-de-bord.html

let profilParent = null;

(async function () {
  profilParent = await requireRole('parent');
  if (!profilParent) return;

  await initEnteteNavigation({
    role: 'parent', utilisateurId: profilParent.id,
    badgeHtml: `🟢 ${echapperParentTB(profilParent.prenom)} ${echapperParentTB(profilParent.nom)}`,
    liens: liensAvecPrefixe('parent', '')
  });

  await afficherTableauDeBord();
})();

async function afficherTableauDeBord() {
  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilParent.id);
  const idsEnfants = (liens || []).map(l => l.eleve_id);

  let enfants = [];
  let abonnementsParEnfant = {};
  let connectiviteParEnfant = {};
  if (idsEnfants.length > 0) {
    const { data: profilsEnfants } = await supabaseClient.from('profils').select('id, prenom, nom, sexe, departement, commune, arrondissement').in('id', idsEnfants);
    enfants = profilsEnfants || [];

    const { data: abonnements } = await supabaseClient
      .from('abonnements_enseignant_eleve')
      .select('*, enseignants(profils(prenom, nom))')
      .in('eleve_id', idsEnfants);
    (abonnements || []).forEach(a => { (abonnementsParEnfant[a.eleve_id] ??= []).push(a); });

    // Contrôle parental de la connectivité (Task #38) : compte_actif,
    // horaires_autorises et derniere_activite vivent sur `eleves`, pas `profils`.
    // classe_id sert aussi à l'aperçu au survol ci-dessous (Task #34).
    const { data: statutsConnectivite } = await supabaseClient.from('eleves')
      .select('id, classe_id, compte_actif, horaires_autorises, derniere_activite, messagerie_autorisee').in('id', idsEnfants);
    (statutsConnectivite || []).forEach(s => { connectiviteParEnfant[s.id] = s; });
  }

  // Aperçu au survol (Task #34) — voir js/apercu-survol.js.
  const idsClassesEnfants = [...new Set(Object.values(connectiviteParEnfant).map(s => s.classe_id).filter(Boolean))];
  let apercuDevoirsParent = [];
  if (idsClassesEnfants.length) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { data: devoirsAVenirParent } = await supabaseClient.from('devoirs')
      .select('titre, date_limite').in('classe_id', idsClassesEnfants).eq('statut', 'publie').gte('date_limite', aujourdhui).order('date_limite').limit(8);
    apercuDevoirsParent = (devoirsAVenirParent || []).map(d => `${d.titre} — ${new Date(d.date_limite).toLocaleDateString('fr-FR')}`);
  }
  const apercuEnseignantsParent = [...new Set(Object.values(abonnementsParEnfant).flat()
    .filter(a => a.statut === 'accepte')
    .map(a => `${a.enseignants?.profils?.prenom || ''} ${a.enseignants?.profils?.nom || ''}`.trim())
    .filter(Boolean))];

  const LIBELLES_STATUT_AB = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' };
  const blocEnfants = enfants.length > 0 ? enfants.map(e => {
    // Regroupe désormais aussi le sexe (demandé le 4 septembre 2026 pour les
    // comptes enfant créés avant l'ajout de ce champ) — même bouton "⚠️
    // Compléter les informations", voir ouvrirCompletionLocalisationEnfant.
    const localisationIncomplete = !e.departement || !e.commune || !e.arrondissement || !e.sexe;
    const statutConn = connectiviteParEnfant[e.id] || { compte_actif: true, horaires_autorises: null, derniere_activite: null };
    const acces = statutConn.compte_actif === false
      ? '<span style="font-size:12px;color:var(--rouge)">🔴 Accès suspendu</span>'
      : (statutConn.horaires_autorises ? '<span style="font-size:12px;color:#B45309">🟡 Horaires limités</span>' : '<span style="font-size:12px;color:#15803D">🟢 Accès libre</span>');
    return `
    <div style="border-bottom:1px solid var(--bordure);padding:12px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong>${e.prenom} ${e.nom}</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${localisationIncomplete ? `<button class="btn btn-deconnexion-public" data-completer-localisation="${e.id}" style="padding:6px 14px;font-size:12px;color:#B45309;border-color:#B45309">⚠️ Compléter les informations</button>` : ''}
          <button class="btn btn-filled" data-suivre-enfant="${e.id}" style="padding:6px 14px;font-size:12px">🔗 Suivre un enseignant</button>
          <button class="btn btn-deconnexion-public" data-controle-connectivite="${e.id}" style="padding:6px 14px;font-size:12px">🔒 Contrôle d'accès</button>
          <button class="btn btn-deconnexion-public" data-controle-messagerie="${e.id}" style="padding:6px 14px;font-size:12px">✨ Messagerie Premium</button>
        </div>
      </div>
      <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        ${acces}
        <span style="font-size:12px;color:var(--text-gris)">Dernière activité : ${formaterDerniereActivite(statutConn.derniere_activite)}</span>
        ${statutConn.messagerie_autorisee ? '<span style="font-size:12px;color:#15803D">💬 Messagerie autorisée</span>' : '<span style="font-size:12px;color:var(--text-gris)">💬 Messagerie non autorisée</span>'}
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        ${(abonnementsParEnfant[e.id] || []).map(a => rendreLignePastilleAB(a)).join('') || '<span style="font-size:12px;color:var(--text-gris)">Aucun enseignant suivi pour l\'instant.</span>'}
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--text-gris)">Aucun enfant inscrit pour l'instant.</p>`;

  function rendreLignePastilleAB(a) {
    const demandeParEnseignant = a.demande_par === a.enseignant_id;
    let actions = '';
    if (a.statut === 'en_attente' && demandeParEnseignant) {
      actions = `
        <button class="btn btn-filled" data-accepter-demande-ens="${a.id}" style="padding:3px 10px;font-size:11px">✅ Accepter</button>
        <button class="btn btn-deconnexion-public" data-refuser-demande-ens="${a.id}" style="padding:3px 10px;font-size:11px;color:var(--rouge);border-color:var(--rouge)">✕ Refuser</button>`;
    } else if (a.statut === 'en_attente') {
      actions = `<button data-annuler-abonnement="${a.id}" data-statut-ab="${a.statut}" title="Annuler la demande" style="background:none;border:none;cursor:pointer;font-size:12px;color:inherit">✕</button>`;
    } else if (a.statut === 'accepte') {
      actions = `
        <a href="messagerie.html?abonnement=${a.id}" style="font-size:11px;text-decoration:underline;color:inherit">💬 Message</a>
        <button data-annuler-abonnement="${a.id}" data-statut-ab="${a.statut}" title="Arrêter le suivi" style="background:none;border:none;cursor:pointer;font-size:12px;color:inherit">✕</button>`;
    }
    return `
      <span class="pastille-statut pastille-${a.statut === 'accepte' ? 'rendu' : a.statut === 'refuse' ? 'en_retard' : 'a_faire'}" style="display:inline-flex;align-items:center;gap:6px">
        ${a.enseignants?.profils?.prenom || ''} ${a.enseignants?.profils?.nom || ''} — ${LIBELLES_STATUT_AB[a.statut]}${a.statut === 'en_attente' && demandeParEnseignant ? ' (demande de l\'enseignant)' : ''}
        ${actions}
      </span>`;
  }

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profilParent.prenom} !</h1>
      <p>Voici votre espace parent KEKELI.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">Mes enfants</h1>
      ${blocEnfants}
    </div>

    <div class="grille-actions-tb">
      <div class="carte-action-tb disponible">
        <div class="icone-action-tb">➕</div>
        <h3>Inscrire un enfant</h3>
        <p>Créer le compte de votre enfant pour qu'il accède à son espace.</p>
        <button class="btn btn-filled" id="btnInscrireEnfant">Inscrire</button>
      </div>
      <a href="devoirs-notes.html" class="carte-action-tb disponible carte-apercu-hover" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">📊</div>
        <h3>Suivi des devoirs et notes</h3>
        <p>Consulter les devoirs et évaluations de vos enfants.</p>
        ${bulleApercuHtml('Devoirs à venir', apercuDevoirsParent)}
      </a>
      ${Object.values(abonnementsParEnfant).some(liste => liste.some(a => a.statut === 'accepte')) ? `
      <a href="messagerie.html" class="carte-action-tb disponible carte-apercu-hover" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie enseignant</h3>
        <p>Échanger avec les enseignants qui suivent vos enfants.</p>
        ${bulleApercuHtml('Enseignants suivis', apercuEnseignantsParent, echapperParentTB)}
      </a>` : `
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie enseignant</h3>
        <p>Disponible dès qu'un enseignant suit un de vos enfants.</p>
      </div>`}
      <a href="paiements.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">💳</div>
        <h3>Paiement des frais</h3>
        <p>Consulter l'historique des paiements de vos enfants.</p>
      </a>
    </div>
  `;

  document.getElementById('btnInscrireEnfant').addEventListener('click', ouvrirInscriptionEnfant);
  document.querySelectorAll('[data-suivre-enfant]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirDemandeSuivi(btn.dataset.suivreEnfant));
  });
  document.querySelectorAll('[data-completer-localisation]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enfant = enfants.find(e => e.id === btn.dataset.completerLocalisation);
      if (enfant) ouvrirCompletionLocalisationEnfant(enfant);
    });
  });
  document.querySelectorAll('[data-controle-connectivite]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enfant = enfants.find(e => e.id === btn.dataset.controleConnectivite);
      const statutConn = connectiviteParEnfant[btn.dataset.controleConnectivite] || { compte_actif: true, horaires_autorises: null, derniere_activite: null };
      if (enfant) ouvrirControleConnectiviteEnfant(enfant, statutConn);
    });
  });
  document.querySelectorAll('[data-controle-messagerie]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enfant = enfants.find(e => e.id === btn.dataset.controleMessagerie);
      const statutConn = connectiviteParEnfant[btn.dataset.controleMessagerie] || { messagerie_autorisee: false };
      if (enfant) ouvrirControleMessagerieEnfant(enfant, statutConn);
    });
  });
  document.querySelectorAll('[data-annuler-abonnement]').forEach(btn => {
    btn.addEventListener('click', () => annulerAbonnement(parseInt(btn.dataset.annulerAbonnement, 10), btn.dataset.statutAb));
  });
  document.querySelectorAll('[data-accepter-demande-ens]').forEach(btn => {
    btn.addEventListener('click', () => repondreDemandeEnseignant(parseInt(btn.dataset.accepterDemandeEns, 10), 'accepte'));
  });
  document.querySelectorAll('[data-refuser-demande-ens]').forEach(btn => {
    btn.addEventListener('click', () => repondreDemandeEnseignant(parseInt(btn.dataset.refuserDemandeEns, 10), 'refuse'));
  });
}

async function annulerAbonnement(abonnementId, statutActuel) {
  const message = statutActuel === 'accepte' ? "Arrêter le suivi de cet enseignant ?" : 'Annuler cette demande ?';
  confirmerAction(message, async () => {
    const { error } = await supabaseClient.from('abonnements_enseignant_eleve').delete().eq('id', abonnementId);
    if (error) return alert(error.message);
    afficherTableauDeBord();
  });
}

async function repondreDemandeEnseignant(abonnementId, statut) {
  const { error } = await supabaseClient.from('abonnements_enseignant_eleve')
    .update({ statut, traite_le: new Date().toISOString() }).eq('id', abonnementId);
  if (error) return alert(error.message);
  afficherTableauDeBord();
}

function ouvrirDemandeSuivi(eleveId) {
  ouvrirModal({
    titre: "Demander le suivi d'un enseignant",
    champs: [{ nom: 'email', label: "E-mail de l'enseignant", type: 'email', placeholder: 'nom@exemple.com' }],
    texteValider: 'Envoyer la demande',
    onValider: async ({ email }) => {
      const { data: enseignants, error } = await supabaseClient.rpc('trouver_enseignant_par_email', { p_email: email });
      if (error) return alert(error.message);
      if (!enseignants || enseignants.length === 0) return alert("Aucun enseignant trouvé avec cet e-mail.");

      const { error: erreurDemande } = await supabaseClient.from('abonnements_enseignant_eleve').insert({
        eleve_id: eleveId, enseignant_id: enseignants[0].id, demande_par: profilParent.id, statut: 'en_attente'
      });
      if (erreurDemande) {
        if (erreurDemande.code === '23505') return alert('Une demande existe déjà pour cet enseignant.');
        return alert(erreurDemande.message);
      }
      alert(`Demande envoyée à ${enseignants[0].prenom} ${enseignants[0].nom}. Vous serez notifié(e) de sa réponse.`);
      afficherTableauDeBord();
    }
  });
}

async function ouvrirInscriptionEnfant() {
  // Une classe masquée par l'admin (mise à jour de contenu en cours) n'est
  // pas proposée pour un nouvel enfant, sans être supprimée pour autant.
  const { data: classes } = await supabaseClient.from('classes').select('*').eq('visible', true).order('ordre');

  // Département/Commune/Arrondissement sont désormais demandés pour l'élève
  // aussi (comme pour parent/enseignant) — préremplis avec ceux du parent
  // par défaut (rarement différents), mais modifiables ici.
  //
  // Important : la Commune et l'Arrondissement affichés au départ doivent
  // être calculés à partir de LA MÊME commune "effective", sinon la liste
  // d'Arrondissement se retrouve vide dès l'ouverture (donc ne se déploie
  // pas au clic) — par exemple si le parent n'a pas encore de commune
  // enregistrée, ou si sa commune ne correspond pas au département par
  // défaut retenu ci-dessous.
  const departementParDefaut = profilParent.departement || DEPARTEMENTS_BENIN[0];
  const communesDisponibles = COMMUNES_PAR_DEPARTEMENT[departementParDefaut] || [];
  const communeParDefaut = (profilParent.commune && communesDisponibles.includes(profilParent.commune))
    ? profilParent.commune
    : (communesDisponibles[0] || '');
  const arrondissementsDisponibles = ARRONDISSEMENTS_PAR_COMMUNE[communeParDefaut] || [];
  const arrondissementParDefaut = (communeParDefaut === profilParent.commune) ? (profilParent.arrondissement || '') : '';

  ouvrirModal({
    titre: 'Inscrire un enfant',
    champs: [
      { nom: 'prenom', label: 'Prénom de l\'enfant' },
      { nom: 'nom', label: 'Nom de l\'enfant' },
      { nom: 'sexe', label: 'Sexe', type: 'select', options: [{ valeur: 'M', label: 'Masculin' }, { valeur: 'F', label: 'Féminin' }] },
      { nom: 'classe', label: 'Classe', type: 'select', options: (classes || []).map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'identifiant', label: 'Identifiant de connexion', placeholder: 'Ex: prenom.classe (ex: biodun.cm2)' },
      { nom: 'motDePasse', label: 'Mot de passe', type: 'password', placeholder: '6 caractères min.' },
      { nom: 'departement', label: 'Département', type: 'select', valeur: departementParDefaut, options: DEPARTEMENTS_BENIN.map(d => ({ valeur: d, label: d })) },
      { nom: 'commune', label: 'Commune', type: 'select', valeur: communeParDefaut, options: communesDisponibles.map(c => ({ valeur: c, label: c })), dependDe: 'departement', optionsSelonDependance: (dep) => (COMMUNES_PAR_DEPARTEMENT[dep] || []).map(c => ({ valeur: c, label: c })) },
      { nom: 'arrondissement', label: 'Arrondissement', type: 'select', valeur: arrondissementParDefaut, options: arrondissementsDisponibles.map(a => ({ valeur: a, label: a })), dependDe: 'commune', optionsSelonDependance: (com) => (ARRONDISSEMENTS_PAR_COMMUNE[com] || []).map(a => ({ valeur: a, label: a })) }
    ],
    texteValider: 'Créer le compte',
    onValider: (valeurs) => confirmerInscriptionEnfant(valeurs)
  });
}

async function confirmerInscriptionEnfant({ prenom, nom, sexe, classe, identifiant, motDePasse, departement, commune, arrondissement }) {
  if (!motDePasse || motDePasse.length < 6) return alert('Le mot de passe doit contenir au moins 6 caractères.');

  const parentId = profilParent.id; // capturé AVANT le changement de session
  const email = `${identifiant.trim().toLowerCase()}@eleves.kekeli.app`;

  const { data, error } = await supabaseClient.auth.signUp({ email, password: motDePasse });
  if (error) return alert("Erreur lors de la création du compte : " + error.message);
  const enfantId = data.user?.id;
  if (!enfantId) return alert("Le compte n'a pas pu être créé.");

  // À partir d'ici, le client est authentifié comme l'ENFANT (pas le parent) —
  // c'est une limitation du SDK client sans fonction serveur dédiée.
  const { error: erreurProfil } = await supabaseClient.from('profils').insert({
    id: enfantId, role: 'eleve', nom, prenom, sexe: sexe || null, identifiant: identifiant.trim().toLowerCase(), email,
    departement: departement || null, commune: commune || null, arrondissement: (arrondissement || '').trim() || null
  });
  if (erreurProfil) return alert(erreurProfil.message);

  const { error: erreurEleve } = await supabaseClient.from('eleves').insert({
    id: enfantId, classe_id: parseInt(classe, 10), mascotte: '🦁'
  });
  if (erreurEleve) return alert(erreurEleve.message);

  const { error: erreurLien } = await supabaseClient.from('parent_eleve').insert({ parent_id: parentId, eleve_id: enfantId });
  if (erreurLien) return alert(erreurLien.message);

  // On déconnecte l'enfant et on renvoie le parent se reconnecter —
  // c'est la seule façon fiable de lui rendre sa propre session ici.
  await supabaseClient.auth.signOut();
  window.location.href = '../login.html?enfant_cree=1';
}

// Complète Département/Commune/Arrondissement pour un enfant inscrit avant
// l'ajout de ces champs. Le parent n'étant pas connecté "en tant que"
// l'enfant, la mise à jour passe par la fonction serveur
// completer_localisation_enfant() (SECURITY DEFINER), qui vérifie elle-même
// le lien parent_eleve avant d'écrire.
function ouvrirCompletionLocalisationEnfant(enfant) {
  const departementParDefaut = enfant.departement || profilParent.departement || DEPARTEMENTS_BENIN[0];
  const communesDisponibles = COMMUNES_PAR_DEPARTEMENT[departementParDefaut] || [];
  // Même précaution que pour l'inscription d'un enfant : caler l'Arrondissement
  // initial sur la commune réellement affichée, pas sur enfant.commune brut.
  const communeParDefaut = (enfant.commune && communesDisponibles.includes(enfant.commune))
    ? enfant.commune
    : (communesDisponibles[0] || '');
  const arrondissementsDisponibles = ARRONDISSEMENTS_PAR_COMMUNE[communeParDefaut] || [];
  const arrondissementParDefaut = (communeParDefaut === enfant.commune) ? (enfant.arrondissement || '') : '';

  ouvrirModal({
    titre: `Compléter les informations de ${enfant.prenom}`,
    champs: [
      // Sexe ajouté le 4 septembre 2026 pour les comptes enfant créés avant
      // ce champ — même select que l'inscription (voir "Inscrire un enfant"
      // plus haut).
      { nom: 'sexe', label: 'Sexe', type: 'select', valeur: enfant.sexe || '', options: [{ valeur: 'M', label: 'Masculin' }, { valeur: 'F', label: 'Féminin' }] },
      { nom: 'departement', label: 'Département', type: 'select', valeur: departementParDefaut, options: DEPARTEMENTS_BENIN.map(d => ({ valeur: d, label: d })) },
      { nom: 'commune', label: 'Commune', type: 'select', valeur: communeParDefaut, options: communesDisponibles.map(c => ({ valeur: c, label: c })), dependDe: 'departement', optionsSelonDependance: (dep) => (COMMUNES_PAR_DEPARTEMENT[dep] || []).map(c => ({ valeur: c, label: c })) },
      { nom: 'arrondissement', label: 'Arrondissement', type: 'select', valeur: arrondissementParDefaut, options: arrondissementsDisponibles.map(a => ({ valeur: a, label: a })), dependDe: 'commune', optionsSelonDependance: (com) => (ARRONDISSEMENTS_PAR_COMMUNE[com] || []).map(a => ({ valeur: a, label: a })) }
    ],
    texteValider: 'Enregistrer',
    onValider: async ({ sexe, departement, commune, arrondissement }) => {
      const { error } = await supabaseClient.rpc('completer_localisation_enfant', {
        p_eleve_id: enfant.id, p_departement: departement || null, p_commune: commune || null, p_arrondissement: (arrondissement || '').trim() || null,
        p_sexe: sexe || null
      });
      if (error) return alert(error.message);
      afficherTableauDeBord();
    }
  });
}

// --- CONTRÔLE PARENTAL DE LA CONNECTIVITÉ (Task #38) ----------------------
// Le parent choisit ici, pour chaque enfant : couper l'accès entièrement
// (compte_actif), et/ou le limiter à des plages horaires par jour de la
// semaine (horaires_autorises — voir js/auth-utilisateur.js, qui applique
// ces réglages à la connexion ET en cours de session). Un jour non coché =
// bloqué ce jour-là ; "Limiter aux heures suivantes" décoché = pas de
// restriction horaire du tout (horaires_autorises = null).

const JOURS_SEMAINE_CONNECTIVITE = [
  { cle: '1', label: 'Lundi' },
  { cle: '2', label: 'Mardi' },
  { cle: '3', label: 'Mercredi' },
  { cle: '4', label: 'Jeudi' },
  { cle: '5', label: 'Vendredi' },
  { cle: '6', label: 'Samedi' },
  { cle: '0', label: 'Dimanche' }
];

function formaterDerniereActivite(iso) {
  if (!iso) return "Jamais connecté(e)";
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function ouvrirControleConnectiviteEnfant(enfant, statut) {
  const horaires = statut.horaires_autorises || null;
  const restreint = !!horaires;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite">
      <h3>🔒 Contrôle d'accès — ${echapperParentTB(enfant.prenom)}</h3>
      <p style="font-size:13px;color:var(--text-gris);margin-top:-8px">Dernière activité : ${formaterDerniereActivite(statut.derniere_activite)}</p>
      <form id="formControleConnectivite">
        <label class="champ-modal" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" name="compteActif" ${statut.compte_actif !== false ? 'checked' : ''}> Accès autorisé
        </label>
        <label class="champ-modal" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" id="chkRestreindreHoraires" ${restreint ? 'checked' : ''}> Limiter aux heures suivantes
        </label>
        <div id="zoneHorairesConnectivite" style="${restreint ? '' : 'display:none'}">
          ${JOURS_SEMAINE_CONNECTIVITE.map(j => {
            const plage = horaires && horaires[j.cle] && horaires[j.cle][0];
            const coche = !!plage;
            const debut = plage ? plage[0] : '07:00';
            const fin = plage ? plage[1] : '19:00';
            return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <label style="display:flex;align-items:center;gap:6px;min-width:100px;font-weight:normal">
                <input type="checkbox" class="chk-jour-horaire" data-jour="${j.cle}" ${coche ? 'checked' : ''}> ${j.label}
              </label>
              <input type="time" class="heure-debut-jour" data-jour="${j.cle}" value="${debut}" ${coche ? '' : 'disabled'}>
              <span>à</span>
              <input type="time" class="heure-fin-jour" data-jour="${j.cle}" value="${fin}" ${coche ? '' : 'disabled'}>
            </div>`;
          }).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
          <button type="submit" class="btn btn-primaire">Enregistrer</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  document.addEventListener('keydown', function echap(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } });

  const chkRestreindre = overlay.querySelector('#chkRestreindreHoraires');
  const zoneHoraires = overlay.querySelector('#zoneHorairesConnectivite');
  chkRestreindre.addEventListener('change', () => { zoneHoraires.style.display = chkRestreindre.checked ? '' : 'none'; });

  overlay.querySelectorAll('.chk-jour-horaire').forEach(chk => {
    chk.addEventListener('change', () => {
      const jour = chk.dataset.jour;
      overlay.querySelector(`.heure-debut-jour[data-jour="${jour}"]`).disabled = !chk.checked;
      overlay.querySelector(`.heure-fin-jour[data-jour="${jour}"]`).disabled = !chk.checked;
    });
  });

  overlay.querySelector('#formControleConnectivite').addEventListener('submit', async (e) => {
    e.preventDefault();
    const compteActif = overlay.querySelector('[name="compteActif"]').checked;
    let horairesAutorises = null;
    if (chkRestreindre.checked) {
      horairesAutorises = {};
      overlay.querySelectorAll('.chk-jour-horaire').forEach(chk => {
        if (!chk.checked) return;
        const jour = chk.dataset.jour;
        const debut = overlay.querySelector(`.heure-debut-jour[data-jour="${jour}"]`).value;
        const fin = overlay.querySelector(`.heure-fin-jour[data-jour="${jour}"]`).value;
        if (debut && fin) horairesAutorises[jour] = [[debut, fin]];
      });
    }
    fermer();
    const { error } = await supabaseClient.from('eleves').update({ compte_actif: compteActif, horaires_autorises: horairesAutorises }).eq('id', enfant.id);
    if (error) return alert(error.message);
    afficherTableauDeBord();
  });
}

// Messagerie instantanée (Premium) : nécessite les DEUX conditions —
// l'abonnement Premium famille/élève actif (côté paiement, voir la page
// Abonnements admin) ET cette autorisation parentale explicite, propre à
// chaque enfant. On affiche l'état de l'abonnement pour éviter qu'un parent
// pense avoir "activé" la messagerie alors qu'il ne manque que le paiement,
// ou l'inverse.
async function ouvrirControleMessagerieEnfant(enfant, statut) {
  const accesPremium = await supabaseClient.rpc('a_acces_premium_eleve', { p_eleve_id: enfant.id });
  const aPremium = !!accesPremium.data;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite">
      <h3>✨ Messagerie Premium — ${echapperParentTB(enfant.prenom)}</h3>
      <p style="font-size:13px;color:var(--text-gris);margin-top:-8px">
        ${aPremium
          ? '✅ Abonnement Premium actif pour ce foyer/enfant.'
          : '⚠️ Aucun abonnement Premium actif pour l\'instant — la messagerie restera bloquée pour votre enfant tant que ce n\'est pas le cas, même si vous cochez la case ci-dessous (voir la page Paiements/Abonnements).'}
      </p>
      <form id="formControleMessagerie">
        <label class="champ-modal" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" name="messagerieAutorisee" ${statut.messagerie_autorisee ? 'checked' : ''}> Autoriser ${echapperParentTB(enfant.prenom)} à utiliser la messagerie instantanée (avec ses enseignants et ses camarades de classe)
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
          <button type="submit" class="btn btn-primaire">Enregistrer</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  document.addEventListener('keydown', function echap(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } });

  overlay.querySelector('#formControleMessagerie').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messagerieAutorisee = overlay.querySelector('[name="messagerieAutorisee"]').checked;
    fermer();
    const { error } = await supabaseClient.from('eleves').update({ messagerie_autorisee: messagerieAutorisee }).eq('id', enfant.id);
    if (error) return alert(error.message);
    afficherTableauDeBord();
  });
}

function echapperParentTB(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
