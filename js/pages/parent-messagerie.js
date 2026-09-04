// Page pages/parent/messagerie.html

let profilParentMsg = null;
let conversationOuverte = null; // id de l'abonnement actuellement affiché
let conversationsParentParId = {}; // abonnement_id -> { eleve_id, enseignantNom } — pour distinguer élève/enseignant dans le fil
let canalMessagesParent = null; // canal Supabase Realtime de la conversation actuellement ouverte

(async function () {
  profilParentMsg = await requireRole('parent');
  if (!profilParentMsg) return;

  await initEnteteNavigation({
    role: 'parent', utilisateurId: profilParentMsg.id, badgeHtml: `🟢 ${echapperMsgParent(profilParentMsg.prenom)}`,
    liens: liensAvecPrefixe('parent', '')
  });

  const params = new URLSearchParams(window.location.search);
  conversationOuverte = params.get('abonnement') ? parseInt(params.get('abonnement'), 10) : null;

  await afficherMessagerie();
})();

async function afficherMessagerie() {
  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilParentMsg.id);
  const idsEnfants = (liens || []).map(l => l.eleve_id);

  let conversations = [];
  if (idsEnfants.length > 0) {
    const { data: abonnements } = await supabaseClient
      .from('abonnements_enseignant_eleve')
      .select('*, enseignants(profils(prenom, nom)), eleves(profils(prenom, nom))')
      .in('eleve_id', idsEnfants).eq('statut', 'accepte');
    conversations = abonnements || [];
  }
  conversationsParentParId = {};
  conversations.forEach(c => {
    conversationsParentParId[c.id] = { eleve_id: c.eleve_id, enseignantNom: `${c.enseignants?.profils?.prenom || ''} ${c.enseignants?.profils?.nom || ''}`.trim() };
  });

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💬 Messagerie</h1>
      <p>Échangez avec les enseignants qui suivent vos enfants. Instantané : pas besoin de recharger la page.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Conversations</h1>
      ${conversations.length ? `<div class="liste-lignes-pub" style="margin-top:10px">
        ${conversations.map(c => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-conversation="${c.id}">
            <div>
              <div class="titre-ligne-pub">${c.enseignants?.profils?.prenom || ''} ${c.enseignants?.profils?.nom || ''}</div>
              <div class="sous-ligne-pub">Au sujet de ${c.eleves?.profils?.prenom || ''} ${c.eleves?.profils?.nom || ''}</div>
            </div>
          </div>`).join('')}
      </div>` : `<p style="color:var(--text-gris);margin-top:10px">Aucun enseignant suivi pour l'instant — retrouvez-les depuis votre tableau de bord.</p>`}
    </div>

    <div id="zoneConversation"></div>
  `;

  document.querySelectorAll('[data-ouvrir-conversation]').forEach(el => {
    el.addEventListener('click', () => afficherConversation(parseInt(el.dataset.ouvrirConversation, 10)));
  });

  if (conversationOuverte && conversations.some(c => c.id === conversationOuverte)) {
    await afficherConversation(conversationOuverte);
  }
}

async function afficherConversation(abonnementId) {
  conversationOuverte = abonnementId;
  const zone = document.getElementById('zoneConversation');
  zone.innerHTML = '<div class="carte-bienvenue"><p style="color:var(--text-gris)">Chargement des messages...</p></div>';

  const { data: messages, error } = await supabaseClient
    .from('messages_suivi').select('*').eq('abonnement_id', abonnementId).order('cree_le', { ascending: true });

  if (error) {
    zone.innerHTML = `<div class="carte-bienvenue"><p style="color:var(--rouge)">${error.message}</p></div>`;
    return;
  }

  const infosConv = conversationsParentParId[abonnementId] || {};

  zone.innerHTML = `
    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div id="filDiscussion" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:4px">
        ${(messages && messages.length) ? messages.map(m => htmlMessageParent(m, infosConv)).join('') : '<p style="color:var(--text-gris);font-size:13px">Aucun message pour l\'instant. Écrivez le premier !</p>'}
      </div>
      <form id="formEnvoiMessage" style="display:flex;gap:8px">
        <input type="text" id="champMessage" placeholder="Écrire un message..." style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bordure)" required>
        <button type="submit" class="btn btn-filled">Envoyer</button>
      </form>
    </div>
  `;

  document.getElementById('formEnvoiMessage').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champMessage');
    const contenu = champ.value.trim();
    if (!contenu) return;
    champ.disabled = true;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_suivi').insert({
      abonnement_id: abonnementId, expediteur_id: profilParentMsg.id, contenu
    });
    champ.disabled = false;
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
  });

  activerTempsReelParent(abonnementId, infosConv);

  const fil = document.getElementById('filDiscussion');
  fil.scrollTop = fil.scrollHeight;
}

function htmlMessageParent(m, infosConv) {
  const estMoi = m.expediteur_id === profilParentMsg.id;
  const estEnfant = !estMoi && m.expediteur_id === infosConv.eleve_id;
  const etiquette = estMoi ? null : (estEnfant ? 'Votre enfant' : (infosConv.enseignantNom || 'Enseignant'));
  return `
    <div style="align-self:${estMoi ? 'flex-end' : 'flex-start'};max-width:75%">
      ${etiquette ? `<div style="font-size:10px;font-weight:700;color:var(--text-gris);margin:0 4px 2px">${echapperMsgParent(etiquette)}</div>` : ''}
      <div style="background:${estMoi ? 'var(--bleu-kekeli)' : '#F0F2F8'};color:${estMoi ? 'white' : 'var(--text-dark)'};padding:10px 14px;border-radius:12px">
        <div style="font-size:14px;white-space:pre-wrap">${echapperMsgParent(m.contenu)}</div>
        <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
      </div>
    </div>`;
}

function activerTempsReelParent(abonnementId, infosConv) {
  if (canalMessagesParent) supabaseClient.removeChannel(canalMessagesParent);
  canalMessagesParent = supabaseClient
    .channel(`messages_suivi_parent_${abonnementId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_suivi', filter: `abonnement_id=eq.${abonnementId}` }, (payload) => {
      const fil = document.getElementById('filDiscussion');
      if (!fil) return;
      const vide = fil.querySelector('p');
      if (vide) fil.innerHTML = '';
      fil.insertAdjacentHTML('beforeend', htmlMessageParent(payload.new, infosConv));
      fil.scrollTop = fil.scrollHeight;
    })
    .subscribe();
}

function echapperMsgParent(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
