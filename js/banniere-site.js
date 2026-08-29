// ============================================================
// Bannière dynamique du site — visible sur TOUTES les pages (vitrine
// publique + tous les espaces connectés), gérée exclusivement par le super
// admin depuis pages/admin/bannieres.html (table bannieres_site).
//
// Une page l'utilise en deux temps :
//   1. <script src=".../js/banniere-site.js"></script> (après supabaseClient)
//   2. initBanniereSite('visiteur' | 'eleve' | 'parent' | 'enseignant' |
//        'autorite_pedagogique' | 'admin')
//
// Les pages connectées (élève/parent/enseignant/autorité/admin) n'ont RIEN
// à faire de plus : js/entete-navigation.js appelle déjà initBanniereSite
// avec le bon rôle à chaque fois qu'une page appelle initEnteteNavigation().
// Seules les pages SANS en-tête géré par ce module (index.html, pages
// d'authentification) l'appellent elles-mêmes avec le rôle 'visiteur'.
//
// Une bannière peut cibler des rôles précis (roles_cibles) ou tout le monde
// (tableau vide/NULL). L'utilisateur peut la fermer (✕) : ce choix est
// mémorisé dans localStorage pour CETTE bannière précise (id + date de
// dernière modification, afin qu'une bannière republiée/modifiée réapparaisse
// même si l'ancienne version avait été fermée) et pour cet appareil
// seulement — jamais envoyé au serveur.
// ============================================================

const CLE_BANNIERES_FERMEES = 'kekeli_bannieres_fermees';

function listeBannieresFermees() {
  try { return JSON.parse(localStorage.getItem(CLE_BANNIERES_FERMEES) || '[]'); }
  catch (_e) { return []; }
}

function marquerBanniereFermee(cle) {
  try {
    const liste = listeBannieresFermees();
    if (!liste.includes(cle)) {
      liste.push(cle);
      localStorage.setItem(CLE_BANNIERES_FERMEES, JSON.stringify(liste.slice(-30)));
    }
  } catch (_e) { /* localStorage indisponible -> tant pis, pas bloquant */ }
}

// Recalcule la place à réserver en haut de la page (variable CSS lue par
// .avec-entete-fixe / .entete-publique / .entete-kekeli — voir style*.css)
// à chaque affichage/fermeture, et au redimensionnement (le message peut
// passer sur plusieurs lignes sur petit écran).
function appliquerHauteurBanniereSite(zone) {
  const hauteur = zone && document.body.contains(zone) ? zone.offsetHeight : 0;
  document.documentElement.style.setProperty('--hauteur-banniere-site', hauteur + 'px');
  document.body.classList.toggle('avec-banniere-site', hauteur > 0);
}

async function initBanniereSite(role) {
  if (typeof supabaseClient === 'undefined') return;
  try {
    const { data, error } = await supabaseClient
      .from('bannieres_site')
      .select('id, message, type, lien_url, lien_texte, roles_cibles, date_debut, date_fin, maj_le')
      .eq('actif', true)
      .order('cree_le', { ascending: false });
    if (error || !data || !data.length) return;

    const maintenant = Date.now();
    const roleActuel = role || 'visiteur';
    const fermees = listeBannieresFermees();

    const banniere = data.find(b => {
      if (b.date_debut && new Date(b.date_debut).getTime() > maintenant) return false;
      if (b.date_fin && new Date(b.date_fin).getTime() < maintenant) return false;
      const cibles = b.roles_cibles || [];
      if (cibles.length > 0 && !cibles.includes(roleActuel)) return false;
      return !fermees.includes(`${b.id}-${b.maj_le}`);
    });
    if (!banniere) { appliquerHauteurBanniereSite(null); return; }

    const cleFermeture = `${banniere.id}-${banniere.maj_le}`;
    const zone = document.createElement('div');
    zone.className = `banniere-site banniere-site--${banniere.type || 'info'}`;
    zone.id = 'banniereSite';
    const messageEchappe = document.createElement('span');
    messageEchappe.textContent = banniere.message;
    zone.appendChild(messageEchappe);
    if (banniere.lien_url) {
      const lien = document.createElement('a');
      lien.href = banniere.lien_url;
      lien.target = '_blank';
      lien.rel = 'noopener';
      lien.textContent = (banniere.lien_texte || 'En savoir plus') + ' →';
      zone.appendChild(lien);
    }
    const btnFermer = document.createElement('button');
    btnFermer.type = 'button';
    btnFermer.className = 'banniere-site-fermer';
    btnFermer.setAttribute('aria-label', 'Fermer cette bannière');
    btnFermer.textContent = '✕';
    zone.appendChild(btnFermer);

    document.body.prepend(zone);
    appliquerHauteurBanniereSite(zone);
    window.addEventListener('resize', () => appliquerHauteurBanniereSite(zone));
    btnFermer.addEventListener('click', () => {
      marquerBanniereFermee(cleFermeture);
      zone.remove();
      appliquerHauteurBanniereSite(null);
    });
  } catch (_e) { /* bannière indisponible -> n'empêche jamais l'affichage de la page */ }
}
