// Page pages/enseignant/planification.html — Planification mensuelle,
// 12 septembre 2026. Porté fidèlement du prototype fourni
// (plannificatio_export.html) : grille fixe à lignes de disciplines
// officielles (registre administratif béninois), MAIS chaque ligne est ici
// RATTACHÉE aux vraies disciplines de seances.discipline déjà utilisées sur
// Kekeli (clarification explicite de l'enseignant : "les disciplines de la
// planification pour français correspondent en réalité au séance en
// français sur le site. Vocab Them/Com Oral correspond à vocabulaire
// thématique/communication orale. L'une ou l'autre. C'est pareil pour les
// autres abbréviations."). Le placement en semaine reste un geste manuel de
// l'enseignant (les séances n'ont pas de date), stocké dans
// planification_cellules.

// ===========================================================================
// Référentiel fixe des lignes (garder la liste du prototype), avec mapping
// champ_formation_id + ensemble de disciplines réelles Kekeli. `disciplines:
// null` = n'importe quelle discipline de ce champ. `disciplinePrefix: true`
// = correspondance par préfixe (utile pour "Expression Écrite (...)" qui a
// plusieurs variantes réelles). `texteLibreSeulement: true` = pas de
// recherche de séance, uniquement une note texte (petit projet).
// ===========================================================================

const CHAMP_FR = 1, CHAMP_MATH = 2, CHAMP_ES = 3, CHAMP_EST = 4, CHAMP_EA = 5, CHAMP_EPS = 6;

const PLAN_LIGNES = [
  { id: 'fr_1', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Vocab. Thématique / Com. Orale', champFormationId: CHAMP_FR, disciplines: ['Vocabulaire Thématique', 'Communication Orale'] },
  { id: 'fr_2', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Lecture', champFormationId: CHAMP_FR, disciplines: ['Lecture'] },
  { id: 'fr_3', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Expression Écrite', champFormationId: CHAMP_FR, disciplines: ['Expression Écrite'], disciplinePrefix: true },
  { id: 'fr_4', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Expression Écrite (suite)', champFormationId: CHAMP_FR, disciplines: ['Expression Écrite'], disciplinePrefix: true },
  { id: 'fr_5', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Vocabulaire Fonctionnel', champFormationId: CHAMP_FR, disciplines: ['Vocabulaire Fonctionnel'] },
  { id: 'fr_6', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Grammaire', champFormationId: CHAMP_FR, disciplines: ['Grammaire'] },
  { id: 'fr_7', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Conjugaison', champFormationId: CHAMP_FR, disciplines: ['Conjugaison'] },
  { id: 'fr_8', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Orthographe', champFormationId: CHAMP_FR, disciplines: ['Orthographe', 'Orthographe (Dictée)'] },
  { id: 'fr_9', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Écriture', champFormationId: CHAMP_FR, disciplines: ['Écriture'] },
  { id: 'fr_10', champ: 'FR', champLabel: 'FRANÇAIS', label: 'Lecture (2)', champFormationId: CHAMP_FR, disciplines: ['Lecture'] },

  { id: 'math_1', champ: 'MATH', champLabel: 'MATHÉMATIQUES', label: 'Séance 1', champFormationId: CHAMP_MATH, disciplines: null },
  { id: 'math_2', champ: 'MATH', champLabel: 'MATHÉMATIQUES', label: 'Séance 2', champFormationId: CHAMP_MATH, disciplines: null },
  { id: 'math_3', champ: 'MATH', champLabel: 'MATHÉMATIQUES', label: 'Séance 3', champFormationId: CHAMP_MATH, disciplines: null },
  { id: 'math_4', champ: 'MATH', champLabel: 'MATHÉMATIQUES', label: 'Séance 4', champFormationId: CHAMP_MATH, disciplines: null },
  { id: 'math_5', champ: 'MATH', champLabel: 'MATHÉMATIQUES', label: 'Séance 5', champFormationId: CHAMP_MATH, disciplines: null },

  { id: 'est_1', champ: 'EST', champLabel: 'ÉD. SCIENT. & TECHNO.', label: 'Séance 1', champFormationId: CHAMP_EST, disciplines: null },
  { id: 'est_2', champ: 'EST', champLabel: 'ÉD. SCIENT. & TECHNO.', label: 'Séance 2', champFormationId: CHAMP_EST, disciplines: null },

  { id: 'es_morale', champ: 'ES', champLabel: 'ÉD. SOCIALE', label: 'Morale', champFormationId: CHAMP_ES, disciplines: ['Morale'] },
  { id: 'es_civisme', champ: 'ES', champLabel: 'ÉD. SOCIALE', label: 'Civisme', champFormationId: CHAMP_ES, disciplines: ['Civisme'] },
  { id: 'es_histoire', champ: 'ES', champLabel: 'ÉD. SOCIALE', label: 'Histoire', champFormationId: CHAMP_ES, disciplines: ['Histoire'] },
  { id: 'es_geographie', champ: 'ES', champLabel: 'ÉD. SOCIALE', label: 'Géographie', champFormationId: CHAMP_ES, disciplines: ['Géographie'] },

  { id: 'ea_1', champ: 'EA', champLabel: 'ÉD. ARTISTIQUE', label: 'Séance 1', champFormationId: CHAMP_EA, disciplines: null },
  { id: 'ea_2', champ: 'EA', champLabel: 'ÉD. ARTISTIQUE', label: 'Séance 2', champFormationId: CHAMP_EA, disciplines: null },
  { id: 'ea_3', champ: 'EA', champLabel: 'ÉD. ARTISTIQUE', label: 'Séance 3', champFormationId: CHAMP_EA, disciplines: null },

  { id: 'eps_1', champ: 'EPS', champLabel: 'ÉD. PHYSIQUE & SPORTIVE', label: 'Séance 1', champFormationId: CHAMP_EPS, disciplines: null },
  { id: 'eps_2', champ: 'EPS', champLabel: 'ÉD. PHYSIQUE & SPORTIVE', label: 'Séance 2', champFormationId: CHAMP_EPS, disciplines: null },

  // Petit projet : pas de champ_formation dédié dans le référentiel Kekeli —
  // champFormationId ci-dessous n'est qu'une valeur technique pour satisfaire
  // la contrainte NOT NULL de planification_cellules, jamais utilisée pour
  // chercher une séance (texteLibreSeulement:true).
  { id: 'petit_projet', champ: 'PROJET', champLabel: 'PETIT PROJET', label: 'Petit projet', champFormationId: CHAMP_ES, disciplines: [], texteLibreSeulement: true }
];

function seanceCorrespondLignePL(seance, ligne) {
  if (ligne.texteLibreSeulement) return false;
  if (!ligne.disciplines) return true;
  const disc = (seance.discipline || '').trim();
  if (!disc) return false;
  if (ligne.disciplinePrefix) return ligne.disciplines.some(p => disc.startsWith(p));
  return ligne.disciplines.includes(disc);
}

// ===========================================================================
// État du module
// ===========================================================================

let profilPL = null;
let classesPL = [];
let classeSelPL = null;
let ecolePL = '';
let moisPL = '';
let cellulesParClePL = {};   // `${ligne_cle}|${semaine}` -> { id, seance_id, texte_libre, titre_seance? }
let evenementsPL = [];
let parametresMoisPL = { semaines_evaluation: [] };
let masquerS5PL = false;
let semainesCourantesPL = [];

(async function () {
  profilPL = await requireRole('enseignant');
  if (!profilPL) return;
  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profilPL.id, badgeHtml: `🟢 ${echapperPL(profilPL.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });

  const { data: ens } = await supabaseClient.from('enseignants').select('classes_assignees, ecole').eq('id', profilPL.id).single();
  const idsClasses = (ens?.classes_assignees || []).map(Number);
  ecolePL = ens?.ecole || '';

  if (!idsClasses.length) {
    document.getElementById('contenu').innerHTML = `
      <div class="ga-carte"><h1>Aucune classe assignée</h1>
      <p>Une classe doit d'abord vous être attribuée par l'administration (voir « Enseignants &amp; classes ») avant de pouvoir planifier.</p></div>`;
    return;
  }

  const { data: classes } = await supabaseClient.from('classes').select('id, nom').in('id', idsClasses).order('ordre');
  classesPL = classes || [];
  classeSelPL = classesPL[0]?.id;
  moisPL = moisActuelISOPL();

  afficherEntetePL();
  await chargerEtAfficherPlan();
})();

function moisActuelISOPL() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function echapperPL(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// 18 septembre 2026 : "Verrouille les boutons de conversion en word, excel,
// pdf et ajoute le message bientôt disponible le temps que ça soit bien
// paramétré." — même principe que alerterExportVerrouilleGA() côté registre
// d'appel (js/pages/enseignant-registre-appel.js), dupliqué ici volontairement
// : ces deux fichiers ne partagent aucune dépendance croisée.
function alerterExportVerrouillePL() {
  alert('🔒 Cette fonctionnalité arrive bientôt — le temps qu\'elle soit bien paramétrée.');
}

// Même convention que libelleTitreSeanceSea() dans js/pages/seances.js (18
// septembre 2026, "afficher le titre des séquences dans les cases [...] au
// lieu de séquence") : titre_contenu (le vrai titre saisi par l'admin) si
// présent, sinon le titre brut générique ("Séance N"), grisé/italique avec
// une pastille "à titrer" pour ne jamais faire croire que c'est un vrai
// titre — juste réduite pour tenir dans une case étroite de la grille.
function libelleTitreSeancePL(titre, titreContenu) {
  if (titreContenu) return echapperPL(titreContenu);
  return `<span style="font-style:italic;color:#94A3B8">${echapperPL(titre || 'Séance')}</span> <span style="font-style:normal;font-weight:700;font-size:7px;background:#FEF3C7;color:#92400E;padding:0 4px;border-radius:6px;vertical-align:middle">à titrer</span>`;
}

function afficherEntetePL() {
  document.getElementById('contenu').innerHTML = `
    <div class="ga-carte">
      <div class="ga-top-bar">
        <h1>🗓️ Planification mensuelle</h1>
        <select id="plSelectClasse" style="padding:8px;border-radius:8px;border:1px solid var(--bordure)">
          ${classesPL.map(c => `<option value="${c.id}">${echapperPL(c.nom)}</option>`).join('')}
        </select>
      </div>
      <div id="plZone"><p style="color:var(--text-gris)">Chargement...</p></div>
    </div>`;

  document.getElementById('plSelectClasse').addEventListener('change', async (e) => {
    classeSelPL = Number(e.target.value);
    await chargerEtAfficherPlan();
  });
}

// ===========================================================================
// Semaines du mois (regroupement lundi->vendredi, jusqu'à 5 semaines)
// ===========================================================================

function getJoursOuvresPL(annee, mois0) {
  const jours = [];
  const noms = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  const d = new Date(annee, mois0, 1);
  while (d.getMonth() === mois0) {
    const jsem = d.getDay();
    if (jsem !== 0 && jsem !== 6) {
      jours.push({ dateNum: d.getDate(), dayName: noms[jsem], jsem, isoDate: `${annee}-${String(mois0 + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
    }
    d.setDate(d.getDate() + 1);
  }
  return jours;
}

function calculerSemainesMoisPL(annee, mois0) {
  const joursOuvres = getJoursOuvresPL(annee, mois0);
  const semaines = [];
  let courante = null, cleLunCourante = null;
  joursOuvres.forEach(j => {
    const d = new Date(j.isoDate + 'T00:00:00');
    const lundi = new Date(d); lundi.setDate(d.getDate() - (j.jsem - 1));
    const cleLundi = lundi.toISOString().slice(0, 10);
    if (cleLundi !== cleLunCourante) {
      courante = { jours: [] };
      semaines.push(courante);
      cleLunCourante = cleLundi;
    }
    courante.jours.push(j);
  });
  return semaines.slice(0, 5).map((s, idx) => ({
    numero: idx + 1,
    dateDebut: s.jours[0].isoDate,
    dateFin: s.jours[s.jours.length - 1].isoDate
  }));
}

function evenementCouvrantSemainePL(semaine) {
  const debut = new Date(semaine.dateDebut + 'T00:00:00');
  const fin = new Date(semaine.dateFin + 'T00:00:00');
  return evenementsPL.find(ev => {
    if (ev.classe_id !== null && ev.classe_id !== classeSelPL) return false;
    const evDebut = new Date(ev.date_debut + 'T00:00:00'), evFin = new Date(ev.date_fin + 'T00:00:00');
    return evDebut <= fin && evFin >= debut; // chevauchement, même partiel
  });
}

// ===========================================================================
// Chargement + rendu principal
// ===========================================================================

async function chargerEtAfficherPlan() {
  const zone = document.getElementById('plZone');
  zone.innerHTML = '<p style="color:var(--text-gris)">Chargement de la planification...</p>';

  const [annee, mois] = moisPL.split('-').map(Number);
  semainesCourantesPL = calculerSemainesMoisPL(annee, mois - 1);
  const premierJour = semainesCourantesPL[0]?.dateDebut;
  const dernierJour = semainesCourantesPL[semainesCourantesPL.length - 1]?.dateFin;

  const [{ data: evenements }, { data: parametres }, { data: cellules }] = await Promise.all([
    supabaseClient.from('evenements_calendrier_classe').select('id, classe_id, date_debut, date_fin, type, libelle')
      .lte('date_debut', dernierJour).gte('date_fin', premierJour).or(`classe_id.eq.${classeSelPL},classe_id.is.null`),
    supabaseClient.from('planification_parametres_mensuels').select('id, semaines_evaluation')
      .eq('classe_id', classeSelPL).eq('annee', annee).eq('mois', mois).maybeSingle(),
    supabaseClient.from('planification_cellules').select('id, ligne_cle, semaine, seance_id, texte_libre, seances(titre, titre_contenu, discipline)')
      .eq('classe_id', classeSelPL).eq('annee', annee).eq('mois', mois)
  ]);

  evenementsPL = evenements || [];
  parametresMoisPL = parametres || { id: null, semaines_evaluation: [] };

  cellulesParClePL = {};
  (cellules || []).forEach(c => {
    cellulesParClePL[`${c.ligne_cle}|${c.semaine}`] = {
      id: c.id, seance_id: c.seance_id, texte_libre: c.texte_libre,
      titreSeance: c.seances?.titre || null, titreContenuSeance: c.seances?.titre_contenu || null,
      disciplineSeance: c.seances?.discipline || null
    };
  });

  const zone2 = document.getElementById('plZone');
  zone2.innerHTML = html_zonePlan(annee, mois);
  wireZonePlan(annee, mois);
}

function html_zonePlan(annee, mois) {
  return `
    <div class="ga-entete-grid">
      <div class="ga-champ"><label>Mois planifié</label><input type="month" id="plSelectMois" value="${moisPL}"></div>
      <div class="ga-champ"><label>École</label><span class="ga-valeur">${echapperPL(ecolePL) || '—'}</span></div>
      <div class="ga-champ"><label>Enseignant</label><span class="ga-valeur">${echapperPL(profilPL.prenom)} ${echapperPL(profilPL.nom)}</span></div>
      <div class="ga-champ">
        <label>Affichage</label>
        <label style="font-weight:normal;font-size:0.85rem;display:flex;align-items:center;gap:6px;margin-top:4px">
          <input type="checkbox" id="plMasquerS5" ${masquerS5PL ? 'checked' : ''}> Masquer la 5ᵉ semaine à l'impression
        </label>
      </div>
    </div>

    <div class="ga-top-bar">
      <div>
        <strong style="font-size:0.85rem;color:var(--text-gris)">Semaines d'évaluation : </strong>
        ${semainesCourantesPL.map(s => `
          <label style="font-size:0.85rem;margin-right:10px">
            <input type="checkbox" class="pl-case-eval" data-semaine="${s.numero}" ${parametresMoisPL.semaines_evaluation.includes(s.numero) ? 'checked' : ''}> S${s.numero}
          </label>`).join('')}
      </div>
      <div class="ga-actions">
        <div class="ga-dropdown">
          <button type="button" class="ga-dropdown-btn" id="plBtnCalendrier">🗓️ Congés / fériés <span>▾</span></button>
          <div class="ga-dropdown-menu" id="plMenuCalendrier">
            <div class="ga-dropdown-item" data-action="ajouter-conge">➕ Ajouter des congés (période)</div>
            <div class="ga-dropdown-item" data-action="ajouter-ferie">➕ Ajouter un jour férié</div>
            ${evenementsPL.filter(ev => ev.classe_id === classeSelPL).map(ev => `
              <div class="ga-dropdown-item" data-supprimer-evenement="${ev.id}" style="justify-content:space-between">
                <span>${ev.type === 'ferie' ? '🔴' : '🟠'} ${echapperPL(ev.libelle || ev.type)} (${ev.date_debut}${ev.date_fin !== ev.date_debut ? ' → ' + ev.date_fin : ''})</span>
                <span style="color:var(--ga-danger);cursor:pointer">✕</span>
              </div>`).join('')}
          </div>
        </div>
        <button type="button" class="ga-btn ga-btn-word ga-btn-verrouille" id="plBtnWord" title="Bientôt disponible">🔒 Word</button>
        <button type="button" class="ga-btn ga-btn-pdf ga-btn-verrouille" id="plBtnPdf" title="Bientôt disponible">🔒 PDF</button>
      </div>
    </div>

    <p style="font-size:0.82rem;color:var(--text-gris);margin-bottom:10px">
      📌 Cliquez sur une cellule pour y placer une séance réelle (filtrée par matière et discipline) ou une note libre. Les semaines cochées « évaluation » ci-dessus s'affichent en jaune sur toute la grille. Les congés/fériés couvrant une semaine s'affichent en gris.
    </p>

    <div class="ga-doc-titre">Fiche de planification mensuelle</div>

    <div class="ga-table-scroll ${masquerS5PL ? 'ga-hide-s5' : ''}" id="plTableWrap">
      ${html_tablePlan()}
    </div>

    <div class="ga-footer-ligne">
      <div class="ga-footer-col">Le Directeur / La Directrice<div class="ga-signature-espace"></div></div>
      <div class="ga-footer-col">${echapperPL(profilPL.prenom)} ${echapperPL(profilPL.nom)}<div class="ga-signature-espace"></div>L'Enseignant(e)</div>
    </div>
  `;
}

function html_tablePlan() {
  const semaines = semainesCourantesPL;
  let champCourant = null;
  const lignesHtml = PLAN_LIGNES.map(ligne => {
    const debutChamp = ligne.champ !== champCourant;
    champCourant = ligne.champ;
    const rowspanChamp = debutChamp ? PLAN_LIGNES.filter(l => l.champ === ligne.champ).length : 0;

    const cellulesSemaines = semaines.map(s => {
      const evSemaine = evenementCouvrantSemainePL(s);
      const estEval = parametresMoisPL.semaines_evaluation.includes(s.numero);
      const colClasse = s.numero === 5 ? 'ga-col-s5' : '';
      if (evSemaine) {
        return `<td class="ga-plan-conge-cell ${colClasse}">${evSemaine.type === 'ferie' ? 'FÉRIÉ' : 'CONGÉS'}</td>`;
      }
      if (estEval) {
        return `<td class="ga-plan-eval-cell ${colClasse}">ÉVALUATION</td>`;
      }
      const donnee = cellulesParClePL[`${ligne.id}|${s.numero}`];
      let contenu = `<div class="ga-plan-cell-vide" data-ligne="${ligne.id}" data-semaine="${s.numero}">+</div>`;
      if (donnee) {
        if (donnee.seance_id) {
          // 18 septembre 2026 : "afficher le titre des séquences [...] et
          // l'option d'éditer librement" — une case liée à une séance réelle
          // affiche son vrai titre (titre_contenu, ou le titre brut "à
          // titrer" à défaut), SAUF si l'enseignant a saisi un libellé
          // personnalisé (texte_libre en plus du seance_id, désormais
          // possible ensemble — voir enregistrerCellulePL) qui prend le pas
          // sur l'affichage sans jamais perdre le lien réel vers la séance.
          const libelleReel = libelleTitreSeancePL(donnee.titreSeance, donnee.titreContenuSeance);
          const libelleAffiche = donnee.texte_libre ? echapperPL(donnee.texte_libre) : libelleReel;
          const info = donnee.texte_libre ? ` title="Séance liée : ${echapperPL(donnee.titreContenuSeance || donnee.titreSeance || '')}"` : '';
          contenu = `<div class="ga-plan-seance-item" data-ligne="${ligne.id}" data-semaine="${s.numero}"${info}>${libelleAffiche}</div>`;
        } else if (donnee.texte_libre) {
          contenu = `<div class="ga-plan-texte-item" data-ligne="${ligne.id}" data-semaine="${s.numero}">${echapperPL(donnee.texte_libre)}</div>`;
        }
      }
      return `<td class="${colClasse}">${contenu}</td>`;
    }).join('');

    const boutonGenererAuto = ligne.texteLibreSeulement ? '' :
      `<button type="button" class="ga-btn-generer-auto" data-generer-ligne="${ligne.id}" title="Générer automatiquement les semaines vides à venir avec les prochaines séances publiées non encore utilisées">⚡</button>`;

    return `<tr>
      ${debutChamp ? `<td class="ga-plan-champ-cell" rowspan="${rowspanChamp}">${ligne.champLabel}</td>` : ''}
      <td class="ga-plan-discipline-cell">${echapperPL(ligne.label)} ${boutonGenererAuto}</td>
      ${cellulesSemaines}
    </tr>`;
  }).join('');

  return `
    <table class="ga-table" style="font-size:0.82rem">
      <thead>
        <tr>
          <th>Champ</th><th>Discipline</th>
          ${semaines.map(s => `<th class="${s.numero === 5 ? 'ga-col-s5' : ''}">S${s.numero}<span class="ga-plan-info-jours">${s.dateDebut.slice(8)}–${s.dateFin.slice(8)}</span></th>`).join('')}
        </tr>
      </thead>
      <tbody>${lignesHtml}</tbody>
    </table>`;
}

function wireZonePlan(annee, mois) {
  document.getElementById('plSelectMois').addEventListener('change', async (e) => {
    moisPL = e.target.value;
    await chargerEtAfficherPlan();
  });

  document.getElementById('plMasquerS5').addEventListener('change', (e) => {
    masquerS5PL = e.target.checked;
    document.getElementById('plTableWrap').classList.toggle('ga-hide-s5', masquerS5PL);
  });

  document.querySelectorAll('.pl-case-eval').forEach(cb => {
    cb.addEventListener('change', () => toggleEvalSemainePL(Number(cb.dataset.semaine), cb.checked));
  });

  const btnCal = document.getElementById('plBtnCalendrier');
  const menuCal = document.getElementById('plMenuCalendrier');
  btnCal.addEventListener('click', (e) => { e.stopPropagation(); menuCal.classList.toggle('ouvert'); });
  document.addEventListener('click', () => menuCal.classList.remove('ouvert'), { once: true });
  menuCal.querySelectorAll('[data-action]').forEach(item => {
    item.addEventListener('click', () => ouvrirModalCalendrierPL(item.dataset.action));
  });
  menuCal.querySelectorAll('[data-supprimer-evenement]').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      await supabaseClient.from('evenements_calendrier_classe').delete().eq('id', Number(item.dataset.supprimerEvenement));
      await chargerEtAfficherPlan();
    });
  });

  document.querySelectorAll('.ga-plan-cell-vide, .ga-plan-seance-item, .ga-plan-texte-item').forEach(el => {
    el.addEventListener('click', () => ouvrirSelecteurCellulePL(el.dataset.ligne, Number(el.dataset.semaine)));
  });

  document.querySelectorAll('[data-generer-ligne]').forEach(btn => {
    btn.addEventListener('click', () => genererAutoPL(btn.dataset.genererLigne, btn));
  });

  document.getElementById('plBtnWord').addEventListener('click', alerterExportVerrouillePL);
  document.getElementById('plBtnPdf').addEventListener('click', alerterExportVerrouillePL);
}

// ===========================================================================
// Édition d'une cellule
// ===========================================================================

async function chargerSeancesCandidatesPL(ligne) {
  if (ligne.texteLibreSeulement) return [];
  const { data: noeuds } = await supabaseClient.from('noeuds_parcours').select('id')
    .eq('classe_id', classeSelPL).eq('champ_formation_id', ligne.champFormationId);
  const noeudIds = (noeuds || []).map(n => n.id);
  if (!noeudIds.length) return [];
  const { data: sas } = await supabaseClient.from('sa').select('id').in('noeud_id', noeudIds);
  const saIds = (sas || []).map(s => s.id);
  if (!saIds.length) return [];
  const { data: seances } = await supabaseClient.from('seances').select('id, titre, titre_contenu, discipline')
    .in('sa_id', saIds).eq('statut', 'publie').order('titre');
  return (seances || []).filter(s => seanceCorrespondLignePL(s, ligne));
}

// 18 septembre 2026, refonte : "afficher le titre des séquences [...] et
// l'option d'éditer librement" — la séance choisie (radio, pas d'enregistrement
// immédiat au clic) et la note libre sont maintenant enregistrées ENSEMBLE en
// un seul geste (bouton unique), et ne s'excluent plus mutuellement : la note
// libre devient un libellé personnalisé qui prend le pas sur l'affichage du
// titre réel dans la case, sans faire perdre le lien réel vers la séance
// (utile pour le suivi/la notation) — voir html_tablePlan et enregistrerCellulePL.
async function ouvrirSelecteurCellulePL(ligneId, semaine) {
  const ligne = PLAN_LIGNES.find(l => l.id === ligneId);
  if (!ligne) return;
  const candidates = await chargerSeancesCandidatesPL(ligne);
  const cleComplete = `${ligneId}|${semaine}`;
  const donnee = cellulesParClePL[cleComplete];
  let seanceChoisieId = donnee?.seance_id || null;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:20px;max-width:440px;width:100%;max-height:80vh;overflow-y:auto">
      <h3 style="margin-top:0">${echapperPL(ligne.champLabel)} — ${echapperPL(ligne.label)} (S${semaine})</h3>
      ${candidates.length ? `
        <p style="font-size:0.82rem;color:var(--text-gris)">Séance à lier (facultatif — cliquez pour sélectionner/désélectionner) :</p>
        <div id="plListeCandidats">${candidates.map(s => `
          <div class="ga-dropdown-item pl-item-candidat ${seanceChoisieId === s.id ? 'pl-candidat-actif' : ''}" data-choisir-seance="${s.id}"
               style="border:1px solid var(--bordure);border-radius:6px;margin-bottom:5px;cursor:pointer">
            📘 ${libelleTitreSeancePL(s.titre, s.titre_contenu)} <span style="color:var(--text-gris)">(${echapperPL(s.discipline || '')})</span>
          </div>`).join('')}</div>
      ` : `<p style="font-size:0.82rem;color:var(--text-gris)">Aucune séance publiée ne correspond à cette discipline pour cette classe pour l'instant — utilisez une note libre.</p>`}
      <label class="champ-modal" style="display:block;margin-top:12px">Libellé personnalisé (facultatif — remplace l'affichage du titre réel dans la case)
        <input type="text" id="plTexteLibreInput" value="${donnee?.texte_libre ? echapperPL(donnee.texte_libre) : ''}" placeholder="Ex : Petit projet — collecte de déchets">
      </label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        ${donnee ? `<button type="button" class="ga-btn ga-btn-secondaire" id="plBtnEffacerCellule">🗑️ Effacer</button>` : ''}
        <button type="button" class="ga-btn ga-btn-secondaire" id="plBtnAnnulerCellule">Annuler</button>
        <button type="button" class="ga-btn ga-btn-primary" id="plBtnValiderTexte">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  overlay.querySelector('#plBtnAnnulerCellule').addEventListener('click', fermer);

  overlay.querySelectorAll('[data-choisir-seance]').forEach(item => {
    item.addEventListener('click', () => {
      const id = Number(item.dataset.choisirSeance);
      seanceChoisieId = seanceChoisieId === id ? null : id; // re-cliquer désélectionne
      overlay.querySelectorAll('.pl-item-candidat').forEach(el => {
        el.classList.toggle('pl-candidat-actif', Number(el.dataset.choisirSeance) === seanceChoisieId);
      });
    });
  });

  overlay.querySelector('#plBtnValiderTexte').addEventListener('click', async () => {
    const texte = overlay.querySelector('#plTexteLibreInput').value.trim();
    if (!seanceChoisieId && !texte) { alert('Sélectionnez une séance, saisissez un libellé personnalisé, ou les deux.'); return; }
    await enregistrerCellulePL(ligne, semaine, { seance_id: seanceChoisieId, texte_libre: texte || null });
    fermer();
  });

  const btnEffacer = overlay.querySelector('#plBtnEffacerCellule');
  if (btnEffacer) {
    btnEffacer.addEventListener('click', async () => {
      await supabaseClient.from('planification_cellules').delete().eq('id', donnee.id);
      delete cellulesParClePL[cleComplete];
      fermer();
      await chargerEtAfficherPlan();
    });
  }
}

async function enregistrerCellulePL(ligne, semaine, { seance_id, texte_libre }) {
  const [annee, mois] = moisPL.split('-').map(Number);
  const ligneDb = {
    classe_id: classeSelPL, champ_formation_id: ligne.champFormationId, ligne_cle: ligne.id,
    annee, mois, semaine, seance_id, texte_libre, cree_par: profilPL.id, modifie_le: new Date().toISOString()
  };
  const { error } = await supabaseClient.from('planification_cellules')
    .upsert(ligneDb, { onConflict: 'classe_id,champ_formation_id,ligne_cle,annee,mois,semaine' });
  if (error) { alert("Erreur d'enregistrement : " + error.message); return; }
  await chargerEtAfficherPlan();
}

async function toggleEvalSemainePL(semaine, coche) {
  const [annee, mois] = moisPL.split('-').map(Number);
  let liste = [...(parametresMoisPL.semaines_evaluation || [])];
  if (coche && !liste.includes(semaine)) liste.push(semaine);
  if (!coche) liste = liste.filter(s => s !== semaine);
  liste.sort((a, b) => a - b);

  const { error } = await supabaseClient.from('planification_parametres_mensuels')
    .upsert({ classe_id: classeSelPL, annee, mois, semaines_evaluation: liste }, { onConflict: 'classe_id,annee,mois' });
  if (error) { alert("Erreur d'enregistrement : " + error.message); return; }
  parametresMoisPL.semaines_evaluation = liste;
  document.getElementById('plTableWrap').innerHTML = html_tablePlan();
  wireCellulesEtSemainesPL();
}

// Recâble uniquement les cellules après un rafraîchissement partiel de la
// grille (toggleEvalSemainePL évite un rechargement réseau complet).
function wireCellulesEtSemainesPL() {
  document.querySelectorAll('.ga-plan-cell-vide, .ga-plan-seance-item, .ga-plan-texte-item').forEach(el => {
    el.addEventListener('click', () => ouvrirSelecteurCellulePL(el.dataset.ligne, Number(el.dataset.semaine)));
  });
  document.querySelectorAll('[data-generer-ligne]').forEach(btn => {
    btn.addEventListener('click', () => genererAutoPL(btn.dataset.genererLigne, btn));
  });
}

// ===========================================================================
// Génération automatique — 19 septembre 2026 : "Générer automatiquement" par
// ligne (classe + champ_formation + discipline/ligne_cle visible). Remplit
// UNIQUEMENT les semaines vides à venir (aucun texte_libre ni seance_id déjà
// présent) avec les prochaines séances publiées non encore utilisées ailleurs
// dans cette discipline (toute la logique de séquencement/anti-doublon vit
// côté SQL, fonction generer_planification_automatique, pour éviter toute
// course si l'enseignant clique deux fois vite). Une cellule déjà remplie
// (manuellement ou par une génération précédente) n'est jamais écrasée —
// l'option manuelle reste toujours disponible et prioritaire. Une fois
// posée, une cellule générée automatiquement est un enregistrement normal,
// modifiable/remplaçable comme n'importe quelle cellule manuelle (aucun état
// "verrouillé"/"auto" particulier).
async function genererAutoPL(ligneId, btnEl) {
  const ligne = PLAN_LIGNES.find(l => l.id === ligneId);
  if (!ligne || ligne.texteLibreSeulement) return;

  if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.5'; btnEl.style.cursor = 'wait'; }
  try {
    const [annee, mois] = moisPL.split('-').map(Number);
    const { data, error } = await supabaseClient.rpc('generer_planification_automatique', {
      p_classe_id: classeSelPL,
      p_champ_formation_id: ligne.champFormationId,
      p_ligne_cle: ligne.id,
      p_annee: annee,
      p_mois_debut: mois,
      p_disciplines: ligne.disciplines,
      p_discipline_prefix: !!ligne.disciplinePrefix
    });
    if (error) { alert('Erreur de génération automatique : ' + error.message); return; }
    if (!data || !data.length) {
      alert("Aucune semaine vide à venir n'a pu être planifiée automatiquement (semaines déjà remplies/congés/évaluations, ou plus aucune séance publiée disponible pour cette discipline).");
      return;
    }
    await chargerEtAfficherPlan();
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = ''; btnEl.style.cursor = ''; }
  }
}

// ===========================================================================
// Congés / fériés
// ===========================================================================

function ouvrirModalCalendrierPL(action) {
  const estFerie = action === 'ajouter-ferie';
  ouvrirModal({
    titre: estFerie ? 'Ajouter un jour férié' : 'Ajouter une période de congés',
    texteValider: 'Ajouter',
    champs: [
      { nom: 'libelle', label: 'Libellé', type: 'text', requis: true, valeur: estFerie ? '' : 'Congés' },
      { nom: 'dateDebut', label: 'Date de début', type: 'date', requis: true },
      { nom: 'dateFin', label: 'Date de fin', type: 'date', requis: true }
    ],
    onValider: async (valeurs) => {
      if (valeurs.dateFin < valeurs.dateDebut) { alert('La date de fin doit être après la date de début.'); return; }
      const { error } = await supabaseClient.from('evenements_calendrier_classe').insert({
        classe_id: classeSelPL, date_debut: valeurs.dateDebut, date_fin: valeurs.dateFin,
        type: estFerie ? 'ferie' : 'conge', libelle: valeurs.libelle, cree_par: profilPL.id
      });
      if (error) { alert('Erreur : ' + error.message); return; }
      await chargerEtAfficherPlan();
    }
  });
}

// ===========================================================================
// Export Word (.doc via data URI, même principe que l'export Excel du
// registre d'appel — aucun outil d'export préexistant sur ce projet).
// ===========================================================================

function exporterWordPlanPL() {
  const table = document.querySelector('#plTableWrap table');
  if (!table) return;
  const [annee, mois] = moisPL.split('-').map(Number);
  const libMois = new Date(moisPL + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const html = `<html><head><meta charset="utf-8"></head><body>
    <h2 style="text-align:center">Fiche de planification mensuelle — ${echapperPL(libMois)}</h2>
    <p>École : ${echapperPL(ecolePL)} — Enseignant(e) : ${echapperPL(profilPL.prenom)} ${echapperPL(profilPL.nom)}</p>
    ${table.outerHTML}
  </body></html>`;
  const lien = document.createElement('a');
  lien.href = 'data:application/msword;charset=utf-8,' + encodeURIComponent(html);
  lien.download = `Planification_${moisPL}.doc`;
  lien.click();
}
