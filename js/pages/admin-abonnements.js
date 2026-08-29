// Page pages/admin/abonnements.html
// Gestion des services premium : catalogue des formules (plans_tarifaires),
// réglage des essais gratuits, et enregistrement manuel des souscriptions
// (élève ou famille) — même logique de suivi manuel que paiements_frais,
// mais qui donne accès à un service au lieu d'être un simple encaissement.

let profilAdminAbo = null;
let plansTarifaires = [];
let essaisGratuits = [];
let classesAbo = [];
let parentsAbo = [];
let classeSelectionneeAbo = null;
let elevesClasseAbo = [];
let souscriptionsParBeneficiaire = {}; // eleve_id OU parent_id -> [souscriptions]

const LIBELLES_SERVICE = {
  '': 'Premium global (tous les services)',
  correction_ia: 'Correction automatique par IA',
  rapports_avances: 'Rapports de suivi avancés',
  visioconference: 'Visioconférence'
};
const LIBELLES_TYPE_FACTURATION = {
  abonnement_mensuel: 'Abonnement mensuel', abonnement_annuel: 'Abonnement annuel', forfait_prepaye: 'Forfait prépayé'
};
const LIBELLES_PERIMETRE = { eleve: 'Par élève', famille: 'Par famille (tous les enfants du parent)' };
const LIBELLES_MOYEN_PAIEMENT_ABO = {
  especes: 'Espèces', virement: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', autre: 'Autre'
};

async function init() {
  profilAdminAbo = await requireAdmin();
  if (!profilAdminAbo) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminAbo.id,
    badgeHtml: `${profilAdminAbo.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperAbo(profilAdminAbo.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminAbo.est_super_admin })
  });

  const [{ data: plans }, { data: essais }, { data: classes }, { data: parents }] = await Promise.all([
    supabaseClient.from('plans_tarifaires').select('*').order('cree_le'),
    supabaseClient.from('essais_gratuits_services').select('*'),
    supabaseClient.from('classes').select('*').order('ordre'),
    supabaseClient.from('profils').select('id, prenom, nom, email').eq('role', 'parent').order('nom')
  ]);
  plansTarifaires = plans || [];
  essaisGratuits = essais || [];
  classesAbo = classes || [];
  parentsAbo = parents || [];

  rendrePage();
}

function rendrePage() {
  document.getElementById('contenu').innerHTML = `
    <div class="titre-cycle" style="margin-top:0">Formules tarifaires</div>
    <button class="btn btn-accent" id="btnNouveauPlan" style="margin-bottom:16px">+ Nouvelle formule</button>
    <div class="grille-plans">
      ${plansTarifaires.map(p => `
        <div class="carte-plan ${p.actif ? '' : 'inactif'}">
          <h4>${echapperAbo(p.nom)}</h4>
          <p>${LIBELLES_SERVICE[p.service || '']} · ${LIBELLES_TYPE_FACTURATION[p.type_facturation]} · ${LIBELLES_PERIMETRE[p.perimetre]}</p>
          <div class="prix-plan">${Number(p.prix).toLocaleString('fr-FR')} ${echapperAbo(p.devise)}</div>
          ${p.type_facturation === 'forfait_prepaye' ? `<p>${p.nb_usages || 0} utilisation(s) incluses</p>` : ''}
          ${p.description ? `<p>${echapperAbo(p.description)}</p>` : ''}
          <div class="actions-plan">
            <button class="btn btn-discret" data-basculer-plan="${p.id}" style="padding:4px 10px;font-size:11px">${p.actif ? 'Désactiver' : 'Activer'}</button>
            <button class="btn btn-danger" data-supprimer-plan="${p.id}" style="padding:4px 10px;font-size:11px">🗑️</button>
          </div>
        </div>`).join('') || '<p class="chargement">Aucune formule créée pour l\'instant.</p>'}
    </div>

    <div class="titre-cycle">Essais gratuits (avant de devoir souscrire)</div>
    <div class="table-essais">
      ${['correction_ia', 'rapports_avances', 'visioconference'].map(service => {
        const ligne = essaisGratuits.find(e => e.service === service);
        return `<div class="carte-essai">
          <span>${LIBELLES_SERVICE[service]}</span>
          <input type="number" min="0" value="${ligne ? ligne.nb_essais_gratuits : 3}" data-essai-service="${service}">
          <button class="btn btn-primaire" data-sauver-essai="${service}" style="padding:5px 10px;font-size:11px">Enregistrer</button>
        </div>`;
      }).join('')}
    </div>

    <div class="titre-cycle">Souscription par élève</div>
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <select id="selectClasseAbo" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Choisir une classe —</option>
        ${classesAbo.map(c => `<option value="${c.id}">${echapperAbo(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div id="zoneElevesAbo"></div>

    <div class="titre-cycle">Souscription par famille (couvre tous les enfants du parent)</div>
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <select id="selectParentAbo" style="padding:9px;border-radius:8px;border:1px solid var(--bordure);min-width:220px">
        <option value="">— Choisir un parent —</option>
        ${parentsAbo.map(p => `<option value="${p.id}">${echapperAbo(p.prenom)} ${echapperAbo(p.nom)} (${echapperAbo(p.email)})</option>`).join('')}
      </select>
    </div>
    <div id="zoneParentAbo"></div>
  `;

  document.getElementById('btnNouveauPlan').addEventListener('click', ouvrirNouveauPlan);
  document.querySelectorAll('[data-basculer-plan]').forEach(btn => {
    btn.addEventListener('click', () => basculerPlan(parseInt(btn.dataset.basculerPlan, 10)));
  });
  document.querySelectorAll('[data-supprimer-plan]').forEach(btn => {
    btn.addEventListener('click', () => supprimerPlan(parseInt(btn.dataset.supprimerPlan, 10)));
  });
  document.querySelectorAll('[data-sauver-essai]').forEach(btn => {
    btn.addEventListener('click', () => sauvegarderEssai(btn.dataset.sauverEssai));
  });
  document.getElementById('selectClasseAbo').addEventListener('change', async (e) => {
    classeSelectionneeAbo = e.target.value || null;
    if (classeSelectionneeAbo) await afficherElevesAbo();
    else document.getElementById('zoneElevesAbo').innerHTML = '';
  });
  document.getElementById('selectParentAbo').addEventListener('change', async (e) => {
    if (e.target.value) await afficherParentAbo(e.target.value);
    else document.getElementById('zoneParentAbo').innerHTML = '';
  });
}

function ouvrirNouveauPlan() {
  ouvrirModal({
    titre: 'Nouvelle formule tarifaire',
    champs: [
      { nom: 'nom', label: 'Nom de la formule', placeholder: 'Ex : Correction IA — mensuel' },
      { nom: 'code', label: 'Code unique', placeholder: 'Ex : correction_ia_mensuel' },
      { nom: 'service', label: 'Service concerné', type: 'select', options: Object.entries(LIBELLES_SERVICE).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'type_facturation', label: 'Type de facturation', type: 'select', options: Object.entries(LIBELLES_TYPE_FACTURATION).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'perimetre', label: 'Périmètre', type: 'select', options: Object.entries(LIBELLES_PERIMETRE).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'prix', label: 'Prix', type: 'number' },
      { nom: 'devise', label: 'Devise', valeur: 'FCFA' },
      { nom: 'nb_usages', label: 'Utilisations incluses (uniquement si "Forfait prépayé")', type: 'number', requis: false },
      { nom: 'description', label: 'Description (visible par les familles)', type: 'textarea', requis: false }
    ],
    texteValider: 'Créer',
    onValider: async ({ nom, code, service, type_facturation, perimetre, prix, devise, nb_usages, description }) => {
      const prixNombre = parseFloat(prix);
      if (!prixNombre || prixNombre <= 0) return alert('Le prix doit être un nombre positif.');
      const { error } = await supabaseClient.from('plans_tarifaires').insert({
        nom, code: code.trim().toLowerCase().replace(/\s+/g, '_'),
        service: service || null, type_facturation, perimetre,
        prix: prixNombre, devise: devise || 'FCFA',
        nb_usages: (type_facturation === 'forfait_prepaye' && nb_usages) ? parseInt(nb_usages, 10) : null,
        description: description || null, cree_par: profilAdminAbo.id
      });
      if (error) {
        if (error.code === '23505') return alert('Ce code de formule existe déjà.');
        return alert(error.message);
      }
      const { data: plans } = await supabaseClient.from('plans_tarifaires').select('*').order('cree_le');
      plansTarifaires = plans || [];
      rendrePage();
    }
  });
}

function basculerPlan(id) {
  const plan = plansTarifaires.find(p => p.id === id);
  if (!plan) return;
  confirmerAction(`${plan.actif ? 'Désactiver' : 'Activer'} la formule "${plan.nom}" ?`, async () => {
    const { error } = await supabaseClient.from('plans_tarifaires').update({ actif: !plan.actif }).eq('id', id);
    if (error) return alert(error.message);
    plan.actif = !plan.actif;
    rendrePage();
  });
}

function supprimerPlan(id) {
  confirmerAction('Supprimer cette formule ? Impossible si des souscriptions y sont déjà rattachées (désactivez-la plutôt dans ce cas).', async () => {
    const { error } = await supabaseClient.from('plans_tarifaires').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') return alert('Impossible de supprimer : des souscriptions utilisent déjà cette formule. Désactivez-la plutôt.');
      return alert(error.message);
    }
    plansTarifaires = plansTarifaires.filter(p => p.id !== id);
    rendrePage();
  });
}

async function sauvegarderEssai(service) {
  const input = document.querySelector(`[data-essai-service="${service}"]`);
  const valeur = parseInt(input.value, 10);
  if (Number.isNaN(valeur) || valeur < 0) return alert('Nombre d\'essais invalide.');
  const { error } = await supabaseClient.from('essais_gratuits_services')
    .upsert({ service, nb_essais_gratuits: valeur, modifie_le: new Date().toISOString() }, { onConflict: 'service' });
  if (error) return alert(error.message);
  alert('Enregistré.');
}

async function afficherElevesAbo() {
  const zone = document.getElementById('zoneElevesAbo');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  const { data: eleves } = await supabaseClient.from('eleves').select('id, profils(prenom, nom)').eq('classe_id', classeSelectionneeAbo);
  elevesClasseAbo = eleves || [];
  await chargerSouscriptions(elevesClasseAbo.map(e => e.id), 'eleve_id');

  zone.innerHTML = `<div class="liste-lignes">${elevesClasseAbo.map(e => `
    <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <div class="titre-ligne">${echapperAbo(e.profils?.prenom)} ${echapperAbo(e.profils?.nom)}</div>
        <button class="btn btn-primaire" data-souscrire-eleve="${e.id}" style="padding:6px 14px;font-size:12px">+ Abonnement</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${rendrePastillesSouscriptions(souscriptionsParBeneficiaire[e.id] || [])}
      </div>
    </div>`).join('') || '<p class="chargement">Aucun élève dans cette classe.</p>'}</div>`;

  zone.querySelectorAll('[data-souscrire-eleve]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirSouscription('eleve_id', btn.dataset.souscrireEleve, afficherElevesAbo));
  });
  zone.querySelectorAll('[data-annuler-souscription]').forEach(btn => {
    btn.addEventListener('click', () => annulerSouscription(parseInt(btn.dataset.annulerSouscription, 10), afficherElevesAbo));
  });
}

async function afficherParentAbo(parentId) {
  const zone = document.getElementById('zoneParentAbo');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  await chargerSouscriptions([parentId], 'parent_id');

  zone.innerHTML = `<div class="liste-lignes">
    <div class="ligne" style="align-items:flex-start;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <div class="titre-ligne">Abonnements de cette famille</div>
        <button class="btn btn-primaire" data-souscrire-parent="${parentId}" style="padding:6px 14px;font-size:12px">+ Abonnement famille</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${rendrePastillesSouscriptions(souscriptionsParBeneficiaire[parentId] || [])}
      </div>
    </div>
  </div>`;

  zone.querySelector('[data-souscrire-parent]').addEventListener('click', () => ouvrirSouscription('parent_id', parentId, () => afficherParentAbo(parentId)));
  zone.querySelectorAll('[data-annuler-souscription]').forEach(btn => {
    btn.addEventListener('click', () => annulerSouscription(parseInt(btn.dataset.annulerSouscription, 10), () => afficherParentAbo(parentId)));
  });
}

async function chargerSouscriptions(ids, colonne) {
  souscriptionsParBeneficiaire = {};
  if (!ids.length) return;
  const { data: souscriptions } = await supabaseClient
    .from('souscriptions').select('*, plans_tarifaires(*)').in(colonne, ids).eq('statut', 'actif');
  (souscriptions || []).forEach(s => { (souscriptionsParBeneficiaire[s[colonne]] ??= []).push(s); });
}

function rendrePastillesSouscriptions(liste) {
  if (!liste.length) return '<span style="font-size:12px;color:var(--texte-gris)">Aucun abonnement actif.</span>';
  return liste.map(s => {
    const plan = s.plans_tarifaires;
    const infoDuree = plan?.type_facturation === 'forfait_prepaye'
      ? `${s.usages_restants ?? 0} restante(s)`
      : (s.date_fin ? `jusqu'au ${new Date(s.date_fin).toLocaleDateString('fr-FR')}` : '');
    return `<span class="pastille-souscription">${echapperAbo(plan?.nom || 'Formule supprimée')} — ${infoDuree} <button data-annuler-souscription="${s.id}" title="Annuler">✕</button></span>`;
  }).join('');
}

function ouvrirSouscription(colonne, beneficiaireId, rafraichir) {
  const perimetreAttendu = colonne === 'eleve_id' ? 'eleve' : 'famille';
  const plansDisponibles = plansTarifaires.filter(p => p.actif && p.perimetre === perimetreAttendu);
  if (!plansDisponibles.length) return alert(`Créez d'abord une formule "${LIBELLES_PERIMETRE[perimetreAttendu]}".`);

  ouvrirModal({
    titre: 'Enregistrer une souscription',
    champs: [
      { nom: 'plan_id', label: 'Formule', type: 'select', options: plansDisponibles.map(p => ({ valeur: p.id, label: `${p.nom} — ${p.prix} ${p.devise}` })) },
      { nom: 'montant', label: 'Montant reçu (laisser vide = prix de la formule)', type: 'number', requis: false },
      { nom: 'moyen_paiement', label: 'Moyen de paiement', type: 'select', options: Object.entries(LIBELLES_MOYEN_PAIEMENT_ABO).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'reference', label: 'Référence (facultatif)', requis: false },
      { nom: 'commentaire', label: 'Commentaire (facultatif)', type: 'textarea', requis: false }
    ],
    texteValider: 'Enregistrer',
    onValider: async ({ plan_id, montant, moyen_paiement, reference, commentaire }) => {
      const ligne = { plan_id: parseInt(plan_id, 10), moyen_paiement, reference: reference || null, commentaire: commentaire || null, enregistre_par: profilAdminAbo.id };
      ligne[colonne] = beneficiaireId;
      ligne.montant = montant ? parseFloat(montant) : plansDisponibles.find(p => p.id === parseInt(plan_id, 10))?.prix;
      const { error } = await supabaseClient.from('souscriptions').insert(ligne);
      if (error) return alert(error.message);
      rafraichir();
    }
  });
}

function annulerSouscription(id, rafraichir) {
  confirmerAction('Annuler cet abonnement ? L\'accès au service sera immédiatement coupé.', async () => {
    const { error } = await supabaseClient.from('souscriptions').update({ statut: 'annule' }).eq('id', id);
    if (error) return alert(error.message);
    rafraichir();
  });
}

function echapperAbo(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
