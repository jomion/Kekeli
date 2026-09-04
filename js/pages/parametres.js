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
let themePremiumActuel = false; // aperçu du formatage premium (élève uniquement) — preferences_navigation.theme_premium
let accesPremiumEleveParam = false; // a_acces_premium_eleve(id) — un abonnement Premium actif débloque ce thème (et la messagerie instantanée, voir pages/eleve/messagerie.html)

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

  const { data: prefs } = await supabaseClient.from('preferences_navigation').select('liens_masques, raccourcis, theme_premium').eq('utilisateur_id', profilParametres.id).maybeSingle();
  liensMasquesActuels = prefs?.liens_masques || [];
  raccourcisActuelsParam = prefs?.raccourcis || [];
  themePremiumActuel = !!prefs?.theme_premium;

  if (roleParametres === 'eleve') {
    const { data: acces } = await supabaseClient.rpc('a_acces_premium_eleve', { p_eleve_id: profilParametres.id });
    accesPremiumEleveParam = !!acces;
  }

  afficherPageParametres();
})();

function afficherPageParametres() {
  const liens = LIENS_PAR_ROLE[roleParametres].filter(l => !l.essentiel && (!l.superAdminSeulement || estSuperAdminParam));
  // Pages proposables au raccourci rapide : tout le rôle, y compris les
  // liens essentiels (redondant mais inoffensif) — le moyen le plus rapide
  // d'épingler une page reste toutefois le bouton 📌 de l'en-tête, présent
  // sur la page elle-même (voir js/entete-navigation.js).
  const pagesEpinglablesParam = LIENS_PAR_ROLE[roleParametres].filter(l => !l.superAdminSeulement || estSuperAdminParam);

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page-param">⚙️ Paramètres — Navigation</div>
    <div class="sous-titre-page-param">Choisissez les liens à masquer de votre en-tête pour le dégager et faciliter votre navigation. Le tableau de bord et les actions essentielles restent toujours accessibles.</div>

    ${roleParametres === 'eleve' ? `
    <div class="carte-param">
      <h2>🎨 Nouveau look premium</h2>
      <p class="desc-param">${accesPremiumEleveParam
        ? "Essaie le nouveau formatage premium de ton espace — c'est réversible, tu peux revenir au look actuel à tout moment en décochant la case ci-dessous."
        : "Ce nouveau look fait partie de l'offre <strong>✨ Premium</strong> (comme la messagerie instantanée) — demande à tes parents de souscrire depuis leur tableau de bord pour en profiter."}</p>
      <div class="ligne-lien-param">
        <label style="${accesPremiumEleveParam ? '' : 'opacity:.5'}">
          <input type="checkbox" id="caseThemePremium" ${themePremiumActuel ? 'checked' : ''} ${accesPremiumEleveParam ? '' : 'disabled'}>
          🎨 Essayer le nouveau look premium
        </label>
      </div>
      <p class="message-param-succes" id="messageSuccesThemePremium" style="display:none">✅ Préférence enregistrée — recharge la page pour voir le changement.</p>
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
      <p class="desc-param">Une carte ou une page précise que vous consultez souvent : épinglez-la depuis le bouton 📌 en haut de n'importe quelle page, ou choisissez-la ci-dessous. Elle s'ajoute à votre en-tête, sur toutes vos pages.</p>
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
      <p class="message-param-succes" id="messageSuccesRaccourciParam" style="display:none">✅ Raccourci ajouté.</p>
    </div>
  `;

  const caseThemePremium = document.getElementById('caseThemePremium');
  if (caseThemePremium) caseThemePremium.addEventListener('change', enregistrerThemePremium);

  const form = document.getElementById('formParametresNav');
  if (form) form.addEventListener('submit', enregistrerParametresNav);

  document.querySelectorAll('.btn-retirer-raccourci-param').forEach(btn => {
    btn.addEventListener('click', () => retirerRaccourciParam(btn.dataset.id));
  });
  const formRaccourci = document.getElementById('formAjouterRaccourciParam');
  if (formRaccourci) formRaccourci.addEventListener('submit', ajouterRaccourciDepuisListeParam);
}

// Interrupteur "look premium" (aperçu) — voir js/theme-premium-eleve.js et
// js/entete-navigation.js (le champ theme_premium détermine, à chaque
// chargement de page, si l'élève voit l'en-tête classique ou la nouvelle
// coquille premium). On recharge la page après l'enregistrement pour que le
// changement soit visible immédiatement, plutôt que de reconstruire tout
// l'en-tête en JavaScript à la volée.
async function enregistrerThemePremium(e) {
  const actif = e.target.checked;
  const messageSucces = document.getElementById('messageSuccesThemePremium');
  const { error } = await supabaseClient.from('preferences_navigation')
    .upsert({ utilisateur_id: profilParametres.id, theme_premium: actif, maj_le: new Date().toISOString() });
  if (error) { alert(error.message); e.target.checked = !actif; return; }
  themePremiumActuel = actif;
  if (messageSucces) messageSucces.style.display = 'block';
  window.location.reload();
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

  // Les liens de LIENS_PAR_ROLE sont soit `racine: true` (chemin relatif à
  // la racine du site), soit relatifs au dossier du rôle (ex. "eleve/") —
  // on garde ici la même convention que le reste du fichier (pas de
  // préfixe "/" -> sera préfixé par RACINE_SITE côté entete-navigation.js).
  const href = lienChoisi.racine ? lienChoisi.href : `${roleParametres}/${lienChoisi.href}`;
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
