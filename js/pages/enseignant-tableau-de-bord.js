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
    .select('*, eleves(classe_id, profils(prenom, nom))')
    .eq('enseignant_id', profilEnseignantTB.id);

  const enAttenteRecues = (abonnements || []).filter(a => a.statut === 'en_attente' && a.demande_par !== profilEnseignantTB.id);
  const enAttenteEnvoyees = (abonnements || []).filter(a => a.statut === 'en_attente' && a.demande_par === profilEnseignantTB.id);
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

    ${enAttenteRecues.length > 0 ? `
      <div class="carte-bienvenue" style="border-top-color:#FFC93C">
        <h1 style="font-size:18px">📥 Demandes de suivi reçues (${enAttenteRecues.length})</h1>
        <div class="liste-lignes-pub" style="margin-top:10px">
          ${enAttenteRecues.map(a => `
            <div class="ligne-pub">
              <div class="titre-ligne-pub">${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''}</div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-filled" data-accepter="${a.id}" style="padding:6px 14px;font-size:12px">✅ Accepter</button>
                <button class="btn btn-deconnexion-public" data-refuser="${a.id}" style="padding:6px 14px;font-size:12px;color:var(--rouge);border-color:var(--rouge)">✕ Refuser</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    ${enAttenteEnvoyees.length > 0 ? `
      <div class="carte-bienvenue" style="border-top-color:#FFC93C">
        <h1 style="font-size:18px">📤 Mes demandes envoyées (${enAttenteEnvoyees.length})</h1>
        <div class="liste-lignes-pub" style="margin-top:10px">
          ${enAttenteEnvoyees.map(a => `
            <div class="ligne-pub">
              <div class="titre-ligne-pub">${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''}</div>
              <div style="font-size:12px;color:var(--text-gris);display:flex;align-items:center;gap:8px">
                En attente d'acceptation par le parent
                <button data-annuler-envoi="${a.id}" title="Annuler la demande" style="background:none;border:none;cursor:pointer;font-size:12px;color:inherit">✕</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h1 style="font-size:18px;margin:0">Mes élèves suivis (${acceptes.length})</h1>
        <button class="btn btn-filled" id="btnSuivreEleve" style="padding:6px 14px;font-size:12px">🔗 Suivre un élève</button>
      </div>
      ${acceptes.length ? `<ul style="color:var(--text-gris);padding-left:20px;margin-top:10px">
        ${acceptes.map(a => `<li style="margin-bottom:4px">${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''} <span style="font-size:12px">(${classesParId[a.eleves?.classe_id] || ''})</span>
          <a href="messagerie.html?abonnement=${a.id}" style="margin-left:8px;font-size:12px;text-decoration:underline;color:inherit">💬 Message</a>
          <button data-annuler-suivi="${a.id}" title="Arrêter le suivi" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--rouge);margin-left:4px">✕</button>
        </li>`).join('')}
      </ul>` : `<p style="color:var(--text-gris);margin-top:10px">Aucun élève suivi pour l'instant — demandez le suivi d'un élève, ou attendez qu'un parent vous en fasse la demande (avec votre e-mail).</p>`}
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
      ${acceptes.length > 0 ? `<a href="messagerie.html" class="carte-action-tb disponible" style="text-decoration:none;color:inherit;display:block">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie parent</h3>
        <p>Échanger avec les parents de vos élèves suivis.</p>
      </a>` : `<div class="carte-action-tb a-venir">
        <div class="icone-action-tb">💬</div>
        <h3>Messagerie parent</h3>
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
  document.querySelectorAll('[data-annuler-envoi]').forEach(btn => {
    btn.addEventListener('click', () => annulerAbonnementEns(parseInt(btn.dataset.annulerEnvoi, 10), 'en_attente'));
  });
  document.querySelectorAll('[data-annuler-suivi]').forEach(btn => {
    btn.addEventListener('click', () => annulerAbonnementEns(parseInt(btn.dataset.annulerSuivi, 10), 'accepte'));
  });
  document.getElementById('btnSuivreEleve').addEventListener('click', ouvrirRechercheEleve);
}

async function repondreDemande(abonnementId, statut) {
  const { error } = await supabaseClient.from('abonnements_enseignant_eleve')
    .update({ statut, traite_le: new Date().toISOString() }).eq('id', abonnementId);
  if (error) return alert(error.message);
  afficherTableauBordEns();
}

function annulerAbonnementEns(abonnementId, statutActuel) {
  const message = statutActuel === 'accepte' ? "Arrêter le suivi de cet élève ?" : 'Annuler cette demande ?';
  confirmerAction(message, async () => {
    const { error } = await supabaseClient.from('abonnements_enseignant_eleve').delete().eq('id', abonnementId);
    if (error) return alert(error.message);
    afficherTableauBordEns();
  });
}

function ouvrirRechercheEleve() {
  ouvrirModal({
    titre: 'Suivre un élève',
    champs: [{ nom: 'identifiant', label: "Identifiant de connexion de l'élève", placeholder: 'Ex: biodun.cm2' }],
    texteValider: 'Envoyer la demande',
    onValider: async ({ identifiant }) => {
      const { data: eleves, error } = await supabaseClient.rpc('trouver_eleve_par_identifiant', { p_identifiant: identifiant });
      if (error) return alert(error.message);
      if (!eleves || eleves.length === 0) return alert("Aucun élève trouvé avec cet identifiant.");

      const { error: erreurDemande } = await supabaseClient.from('abonnements_enseignant_eleve').insert({
        eleve_id: eleves[0].id, enseignant_id: profilEnseignantTB.id, demande_par: profilEnseignantTB.id, statut: 'en_attente'
      });
      if (erreurDemande) {
        if (erreurDemande.code === '23505') return alert('Une demande existe déjà pour cet élève.');
        return alert(erreurDemande.message);
      }
      alert(`Demande envoyée pour ${eleves[0].prenom} ${eleves[0].nom}. Le parent doit l'accepter.`);
      afficherTableauBordEns();
    }
  });
}
