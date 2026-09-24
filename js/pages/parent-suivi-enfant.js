// Page pages/parent/suivi-enfant.html
// 19 septembre 2026 (25e lot) : « en tant que parent, je n'ai pas pu accédé
// aux activités de l'enfant... Les cours suivis, les activités, les
// badges... » — nouvelle page dédiée, clarifiée avec le porteur du projet
// (les 4 éléments demandés : cours suivis, activités/exercices faits, badges
// obtenus, paliers de progression). Toutes les données lues ici étaient déjà
// accessibles au parent via les policies RLS existantes (reponses_exercices,
// rendus_activites, seances_terminees, compteurs_badges_paliers,
// etoiles_eleve ont toutes une policy "..._lecture_parent" via parent_eleve,
// tout comme seances/blocs_seance pour les séances publiées de la classe de
// l'enfant) — le manque était uniquement une page côté client, aucune
// migration n'a été nécessaire pour cette fonctionnalité.

let profilSuiviEnfant = null;
let enfantsSuiviEnfant = [];
let enfantSelectionneSuivi = null;
let filtrePalierSuiviEnfant = 'tous';
let compteursBadgesParPalierSuivi = {};
let totalEtoilesSuiviEnfant = 0;

const LIBELLES_PALIER_SUIVI = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const COULEURS_PALIER_SUIVI = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#C2410C', axosu: '#9B59B6' };
const NOM_COULEUR_PAR_PALIER_SUIVI = { azovi: 'Bronze', devi: 'Argent', ogan: 'Or', axosu: 'Diamant' };
const IMAGE_MEDAILLE_PALIER_SUIVI = { azovi: 'medaille-azovi.jpg', devi: 'medaille-devi.jpg', ogan: 'medaille-ogan.jpg', axosu: 'medaille-axosu.jpg' };
const IMAGE_BADGE_PALIER_SUIVI = { azovi: 'badge-bronze.jpg', devi: 'badge-argent.jpg', ogan: 'badge-or.jpg', axosu: 'badge-diamant.jpg' };
const IMAGE_TROPHEE_PALIER_SUIVI = { azovi: 'trophee-bronze.jpg', devi: 'trophee-argent.jpg', ogan: 'trophee-or.jpg', axosu: 'trophee-diamant.jpg' };

(async function () {
  profilSuiviEnfant = await requireRole('parent');
  if (!profilSuiviEnfant) return;
  await initEnteteNavigation({
    role: 'parent', utilisateurId: profilSuiviEnfant.id, badgeHtml: `🟢 ${echapperSuivi(profilSuiviEnfant.prenom)}`,
    liens: liensAvecPrefixe('parent', '')
  });

  const { data: liens } = await supabaseClient.from('parent_eleve').select('eleve_id').eq('parent_id', profilSuiviEnfant.id);
  const ids = (liens || []).map(l => l.eleve_id);
  if (!ids.length) {
    document.getElementById('contenu').innerHTML = `
      <div class="carte-bienvenue"><h1>Aucun enfant inscrit</h1><p>Inscrivez d'abord un enfant depuis votre tableau de bord.</p></div>`;
    return;
  }
  const { data: profils } = await supabaseClient.from('profils').select('id, prenom, nom').in('id', ids);
  enfantsSuiviEnfant = profils || [];
  enfantSelectionneSuivi = enfantsSuiviEnfant[0]?.id;

  await afficherSuiviEnfant();
})();

function echapperSuivi(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function iconeBadgeImgMatSuivi(fichier, taille, alt, { nombre, unite } = {}) {
  const clic = nombre === undefined ? '' : ` data-loupe-badge="${fichier}" data-loupe-titre="${echapperSuivi(alt || '')}" data-loupe-nombre="${nombre}" data-loupe-unite="${echapperSuivi(unite || '')}" style="cursor:pointer" tabindex="0" role="button"`;
  return `<img src="${RACINE_SITE}assets/badges/${fichier}" alt="${alt || ''}" width="${taille}" height="${taille}" class="icone-badge-img-mat"${clic} loading="lazy">`;
}

function formaterDateSuivi(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function afficherSuiviEnfant() {
  const conteneur = document.getElementById('contenu');
  const enfant = enfantsSuiviEnfant.find(e => e.id === enfantSelectionneSuivi);
  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id, mascotte, cahier_ecriture_visible_enseignant').eq('id', enfantSelectionneSuivi).single();

  let nomClasse = '';
  if (fiche?.classe_id) {
    const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).single();
    nomClasse = classe?.nom || '';
  }

  const [{ data: compteurs }, { data: etoiles }, { data: seancesTerminees }, { data: reponsesTous }, { data: rendusTous }] = await Promise.all([
    supabaseClient.from('compteurs_badges_paliers').select('palier, type_badge, total').eq('eleve_id', enfantSelectionneSuivi),
    supabaseClient.from('etoiles_eleve').select('total').eq('eleve_id', enfantSelectionneSuivi).maybeSingle(),
    supabaseClient.from('seances_terminees').select('seance_id, termine_le, seances(titre, discipline, statut)').eq('eleve_id', enfantSelectionneSuivi).order('termine_le', { ascending: false }),
    supabaseClient.from('reponses_exercices').select('bloc_id, numero_essai, statut, score, score_max, nb_taches, nb_taches_reussies, medaille, cree_le, blocs_seance(type_bloc, contenu, seance_id, devoir_id, seances(titre), devoirs(titre))').eq('eleve_id', enfantSelectionneSuivi).order('cree_le', { ascending: false }),
    supabaseClient.from('rendus_activites').select('bloc_id, numero_essai, note, bareme, appreciation, corrige_le, soumis_le, medaille, blocs_seance(type_bloc, contenu, seance_id, devoir_id, seances(titre), devoirs(titre))').eq('eleve_id', enfantSelectionneSuivi).order('soumis_le', { ascending: false })
  ]);

  compteursBadgesParPalierSuivi = {};
  (compteurs || []).forEach(c => {
    (compteursBadgesParPalierSuivi[c.palier] ??= { logo_standard: 0, medaille_speciale: 0, trophee_excellence: 0 })[c.type_badge] = c.total;
  });
  totalEtoilesSuiviEnfant = etoiles?.total || 0;

  // Avancement global dans le programme de la classe (même calcul que
  // js/pages/eleve-tableau-de-bord.js : séances terminées / séances publiées
  // accessibles à cette classe).
  let progressionPct = 0;
  let totalPublieSuivi = 0;
  if (fiche?.classe_id) {
    const { data: noeudsClasse } = await supabaseClient.from('noeuds_parcours').select('id').eq('classe_id', fiche.classe_id);
    const idsNoeuds = (noeudsClasse || []).map(n => n.id);
    const { data: saClasse } = idsNoeuds.length ? await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds) : { data: [] };
    const idsSA = (saClasse || []).map(s => s.id);
    const { count: totalPublie } = idsSA.length
      ? await supabaseClient.from('seances').select('id', { count: 'exact', head: true }).eq('statut', 'publie').in('sa_id', idsSA)
      : { count: 0 };
    totalPublieSuivi = totalPublie || 0;
    progressionPct = totalPublieSuivi ? Math.min(100, Math.round(((seancesTerminees || []).length / totalPublieSuivi) * 100)) : 0;
  }

  // Ne garder que le DERNIER essai par bloc (comme resumerDevoirBlocs côté
  // devoirs) — un exercice peut avoir jusqu'à 3 essais, on ne veut pas les
  // lister 3 fois dans l'historique.
  const dernierEssaiParBloc = (lignes) => {
    const m = {};
    (lignes || []).forEach(l => { if (!m[l.bloc_id] || (l.numero_essai || 0) > (m[l.bloc_id].numero_essai || 0)) m[l.bloc_id] = l; });
    return Object.values(m);
  };

  const historiqueActivites = [
    ...dernierEssaiParBloc(reponsesTous).map(r => {
      const b = r.blocs_seance || {};
      const contexte = b.seances?.titre || b.devoirs?.titre || '—';
      const libelleBloc = b.contenu?.libelle || (typeof infoType === 'function' ? infoType(b.type_bloc).label : b.type_bloc);
      const resultat = r.statut === 'en_attente_ia'
        ? '⏳ En attente de correction'
        : `${r.nb_taches_reussies ?? r.score ?? 0}/${r.nb_taches ?? r.score_max ?? '?'} tâche(s) réussie(s)`;
      return { date: r.cree_le, contexte, libelleBloc, resultat, essai: r.numero_essai };
    }),
    ...dernierEssaiParBloc(rendusTous).map(r => {
      const b = r.blocs_seance || {};
      const contexte = b.seances?.titre || b.devoirs?.titre || '—';
      const libelleBloc = b.contenu?.libelle || (typeof infoType === 'function' ? infoType(b.type_bloc).label : b.type_bloc);
      const resultat = !r.corrige_le
        ? '⏳ En attente de correction'
        : `${r.note != null ? `${r.note}/${r.bareme}` : '—'}${r.appreciation ? ` — ${{ acquis: 'Acquis', en_cours: 'En cours', non_acquis: 'Non acquis' }[r.appreciation] || r.appreciation}` : ''}`;
      return { date: r.soumis_le, contexte, libelleBloc, resultat, essai: r.numero_essai };
    })
  ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const coursSuivisHtml = (seancesTerminees || []).length
    ? `<div class="liste-lignes-seances">${(seancesTerminees || []).slice(0, 20).map(s => `
      <div class="bloc-ligne-seance-partagee">
        <div class="ligne-seance-partagee">
          <div class="details-ligne-seance-partagee">
            <div class="titre-ligne-seance-partagee"><span class="texte-titre-seance-partagee">${echapperSuivi(s.seances?.titre || 'Séance')}</span></div>
            <div class="chemin-ligne-seance-partagee">Terminée le ${formaterDateSuivi(s.termine_le)}</div>
          </div>
          <div class="actions-ligne-seance-partagee">
            ${s.seances?.statut === 'publie' ? `<a class="btn btn-primaire" href="consulter-seance.html?id=${s.seance_id}">🔍 Consulter</a>` : ''}
          </div>
        </div>
      </div>`).join('')}</div>`
    : `<p style="color:var(--text-gris)">Aucune séance terminée pour l'instant.</p>`;

  const historiqueHtml = historiqueActivites.length
    ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--bordure,#E2E8F0)">
          <th style="padding:6px 8px">Séance / devoir</th><th style="padding:6px 8px">Activité</th><th style="padding:6px 8px">Résultat</th><th style="padding:6px 8px">Date</th>
        </tr></thead>
        <tbody>${historiqueActivites.map(a => `
          <tr style="border-bottom:1px solid var(--bordure,#E2E8F0)">
            <td style="padding:6px 8px">${echapperSuivi(a.contexte)}</td>
            <td style="padding:6px 8px">${echapperSuivi(a.libelleBloc)}${a.essai ? ` <span style="color:var(--text-gris);font-size:11px">(essai ${a.essai})</span>` : ''}</td>
            <td style="padding:6px 8px">${echapperSuivi(a.resultat)}</td>
            <td style="padding:6px 8px;white-space:nowrap">${formaterDateSuivi(a.date)}</td>
          </tr>`).join('')}</tbody>
      </table></div>`
    : `<p style="color:var(--text-gris)">Aucune activité rendue pour l'instant.</p>`;

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1>📈 Suivi de l'enfant</h1>
      <p>Consultez les cours suivis, les activités faites et les badges obtenus par ${enfantsSuiviEnfant.length > 1 ? 'chacun de vos enfants' : 'votre enfant'}.</p>
    </div>

    ${enfantsSuiviEnfant.length > 1 ? `<div class="selecteur-enfant" id="selecteurEnfantSuivi">
      ${enfantsSuiviEnfant.map(e => `<button class="${e.id === enfantSelectionneSuivi ? 'actif' : ''}" data-enfant-suivi="${e.id}">${echapperSuivi(e.prenom)} ${echapperSuivi(e.nom)}</button>`).join('')}
    </div>` : `<p style="font-weight:700;color:var(--noir-kekeli)">${echapperSuivi(enfant?.prenom)} ${echapperSuivi(enfant?.nom)}${nomClasse ? ` — ${echapperSuivi(nomClasse)}` : ''}</p>`}

    <div class="titre-section-pub">📚 Cours suivis</div>
    ${fiche?.classe_id ? `<p style="color:var(--text-gris);font-size:13px;margin-top:-6px">Avancement dans le programme : ${(seancesTerminees || []).length}/${totalPublieSuivi} séance(s) terminée(s) (${progressionPct}%)</p>` : ''}
    ${coursSuivisHtml}

    <div class="titre-section-pub">📝 Activités et exercices faits</div>
    ${historiqueHtml}

    <div class="titre-section-pub">🎯 Progression par palier (badges)</div>
    ${html_progressionPaliersSuivi()}

    <div class="titre-section-pub">✍️ Cahier d'écriture</div>
    <div class="bloc-ligne-seance-partagee" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <p style="margin:0;color:var(--text-gris);font-size:13px">Consultez le cahier d'écriture sauvegardé en ligne de ${echapperSuivi(enfant?.prenom) || "l'enfant"}.</p>
      <button type="button" class="btn btn-primaire" id="btnVoirCahierSuivi">👁️ Voir le cahier</button>
    </div>

    <div class="titre-section-pub">🔒 Contrôle parental</div>
    <div class="bloc-ligne-seance-partagee">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" id="caseCahierVisibleEns" ${fiche?.cahier_ecriture_visible_enseignant ? 'checked' : ''}>
        Autoriser l'enseignant de ${echapperSuivi(enfant?.prenom) || "l'enfant"} à consulter son cahier d'écriture (en plus de vous-même et de l'élève)
      </label>
      <p id="messageSuccesCahierVisibleEns" style="display:none;color:#15803D;font-size:12.5px;margin:6px 0 0">✅ Préférence enregistrée.</p>
    </div>
  `;

  const selecteur = document.getElementById('selecteurEnfantSuivi');
  if (selecteur) selecteur.querySelectorAll('[data-enfant-suivi]').forEach(btn => {
    btn.addEventListener('click', () => { enfantSelectionneSuivi = btn.dataset.enfantSuivi; afficherSuiviEnfant(); });
  });
  document.querySelectorAll('[data-filtre-palier-suivi]').forEach(btn => {
    btn.addEventListener('click', () => { filtrePalierSuiviEnfant = btn.dataset.filtrePalierSuivi; afficherSuiviEnfant(); });
  });

  const btnVoirCahier = document.getElementById('btnVoirCahierSuivi');
  if (btnVoirCahier) btnVoirCahier.addEventListener('click', () => {
    chargerEtAfficherCahierEleve(enfantSelectionneSuivi, `${enfant?.prenom || ''} ${enfant?.nom || ''}`.trim());
  });

  const caseCahierVisibleEns = document.getElementById('caseCahierVisibleEns');
  if (caseCahierVisibleEns) caseCahierVisibleEns.addEventListener('change', enregistrerVisibiliteCahierEnseignantSuivi);
}

// Contrôle parental (demande explicite du 24 septembre 2026 : "prévois dans
// le contrôle parental qui pourra consulter le cahier en plus de l'élève") —
// même schéma que enregistrerThemePremium() dans js/pages/parametres.js :
// écriture directe, revert de la case à cocher en cas d'erreur.
async function enregistrerVisibiliteCahierEnseignantSuivi(e) {
  const visible = e.target.checked;
  const messageSucces = document.getElementById('messageSuccesCahierVisibleEns');
  const { error } = await supabaseClient.rpc('definir_visibilite_cahier_enseignant', {
    p_eleve_id: enfantSelectionneSuivi, p_visible: visible,
  });
  if (error) { alert(error.message); e.target.checked = !visible; return; }
  if (messageSucces) { messageSucces.style.display = 'block'; setTimeout(() => { messageSucces.style.display = 'none'; }, 3000); }
}

// Même principe que rendreBadges() dans js/pages/eleve-badges.js (voir ce
// fichier), adapté en lecture pour le parent : totaux + détail par palier
// filtrable.
function html_progressionPaliersSuivi() {
  const totalBadgeType = (type) => {
    const paliers = filtrePalierSuiviEnfant === 'tous' ? Object.keys(LIBELLES_PALIER_SUIVI) : [filtrePalierSuiviEnfant];
    return paliers.reduce((somme, p) => somme + (compteursBadgesParPalierSuivi[p]?.[type] || 0), 0);
  };
  const totalMedailles = totalBadgeType('logo_standard');
  const totalBadgesSpeciaux = totalBadgeType('medaille_speciale');
  const totalTrophees = totalBadgeType('trophee_excellence');

  const iconeMedailleTop = filtrePalierSuiviEnfant !== 'tous'
    ? iconeBadgeImgMatSuivi(IMAGE_MEDAILLE_PALIER_SUIVI[filtrePalierSuiviEnfant], 34, `Médaille ${LIBELLES_PALIER_SUIVI[filtrePalierSuiviEnfant].replace(/^\S+ /, '')}`, { nombre: totalMedailles, unite: totalMedailles > 1 ? 'médailles' : 'médaille' })
    : '🎖️';
  const iconeBadgeSpecialTop = filtrePalierSuiviEnfant !== 'tous'
    ? iconeBadgeImgMatSuivi(IMAGE_BADGE_PALIER_SUIVI[filtrePalierSuiviEnfant], 34, `Badge ${NOM_COULEUR_PAR_PALIER_SUIVI[filtrePalierSuiviEnfant]}`, { nombre: totalBadgesSpeciaux, unite: totalBadgesSpeciaux > 1 ? 'badges' : 'badge' })
    : '🏅';
  const iconeTropheeTop = filtrePalierSuiviEnfant !== 'tous'
    ? iconeBadgeImgMatSuivi(IMAGE_TROPHEE_PALIER_SUIVI[filtrePalierSuiviEnfant], 34, `Trophée ${NOM_COULEUR_PAR_PALIER_SUIVI[filtrePalierSuiviEnfant]}`, { nombre: totalTrophees, unite: totalTrophees > 1 ? 'trophées' : 'trophée' })
    : '🏆';

  const boutonsFiltre = ['tous', ...Object.keys(LIBELLES_PALIER_SUIVI)].map(p => {
    const libelle = p === 'tous' ? 'Tous les paliers' : LIBELLES_PALIER_SUIVI[p];
    const actif = filtrePalierSuiviEnfant === p;
    return `<button type="button" class="btn ${actif ? 'btn-filled' : 'btn-discret'} bouton-filtre-palier-badges" data-filtre-palier-suivi="${p}" style="${actif && p !== 'tous' ? `background:${COULEURS_PALIER_SUIVI[p]};border-color:${COULEURS_PALIER_SUIVI[p]}` : ''}">${libelle}</button>`;
  }).join('');

  const detailParPalier = filtrePalierSuiviEnfant !== 'tous' ? (() => {
    const p = filtrePalierSuiviEnfant;
    const c = compteursBadgesParPalierSuivi[p] || {};
    const nbMedaille = c.logo_standard || 0, nbBadge = c.medaille_speciale || 0, nbTrophee = c.trophee_excellence || 0;
    return `<div class="carte-detail-palier-badges" style="border-left-color:${COULEURS_PALIER_SUIVI[p]}">
      <div class="bloc-lecture-titre" style="color:${COULEURS_PALIER_SUIVI[p]}">${LIBELLES_PALIER_SUIVI[p]}</div>
      <p style="margin:6px 0 0;color:var(--text-gris);font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${iconeBadgeImgMatSuivi(IMAGE_MEDAILLE_PALIER_SUIVI[p], 20, `Médaille ${LIBELLES_PALIER_SUIVI[p].replace(/^\S+ /, '')}`, { nombre: nbMedaille, unite: nbMedaille > 1 ? 'médailles' : 'médaille' })} ${nbMedaille} médaille${nbMedaille > 1 ? 's' : ''}
        · ${iconeBadgeImgMatSuivi(IMAGE_BADGE_PALIER_SUIVI[p], 20, `Badge ${NOM_COULEUR_PAR_PALIER_SUIVI[p]}`, { nombre: nbBadge, unite: nbBadge > 1 ? 'badges' : 'badge' })} Badge ${NOM_COULEUR_PAR_PALIER_SUIVI[p]} × ${nbBadge}
        · ${iconeBadgeImgMatSuivi(IMAGE_TROPHEE_PALIER_SUIVI[p], 20, `Trophée ${NOM_COULEUR_PAR_PALIER_SUIVI[p]}`, { nombre: nbTrophee, unite: nbTrophee > 1 ? 'trophées' : 'trophée' })} ${nbTrophee} trophée${nbTrophee > 1 ? 's' : ''} d'excellence
      </p>
    </div>`;
  })() : '';

  return `
    <div class="grille-totaux-badges-paliers">
      <div class="carte-total-badge-palier">⭐<div class="valeur-total-badge-palier">${totalEtoilesSuiviEnfant}</div><div>Étoile${totalEtoilesSuiviEnfant > 1 ? 's' : ''}</div></div>
      <div class="carte-total-badge-palier">${iconeMedailleTop}<div class="valeur-total-badge-palier">${totalMedailles}</div><div>Médaille${totalMedailles > 1 ? 's' : ''} de palier</div></div>
      <div class="carte-total-badge-palier">${iconeBadgeSpecialTop}<div class="valeur-total-badge-palier">${totalBadgesSpeciaux}</div><div>Badge${totalBadgesSpeciaux > 1 ? 's' : ''} spécia${totalBadgesSpeciaux > 1 ? 'ux' : 'l'}</div></div>
      <div class="carte-total-badge-palier">${iconeTropheeTop}<div class="valeur-total-badge-palier">${totalTrophees}</div><div>Trophée${totalTrophees > 1 ? 's' : ''} d'excellence</div></div>
    </div>
    <div class="filtres-palier-badges">${boutonsFiltre}</div>
    ${detailParPalier}
  `;
}
