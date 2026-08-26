// Page pages/admin/enseignants.html

async function init() {
  const profilAdmin = await requireAdmin();
  if (!profilAdmin) return;

  document.getElementById('zoneDroite').insertAdjacentHTML('afterbegin', `
    <span class="badge-utilisateur">${profilAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profilAdmin.prenom}</span>
  `);

  const [{ data: enseignants }, { data: classes }] = await Promise.all([
    supabaseClient.from('profils').select('id, prenom, nom, email, enseignants(classes_assignees)').eq('role', 'enseignant').order('nom'),
    supabaseClient.from('classes').select('*').order('ordre')
  ]);

  if (!enseignants || enseignants.length === 0) {
    document.getElementById('contenu').innerHTML = '<p class="chargement">Aucun enseignant inscrit pour l\'instant.</p>';
    return;
  }

  document.getElementById('contenu').innerHTML = `<div class="liste-lignes">${enseignants.map(ens => {
    const assignees = ens.enseignants?.classes_assignees || [];
    return `<div class="ligne" style="flex-direction:column;align-items:flex-start;gap:10px">
      <div>
        <div class="titre-ligne">${echapperEns(ens.prenom)} ${echapperEns(ens.nom)}</div>
        <span style="font-size:12px;color:var(--texte-gris)">${echapperEns(ens.email)}</span>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${(classes || []).map(c => `
          <label style="display:flex;align-items:center;gap:5px;font-size:13px">
            <input type="checkbox" data-enseignant="${ens.id}" data-classe="${c.id}" ${assignees.includes(c.id) ? 'checked' : ''}>
            ${echapperEns(c.nom)}
          </label>`).join('')}
      </div>
    </div>`;
  }).join('')}</div>`;

  document.querySelectorAll('[data-enseignant]').forEach(cb => {
    cb.addEventListener('change', () => majAssignation(cb.dataset.enseignant));
  });
}

async function majAssignation(enseignantId) {
  const cases = document.querySelectorAll(`[data-enseignant="${enseignantId}"]`);
  const classesCochees = [...cases].filter(c => c.checked).map(c => parseInt(c.dataset.classe, 10));

  const { data: existe } = await supabaseClient.from('enseignants').select('id').eq('id', enseignantId).maybeSingle();
  const requete = existe
    ? supabaseClient.from('enseignants').update({ classes_assignees: classesCochees }).eq('id', enseignantId)
    : supabaseClient.from('enseignants').insert({ id: enseignantId, classes_assignees: classesCochees });

  const { error } = await requete;
  if (error) alert(error.message);
}

function echapperEns(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
