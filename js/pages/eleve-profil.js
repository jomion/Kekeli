// Page pages/eleve/profil.html
// Nouvelle page "Mon profil" (19 septembre 2026, demande "si l'enfant appuie
// sur le bouton profil affiche son profil" + clarification AskUserQuestion :
// "Nouvelle page 'Mon profil' (Recommandé)") — fiche de lecture SEULE,
// AUCUN champ modifiable (cohérent avec la décision déjà actée que l'élève
// n'a rien à remplir dans un profil personnel).
//
// Complétée le même jour suite à la demande "Le profil actuel de l'enfant
// n'affiche pas le nom et prénom de l'enfant. Je veux tous les informations
// sur l'enfant affiché même son identifiant" : affiche désormais TOUTES les
// informations disponibles sur l'élève (profils.* + eleves.*), toujours en
// lecture seule — prénom ET nom, identifiant de connexion, email (si
// renseigné), sexe, date de naissance, localisation (si renseignée), classe,
// membre depuis, dernière activité, et les réglages posés par un parent
// (compte actif, messagerie autorisée, horaires de connexion limités).
// `requireRole('eleve')` renvoie déjà TOUTE la ligne `profils` (select('*'),
// voir js/auth-utilisateur.js#chargerProfil) — aucune requête supplémentaire
// nécessaire pour nom/prenom/identifiant/email/sexe/departement/commune/
// arrondissement/cree_le.
//
// Devient la vraie destination du bouton "Profil" de la nav mobile basse du
// thème premium (js/theme-premium-eleve.js), à la place de
// tableau-de-bord.html.

const LIBELLES_SEXE_PROFIL = { F: 'Fille', M: 'Garçon' };

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${echapperProfilEleve(profil.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const { data: fiche } = await supabaseClient.from('eleves').select('*').eq('id', profil.id).maybeSingle();
  const mascotte = fiche?.mascotte || '🦁';

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).maybeSingle();
    nomClasse = classe?.nom || '';
  }

  const [{ data: etoiles }, { data: compteurs }] = await Promise.all([
    supabaseClient.from('etoiles_eleve').select('total').eq('eleve_id', profil.id).maybeSingle(),
    supabaseClient.from('compteurs_badges_paliers').select('total').eq('eleve_id', profil.id),
  ]);
  const totalEtoiles = etoiles?.total || 0;
  // Total "toutes récompenses de paliers confondues" (médailles + badges
  // spéciaux + trophées, tous paliers) — le détail par type/palier reste sur
  // pages/eleve/badges.html, lien fourni ci-dessous.
  const totalBadges = (compteurs || []).reduce((somme, c) => somme + (c.total || 0), 0);

  const nomComplet = [profil.prenom, profil.nom].filter(Boolean).map(echapperProfilEleve).join(' ');
  const localisation = [fiche?.arrondissement, fiche?.commune, fiche?.departement].filter(Boolean);
  const localisationProfil = [profil.arrondissement, profil.commune, profil.departement].filter(Boolean);
  const localisationAffichee = (localisation.length ? localisation : localisationProfil).join(', ');

  const ligneInfo = (label, valeur) => valeur
    ? `<div class="stat-item-eleve"><span>${echapperProfilEleve(label)}</span><strong>${valeur}</strong></div>` : '';

  document.getElementById('contenu').innerHTML = `
    <div class="profil-carte-identite">
      <div class="profil-avatar-grand">${mascotte}</div>
      <h1>${nomComplet || echapperProfilEleve(profil.prenom)}</h1>
      ${nomClasse ? `<p class="profil-classe">Classe : ${echapperProfilEleve(nomClasse)}</p>` : ''}
    </div>

    <div class="section-title-eleve">🪪 Mes informations</div>
    <div class="widget-eleve">
      ${ligneInfo('Prénom', echapperProfilEleve(profil.prenom))}
      ${ligneInfo('Nom', echapperProfilEleve(profil.nom))}
      ${ligneInfo('Identifiant', echapperProfilEleve(profil.identifiant))}
      ${ligneInfo('Email', echapperProfilEleve(profil.email))}
      ${ligneInfo('Sexe', profil.sexe ? echapperProfilEleve(LIBELLES_SEXE_PROFIL[profil.sexe] || profil.sexe) : '')}
      ${ligneInfo('Date de naissance', fiche?.date_naissance ? new Date(fiche.date_naissance + 'T00:00:00').toLocaleDateString('fr-FR') : '')}
      ${ligneInfo('Classe', echapperProfilEleve(nomClasse))}
      ${ligneInfo('Localisation', localisationAffichee ? echapperProfilEleve(localisationAffichee) : '')}
      ${ligneInfo('Membre depuis', profil.cree_le ? new Date(profil.cree_le).toLocaleDateString('fr-FR') : '')}
      ${ligneInfo('Dernière activité', fiche?.derniere_activite ? new Date(fiche.derniere_activite).toLocaleString('fr-FR') : '')}
    </div>

    <div class="section-title-eleve" style="margin-top:22px">⚙️ Réglages posés par un parent</div>
    <div class="widget-eleve">
      ${ligneInfo('Compte actif', fiche ? (fiche.compte_actif === false ? 'Non' : 'Oui') : '')}
      ${ligneInfo('Messagerie autorisée', fiche ? (fiche.messagerie_autorisee ? 'Oui' : 'Non') : '')}
      ${ligneInfo('Horaires de connexion limités', fiche ? (fiche.horaires_autorises && Object.keys(fiche.horaires_autorises).length ? 'Oui' : 'Non') : '')}
    </div>

    <div class="section-title-eleve" style="margin-top:22px">🏆 Mes récompenses</div>
    <div class="grille-totaux-profil">
      <div class="carte-total-profil">⭐<div class="valeur-total-profil">${totalEtoiles}</div><div>Étoile${totalEtoiles > 1 ? 's' : ''}</div></div>
      <div class="carte-total-profil">🏅<div class="valeur-total-profil">${totalBadges}</div><div>Badge${totalBadges > 1 ? 's' : ''}</div></div>
    </div>
    <a href="badges.html" class="btn btn-discret" style="display:inline-block;margin-top:14px">Voir le détail de mes badges</a>
  `;
})();

function echapperProfilEleve(v) {
  if (v === null || v === undefined) return '';
  const d = document.createElement('div');
  d.textContent = v;
  return d.innerHTML;
}
