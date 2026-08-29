// Page pages/enseignant/messagerie.html

let profilEnseignantMsg = null;
let conversationOuverteEns = null; // id de l'abonnement actuellement affiché

(async function () {
  profilEnseignantMsg = await requireRole('enseignant');
  if (!profilEnseignantMsg) return;

  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profilEnseignantMsg.id, badgeHtml: `🟢 ${echapperMsgEns(profilEnseignantMsg.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });

  const params = new URLSearchParams(window.location.search);
  conversationOuverteEns = params.get('abonnement') ? parseInt(params.get('abonnement'), 10) : null;

  await afficherMessagerieEns();
})();

async function afficherMessagerieEns() {
  const { data: abonnements } = await supabaseClient
    .from('abonnements_enseignant_eleve')
    .select('*, eleves(classe_id, profils(prenom, nom))')
    .eq('enseignant_id', profilEnseignantMsg.id).eq('statut', 'accepte');
  const conversations = abonnements || [];

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💬 Messagerie</h1>
      <p>Échangez avec les parents des élèves que vous suivez.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Conversations</h1>
      ${conversations.length ? `<div class="liste-lignes-pub" style="margin-top:10px">
        ${conversations.map(c => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-conversation-ens="${c.id}">
            <div>
              <div class="titre-ligne-pub">${c.eleves?.profils?.prenom || ''} ${c.eleves?.profils?.nom || ''}</div>
              <div class="sous-ligne-pub">Au parent de cet élève</div>
            </div>
          </div>`).join('')}
      </div>` : `<p style="color:var(--text-gris);margin-top:10px">Aucun élève suivi pour l'instant — retrouvez-en depuis votre tableau de bord.</p>`}
    </div>

    <div id="zoneConversationEns"></div>
  `;

  document.querySelectorAll('[data-ouvrir-conversation-ens]').forEach(el => {
    el.addEventListener('click', () => afficherConversationEns(parseInt(el.dataset.ouvrirConversationEns, 10)));
  });

  if (conversationOuverteEns && conversations.some(c => c.id === conversationOuverteEns)) {
    await afficherConversationEns(conversationOuverteEns);
  }
}

async function afficherConversationEns(abonnementId) {
  conversationOuverteEns = abonnementId;
  const zone = document.getElementById('zoneConversationEns');
  zone.innerHTML = '<div class="carte-bienvenue"><p style="color:var(--text-gris)">Chargement des messages...</p></div>';

  const { data: messages, error } = await supabaseClient
    .from('messages_suivi').select('*').eq('abonnement_id', abonnementId).order('cree_le', { ascending: true });

  if (error) {
    zone.innerHTML = `<div class="carte-bienvenue"><p style="color:var(--rouge)">${error.message}</p></div>`;
    return;
  }

  zone.innerHTML = `
    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div id="filDiscussionEns" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:4px">
        ${(messages && messages.length) ? messages.map(m => `
          <div style="align-self:${m.expediteur_id === profilEnseignantMsg.id ? 'flex-end' : 'flex-start'};background:${m.expediteur_id === profilEnseignantMsg.id ? 'var(--bleu-kekeli)' : '#F0F2F8'};color:${m.expediteur_id === profilEnseignantMsg.id ? 'white' : 'var(--text-dark)'};padding:10px 14px;border-radius:12px;max-width:75%">
            <div style="font-size:14px;white-space:pre-wrap">${echapperMsgEns(m.contenu)}</div>
            <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
          </div>`).join('') : '<p style="color:var(--text-gris);font-size:13px">Aucun message pour l\'instant. Écrivez le premier !</p>'}
      </div>
      <form id="formEnvoiMessageEns" style="display:flex;gap:8px">
        <input type="text" id="champMessageEns" placeholder="Écrire un message..." style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bordure)" required>
        <button type="submit" class="btn btn-filled">Envoyer</button>
      </form>
    </div>
  `;

  document.getElementById('formEnvoiMessageEns').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champMessageEns');
    const contenu = champ.value.trim();
    if (!contenu) return;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_suivi').insert({
      abonnement_id: abonnementId, expediteur_id: profilEnseignantMsg.id, contenu
    });
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
    await afficherConversationEns(abonnementId);
  });

  const fil = document.getElementById('filDiscussionEns');
  fil.scrollTop = fil.scrollHeight;
}

function echapperMsgEns(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
