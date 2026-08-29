// Page pages/parametres.html — accessible depuis n'importe quel rôle via le
// lien ⚙️ de l'en-tête partagé (js/entete-navigation.js). Permet à chacun de
// choisir quels liens de son en-tête masquer, pour le dégager et faciliter
// la navigation (demande explicite : "un profil pour chaque rôle où il
// pourra paramétrer son profil pour que l'entête soit dégagé"). Les liens
// "essentiels" (ex: Tableau de bord) ne sont jamais proposés au masquage.
//
// Cette page peut être ouverte par n'importe quel rôle : on détecte donc le
// rôle courant nous-mêmes (comme pages/navigation.html), au lieu d'un
// requireRole/requireAdmin fixe.

let profilParametres = null;
let roleParametres = null; // clé dans LIENS_PAR_ROLE ('admin', 'eleve', 'parent', 'enseignant', 'autorite')
let estSuperAdminParam = false;
let liensMasquesActuels = [];

(async function () {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = '../index.html'; return; }

  const profilAdmin = await chargerProfilAdmin(session.user.id);
  if (profilAdmin) {
    profilParametres = profilAdmin;
    roleParametres = 'admin';
    estSuperAdminParam = !!profilAdmin.est_super_admin;
  } else {
    const profilGenerique = await chargerProfil(session.user.id);
    if (!profilGenerique || !LIENS_PAR_ROLE[profilGenerique.role === 'autorite_pedagogique' ? 'autorite' : profilGenerique.role]) {
      window.location.href = '../index.html';
      return;
    }
    profilParametres = profilGenerique;
    roleParametres = profilGenerique.role === 'autorite_pedagogique' ? 'autorite' : profilGenerique.role;
  }

  // Charge la feuille de style du bon thème (clair pour admin, sombre pour
  // les autres rôles) avant de construire l'en-tête, pour que celui-ci
  // s'affiche avec les bonnes couleurs dès le départ.
  const feuille = document.createElement('link');
  feuille.rel = 'stylesheet';
  feuille.href = roleParametres === 'admin' ? '../css/style.css' : '../css/style-public.css';
  document.head.appendChild(feuille);

  const badgeHtml = roleParametres === 'admin'
    ? `${estSuperAdminParam ? '👑 Super admin' : '🛠️ Admin'} : ${echapperParam(profilParametres.prenom)}`
    : `🟢 ${echapperParam(profilParametres.prenom)}`;

  await initEnteteNavigation({
    role: roleParametres, utilisateurId: profilParametres.id, badgeHtml,
    liens: liensAvecPrefixe(roleParametres, roleParametres + '/', { superAdmin: estSuperAdminParam })
  });

  const { data: prefs } = await supabaseClient.from('preferences_navigation').select('liens_masques').eq('utilisateur_id', profilParametres.id).maybeSingle();
  liensMasquesActuels = prefs?.liens_masques || [];

  afficherPageParametres();
})();

function afficherPageParametres() {
  const liens = LIENS_PAR_ROLE[roleParametres].filter(l => !l.essentiel && (!l.superAdminSeulement || estSuperAdminParam));

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page-param">⚙️ Paramètres — Navigation</div>
    <div class="sous-titre-page-param">Choisissez les liens à masquer de votre en-tête pour le dégager et faciliter votre navigation. Le tableau de bord et les actions essentielles restent toujours accessibles.</div>

    <div class="carte-param">
      <h2>Liens de mon en-tête (${LIBELLES_ROLE[roleParametres] || roleParametres})</h2>
      <p class="desc-param">Cochez un lien pour le masquer — vous pourrez toujours le décocher ici plus tard.</p>
      <form id="formParametresNav">
        ${liens.length ? liens.map(l => `
          <div class="ligne-lien-param">
            <label>
              <input type="checkbox" name="masquer" value="${l.id}" ${liensMasquesActuels.includes(l.id) ? 'checked' : ''}>
              ${l.icone ? `${l.icone} ` : ''}Masquer « ${echapperParam(l.label)} »
            </label>
          </div>`).join('') : '<p class="message-param-vide">Aucun lien optionnel pour votre espace pour l\'instant.</p>'}
        ${liens.length ? '<button type="submit" class="btn-param-enregistrer">Enregistrer</button>' : ''}
        <p class="message-param-succes" id="messageSuccesParam" style="display:none">✅ Préférences enregistrées.</p>
      </form>
    </div>
  `;

  const form = document.getElementById('formParametresNav');
  if (form) form.addEventListener('submit', enregistrerParametresNav);
}

async function enregistrerParametresNav(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.btn-param-enregistrer');
  const messageSucces = document.getElementById('messageSuccesParam');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }
  if (messageSucces) messageSucces.style.display = 'none';

  const liensMasques = [...form.querySelectorAll('[name="masquer"]:checked')].map(el => el.value);

  const { error } = await supabaseClient.from('preferences_navigation')
    .upsert({ utilisateur_id: profilParametres.id, liens_masques: liensMasques, maj_le: new Date().toISOString() });

  if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }

  if (error) { alert(error.message); return; }

  liensMasquesActuels = liensMasques;
  if (messageSucces) messageSucces.style.display = 'block';
}

function echapperParam(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
