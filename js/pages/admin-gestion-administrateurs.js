// Page pages/admin/gestion-administrateurs.html
// Réservée au super_admin : liste des administrateurs existants (droits et
// périmètre), et formulaire pour en créer un nouveau. La création du compte
// de connexion se fait via la fonction Supabase "gerer-administrateurs" (clé
// service role, jamais exposée au navigateur) — un simple appel client ne
// peut pas créer un nouveau compte tout en restant connecté au sien.

let profilGA = null;
let classesGA = [];
let champsGA = [];
let administrateursGA = [];

async function init() {
  profilGA = await requireAdmin();
  if (!profilGA) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilGA.id,
    badgeHtml: `${profilGA.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperGA(profilGA.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilGA.est_super_admin })
  });

  if (!profilGA.est_super_admin) {
    document.getElementById('contenu').innerHTML = `
      <div class="titre-page">Gestion des administrateurs</div>
      <p class="message-erreur">⛔ Cette page est réservée au super administrateur.</p>
      <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
    return;
  }

  const [{ data: classes }, { data: champs }] = await Promise.all([
    supabaseClient.from('classes').select('id, nom, ordre').order('ordre'),
    supabaseClient.from('champs_formation').select('id, nom, code, actif').eq('actif', true).order('nom')
  ]);
  classesGA = classes || [];
  champsGA = champs || [];

  await chargerAdministrateurs();
  afficherPageGA();
}

async function chargerAdministrateurs() {
  const [{ data: profils }, { data: administrateurs }, { data: adminClasses }, { data: adminChamps }] = await Promise.all([
    supabaseClient.from('profils').select('id, prenom, nom, email, actif, cree_le').in('role', ['admin', 'super_admin']),
    supabaseClient.from('administrateurs').select('*'),
    supabaseClient.from('administrateur_classes').select('*'),
    supabaseClient.from('administrateur_champs').select('*')
  ]);

  const classeParId = new Map(classesGA.map(c => [c.id, c]));
  const champParId = new Map(champsGA.map(c => [c.id, c]));
  const adminParId = new Map((administrateurs || []).map(a => [a.id, a]));

  administrateursGA = (profils || []).map(p => {
    const a = adminParId.get(p.id) || {};
    const classesNoms = (adminClasses || []).filter(ac => ac.admin_id === p.id).map(ac => classeParId.get(ac.classe_id)?.nom).filter(Boolean);
    const champsNoms = (adminChamps || []).filter(ac => ac.admin_id === p.id).map(ac => champParId.get(ac.champ_formation_id)?.nom).filter(Boolean);
    return { ...p, ...a, classesNoms, champsNoms };
  }).sort((x, y) => (y.est_super_admin ? 1 : 0) - (x.est_super_admin ? 1 : 0) || (x.prenom || '').localeCompare(y.prenom || '', 'fr'));
}

function afficherPageGA() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">Gestion des administrateurs</div>
    <div class="sous-titre-page">Ajoutez de nouveaux administrateurs et consultez leurs droits d'édition.</div>

    <button class="btn btn-primaire" id="btnOuvrirFormulaireGA" style="margin-bottom:16px">➕ Ajouter un administrateur</button>
    <div id="zoneFormulaireGA"></div>

    <div class="liste-lignes" id="zoneListeGA"></div>
  `;
  document.getElementById('btnOuvrirFormulaireGA').addEventListener('click', ouvrirFormulaireGA);
  rendreListeGA();
}

function rendreListeGA() {
  document.getElementById('zoneListeGA').innerHTML = administrateursGA.map(a => `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperGA(a.prenom)} ${echapperGA(a.nom)} ${a.est_super_admin ? '<span class="badge-classe-admin">👑 Super admin</span>' : ''}</span>
        <span class="meta-seance-admin">
          ${echapperGA(a.email)}
          ${!a.est_super_admin ? `${a.peut_editer ? '<span class="badge-droit">Peut éditer</span>' : ''}${a.peut_valider ? '<span class="badge-droit">Peut valider</span>' : ''}` : ''}
        </span>
        ${(!a.est_super_admin && (a.classesNoms.length || a.champsNoms.length)) ? `<span class="meta-seance-admin">Périmètre : ${[...a.classesNoms, ...a.champsNoms].map(echapperGA).join(', ')}</span>` : ''}
      </div>
      ${a.id === profilGA.id ? '<span class="statut-pill statut-publie">Vous</span>' : ''}
    </div>`).join('') || `<p style="color:var(--texte-gris)">Aucun administrateur pour l'instant.</p>`;
}

function ouvrirFormulaireGA() {
  document.getElementById('btnOuvrirFormulaireGA').style.display = 'none';
  document.getElementById('zoneFormulaireGA').innerHTML = `
    <form id="formNouvelAdminGA" class="formulaire-admin">
      <div class="rangee-champs">
        <label>Prénom<input type="text" name="prenom" required></label>
        <label>Nom<input type="text" name="nom" required></label>
      </div>
      <div class="rangee-champs">
        <label>E-mail<input type="email" name="email" required></label>
        <label>Mot de passe temporaire<input type="text" name="motDePasse" placeholder="6 caractères min." required></label>
      </div>

      <label class="ligne-case"><input type="checkbox" name="estSuperAdmin"> Super administrateur (tous les droits, sur toutes les classes et matières)</label>

      <div id="blocDroitsGA">
        <label class="ligne-case"><input type="checkbox" name="peutEditer"> Peut éditer le contenu pédagogique</label>
        <label class="ligne-case"><input type="checkbox" name="peutValider"> Peut valider / publier</label>

        <div class="encadre-perimetre">
          <label>Classes concernées</label>
          <div class="grille-cases">
            ${classesGA.map(c => `<label><input type="checkbox" name="classe" value="${c.id}"> ${echapperGA(c.nom)}</label>`).join('')}
          </div>
          <label style="margin-top:14px">Matières concernées</label>
          <div class="grille-cases">
            ${champsGA.map(c => `<label><input type="checkbox" name="champ" value="${c.id}"> ${echapperGA(c.nom)}</label>`).join('')}
          </div>
        </div>
      </div>

      <p class="message-erreur" id="erreurGA"></p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button type="button" class="btn btn-discret" id="btnAnnulerGA">Annuler</button>
        <button type="submit" class="btn btn-primaire" id="btnValiderGA">Créer le compte</button>
      </div>
    </form>
  `;

  const form = document.getElementById('formNouvelAdminGA');
  const caseSuperAdmin = form.querySelector('[name="estSuperAdmin"]');
  const blocDroits = document.getElementById('blocDroitsGA');
  caseSuperAdmin.addEventListener('change', () => {
    blocDroits.style.display = caseSuperAdmin.checked ? 'none' : 'block';
  });

  document.getElementById('btnAnnulerGA').addEventListener('click', fermerFormulaireGA);
  form.addEventListener('submit', creerAdministrateurGA);
}

function fermerFormulaireGA() {
  document.getElementById('zoneFormulaireGA').innerHTML = '';
  document.getElementById('btnOuvrirFormulaireGA').style.display = 'inline-flex';
}

async function creerAdministrateurGA(e) {
  e.preventDefault();
  const form = e.target;
  const erreurEl = document.getElementById('erreurGA');
  erreurEl.textContent = '';

  const donnees = new FormData(form);
  const estSuperAdmin = form.querySelector('[name="estSuperAdmin"]').checked;
  const motDePasse = (donnees.get('motDePasse') || '').toString();
  const email = (donnees.get('email') || '').toString().trim();
  const corps = {
    action: 'creer',
    prenom: (donnees.get('prenom') || '').toString().trim(),
    nom: (donnees.get('nom') || '').toString().trim(),
    email,
    motDePasse,
    estSuperAdmin,
    peutEditer: form.querySelector('[name="peutEditer"]').checked,
    peutValider: form.querySelector('[name="peutValider"]').checked,
    classesIds: [...form.querySelectorAll('[name="classe"]:checked')].map(el => parseInt(el.value, 10)),
    champsIds: [...form.querySelectorAll('[name="champ"]:checked')].map(el => parseInt(el.value, 10))
  };

  const btn = document.getElementById('btnValiderGA');
  btn.disabled = true;
  btn.textContent = 'Création...';

  const { data, error } = await supabaseClient.functions.invoke('gerer-administrateurs', { body: corps });

  btn.disabled = false;
  btn.textContent = 'Créer le compte';

  if (error) {
    let message = error.message || 'Une erreur est survenue.';
    try {
      const corpsErreur = await error.context?.json?.();
      if (corpsErreur?.error) message = corpsErreur.error;
    } catch (_ignore) { /* on garde le message par défaut */ }
    erreurEl.textContent = message;
    return;
  }
  if (data?.error) {
    erreurEl.textContent = data.error;
    return;
  }

  fermerFormulaireGA();
  await chargerAdministrateurs();
  rendreListeGA();
  document.getElementById('zoneFormulaireGA').innerHTML = `
    <div class="encadre-succes-admin">
      ✅ Compte créé pour <strong>${echapperGA(email)}</strong>.
      Communiquez-lui son mot de passe temporaire (<strong>${echapperGA(motDePasse)}</strong>) par un moyen sûr —
      il n'y a pas encore d'envoi automatique par e-mail.
    </div>`;
}

function echapperGA(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
