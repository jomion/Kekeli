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
  // 19 septembre 2026 : seule index.html a RACINE_SITE = "" (elle vit à la
  // racine du site, voir la liste des RACINE_SITE de chaque page) — un
  // repère fiable pour savoir si ce pied de page (partagé par presque toutes
  // les pages, voir commentaire en tête de fichier) est bien celui de la
  // page d'accueil. Sur l'accueil, le lien "Matière" (19 septembre 2026 :
  // remplace l'ancien lien "Classes" du footer, demande explicite) doit
  // rester sur place et défiler vers la section "Les matières du programme
  // CM2" (#matieresCM2, déjà présente sur la page).
  //
  // Sur les autres pages, ce lien ouvrait jusqu'ici toujours la page de
  // navigation partagée (pages/navigation.html) — qui, pour un élève comme
  // pour un parent, affiche d'abord la liste des CLASSES avant d'arriver
  // aux matières, exactement ce que le porteur du projet a signalé comme
  // incorrect (« le bouton Matière doit conduire vers les matières du
  // compte et non vers les classes » — signalé une première fois pour
  // l'élève, puis à nouveau pour le parent : « pour le compte parent
  // matière conduit toujours vers classe »). Pour un enseignant/admin qui
  // gère plusieurs classes, cette étape reste nécessaire (aucune matière
  // n'est propre à « son compte » sans avoir d'abord choisi la classe) ; en
  // revanche, un élève n'a qu'une seule classe et dispose déjà d'une page
  // dédiée qui va directement à ses matières, sans détour par un choix de
  // classe : pages/eleve/matiere.html (js/pages/eleve-matiere.js). Un
  // parent n'a pas de page équivalente, mais pages/navigation.html sait
  // déjà sauter directement aux matières d'une classe donnée via
  // ?classeId=... dans l'URL (voir initDepuisURL() dans js/pages/
  // navigation.js, déjà utilisé par le lien "📌 Voir les séances" de
  // l'enseignant et par le retour depuis l'éditeur de séance) : il suffit
  // donc de connaître la classe du premier enfant du parent (parent_eleve
  // -> eleves.classe_id, même requête déjà utilisée sur son tableau de
  // bord) pour lui éviter le même détour, sans avoir à créer de nouvelle
  // page dédiée. Si le parent a plusieurs enfants dans des classes
  // différentes, celle du premier enfant trouvé est utilisée par défaut
  // (aucun sélecteur de classe "actif" n'existe entre les pages pour
  // trancher autrement) ; si le parent n'a encore inscrit aucun enfant, le
  // lien reste sur la page de navigation partagée sans classe présélectionnée
  // (rien de mieux à proposer dans ce cas). Le rôle n'étant connu qu'après
  // une requête asynchrone, le lien pointe d'abord vers la page de
  // navigation partagée (comportement précédent, pour ne pas retarder
  // l'affichage du reste du pied de page), puis est réécrit dès que l'on
  // sait qu'il s'agit bien d'un élève ou d'un parent connecté (voir la fin
  // de cette fonction).
  const estAccueil = racine === '';
  // 25 septembre 2026 : trois pages d'accueil (index.html = accueil mixte,
  // primaire.html = KEKELI Primaire, pages/formations/index.html = KEKELI
  // Formation). Les ancres CM2/paliers vivent désormais sur primaire.html.
  const lienMatiere = estAccueil ? `${racine}primaire.html#matieresCM2` : `${racine}pages/navigation.html`;

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
          <li><a href="${racine}primaire.html">KEKELI Primaire</a></li>
          <li><a href="${lienMatiere}" id="piedLienMatiere">Matière</a></li>
          <li><a href="${racine}primaire.html#paliers">Paliers</a></li>
          <li id="piedLienFormations"><a href="${racine}pages/formations/index.html">KEKELI Formation</a></li>
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

  // Réécriture asynchrone du lien "Matière" pour un élève connecté (voir le
  // commentaire plus haut) — n'attend jamais avant d'afficher le pied de
  // page ci-dessus, et échoue silencieusement (visiteur non connecté, session
  // expirée, erreur réseau...) en gardant la destination par défaut déjà en
  // place.
  // Comptes élèves : pas d'accès à KEKELI Formation (25 septembre 2026) —
  // le lien est retiré du pied de page dès que le rôle est connu.
  if (typeof supabaseClient !== 'undefined') {
    (async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data: profil } = await supabaseClient.from('profils').select('role').eq('id', session.user.id).maybeSingle();
        if (profil?.role === 'eleve') document.getElementById('piedLienFormations')?.remove();
      } catch (_e) { /* on garde le lien */ }
    })();
  }
  if (!estAccueil && typeof supabaseClient !== 'undefined') {
    (async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data: profil } = await supabaseClient.from('profils').select('role').eq('id', session.user.id).maybeSingle();
        const lien = document.getElementById('piedLienMatiere');
        if (!lien) return;
        if (profil?.role === 'eleve') {
          lien.href = `${racine}pages/eleve/matiere.html`;
          return;
        }
        if (profil?.role === 'parent') {
          const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', session.user.id).limit(1);
          const idPremierEnfant = liens?.[0]?.eleve_id;
          if (!idPremierEnfant) return;
          const { data: enfant } = await supabaseClient.from('eleves').select('classe_id').eq('id', idPremierEnfant).maybeSingle();
          if (enfant?.classe_id) lien.href = `${racine}pages/navigation.html?classeId=${enfant.classe_id}`;
        }
      } catch (_e) { /* pas connecté, ou erreur réseau : on garde la destination par défaut */ }
    })();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPiedDePage);
} else {
  initPiedDePage();
}
