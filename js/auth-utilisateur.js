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

// --- INSCRIPTION (parent, enseignant ou autorité pédagogique) ------------
//
// Champs de localisation (voir js/geo-benin.js pour Département/Commune) :
//   - parent : departement, commune, arrondissement
//   - enseignant : departement, commune, arrondissement, + circonscriptionScolaire,
//     zonePedagogique, ecole, et classeId (une classe lui est attribuée
//     directement — voir attribuer_classe_initiale_enseignant() côté base ;
//     toute classe SUPPLÉMENTAIRE repasse par la demande d'accès existante).
//   - autorite_pedagogique : departement, commune (sauf Directeur Départemental
//     qui n'a que departement), + selon la fonction : arrondissement (Directeur,
//     Conseiller Pédagogique, Inspecteur — pas Directeur Départemental),
//     circonscriptionScolaire, zonePedagogique, ecole (voir
//     FONCTIONS_AUTORITE_PEDAGOGIQUE ci-dessous).

const ROLES_INSCRIPTIBLES = ['parent', 'enseignant', 'autorite_pedagogique'];

// Rôles pour lesquels la localisation (et, pour l'enseignant, l'école/la
// classe) est obligatoire — utilisé aussi pour la page "compléter mon
// profil" qui rattrape les comptes créés avant cette mise à jour.
const ROLES_AVEC_LOCALISATION_OBLIGATOIRE = ['parent', 'enseignant', 'autorite_pedagogique'];

// Pour chaque fonction de l'Autorité Pédagogique, la liste des champs
// supplémentaires à demander et à enregistrer (en plus de departement).
// Arrondissement est exigé pour les fonctions qui se situent DANS la
// structure école (Directeur, Conseiller Pédagogique, Inspecteur) — pas
// pour le Directeur Départemental, qui s'arrête au niveau Département.
const FONCTIONS_AUTORITE_PEDAGOGIQUE = {
  directeur: { commune: true, arrondissement: true, circonscriptionScolaire: true, zonePedagogique: true, ecole: true },
  conseiller_pedagogique: { commune: true, arrondissement: true, circonscriptionScolaire: true, zonePedagogique: true, ecole: false },
  inspecteur: { commune: true, arrondissement: true, circonscriptionScolaire: true, zonePedagogique: false, ecole: false },
  directeur_departemental: { commune: false, arrondissement: false, circonscriptionScolaire: false, zonePedagogique: false, ecole: false }
};

async function inscrire({ role, prenom, nom, email, motDePasse, sexe, fonction, departement, commune, arrondissement, circonscriptionScolaire, zonePedagogique, ecole, classeId }) {
  if (!ROLES_INSCRIPTIBLES.includes(role)) {
    return { error: { message: "Ce type de compte ne peut pas s'inscrire directement." } };
  }
  if (role === 'autorite_pedagogique' && !FONCTIONS_AUTORITE_PEDAGOGIQUE[fonction]) {
    return { error: { message: "Choisissez une fonction valide pour l'Autorité Pédagogique." } };
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password: motDePasse });
  if (error) return { error };

  const userId = data.user?.id;
  if (!userId) return { error: { message: "Le compte n'a pas pu être créé. Réessayez." } };

  const champsFonction = role === 'autorite_pedagogique' ? FONCTIONS_AUTORITE_PEDAGOGIQUE[fonction] : null;

  const { error: erreurProfil } = await supabaseClient.from('profils').insert({
    id: userId, role, nom, prenom, email, sexe: sexe || null,
    departement: departement || null,
    commune: role === 'autorite_pedagogique' ? (champsFonction.commune ? (commune || null) : null) : (commune || null),
    arrondissement: role === 'autorite_pedagogique' ? (champsFonction.arrondissement ? (arrondissement || null) : null) : (arrondissement || null)
  });
  if (erreurProfil) return { error: erreurProfil };

  if (role === 'autorite_pedagogique') {
    const { error: erreurRole } = await supabaseClient.from('autorites_pedagogiques').insert({
      id: userId,
      fonction,
      circonscription_scolaire: champsFonction.circonscriptionScolaire ? (circonscriptionScolaire || null) : null,
      zone_pedagogique: champsFonction.zonePedagogique ? (zonePedagogique || null) : null,
      ecole: champsFonction.ecole ? (ecole || null) : null
    });
    if (erreurRole) return { error: erreurRole };
    return { data };
  }

  if (role === 'enseignant') {
    const { error: erreurEns } = await supabaseClient.from('enseignants').insert({
      id: userId,
      ecole: ecole || null,
      circonscription_scolaire: circonscriptionScolaire || null,
      zone_pedagogique: zonePedagogique || null
    });
    if (erreurEns) return { error: erreurEns };

    if (classeId) {
      // Attribution directe (pas de validation admin) de la classe choisie
      // à l'inscription — une seule fois par compte. Une éventuelle erreur
      // ici (ex. classe déjà attribuée par un autre biais) ne doit pas
      // empêcher la création du compte : elle est juste signalée.
      const { error: erreurClasse } = await supabaseClient.rpc('attribuer_classe_initiale_enseignant', { p_classe_id: parseInt(classeId, 10) });
      if (erreurClasse) return { data, avertissement: erreurClasse.message };
    }
    return { data };
  }

  const { error: erreurRole } = await supabaseClient.from('parents').insert({ id: userId });
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
  const acces = await verifierAccesEleveAutorise(profil);
  if (!acces.autorise) {
    await supabaseClient.auth.signOut();
    return { error: { message: acces.message } };
  }
  return { data, profil };
}

async function chargerProfil(userId) {
  const { data, error } = await supabaseClient.from('profils').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

// --- CONTRÔLE PARENTAL DE LA CONNECTIVITÉ (élève uniquement) --------------
//
// Un parent peut, depuis son tableau de bord (voir pages/parent/tableau-de-
// bord.html) : couper l'accès de son enfant (eleves.compte_actif), et/ou
// limiter les heures de connexion (eleves.horaires_autorises — plages par
// jour de semaine). Vérifié à la fois à la connexion (seConnecter) et à
// chaque chargement de page protégée (chargerSessionEtProfil), pour qu'une
// restriction posée par le parent prenne effet immédiatement, même si
// l'enfant était déjà connecté.

// horaires_autorises : { "0": [["07:00","19:00"]], "1": [...], ... }
// clé = Date#getDay() (0 = dimanche ... 6 = samedi). Jour absent ou vide =
// bloqué ce jour-là. null/undefined = pas de restriction horaire du tout.
function horaireActuelAutorise(horaires) {
  if (!horaires) return true;
  const maintenant = new Date();
  const plagesDuJour = horaires[String(maintenant.getDay())];
  if (!plagesDuJour || plagesDuJour.length === 0) return false;
  const hhmm = maintenant.toTimeString().slice(0, 5); // "HH:MM"
  return plagesDuJour.some(([debut, fin]) => debut && fin && hhmm >= debut && hhmm <= fin);
}

async function verifierAccesEleveAutorise(profil) {
  if (!profil || profil.role !== 'eleve') return { autorise: true };
  const { data: eleve } = await supabaseClient.from('eleves')
    .select('compte_actif, horaires_autorises').eq('id', profil.id).maybeSingle();
  if (!eleve) return { autorise: true }; // ligne introuvable -> on ne bloque pas par erreur technique
  if (eleve.compte_actif === false) {
    return { autorise: false, message: "Ton accès a été suspendu par un parent. Demande-lui de le réactiver." };
  }
  if (!horaireActuelAutorise(eleve.horaires_autorises)) {
    return { autorise: false, message: "Ton accès est limité à certaines heures par un parent. Réessaie plus tard." };
  }
  return { autorise: true };
}

function urlTableauDeBord(role) {
  const racine = _racine();
  switch (role) {
    case 'eleve': return `${racine}pages/eleve/bienvenue.html`;
    case 'parent': return `${racine}pages/parent/tableau-de-bord.html`;
    case 'enseignant': return `${racine}pages/enseignant/bienvenue.html`;
    case 'autorite_pedagogique': return `${racine}pages/autorite/bienvenue.html`;
    case 'admin': case 'super_admin': return `${racine}pages/navigation.html`;
    default: return `${racine}index.html`;
  }
}

function urlLogin() {
  return `${_racine()}pages/login.html`;
}

function urlCompleterProfil() {
  return `${_racine()}pages/completer-profil.html`;
}

async function chargerSessionEtProfil() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = urlLogin(); return null; }

  const profil = await chargerProfil(session.user.id);
  if (!profil || !profil.actif) {
    await supabaseClient.auth.signOut();
    window.location.href = urlLogin();
    return null;
  }
  const acces = await verifierAccesEleveAutorise(profil);
  if (!acces.autorise) {
    await supabaseClient.auth.signOut();
    window.location.href = `${urlLogin()}?bloque=${encodeURIComponent(acces.message)}`;
    return null;
  }
  memoriserDernierePageVisitee();
  return profil;
}

// Retient la page courante comme "dernière page visitée dans son espace",
// pour que le bouton "Accéder à mon espace" de l'accueil (index.html) y
// ramène directement au lieu de repasser par l'écran de connexion — voir
// index.html. On exclut volontairement les pages de connexion/inscription :
// il n'y a aucun sens à "revenir" dessus.
function memoriserDernierePageVisitee() {
  try {
    if (/\/(login|inscription|completer-profil)\.html$/i.test(window.location.pathname)) return;
    localStorage.setItem('kekeli_derniere_page', window.location.pathname + window.location.search);
  } catch (_e) { /* stockage indisponible -> tant pis, comportement par défaut conservé */ }
}

// Détermine si un compte doit passer par "compléter mon profil" avant de
// continuer — sert à rattraper les comptes créés avant l'ajout de la
// localisation (Département/Commune/Arrondissement), et pour l'enseignant,
// de l'École/Circonscription Scolaire/Zone Pédagogique/Classe.
async function profilEstIncomplet(profil) {
  if (!ROLES_AVEC_LOCALISATION_OBLIGATOIRE.includes(profil.role)) return false;
  // Sexe ajouté le 4 septembre 2026 : rattrape aussi les comptes créés avant
  // l'ajout de ce champ, avec le même mécanisme que la localisation — voir
  // "compléter mon profil" (pages/completer-profil.html).
  if (!profil.sexe) return true;
  if (!profil.departement) return true;

  if (profil.role === 'parent') {
    return !profil.commune || !profil.arrondissement;
  }

  if (profil.role === 'enseignant') {
    if (!profil.commune || !profil.arrondissement) return true;
    const { data: ens } = await supabaseClient.from('enseignants')
      .select('ecole, circonscription_scolaire, zone_pedagogique, classes_assignees').eq('id', profil.id).single();
    if (!ens || !ens.ecole || !ens.circonscription_scolaire || !ens.zone_pedagogique) return true;
    if ((ens.classes_assignees || []).length === 0) {
      const { count } = await supabaseClient.from('demandes_classe_enseignant')
        .select('id', { count: 'exact', head: true }).eq('enseignant_id', profil.id);
      if (!count) return true;
    }
    return false;
  }

  // autorite_pedagogique : dépend de la fonction (voir FONCTIONS_AUTORITE_PEDAGOGIQUE).
  const { data: autorite } = await supabaseClient.from('autorites_pedagogiques').select('*').eq('id', profil.id).single();
  if (!autorite) return true;
  const champs = FONCTIONS_AUTORITE_PEDAGOGIQUE[autorite.fonction];
  if (!champs) return false;
  if (champs.commune && !profil.commune) return true;
  if (champs.arrondissement && !profil.arrondissement) return true;
  if (champs.circonscriptionScolaire && !autorite.circonscription_scolaire) return true;
  if (champs.zonePedagogique && !autorite.zone_pedagogique) return true;
  if (champs.ecole && !autorite.ecole) return true;
  return false;
}

// Redirige vers la page "compléter mon profil" si nécessaire ; renvoie
// true si une redirection a eu lieu (l'appelant doit alors s'arrêter là).
async function redirigerSiProfilIncomplet(profil) {
  if (window.location.pathname.endsWith('completer-profil.html')) return false; // évite la boucle infinie
  if (await profilEstIncomplet(profil)) {
    const retour = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${urlCompleterProfil()}?retour=${retour}`;
    return true;
  }
  return false;
}

// À appeler en haut de chaque page réservée à un rôle :
//   const profil = await requireRole('parent');
//   if (!profil) return;
async function requireRole(roleAttendu) {
  const profil = await chargerSessionEtProfil();
  if (!profil) return null;
  if (profil.role !== roleAttendu) {
    window.location.href = urlTableauDeBord(profil.role);
    return null;
  }
  if (await redirigerSiProfilIncomplet(profil)) return null;
  // Thème rose pour les élèves filles (session du 4 septembre 2026, demande
  // explicite : "je veux que si l'enfant est une fille que le bleu soit
  // remplacé par une couleur rose"). Posé ici, au point d'entrée unique de
  // toutes les pages élève (avant même la construction de l'en-tête/sidebar
  // par initEnteteNavigation), plutôt que dans chaque page élève une par
  // une — voir la classe .theme-fille dans css/style-public.css (thème
  // classique) et css/theme-premium-eleve.css (thème premium).
  if (profil.role === 'eleve' && profil.sexe === 'F') {
    document.body.classList.add('theme-fille');
  }
  return profil;
}

async function deconnecterUtilisateur() {
  await supabaseClient.auth.signOut();
  window.location.href = urlLogin();
}
