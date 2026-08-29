// Page pages/parent/tableau-de-bord.html

let profilParent = null;

(async function () {
  profilParent = await requireRole('parent');
  if (!profilParent) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profilParent.prenom} ${profilParent.nom}`;
  initClocheNotifications('zoneCloche', profilParent.id);

  await afficherTableauDeBord();
})();

async function afficherTableauDeBord() {
  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilParent.id);
  const idsEnfants = (liens || []).map(l => l.eleve_id);

  let enfants = [];
  let abonnementsParEnfant = {};
  if (idsEnfants.length > 0) {
    const { data: profilsEnfants } = await supabaseClient.from('profils').select('id, prenom, nom, departement, commune, arrondissement').in('id', idsEnfants);
    enfants = profilsEnfants || [];

    const { data: abonnements } = await supabaseClient
      .from('abonnements_enseignant_eleve')
      .select('*, enseignants(profils(prenom, nom))')
      .in('eleve_id', idsEnfants);
    (abonnements || []).forEach(a => { (abonnementsParEnfant[a.eleve_id] ??= []).push(a); });
  }

  const LIBELLES_STATUT_AB = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' };
  const blocEnfants = enfants.length > 0 ? enfants.map(e => {
    const localisationIncomplete = !e.departement || !e.commune || !e.arrondissement;
    return `
    <div style="border-bottom:1px solid var(--bordure);padding:12px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong>${e.prenom} ${e.nom}</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${localisationIncomplete ? `<button class="btn btn-deconnexion-public" data-completer-localisation="${e.id}" style="padding:6px 14px;font-size:12px;color:#B45309;border-color:#B45309">⚠️ Compléter les informations</button>` : ''}
          <button class="btn btn-filled" data-suivre-enfant="${e.id}" style="padding:6px 14px;font-size:12px">🔗 Suivre un enseignant</button>
        </div>
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
      <a href="devoirs-notes.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">📊</div>
        <h3>Suivi des devoirs et notes</h3>
        <p>Consulter les devoirs et évaluations de vos enfants.</p>
      </a>
      ${Object.values(abonnementsParEnfant).some(liste => liste.some(a => a.statut === 'accepte')) ? `
      <a href="messagerie.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie enseignant</h3>
        <p>Échanger avec les enseignants qui suivent vos enfants.</p>
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
  const { data: classes } = await supabaseClient.from('classes').select('*').order('ordre');

  // Département/Commune/Arrondissement sont désormais demandés pour l'élève
  // aussi (comme pour parent/enseignant) — préremplis avec ceux du parent
  // par défaut (rarement différents), mais modifiables ici.
  const departementParDefaut = profilParent.departement || DEPARTEMENTS_BENIN[0];
  const communesDisponibles = COMMUNES_PAR_DEPARTEMENT[departementParDefaut] || [];

  ouvrirModal({
    titre: 'Inscrire un enfant',
    champs: [
      { nom: 'prenom', label: 'Prénom de l\'enfant' },
      { nom: 'nom', label: 'Nom de l\'enfant' },
      { nom: 'classe', label: 'Classe', type: 'select', options: (classes || []).map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'identifiant', label: 'Identifiant de connexion', placeholder: 'Ex: prenom.classe (ex: biodun.cm2)' },
      { nom: 'motDePasse', label: 'Mot de passe', type: 'password', placeholder: '6 caractères min.' },
      { nom: 'departement', label: 'Département', type: 'select', valeur: departementParDefaut, options: DEPARTEMENTS_BENIN.map(d => ({ valeur: d, label: d })) },
      { nom: 'commune', label: 'Commune', type: 'select', valeur: profilParent.commune, options: communesDisponibles.map(c => ({ valeur: c, label: c })), dependDe: 'departement', optionsSelonDependance: (dep) => (COMMUNES_PAR_DEPARTEMENT[dep] || []).map(c => ({ valeur: c, label: c })) },
      { nom: 'arrondissement', label: 'Arrondissement', type: 'select', valeur: profilParent.arrondissement || '', options: (ARRONDISSEMENTS_PAR_COMMUNE[profilParent.commune] || []).map(a => ({ valeur: a, label: a })), dependDe: 'commune', optionsSelonDependance: (com) => (ARRONDISSEMENTS_PAR_COMMUNE[com] || []).map(a => ({ valeur: a, label: a })) }
    ],
    texteValider: 'Créer le compte',
    onValider: (valeurs) => confirmerInscriptionEnfant(valeurs)
  });
}

async function confirmerInscriptionEnfant({ prenom, nom, classe, identifiant, motDePasse, departement, commune, arrondissement }) {
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
    id: enfantId, role: 'eleve', nom, prenom, identifiant: identifiant.trim().toLowerCase(), email,
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

  ouvrirModal({
    titre: `Compléter les informations de ${enfant.prenom}`,
    champs: [
      { nom: 'departement', label: 'Département', type: 'select', valeur: departementParDefaut, options: DEPARTEMENTS_BENIN.map(d => ({ valeur: d, label: d })) },
      { nom: 'commune', label: 'Commune', type: 'select', valeur: enfant.commune || '', options: communesDisponibles.map(c => ({ valeur: c, label: c })), dependDe: 'departement', optionsSelonDependance: (dep) => (COMMUNES_PAR_DEPARTEMENT[dep] || []).map(c => ({ valeur: c, label: c })) },
      { nom: 'arrondissement', label: 'Arrondissement', type: 'select', valeur: enfant.arrondissement || '', options: (ARRONDISSEMENTS_PAR_COMMUNE[enfant.commune] || []).map(a => ({ valeur: a, label: a })), dependDe: 'commune', optionsSelonDependance: (com) => (ARRONDISSEMENTS_PAR_COMMUNE[com] || []).map(a => ({ valeur: a, label: a })) }
    ],
    texteValider: 'Enregistrer',
    onValider: async ({ departement, commune, arrondissement }) => {
      const { error } = await supabaseClient.rpc('completer_localisation_enfant', {
        p_eleve_id: enfant.id, p_departement: departement || null, p_commune: commune || null, p_arrondissement: (arrondissement || '').trim() || null
      });
      if (error) return alert(error.message);
      afficherTableauDeBord();
    }
  });
}
