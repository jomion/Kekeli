// Page pages/enseignant/cahier-ecriture.html
//
// 24 septembre 2026 : cahier d'écriture personnel de l'enseignant
// (généralisation à tous les rôles — voir js/cahier-ecriture-partage.js).
// Sauvegarde cloud gratuite et illimitée pour ce rôle (pas de service
// Premium personnel pour les comptes adultes/staff). En complément, demande
// explicite du même jour ("prévois dans le contrôle parental qui pourra
// consulter le cahier en plus de l'élève") : une section "Cahiers de mes
// élèves" liste ici les élèves dont le PARENT a coché l'autorisation
// (pages/parent/suivi-enfant.html) — consultation en LECTURE SEULE
// uniquement (js/cahier-ecriture-lecture.js), jamais dans l'iframe
// interactive : celle-ci partage le même localStorage (même origine) que le
// cahier personnel de l'enseignant ci-dessus, y afficher le cahier d'un
// élève écraserait donc le travail en cours de l'enseignant.
//
// Deux sources d'élèves "gérés" par l'enseignant, mêmes que partout ailleurs
// sur le site (voir js/pages/enseignant-tableau-de-bord.js/-devoirs-notes.js/
// -registre-appel.js) : le suivi individuel (abonnements_enseignant_eleve,
// statut accepté) et « Ma classe » (autorisations_ma_classe, statut
// accepté, pour les classes assignées) — la vraie porte d'entrée reste de
// toute façon la fonction SQL peut_gerer_eleve() (via la policy RLS de
// cahiers_ecriture), cette liste ne sert qu'à savoir QUI proposer ici.

let profilCahierEns = null;

(async function () {
  profilCahierEns = await requireRole('enseignant');
  if (!profilCahierEns) return;
  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profilCahierEns.id, badgeHtml: `🟢 ${echapperCahierEns(profilCahierEns.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });
  await initialiserCahierEcriturePartage(profilCahierEns, { estEleve: false });
  await afficherCahiersElevesVisiblesEns();
})();

async function afficherCahiersElevesVisiblesEns() {
  const eleves = await _listerElevesCahierVisibleEns(profilCahierEns.id);
  const conteneur = document.getElementById('contenu');
  if (!conteneur) return;

  const bloc = document.createElement('div');
  bloc.innerHTML = `
    <div class="titre-section-pub">📔 Cahiers de mes élèves</div>
    <p style="color:var(--text-gris);font-size:13px;margin-top:-6px">Élèves dont le parent a autorisé la consultation du cahier d'écriture (aperçu en lecture seule).</p>
    ${eleves.length ? `<div class="cahier-liste-eleves-visibles">
      ${eleves.map(e => `
        <div class="cahier-ligne-eleve-visible">
          <span>${echapperCahierEns(e.nom)}</span>
          <button type="button" class="btn btn-discret" data-voir-cahier-eleve="${e.id}" data-nom-eleve="${echapperCahierEns(e.nom)}">👁️ Voir</button>
        </div>`).join('')}
    </div>` : `<p style="color:var(--text-gris)">Aucun élève ne vous a encore autorisé à consulter son cahier.</p>`}
  `;
  conteneur.appendChild(bloc);

  bloc.querySelectorAll('[data-voir-cahier-eleve]').forEach(btn => {
    btn.addEventListener('click', () => chargerEtAfficherCahierEleve(btn.dataset.voirCahierEleve, btn.dataset.nomEleve));
  });
}

async function _listerElevesCahierVisibleEns(enseignantId) {
  const [{ data: abonnements }, { data: enseignantRow }] = await Promise.all([
    supabaseClient.from('abonnements_enseignant_eleve').select('eleve_id, statut').eq('enseignant_id', enseignantId),
    supabaseClient.from('enseignants').select('classes_assignees').eq('id', enseignantId).single(),
  ]);
  const idsAbonnes = (abonnements || []).filter(a => a.statut === 'accepte').map(a => a.eleve_id);

  const classesAssignees = enseignantRow?.classes_assignees || [];
  let idsMaClasse = [];
  if (classesAssignees.length) {
    const { data: autorisationsMC } = await supabaseClient.from('autorisations_ma_classe')
      .select('eleve_id, statut').eq('enseignant_id', enseignantId);
    idsMaClasse = (autorisationsMC || []).filter(a => a.statut === 'accepte').map(a => a.eleve_id);
  }

  const idsCandidats = [...new Set([...idsAbonnes, ...idsMaClasse])];
  if (!idsCandidats.length) return [];

  const { data: eleves } = await supabaseClient.from('eleves')
    .select('id, cahier_ecriture_visible_enseignant, profils(prenom, nom)')
    .in('id', idsCandidats).eq('cahier_ecriture_visible_enseignant', true);

  return (eleves || []).map(e => ({ id: e.id, nom: `${e.profils?.prenom || ''} ${e.profils?.nom || ''}`.trim() || '(élève)' }));
}

function echapperCahierEns(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
