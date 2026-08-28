// Page pages/enseignant/messagerie-admin.html
// Messagerie avec l'équipe administrative — table générique messages_admin,
// partagée avec pages/admin/messagerie.html (voir ce fichier pour le contexte).

let profilEnsMsgAdmin = null;
let contactsEnsMsgAdmin = [];

(async function () {
  profilEnsMsgAdmin = await requireRole('enseignant');
  if (!profilEnsMsgAdmin) return;

  initClocheNotifications('zoneCloche', profilEnsMsgAdmin.id);

  const params = new URLSearchParams(window.location.search);
  const avec = params.get('avec');

  const { data: profils } = await supabaseClient
    .from('profils').select('id, prenom, nom, role')
    .in('role', ['admin', 'super_admin']);
  contactsEnsMsgAdmin = profils || [];

  await afficherMessagerieEnsAdmin();

  if (avec && contactsEnsMsgAdmin.some(c => c.id === avec)) {
    await ouvrirConversationEnsMsgAdmin(avec);
  }
})();

async function afficherMessagerieEnsAdmin() {
  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>🗂️ Messagerie administration</h1>
      <p>Échangez avec l'équipe administrative de KEKELI.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Administrateurs</h1>
      ${contactsEnsMsgAdmin.length ? `<div class="liste-lignes-pub" style="margin-top:10px">
        ${contactsEnsMsgAdmin.map(c => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-contact-ens-admin="${c.id}">
            <div>
              <div class="titre-ligne-pub">${echapperEnsMsgAdmin(c.prenom)} ${echapperEnsMsgAdmin(c.nom)}</div>
              <div class="sous-ligne-pub">${c.role === 'super_admin' ? 'Super administrateur' : 'Administrateur'}</div>
            </div>
          </div>`).join('')}
      </div>` : `<p style="color:var(--text-gris);margin-top:10px">Aucun administrateur pour l'instant.</p>`}
    </div>

    <div id="zoneConversationEnsMsgAdmin"></div>
  `;

  document.querySelectorAll('[data-ouvrir-contact-ens-admin]').forEach(el => {
    el.addEventListener('click', () => ouvrirConversationEnsMsgAdmin(el.dataset.ouvrirContactEnsAdmin));
  });
}

async function ouvrirConversationEnsMsgAdmin(contactId) {
  const contact = contactsEnsMsgAdmin.find(c => c.id === contactId);
  const zone = document.getElementById('zoneConversationEnsMsgAdmin');
  zone.innerHTML = '<div class="carte-bienvenue"><p style="color:var(--text-gris)">Chargement des messages...</p></div>';

  const { data: messages, error } = await supabaseClient
    .from('messages_admin').select('*')
    .or(`and(expediteur_id.eq.${profilEnsMsgAdmin.id},destinataire_id.eq.${contactId}),and(expediteur_id.eq.${contactId},destinataire_id.eq.${profilEnsMsgAdmin.id})`)
    .order('cree_le', { ascending: true });

  if (error) {
    zone.innerHTML = `<div class="carte-bienvenue"><p style="color:var(--rouge)">${error.message}</p></div>`;
    return;
  }

  supabaseClient.from('messages_admin').update({ lu: true })
    .eq('expediteur_id', contactId).eq('destinataire_id', profilEnsMsgAdmin.id).eq('lu', false)
    .then(() => {});

  zone.innerHTML = `
    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div id="filEnsMsgAdmin" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:4px">
        ${(messages && messages.length) ? messages.map(m => `
          <div style="align-self:${m.expediteur_id === profilEnsMsgAdmin.id ? 'flex-end' : 'flex-start'};background:${m.expediteur_id === profilEnsMsgAdmin.id ? 'var(--bleu-kekeli)' : '#F0F2F8'};color:${m.expediteur_id === profilEnsMsgAdmin.id ? 'white' : 'var(--text-dark)'};padding:10px 14px;border-radius:12px;max-width:75%">
            <div style="font-size:14px;white-space:pre-wrap">${echapperEnsMsgAdmin(m.contenu)}</div>
            <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
          </div>`).join('') : '<p style="color:var(--text-gris);font-size:13px">Aucun message pour l\'instant. Écrivez le premier !</p>'}
      </div>
      <form id="formEnvoiEnsMsgAdmin" style="display:flex;gap:8px">
        <input type="text" id="champEnsMsgAdmin" placeholder="Écrire un message..." style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bordure)" required>
        <button type="submit" class="btn btn-filled">Envoyer</button>
      </form>
    </div>
  `;

  document.getElementById('formEnvoiEnsMsgAdmin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champEnsMsgAdmin');
    const contenu = champ.value.trim();
    if (!contenu) return;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_admin').insert({
      expediteur_id: profilEnsMsgAdmin.id, destinataire_id: contactId, contenu
    });
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
    await ouvrirConversationEnsMsgAdmin(contactId);
  });

  const fil = document.getElementById('filEnsMsgAdmin');
  fil.scrollTop = fil.scrollHeight;
}

function echapperEnsMsgAdmin(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
