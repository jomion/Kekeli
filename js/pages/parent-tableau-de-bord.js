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
    const { data: profilsEnfants } = await supabaseClient.from('profils').select('id, prenom, nom').in('id', idsEnfants);
    enfants = profilsEnfants || [];

    const { data: abonnements } = await supabaseClient
      .from('abonnements_enseignant_eleve')
      .select('*, profils:enseignant_id(prenom, nom)')
      .in('eleve_id', idsEnfants);
    (abonnements || []).forEach(a => { (abonnementsParEnfant[a.eleve_id] ??= []).push(a); });
  }

  const LIBELLES_STATUT_AB = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' };
  const blocEnfants = enfants.length > 0 ? enfants.map(e => `
    <div style="border-bottom:1px solid var(--bordure);padding:12px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <strong>${e.prenom} ${e.nom}</strong>
        <button class="btn btn-filled" data-suivre-enfant="${e.id}" style="padding:6px 14px;font-size:12px">🔗 Suivre un enseignant</button>
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        ${(abonnementsParEnfant[e.id] || []).map(a => `
          <span class="pastille-statut pastille-${a.statut === 'accepte' ? 'rendu' : a.statut === 'refuse' ? 'en_retard' : 'a_faire'}">
            ${a.profils?.prenom || ''} ${a.profils?.nom || ''} — ${LIBELLES_STATUT_AB[a.statut]}
          </span>`).join('') || '<span style="font-size:12px;color:var(--text-gris)">Aucun enseignant suivi pour l\'instant.</span>'}
      </div>
    </div>`).join('') : `<p style="color:var(--text-gris)">Aucun enfant inscrit pour l'instant.</p>`;

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
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie enseignant</h3>
        <p>Bientôt disponible.</p>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💳</div>
        <h3>Paiement des frais</h3>
        <p>Bientôt disponible.</p>
      </div>
    </div>
  `;

  document.getElementById('btnInscrireEnfant').addEventListener('click', ouvrirInscriptionEnfant);
  document.querySelectorAll('[data-suivre-enfant]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirDemandeSuivi(btn.dataset.suivreEnfant));
  });
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

  ouvrirModal({
    titre: 'Inscrire un enfant',
    champs: [
      { nom: 'prenom', label: 'Prénom de l\'enfant' },
      { nom: 'nom', label: 'Nom de l\'enfant' },
      { nom: 'classe', label: 'Classe', type: 'select', options: (classes || []).map(c => ({ valeur: c.id, label: c.nom })) },
      { nom: 'identifiant', label: 'Identifiant de connexion', placeholder: 'Ex: prenom.classe (ex: biodun.cm2)' },
      { nom: 'motDePasse', label: 'Mot de passe', type: 'password', placeholder: '6 caractères min.' }
    ],
    texteValider: 'Créer le compte',
    onValider: (valeurs) => confirmerInscriptionEnfant(valeurs)
  });
}

async function confirmerInscriptionEnfant({ prenom, nom, classe, identifiant, motDePasse }) {
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
    id: enfantId, role: 'eleve', nom, prenom, identifiant: identifiant.trim().toLowerCase(), email
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
