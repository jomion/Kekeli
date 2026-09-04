// Page pages/enseignant/messagerie.html

let profilEnseignantMsg = null;
let conversationOuverteEns = null; // id de l'abonnement actuellement affiché
let conversationsEnsParId = {}; // abonnement_id -> { eleve_id, eleveNom } — pour distinguer élève/parent dans le fil
let canalMessagesEns = null; // canal Supabase Realtime de la conversation actuellement ouverte

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
  conversationsEnsParId = {};
  conversations.forEach(c => {
    conversationsEnsParId[c.id] = { eleve_id: c.eleve_id, eleveNom: `${c.eleves?.profils?.prenom || ''} ${c.eleves?.profils?.nom || ''}`.trim() };
  });

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💬 Messagerie</h1>
      <p>Échangez avec les parents — et, si l'élève y est autorisé, directement avec lui — au sujet des élèves que vous suivez. Instantané : pas besoin de recharger la page.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Conversations</h1>
      ${conversations.length ? `<div class="liste-lignes-pub" style="margin-top:10px">
        ${conversations.map(c => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-conversation-ens="${c.id}">
            <div>
              <div class="titre-ligne-pub">${c.eleves?.profils?.prenom || ''} ${c.eleves?.profils?.nom || ''}</div>
              <div class="sous-ligne-pub">Le parent — et l'élève, si autorisé — de cet élève</div>
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

  const infosConv = conversationsEnsParId[abonnementId] || {};

  zone.innerHTML = `
    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div id="filDiscussionEns" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:4px">
        ${(messages && messages.length) ? messages.map(m => htmlMessageEns(m, infosConv)).join('') : '<p style="color:var(--text-gris);font-size:13px">Aucun message pour l\'instant. Écrivez le premier !</p>'}
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
    champ.disabled = true;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_suivi').insert({
      abonnement_id: abonnementId, expediteur_id: profilEnseignantMsg.id, contenu
    });
    champ.disabled = false;
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
    // Pas de rechargement manuel : le canal temps réel ci-dessous (souscrit à
    // TOUT insert sur cet abonnement, y compris les nôtres, pour ne garder
    // qu'une seule source de vérité) va faire apparaître le message.
  });

  activerTempsReelEns(abonnementId, infosConv);

  const fil = document.getElementById('filDiscussionEns');
  fil.scrollTop = fil.scrollHeight;
}

function htmlMessageEns(m, infosConv) {
  const estMoi = m.expediteur_id === profilEnseignantMsg.id;
  const estEleve = !estMoi && m.expediteur_id === infosConv.eleve_id;
  const etiquette = estMoi ? null : (estEleve ? (infosConv.eleveNom || 'Élève') : 'Parent');
  return `
    <div style="align-self:${estMoi ? 'flex-end' : 'flex-start'};max-width:75%">
      ${etiquette ? `<div style="font-size:10px;font-weight:700;color:var(--text-gris);margin:0 4px 2px">${echapperMsgEns(etiquette)}</div>` : ''}
      <div style="background:${estMoi ? 'var(--bleu-kekeli)' : '#F0F2F8'};color:${estMoi ? 'white' : 'var(--text-dark)'};padding:10px 14px;border-radius:12px">
        <div style="font-size:14px;white-space:pre-wrap">${echapperMsgEns(m.contenu)}</div>
        <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
      </div>
    </div>`;
}

// --- TEMPS RÉEL ------------------------------------------------------------
// Un seul canal actif à la fois (celui de la conversation ouverte) : on se
// désabonne du précédent avant de s'abonner au nouveau, sinon les canaux
// s'empilent au fil des clics et chaque message finirait par être ajouté
// plusieurs fois.
function activerTempsReelEns(abonnementId, infosConv) {
  if (canalMessagesEns) supabaseClient.removeChannel(canalMessagesEns);
  canalMessagesEns = supabaseClient
    .channel(`messages_suivi_ens_${abonnementId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_suivi', filter: `abonnement_id=eq.${abonnementId}` }, (payload) => {
      const fil = document.getElementById('filDiscussionEns');
      if (!fil) return;
      const vide = fil.querySelector('p');
      if (vide) fil.innerHTML = '';
      fil.insertAdjacentHTML('beforeend', htmlMessageEns(payload.new, infosConv));
      fil.scrollTop = fil.scrollHeight;
    })
    .subscribe();
}

function echapperMsgEns(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
