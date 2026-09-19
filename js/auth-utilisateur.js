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
// Depuis le 12 septembre 2026 : l'inscription ne demande plus que l'essentiel
// (type de compte, prénom, nom, identifiant, e-mail à vérifier, mot de passe)
// — SAUF pour l'enseignant, qui doit toujours indiquer son école et choisir
// sa classe dès l'inscription (demande explicite, ces deux champs restent
// obligatoires). La localisation (Département/Commune/Arrondissement...) et
// le sexe sont, pour tous les rôles, désormais OPTIONNELS et se renseignent
// depuis "Mon profil" (pages/completer-profil.html — ce n'est plus une page
// de blocage mais un profil consulté/modifié volontairement, à tout moment).
//
// L'inscription "autorite_pedagogique" reste possible techniquement
// (fonction inscrire() ci-dessous), mais son option a été retirée du
// formulaire pages/inscription.html le 12 septembre 2026, le temps que sa
// navigation dédiée soit bien définie — à réactiver dans le <select> quand
// ce sera fait.

const ROLES_INSCRIPTIBLES = ['parent', 'enseignant', 'autorite_pedagogique'];

// Rôles pour lesquels la page "Mon profil" (pages/completer-profil.html)
// propose des champs de localisation (et, pour l'enseignant, l'école/la
// classe) — ces champs restent optionnels, cette liste ne sert plus qu'à
// savoir quels rôles ont accès à cette page (voir js/pages/completer-profil.js).
const ROLES_AVEC_LOCALISATION = ['parent', 'enseignant', 'autorite_pedagogique'];

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

function urlVerifierEmail() {
  return `${_racine()}pages/verifier-email.html`;
}

// URL absolue (indispensable pour emailRedirectTo, qui doit être une URL
// complète et déjà autorisée dans "Redirect URLs" côté Supabase Auth — voir
// LISEZ-MOI de cette livraison pour le réglage à faire une fois dans le
// tableau de bord Supabase). Résolue en relatif depuis la page appelante
// (inscription.html, login.html ou verifier-email.html elle-même — toutes
// trois vivent dans le même dossier pages/), plutôt que via RACINE_SITE,
// pour rester correcte quel que soit le sous-dossier d'hébergement du site.
function urlAbsolueVerifierEmail() {
  return new URL('verifier-email.html', window.location.href).toString();
}

async function inscrire({ role, prenom, nom, identifiant, email, motDePasse, fonction, ecole, classeId }) {
  if (!ROLES_INSCRIPTIBLES.includes(role)) {
    return { error: { message: "Ce type de compte ne peut pas s'inscrire directement." } };
  }
  if (role === 'autorite_pedagogique' && !FONCTIONS_AUTORITE_PEDAGOGIQUE[fonction]) {
    return { error: { message: "Choisissez une fonction valide pour l'Autorité Pédagogique." } };
  }
  // École et classe sont obligatoires dès l'inscription pour un enseignant
  // (demande explicite du 12 septembre 2026) — contrairement au reste des
  // informations (sexe, localisation...), volontairement laissées pour
  // "Mon profil".
  if (role === 'enseignant' && (!ecole || !ecole.trim())) {
    return { error: { message: "Indiquez le nom de votre école." } };
  }
  if (role === 'enseignant' && !classeId) {
    return { error: { message: "Choisissez votre classe." } };
  }
  const identifiantNormalise = (identifiant || '').trim().toLowerCase();
  if (identifiantNormalise.length < 3) {
    return { error: { message: "Choisissez un identifiant d'au moins 3 caractères." } };
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(identifiantNormalise)) {
    return { error: { message: "L'identifiant ne peut contenir que des lettres, chiffres, points, tirets et underscores." } };
  }

  // Vérification d'unicité AVANT de créer le compte d'authentification, pour
  // éviter de créer un compte Supabase Auth "orphelin" (sans ligne profils)
  // en cas d'identifiant déjà pris — voir identifiant_disponible() en base.
  const { data: dispo, error: erreurDispo } = await supabaseClient.rpc('identifiant_disponible', { p_identifiant: identifiantNormalise });
  if (!erreurDispo && dispo === false) {
    return { error: { message: "Cet identifiant est déjà utilisé. Choisissez-en un autre." } };
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email, password: motDePasse,
    options: { emailRedirectTo: urlAbsolueVerifierEmail() }
  });
  if (error) return { error };

  const userId = data.user?.id;
  if (!userId) return { error: { message: "Le compte n'a pas pu être créé. Réessayez." } };

  const { error: erreurProfil } = await supabaseClient.from('profils').insert({
    id: userId, role, nom, prenom, identifiant: identifiantNormalise, email
    // sexe, departement, commune, arrondissement : laissés vides à dessein —
    // renseignables ensuite, à tout moment, depuis "Mon profil".
  });
  if (erreurProfil) {
    // Unicité déjà vérifiée ci-dessus, mais une petite fenêtre de course
    // reste possible (23505 = violation de contrainte unique) : message
    // clair plutôt que l'erreur Postgres brute.
    if (erreurProfil.code === '23505') {
      return { error: { message: "Cet identifiant vient d'être pris par quelqu'un d'autre. Choisissez-en un autre et réessayez." } };
    }
    return { error: erreurProfil };
  }

  if (role === 'autorite_pedagogique') {
    const { error: erreurRole } = await supabaseClient.from('autorites_pedagogiques').insert({ id: userId, fonction });
    if (erreurRole) return { error: erreurRole };
  } else if (role === 'enseignant') {
    const { error: erreurEns } = await supabaseClient.from('enseignants').insert({ id: userId, ecole: ecole.trim() });
    if (erreurEns) return { error: erreurEns };

    // Attribution directe (pas de validation admin) de la classe choisie à
    // l'inscription — une seule fois par compte. Une éventuelle erreur ici
    // (ex. classe déjà attribuée par un autre biais) ne doit pas empêcher la
    // création du compte : elle est juste signalée.
    const { error: erreurClasse } = await supabaseClient.rpc('attribuer_classe_initiale_enseignant', { p_classe_id: parseInt(classeId, 10) });
    if (erreurClasse) return { data, avertissement: "Votre compte a été créé, mais la classe n'a pas pu être attribuée automatiquement (" + erreurClasse.message + "). Vous pourrez en faire la demande depuis votre espace.", emailEnvoye: !data.session };
  } else {
    const { error: erreurRole } = await supabaseClient.from('parents').insert({ id: userId });
    if (erreurRole) return { error: erreurRole };
  }

  // data.session est déjà rempli si le projet Supabase n'exige pas (ou plus)
  // la confirmation d'e-mail — dans ce cas, aucun e-mail de vérification
  // n'a été envoyé et l'appelant peut rediriger directement vers l'espace.
  return { data, emailEnvoye: !data.session };
}

// --- VÉRIFICATION D'E-MAIL (lien OU code à 6 chiffres) --------------------
//
// Un seul e-mail de confirmation est envoyé par Supabase Auth à l'inscription
// (signUp ci-dessus), contenant à la fois un lien de confirmation et un code
// à 6 chiffres — voir le modèle d'e-mail "Confirm signup" à personnaliser
// une fois dans le tableau de bord Supabase (voir LISEZ-MOI de cette
// livraison). Le lien, une fois cliqué, ramène sur pages/verifier-email.html
// avec une session déjà valide (voir cette page) ; le code, lui, se vérifie
// avec verifierCodeEmail() ci-dessous.

async function verifierCodeEmail(email, code) {
  const { data, error } = await supabaseClient.auth.verifyOtp({ email, token: code.trim(), type: 'signup' });
  if (error) return { error: { message: "Code incorrect ou expiré. Vérifiez le code reçu par e-mail, ou demandez-en un nouveau." } };
  return { data };
}

async function renvoyerEmailVerification(email) {
  const { error } = await supabaseClient.auth.resend({
    type: 'signup', email,
    options: { emailRedirectTo: urlAbsolueVerifierEmail() }
  });
  if (error) return { error: { message: "Impossible de renvoyer l'e-mail pour le moment. Réessayez dans quelques instants." } };
  return { ok: true };
}

// --- CONNEXION (élève, parent ou enseignant) ------------------------------

async function seConnecter(identifiantOuEmail, motDePasse) {
  const email = await resoudreEmailConnexion(identifiantOuEmail);
  if (!email) return { error: { message: "Identifiant ou e-mail introuvable." } };

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: motDePasse });
  if (error) {
    // Supabase Auth refuse la connexion tant que l'e-mail n'est pas confirmé
    // (voir pages/verifier-email.html) — message dédié avec le nécessaire
    // pour y retourner, plutôt que le message générique "incorrect".
    const nonConfirme = error.code === 'email_not_confirmed' || /email.*not.*confirmed/i.test(error.message || '');
    if (nonConfirme) {
      return { error: { message: "Votre adresse e-mail n'est pas encore vérifiée.", nonConfirme: true, email } };
    }
    return { error: { message: "Identifiant/e-mail ou mot de passe incorrect." } };
  }

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
  // 19 septembre 2026 : changement de mot de passe obligatoire — posé ici,
  // au point d'entrée unique de toutes les pages "utilisateur" (parent,
  // élève, enseignant, autorité pédagogique), pour couvrir toutes les pages
  // sans avoir à modifier chacune d'elles. Concerne les comptes créés par un
  // administrateur avec un mot de passe temporaire (profils
  // .doit_changer_mot_de_passe, jamais vrai pour un compte auto-inscrit) —
  // voir pages/changer-mot-de-passe-oblige.html, seule page exemptée pour ne
  // pas boucler sur elle-même.
  if (profil.doit_changer_mot_de_passe === true && !/\/changer-mot-de-passe-oblige\.html$/i.test(window.location.pathname)) {
    window.location.href = `${_racine()}pages/changer-mot-de-passe-oblige.html`;
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
    if (/\/(login|inscription|completer-profil|changer-mot-de-passe-oblige)\.html$/i.test(window.location.pathname)) return;
    localStorage.setItem('kekeli_derniere_page', window.location.pathname + window.location.search);
  } catch (_e) { /* stockage indisponible -> tant pis, comportement par défaut conservé */ }
}

// Depuis le 12 septembre 2026 : plus de blocage forcé vers "compléter mon
// profil" — sexe, localisation et (pour l'enseignant) École/Circonscription/
// Zone Pédagogique sont optionnels et se renseignent quand l'utilisateur le
// souhaite, depuis "Mon profil" (pages/completer-profil.html, voir
// js/pages/completer-profil.js — devenue une page volontaire, plus une
// page-gate). requireRole() ne redirige donc plus jamais vers cette page.

// 19 septembre 2026 (26e requête, voir duotricies) : « vue liée » — un
// enseignant ou une autorité pédagogique peut activer une vue secondaire
// (parent pour l'un ou l'autre ; enseignant pour une autorité), SOUS LE MÊME
// IDENTIFIANT DE CONNEXION, avec un sélecteur de vue plutôt qu'un second
// compte. Le rôle PRINCIPAL (profils.role) ne change jamais — cette
// fonction vérifie seulement si une ligne existe déjà dans la table de
// détail du rôle secondaire demandé (`parents`/`enseignants`), possible
// pour n'importe quel compte déjà connecté (voir RLS
// parent_creation_soi/enseignant_creation_soi, qui n'imposent aucune
// exclusivité entre rôles). Voir activerVueLiee() plus bas pour l'activation.
async function possedeVueLiee(profilId, roleSecondaire) {
  const table = roleSecondaire === 'parent' ? 'parents' : roleSecondaire === 'enseignant' ? 'enseignants' : null;
  if (!table) return false;
  const { data } = await supabaseClient.from(table).select('id').eq('id', profilId).maybeSingle();
  return !!data;
}

// Active une vue secondaire pour le compte déjà connecté (voir
// possedeVueLiee ci-dessus) — ne fait rien si elle existe déjà.
async function activerVueLiee(profilId, roleSecondaire) {
  const table = roleSecondaire === 'parent' ? 'parents' : roleSecondaire === 'enseignant' ? 'enseignants' : null;
  if (!table) return { error: { message: 'Vue non reconnue.' } };
  const deja = await possedeVueLiee(profilId, roleSecondaire);
  if (deja) return { data: true };
  const { error } = await supabaseClient.from(table).insert({ id: profilId });
  if (error) return { error };
  return { data: true };
}

// À appeler en haut de chaque page réservée à un rôle :
//   const profil = await requireRole('parent');
//   if (!profil) return;
async function requireRole(roleAttendu) {
  const profil = await chargerSessionEtProfil();
  if (!profil) return null;
  if (profil.role !== roleAttendu) {
    const aVueLiee = (roleAttendu === 'parent' || roleAttendu === 'enseignant') && await possedeVueLiee(profil.id, roleAttendu);
    if (!aVueLiee) {
      window.location.href = urlTableauDeBord(profil.role);
      return null;
    }
  }
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
