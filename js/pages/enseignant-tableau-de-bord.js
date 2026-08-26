// Page pages/enseignant/tableau-de-bord.html

(async function () {
  const profil = await requireRole('enseignant');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom} ${profil.nom}`;
  initClocheNotifications('zoneCloche', profil.id);

  const { data: fiche } = await supabaseClient.from('enseignants').select('classes_assignees').eq('id', profil.id).single();
  const idsClasses = fiche?.classes_assignees || [];

  let classes = [];
  let eleves = [];
  if (idsClasses.length > 0) {
    const [{ data: c }, { data: e }] = await Promise.all([
      supabaseClient.from('classes').select('*').in('id', idsClasses).order('ordre'),
      supabaseClient.from('eleves').select('id, classe_id, profils:id(prenom, nom)').in('classe_id', idsClasses)
    ]);
    classes = c || [];
    eleves = e || [];
  }

  const listeClasses = classes.length ? classes.map(c => c.nom).join(', ') : 'Aucune classe assignée pour l\'instant.';
  const listeEleves = eleves.length
    ? `<ul style="color:var(--text-gris);padding-left:20px">${eleves.map(e => `<li>${e.profils?.prenom || ''} ${e.profils?.nom || ''} <span style="font-size:12px">(${classes.find(c => c.id === e.classe_id)?.nom || ''})</span></li>`).join('')}</ul>`
    : `<p style="color:var(--text-gris)">Aucun élève pour l'instant.</p>`;

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profil.prenom} !</h1>
      <p>Votre espace enseignant KEKELI. Le contenu pédagogique reste géré par l'administration —
      cet espace vous permet de suivre votre (vos) classe(s) : <strong>${echapperEns(listeClasses)}</strong>.</p>
    </div>

    ${idsClasses.length === 0 ? `<div class="bandeau-succes" style="background:#FFF6E0;color:#92620A;border-color:#f5deb3">
      Aucune classe ne vous est encore assignée — contactez un administrateur pour qu'il vous en attribue une.
    </div>` : ''}

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">Mes élèves</h1>
      ${listeEleves}
    </div>

    <div class="grille-actions-tb">
      ${idsClasses.length > 0 ? `<a href="devoirs-notes.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">📊</div>
        <h3>Devoirs &amp; notes</h3>
        <p>Attribuer des devoirs et des notes à vos élèves.</p>
      </a>` : `<div class="carte-action-tb a-venir">
        <div class="icone-action-tb">📊</div>
        <h3>Devoirs &amp; notes</h3>
        <p>Disponible une fois une classe assignée.</p>
      </div>`}
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">🎥</div>
        <h3>Visioconférence</h3>
        <p>Bientôt disponible.</p>
      </div>
    </div>
  `;
})();

function echapperEns(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
