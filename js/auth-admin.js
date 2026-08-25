// ============================================================
// Authentification KEKELI v2 — administrateurs (admin / super_admin)
// Pas d'auto-inscription pour l'instant : les comptes admin sont créés
// à la main (cf. sql/01_fondation_roles_pedagogie.sql §6), ou plus tard
// via une page "Inviter un administrateur" réservée au super_admin.
//
// Chaque page qui utilise ce fichier doit d'abord définir :
//   const RACINE_SITE = "..."; // chemin relatif vers la racine du site
// ============================================================

function _racine() {
  return typeof RACINE_SITE === 'string' ? RACINE_SITE : '';
}

async function seConnecterAdmin(email, motDePasse) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: motDePasse });
  if (error) return { error: { message: "E-mail ou mot de passe incorrect." } };

  const profil = await chargerProfilAdmin(data.user.id);
  if (!profil) {
    await supabaseClient.auth.signOut();
    return { error: { message: "Ce compte n'est pas un compte administrateur." } };
  }
  if (!profil.actif) {
    await supabaseClient.auth.signOut();
    return { error: { message: "Ce compte a été désactivé." } };
  }

  return { profil };
}

async function chargerProfilAdmin(userId) {
  const { data: profil, error } = await supabaseClient.from('profils').select('*').eq('id', userId).single();
  if (error || !profil) return null;
  if (profil.role !== 'admin' && profil.role !== 'super_admin') return null;

  const { data: admin } = await supabaseClient.from('administrateurs').select('*').eq('id', userId).single();
  return { ...profil, ...admin };
}

// À appeler en haut de chaque page réservée aux administrateurs :
//   const profil = await requireAdmin();
//   if (!profil) return;
async function requireAdmin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = `${_racine()}pages/admin/connexion.html`;
    return null;
  }
  const profil = await chargerProfilAdmin(session.user.id);
  if (!profil) {
    await supabaseClient.auth.signOut();
    window.location.href = `${_racine()}pages/admin/connexion.html`;
    return null;
  }
  return profil;
}

async function deconnecterAdmin() {
  await supabaseClient.auth.signOut();
  window.location.href = `${_racine()}pages/admin/connexion.html`;
}
