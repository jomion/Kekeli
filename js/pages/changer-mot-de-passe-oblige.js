// ============================================================
// pages/changer-mot-de-passe-oblige.html — changement de mot de passe
// obligatoire, imposé (avant toute autre page) à un compte créé par un
// administrateur avec un mot de passe temporaire (profils
// .doit_changer_mot_de_passe) — voir chargerSessionEtProfil() dans
// js/auth-utilisateur.js et requireAdmin() dans js/auth-admin.js, qui
// redirigent vers cette page. Un compte auto-inscrit n'a jamais ce
// drapeau à vrai (il a choisi son propre mot de passe à l'inscription).
// ============================================================

async function initChangerMotDePasseOblige() {
  // chargerSessionEtProfil() gère déjà, avec les redirections adéquates :
  // pas de session -> connexion ; compte désactivé -> connexion ; accès
  // élève restreint par un parent -> connexion. Cette page est exemptée par
  // cette même fonction de la redirection vers elle-même.
  const profil = await chargerSessionEtProfil();
  if (!profil) return;

  // Compte déjà en règle (arrivée directe sur cette page par erreur ou par
  // curiosité) : rien à faire ici, retour à son espace habituel.
  if (profil.doit_changer_mot_de_passe !== true) {
    window.location.href = urlTableauDeBord(profil.role);
    return;
  }

  document.getElementById('zoneChargement').style.display = 'none';
  document.getElementById('zoneFormulaire').style.display = 'block';

  document.getElementById('formChangerMotDePasse').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageErreur = document.getElementById('messageErreur');
    const btn = document.getElementById('btnValider');
    messageErreur.textContent = '';

    const nouveauMotDePasse = document.getElementById('nouveauMotDePasse').value;
    const confirmationMotDePasse = document.getElementById('confirmationMotDePasse').value;

    if (nouveauMotDePasse.length < 6) {
      messageErreur.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
      return;
    }
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      messageErreur.textContent = "Les deux mots de passe ne correspondent pas.";
      return;
    }

    btn.disabled = true; btn.textContent = 'Enregistrement...';

    const { error: erreurMaj } = await supabaseClient.auth.updateUser({ password: nouveauMotDePasse });
    if (erreurMaj) {
      messageErreur.textContent = "Impossible d'enregistrer ce mot de passe : " + erreurMaj.message;
      btn.disabled = false; btn.textContent = 'Choisir ce mot de passe';
      return;
    }

    // Le drapeau n'est levé QU'APRÈS le succès du changement de mot de
    // passe — via une fonction serveur dédiée (profils
    // .doit_changer_mot_de_passe n'est pas modifiable directement par le
    // client, voir sa définition).
    await supabaseClient.rpc('confirmer_changement_mot_de_passe');

    window.location.href = urlTableauDeBord(profil.role);
  });
}

initChangerMotDePasseOblige();
