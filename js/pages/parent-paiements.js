// Page pages/parent/paiements.html
// Historique (lecture seule) des paiements de frais de scolarité enregistrés
// par l'administration pour chaque enfant. Aucun paiement en ligne ici — le
// parent règle par les moyens habituels (espèces, virement...) et
// l'administration enregistre le règlement depuis son espace.

let profilParentPaiements = null;
let enfantsPaiements = [];
let enfantSelectionnePaiementsId = null;

const LIBELLES_MOYEN_PAIEMENT_PARENT = {
  especes: 'Espèces', virement: 'Virement', mobile_money: 'Mobile Money', cheque: 'Chèque', autre: 'Autre'
};

(async function () {
  profilParentPaiements = await requireRole('parent');
  if (!profilParentPaiements) return;
  await initEnteteNavigation({
    role: 'parent', utilisateurId: profilParentPaiements.id, badgeHtml: `🟢 ${echapperParentPaiements(profilParentPaiements.prenom)}`,
    liens: liensAvecPrefixe('parent', '')
  });

  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilParentPaiements.id);
  const ids = (liens || []).map(l => l.eleve_id);

  if (ids.length === 0) {
    document.getElementById('contenu').innerHTML = `
      <div class="carte-bienvenue"><h1>Aucun enfant inscrit</h1><p>Inscrivez d'abord un enfant depuis votre tableau de bord.</p></div>`;
    return;
  }

  const { data: profils } = await supabaseClient.from('profils').select('id, prenom, nom').in('id', ids);
  enfantsPaiements = profils || [];
  enfantSelectionnePaiementsId = enfantsPaiements[0]?.id;

  await afficherPaiementsParent();
})();

async function afficherPaiementsParent() {
  const enfant = enfantsPaiements.find(e => e.id === enfantSelectionnePaiementsId);

  const { data: paiements } = await supabaseClient
    .from('paiements_frais').select('*').eq('eleve_id', enfantSelectionnePaiementsId).order('cree_le', { ascending: false });
  const liste = paiements || [];

  const totauxParAnnee = {};
  liste.forEach(p => { totauxParAnnee[p.annee_scolaire] = (totauxParAnnee[p.annee_scolaire] || 0) + Number(p.montant); });

  document.getElementById('contenu').innerHTML = `
    <div class="carte-bienvenue">
      <h1>💳 Paiement des frais</h1>
      <p>Historique des règlements enregistrés par l'administration pour ${enfantsPaiements.length > 1 ? 'chacun de vos enfants' : 'votre enfant'}.</p>
    </div>

    ${enfantsPaiements.length > 1 ? `<div class="selecteur-enfant" id="selecteurEnfantPaiements">
      ${enfantsPaiements.map(e => `<button class="${e.id === enfantSelectionnePaiementsId ? 'actif' : ''}" data-enfant-paiements="${e.id}">${echapperParentPaiements(e.prenom)} ${echapperParentPaiements(e.nom)}</button>`).join('')}
    </div>` : `<p style="font-weight:700;color:var(--noir-kekeli)">${echapperParentPaiements(enfant?.prenom)} ${echapperParentPaiements(enfant?.nom)}</p>`}

    ${Object.keys(totauxParAnnee).length ? `<div class="recap-paiements-parent">
      ${Object.entries(totauxParAnnee).map(([annee, total]) => `<div>Année <strong>${echapperParentPaiements(annee)}</strong> : <span class="chiffre">${total.toLocaleString('fr-FR')}</span></div>`).join('')}
    </div>` : ''}

    <div class="titre-section-pub">🧾 Historique des paiements</div>
    ${liste.length ? `<div class="liste-lignes-pub">${liste.map(p => `
      <div class="ligne-pub">
        <div>
          <div class="titre-ligne-pub">${Number(p.montant).toLocaleString('fr-FR')} ${echapperParentPaiements(p.devise)} — ${LIBELLES_MOYEN_PAIEMENT_PARENT[p.moyen_paiement] || p.moyen_paiement}</div>
          <div class="sous-ligne-pub">${echapperParentPaiements(p.annee_scolaire)} · Reçu le ${new Date(p.cree_le).toLocaleDateString('fr-FR')}${p.reference ? ` · Réf. ${echapperParentPaiements(p.reference)}` : ''}</div>
        </div>
      </div>`).join('')}</div>` : '<p style="color:var(--text-gris)">Aucun paiement enregistré pour l\'instant.</p>'}
  `;

  const selecteur = document.getElementById('selecteurEnfantPaiements');
  if (selecteur) selecteur.querySelectorAll('[data-enfant-paiements]').forEach(btn => {
    btn.addEventListener('click', () => { enfantSelectionnePaiementsId = btn.dataset.enfantPaiements; afficherPaiementsParent(); });
  });
}

function echapperParentPaiements(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
