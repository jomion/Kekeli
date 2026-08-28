// Page pages/admin/messagerie.html
// Messagerie interne : administrateurs <-> enseignants, et administrateurs
// entre eux (les administrateurs sont ajoutés depuis la page "Gestion des
// administrateurs", réservée au super_admin). Contrairement à la messagerie
// parent-enseignant (liée à un suivi d'élève, table messages_suivi), ici la
// conversation est simplement identifiée par l'autre participant : table
// générique messages_admin, partagée avec pages/enseignant/messagerie-admin.html.

let profilMsgAdmin = null;
let contactsMsgAdmin = [];

async function init() {
  profilMsgAdmin = await requireAdmin();
  if (!profilMsgAdmin) return;

  document.getElementById('zoneDroite').innerHTML = `
    <div id="zoneCloche"></div>
    <span class="badge-utilisateur">${profilMsgAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperMsgAdmin(profilMsgAdmin.prenom)}</span>
    <a href="tableau-de-bord.html" class="btn btn-discret">🏠 Tableau de bord</a>
    <button class="btn btn-discret" id="btnDeconnexionMsgAdmin">Déconnexion</button>
  `;
  document.getElementById('btnDeconnexionMsgAdmin').addEventListener('click', deconnecterAdmin);
  initClocheNotifications('zoneCloche', profilMsgAdmin.id);

  const params = new URLSearchParams(window.location.search);
  const avec = params.get('avec');

  const { data: profils } = await supabaseClient
    .from('profils').select('id, prenom, nom, role')
    .in('role', ['admin', 'super_admin', 'enseignant']);

  contactsMsgAdmin = (profils || []).filter(p => p.id !== profilMsgAdmin.id);

  afficherMessagerieAdmin();

  if (avec && contactsMsgAdmin.some(c => c.id === avec)) {
    await ouvrirConversationMsgAdmin(avec);
  }
}

function afficherMessagerieAdmin() {
  const enseignants = contactsMsgAdmin.filter(c => c.role === 'enseignant');
  const admins = contactsMsgAdmin.filter(c => c.role !== 'enseignant');

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">💬 Messagerie</div>
    <div class="sous-titre-page">Échangez avec les enseignants et les autres administrateurs.</div>

    ${groupeContactsHtmlMsgAdmin('Enseignants', enseignants)}
    ${groupeContactsHtmlMsgAdmin('Administrateurs', admins)}

    <div id="zoneConversationMsgAdmin"></div>
  `;

  document.querySelectorAll('[data-ouvrir-contact-msg]').forEach(el => {
    el.addEventListener('click', () => ouvrirConversationMsgAdmin(el.dataset.ouvrirContactMsg));
  });
}

function groupeContactsHtmlMsgAdmin(titre, liste) {
  return `
    <div class="groupe-matiere-admin">
      <div class="titre-groupe-matiere">${titre} (${liste.length})</div>
      <div class="liste-lignes">
        ${liste.length ? liste.map(c => `
          <div class="ligne" style="cursor:pointer" data-ouvrir-contact-msg="${c.id}">
            <span class="titre-ligne">${echapperMsgAdmin(c.prenom)} ${echapperMsgAdmin(c.nom)}</span>
          </div>`).join('') : `<p style="color:var(--texte-gris)">Aucun pour l'instant.</p>`}
      </div>
    </div>`;
}

async function ouvrirConversationMsgAdmin(contactId) {
  const contact = contactsMsgAdmin.find(c => c.id === contactId);
  const zone = document.getElementById('zoneConversationMsgAdmin');
  zone.innerHTML = `<p style="color:var(--texte-gris)">Chargement des messages...</p>`;

  const { data: messages, error } = await supabaseClient
    .from('messages_admin').select('*')
    .or(`and(expediteur_id.eq.${profilMsgAdmin.id},destinataire_id.eq.${contactId}),and(expediteur_id.eq.${contactId},destinataire_id.eq.${profilMsgAdmin.id})`)
    .order('cree_le', { ascending: true });

  if (error) {
    zone.innerHTML = `<p class="message-erreur">${error.message}</p>`;
    return;
  }

  // Marque comme lus les messages reçus de ce contact (best-effort, pas bloquant).
  supabaseClient.from('messages_admin').update({ lu: true })
    .eq('expediteur_id', contactId).eq('destinataire_id', profilMsgAdmin.id).eq('lu', false)
    .then(() => {});

  zone.innerHTML = `
    <div class="ligne" style="display:block;margin-top:16px">
      <div style="font-weight:700;color:var(--bleu-principal);margin-bottom:10px">💬 ${echapperMsgAdmin(contact?.prenom)} ${echapperMsgAdmin(contact?.nom)}</div>
      <div id="filMsgAdmin" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px;padding:4px">
        ${(messages && messages.length) ? messages.map(m => `
          <div style="align-self:${m.expediteur_id === profilMsgAdmin.id ? 'flex-end' : 'flex-start'};background:${m.expediteur_id === profilMsgAdmin.id ? 'var(--bleu-principal)' : 'var(--bleu-clair)'};color:${m.expediteur_id === profilMsgAdmin.id ? 'white' : 'var(--texte-fonce)'};padding:10px 14px;border-radius:12px;max-width:75%">
            <div style="font-size:14px;white-space:pre-wrap">${echapperMsgAdmin(m.contenu)}</div>
            <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
          </div>`).join('') : `<p style="color:var(--texte-gris);font-size:13px">Aucun message pour l'instant. Écrivez le premier !</p>`}
      </div>
      <form id="formEnvoiMsgAdmin" style="display:flex;gap:8px">
        <input type="text" id="champMsgAdmin" placeholder="Écrire un message..." style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bordure)" required>
        <button type="submit" class="btn btn-primaire">Envoyer</button>
      </form>
    </div>
  `;

  document.getElementById('formEnvoiMsgAdmin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champMsgAdmin');
    const contenu = champ.value.trim();
    if (!contenu) return;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_admin').insert({
      expediteur_id: profilMsgAdmin.id, destinataire_id: contactId, contenu
    });
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
    await ouvrirConversationMsgAdmin(contactId);
  });

  const fil = document.getElementById('filMsgAdmin');
  fil.scrollTop = fil.scrollHeight;
}

function echapperMsgAdmin(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
