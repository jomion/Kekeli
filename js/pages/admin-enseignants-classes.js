// Page pages/admin/enseignants-classes.html
// Gère les demandes d'accès à une classe faites par les enseignants
// (table demandes_classe_enseignant) : une fois acceptée, la classe est
// ajoutée à enseignants.classes_assignees via un trigger côté base, ce
// qui donne à l'enseignant un accès lecture/édition à tout son contenu
// pédagogique (voir peut_gerer_classe_champ).

let profilAdminEC = null;

function echapperEC(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

async function init() {
  profilAdminEC = await requireAdmin();
  if (!profilAdminEC) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminEC.id,
    badgeHtml: `${profilAdminEC.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperEC(profilAdminEC.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminEC.est_super_admin })
  });

  await rendrePage();
}

async function rendrePage() {
  const zone = document.getElementById('contenu');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  const [{ data: demandes }, { data: enseignants }, { data: classes }, { data: autorisationsMC }] = await Promise.all([
    supabaseClient.from('demandes_classe_enseignant').select('*').order('demande_le', { ascending: false }),
    supabaseClient.from('enseignants').select('id, classes_assignees, profils(prenom, nom, email)'),
    supabaseClient.from('classes').select('*').order('ordre'),
    supabaseClient.from('autorisations_ma_classe').select('*, eleves(profils(prenom, nom))')
  ]);

  const classesParId = {};
  (classes || []).forEach(c => { classesParId[c.id] = c.nom; });

  const enAttente = (demandes || []).filter(d => d.statut === 'en_attente');

  zone.innerHTML = `
    <div class="titre-cycle" style="margin-top:0">Demandes en attente (${enAttente.length})</div>
    ${enAttente.length ? enAttente.map(d => {
      const ens = (enseignants || []).find(e => e.id === d.enseignant_id);
      return `<div class="carte-demande">
        <div>
          <strong>${echapperEC(ens?.profils?.prenom || '')} ${echapperEC(ens?.profils?.nom || '')}</strong>
          <span style="color:var(--texte-gris)"> — ${echapperEC(ens?.profils?.email || '')}</span><br>
          <span style="font-size:13px">demande l'accès à la classe <strong>${echapperEC(classesParId[d.classe_id] || '')}</strong></span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primaire" data-accepter-demande="${d.id}" style="padding:6px 14px;font-size:12px">✅ Accepter</button>
          <button class="btn btn-danger" data-refuser-demande="${d.id}" style="padding:6px 14px;font-size:12px">✕ Refuser</button>
        </div>
      </div>`;
    }).join('') : '<p class="chargement">Aucune demande en attente.</p>'}

    <div class="titre-cycle">Enseignants &amp; classes accordées</div>
    <table class="table-enseignants">
      <thead><tr><th>Enseignant</th><th>E-mail</th><th>Classes accordées</th></tr></thead>
      <tbody>
        ${(enseignants || []).map(e => `<tr>
          <td>${echapperEC(e.profils?.prenom || '')} ${echapperEC(e.profils?.nom || '')}</td>
          <td>${echapperEC(e.profils?.email || '')}</td>
          <td>${(e.classes_assignees || []).length
            ? e.classes_assignees.map(cid => `<span class="pastille-classe-ens">${echapperEC(classesParId[cid] || '')}<button data-retirer-classe="${e.id}:${cid}" title="Retirer">✕</button></span>`).join('')
            : '<span style="color:var(--texte-gris);font-size:12px">Aucune</span>'}</td>
        </tr>`).join('') || `<tr><td colspan="3" style="color:var(--texte-gris)">Aucun enseignant inscrit.</td></tr>`}
      </tbody>
    </table>

    <div class="titre-cycle">Autorisations « Ma classe » (accord parental)</div>
    <p style="font-size:13px;color:var(--texte-gris);margin-top:-8px">
      Depuis le 19 septembre 2026, un enseignant n'a accès au registre d'appel et au suivi d'un élève de « Ma classe »
      qu'après l'accord du parent. Vous pouvez ici suivre ces demandes, ou autoriser manuellement un élève sans
      compte parent actif.
    </p>
    ${(enseignants || []).filter(e => (e.classes_assignees || []).length).map(e => {
      const lignesEns = (autorisationsMC || []).filter(a => a.enseignant_id === e.id);
      return e.classes_assignees.map(cid => {
        const lignesClasse = lignesEns.filter(a => a.classe_id === cid);
        if (!lignesClasse.length) return '';
        return `
        <div class="carte-demande" style="flex-direction:column;align-items:stretch;gap:6px">
          <strong>${echapperEC(e.profils?.prenom || '')} ${echapperEC(e.profils?.nom || '')} — ${echapperEC(classesParId[cid] || '')}</strong>
          ${lignesClasse.map(a => {
            const nomEleve = `${a.eleves?.profils?.prenom || ''} ${a.eleves?.profils?.nom || ''}`.trim() || '(élève)';
            const libStatut = a.statut === 'accepte' ? '✅ Autorisé' : a.statut === 'refuse' ? '✕ Refusé par le parent' : '⏳ En attente du parent';
            return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0;border-top:1px solid var(--bordure)">
              <span>${echapperEC(nomEleve)} — ${libStatut}${a.source === 'ajout_manuel_admin' ? ' <span style="color:var(--texte-gris)">(ajout admin)</span>' : ''}</span>
              ${a.statut !== 'accepte' ? `<button class="btn btn-primaire" data-autoriser-manuel="${a.id}" style="padding:3px 10px;font-size:11px">✅ Autoriser manuellement</button>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      }).join('');
    }).join('') || '<p class="chargement">Aucune demande pour l\'instant.</p>'}
  `;

  zone.querySelectorAll('[data-autoriser-manuel]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmerAction("Autoriser manuellement cet élève pour cet enseignant, sans passer par le parent ?", async () => {
        const { error } = await supabaseClient.from('autorisations_ma_classe')
          .update({ statut: 'accepte', source: 'ajout_manuel_admin', traite_le: new Date().toISOString(), traite_par: profilAdminEC.id })
          .eq('id', parseInt(btn.dataset.autoriserManuel, 10));
        if (error) return alert(error.message);
        rendrePage();
      });
    });
  });

  zone.querySelectorAll('[data-accepter-demande]').forEach(btn => {
    btn.addEventListener('click', () => traiterDemande(parseInt(btn.dataset.accepterDemande, 10), 'accepte'));
  });
  zone.querySelectorAll('[data-refuser-demande]').forEach(btn => {
    btn.addEventListener('click', () => traiterDemande(parseInt(btn.dataset.refuserDemande, 10), 'refuse'));
  });
  zone.querySelectorAll('[data-retirer-classe]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [enseignantId, classeId] = btn.dataset.retirerClasse.split(':');
      retirerClasseEnseignant(enseignantId, parseInt(classeId, 10));
    });
  });
}

async function traiterDemande(id, statut) {
  const { error } = await supabaseClient.from('demandes_classe_enseignant')
    .update({ statut, traite_le: new Date().toISOString(), traite_par: profilAdminEC.id }).eq('id', id);
  if (error) return alert(error.message);
  rendrePage();
}

function retirerClasseEnseignant(enseignantId, classeId) {
  confirmerAction("Retirer l'accès à cette classe pour cet enseignant ?", async () => {
    // Supprime la demande acceptée correspondante : le trigger côté base
    // retire alors automatiquement la classe de classes_assignees.
    const { error } = await supabaseClient.from('demandes_classe_enseignant')
      .delete().eq('enseignant_id', enseignantId).eq('classe_id', classeId).eq('statut', 'accepte');
    if (error) return alert(error.message);
    rendrePage();
  });
}

init();
