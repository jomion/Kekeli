// Cloche de notifications — réutilisée par tous les espaces.
// Utilisation : initClocheNotifications('idDuConteneur', profil.id)
//
// 19 septembre 2026 : "corrige la notification pour qu'elle soit instantanée
// avec alerte... quand la notification vient, on ne reçoit pas d'alerte, on
// ne sait pas qu'il y a de notification" — jusqu'ici cette cloche ne se
// remplissait qu'au chargement de la page (aucun live, aucune alerte
// visible). On ajoute un abonnement Supabase Realtime sur `notifications`
// (INSERT, filtré par destinataire_id — même pattern déjà éprouvé sur ce
// projet pour la messagerie, voir js/pages/*messagerie*.js) qui met à jour
// la cloche EN DIRECT et affiche un toast bien visible en haut de l'écran,
// pour que l'utilisateur sache immédiatement qu'une notification vient
// d'arriver, sans avoir à recharger la page ni à cliquer sur la cloche.

let _canalNotifActif = null; // évite un double abonnement si la fonction est rappelée sur la même page

async function initClocheNotifications(idConteneur, destinataireId) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;

  const { data } = await supabaseClient
    .from('notifications').select('*').eq('destinataire_id', destinataireId)
    .order('cree_le', { ascending: false }).limit(20);
  const notifs = data || [];

  conteneur.innerHTML = `
    <div class="cloche-notif" id="clocheNotif">
      🔔<span class="badge-notif" id="badgeNotif" style="${notifs.some(n => !n.lu) ? '' : 'display:none'}">${notifs.filter(n => !n.lu).length}</span>
      <div class="liste-notif" id="listeNotif">
        ${notifs.length ? notifs.map(n => htmlItemNotif(n)).join('') : '<div class="item-notif" data-notif-vide><div class="msg-notif">Aucune notification.</div></div>'}
      </div>
    </div>`;

  const cloche = document.getElementById('clocheNotif');
  cloche.addEventListener('click', async () => {
    document.getElementById('listeNotif').classList.toggle('ouverte');
    const nonLues = cloche.querySelectorAll('.item-notif.non-lue');
    if (nonLues.length > 0) {
      await supabaseClient.from('notifications').update({ lu: true }).eq('destinataire_id', destinataireId).eq('lu', false);
      document.getElementById('badgeNotif').style.display = 'none';
      nonLues.forEach(el => el.classList.remove('non-lue'));
    }
  });

  document.addEventListener('click', (e) => {
    if (!cloche.contains(e.target)) document.getElementById('listeNotif')?.classList.remove('ouverte');
  });

  // Abonnement temps réel : une seule fois par destinataire sur la page en cours.
  if (_canalNotifActif) {
    try { supabaseClient.removeChannel(_canalNotifActif); } catch (_e) { /* pas grave */ }
    _canalNotifActif = null;
  }
  _canalNotifActif = supabaseClient
    .channel(`notifications_realtime_${destinataireId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${destinataireId}`
    }, (payload) => {
      const n = payload.new;
      const liste = document.getElementById('listeNotif');
      if (liste) {
        liste.querySelector('[data-notif-vide]')?.remove();
        liste.insertAdjacentHTML('afterbegin', htmlItemNotif(n));
      }
      const badge = document.getElementById('badgeNotif');
      if (badge) {
        badge.textContent = String((parseInt(badge.textContent, 10) || 0) + 1);
        badge.style.display = '';
      }
      afficherToastNotif(n);
    })
    .subscribe();
}

function htmlItemNotif(n) {
  return `
    <a href="${racineNotif()}${n.lien || '#'}" class="item-notif ${n.lu ? '' : 'non-lue'}">
      <div class="titre-notif">${echapperNotif(n.titre)}</div>
      ${n.message ? `<div class="msg-notif">${echapperNotif(n.message)}</div>` : ''}
      <div class="date-notif">${new Date(n.cree_le).toLocaleDateString('fr-FR')}</div>
    </a>`;
}

// Toast visible en haut à droite de l'écran, quelle que soit la page —
// injecte son propre style une seule fois (pas de dépendance à une feuille
// CSS particulière : cette cloche est chargée aussi bien côté public que
// côté admin, chacun avec sa propre feuille de style, voir css/style.css et
// css/style-public.css).
function afficherToastNotif(n) {
  if (!document.getElementById('styleToastNotif')) {
    const style = document.createElement('style');
    style.id = 'styleToastNotif';
    style.textContent = `
      #pileToastsNotif { position: fixed; top: 16px; right: 16px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; max-width: min(360px, calc(100vw - 32px)); }
      .toast-notif { background: #fff; border-left: 5px solid var(--bleu-kekeli, #2563EB); border-radius: 10px; box-shadow: 0 10px 30px rgba(20,30,60,.18); padding: 12px 14px; cursor: pointer; text-decoration: none; color: inherit; display: block; animation: toastNotifEntree .25s ease-out; }
      .toast-notif:hover { box-shadow: 0 12px 34px rgba(20,30,60,.24); }
      .toast-notif .toast-notif-titre { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; }
      .toast-notif .toast-notif-msg { font-size: 12px; color: #555; margin-top: 3px; }
      @keyframes toastNotifEntree { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }
  let pile = document.getElementById('pileToastsNotif');
  if (!pile) {
    pile = document.createElement('div');
    pile.id = 'pileToastsNotif';
    document.body.appendChild(pile);
  }
  const toast = document.createElement('a');
  toast.className = 'toast-notif';
  toast.href = `${racineNotif()}${n.lien || '#'}`;
  toast.innerHTML = `
    <div class="toast-notif-titre">🔔 ${echapperNotif(n.titre)}</div>
    ${n.message ? `<div class="toast-notif-msg">${echapperNotif(n.message)}</div>` : ''}`;
  toast.addEventListener('click', () => toast.remove());
  pile.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

// Les liens stockés en base pointent depuis la racine du site (ex: /pages/eleve/...) ;
// on les fait pointer relativement à la page courante via RACINE_SITE si définie,
// sinon on les laisse tels quels (le lien commence par "/").
function racineNotif() {
  if (typeof RACINE_SITE !== 'string' || !RACINE_SITE) return '';
  return RACINE_SITE.replace(/\/$/, '');
}

function echapperNotif(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
