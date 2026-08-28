// ============================================================
// Authentification KEKELI — parent / élève / enseignant
// (les administrateurs ont leur propre système : js/auth-admin.js)
//
// Règle métier : l'élève ne s'inscrit pas lui-même — c'est le parent
// qui l'ajoutera depuis son espace (étape à venir). Cette page ne
// permet donc l'inscription que pour "parent" et "enseignant".
// L'élève, lui, pourra seulement se CONNECTER (avec un identifiant
// fixé par son parent), une fois son compte créé.
//
// Chaque page qui utilise ce fichier doit définir au préalable :
//   const RACINE_SITE = "..."; // chemin relatif vers la racine du site
// ============================================================

const DOMAINE_IDENTIFIANT = 'eleves.kekeli.app'; // email technique pour les comptes sans e-mail réel (élèves)

function _racine() {
  return typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
}

function estUnEmail(valeur) {
  return /\S+@\S+\.\S+/.test(valeur || '');
}

function construireEmailInscription(identifiantOuEmail) {
  return estUnEmail(identifiantOuEmail) ? identifiantOuEmail : `${identifiantOuEmail.trim().toLowerCase()}@${DOMAINE_IDENTIFIANT}`;
}

async function resoudreEmailConnexion(identifiantOuEmail) {
  if (estUnEmail(identifiantOuEmail)) return identifiantOuEmail;
  const { data, error } = await supabaseClient.rpc('email_depuis_identifiant', { p_identifiant: identifiantOuEmail.trim().toLowerCase() });
  if (error || !data) return null;
  return data;
}

// --- INSCRIPTION (parent ou enseignant uniquement) -----------------------

async function inscrire({ role, prenom, nom, email, motDePasse }) {
  if (role !== 'parent' && role !== 'enseignant') {
    return { error: { message: "Ce type de compte ne peut pas s'inscrire directement." } };
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password: motDePasse });
  if (error) return { error };

  const userId = data.user?.id;
  if (!userId) return { error: { message: "Le compte n'a pas pu être créé. Réessayez." } };

  const { error: erreurProfil } = await supabaseClient.from('profils').insert({ id: userId, role, nom, prenom, email });
  if (erreurProfil) return { error: erreurProfil };

  const table = role === 'parent' ? 'parents' : 'enseignants';
  const { error: erreurRole } = await supabaseClient.from(table).insert({ id: userId });
  if (erreurRole) return { error: erreurRole };

  return { data };
}

// --- CONNEXION (élève, parent ou enseignant) ------------------------------

async function seConnecter(identifiantOuEmail, motDePasse) {
  const email = await resoudreEmailConnexion(identifiantOuEmail);
  if (!email) return { error: { message: "Identifiant ou e-mail introuvable." } };

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: motDePasse });
  if (error) return { error: { message: "Identifiant/e-mail ou mot de passe incorrect." } };

  const profil = await chargerProfil(data.user.id);
  if (!profil) return { error: { message: "Profil introuvable pour ce compte." } };
  if (!profil.actif) {
    await supabaseClient.auth.signOut();
    return { error: { message: "Ce compte a été désactivé." } };
  }
  return { data, profil };
}

async function chargerProfil(userId) {
  const { data, error } = await supabaseClient.from('profils').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

function urlTableauDeBord(role) {
  const racine = _racine();
  switch (role) {
    case 'eleve': return `${racine}pages/eleve/bienvenue.html`;
    case 'parent': return `${racine}pages/parent/tableau-de-bord.html`;
    case 'enseignant': return `${racine}pages/enseignant/bienvenue.html`;
    case 'admin': case 'super_admin': return `${racine}pages/navigation.html`;
    default: return `${racine}index.html`;
  }
}

function urlLogin() {
  return `${_racine()}pages/login.html`;
}

// À appeler en haut de chaque page réservée à un rôle :
//   const profil = await requireRole('parent');
//   if (!profil) return;
async function requireRole(roleAttendu) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = urlLogin(); return null; }

  const profil = await chargerProfil(session.user.id);
  if (!profil || !profil.actif) {
    await supabaseClient.auth.signOut();
    window.location.href = urlLogin();
    return null;
  }
  if (profil.role !== roleAttendu) {
    window.location.href = urlTableauDeBord(profil.role);
    return null;
  }
  return profil;
}

async function deconnecterUtilisateur() {
  await supabaseClient.auth.signOut();
  window.location.href = urlLogin();
}
