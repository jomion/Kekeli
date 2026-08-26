// Cloche de notifications — réutilisée par tous les espaces.
// Utilisation : initClocheNotifications('idDuConteneur', profil.id)

async function initClocheNotifications(idConteneur, destinataireId) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;

  const { data } = await supabaseClient
    .from('notifications').select('*').eq('destinataire_id', destinataireId)
    .order('cree_le', { ascending: false }).limit(20);
  const notifs = data || [];
  const nbNonLues = notifs.filter(n => !n.lu).length;

  conteneur.innerHTML = `
    <div class="cloche-notif" id="clocheNotif">
      🔔${nbNonLues > 0 ? `<span class="badge-notif">${nbNonLues}</span>` : ''}
      <div class="liste-notif" id="listeNotif">
        ${notifs.length ? notifs.map(n => `
          <a href="${racineNotif()}${n.lien || '#'}" class="item-notif ${n.lu ? '' : 'non-lue'}">
            <div class="titre-notif">${echapperNotif(n.titre)}</div>
            ${n.message ? `<div class="msg-notif">${echapperNotif(n.message)}</div>` : ''}
            <div class="date-notif">${new Date(n.cree_le).toLocaleDateString('fr-FR')}</div>
          </a>`).join('') : '<div class="item-notif"><div class="msg-notif">Aucune notification.</div></div>'}
      </div>
    </div>`;

  const cloche = document.getElementById('clocheNotif');
  cloche.addEventListener('click', async () => {
    document.getElementById('listeNotif').classList.toggle('ouverte');
    if (nbNonLues > 0) {
      await supabaseClient.from('notifications').update({ lu: true }).eq('destinataire_id', destinataireId).eq('lu', false);
      cloche.querySelector('.badge-notif')?.remove();
      cloche.querySelectorAll('.item-notif.non-lue').forEach(el => el.classList.remove('non-lue'));
    }
  });

  document.addEventListener('click', (e) => {
    if (!cloche.contains(e.target)) document.getElementById('listeNotif')?.classList.remove('ouverte');
  });
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
