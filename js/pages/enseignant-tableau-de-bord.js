// Page pages/enseignant/tableau-de-bord.html

let profilEnseignantTB = null;

(async function () {
  profilEnseignantTB = await requireRole('enseignant');
  if (!profilEnseignantTB) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profilEnseignantTB.prenom} ${profilEnseignantTB.nom}`;
  initClocheNotifications('zoneCloche', profilEnseignantTB.id);

  await afficherTableauBordEns();
})();

async function afficherTableauBordEns() {
  const { data: abonnements } = await supabaseClient
    .from('abonnements_enseignant_eleve')
    .select('*, eleves:eleve_id(classe_id, profils:id(prenom, nom))')
    .eq('enseignant_id', profilEnseignantTB.id);

  const enAttente = (abonnements || []).filter(a => a.statut === 'en_attente');
  const acceptes = (abonnements || []).filter(a => a.statut === 'accepte');

  // Noms de classes pour affichage
  const idsClasses = [...new Set(acceptes.map(a => a.eleves?.classe_id).filter(Boolean))];
  let classesParId = {};
  if (idsClasses.length) {
    const { data: classes } = await supabaseClient.from('classes').select('*').in('id', idsClasses);
    (classes || []).forEach(c => { classesParId[c.id] = c.nom; });
  }

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>Bienvenue, ${profilEnseignantTB.prenom} !</h1>
      <p>Votre espace enseignant KEKELI. Le contenu pédagogique reste géré par l'administration —
      vous suivez ici les élèves dont les parents vous ont confié le suivi.</p>
    </div>

    ${enAttente.length > 0 ? `
      <div class="carte-bienvenue" style="border-top-color:#FFC93C">
        <h1 style="font-size:18px">📥 Demandes de suivi (${enAttente.length})</h1>
        <div class="liste-lignes-pub" style="margin-top:10px">
          ${enAttente.map(a => `
            <div class="ligne-pub">
              <div class="titre-ligne-pub">${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''}</div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-filled" data-accepter="${a.id}" style="padding:6px 14px;font-size:12px">✅ Accepter</button>
                <button class="btn btn-deconnexion-public" data-refuser="${a.id}" style="padding:6px 14px;font-size:12px;color:var(--rouge);border-color:var(--rouge)">✕ Refuser</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:18px">Mes élèves suivis (${acceptes.length})</h1>
      ${acceptes.length ? `<ul style="color:var(--text-gris);padding-left:20px">
        ${acceptes.map(a => `<li>${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''} <span style="font-size:12px">(${classesParId[a.eleves?.classe_id] || ''})</span></li>`).join('')}
      </ul>` : `<p style="color:var(--text-gris)">Aucun élève suivi pour l'instant — un parent doit d'abord vous en faire la demande (avec votre e-mail).</p>`}
    </div>

    <div class="grille-actions-tb">
      ${acceptes.length > 0 ? `<a href="devoirs-notes.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">📊</div>
        <h3>Devoirs &amp; notes</h3>
        <p>Attribuer des devoirs et des notes à vos élèves suivis.</p>
      </a>` : `<div class="carte-action-tb a-venir">
        <div class="icone-action-tb">📊</div>
        <h3>Devoirs &amp; notes</h3>
        <p>Disponible dès qu'un élève vous suit.</p>
      </div>`}
      <div class="carte-action-tb a-venir">
        <div class="icone-action-tb">🎥</div>
        <h3>Visioconférence</h3>
        <p>Bientôt disponible.</p>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-accepter]').forEach(btn => {
    btn.addEventListener('click', () => repondreDemande(parseInt(btn.dataset.accepter, 10), 'accepte'));
  });
  document.querySelectorAll('[data-refuser]').forEach(btn => {
    btn.addEventListener('click', () => repondreDemande(parseInt(btn.dataset.refuser, 10), 'refuse'));
  });
}

async function repondreDemande(abonnementId, statut) {
  const { error } = await supabaseClient.from('abonnements_enseignant_eleve')
    .update({ statut, traite_le: new Date().toISOString() }).eq('id', abonnementId);
  if (error) return alert(error.message);
  afficherTableauBordEns();
}
