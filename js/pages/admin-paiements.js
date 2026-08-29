// Page pages/admin/paiements.html
// Suivi MANUEL des paiements de frais de scolarité (pas d'intégration de
// paiement en ligne : un admin enregistre ici ce qu'il a reçu — espèces,
// virement, mobile money, chèque...). Les parents consultent l'historique
// depuis leur espace (lecture seule).

let profilAdminPaiements = null;
let classesPaiements = [];
let classeSelectionneePaiements = null;
let elevesClassePaiements = [];
let paiementsClassePaiements = [];

const LIBELLES_MOYEN_PAIEMENT = {
  especes: 'Espèces', virement: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', autre: 'Autre'
};

async function init() {
  profilAdminPaiements = await requireAdmin();
  if (!profilAdminPaiements) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminPaiements.id,
    badgeHtml: `${profilAdminPaiements.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperPaiements(profilAdminPaiements.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminPaiements.est_super_admin })
  });

  const { data: classes } = await supabaseClient.from('classes').select('*').order('ordre');
  classesPaiements = classes || [];

  document.getElementById('contenu').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <select id="selectClassePaiements" style="padding:9px;border-radius:8px;border:1px solid var(--bordure)">
        <option value="">— Choisir une classe —</option>
        ${classesPaiements.map(c => `<option value="${c.id}">${echapperPaiements(c.nom)}</option>`).join('')}
      </select>
    </div>
    <div id="zoneGestionPaiements"></div>
  `;

  document.getElementById('selectClassePaiements').addEventListener('change', async (e) => {
    classeSelectionneePaiements = e.target.value || null;
    if (classeSelectionneePaiements) await afficherGestionPaiements();
    else document.getElementById('zoneGestionPaiements').innerHTML = '';
  });
}

async function afficherGestionPaiements() {
  const zone = document.getElementById('zoneGestionPaiements');
  zone.innerHTML = '<div class="chargement">Chargement...</div>';

  const [{ data: eleves }, { data: paiements }] = await Promise.all([
    supabaseClient.from('eleves').select('id, profils(prenom, nom)').eq('classe_id', classeSelectionneePaiements),
    supabaseClient.from('paiements_frais').select('*').eq('classe_id', classeSelectionneePaiements).order('cree_le', { ascending: false })
  ]);
  elevesClassePaiements = eleves || [];
  paiementsClassePaiements = paiements || [];

  const nomsEleves = {};
  elevesClassePaiements.forEach(e => { nomsEleves[e.id] = `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim(); });

  const totalRecu = paiementsClassePaiements.reduce((somme, p) => somme + Number(p.montant), 0);
  const nbAyantPaye = new Set(paiementsClassePaiements.map(p => p.eleve_id)).size;

  zone.innerHTML = `
    <div class="recap-paiements">
      <div class="pastille-recap"><span class="chiffre">${totalRecu.toLocaleString('fr-FR')}</span><span class="libelle">Total reçu (toutes devises confondues)</span></div>
      <div class="pastille-recap"><span class="chiffre">${nbAyantPaye} / ${elevesClassePaiements.length}</span><span class="libelle">Élèves ayant réglé au moins un paiement</span></div>
    </div>
    <button class="btn btn-accent" id="btnNouveauPaiement" style="margin-bottom:20px">+ Enregistrer un paiement</button>
    ${paiementsClassePaiements.length ? `<div class="liste-lignes">${paiementsClassePaiements.map(p => `
      <div class="ligne">
        <div>
          <div class="titre-ligne">${echapperPaiements(nomsEleves[p.eleve_id] || 'Élève')} — ${Number(p.montant).toLocaleString('fr-FR')} ${echapperPaiements(p.devise)}</div>
          <span style="font-size:12px;color:var(--texte-gris)">${LIBELLES_MOYEN_PAIEMENT[p.moyen_paiement] || p.moyen_paiement} · ${echapperPaiements(p.annee_scolaire)} · ${new Date(p.cree_le).toLocaleDateString('fr-FR')}${p.reference ? ` · Réf. ${echapperPaiements(p.reference)}` : ''}</span>
          ${p.commentaire ? `<div style="font-size:12px;color:var(--texte-gris);margin-top:2px">${echapperPaiements(p.commentaire)}</div>` : ''}
        </div>
        <button class="btn btn-danger" data-supprimer-paiement="${p.id}" style="padding:6px 10px;font-size:12px">🗑️</button>
      </div>`).join('')}</div>` : '<p class="chargement">Aucun paiement enregistré pour cette classe.</p>'}
  `;

  document.getElementById('btnNouveauPaiement').addEventListener('click', ouvrirNouveauPaiement);
  zone.querySelectorAll('[data-supprimer-paiement]').forEach(btn => {
    btn.addEventListener('click', () => supprimerPaiement(parseInt(btn.dataset.supprimerPaiement, 10)));
  });
}

function ouvrirNouveauPaiement() {
  if (!elevesClassePaiements.length) return alert("Cette classe n'a aucun élève inscrit pour l'instant.");

  ouvrirModal({
    titre: 'Enregistrer un paiement',
    champs: [
      { nom: 'eleve_id', label: 'Élève', type: 'select', options: elevesClassePaiements.map(e => ({ valeur: e.id, label: `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim() })) },
      { nom: 'annee_scolaire', label: 'Année scolaire', valeur: anneeScolaireActuelle() },
      { nom: 'montant', label: 'Montant', type: 'number' },
      { nom: 'devise', label: 'Devise', valeur: 'FCFA' },
      { nom: 'moyen_paiement', label: 'Moyen de paiement', type: 'select', options: Object.entries(LIBELLES_MOYEN_PAIEMENT).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'reference', label: 'Référence (n° de reçu, de transaction...)', requis: false },
      { nom: 'commentaire', label: 'Commentaire', type: 'textarea', requis: false }
    ],
    texteValider: 'Enregistrer',
    onValider: async ({ eleve_id, annee_scolaire, montant, devise, moyen_paiement, reference, commentaire }) => {
      const montantNombre = parseFloat(montant);
      if (!montantNombre || montantNombre <= 0) return alert('Le montant doit être un nombre positif.');
      const { error } = await supabaseClient.from('paiements_frais').insert({
        eleve_id, classe_id: classeSelectionneePaiements, annee_scolaire, montant: montantNombre,
        devise: devise || 'FCFA', moyen_paiement, reference: reference || null, commentaire: commentaire || null,
        enregistre_par: profilAdminPaiements.id
      });
      if (error) return alert(error.message);
      afficherGestionPaiements();
    }
  });
}

function supprimerPaiement(id) {
  confirmerAction('Supprimer ce paiement ? Cette action est irréversible.', async () => {
    const { error } = await supabaseClient.from('paiements_frais').delete().eq('id', id);
    if (error) return alert(error.message);
    afficherGestionPaiements();
  });
}

// École au Bénin (comme dans le reste du cahier des charges) : l'année
// scolaire démarre en septembre. Avant septembre on est donc encore sur
// l'année scolaire qui a commencé en septembre de l'année précédente.
function anneeScolaireActuelle() {
  const d = new Date();
  const an = d.getFullYear();
  return d.getMonth() >= 8 ? `${an}-${an + 1}` : `${an - 1}-${an}`;
}

function echapperPaiements(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

init();
