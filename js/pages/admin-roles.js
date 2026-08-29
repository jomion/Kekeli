// Page pages/admin/roles.html — réservée au super_admin.
//
// Permet de créer des rôles administrateur personnalisés (un nom + un jeu de
// droits ponctuels précis, ex. "Correcteur d'activités") et de les assigner
// à des comptes admin existants. Ceci s'ajoute au système déjà en place
// (peut_editer/peut_valider + périmètre classes/champs, géré depuis
// "Gestion des administrateurs") sans le remplacer : ces droits ponctuels
// couvrent des tâches qui ne dépendent pas d'un périmètre classe/matière,
// à commencer par la correction des activités (voir js/pages/activites-correction.js,
// qui vérifie désormais admin_a_droit(id, 'corriger_activites') avant de
// laisser un admin corriger quoi que ce soit).
//
// Droits actuellement définis dans roles_admin (colonnes booléennes) :
// seul "corriger_activites" est aujourd'hui vérifié quelque part dans le
// site (voir ci-dessus) — les autres sont prêts pour de futures pages, mais
// ne bloquent encore rien : les créer/cocher ici ne change donc rien tant
// qu'aucune page ne les vérifie. C'est signalé dans l'interface plutôt que
// laissé implicite.

const DROITS_ROLES = [
  { cle: 'peut_corriger_activites', label: 'Corriger les activités', brancle: true,
    note: 'Déjà appliqué : sans ce droit (ou super_admin), la page "Activités à corriger" est bloquée.' },
  { cle: 'peut_editer_contenu', label: 'Éditer le contenu pédagogique', brancle: false },
  { cle: 'peut_valider_contenu', label: 'Valider / publier le contenu pédagogique', brancle: false },
  { cle: 'peut_gerer_devoirs', label: 'Gérer les devoirs', brancle: false },
  { cle: 'peut_gerer_paiements', label: 'Gérer les paiements des frais', brancle: false },
  { cle: 'peut_gerer_abonnements', label: 'Gérer les abonnements & services premium', brancle: false },
  { cle: 'peut_gerer_badges', label: 'Gérer les badges', brancle: false },
  { cle: 'peut_gerer_messagerie', label: 'Gérer la messagerie', brancle: false },
  { cle: 'peut_gerer_enseignants_classes', label: 'Valider les demandes de classe des enseignants', brancle: false }
];

let profilRoles = null;
let rolesExistants = [];
let adminsExistants = [];

function echapperRoles(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function init() {
  profilRoles = await requireAdmin();
  if (!profilRoles) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilRoles.id,
    badgeHtml: `${profilRoles.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperRoles(profilRoles.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilRoles.est_super_admin })
  });

  if (!profilRoles.est_super_admin) {
    document.getElementById('contenu').innerHTML = `
      <div class="titre-page">Rôles administrateurs</div>
      <p class="message-erreur">⛔ Cette page est réservée au super administrateur.</p>
      <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
    return;
  }

  await chargerDonneesRoles();
  afficherPageRoles();
}

async function chargerDonneesRoles() {
  const [{ data: roles }, { data: profils }, { data: administrateurs }] = await Promise.all([
    supabaseClient.from('roles_admin').select('*').order('nom'),
    supabaseClient.from('profils').select('id, prenom, nom, email').in('role', ['admin', 'super_admin']),
    supabaseClient.from('administrateurs').select('id, est_super_admin, role_admin_id')
  ]);
  rolesExistants = roles || [];
  const adminParId = new Map((administrateurs || []).map(a => [a.id, a]));
  adminsExistants = (profils || [])
    .map(p => ({ ...p, ...(adminParId.get(p.id) || {}) }))
    .filter(a => !a.est_super_admin) // le super_admin a déjà tous les droits, pas besoin d'un rôle
    .sort((x, y) => (x.prenom || '').localeCompare(y.prenom || '', 'fr'));
}

function afficherPageRoles() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">Rôles administrateurs</div>
    <div class="sous-titre-page">Créez des rôles avec des droits précis (ex. "Correcteur d'activités") et assignez-les à vos administrateurs.</div>

    <button class="btn btn-primaire" id="btnOuvrirFormulaireRole" style="margin-bottom:16px">➕ Créer un rôle</button>
    <div id="zoneFormulaireRole"></div>

    <div class="section-title-eleve" style="margin-top:8px">Rôles existants</div>
    <div class="liste-lignes" id="zoneListeRoles" style="margin-bottom:28px"></div>

    <div class="section-title-eleve">Assigner un rôle à un administrateur</div>
    <div id="zoneAssignationRole"></div>
  `;
  document.getElementById('btnOuvrirFormulaireRole').addEventListener('click', () => ouvrirFormulaireRole());
  rendreListeRoles();
  rendreAssignationRoles();
}

function rendreListeRoles() {
  document.getElementById('zoneListeRoles').innerHTML = rolesExistants.length ? rolesExistants.map(r => {
    const droitsActifs = DROITS_ROLES.filter(d => r[d.cle]);
    return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperRoles(r.nom)}</span>
        <span class="meta-seance-admin">${r.description ? echapperRoles(r.description) : ''}</span>
        <span class="meta-seance-admin">${droitsActifs.length ? droitsActifs.map(d => `<span class="badge-droit">${echapperRoles(d.label)}</span>`).join('') : 'Aucun droit coché'}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-discret" data-modifier-role="${r.id}" style="padding:6px 12px;font-size:12px">✏️ Modifier</button>
        <button class="btn btn-discret" data-supprimer-role="${r.id}" style="padding:6px 12px;font-size:12px;color:var(--rouge)">🗑️ Supprimer</button>
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--texte-gris)">Aucun rôle créé pour l'instant.</p>`;

  document.querySelectorAll('[data-modifier-role]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirFormulaireRole(rolesExistants.find(r => r.id === parseInt(btn.dataset.modifierRole, 10))));
  });
  document.querySelectorAll('[data-supprimer-role]').forEach(btn => {
    btn.addEventListener('click', () => supprimerRole(parseInt(btn.dataset.supprimerRole, 10)));
  });
}

function ouvrirFormulaireRole(roleAEditer) {
  document.getElementById('btnOuvrirFormulaireRole').style.display = 'none';
  document.getElementById('zoneFormulaireRole').innerHTML = `
    <form id="formRole" class="formulaire-admin">
      <div class="rangee-champs">
        <label>Nom du rôle<input type="text" name="nom" required value="${echapperRoles(roleAEditer?.nom || '')}"></label>
      </div>
      <label>Description (optionnelle)<input type="text" name="description" value="${echapperRoles(roleAEditer?.description || '')}"></label>

      <div class="encadre-perimetre" style="margin-top:14px">
        <label>Droits accordés par ce rôle</label>
        <div class="grille-cases">
          ${DROITS_ROLES.map(d => `
            <label>
              <input type="checkbox" name="droit" value="${d.cle}" ${roleAEditer?.[d.cle] ? 'checked' : ''}>
              ${echapperRoles(d.label)}${d.brancle ? ' <span class="statut-pill statut-publie" style="font-size:10px">déjà appliqué</span>' : ' <span class="statut-pill" style="font-size:10px;background:#eee;color:#888">pas encore vérifié ailleurs</span>'}
            </label>`).join('')}
        </div>
      </div>

      <p class="message-erreur" id="erreurRole"></p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button type="button" class="btn btn-discret" id="btnAnnulerRole">Annuler</button>
        <button type="submit" class="btn btn-primaire" id="btnValiderRole">${roleAEditer ? 'Enregistrer' : 'Créer le rôle'}</button>
      </div>
    </form>
  `;
  document.getElementById('btnAnnulerRole').addEventListener('click', fermerFormulaireRole);
  document.getElementById('formRole').addEventListener('submit', (e) => enregistrerRole(e, roleAEditer?.id));
}

function fermerFormulaireRole() {
  document.getElementById('zoneFormulaireRole').innerHTML = '';
  document.getElementById('btnOuvrirFormulaireRole').style.display = 'inline-flex';
}

async function enregistrerRole(e, roleId) {
  e.preventDefault();
  const form = e.target;
  const erreurEl = document.getElementById('erreurRole');
  erreurEl.textContent = '';

  const donnees = new FormData(form);
  const droitsCoches = new Set([...form.querySelectorAll('[name="droit"]:checked')].map(el => el.value));
  const payload = {
    nom: (donnees.get('nom') || '').toString().trim(),
    description: (donnees.get('description') || '').toString().trim() || null
  };
  DROITS_ROLES.forEach(d => { payload[d.cle] = droitsCoches.has(d.cle); });

  const btn = document.getElementById('btnValiderRole');
  btn.disabled = true; btn.textContent = 'Enregistrement...';

  const { error } = roleId
    ? await supabaseClient.from('roles_admin').update(payload).eq('id', roleId)
    : await supabaseClient.from('roles_admin').insert(payload);

  btn.disabled = false; btn.textContent = roleId ? 'Enregistrer' : 'Créer le rôle';

  if (error) { erreurEl.textContent = error.message; return; }

  fermerFormulaireRole();
  await chargerDonneesRoles();
  rendreListeRoles();
  rendreAssignationRoles();
}

async function supprimerRole(roleId) {
  if (!confirm('Supprimer ce rôle ? Les administrateurs qui l\'avaient perdront les droits associés.')) return;
  const { error } = await supabaseClient.from('roles_admin').delete().eq('id', roleId);
  if (error) { alert(error.message); return; }
  await chargerDonneesRoles();
  rendreListeRoles();
  rendreAssignationRoles();
}

function rendreAssignationRoles() {
  document.getElementById('zoneAssignationRole').innerHTML = `
    <div class="liste-lignes">
      ${adminsExistants.map(a => `
        <div class="ligne ligne-seance-admin">
          <div class="details-seance-admin">
            <span class="titre-ligne">${echapperRoles(a.prenom)} ${echapperRoles(a.nom)}</span>
            <span class="meta-seance-admin">${echapperRoles(a.email)}</span>
          </div>
          <select data-assigner-role="${a.id}" style="padding:8px;border-radius:8px;border:1px solid var(--bordure)">
            <option value="">— Aucun rôle —</option>
            ${rolesExistants.map(r => `<option value="${r.id}" ${a.role_admin_id === r.id ? 'selected' : ''}>${echapperRoles(r.nom)}</option>`).join('')}
          </select>
        </div>`).join('') || '<p style="color:var(--texte-gris)">Aucun administrateur (hors super admin) pour l\'instant.</p>'}
    </div>
  `;
  document.querySelectorAll('[data-assigner-role]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const adminId = sel.dataset.assignerRole;
      const roleId = sel.value ? parseInt(sel.value, 10) : null;
      sel.disabled = true;
      const { error } = await supabaseClient.from('administrateurs').update({ role_admin_id: roleId }).eq('id', adminId);
      sel.disabled = false;
      if (error) { alert(error.message); return; }
      const a = adminsExistants.find(x => x.id === adminId);
      if (a) a.role_admin_id = roleId;
    });
  });
}

init();
