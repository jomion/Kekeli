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
    ['categories', '🗂️ Catégories'], ['inscriptions', '🎓 Inscriptions'], ['paiements', '💳 Paiements'], ['ia', '🤖 IA'], ['journal', '🧾 Journal']];
  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">🎓 Plateforme de formation</div>
    <div class="sous-titre-page">Validation des formateurs et des formations, catégories, inscriptions. <a href="../formations/index.html">Voir le site Formation →</a></div>
    <div class="grille-actions-tb af-cartes-tb">${[
      ['validation', '📝', 'Formations à valider', 'Vérifier puis publier ou refuser.', nbRevision],
      ['formateurs', '👨‍🏫', 'Formateurs', 'Candidatures et comptes formateurs.', nbCandidats],
      ['formations', '📚', 'Toutes les formations', `${nbPubliees || 0} publiée(s) sur le site.`, null],
      ['inscriptions', '🎓', 'Inscriptions', `${nbInscriptions || 0} inscription(s) d'apprenants.`, null],
      ['categories', '🗂️', 'Catégories', 'Organiser le catalogue.', null],
      ['paiements', '💳', 'Paiements et commissions', 'Ventes, FedaPay / KkiaPay, commission par pack.', null],
      ['ia', '🤖', 'IA, packs et crédits', 'Packs, génération IA, images, solde OpenAI.', null],
      ['ia', '🎁', 'Accès complet offert', 'Donner toutes les fonctionnalités sans paiement.', null],
      ['journal', '🧾', 'Journal', 'Historique des actions.', null]
    ].map(([k, ic, t, x, n]) => `<a href="?onglet=${k}" class="carte-action-tb disponible af-carte-tb ${k === ongletAF ? 'af-carte-active' : ''}" data-carte-onglet="${k}">
        ${n ? `<span class="af-carte-badge">${n}</span>` : ''}<div class="icone-action-tb">${ic}</div><h3>${t}</h3><p>${x}</p></a>`).join('')}</div>
    <div id="alerteSoldeOA"></div>
    <div class="af-onglets" role="tablist">${onglets.map(([k, l]) => `<button role="tab" data-onglet="${k}" class="${k === ongletAF ? 'actif' : ''}" aria-selected="${k === ongletAF}">${l}</button>`).join('')}</div>
    <div id="zoneAF" class="chargement">Chargement...</div>`;
  document.querySelectorAll('[data-carte-onglet]').forEach(c => c.addEventListener('click', ev => {
    ev.preventDefault();
    ongletAF = c.dataset.carteOnglet;
    const u = new URL(window.location.href); u.searchParams.set('onglet', ongletAF); history.replaceState(null, '', u);
    afficherAF().then(() => document.querySelector('.af-onglets')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }));
  document.querySelectorAll('[data-onglet]').forEach(b => b.addEventListener('click', () => {
    ongletAF = b.dataset.onglet;
    const u = new URL(window.location.href); u.searchParams.set('onglet', ongletAF); history.replaceState(null, '', u);
    afficherAF();
  }));
  // Alerte visible sur tous les onglets si le solde ChatGPT estimé est bas.
  supabaseClient.rpc('formation_ia_admin_solde_openai').then(({ data }) => {
    const el = document.getElementById('alerteSoldeOA');
    if (!el || !data || data.seuil == null || Number(data.solde) >= Number(data.seuil)) return;
    el.innerHTML = `<p class="message-erreur">⚠️ Solde ChatGPT (OpenAI) estimé bas : <b>${Number(data.solde).toFixed(2).replace('.', ',')} $</b> (seuil ${data.seuil} $). <a href="?onglet=ia">Voir l'onglet 🤖 IA</a> · <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener">Recharger sur OpenAI</a></p>`;
  }, () => {});
  const zone = document.getElementById('zoneAF');
  zone.classList.remove('chargement');
  await ({ validation: ongletValidationAF, formations: ongletFormationsAF, formateurs: ongletFormateursAF,
    categories: ongletCategoriesAF, inscriptions: ongletInscriptionsAF, paiements: ongletPaiementsAF, ia: ongletIAAF, journal: ongletJournalAF })[ongletAF](zone);
}

// ---------- Formations ----------
async function tableFormationsAF(zone, filtreStatut) {
  let req = supabaseClient.from('formations')
    .select('id, slug, titre, statut, prix, nb_lecons, nb_inscrits, soumise_le, publiee_le, maj_le, motif_refus, formation_categories(nom), formateurs(nom_affiche, niveau_pro, pro_fin)')
    .order('soumise_le', { ascending: true, nullsFirst: false }).order('maj_le', { ascending: false }).limit(200);
  if (filtreStatut) req = req.eq('statut', filtreStatut);
  const { data, error } = await req;
  if (error) { zone.innerHTML = `<p class="message-erreur">${eAF(error.message)}</p>`; return; }
  if (!data.length) { zone.innerHTML = `<div class="carte"><p>${filtreStatut === 'en_revision' ? '✅ Aucune formation en attente de validation.' : 'Aucune formation.'}</p></div>`; return; }
  // Validation prioritaire : avantage des formateurs Premium (Pack Premium).
  const premium = f => f.formateurs && Number(f.formateurs.niveau_pro) >= 3 && f.formateurs.pro_fin && new Date(f.formateurs.pro_fin) > new Date();
  if (filtreStatut === 'en_revision') data.sort((a, b) => Number(premium(b)) - Number(premium(a)));
  zone.innerHTML = `<div class="af-table-wrap"><table class="af-table">
    <thead><tr><th>Formation</th><th>Formateur</th><th>Statut</th><th>Leçons</th><th>Inscrits</th><th>Prix</th><th>Dates</th><th>Actions</th></tr></thead>
    <tbody>${data.map(f => `<tr>
      <td><b>${eAF(f.titre)}</b><br><small>${eAF(f.formation_categories?.nom || 'Sans catégorie')}</small>${f.motif_refus ? `<br><small style="color:#c0392b">Motif : ${eAF(f.motif_refus)}</small>` : ''}</td>
      <td>${eAF(f.formateurs?.nom_affiche || '—')}${premium(f) ? '<br><small style="background:#fff1cc;color:#6b4a00;padding:1px 7px;border-radius:9px;font-weight:700">⚡ Prioritaire (Premium)</small>' : ''}</td>
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
  const [{ data: par, error: e1 }, { data: paiements, error: e2 }, { data: packsCom }] = await Promise.all([
    supabaseClient.from('formation_parametres_paiement').select('*').eq('id', 1).maybeSingle(),
    supabaseClient.from('formation_paiements').select('id, formation_id, apprenant_id, prestataire, mode, montant, statut, part_kekeli, part_formateur, commission_pct, reference_externe, cree_le, confirme_le, objet, credits, formations(titre)')
      .order('cree_le', { ascending: false }).limit(200),
    supabaseClient.from('formation_ia_packs').select('id, nom, prix, niveau, commission_pct, actif, icone').order('position').order('prix')
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
        <label>Commission KEKELI — 🌱 Pack Gratuit / sans pack payant (%) <input type="number" name="commission" min="0" max="50" step="0.5" value="${eAF(p0.commission_pct)}" style="width:90px"></label>
        ${(packsCom || []).filter(k => k.prix > 0).map(k => `<label>Commission — ${eAF(k.icone || '🛒')} ${eAF(k.nom)} (%)${k.actif ? '' : ' <small>(pack masqué)</small>'} <input type="number" data-com-pack="${k.id}" min="0" max="50" step="0.5" value="${eAF(k.commission_pct ?? '')}" style="width:90px"></label>`).join('')}
        <label><input type="checkbox" name="fedapay" ${p0.fedapay_actif ? 'checked' : ''}> Proposer <b>FedaPay</b> (Mobile Money, carte)</label>
        <label><input type="checkbox" name="kkiapay" ${p0.kkiapay_actif ? 'checked' : ''}> Proposer <b>KkiaPay</b> (Mobile Money, carte, Wave)</label>
        <div><button class="btn btn-principal" type="submit">Enregistrer</button> <span data-ok style="color:#0b7a5c"></span></div>
      </form>
      <p style="font-size:12px;color:#64748b;margin-bottom:0">Un moyen coché n'apparaît aux acheteurs que si ses clés sont enregistrées dans Supabase (Edge Functions → Secrets). Chaque pack a sa propre commission : elle s'applique aux ventes du formateur tant que son dernier pack acheté est valable (30 jours) ; ensuite, commission « sans pack ». Nouvelles ventes seulement.</p>
    </div>
    <div class="af-stats">
      <div class="af-stat"><small>Ventes réelles</small><strong>${reels.length}</strong></div>
      <div class="af-stat"><small>Total encaissé</small><strong>${fcfaAF(somme('montant'))}</strong></div>
      <div class="af-stat"><small>Part KEKELI</small><strong>${fcfaAF(somme('part_kekeli'))}</strong></div>
      <div class="af-stat"><small>Part formateurs</small><strong>${fcfaAF(somme('part_formateur'))}</strong></div>
    </div>
    ${liste.length ? `<div class="af-table-wrap"><table class="af-table">
      <thead><tr><th>#</th><th>Date</th><th>Acheteur</th><th>Achat</th><th>Moyen</th><th>Montant</th><th>Statut</th><th>KEKELI / formateur</th></tr></thead>
      <tbody>${liste.map(p => `<tr><td>${p.id}</td><td>${new Date(p.cree_le).toLocaleString('fr-FR')}</td><td>${eAF(nomDe(p.apprenant_id))}</td>
        <td>${p.objet === 'ia_pack' ? '🪙 Pack de crédits IA' : p.objet === 'ia_abonnement' ? '📅 Abonnement IA' : eAF(p.formations?.titre || '#' + p.formation_id)}${p.credits ? ` <small>(${p.credits} crédits)</small>` : ''}</td>
        <td>${p.prestataire === 'fedapay' ? 'FedaPay' : 'KkiaPay'}${p.mode === 'test' ? ' <small style="background:#fff4d6;padding:1px 6px;border-radius:9px">test</small>' : ''}<br><small>${eAF(p.reference_externe || '')}</small></td>
        <td>${prixAF(p.montant)}</td><td>${STATUTS_PAIEMENT_AF[p.statut] || eAF(p.statut)}</td>
        <td>${p.statut === 'reussi' ? `${fcfaAF(p.part_kekeli)} / ${fcfaAF(p.part_formateur)}` : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p style="font-size:12px;color:#64748b">200 derniers paiements. Les paiements « test » ne sont pas de l'argent réel.</p>`
    : '<div class="carte"><p>Aucun paiement pour le moment.</p></div>'}`;
  zone.querySelector('#formParPaiement').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const c = Number(f.commission.value);
    const coms = [...f.querySelectorAll('[data-com-pack]')].map(i => ({ id: Number(i.dataset.comPack), v: i.value === '' ? null : Number(i.value) }));
    if (![c, ...coms.map(x => x.v ?? 0)].every(x => x >= 0 && x <= 50)) { alert('Les commissions doivent être comprises entre 0 et 50 %.'); return; }
    for (const x of coms) {
      const { error: ek } = await supabaseClient.from('formation_ia_packs').update({ commission_pct: x.v }).eq('id', x.id);
      if (ek) { erreurAF(ek); return; }
    }
    const { error } = await supabaseClient.from('formation_parametres_paiement')
      .update({ commission_pct: c, fedapay_actif: f.fedapay.checked, kkiapay_actif: f.kkiapay.checked, maj_le: new Date().toISOString() }).eq('id', 1);
    if (error) { erreurAF(error); return; }
    f.querySelector('[data-ok]').textContent = '✔ Enregistré';
  });
}

// ---------- IA payante : réglages, packs, comptes (26 septembre 2026 ; abonnement remplacé par le Pack Premium le 27) ----------
const LIB_MVT_AF = { achat_pack: '🛒 Pack', abonnement: '📅 Abonnement', usage_quiz: '🧠 Quiz', usage_formation: '🤖 Formation IA', usage_image: '🎨 Image IA', remboursement: '↩️ Remboursement', expiration: '⌛ Fin de pack', report: '🔁 Report', ajustement: '🛠️ Ajustement' };
// Options d'images (IA × qualité × crédits) — formation_ia_parametres.images_options.
function ligneOptionImage(o) {
  const x = o || { id: '', fournisseur: 'openai', qualite: 'moyenne', libelle: '', modele: 'gpt-image-1', credits: 5, cout_usd: 0.06, actif: true };
  return `<tr data-option-image data-id="${eAF(x.id || '')}">
    <td style="text-align:center"><input type="checkbox" data-o="actif" ${x.actif !== false ? 'checked' : ''}></td>
    <td><select data-o="fournisseur"><option value="openai" ${x.fournisseur === 'openai' ? 'selected' : ''}>ChatGPT (OpenAI)</option><option value="gemini" ${x.fournisseur === 'gemini' ? 'selected' : ''}>Gemini (Google)</option></select></td>
    <td><select data-o="qualite">${[['basse', 'Basse / rapide'], ['moyenne', 'Moyenne'], ['haute', 'Haute']].map(([v, l]) => `<option value="${v}" ${x.qualite === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><input data-o="libelle" value="${eAF(x.libelle || '')}" maxlength="80" style="width:190px"></td>
    <td><input data-o="modele" value="${eAF(x.modele || '')}" maxlength="80" style="width:170px"></td>
    <td><input data-o="credits" type="number" min="0" value="${Number(x.credits) || 0}" style="width:70px"></td>
    <td><input data-o="cout_usd" type="number" min="0" step="0.001" value="${Number(x.cout_usd) || 0}" style="width:80px"></td>
    <td><button type="button" class="btn btn-discret" data-suppr-option-image title="Supprimer">🗑️</button></td></tr>`;
}
function lireOptionsImages(form) {
  return [...form.querySelectorAll('[data-option-image]')].map((tr, i) => {
    const v = k => tr.querySelector(`[data-o="${k}"]`);
    const fournisseur = v('fournisseur').value, qualite = v('qualite').value;
    return { id: tr.dataset.id || `${fournisseur}_${qualite}_${i + 1}`, fournisseur, qualite,
      libelle: v('libelle').value.trim() || `${fournisseur === 'openai' ? 'ChatGPT' : 'Gemini'} — ${qualite}`,
      modele: v('modele').value.trim() || (fournisseur === 'openai' ? 'gpt-image-1' : 'gemini-2.5-flash-image'),
      credits: Math.max(0, Math.round(Number(v('credits').value) || 0)), cout_usd: Math.max(0, Number(v('cout_usd').value) || 0), actif: v('actif').checked };
  });
}
async function ongletIAAF(zone) {
  const [{ data: par, error: e1 }, { data: packs }, { data: lotsActifs }, { data: mvts }, { data: comptes }, { data: soldeOA }, { data: recharges }] = await Promise.all([
    supabaseClient.from('formation_ia_parametres').select('*').eq('id', 1).maybeSingle(),
    supabaseClient.from('formation_ia_packs').select('*').order('position').order('prix'),
    supabaseClient.from('formation_ia_lots').select('formateur_id, credits_restants, expire_le').gt('credits_restants', 0).gt('expire_le', new Date().toISOString()),
    supabaseClient.from('formation_ia_mouvements').select('*').order('cree_le', { ascending: false }).limit(100),
    supabaseClient.from('formation_ia_comptes').select('*').order('maj_le', { ascending: false }).limit(200),
    supabaseClient.rpc('formation_ia_admin_solde_openai'),
    supabaseClient.from('formation_ia_openai_recharges').select('*').order('cree_le', { ascending: false }).limit(10)
  ]);
  if (e1) { zone.innerHTML = `<p class="message-erreur">${eAF(e1.message)}</p>`; return; }
  const ids = [...new Set([...(mvts || []).map(m => m.formateur_id), ...(comptes || []).map(c => c.formateur_id)])];
  const { data: profils } = ids.length ? await supabaseClient.from('profils').select('id, prenom, nom, email').in('id', ids) : { data: [] };
  const nomDe = id => { const p = (profils || []).find(x => x.id === id); return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() || p.email : '—'; };
  const p = par || { credits_par_question: 1, credits_formation: 80, essai_questions: 5, modele: 'gpt-6-sol', actif: true };
  const ligneProduit = (x, type) => `<tr data-${type}="${x.id}">
      <td><input data-k="nom" value="${eAF(x.nom)}" maxlength="80" style="width:100%"></td>
      ${type === 'pack' ? `<td><input data-k="credits" type="number" min="1" value="${x.credits}" style="width:90px"></td>`
        : `<td><input data-k="credits_mensuels" type="number" min="1" value="${x.credits_mensuels}" style="width:90px"></td><td><input data-k="duree_jours" type="number" min="1" max="366" value="${x.duree_jours}" style="width:70px"></td>`}
      <td><input data-k="prix" type="number" min="0" step="50" value="${x.prix}" style="width:100px" title="0 = pack gratuit (ne s'achète pas)"></td>
      <td><input data-k="icone" value="${eAF(x.icone || '')}" maxlength="4" style="width:44px" title="Icône"> <input data-k="titre_formateur" value="${eAF(x.titre_formateur || '')}" maxlength="60" style="width:150px" placeholder="Titre du formateur"></td>
      <td><select data-k="niveau" data-num>${[[0, '0 · Gratuit'], [1, '1 · Découverte'], [2, '2 · Formateur / Pro'], [3, '3 · Premium']].map(([v, l]) => `<option value="${v}" ${Number(x.niveau) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${type === 'pack' ? `<br><small>valable</small> <input data-k="duree_avantages_jours" type="number" min="0" max="366" value="${x.duree_avantages_jours ?? 30}" style="width:60px"> <small>j</small>` : ''}</td>
      <td style="text-align:center"><input data-k="generation_complete" type="checkbox" ${x.generation_complete ? 'checked' : ''}></td>
      ${type === 'pack' ? `<td style="text-align:center"><input data-k="report_credits" type="checkbox" ${x.report_credits ? 'checked' : ''}></td>` : ''}
      <td><input data-k="bonus_credits" type="number" min="0" value="${x.bonus_credits ?? 0}" style="width:70px"></td>
      <td><input data-k="prix_lancement" data-vide-null type="number" min="0" step="50" value="${x.prix_lancement ?? ''}" placeholder="—" style="width:90px"><br><small>places</small> <input data-k="places_lancement" type="number" min="0" value="${x.places_lancement ?? 0}" style="width:60px"></td>
      <td><input data-k="position" type="number" value="${x.position}" style="width:60px"></td>
      <td style="text-align:center"><input data-k="actif" type="checkbox" ${x.actif ? 'checked' : ''}></td>
      <td style="white-space:nowrap"><button class="btn btn-principal" data-enreg>💾</button> <button class="btn btn-discret" data-suppr title="Supprimer">🗑️</button></td></tr>`;
  const so = soldeOA || { solde: 0, recharges: 0, depense: 0, depense_7j: 0, depense_30j: 0, appels_30j: 0 };
  const taux = Number(p.taux_fcfa_usd || 600);
  const usd = v => `${Number(v || 0).toFixed(2).replace('.', ',')} $`;
  const fcfaAF2 = v => `≈ ${Math.round(Number(v || 0) * taux).toLocaleString('fr-FR')} FCFA`;
  const parJour = Number(so.depense_7j || 0) / 7;
  const joursRestants = parJour > 0 ? Math.max(0, Math.floor(Number(so.solde) / parJour)) : null;
  const bas = Number(so.solde) < Number(p.seuil_alerte_usd ?? 5);
  const { data: offerts } = await supabaseClient.rpc('formation_admin_liste_acces_offerts');
  zone.innerHTML = `
    <div class="carte" style="margin-bottom:16px">
      <h3 style="margin-top:0">🎁 Comptes à accès complet offert</h3>
      <p style="font-size:13px;color:#64748b;margin-top:0">Le compte a accès à <b>toutes</b> les fonctionnalités de formation (assistance IA sans crédits, génération complète, mise en forme avancée, statistiques, messages groupés, badge Premium, commission Premium…) <b>sans aucun paiement</b>. Utile pour un partenaire, un formateur invité ou un test.</p>
      <form id="formAccesOffert" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label>E-mail ou identifiant du compte <input name="email" required placeholder="formateur@exemple.com" style="width:230px"></label>
        <label>Jusqu'au (facultatif) <input name="fin" type="date"></label>
        <label>Motif <input name="motif" maxlength="300" placeholder="ex. partenaire, test" style="width:180px"></label>
        <button class="btn btn-principal" type="submit">🎁 Offrir l'accès complet</button>
      </form>
      ${(offerts || []).length ? `<div class="af-table-wrap" style="margin-top:12px"><table class="af-table"><thead><tr><th>Compte</th><th>Jusqu'au</th><th>Motif</th><th></th></tr></thead>
        <tbody>${offerts.map(o => `<tr><td><b>${eAF(o.nom || '—')}</b><br><small>${eAF(o.email || '')}</small></td><td>${o.fin ? dAF(o.fin) + (o.actif ? '' : ' <small style="color:#c0392b">(terminé)</small>') : 'Sans limite'}</td><td>${eAF(o.motif || '')}</td>
          <td><button class="btn btn-danger" data-retirer-acces="${eAF(o.email || '')}">Retirer</button></td></tr>`).join('')}</tbody></table></div>` : '<p style="font-size:13px;margin-bottom:0">Aucun compte à accès offert pour le moment.</p>'}
    </div>
    <div class="carte" style="margin-bottom:16px;${bas ? 'border:2px solid #dc2626' : ''}">
      <h3 style="margin-top:0">💰 Compte ChatGPT de KEKELI (OpenAI)</h3>
      ${bas ? `<p class="message-erreur" style="margin-top:0">⚠️ Solde estimé sous le seuil d'alerte : rechargez votre compte sur <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener">platform.openai.com</a>, puis notez la recharge ci-dessous.</p>` : ''}
      <div class="af-stats">
        <div class="af-stat"><small>Solde estimé</small><strong style="color:${bas ? '#dc2626' : '#0b7a5c'}">${usd(so.solde)}</strong><small>${fcfaAF2(so.solde)}</small></div>
        <div class="af-stat"><small>Dépensé (7 jours)</small><strong>${usd(so.depense_7j)}</strong><small>${fcfaAF2(so.depense_7j)}</small></div>
        <div class="af-stat"><small>Dépensé (30 jours)</small><strong>${usd(so.depense_30j)}</strong><small>${so.appels_30j} appel(s) à ChatGPT</small></div>
        <div class="af-stat"><small>Il reste environ</small><strong>${joursRestants === null ? '—' : joursRestants + ' jour(s)'}</strong><small>au rythme des 7 derniers jours</small></div>
      </div>
      <p style="font-size:13px;margin:10px 0 0">♊ Gemini sur 30 jours : <b>${so.gemini_gratuit_30j || 0}</b> appel(s) avec la clé <b>gratuite</b> · <b>${so.gemini_payant_30j || 0}</b> avec la clé <b>payante</b> (utilisée seulement quand la gratuite est saturée).</p>
      <form id="formRechargeOA" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin:12px 0">
        <label>J'ai rechargé OpenAI de <input type="number" name="montant" min="1" step="0.01" required style="width:100px"> $</label>
        <label>Note <input name="note" maxlength="300" placeholder="ex. carte Visa, 26/09" style="width:200px"></label>
        <button class="btn btn-principal" type="submit">Enregistrer la recharge</button>
      </form>
      <details><summary style="cursor:pointer;font-weight:700">Réglages du suivi et dernières recharges</summary>
        <form id="formSuiviOA" style="display:grid;gap:8px;max-width:560px;margin-top:10px">
          <label>Alerte quand le solde passe sous <input type="number" name="seuil" min="0" step="0.5" value="${p.seuil_alerte_usd ?? 5}" style="width:90px"> $</label>
          <label>Prix OpenAI — entrée : <input type="number" name="pe" min="0" step="0.01" value="${p.prix_entree_usd ?? 2}" style="width:80px"> $ / million de jetons ; sortie : <input type="number" name="ps" min="0" step="0.01" value="${p.prix_sortie_usd ?? 10}" style="width:80px"> $ / million</label>
          <label>Taux de change : 1 $ = <input type="number" name="taux" min="1" value="${taux}" style="width:90px"> FCFA</label>
          <div><button class="btn btn-principal" type="submit">Enregistrer</button> <span data-ok style="color:#0b7a5c"></span></div>
        </form>
        <ul style="font-size:13px">${(recharges || []).map(r => `<li>${dAF(r.cree_le)} : ${usd(r.montant_usd)}${r.note ? ` — ${eAF(r.note)}` : ''}</li>`).join('') || '<li>Aucune recharge enregistrée.</li>'}</ul>
      </details>
      <p style="font-size:12px;color:#64748b;margin-bottom:0">OpenAI ne permet pas de lire le solde automatiquement : KEKELI l'estime (recharges notées ici − coût réel de chaque appel à ChatGPT). Les gestionnaires reçoivent une notification 🔔 dès que le solde passe sous le seuil, puis chaque matin tant qu'il reste bas, et immédiatement si OpenAI refuse une demande faute de crédit. Vérifiez de temps en temps le vrai solde sur platform.openai.com et corrigez avec une recharge (négative si besoin).</p>
    </div>
    <div class="carte" style="margin-bottom:16px">
      <h3 style="margin-top:0">⚙️ Réglages de l'IA (ChatGPT)</h3>
      <form id="formParIA" style="display:grid;gap:10px;max-width:560px">
        <label><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''}> Génération par IA activée</label>
        <label>IA pour la création de formations
          <select name="ia_formation">
            <option value="gemini" ${p.ia_formation !== 'chatgpt' ? 'selected' : ''}>Gemini gratuit → Gemini payant (si saturé) → ChatGPT</option>
            <option value="chatgpt" ${p.ia_formation === 'chatgpt' ? 'selected' : ''}>ChatGPT d'abord → Gemini gratuit → Gemini payant</option>
          </select></label>
        <label>Modèle ChatGPT <input name="modele" value="${eAF(p.modele)}" maxlength="60" style="width:180px"> <small>(ex. gpt-6-sol, gpt-6-luna)</small></label>
        <label>Crédits par question de quiz <input type="number" name="cq" min="0" value="${p.credits_par_question}" style="width:90px"></label>
        <fieldset style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px"><legend><b>Génération IA d'une formation</b></legend>
          <label>🧩 Module par module — crédits pour le plan <input type="number" name="cplan" min="0" value="${p.credits_plan ?? 10}" style="width:80px"></label><br>
          <label>🧩 Module par module — crédits par module rédigé <input type="number" name="cmod" min="0" value="${p.credits_module ?? 25}" style="width:80px"></label><br>
          <label>🧩 Module par module — ouvert à partir du niveau <select name="nmod">${[[0, 'Pack Gratuit (tous)'], [1, 'Pack Découverte'], [2, 'Pack Formateur / Pro'], [3, 'Pack Premium']].map(([v, l]) => `<option value="${v}" ${Number(p.niveau_generation_module ?? 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><br>
          <label>⚡ Formation complète d'un coup — crédits <input type="number" name="cf" min="0" value="${p.credits_formation}" style="width:80px"></label>
          <small style="display:block;color:#64748b">La génération complète est réservée aux packs où la case « ⚡ Complète » est cochée ci-dessous. Gardez-la moins chère que « plan + tous les modules » pour la rendre attractive.</small>
        </fieldset>
        <fieldset style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px"><legend><b>🎨 Génération IA d'images : IA et crédits selon la qualité</b></legend>
          <div class="af-table-wrap"><table class="af-table" data-images-options><thead><tr><th>Actif</th><th>IA</th><th>Qualité</th><th>Nom affiché</th><th>Modèle</th><th>Crédits</th><th>Coût réel ($)</th><th></th></tr></thead>
            <tbody>${(Array.isArray(p.images_options) ? p.images_options : []).map(ligneOptionImage).join('')}</tbody></table></div>
          <button type="button" class="btn btn-discret" data-ajout-option-image>＋ Ajouter une option</button>
          <small style="display:block;color:#64748b;margin-top:6px">Le formateur choisit l'IA puis la qualité ; il paie les crédits de l'option. ChatGPT : modèle OpenAI (ex. gpt-image-1) et qualité basse / moyenne / haute. Gemini : modèle « imagen-… » (Imagen) ou « gemini-…-image ». Clés dans Supabase → Secrets : OPENAI_API_KEY, GEMINI_API_KEY, GEMINI_API_KEY_PAYANT. Le coût réel sert au suivi du solde OpenAI.</small>
          <label style="display:block;margin-top:8px">Maximum <input type="number" name="limg" min="0" value="${p.limite_images_jour ?? 20}" style="width:80px"> images par jour et par formateur</label>
        </fieldset>
        <label>Parrainage : crédits offerts au parrain <input type="number" name="bp" min="0" value="${p.bonus_parrain ?? 50}" style="width:80px"> · au filleul <input type="number" name="bf" min="0" value="${p.bonus_filleul ?? 20}" style="width:80px"></label>
        <label>Outils IA de l'éditeur (vente, correction, résumé, tests, diaporama) : maximum <input type="number" name="lo" min="0" value="${p.limite_outils_jour ?? 30}" style="width:80px"> utilisations par jour et par formateur</label>
        <label>Questions d'essai offertes à chaque nouveau formateur <input type="number" name="essai" min="0" value="${p.essai_questions}" style="width:90px"></label>
        <div><button class="btn btn-principal" type="submit">Enregistrer</button> <span data-ok style="color:#0b7a5c"></span></div>
      </form>
      <p style="font-size:12px;color:#64748b;margin-bottom:0">La clé ChatGPT se met dans Supabase → Edge Functions → Secrets, sous le nom <b>OPENAI_API_KEY</b> (jamais ici). Les gestionnaires KEKELI génèrent sans payer.</p>
    </div>
    <div class="carte" style="margin-bottom:16px">
      <h3 style="margin-top:0">🛒 Packs de crédits</h3>
      <div class="af-table-wrap"><table class="af-table"><thead><tr><th>Nom</th><th>Crédits</th><th>Prix (FCFA)</th><th>Titre du formateur</th><th>Fonctionnalités et durée</th><th>⚡ Complète</th><th>🔁 Report</th><th>Bonus crédits</th><th>Prix de lancement</th><th>Ordre</th><th>Actif</th><th></th></tr></thead>
        <tbody>${(packs || []).map(x => ligneProduit(x, 'pack')).join('')}</tbody></table></div>
      <button class="btn btn-discret" data-ajout="pack">＋ Ajouter un pack</button>
      <p style="font-size:12px;color:#64748b;margin:6px 0 0">Prix 0 = pack gratuit, présenté aux formateurs mais qui ne s'achète pas. « Fonctionnalités » : niveau des outils débloqués (0 à 3) ; le titre du formateur (ex. « Formateur Confirmé ») est propre à chaque pack.</p>
    </div>
    <div class="carte" style="margin-bottom:16px">
      <p style="font-size:12px;color:#64748b;margin-bottom:0">Niveaux d'avantages : ⭐ Plus (commission réduite, codes promo, IA texte de vente / correction / résumé, création module par module) · ✨ Pro (+ badge et mise en avant, statistiques avancées, IA tests en leçon et diaporama, certificats personnalisés) · 👑 Premium (+ messages groupés, report des crédits, validation prioritaire). Chaque pack est valable le nombre de jours indiqué (30 par défaut) : crédits ET avantages. « ⚡ Complète » : le pack permet de générer toute une formation d'un coup. « 🔁 Report » : à la fin du pack, les crédits restants passent au mois suivant (une fois) au lieu d'être perdus ; les avantages, eux, s'arrêtent. Prix de lancement : prix réduit pour les N premiers acheteurs (laisser vide pour aucun).</p>
    </div>
    <div class="carte" style="margin-bottom:16px">
      <h3 style="margin-top:0">👛 Comptes IA des formateurs</h3>
      ${(comptes || []).length ? `<div class="af-table-wrap"><table class="af-table"><thead><tr><th>Formateur</th><th>Crédits des packs</th><th>Crédits sans date</th><th>Avantages</th><th>Essai restant</th><th>Ajuster</th></tr></thead>
        <tbody>${comptes.map(c => `<tr><td>${eAF(nomDe(c.formateur_id))}</td><td>${(lotsActifs || []).filter(l => l.formateur_id === c.formateur_id).reduce((t, l) => t + l.credits_restants, 0)}</td>
          <td>${c.solde}</td><td>${c.avantages_fin && new Date(c.avantages_fin) > new Date() ? `${['', '⭐ Plus', '✨ Pro', '👑 Premium'][c.niveau] || '—'} jusqu'au ${dAF(c.avantages_fin)}` : '—'}${c.generation_complete_fin && new Date(c.generation_complete_fin) > new Date() ? '<br><small>⚡ génération complète</small>' : ''}</td><td>${c.essai_restant}</td>
          <td><button class="btn btn-discret" data-ajuster="${c.formateur_id}">± Crédits</button></td></tr>`).join('')}</tbody></table></div>` : '<p>Aucun compte IA pour le moment (créé au premier usage).</p>'}
    </div>
    <div class="carte">
      <h3 style="margin-top:0">🧾 100 derniers mouvements</h3>
      ${(mvts || []).length ? `<div class="af-table-wrap"><table class="af-table"><thead><tr><th>Date</th><th>Formateur</th><th>Opération</th><th>Crédits</th><th>Essai</th><th>Ancien abonnement</th><th>Détail</th></tr></thead>
        <tbody>${mvts.map(m => `<tr><td>${new Date(m.cree_le).toLocaleString('fr-FR')}</td><td>${eAF(nomDe(m.formateur_id))}</td><td>${LIB_MVT_AF[m.type] || eAF(m.type)}</td>
          <td>${m.credits}</td><td>${m.essai}</td><td>${m.abonnement}</td><td><small>${eAF((m.details?.module ? `Module ${m.details.module} : ${m.details.titre || ''}` : '') || (m.details?.sujet ? `${m.details.mode === 'module' ? '🧩 plan — ' : ''}${m.details.sujet}` : '') || (m.details?.pack ? `${m.details.pack}${m.details.credits_reportes ? ` (${m.details.credits_reportes} crédits)` : ''}` : '') || m.details?.motif || (m.details?.questions ? m.details.questions + ' question(s)' : '') || (m.details?.montant ? prixAF(m.details.montant) + (m.details.mode === 'test' ? ' (test)' : '') : ''))}${m.details?.rembourse ? ' — remboursé' : ''}</small></td></tr>`).join('')}</tbody></table></div>` : '<p>Aucun mouvement.</p>'}
    </div>`;

  const tabOpt = zone.querySelector('[data-images-options] tbody');
  const brancherOpt = () => tabOpt.querySelectorAll('[data-suppr-option-image]').forEach(b => { b.onclick = () => b.closest('tr').remove(); });
  brancherOpt();
  zone.querySelector('[data-ajout-option-image]').addEventListener('click', () => { tabOpt.insertAdjacentHTML('beforeend', ligneOptionImage(null)); brancherOpt(); });
  zone.querySelector('#formAccesOffert').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const fin = f.fin.value ? new Date(`${f.fin.value}T23:59:59`).toISOString() : null;
    const { data, error } = await supabaseClient.rpc('formation_admin_acces_offert', { p_email: f.email.value.trim(), p_actif: true, p_fin: fin, p_motif: f.motif.value.trim() || null });
    if (error) { erreurAF(error); return; }
    if (data && !data.ok) { alert(data.erreur); return; }
    ongletIAAF(zone);
  });
  zone.querySelectorAll('[data-retirer-acces]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Retirer l\'accès complet offert à ce compte ? Il repassera à son pack actuel (ou au Pack Gratuit).')) return;
    const { data, error } = await supabaseClient.rpc('formation_admin_acces_offert', { p_email: b.dataset.retirerAcces, p_actif: false, p_fin: null, p_motif: null });
    if (error) { erreurAF(error); return; }
    if (data && !data.ok) { alert(data.erreur); return; }
    ongletIAAF(zone);
  }));
  zone.querySelector('#formRechargeOA').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await supabaseClient.rpc('formation_ia_admin_recharge_openai', { p_montant_usd: Number(f.montant.value), p_note: f.note.value.trim() || null });
    if (error) { erreurAF(error); return; }
    ongletIAAF(zone);
  });
  zone.querySelector('#formSuiviOA').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await supabaseClient.from('formation_ia_parametres').update({
      seuil_alerte_usd: Math.max(0, Number(f.seuil.value) || 0), prix_entree_usd: Math.max(0, Number(f.pe.value) || 0),
      prix_sortie_usd: Math.max(0, Number(f.ps.value) || 0), taux_fcfa_usd: Math.max(1, Number(f.taux.value) || 600), maj_le: new Date().toISOString()
    }).eq('id', 1);
    if (error) { erreurAF(error); return; }
    f.querySelector('[data-ok]').textContent = '✔ Enregistré';
  });
  zone.querySelector('#formParIA').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await supabaseClient.from('formation_ia_parametres').update({
      actif: f.actif.checked, ia_formation: f.ia_formation.value, modele: f.modele.value.trim() || 'gpt-6-sol', credits_par_question: Math.max(0, Number(f.cq.value) || 0),
      credits_formation: Math.max(0, Number(f.cf.value) || 0), essai_questions: Math.max(0, Number(f.essai.value) || 0),
      credits_plan: Math.max(0, Number(f.cplan.value) || 0), credits_module: Math.max(0, Number(f.cmod.value) || 0), niveau_generation_module: Number(f.nmod.value) || 0,
      images_options: lireOptionsImages(f), limite_images_jour: Math.max(0, Number(f.limg.value) || 0),
      bonus_parrain: Math.max(0, Number(f.bp.value) || 0), bonus_filleul: Math.max(0, Number(f.bf.value) || 0), limite_outils_jour: Math.max(0, Number(f.lo.value) || 0),
      maj_le: new Date().toISOString()
    }).eq('id', 1);
    if (error) { erreurAF(error); return; }
    f.querySelector('[data-ok]').textContent = '✔ Enregistré';
  });
  const table = t => t === 'pack' ? 'formation_ia_packs' : 'formation_ia_offres';
  zone.querySelectorAll('tr[data-pack], tr[data-offre]').forEach(tr => {
    const type = tr.dataset.pack ? 'pack' : 'offre';
    const id = Number(tr.dataset.pack || tr.dataset.offre);
    tr.querySelector('[data-enreg]').addEventListener('click', async () => {
      const v = {};
      tr.querySelectorAll('[data-k]').forEach(i => {
        v[i.dataset.k] = i.type === 'checkbox' ? i.checked : ('videNull' in i.dataset && i.value === '') ? null : (i.type === 'number' || 'num' in i.dataset) ? Number(i.value) : i.value.trim();
      });
      const { error } = await supabaseClient.from(table(type)).update(v).eq('id', id);
      if (error) { erreurAF(error); return; }
      tr.style.background = '#ecfdf5'; setTimeout(() => { tr.style.background = ''; }, 900);
    });
    tr.querySelector('[data-suppr]').addEventListener('click', async () => {
      if (!confirm('Supprimer cette offre ? (Pour la masquer seulement, décochez « Actif ».)')) return;
      const { error } = await supabaseClient.from(table(type)).delete().eq('id', id);
      if (error) { erreurAF(error); return; }
      ongletIAAF(zone);
    });
  });
  zone.querySelectorAll('[data-ajout]').forEach(b => b.addEventListener('click', async () => {
    const type = b.dataset.ajout;
    const ligne = type === 'pack' ? { nom: 'Nouveau pack', credits: 100, prix: 1000, actif: false, position: 99 } : { nom: 'Nouvel abonnement', credits_mensuels: 300, duree_jours: 30, prix: 2000, actif: false, position: 99 };
    const { error } = await supabaseClient.from(table(type)).insert(ligne);
    if (error) { erreurAF(error); return; }
    ongletIAAF(zone);
  }));
  zone.querySelectorAll('[data-ajuster]').forEach(b => b.addEventListener('click', async () => {
    const n = Number(prompt('Nombre de crédits à ajouter (négatif pour retirer) :', '50'));
    if (!n) return;
    const motif = prompt('Motif (visible par le formateur) :', 'Geste commercial');
    if (!motif) return;
    const { error } = await supabaseClient.rpc('formation_ia_admin_ajuster', { p_formateur: b.dataset.ajuster, p_credits: n, p_motif: motif });
    if (error) { erreurAF(error); return; }
    ongletIAAF(zone);
  }));
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

// ---------- Petits écrans : tableaux en cartes (27 septembre 2026) ----------
(function () {
  const st = document.createElement('style');
  st.textContent = `.af-cartes-tb { margin: 16px 0; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .af-carte-tb { position: relative; text-decoration: none; color: inherit; padding: 16px; }
  .af-carte-tb .icone-action-tb { font-size: 26px; margin-bottom: 6px; }
  .af-carte-active { border-color: #0b7a5c !important; background: #f0faf6; }
  .af-carte-badge { position: absolute; top: 10px; right: 10px; background: #dc2626; color: #fff; font-weight: 800; font-size: 12px; border-radius: 99px; padding: 2px 9px; }
  @media (max-width: 700px) {
    .af-table-wrap { overflow: visible; }
    .af-table.af-cartes, .af-table.af-cartes tbody { display: block; width: 100%; }
    .af-table.af-cartes thead { display: none; }
    .af-table.af-cartes tr { display: block; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 4px; margin: 0 0 10px; background: #fff; }
    .af-table.af-cartes td { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 0; padding: 5px 10px; text-align: right; flex-wrap: wrap; }
    .af-table.af-cartes td::before { content: attr(data-label); font-weight: 700; font-size: 12px; color: #64748b; text-align: left; text-transform: uppercase; }
    .af-table.af-cartes td[data-label=""]::before, .af-table.af-cartes td:first-child::before { display: none; }
    .af-table.af-cartes td:first-child { display: block; text-align: left; }
    .af-table.af-cartes td input:not([type=checkbox]), .af-table.af-cartes td select { max-width: 60%; }
    .af-onglets { flex-wrap: nowrap; overflow-x: auto; }
    .af-onglets button { flex: none; white-space: nowrap; }
    #zoneAF form, #zoneAF fieldset { max-width: 100% !important; min-width: 0; box-sizing: border-box; grid-template-columns: minmax(0, 1fr); }
    #zoneAF form select { width: 100%; }
    #zoneAF form label { display: block; max-width: 100%; overflow-wrap: anywhere; }
    #zoneAF form input:not([type=checkbox]):not([type=radio]), #zoneAF form select { max-width: 100%; }
  }`;
  document.head.appendChild(st);
  const etiqueter = () => document.querySelectorAll('table.af-table').forEach(t => {
    const titres = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!titres.length) return;
    t.classList.add('af-cartes');
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', titres[i] || ''); }));
  });
  let attente = null;
  new MutationObserver(() => { if (!attente) attente = setTimeout(() => { attente = null; etiqueter(); }, 60); }).observe(document.body, { childList: true, subtree: true });
})();
