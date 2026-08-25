// Page pages/parent/tableau-de-bord.html

let profilParent = null;

(async function () {
  profilParent = await requireRole('parent');
  if (!profilParent) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profilParent.prenom} ${profilParent.nom}`;

  await afficherTableauDeBord();
})();

async function afficherTableauDeBord() {
  const { data: enfants } = await supabaseClient
    .from('parent_eleve')
    .select('eleve_id, profils:eleve_id(prenom, nom)')
    .eq('parent_id', profilParent.id);

  const listeEnfants = (enfants && enfants.length > 0)
    ? enfants.map(e => `<li>${e.profils?.prenom || ''} ${e.profils?.nom || ''}</li>`).join('')
    : `<li>Aucun enfant inscrit pour l'instant.</li>`;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profilParent.prenom} !</h1>
      <p>Voici votre espace parent KEKELI.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">Mes enfants</h1>
      <ul style="color:var(--text-gris);padding-left:20px">${listeEnfants}</ul>
    </div>

    <div class="grille-actions-tb">
      <div class="carte-action-tb disponible">
        <div class="icone-action-tb">➕</div>
        <h3>Inscrire un enfant</h3>
        <p>Créer le compte de votre enfant pour qu'il accède à son espace.</p>
        <button class="btn btn-filled" id="btnInscrireEnfant">Inscrire</button>
      </div>
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">📊</div>
        <h3>Suivi des devoirs et notes</h3>
        <p>Bientôt disponible.</p>
      </div>
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
