// Page pages/admin/formations.html — administration de la plateforme de
// formation (24 septembre 2026). Réservée au super_admin ou à un admin dont
// le rôle a le droit « Gérer la plateforme de formation »
// (admin_a_droit(id, 'gerer_formations'), revérifié côté serveur par chaque
// fonction appelée ici).
//
// Onglets : À valider · Formations · Formateurs · Catégories · Inscriptions · Journal.

let profilAF = null;
let ongletAF = new URLSearchParams(window.location.search).get('onglet') || 'validation';
const STATUTS_AF = { brouillon: 'Brouillon', en_revision: 'À valider', publiee: 'Publiée', refusee: 'Refusée', archivee: 'Archivée' };
const STATUTS_FORMATEUR_AF = { en_attente: 'En attente', valide: 'Validé', refuse: 'Refusé', suspendu: 'Suspendu' };
const URL_FICHE_AF = '../formations/formation.html';

function eAF(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dAF(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }
function prixAF(p) { return p ? `${Number(p).toLocaleString('fr-FR')} FCFA` : 'Gratuit'; }
function erreurAF(error) { alert((error && error.message) || 'Une erreur est survenue.'); }

async function initAF() {
  profilAF = await requireAdmin();
  if (!profilAF) return;
  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAF.id,
    badgeHtml: `${profilAF.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${eAF(profilAF.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAF.est_super_admin })
  });
  const { data: autorise } = await supabaseClient.rpc('peut_gerer_formations', { p_id: profilAF.id });
  const contenu = document.getElementById('contenu');
  contenu.classList.remove('chargement');
  if (autorise !== true) {
    contenu.innerHTML = `<div class="titre-page">Plateforme de formation</div>
      <p class="message-erreur">⛔ Cette page nécessite le droit « Gérer la plateforme de formation » (à accorder par le super administrateur depuis « Rôles admin »).</p>
      <a href="tableau-de-bord.html" class="btn btn-primaire">← Retour au tableau de bord</a>`;
    return;
  }
  await afficherAF();
}

async function afficherAF() {
  const [{ count: nbRevision }, { count: nbCandidats }, { count: nbPubliees }, { count: nbInscriptions }] = await Promise.all([
    supabaseClient.from('formations').select('id', { count: 'exact', head: true }).eq('statut', 'en_revision'),
    supabaseClient.from('formateurs').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabaseClient.from('formations').select('id', { count: 'exact', head: true }).eq('statut', 'publiee'),
    supabaseClient.from('formation_inscriptions').select('id', { count: 'exact', head: true })
  ]);
  const onglets = [['validation', `📝 À valider (${nbRevision || 0})`], ['formations', '📚 Formations'], ['formateurs', `👨‍🏫 Formateurs (${nbCandidats || 0} en attente)`],
    ['categories', '🗂️ Catégories'], ['inscriptions', '🎓 Inscriptions'], ['paiements', '💳 Paiements'], ['journal', '🧾 Journal']];
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">🎓 Plateforme de formation</div>
    <div class="sous-titre-page">Validation des formateurs et des formations, catégories, inscriptions. <a href="../formations/index.html">Voir le site Formation →</a></div>
    <div class="af-stats">
      <div class="af-stat"><small>À valider</small><strong>${nbRevision || 0}</strong></div>
      <div class="af-stat"><small>Candidatures formateur</small><strong>${nbCandidats || 0}</strong></div>
      <div class="af-stat"><small>Formations publiées</small><strong>${nbPubliees || 0}</strong></div>
      <div class="af-stat"><small>Inscriptions</small><strong>${nbInscriptions || 0}</strong></div>
    </div>
    <div class="af-onglets" role="tablist">${onglets.map(([k, l]) => `<button role="tab" data-onglet="${k}" class="${k === ongletAF ? 'actif' : ''}" aria-selected="${k === ongletAF}">${l}</button>`).join('')}</div>
    <div id="zoneAF" class="chargement">Chargement...</div>`;
  document.querySelectorAll('[data-onglet]').forEach(b => b.addEventListener('click', () => {
    ongletAF = b.dataset.onglet;
    const u = new URL(window.location.href); u.searchParams.set('onglet', ongletAF); history.replaceState(null, '', u);
    afficherAF();
  }));
  const zone = document.getElementById('zoneAF');
  zone.classList.remove('chargement');
  await ({ validation: ongletValidationAF, formations: ongletFormationsAF, formateurs: ongletFormateursAF,
    categories: ongletCategoriesAF, inscriptions: ongletInscriptionsAF, paiements: ongletPaiementsAF, journal: ongletJournalAF })[ongletAF](zone);
}

// ---------- Formations ----------
async function tableFormationsAF(zone, filtreStatut) {
  let req = supabaseClient.from('formations')
    .select('id, slug, titre, statut, prix, nb_lecons, nb_inscrits, soumise_le, publiee_le, maj_le, motif_refus, formation_categories(nom), formateurs(nom_affiche)')
    .order('soumise_le', { ascending: true, nullsFirst: false }).order('maj_le', { ascending: false }).limit(200);
  if (filtreStatut) req = req.eq('statut', filtreStatut);
  const { data, error } = await req;
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  if (!data.length) { zone.innerHTML = `<div class="carte"><p>${filtreStatut === 'en_revision' ? '✅ Aucune formation en attente de validation.' : 'Aucune formation.'}</p></div>`; return; }
  zone.innerHTML = `<div class="af-table-wrap"><table class="af-table">
    <thead><tr><th>Formation</th><th>Formateur</th><th>Statut</th><th>Leçons</th><th>Inscrits</th><th>Prix</th><th>Dates</th><th>Actions</th></tr></thead>
    <tbody>${data.map(f => `<tr>
      <td><b>${eAF(f.titre)}</b><br><small>${eAF(f.formation_categories?.nom || 'Sans catégorie')}</small>${f.motif_refus ? `<br><small style="color:#c0392b">Motif : ${eAF(f.motif_refus)}</small>` : ''}</td>
      <td>${eAF(f.formateurs?.nom_affiche || '—')}</td>
      <td><span class="af-pastille ${f.statut}">${STATUTS_AF[f.statut]}</span></td>
      <td>${f.nb_lecons}</td><td>${f.nb_inscrits}</td><td>${prixAF(f.prix)}</td>
      <td><small>${f.soumise_le ? `Soumise ${dAF(f.soumise_le)}<br>` : ''}${f.publiee_le ? `Publiée ${dAF(f.publiee_le)}` : `Modifiée ${dAF(f.maj_le)}`}</small></td>
      <td><div class="af-actions">
        <a class="btn btn-discret" href="${URL_FICHE_AF}?id=${f.id}" target="_blank" rel="noopener">👁️ Fiche</a>
        <a class="btn btn-discret" href="../formations/app/formation.html?id=${f.id}" target="_blank" rel="noopener">📖 Contenu</a>
        ${f.statut !== 'publiee' && f.statut !== 'brouillon' ? `<button class="btn btn-primaire" data-decision="publiee" data-id="${f.id}">✅ Publier</button>` : ''}
        ${f.statut === 'en_revision' ? `<button class="btn btn-danger" data-decision="refusee" data-id="${f.id}">❌ Refuser</button>` : ''}
        ${f.statut === 'publiee' ? `<button class="btn btn-danger" data-decision="archivee" data-id="${f.id}">📦 Archiver</button>` : ''}
        ${f.statut === 'archivee' || f.statut === 'refusee' ? `<button class="btn btn-discret" data-decision="brouillon" data-id="${f.id}">✏️ Repasser en brouillon</button>` : ''}
      </div></td></tr>`).join('')}</tbody></table></div>`;
  zone.querySelectorAll('[data-decision]').forEach(b => b.addEventListener('click', () => deciderFormationAF(Number(b.dataset.id), b.dataset.decision)));
}

function deciderFormationAF(id, decision) {
  const libelles = { publiee: 'Publier cette formation', refusee: 'Refuser cette formation', archivee: 'Archiver cette formation', brouillon: 'Repasser en brouillon' };
  const envoyer = async (motif) => {
    const { error } = await supabaseClient.rpc('admin_decider_formation', { p_id: id, p_decision: decision, p_motif: motif || null });
    if (error) { erreurAF(error); return; }
    afficherAF();
  };
  if (decision === 'publiee') { confirmerAction('Publier cette formation ? Elle sera visible dans le catalogue et ouverte aux inscriptions.', () => envoyer(null)); return; }
  ouvrirModal({
    titre: libelles[decision],
    champs: [{ nom: 'motif', label: decision === 'refusee' ? 'Motif (transmis au formateur)' : 'Message au formateur (facultatif)', type: 'textarea', requis: decision === 'refusee' }],
    texteValider: 'Confirmer',
    onValider: v => envoyer(v.motif)
  });
}

const ongletValidationAF = zone => tableFormationsAF(zone, 'en_revision');

async function ongletFormationsAF(zone) {
  zone.innerHTML = `<div class="barre-filtres-admin" style="margin-bottom:12px">
      <label>Statut <select id="filtreStatutAF"><option value="">Tous</option>${Object.entries(STATUTS_AF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    </div><div id="tableAF"></div>`;
  const sel = zone.querySelector('#filtreStatutAF');
  const t = zone.querySelector('#tableAF');
  sel.addEventListener('change', () => tableFormationsAF(t, sel.value));
  await tableFormationsAF(t, '');
}

// ---------- Formateurs ----------
async function ongletFormateursAF(zone) {
  const { data, error } = await supabaseClient.rpc('admin_liste_formateurs');
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  if (!data.length) { zone.innerHTML = '<div class="carte"><p>Aucune candidature formateur pour le moment.</p></div>'; return; }
  zone.innerHTML = `<div class="af-table-wrap"><table class="af-table">
    <thead><tr><th>Formateur</th><th>Expertise</th><th>Présentation</th><th>Statut</th><th>Formations</th><th>Actions</th></tr></thead>
    <tbody>${data.map(f => `<tr>
      <td><b>${eAF(f.nom_affiche)}</b><br><small>${eAF(f.email)}</small><br><small>${eAF(f.titre_professionnel || '')}</small>
        ${f.site_web ? `<br><a href="${eAF(f.site_web)}" target="_blank" rel="noopener nofollow">🌐 Site</a>` : ''}</td>
      <td>${eAF(f.expertise)}</td>
      <td style="max-width:360px"><details><summary>${eAF((f.biographie || '').slice(0, 90))}…</summary><p>${eAF(f.biographie)}</p>${f.experience ? `<p><b>Expérience :</b> ${eAF(f.experience)}</p>` : ''}</details>
        <small>Candidature du ${dAF(f.cree_le)}</small>${f.motif_refus ? `<br><small style="color:#c0392b">Motif : ${eAF(f.motif_refus)}</small>` : ''}</td>
      <td><span class="af-pastille ${f.statut}">${STATUTS_FORMATEUR_AF[f.statut]}</span></td>
      <td>${f.nb_formations}</td>
      <td><div class="af-actions">
        ${f.statut !== 'valide' ? `<button class="btn btn-primaire" data-formateur="${f.id}" data-dec="valide">✅ Valider</button>` : ''}
        ${f.statut === 'en_attente' ? `<button class="btn btn-danger" data-formateur="${f.id}" data-dec="refuse">❌ Refuser</button>` : ''}
        ${f.statut === 'valide' ? `<button class="btn btn-danger" data-formateur="${f.id}" data-dec="suspendu">⛔ Suspendre</button>` : ''}
        ${f.statut === 'valide' ? `<a class="btn btn-discret" href="../formations/formateur.html?slug=${encodeURIComponent(f.slug)}" target="_blank" rel="noopener">👁️ Profil</a>` : ''}
      </div></td></tr>`).join('')}</tbody></table></div>`;
  zone.querySelectorAll('[data-formateur]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.formateur, dec = b.dataset.dec;
    const envoyer = async motif => {
      const { error: e2 } = await supabaseClient.rpc('admin_decider_formateur', { p_formateur_id: id, p_decision: dec, p_motif: motif || null });
      if (e2) { erreurAF(e2); return; }
      afficherAF();
    };
    if (dec === 'valide') { confirmerAction('Valider ce formateur ? Il pourra créer des formations (chacune restera vérifiée avant publication).', () => envoyer(null)); return; }
    ouvrirModal({ titre: dec === 'refuse' ? 'Refuser la candidature' : 'Suspendre le formateur',
      champs: [{ nom: 'motif', label: 'Motif (transmis au formateur)', type: 'textarea', requis: true }],
      texteValider: 'Confirmer', onValider: v => envoyer(v.motif) });
  }));
}

// ---------- Catégories ----------
async function ongletCategoriesAF(zone) {
  const { data, error } = await supabaseClient.from('formation_categories').select('*').order('position').order('nom');
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  const parents = data.filter(c => !c.parent_id);
  const ligne = (c, sous) => `<tr>
    <td>${sous ? '&nbsp;&nbsp;↳ ' : ''}${eAF(c.icone || '')} <b>${eAF(c.nom)}</b><br><small>${eAF(c.slug)}</small></td>
    <td>${eAF(c.description || '')}</td><td>${c.position}</td>
    <td><span class="af-pastille ${c.statut}">${c.statut === 'actif' ? 'Active' : 'Inactive'}</span></td>
    <td><div class="af-actions"><button class="btn btn-discret" data-edit-cat="${c.id}">✏️ Modifier</button>
      <button class="btn btn-discret" data-bascule-cat="${c.id}">${c.statut === 'actif' ? '🚫 Désactiver' : '✅ Activer'}</button></div></td></tr>`;
  zone.innerHTML = `<button class="btn btn-primaire" id="btnNouvelleCat" style="margin-bottom:12px">＋ Nouvelle catégorie</button>
    <div class="af-table-wrap"><table class="af-table"><thead><tr><th>Catégorie</th><th>Description</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr></thead>
    <tbody>${parents.map(p => ligne(p, false) + data.filter(c => c.parent_id === p.id).map(c => ligne(c, true)).join('')).join('')}</tbody></table></div>`;

  const formulaire = cat => ouvrirModal({
    titre: cat ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    champs: [
      { nom: 'nom', label: 'Nom', valeur: eAF(cat?.nom || '') },
      { nom: 'icone', label: 'Icône (emoji)', valeur: eAF(cat?.icone || ''), requis: false },
      { nom: 'parent_id', label: 'Catégorie parente', type: 'select', valeur: String(cat?.parent_id || ''), options: [{ valeur: '', label: '— Aucune (catégorie principale) —' }, ...parents.filter(p => p.id !== cat?.id).map(p => ({ valeur: String(p.id), label: eAF(p.nom) }))], requis: false },
      { nom: 'description', label: 'Description', type: 'textarea', valeur: eAF(cat?.description || ''), requis: false },
      { nom: 'position', label: 'Ordre d\'affichage', type: 'number', valeur: cat?.position ?? (data.length + 1) }
    ],
    onValider: async v => {
      const slugBase = v.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const donnees = { nom: v.nom.trim(), icone: v.icone.trim() || null, parent_id: v.parent_id ? Number(v.parent_id) : null, description: v.description.trim() || null, position: parseInt(v.position, 10) || 0 };
      const { error: e2 } = cat
        ? await supabaseClient.from('formation_categories').update(donnees).eq('id', cat.id)
        : await supabaseClient.from('formation_categories').insert({ ...donnees, slug: `${slugBase}${data.some(c => c.slug === slugBase) ? '-' + Date.now().toString(36) : ''}` });
      if (e2) { erreurAF(e2); return; }
      afficherAF();
    }
  });
  zone.querySelector('#btnNouvelleCat').addEventListener('click', () => formulaire(null));
  zone.querySelectorAll('[data-edit-cat]').forEach(b => b.addEventListener('click', () => formulaire(data.find(c => c.id === Number(b.dataset.editCat)))));
  zone.querySelectorAll('[data-bascule-cat]').forEach(b => b.addEventListener('click', async () => {
    const c = data.find(x => x.id === Number(b.dataset.basculeCat));
    const { error: e2 } = await supabaseClient.from('formation_categories').update({ statut: c.statut === 'actif' ? 'inactif' : 'actif' }).eq('id', c.id);
    if (e2) { erreurAF(e2); return; }
    afficherAF();
  }));
}

// ---------- Inscriptions ----------
async function ongletInscriptionsAF(zone, page) {
  const p = page || 0, parPage = 50;
  const { data, error } = await supabaseClient.rpc('admin_liste_inscriptions', { p_limite: parPage, p_decalage: p * parPage });
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  const total = data[0]?.total || 0;
  zone.innerHTML = data.length ? `<div class="af-table-wrap"><table class="af-table">
    <thead><tr><th>Apprenant</th><th>Formation</th><th>Progression</th><th>Statut</th><th>Inscrit le</th></tr></thead>
    <tbody>${data.map(i => `<tr><td>${eAF(i.apprenant)}<br><small>${eAF(i.email)}</small></td><td>${eAF(i.formation_titre)}</td>
      <td>${Math.round(i.progression)} %</td><td><span class="af-pastille ${i.statut}">${eAF(i.statut)}</span></td><td>${dAF(i.inscrit_le)}</td></tr>`).join('')}</tbody></table></div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
      ${p > 0 ? '<button class="btn btn-discret" data-page="-1">← Précédent</button>' : ''}
      <span style="align-self:center">${p * parPage + 1}–${Math.min((p + 1) * parPage, total)} sur ${total}</span>
      ${(p + 1) * parPage < total ? '<button class="btn btn-discret" data-page="1">Suivant →</button>' : ''}
    </div>` : '<div class="carte"><p>Aucune inscription pour le moment.</p></div>';
  zone.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => ongletInscriptionsAF(zone, p + Number(b.dataset.page))));
}

// ---------- Paiements FedaPay / KkiaPay (26 septembre 2026) ----------
const fcfaAF = n => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
const STATUTS_PAIEMENT_AF = { en_attente: '⏳ En attente', reussi: '✅ Réussi', echoue: '❌ Échoué', annule: '🚫 Annulé', rembourse: '↩️ Remboursé' };
async function ongletPaiementsAF(zone) {
  const [{ data: par, error: e1 }, { data: paiements, error: e2 }] = await Promise.all([
    supabaseClient.from('formation_parametres_paiement').select('*').eq('id', 1).maybeSingle(),
    supabaseClient.from('formation_paiements').select('id, formation_id, apprenant_id, prestataire, mode, montant, statut, part_kekeli, part_formateur, commission_pct, reference_externe, cree_le, confirme_le, formations(titre)')
      .order('cree_le', { ascending: false }).limit(200)
  ]);
  if (e1 || e2) { zone.innerHTML = `<p class="message-erreur">${eAF((e1 || e2).message)}</p>`; return; }
  const liste = paiements || [];
  const ids = [...new Set(liste.map(p => p.apprenant_id))];
  const { data: profils } = ids.length ? await supabaseClient.from('profils').select('id, prenom, nom, email').in('id', ids) : { data: [] };
  const nomDe = id => { const p = (profils || []).find(x => x.id === id); return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() || p.email : '—'; };
  const reels = liste.filter(p => p.statut === 'reussi' && p.mode === 'live');
  const somme = k => reels.reduce((t, p) => t + Number(p[k] || 0), 0);
  const p0 = par || { commission_pct: 15, fedapay_actif: true, kkiapay_actif: true };
  zone.innerHTML = `
    <div class="carte" style="margin-bottom:16px">
      <h3 style="margin-top:0">⚙️ Réglages du paiement</h3>
      <form id="formParPaiement" style="display:grid;gap:10px;max-width:460px">
        <label>Commission KEKELI (%) <input type="number" name="commission" min="0" max="50" step="0.5" value="${eAF(p0.commission_pct)}" style="width:90px"></label>
        <label><input type="checkbox" name="fedapay" ${p0.fedapay_actif ? 'checked' : ''}> Proposer <b>FedaPay</b> (Mobile Money, carte)</label>
        <label><input type="checkbox" name="kkiapay" ${p0.kkiapay_actif ? 'checked' : ''}> Proposer <b>KkiaPay</b> (Mobile Money, carte, Wave)</label>
        <div><button class="btn btn-principal" type="submit">Enregistrer</button> <span data-ok style="color:#0b7a5c"></span></div>
      </form>
      <p style="font-size:12px;color:#64748b;margin-bottom:0">Un moyen coché n'apparaît aux acheteurs que si ses clés sont enregistrées dans Supabase (Edge Functions → Secrets). La commission s'applique aux nouvelles ventes.</p>
    </div>
    <div class="af-stats">
      <div class="af-stat"><small>Ventes réelles</small><strong>${reels.length}</strong></div>
      <div class="af-stat"><small>Total encaissé</small><strong>${fcfaAF(somme('montant'))}</strong></div>
      <div class="af-stat"><small>Part KEKELI</small><strong>${fcfaAF(somme('part_kekeli'))}</strong></div>
      <div class="af-stat"><small>Part formateurs</small><strong>${fcfaAF(somme('part_formateur'))}</strong></div>
    </div>
    ${liste.length ? `<div class="af-table-wrap"><table class="af-table">
      <thead><tr><th>#</th><th>Date</th><th>Apprenant</th><th>Formation</th><th>Moyen</th><th>Montant</th><th>Statut</th><th>KEKELI / formateur</th></tr></thead>
      <tbody>${liste.map(p => `<tr><td>${p.id}</td><td>${new Date(p.cree_le).toLocaleString('fr-FR')}</td><td>${eAF(nomDe(p.apprenant_id))}</td>
        <td>${eAF(p.formations?.titre || '#' + p.formation_id)}</td>
        <td>${p.prestataire === 'fedapay' ? 'FedaPay' : 'KkiaPay'}${p.mode === 'test' ? ' <small style="background:#fff4d6;padding:1px 6px;border-radius:9px">test</small>' : ''}<br><small>${eAF(p.reference_externe || '')}</small></td>
        <td>${prixAF(p.montant)}</td><td>${STATUTS_PAIEMENT_AF[p.statut] || eAF(p.statut)}</td>
        <td>${p.statut === 'reussi' ? `${fcfaAF(p.part_kekeli)} / ${fcfaAF(p.part_formateur)}` : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p style="font-size:12px;color:#64748b">200 derniers paiements. Les paiements « test » ne sont pas de l'argent réel.</p>`
    : '<div class="carte"><p>Aucun paiement pour le moment.</p></div>'}`;
  zone.querySelector('#formParPaiement').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const c = Number(f.commission.value);
    if (!(c >= 0 && c <= 50)) { alert('La commission doit être comprise entre 0 et 50 %.'); return; }
    const { error } = await supabaseClient.from('formation_parametres_paiement')
      .update({ commission_pct: c, fedapay_actif: f.fedapay.checked, kkiapay_actif: f.kkiapay.checked, maj_le: new Date().toISOString() }).eq('id', 1);
    if (error) { erreurAF(error); return; }
    f.querySelector('[data-ok]').textContent = '✔ Enregistré';
  });
}

// ---------- Journal ----------
async function ongletJournalAF(zone) {
  const { data, error } = await supabaseClient.from('formation_journal').select('*').order('cree_le', { ascending: false }).limit(100);
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  zone.innerHTML = data.length ? `<div class="af-table-wrap"><table class="af-table"><thead><tr><th>Date</th><th>Action</th><th>Ressource</th><th>Détails</th></tr></thead>
    <tbody>${data.map(j => `<tr><td>${new Date(j.cree_le).toLocaleString('fr-FR')}</td><td>${eAF(j.action)}</td><td>${eAF(j.type_ressource)} #${eAF(j.ressource_id)}</td>
      <td><small>${j.details && j.details.motif ? eAF(j.details.motif) : ''}</small></td></tr>`).join('')}</tbody></table></div>
    <p style="font-size:12px;color:#64748b">100 dernières actions sensibles (candidatures, validations, soumissions, publications, inscriptions).</p>`
    : '<div class="carte"><p>Aucune action enregistrée.</p></div>';
}

initAF();
