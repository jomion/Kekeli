// Pied de page partagé par (presque) toutes les pages du site — session du
// 4 septembre 2026, en réponse à une demande explicite : "je veux que le
// footer soit sur toutes les pages". Même principe que js/entete-navigation.js
// pour l'en-tête : chaque page pose un <footer></footer> vide, ce script le
// trouve et y injecte le même contenu partout, avec des liens toujours
// écrits depuis la racine du site via RACINE_SITE (déjà défini par chaque
// page, voir js/navigation-config.js pour le même principe côté en-tête).
//
// Contrairement à l'en-tête, ce pied de page ne dépend pas du rôle ni du
// profil connecté : il s'affiche donc tout seul au chargement de la page
// (pas besoin qu'une page JS l'appelle explicitement après avoir chargé un
// profil), ce qui évite d'avoir à modifier chaque contrôleur de page.
//
// Volontairement absent de pages/login.html, pages/inscription.html,
// pages/completer-profil.html (toutes trois de simples cartes centrées
// plein écran, voir .page-auth dans css/style-public.css) et de
// pages/admin/connexion.html (même principe, en style intégré) : ce script
// n'y est donc pas inclus.

function initPiedDePage() {
  const pied = document.querySelector('footer');
  if (!pied) return;
  const racine = typeof RACINE_SITE === 'string' ? RACINE_SITE : '';

  pied.className = 'pied-de-page-public';
  pied.innerHTML = `
    <div class="pied-page-contenu">
      <div class="pied-page-colonne pied-page-colonne-marque">
        <div class="pied-page-logo"><img src="${racine}assets/logo/logo.png" alt="Logo KEKELI"> KEKELI</div>
        <p class="pied-page-slogan">L'éducation qui éclaire l'avenir</p>
        <p class="pied-page-desc">La plateforme éducative interactive pour les élèves du primaire, du niveau Azɔ̀ví à Axɔ́sú.</p>
      </div>
      <div class="pied-page-colonne">
        <h3>Navigation</h3>
        <ul>
          <li><a href="${racine}index.html">Accueil</a></li>
          <li><a href="${racine}pages/navigation.html">Classes</a></li>
          <li><a href="${racine}index.html#paliers">Paliers</a></li>
        </ul>
      </div>
      <div class="pied-page-colonne">
        <h3>Mon compte</h3>
        <ul>
          <li><a href="${racine}pages/login.html">Se connecter</a></li>
          <li><a href="${racine}pages/inscription.html">Créer un compte</a></li>
        </ul>
      </div>
      <div class="pied-page-colonne">
        <h3>Informations légales</h3>
        <ul>
          <li><a href="${racine}pages/politique-confidentialite.html">Politique de confidentialité</a></li>
          <li><a href="${racine}pages/conditions-utilisation.html">Conditions d'utilisation</a></li>
          <li><a href="mailto:contact@kekeli.app">Nous contacter</a></li>
        </ul>
      </div>
    </div>
    <div class="pied-page-bas">© ${new Date().getFullYear()} KEKELI — Tous droits réservés.</div>
  `;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPiedDePage);
} else {
  initPiedDePage();
}
