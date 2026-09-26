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
let raccourcisActuelsParam = [];
let masquerOperationJeuxActuel = false; // preferences_navigation.masquer_operation_jeux — jeu Calcul mental/Cadran opératoire (lot "Jeux éducatifs interactifs", 11 septembre 2026), aucun lien avec Premium

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

  const { data: prefs } = await supabaseClient.from('preferences_navigation').select('liens_masques, raccourcis, masquer_operation_jeux').eq('utilisateur_id', profilParametres.id).maybeSingle();
  liensMasquesActuels = prefs?.liens_masques || [];
  raccourcisActuelsParam = prefs?.raccourcis || [];
  masquerOperationJeuxActuel = !!prefs?.masquer_operation_jeux;

  afficherPageParametres();
})();

function afficherPageParametres() {
  const liens = LIENS_PAR_ROLE[roleParametres].filter(l => !l.essentiel && (!l.superAdminSeulement || estSuperAdminParam));
  // Pages proposables au raccourci rapide : tout le rôle, y compris les
  // liens essentiels (redondant mais inoffensif). Depuis le 26 septembre
  // 2026, le bouton 📌 de l'en-tête a été retiré : l'épinglage se fait
  // UNIQUEMENT ici — choix d'une page du rôle, ou adresse d'une page précise
  // collée (formulaire « Épingler une page précise » ci-dessous).
  const pagesEpinglablesParam = LIENS_PAR_ROLE[roleParametres].filter(l => !l.superAdminSeulement || estSuperAdminParam);

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page-param">⚙️ Paramètres — Navigation</div>
    <div class="sous-titre-page-param">Choisissez les liens à masquer de votre en-tête pour le dégager et faciliter votre navigation. Le tableau de bord et les actions essentielles restent toujours accessibles.</div>

    ${['parent', 'enseignant', 'autorite'].includes(roleParametres) ? `
    <div class="carte-param">
      <h2>👤 Mon profil</h2>
      <p class="desc-param">Renseignez ou mettez à jour vos informations personnelles (sexe, localisation${roleParametres === 'enseignant' ? ', établissement, classe' : ''}...) — entièrement facultatif.</p>
      <a href="${urlCompleterProfil()}" class="btn-param-enregistrer" style="display:inline-block;text-decoration:none">Ouvrir mon profil</a>
    </div>` : ''}

    ${roleParametres === 'eleve' ? `
    <div class="carte-param">
      <h2>🎮 Jeux éducatifs</h2>
      <p class="desc-param">Dans le jeu <strong>Cadran opératoire / Calcul mental</strong>, tu peux cacher le calcul affiché pendant la partie — tu dois alors t'en souvenir de mémoire au lieu de le relire (un bouton « 👁️ Revoir » reste toujours disponible si tu as un trou).</p>
      <div class="ligne-lien-param">
        <label>
          <input type="checkbox" id="caseMasquerOperationJeux" ${masquerOperationJeuxActuel ? 'checked' : ''}>
          🙈 Masquer l'affichage de l'opération pour entraîner ma mémoire
        </label>
      </div>
      <p class="message-param-succes" id="messageSuccesMasquerOperationJeux" style="display:none">✅ Préférence enregistrée.</p>
    </div>` : ''}

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

    <div class="carte-param">
      <h2>Mes raccourcis épinglés</h2>
      <p class="desc-param">Une page que vous consultez souvent : choisissez-la dans la liste, ou collez l'adresse d'une page précise (une matière, une séance, une formation…). Elle s'ajoute à votre en-tête, sur toutes vos pages.</p>
      <div id="listeRaccourcisParam">
        ${raccourcisActuelsParam.length ? raccourcisActuelsParam.map(r => `
          <div class="ligne-lien-param">
            <label style="flex:1;cursor:default">${r.icone ? `${r.icone} ` : '📌 '}${echapperParam(r.label)}</label>
            <button type="button" class="btn-retirer-raccourci-param" data-id="${r.id}" style="background:none;border:none;color:#DC2626;cursor:pointer;font-size:13px;font-weight:700">✕ Retirer</button>
          </div>`).join('') : '<p class="message-param-vide">Aucun raccourci épinglé pour l\'instant.</p>'}
      </div>
      <form id="formAjouterRaccourciParam" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label style="flex:1;min-width:220px;font-size:13px;font-weight:700;color:#64748B">Épingler une page de mon espace
          <select id="selectPageRaccourciParam" style="width:100%;padding:10px;border-radius:8px;border:1px solid #CBD5E1;margin-top:4px;font-size:14px">
            <option value="">— Choisir une page —</option>
            ${pagesEpinglablesParam.map(l => `<option value="${l.id}">${l.icone ? `${l.icone} ` : ''}${echapperParam(l.label)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="btn-param-enregistrer">Épingler</button>
      </form>
      <form id="formAjouterAdresseParam" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label style="flex:2;min-width:240px;font-size:13px;font-weight:700;color:#64748B">Épingler une page précise — collez son adresse
          <input type="url" id="adresseRaccourciParam" required placeholder="https://jomion.github.io/Kekeli/pages/…" style="width:100%;padding:10px;border-radius:8px;border:1px solid #CBD5E1;margin-top:4px;font-size:14px;box-sizing:border-box">
        </label>
        <label style="flex:1;min-width:160px;font-size:13px;font-weight:700;color:#64748B">Nom affiché
          <input type="text" id="nomRaccourciParam" required maxlength="40" placeholder="Ex. Maths CM2" style="width:100%;padding:10px;border-radius:8px;border:1px solid #CBD5E1;margin-top:4px;font-size:14px;box-sizing:border-box">
        </label>
        <button type="submit" class="btn-param-enregistrer">Épingler</button>
      </form>
      <p class="desc-param" style="margin-top:6px;font-size:12px">Astuce : ouvrez la page voulue, copiez l'adresse dans la barre du navigateur, puis collez-la ici.</p>
      <p class="message-param-succes" id="messageSuccesRaccourciParam" style="display:none">✅ Raccourci ajouté.</p>
    </div>
  `;

  const caseMasquerOperationJeux = document.getElementById('caseMasquerOperationJeux');
  if (caseMasquerOperationJeux) caseMasquerOperationJeux.addEventListener('change', enregistrerMasquerOperationJeux);

  const form = document.getElementById('formParametresNav');
  if (form) form.addEventListener('submit', enregistrerParametresNav);

  document.querySelectorAll('.btn-retirer-raccourci-param').forEach(btn => {
    btn.addEventListener('click', () => retirerRaccourciParam(btn.dataset.id));
  });
  const formRaccourci = document.getElementById('formAjouterRaccourciParam');
  if (formRaccourci) formRaccourci.addEventListener('submit', ajouterRaccourciDepuisListeParam);
  const formAdresse = document.getElementById('formAjouterAdresseParam');
  if (formAdresse) formAdresse.addEventListener('submit', ajouterRaccourciDepuisAdresseParam);
}

// Épingler une page précise à partir de son adresse collée (remplace l'ancien
// bouton 📌 de l'en-tête, retiré le 26 septembre 2026). L'adresse doit être
// une page de CE site : on la convertit en chemin relatif à la racine du site
// (même convention que les autres raccourcis), en retirant le préfixe
// d'hébergement (ex. "/Kekeli/") pour que le raccourci marche partout.
async function ajouterRaccourciDepuisAdresseParam(e) {
  e.preventDefault();
  const brut = document.getElementById('adresseRaccourciParam').value.trim();
  const label = document.getElementById('nomRaccourciParam').value.trim();
  if (!brut || !label) return;
  let url;
  try { url = new URL(brut, window.location.href); } catch (_e) { alert("Cette adresse n'est pas valide."); return; }
  const racineSite = new URL(typeof RACINE_SITE === 'string' ? RACINE_SITE : '../', window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(racineSite.pathname)) {
    alert('Collez l\'adresse d\'une page de KEKELI (elle doit commencer par ' + racineSite.href + ').');
    return;
  }
  const chemin = url.pathname.slice(racineSite.pathname.length) || 'index.html';
  if (!/\.html$/.test(chemin)) { alert('Cette adresse ne correspond pas à une page de KEKELI.'); return; }
  const href = chemin + url.search;
  if (raccourcisActuelsParam.some(r => r.href === href)) { alert('Cette page est déjà dans vos raccourcis.'); return; }
  const nouveauRaccourci = { id: 'r' + Date.now().toString(36), href, icone: '📌', label: label.slice(0, 40) };
  const succes = await enregistrerRaccourcisParam([...raccourcisActuelsParam, nouveauRaccourci]);
  if (succes) afficherPageParametres();
}

// Réglage "masquer l'affichage de l'opération pour entraîner la mémoire"
// (jeu Cadran opératoire / Calcul mental, lot "Jeux éducatifs interactifs" du
// 11 septembre 2026) — sans lien avec Premium ni rechargement de page (rien
// dans l'en-tête ne dépend de ce réglage).
async function enregistrerMasquerOperationJeux(e) {
  const actif = e.target.checked;
  const messageSucces = document.getElementById('messageSuccesMasquerOperationJeux');
  const { error } = await supabaseClient.from('preferences_navigation')
    .upsert({ utilisateur_id: profilParametres.id, masquer_operation_jeux: actif, maj_le: new Date().toISOString() });
  if (error) { alert(error.message); e.target.checked = !actif; return; }
  masquerOperationJeuxActuel = actif;
  if (messageSucces) { messageSucces.style.display = 'block'; setTimeout(() => { messageSucces.style.display = 'none'; }, 2500); }
}

async function enregistrerRaccourcisParam(raccourcis) {
  const { error } = await supabaseClient.from('preferences_navigation')
    .upsert({ utilisateur_id: profilParametres.id, raccourcis, maj_le: new Date().toISOString() });
  if (error) { alert(error.message); return false; }
  raccourcisActuelsParam = raccourcis;
  return true;
}

async function retirerRaccourciParam(id) {
  const nouveauxRaccourcis = raccourcisActuelsParam.filter(r => r.id !== id);
  if (await enregistrerRaccourcisParam(nouveauxRaccourcis)) afficherPageParametres();
}

async function ajouterRaccourciDepuisListeParam(e) {
  e.preventDefault();
  const select = document.getElementById('selectPageRaccourciParam');
  const lienChoisi = LIENS_PAR_ROLE[roleParametres].find(l => l.id === select.value);
  if (!lienChoisi) return;

  // Les liens de LIENS_PAR_ROLE sont soit `racine: true` (chemin déjà écrit
  // depuis la racine du site, ex. "pages/seances.html"), soit relatifs au
  // DOSSIER DU RÔLE (ex. "tableau-de-bord.html" veut dire
  // "pages/eleve/tableau-de-bord.html") — pas juste "eleve/xxx.html" comme
  // l'ancien code le construisait ici. RACINE_SITE (préfixé côté
  // entete-navigation.js) pointe vers la racine RÉELLE du site (là où vivent
  // index.html, css/, js/, assets/ ET pages/ — voir son usage pour
  // assets/badges/... dans js/pages/eleve-seance.js par exemple), donc il
  // manquait le segment "pages/" : le raccourci enregistré pointait vers un
  // chemin inexistant ("eleve/tableau-de-bord.html" au lieu de
  // "pages/eleve/tableau-de-bord.html") -> 404 au clic. C'est exactement le
  // bug signalé : "quand on épingle une page au menu ... elle envoie 404".
  const href = lienChoisi.racine ? lienChoisi.href : `pages/${roleParametres}/${lienChoisi.href}`;
  if (raccourcisActuelsParam.some(r => r.href === href)) { alert('Cette page est déjà dans vos raccourcis.'); return; }

  const nouveauRaccourci = { id: 'r' + Date.now().toString(36), href, icone: lienChoisi.icone || '📌', label: lienChoisi.label };
  const succes = await enregistrerRaccourcisParam([...raccourcisActuelsParam, nouveauRaccourci]);
  if (succes) afficherPageParametres();
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
