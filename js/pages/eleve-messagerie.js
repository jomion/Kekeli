// Page pages/eleve/messagerie.html
// Fonctionnalité Premium (voir LISEZ-MOI de cette livraison) : messagerie
// instantanée avec les enseignants suivis (réutilise abonnements_enseignant_
// eleve + messages_suivi, comme pages/parent/messagerie.html) et avec les
// camarades de la même classe (nouvelles tables conversations_eleves +
// messages_eleves). Nécessite les DEUX conditions, vérifiées côté serveur
// (fonctions SQL messagerie_eleve_autorisee / a_acces_premium_eleve, et RLS) :
// un abonnement Premium actif (famille ou élève) ET l'autorisation explicite
// d'un parent (eleves.messagerie_autorisee, activable depuis son tableau de
// bord) — cette page se contente d'aller lire ces deux états pour expliquer
// clairement ce qu'il manque le cas échéant.

let profilEleveMsg = null;
let accesPremiumMsg = false;
let autorisationParentaleMsg = false;
let conversationsEnsMsg = {}; // abonnement_id -> { enseignantNom }
let conversationsCamaradesMsg = {}; // conversation_id -> { autreId, autreNom }
let camaradesClasseMsg = [];
let canalMsgEleve = null; // canal Realtime de la conversation actuellement ouverte (enseignant OU camarade)
let ongletOuvertMsg = null; // { type: 'enseignant'|'camarade', id }

(async function () {
  profilEleveMsg = await requireRole('eleve');
  if (!profilEleveMsg) return;

  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilEleveMsg.id, badgeHtml: `🟢 ${echapperMsgEleve(profilEleveMsg.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const [{ data: eleve }, { data: acces }] = await Promise.all([
    supabaseClient.from('eleves').select('classe_id, messagerie_autorisee').eq('id', profilEleveMsg.id).single(),
    supabaseClient.rpc('a_acces_premium_eleve', { p_eleve_id: profilEleveMsg.id })
  ]);

  accesPremiumMsg = !!acces;
  autorisationParentaleMsg = !!eleve?.messagerie_autorisee;

  if (!accesPremiumMsg || !autorisationParentaleMsg) {
    afficherEtatVerrouilleMsg();
    return;
  }

  if (eleve?.classe_id) {
    const { data: camarades } = await supabaseClient
      .from('eleves').select('id, profils(prenom, nom)').eq('classe_id', eleve.classe_id).neq('id', profilEleveMsg.id);
    camaradesClasseMsg = camarades || [];
  }

  await afficherMessagerieEleve();
})();

function afficherEtatVerrouilleMsg() {
  const raison = !accesPremiumMsg
    ? "Cette fonctionnalité fait partie de l'offre <strong>Premium</strong>. Demande à tes parents de souscrire depuis leur tableau de bord."
    : "Il ne manque plus que l'autorisation d'un parent : il peut l'activer pour toi depuis son tableau de bord (section « Contrôle parental »).";

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💬 Messagerie ✨ Premium</h1>
      <p>Discute en direct avec tes enseignants et tes camarades de classe.</p>
    </div>
    <div class="carte-bienvenue" style="border-top-color:#F59E0B;text-align:center;padding:30px 20px">
      <div style="font-size:40px;margin-bottom:10px">🔒</div>
      <p style="max-width:420px;margin:0 auto;color:var(--text-dark)">${raison}</p>
    </div>
  `;
}

async function afficherMessagerieEleve() {
  const { data: abonnements } = await supabaseClient
    .from('abonnements_enseignant_eleve')
    .select('*, enseignants(profils(prenom, nom))')
    .eq('eleve_id', profilEleveMsg.id).eq('statut', 'accepte');
  const conversationsEns = abonnements || [];
  conversationsEnsMsg = {};
  conversationsEns.forEach(c => { conversationsEnsMsg[c.id] = { enseignantNom: `${c.enseignants?.profils?.prenom || ''} ${c.enseignants?.profils?.nom || ''}`.trim() }; });

  const { data: conversationsBrutes } = await supabaseClient
    .from('conversations_eleves').select('*')
    .or(`eleve_1_id.eq.${profilEleveMsg.id},eleve_2_id.eq.${profilEleveMsg.id}`);
  const camaradesParId = {};
  camaradesClasseMsg.forEach(c => { camaradesParId[c.id] = `${c.profils?.prenom || ''} ${c.profils?.nom || ''}`.trim(); });
  conversationsCamaradesMsg = {};
  (conversationsBrutes || []).forEach(c => {
    const autreId = c.eleve_1_id === profilEleveMsg.id ? c.eleve_2_id : c.eleve_1_id;
    conversationsCamaradesMsg[c.id] = { autreId, autreNom: camaradesParId[autreId] || 'Camarade' };
  });

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💬 Messagerie ✨ Premium</h1>
      <p>Instantané : pas besoin de recharger la page. Tes parents sont informés de tes échanges avec tes camarades.</p>
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Mes enseignants</h1>
      ${conversationsEns.length ? `<div class="liste-lignes-pub" style="margin-top:10px">
        ${conversationsEns.map(c => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-ens="${c.id}">
            <div class="titre-ligne-pub">${echapperMsgEleve(c.enseignants?.profils?.prenom)} ${echapperMsgEleve(c.enseignants?.profils?.nom)}</div>
          </div>`).join('')}
      </div>` : `<p style="color:var(--text-gris);margin-top:10px">Aucun enseignant suivi pour l'instant.</p>`}
    </div>

    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <h1 style="font-size:16px">Mes camarades de classe</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        ${camaradesClasseMsg.map(c => `<button type="button" class="btn btn-discret" data-demarrer-camarade="${c.id}">💬 ${echapperMsgEleve(c.profils?.prenom)} ${echapperMsgEleve(c.profils?.nom)}</button>`).join('') || '<p style="color:var(--text-gris)">Aucun camarade dans ta classe pour l\'instant.</p>'}
      </div>
      ${Object.keys(conversationsCamaradesMsg).length ? `<div class="liste-lignes-pub">
        ${Object.entries(conversationsCamaradesMsg).map(([id, info]) => `
          <div class="ligne-pub" style="cursor:pointer" data-ouvrir-camarade="${id}">
            <div class="titre-ligne-pub">${echapperMsgEleve(info.autreNom)}</div>
          </div>`).join('')}
      </div>` : ''}
    </div>

    <div id="zoneConversationMsgEleve"></div>
  `;

  document.querySelectorAll('[data-ouvrir-ens]').forEach(el => {
    el.addEventListener('click', () => ouvrirConversationEnsMsg(parseInt(el.dataset.ouvrirEns, 10)));
  });
  document.querySelectorAll('[data-ouvrir-camarade]').forEach(el => {
    el.addEventListener('click', () => ouvrirConversationCamaradeMsg(parseInt(el.dataset.ouvrirCamarade, 10)));
  });
  document.querySelectorAll('[data-demarrer-camarade]').forEach(el => {
    el.addEventListener('click', async () => {
      const { data: conversationId, error } = await supabaseClient.rpc('demarrer_conversation_eleve', { p_autre_eleve_id: el.dataset.demarrerCamarade });
      if (error) return alert(error.message);
      await afficherMessagerieEleve();
      await ouvrirConversationCamaradeMsg(conversationId);
    });
  });
}

// --- Conversation avec un enseignant (messages_suivi) ----------------------

async function ouvrirConversationEnsMsg(abonnementId) {
  ongletOuvertMsg = { type: 'enseignant', id: abonnementId };
  const zone = document.getElementById('zoneConversationMsgEleve');
  zone.innerHTML = '<div class="carte-bienvenue"><p style="color:var(--text-gris)">Chargement...</p></div>';

  const { data: messages, error } = await supabaseClient
    .from('messages_suivi').select('*').eq('abonnement_id', abonnementId).order('cree_le', { ascending: true });
  if (error) { zone.innerHTML = `<div class="carte-bienvenue"><p style="color:var(--rouge)">${error.message}</p></div>`; return; }

  const infos = conversationsEnsMsg[abonnementId] || {};
  zone.innerHTML = htmlZoneConversationMsg('filMsgEleve', messages, m => htmlBulleMsgEleve(m, m.expediteur_id === profilEleveMsg.id, infos.enseignantNom || 'Enseignant'));

  document.getElementById('formMsgEleve').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champMsgEleve');
    const contenu = champ.value.trim();
    if (!contenu) return;
    champ.disabled = true;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_suivi').insert({ abonnement_id: abonnementId, expediteur_id: profilEleveMsg.id, contenu });
    champ.disabled = false;
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
  });

  if (canalMsgEleve) supabaseClient.removeChannel(canalMsgEleve);
  canalMsgEleve = supabaseClient
    .channel(`messages_suivi_eleve_${abonnementId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_suivi', filter: `abonnement_id=eq.${abonnementId}` }, (payload) => {
      ajouterBulleMsg(payload.new, m => htmlBulleMsgEleve(m, m.expediteur_id === profilEleveMsg.id, infos.enseignantNom || 'Enseignant'));
    })
    .subscribe();
}

// --- Conversation avec un camarade (messages_eleves) ------------------------

async function ouvrirConversationCamaradeMsg(conversationId) {
  ongletOuvertMsg = { type: 'camarade', id: conversationId };
  const zone = document.getElementById('zoneConversationMsgEleve');
  zone.innerHTML = '<div class="carte-bienvenue"><p style="color:var(--text-gris)">Chargement...</p></div>';

  const { data: messages, error } = await supabaseClient
    .from('messages_eleves').select('*').eq('conversation_id', conversationId).order('cree_le', { ascending: true });
  if (error) { zone.innerHTML = `<div class="carte-bienvenue"><p style="color:var(--rouge)">${error.message}</p></div>`; return; }

  const infos = conversationsCamaradesMsg[conversationId] || {};
  zone.innerHTML = htmlZoneConversationMsg('filMsgEleve', messages, m => htmlBulleMsgEleve(m, m.expediteur_id === profilEleveMsg.id, infos.autreNom || 'Camarade'));

  document.getElementById('formMsgEleve').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = document.getElementById('champMsgEleve');
    const contenu = champ.value.trim();
    if (!contenu) return;
    champ.disabled = true;
    const { error: erreurEnvoi } = await supabaseClient.from('messages_eleves').insert({ conversation_id: conversationId, expediteur_id: profilEleveMsg.id, contenu });
    champ.disabled = false;
    if (erreurEnvoi) return alert(erreurEnvoi.message);
    champ.value = '';
  });

  if (canalMsgEleve) supabaseClient.removeChannel(canalMsgEleve);
  canalMsgEleve = supabaseClient
    .channel(`messages_eleves_${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_eleves', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      ajouterBulleMsg(payload.new, m => htmlBulleMsgEleve(m, m.expediteur_id === profilEleveMsg.id, infos.autreNom || 'Camarade'));
    })
    .subscribe();
}

// --- Rendu partagé -----------------------------------------------------

function htmlZoneConversationMsg(idFil, messages, rendreMessage) {
  return `
    <div class="carte-bienvenue" style="border-top-color:var(--bleu-kekeli)">
      <div id="${idFil}" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:4px">
        ${(messages && messages.length) ? messages.map(rendreMessage).join('') : '<p style="color:var(--text-gris);font-size:13px">Aucun message pour l\'instant. Écris le premier !</p>'}
      </div>
      <form id="formMsgEleve" style="display:flex;gap:8px">
        <input type="text" id="champMsgEleve" placeholder="Écrire un message..." style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bordure)" required>
        <button type="submit" class="btn btn-filled">Envoyer</button>
      </form>
    </div>`;
}

function htmlBulleMsgEleve(m, estMoi, nomAutre) {
  return `
    <div style="align-self:${estMoi ? 'flex-end' : 'flex-start'};max-width:75%">
      ${!estMoi ? `<div style="font-size:10px;font-weight:700;color:var(--text-gris);margin:0 4px 2px">${echapperMsgEleve(nomAutre)}</div>` : ''}
      <div style="background:${estMoi ? 'var(--bleu-kekeli)' : '#F0F2F8'};color:${estMoi ? 'white' : 'var(--text-dark)'};padding:10px 14px;border-radius:12px">
        <div style="font-size:14px;white-space:pre-wrap">${echapperMsgEleve(m.contenu)}</div>
        <div style="font-size:10px;opacity:.7;margin-top:4px">${new Date(m.cree_le).toLocaleString('fr-FR')}</div>
      </div>
    </div>`;
}

function ajouterBulleMsg(m, rendreMessage) {
  const fil = document.getElementById('filMsgEleve');
  if (!fil) return;
  const vide = fil.querySelector('p');
  if (vide) fil.innerHTML = '';
  fil.insertAdjacentHTML('beforeend', rendreMessage(m));
  fil.scrollTop = fil.scrollHeight;
}

function echapperMsgEleve(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
