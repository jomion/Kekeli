// Page pages/enseignant/registre-appel.html — Registre d'appel journalier +
// Bilan mensuel (G/F/T), 12 septembre 2026. Porté fidèlement des prototypes
// fournis (registre_ajour.html + Bilan_registre_garçon.html), avec vraies
// données Kekeli (classe/élèves réels de l'enseignant connecté via
// enseignants.classes_assignees — PAS le système d'abonnement parent utilisé
// par devoirs-notes) et sauvegarde réelle en base (presences_appel,
// registre_eleves_manuels, evenements_calendrier_classe).

let profilGA = null;
let classesGA = [];
let classeSelGA = null;
let ecoleGA = '';
let ongletGA = 'appel';
let moisAppelGA = '';
let rosterGA = [];           // élèves réels + manuels fusionnés, triés
let presencesParCleGA = {};  // `${eleveKey}|${date}|${creneau}` -> { id, absent, retard }
let evenementsGA = [];       // événements calendrier de la classe sélectionnée
let creneauActifGA = null;   // `${date}_${M|S}` du créneau réel en cours, ou null
let demiJoursMoisGA = 0;
let modeDeverrouilleGA = false; // 18 septembre 2026 : "ajoute le bouton de modification des sessions déjà dépassée"
let joursOuvresActuelsGA = []; // mémorisé pour ré-afficher sans recharger la base (bascule du mode déverrouillé)
let anneeAfficheeGA = null;
let mois0AfficheGA = null;

const MOIS_ANNEE_SCOLAIRE = [
  { m: 9, libelle: 'SEPT.' }, { m: 10, libelle: 'OCT.' }, { m: 11, libelle: 'NOV.' }, { m: 12, libelle: 'DEC.' },
  { m: 1, libelle: 'JAN.' }, { m: 2, libelle: 'FEV.' }, { m: 3, libelle: 'MARS' }, { m: 4, libelle: 'AVRIL' },
  { m: 5, libelle: 'MAI' }, { m: 6, libelle: 'JUIN' }
];

(async function () {
  profilGA = await requireRole('enseignant');
  if (!profilGA) return;
  await initEnteteNavigation({
    role: 'enseignant', utilisateurId: profilGA.id, badgeHtml: `🟢 ${echapperGA(profilGA.prenom)}`,
    liens: liensAvecPrefixe('enseignant', '')
  });

  const { data: ens } = await supabaseClient.from('enseignants').select('classes_assignees, ecole').eq('id', profilGA.id).single();
  const idsClasses = (ens?.classes_assignees || []).map(Number);
  ecoleGA = ens?.ecole || '';

  if (!idsClasses.length) {
    document.getElementById('contenu').innerHTML = `
      <div class="ga-carte"><h1>Aucune classe assignée</h1>
      <p>Une classe doit d'abord vous être attribuée par l'administration (voir « Enseignants &amp; classes ») avant de pouvoir tenir un registre.</p></div>`;
    return;
  }

  const { data: classes } = await supabaseClient.from('classes').select('id, nom').in('id', idsClasses).order('ordre');
  classesGA = classes || [];
  classeSelGA = classesGA[0]?.id;
  moisAppelGA = moisActuelISO();

  afficherEnteteGA();
  await rerenderOngletGA();
})();

function moisActuelISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function echapperGA(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// 18 septembre 2026 : "Verrouille les boutons de conversion en word, excel,
// pdf et ajoute le message bientôt disponible le temps que ça soit bien
// paramétré." — les boutons restent visibles mais leur action réelle est
// remplacée par ce message, jusqu'à nouvel ordre (retirer .ga-btn-verrouille
// et rebrancher le vrai gestionnaire de clic pour rouvrir chaque export).
function alerterExportVerrouilleGA() {
  alert('🔒 Cette fonctionnalité arrive bientôt — le temps qu\'elle soit bien paramétrée.');
}

function afficherEnteteGA() {
  document.getElementById('contenu').innerHTML = `
    <div class="ga-carte">
      <div class="ga-top-bar">
        <h1>📋 Registre d'appel</h1>
        <select id="gaSelectClasse" style="padding:8px;border-radius:8px;border:1px solid var(--bordure)">
          ${classesGA.map(c => `<option value="${c.id}">${echapperGA(c.nom)}</option>`).join('')}
        </select>
      </div>
      <div class="ga-onglets">
        <button type="button" class="ga-onglet ${ongletGA === 'appel' ? 'actif' : ''}" data-onglet="appel">Appel du jour</button>
        <button type="button" class="ga-onglet ${ongletGA === 'bilan' ? 'actif' : ''}" data-onglet="bilan">Bilan mensuel</button>
      </div>
      <div id="gaZone"><p style="color:var(--text-gris)">Chargement...</p></div>
    </div>`;

  document.getElementById('gaSelectClasse').addEventListener('change', async (e) => {
    classeSelGA = Number(e.target.value);
    await rerenderOngletGA();
  });

  document.querySelectorAll('.ga-onglet').forEach(btn => {
    btn.addEventListener('click', async () => {
      ongletGA = btn.dataset.onglet;
      document.querySelectorAll('.ga-onglet').forEach(b => b.classList.toggle('actif', b === btn));
      await rerenderOngletGA();
    });
  });
}

async function rerenderOngletGA() {
  if (ongletGA === 'appel') await chargerEtAfficherAppel();
  else await chargerEtAfficherBilan();
}

// ===========================================================================
// Onglet "Appel du jour"
// ===========================================================================

async function chargerRosterGA() {
  const [{ data: elevesReels }, { data: elevesManuels }] = await Promise.all([
    supabaseClient.from('eleves').select('id, profils(nom, prenom, sexe)').eq('classe_id', classeSelGA),
    supabaseClient.from('registre_eleves_manuels').select('id, nom, prenom, genre').eq('classe_id', classeSelGA).eq('actif', true)
  ]);

  const reels = (elevesReels || []).map(e => ({
    cle: 'r_' + e.id, type: 'reel', id: e.id,
    nom: e.profils?.nom || '(sans nom)', prenom: e.profils?.prenom || '', genre: e.profils?.sexe || 'M'
  }));
  const manuels = (elevesManuels || []).map(e => ({
    cle: 'm_' + e.id, type: 'manuel', id: e.id, nom: e.nom, prenom: e.prenom, genre: e.genre
  }));

  rosterGA = [...reels, ...manuels].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function getJoursOuvresGA(annee, mois0) {
  const jours = [];
  const noms = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  const d = new Date(annee, mois0, 1);
  while (d.getMonth() === mois0) {
    const jsem = d.getDay();
    if (jsem !== 0 && jsem !== 6) {
      jours.push({
        dateNum: d.getDate(), dayName: noms[jsem],
        isoDate: `${annee}-${String(mois0 + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return jours;
}

function evenementCouvrantDateGA(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return evenementsGA.find(ev => {
    if (ev.classe_id !== null && ev.classe_id !== classeSelGA) return false;
    return new Date(ev.date_debut + 'T00:00:00') <= d && d <= new Date(ev.date_fin + 'T00:00:00');
  });
}

function detecterCreneauActifGA(anneeAffichee, mois0Affiche) {
  const now = new Date();
  if (now.getFullYear() !== anneeAffichee || now.getMonth() !== mois0Affiche) return null;
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const creneau = now.getHours() < 12 ? 'M' : 'S';
  return `${iso}_${creneau}`;
}

// 18 septembre 2026 : "ajoute le bouton de modification des sessions déjà
// dépassée" — un créneau est "dépassé" s'il est strictement avant le créneau
// réel du moment (jour antérieur, ou matin du jour même une fois midi passé).
// Le créneau S du jour même n'est jamais "dépassé" par cette règle : avant
// midi il est simplement à venir (verrouillé normalement), après midi il est
// déjà le créneau ACTIF (couvert par creneauActifGA, pas par ce mode).
function estCreneauEcouleGA(isoDate, creneau) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (isoDate < todayIso) return true;
  if (isoDate > todayIso) return false;
  return creneau === 'M' && now.getHours() >= 12;
}

// Recentre horizontalement le tableau (scroll interne) sur la colonne du
// créneau actif — demande explicite : "Dès le chargement de la page de
// registre, présente la page sur la session en cours."
function scrollVersCreneauActifGA() {
  if (!creneauActifGA) return;
  const scrollDiv = document.querySelector('.ga-table-scroll');
  const cellule = document.querySelector('.ga-cellule-active');
  if (!scrollDiv || !cellule) return;
  const rectScroll = scrollDiv.getBoundingClientRect();
  const rectCellule = cellule.getBoundingClientRect();
  const decalage = scrollDiv.scrollLeft + (rectCellule.left - rectScroll.left) - scrollDiv.clientWidth / 2 + rectCellule.width / 2;
  scrollDiv.scrollLeft = Math.max(0, decalage);
}

async function chargerEtAfficherAppel() {
  const zone = document.getElementById('gaZone');
  zone.innerHTML = '<p style="color:var(--text-gris)">Chargement du registre...</p>';

  await chargerRosterGA();

  const [annee, mois] = moisAppelGA.split('-').map(Number);
  const joursOuvres = getJoursOuvresGA(annee, mois - 1);
  const premierJour = joursOuvres[0]?.isoDate;
  const dernierJour = joursOuvres[joursOuvres.length - 1]?.isoDate;

  const { data: evenements } = await supabaseClient.from('evenements_calendrier_classe')
    .select('classe_id, date_debut, date_fin, type, libelle')
    .lte('date_debut', dernierJour).gte('date_fin', premierJour)
    .or(`classe_id.eq.${classeSelGA},classe_id.is.null`);
  evenementsGA = evenements || [];

  const { data: presences } = await supabaseClient.from('presences_appel')
    .select('id, eleve_id, eleve_manuel_id, date_appel, creneau, absent, retard, justifiee, motif_justification')
    .eq('classe_id', classeSelGA).gte('date_appel', premierJour).lte('date_appel', dernierJour);

  presencesParCleGA = {};
  (presences || []).forEach(p => {
    const cle = p.eleve_id ? 'r_' + p.eleve_id : 'm_' + p.eleve_manuel_id;
    presencesParCleGA[`${cle}|${p.date_appel}|${p.creneau}`] = {
      id: p.id, absent: p.absent, retard: p.retard,
      justifiee: p.justifiee, motifJustification: p.motif_justification
    };
  });

  creneauActifGA = detecterCreneauActifGA(annee, mois - 1);

  let demiJours = 0;
  joursOuvres.forEach(j => {
    const ev = evenementCouvrantDateGA(j.isoDate);
    if (!ev) demiJours += (j.dayName === 'Me') ? 1 : 2;
  });
  demiJoursMoisGA = demiJours;

  joursOuvresActuelsGA = joursOuvres;
  anneeAfficheeGA = annee;
  mois0AfficheGA = mois - 1;

  zone.innerHTML = html_onglet_appel(joursOuvres);
  wireOngletAppel(joursOuvres, annee, mois - 1);
  recalculerStatsAppelGA(joursOuvres);
  scrollVersCreneauActifGA();
}

// Ré-affiche l'onglet "Appel du jour" avec les données déjà chargées (pas de
// nouvel aller-retour base) — utilisé uniquement par la bascule du bouton
// "Modifier une séance passée", pour rester instantané.
function reafficherAppelSansRechargerGA() {
  const zone = document.getElementById('gaZone');
  zone.innerHTML = html_onglet_appel(joursOuvresActuelsGA);
  wireOngletAppel(joursOuvresActuelsGA, anneeAfficheeGA, mois0AfficheGA);
  recalculerStatsAppelGA(joursOuvresActuelsGA);
  scrollVersCreneauActifGA();
}

function html_onglet_appel(joursOuvres) {
  const [libM] = [new Date(moisAppelGA + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })];
  return `
    <div class="ga-entete-grid">
      <div class="ga-champ"><label>Mois du registre</label><input type="month" id="gaSelectMois" value="${moisAppelGA}"></div>
      <div class="ga-champ"><label>Demi-jours de classe</label><span class="ga-valeur">${demiJoursMoisGA}</span></div>
      <div class="ga-champ"><label>École</label><span class="ga-valeur">${echapperGA(ecoleGA) || '—'}</span></div>
      <div class="ga-champ"><label>Titulaire</label><span class="ga-valeur">${echapperGA(profilGA.prenom)} ${echapperGA(profilGA.nom)}</span></div>
    </div>

    <div class="ga-top-bar">
      <span id="gaBadgeActif" class="ga-badge-active">Détection du créneau...</span>
      <div class="ga-actions">
        <button type="button" class="ga-btn ga-btn-secondaire" id="gaBtnAjouterEleve">➕ Ajouter un élève</button>
        <button type="button" class="ga-btn ${modeDeverrouilleGA ? 'ga-btn-notify' : 'ga-btn-secondaire'}" id="gaBtnDeverrouiller">${modeDeverrouilleGA ? '🔒 Verrouiller les séances passées' : '🔓 Modifier une séance passée'}</button>
        <button type="button" class="ga-btn ga-btn-notify" id="gaBtnNotifier">🔔 Valider &amp; Notifier</button>
        <button type="button" class="ga-btn ga-btn-excel ga-btn-verrouille" id="gaBtnExcel" title="Bientôt disponible">🔒 Excel</button>
        <button type="button" class="ga-btn ga-btn-pdf ga-btn-verrouille" id="gaBtnPdf" title="Bientôt disponible">🔒 PDF</button>
      </div>
    </div>

    <p style="font-size:0.82rem;color:var(--text-gris);margin-bottom:10px">
      📌 Cochez la case pour signaler l'absence sur le créneau en cours (seul le créneau réel du moment est modifiable). Cliquez sur une cellule active pour basculer le retard (fond jaune). « Jour chômé » grise une journée entière pour la classe.
      ${modeDeverrouilleGA ? '<br>🔓 Mode déverrouillé : les séances déjà passées sont aussi modifiables (aucune notification n\'est envoyée aux parents pour ces corrections rétroactives).' : ''}
    </p>

    <div class="ga-table-scroll">
      <table class="ga-table" id="gaTableAppel">
        <thead>
          <tr id="gaLigneJours">
            <th class="ga-col-sticky-1" rowspan="2">N°</th>
            <th class="ga-col-sticky-2" rowspan="2">Noms et prénoms</th>
            <th class="ga-col-sticky-3" rowspan="2">G/F</th>
          </tr>
          <tr id="gaLigneSlots"></tr>
        </thead>
        <tbody id="gaCorpsEleves"></tbody>
      </table>
    </div>

    <h3 style="margin-top:20px">📊 Statistiques du mois (Garçons / Filles / Total)</h3>
    <div style="overflow-x:auto">
      <table class="ga-stats-table" id="gaStatsTable">
        <thead><tr><th style="text-align:left">Indicateur</th><th>Garçons</th><th>Filles</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td style="text-align:left">Effectif</td><td id="gaStCountG">0</td><td id="gaStCountF">0</td><td id="gaStCountT">0</td></tr>
          <tr><td style="text-align:left">Présences possibles</td><td id="gaStPossG">0</td><td id="gaStPossF">0</td><td id="gaStPossT">0</td></tr>
          <tr style="background:#f0fdf4"><td style="text-align:left;color:var(--ga-success)">🟢 Présents à l'heure</td><td id="gaStOntimeG">0</td><td id="gaStOntimeF">0</td><td id="gaStOntimeT">0</td></tr>
          <tr style="background:#fffbeb"><td style="text-align:left;color:var(--ga-warning)">⏰ Retards</td><td id="gaStRetG">0</td><td id="gaStRetF">0</td><td id="gaStRetT">0</td></tr>
          <tr style="background:#fef2f2"><td style="text-align:left;color:var(--ga-danger)">🔴 Absences</td><td id="gaStAbsG">0</td><td id="gaStAbsF">0</td><td id="gaStAbsT">0</td></tr>
          <tr style="font-weight:bold;background:var(--bleu-clair,#F4F7F9)"><td style="text-align:left;color:var(--bleu-kekeli)">🔵 Taux de présence globale</td><td id="gaStPctG">0%</td><td id="gaStPctF">0%</td><td id="gaStPctT">0%</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function wireOngletAppel(joursOuvres, annee, mois0) {
  document.getElementById('gaSelectMois').addEventListener('change', async (e) => {
    moisAppelGA = e.target.value;
    await chargerEtAfficherAppel();
  });

  const badge = document.getElementById('gaBadgeActif');
  if (creneauActifGA) {
    const [iso, cr] = creneauActifGA.split('_');
    const [, mm, dd] = iso.split('-');
    badge.textContent = `📍 Session active : ${dd}/${mm} (${cr === 'M' ? 'Matin' : 'Après-midi'})`;
  } else {
    badge.textContent = `👁️ Mois consulté hors session active (lecture seule)`;
  }

  // En-têtes des jours
  const ligneJours = document.getElementById('gaLigneJours');
  const ligneSlots = document.getElementById('gaLigneSlots');
  joursOuvres.forEach((j, idx) => {
    const ev = evenementCouvrantDateGA(j.isoDate);
    const parite = idx % 2 === 0 ? 'ga-jour-pair' : 'ga-jour-impair';
    const th = document.createElement('th');
    th.className = `dyn-jour ${parite} ${ev ? 'ga-jour-off' : ''}`;
    th.colSpan = 2;
    th.innerHTML = `<div>${j.dayName} ${j.dateNum}</div>
      <button type="button" class="ga-btn-off" data-toggle-off="${j.isoDate}">${ev && ev.type === 'chome' ? 'Rétablir' : (ev ? ev.type : 'Jour chômé')}</button>`;
    ligneJours.appendChild(th);

    const thM = document.createElement('th'); thM.className = `dyn-jour ga-slot-m ${ev ? 'ga-jour-off' : ''}`; thM.textContent = 'M';
    const estMercredi = j.dayName === 'Me';
    const thS = document.createElement('th'); thS.className = `dyn-jour ga-slot-s ${(ev || estMercredi) ? 'ga-jour-off' : ''}`; thS.textContent = 'S';
    ligneSlots.appendChild(thM); ligneSlots.appendChild(thS);
  });

  document.querySelectorAll('[data-toggle-off]').forEach(btn => {
    btn.addEventListener('click', () => toggleJourChomeGA(btn.dataset.toggleOff));
  });

  // Corps du tableau
  const tbody = document.getElementById('gaCorpsEleves');
  tbody.innerHTML = rosterGA.map((el, idx) => html_ligneEleveGA(el, idx + 1, joursOuvres)).join('');

  tbody.querySelectorAll('.ga-case-att').forEach(cb => {
    cb.addEventListener('change', () => onChangeAbsenceGA(cb));
  });
  tbody.querySelectorAll('[data-justifier]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); ouvrirJustificationAbsenceGA(btn.closest('td')); });
  });
  tbody.querySelectorAll('.ga-cellule-active').forEach(td => {
    td.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT' && !e.target.closest('[data-justifier]')) toggleRetardGA(td); });
  });

  document.getElementById('gaBtnAjouterEleve').addEventListener('click', ouvrirModalAjoutEleveGA);
  document.getElementById('gaBtnDeverrouiller').addEventListener('click', () => {
    modeDeverrouilleGA = !modeDeverrouilleGA;
    reafficherAppelSansRechargerGA();
  });
  document.getElementById('gaBtnNotifier').addEventListener('click', validerEtNotifierGA);
  document.getElementById('gaBtnExcel').addEventListener('click', alerterExportVerrouilleGA);
  document.getElementById('gaBtnPdf').addEventListener('click', alerterExportVerrouilleGA);
}

function html_ligneEleveGA(el, numero, joursOuvres) {
  let cellulesJours = '';
  joursOuvres.forEach((j, idx) => {
    const ev = evenementCouvrantDateGA(j.isoDate);
    const estMercredi = j.dayName === 'Me';
    const parite = idx % 2 === 0 ? 'ga-jour-pair' : 'ga-jour-impair';

    ['M', 'S'].forEach(creneau => {
      const cleComplete = `${el.cle}|${j.isoDate}|${creneau}`;
      const donnee = presencesParCleGA[cleComplete] || { absent: false, retard: false };
      const desactive = !!ev || (creneau === 'S' && estMercredi);
      // "Modifier une séance passée" (18 septembre 2026) : en mode
      // déverrouillé, les créneaux déjà écoulés redeviennent modifiables en
      // plus du créneau réel du moment — silencieusement, sans notification
      // (validerEtNotifierGA reste la seule voie de notification et reste
      // gatée sur creneauActifGA, jamais appelée pour ces cellules-ci).
      const estCreneauReel = creneauActifGA === `${j.isoDate}_${creneau}`;
      const estActif = !desactive && (estCreneauReel || (modeDeverrouilleGA && estCreneauEcouleGA(j.isoDate, creneau)));
      const slotClass = creneau === 'M' ? 'ga-slot-m' : 'ga-slot-s';
      const symbole = donnee.absent ? (creneau === 'M' ? '-' : '|') : '';
      const classeRetard = donnee.retard ? 'ga-bg-retard-demi' : '';
      // Distinction visuelle : contour jaune vif pour le créneau réellement en
      // cours, contour discret gris pour un créneau passé rouvert via le
      // bouton "Modifier une séance passée" (pour ne jamais confondre les deux).
      const classeActive = estActif ? (estCreneauReel ? 'ga-cellule-active' : 'ga-cellule-active ga-cellule-active-passee') : '';

      // 18 septembre 2026 : "différencier les absences (absence simple,
      // absence justifiée comme malade ou autre raison)" — petit bouton
      // visible uniquement quand la case est cochée absente, pour ouvrir la
      // saisie du motif ; ❔ = simple (par défaut), 📩 = justifiée. Le clic
      // est intercepté avant le toggle de retard (voir wireOngletAppel).
      const boutonJustifier = donnee.absent
        ? `<button type="button" class="ga-btn-justifier" data-justifier ${!estActif ? 'disabled' : ''} title="${donnee.justifiee ? `Absence justifiée${donnee.motifJustification ? ' : ' + donnee.motifJustification : ''}` : 'Absence simple — cliquer pour justifier'}">${donnee.justifiee ? '📩' : '❔'}</button>`
        : '';

      cellulesJours += `<td class="${parite} ${slotClass} ${desactive ? 'ga-jour-off' : ''} ${classeActive} ${classeRetard}"
          data-cle="${el.cle}" data-date="${j.isoDate}" data-creneau="${creneau}" data-type="${el.type}" data-id="${el.id}">
        <input type="checkbox" class="ga-case-att" ${donnee.absent ? 'checked' : ''} ${!estActif ? 'disabled' : ''}>
        <span class="ga-symbole">${symbole}</span>
        ${boutonJustifier}
      </td>`;
    });
  });

  const stats = calculerStatsEleveGA(el, joursOuvres);
  return `<tr data-genre="${el.genre}" data-cle-eleve="${el.cle}">
    <td class="ga-col-sticky-1">${numero}</td>
    <td class="ga-col-sticky-2">${echapperGA(el.nom)} ${echapperGA(el.prenom)}${el.type === 'manuel' ? '<span class="ga-manuel-tag">(ajout manuel)</span>' : ''}</td>
    <td class="ga-col-sticky-3">${el.genre === 'M' ? 'G' : 'F'}</td>
    ${cellulesJours}
  </tr>`;
}

function calculerStatsEleveGA(el, joursOuvres) {
  let abs = 0, ret = 0;
  joursOuvres.forEach(j => {
    const ev = evenementCouvrantDateGA(j.isoDate);
    if (ev) return;
    ['M', 'S'].forEach(creneau => {
      if (creneau === 'S' && j.dayName === 'Me') return;
      const d = presencesParCleGA[`${el.cle}|${j.isoDate}|${creneau}`];
      if (d?.absent) abs++;
      if (d?.retard) ret++;
    });
  });
  return { abs, ret, eff: Math.max(0, demiJoursMoisGA - abs) };
}

function recalculerStatsAppelGA(joursOuvres) {
  let countG = 0, countF = 0, absG = 0, absF = 0, retG = 0, retF = 0;
  rosterGA.forEach(el => {
    const s = calculerStatsEleveGA(el, joursOuvres);
    if (el.genre === 'M') { countG++; absG += s.abs; retG += s.ret; }
    else { countF++; absF += s.abs; retF += s.ret; }
  });
  const countT = countG + countF;
  const possG = countG * demiJoursMoisGA, possF = countF * demiJoursMoisGA, possT = possG + possF;
  const absT = absG + absF, retT = retG + retF;
  const effG = possG - absG, effF = possF - absF, effT = possT - absT;
  const onG = effG - retG, onF = effF - retF, onT = effT - retT;
  const pct = (v, max) => max > 0 ? ((v / max) * 100).toFixed(1) + '%' : '0%';

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gaStCountG', countG); set('gaStCountF', countF); set('gaStCountT', countT);
  set('gaStPossG', possG); set('gaStPossF', possF); set('gaStPossT', possT);
  set('gaStOntimeG', onG); set('gaStOntimeF', onF); set('gaStOntimeT', onT);
  set('gaStRetG', retG); set('gaStRetF', retF); set('gaStRetT', retT);
  set('gaStAbsG', absG); set('gaStAbsF', absF); set('gaStAbsT', absT);
  set('gaStPctG', pct(onG, possG)); set('gaStPctF', pct(onF, possF)); set('gaStPctT', pct(onT, possT));
}

async function toggleJourChomeGA(isoDate) {
  const evExistant = evenementCouvrantDateGA(isoDate);
  if (evExistant && evExistant.type === 'chome' && evExistant.classe_id === classeSelGA) {
    await supabaseClient.from('evenements_calendrier_classe').delete()
      .eq('classe_id', classeSelGA).eq('date_debut', isoDate).eq('date_fin', isoDate).eq('type', 'chome');
  } else if (!evExistant) {
    await supabaseClient.from('evenements_calendrier_classe').insert({
      classe_id: classeSelGA, date_debut: isoDate, date_fin: isoDate, type: 'chome',
      libelle: 'Jour chômé', cree_par: profilGA.id
    });
  } else {
    return; // événement école-entière (férié/congé) : pas modifiable depuis le registre
  }
  await chargerEtAfficherAppel();
}

async function onChangeAbsenceGA(cb) {
  const td = cb.closest('td');
  const { cle, date, creneau, type, id } = td.dataset;
  const absent = cb.checked;
  const cleComplete = `${cle}|${date}|${creneau}`;
  const donneePrecedente = presencesParCleGA[cleComplete] || { retard: false, justifiee: false, motifJustification: null };
  // Décocher l'absence efface aussi sa justification (elle n'a plus de sens
  // sans absence) — 18 septembre 2026.
  const justifiee = absent ? (donneePrecedente.justifiee || false) : false;
  const motifJustification = absent ? (donneePrecedente.motifJustification || null) : null;

  const ligne = {
    classe_id: classeSelGA, date_appel: date, creneau, absent, retard: donneePrecedente.retard,
    justifiee, motif_justification: motifJustification,
    saisi_par: profilGA.id, modifie_le: new Date().toISOString()
  };
  if (type === 'reel') { ligne.eleve_id = id; }
  else { ligne.eleve_manuel_id = Number(id); }

  const conflit = type === 'reel' ? 'classe_id,eleve_id,date_appel,creneau' : 'classe_id,eleve_manuel_id,date_appel,creneau';
  const { data, error } = await supabaseClient.from('presences_appel').upsert(ligne, { onConflict: conflit }).select('id').single();
  if (error) { alert('Erreur d\'enregistrement : ' + error.message); cb.checked = !absent; return; }

  presencesParCleGA[cleComplete] = { id: data.id, absent, retard: donneePrecedente.retard, justifiee, motifJustification };
  td.querySelector('.ga-symbole').textContent = absent ? (creneau === 'M' ? '-' : '|') : '';
  const boutonExistant = td.querySelector('[data-justifier]');
  if (boutonExistant) boutonExistant.remove();
  if (absent) {
    td.insertAdjacentHTML('beforeend', `<button type="button" class="ga-btn-justifier" data-justifier title="Absence simple — cliquer pour justifier">❔</button>`);
    td.querySelector('[data-justifier]').addEventListener('click', (e) => { e.stopPropagation(); ouvrirJustificationAbsenceGA(td); });
  }

  const [annee, mois] = moisAppelGA.split('-').map(Number);
  recalculerStatsAppelGA(getJoursOuvresGA(annee, mois - 1));
}

async function toggleRetardGA(td) {
  if (td.classList.contains('ga-jour-off')) return;
  const { cle, date, creneau, type, id } = td.dataset;
  const cleComplete = `${cle}|${date}|${creneau}`;
  const donneePrecedente = presencesParCleGA[cleComplete] || { absent: false, retard: false };
  const nouveauRetard = !donneePrecedente.retard;

  const ligne = {
    classe_id: classeSelGA, date_appel: date, creneau, absent: donneePrecedente.absent, retard: nouveauRetard,
    saisi_par: profilGA.id, modifie_le: new Date().toISOString()
  };
  if (type === 'reel') { ligne.eleve_id = id; } else { ligne.eleve_manuel_id = Number(id); }
  const conflit = type === 'reel' ? 'classe_id,eleve_id,date_appel,creneau' : 'classe_id,eleve_manuel_id,date_appel,creneau';
  const { data, error } = await supabaseClient.from('presences_appel').upsert(ligne, { onConflict: conflit }).select('id').single();
  if (error) { alert('Erreur d\'enregistrement : ' + error.message); return; }

  presencesParCleGA[cleComplete] = { id: data.id, absent: donneePrecedente.absent, retard: nouveauRetard };
  td.classList.toggle('ga-bg-retard-demi', nouveauRetard);

  const [annee, mois] = moisAppelGA.split('-').map(Number);
  recalculerStatsAppelGA(getJoursOuvresGA(annee, mois - 1));
}

// 18 septembre 2026 : "Ajoute une option pour différencier les absences
// (absence simple, absence justifiées comme malade ou autre raison)" —
// modal de saisie du motif, déclenché par le petit bouton ❔/📩 posé sur
// chaque cellule marquée absente (voir html_ligneEleveGA/onChangeAbsenceGA).
function ouvrirJustificationAbsenceGA(td) {
  const { cle, date, creneau, type, id } = td.dataset;
  const cleComplete = `${cle}|${date}|${creneau}`;
  const donnee = presencesParCleGA[cleComplete];
  if (!donnee || !donnee.absent) return;

  ouvrirModal({
    titre: 'Type d\'absence',
    texteValider: 'Enregistrer',
    champs: [
      {
        nom: 'justifiee', label: 'Nature de l\'absence', type: 'select',
        options: [{ valeur: 'non', label: 'Absence simple' }, { valeur: 'oui', label: 'Absence justifiée (maladie, autre motif...)' }],
        valeur: donnee.justifiee ? 'oui' : 'non'
      },
      { nom: 'motif', label: 'Motif (si justifiée)', type: 'text', requis: false, valeur: donnee.motifJustification || '' }
    ],
    onValider: async ({ justifiee: choix, motif }) => {
      const justifiee = choix === 'oui';
      const motifFinal = justifiee ? (motif || null) : null;
      const ligne = {
        classe_id: classeSelGA, date_appel: date, creneau, absent: true, retard: donnee.retard,
        justifiee, motif_justification: motifFinal,
        saisi_par: profilGA.id, modifie_le: new Date().toISOString()
      };
      if (type === 'reel') { ligne.eleve_id = id; } else { ligne.eleve_manuel_id = Number(id); }
      const conflit = type === 'reel' ? 'classe_id,eleve_id,date_appel,creneau' : 'classe_id,eleve_manuel_id,date_appel,creneau';
      const { data, error } = await supabaseClient.from('presences_appel').upsert(ligne, { onConflict: conflit }).select('id').single();
      if (error) { alert('Erreur d\'enregistrement : ' + error.message); return; }

      presencesParCleGA[cleComplete] = { id: data.id, absent: true, retard: donnee.retard, justifiee, motifJustification: motifFinal };
      const bouton = td.querySelector('[data-justifier]');
      if (bouton) {
        bouton.textContent = justifiee ? '📩' : '❔';
        bouton.title = justifiee ? `Absence justifiée${motifFinal ? ' : ' + motifFinal : ''}` : 'Absence simple — cliquer pour justifier';
      }
    }
  });
}

function ouvrirModalAjoutEleveGA() {
  ouvrirModal({
    titre: 'Ajouter un élève au registre',
    texteValider: 'Ajouter',
    champs: [
      { nom: 'nom', label: 'Nom', type: 'text', requis: true },
      { nom: 'prenom', label: 'Prénom', type: 'text', requis: true },
      { nom: 'genre', label: 'Genre', type: 'select', requis: true, options: [{ valeur: 'M', label: 'Garçon' }, { valeur: 'F', label: 'Fille' }] }
    ],
    onValider: async (valeurs) => {
      const { error } = await supabaseClient.from('registre_eleves_manuels').insert({
        classe_id: classeSelGA, enseignant_id: profilGA.id,
        nom: valeurs.nom.trim().toUpperCase(), prenom: valeurs.prenom.trim(), genre: valeurs.genre
      });
      if (error) { alert('Erreur : ' + error.message); return; }
      await chargerEtAfficherAppel();
    }
  });
}

async function validerEtNotifierGA() {
  if (!creneauActifGA) {
    alert('Aucun créneau actif en ce moment pour ce mois — rien à valider.');
    return;
  }
  const [iso, creneau] = creneauActifGA.split('_');
  const absentsReels = [], absentsManuels = [], retardsReels = [];

  rosterGA.forEach(el => {
    const d = presencesParCleGA[`${el.cle}|${iso}|${creneau}`];
    if (!d) return;
    if (d.absent) { (el.type === 'reel' ? absentsReels : absentsManuels).push(`${el.nom} ${el.prenom}`); }
    if (d.retard && el.type === 'reel') retardsReels.push(`${el.nom} ${el.prenom}`);
  });

  if (!absentsReels.length && !absentsManuels.length && !retardsReels.length) {
    alert(`✅ Session [${iso} ${creneau === 'M' ? 'matin' : 'après-midi'}] validée.\nAucune absence ni retard.`);
    return;
  }

  let msg = `📲 Session [${iso} ${creneau === 'M' ? 'matin' : 'après-midi'}] validée.\n\n`;
  msg += `Les parents des élèves inscrits sur la plateforme reçoivent une notification automatiquement dès qu'une absence ou un retard est enregistré.\n`;
  if (absentsReels.length) msg += `\n❌ ABSENTS notifiés (${absentsReels.length}) :\n- ${absentsReels.join('\n- ')}`;
  if (retardsReels.length) msg += `\n\n⏰ RETARDS notifiés (${retardsReels.length}) :\n- ${retardsReels.join('\n- ')}`;
  if (absentsManuels.length) msg += `\n\n⚠️ Absents SANS notification possible (élèves ajoutés manuellement, pas de compte) :\n- ${absentsManuels.join('\n- ')}`;
  alert(msg);
}

function exporterExcelAppelGA(joursOuvres) {
  let html = `<table border="1" style="border-collapse:collapse;text-align:center;"><thead><tr>`;
  html += `<th rowspan="2">N°</th><th rowspan="2">Noms et prénoms</th><th rowspan="2">G/F</th>`;
  joursOuvres.forEach(j => { html += `<th colspan="2">${j.dayName} ${j.dateNum}</th>`; });
  html += `<th rowspan="2">Poss.</th><th rowspan="2">Abs.</th><th rowspan="2">Ret.</th><th rowspan="2">Eff.</th></tr><tr>`;
  joursOuvres.forEach(() => { html += `<th>M</th><th>S</th>`; });
  html += `</tr></thead><tbody>`;

  rosterGA.forEach((el, idx) => {
    html += `<tr><td>${idx + 1}</td><td style="text-align:left">${echapperGA(el.nom)} ${echapperGA(el.prenom)}</td><td>${el.genre === 'M' ? 'G' : 'F'}</td>`;
    joursOuvres.forEach(j => {
      const ev = evenementCouvrantDateGA(j.isoDate);
      const dM = presencesParCleGA[`${el.cle}|${j.isoDate}|M`];
      const dS = presencesParCleGA[`${el.cle}|${j.isoDate}|S`];
      if (ev) { html += `<td colspan="2" style="background:#e2e8f0;">${ev.type === 'chome' ? 'Chômé' : ev.type === 'ferie' ? 'Férié' : 'Congés'}</td>`; }
      else if (dM?.absent && dS?.absent) {
        const style = (dM.retard || dS.retard) ? 'background:#fed7aa;color:#d97706;font-weight:bold;' : 'background:#fef2f2;color:#ef4444;font-weight:bold;';
        html += `<td colspan="2" style="${style}">+</td>`;
      } else {
        const estMercredi = j.dayName === 'Me';
        html += `<td style="${dM?.retard ? 'background:#fef08a;' : ''}">${dM?.absent ? '-' : ''}</td>`;
        html += `<td style="${estMercredi ? 'background:#e2e8f0;' : (dS?.retard ? 'background:#fef08a;' : '')}">${(!estMercredi && dS?.absent) ? '|' : ''}</td>`;
      }
    });
    const s = calculerStatsEleveGA(el, joursOuvres);
    html += `<td>${demiJoursMoisGA}</td><td>${s.abs}</td><td>${s.ret}</td><td>${s.eff}</td></tr>`;
  });
  html += `</tbody></table>`;

  const lien = document.createElement('a');
  lien.href = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(html);
  lien.download = `Registre_Appel_${moisAppelGA}.xls`;
  lien.click();
}

// ===========================================================================
// Onglet "Bilan mensuel" (G/F/T) — calculé depuis les vraies présences.
// ===========================================================================

async function chargerEtAfficherBilan() {
  const zone = document.getElementById('gaZone');
  zone.innerHTML = '<p style="color:var(--text-gris)">Calcul du bilan...</p>';

  await chargerRosterGA();

  const donneesParMois = {};
  for (const mInfo of MOIS_ANNEE_SCOLAIRE) {
    donneesParMois[mInfo.libelle] = await calculerBilanMoisGA(mInfo.m);
  }

  zone.innerHTML = html_onglet_bilan(donneesParMois);
  document.getElementById('gaBtnExcelBilan').addEventListener('click', alerterExportVerrouilleGA);
  document.getElementById('gaBtnPdfBilan').addEventListener('click', alerterExportVerrouilleGA);
}

function anneeScolairePourMoisGA(mois) {
  // L'année scolaire est celle en cours (septembre N -> juin N+1) ; on prend
  // l'année scolaire dont fait partie le mois calendaire "aujourd'hui".
  const now = new Date();
  const anneeDebut = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // >= septembre
  return mois >= 9 ? anneeDebut : anneeDebut + 1;
}

async function calculerBilanMoisGA(mois) {
  const annee = anneeScolairePourMoisGA(mois);
  const joursOuvres = getJoursOuvresGA(annee, mois - 1);
  if (!joursOuvres.length) return null;
  const premierJour = joursOuvres[0].isoDate, dernierJour = joursOuvres[joursOuvres.length - 1].isoDate;

  const { data: evenements } = await supabaseClient.from('evenements_calendrier_classe')
    .select('classe_id, date_debut, date_fin, type')
    .lte('date_debut', dernierJour).gte('date_fin', premierJour)
    .or(`classe_id.eq.${classeSelGA},classe_id.is.null`);
  const evsMois = evenements || [];
  const evCouvrant = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return evsMois.find(ev => (ev.classe_id === null || ev.classe_id === classeSelGA) && new Date(ev.date_debut + 'T00:00:00') <= d && d <= new Date(ev.date_fin + 'T00:00:00'));
  };

  let demiJours = 0;
  joursOuvres.forEach(j => { if (!evCouvrant(j.isoDate)) demiJours += (j.dayName === 'Me') ? 1 : 2; });

  const { data: presences } = await supabaseClient.from('presences_appel')
    .select('eleve_id, eleve_manuel_id, date_appel, creneau, absent, retard')
    .eq('classe_id', classeSelGA).gte('date_appel', premierJour).lte('date_appel', dernierJour);

  const absParEleve = {};
  (presences || []).forEach(p => {
    if (!p.absent) return;
    const cle = p.eleve_id ? 'r_' + p.eleve_id : 'm_' + p.eleve_manuel_id;
    absParEleve[cle] = (absParEleve[cle] || 0) + 1;
  });

  let effG = 0, effF = 0, absG = 0, absF = 0, j4G = 0, j4F = 0, p4G = 0, p4F = 0, acolG = 0, acolF = 0;
  rosterGA.forEach(el => {
    if (el.genre === 'M') effG++; else effF++;
    const abs = absParEleve[el.cle] || 0;
    if (el.genre === 'M') absG += abs; else absF += abs;
    if (abs <= 4) { if (el.genre === 'M') j4G++; else j4F++; }
    else { if (el.genre === 'M') { p4G++; acolG += abs; } else { p4F++; acolF += abs; } }
  });

  return { demiJours, effG, effF, absG, absF, j4G, j4F, p4G, p4F, acolG, acolF };
}

function html_onglet_bilan(donneesParMois) {
  let totDJ = 0, totEffG = 0, totEffF = 0, totPosG = 0, totPosF = 0, totAbsG = 0, totAbsF = 0, totEfcG = 0, totEfcF = 0;
  let totJ4G = 0, totJ4F = 0, totP4G = 0, totP4F = 0, totAcolG = 0, totAcolF = 0;

  const lignes = MOIS_ANNEE_SCOLAIRE.map(mInfo => {
    const d = donneesParMois[mInfo.libelle];
    if (!d) return `<tr class="ga-recap-mois"><td>${mInfo.libelle}</td><td colspan="23">—</td></tr>`;

    const effT = d.effG + d.effF;
    const posG = d.demiJours * d.effG, posF = d.demiJours * d.effF, posT = posG + posF;
    const absT = d.absG + d.absF;
    const efcG = Math.max(0, posG - d.absG), efcF = Math.max(0, posF - d.absF), efcT = efcG + efcF;
    const pctG = posG > 0 ? ((efcG / posG) * 100).toFixed(1) + '%' : '-';
    const pctF = posF > 0 ? ((efcF / posF) * 100).toFixed(1) + '%' : '-';
    const pctT = posT > 0 ? ((efcT / posT) * 100).toFixed(1) + '%' : '-';

    totDJ += d.demiJours; totEffG += d.effG; totEffF += d.effF;
    totPosG += posG; totPosF += posF; totAbsG += d.absG; totAbsF += d.absF;
    totEfcG += efcG; totEfcF += efcF;
    totJ4G += d.j4G; totJ4F += d.j4F; totP4G += d.p4G; totP4F += d.p4F; totAcolG += d.acolG; totAcolF += d.acolF;

    return `<tr>
      <td class="ga-recap-mois">${mInfo.libelle}</td><td>${d.demiJours}</td>
      <td>${d.effG || '-'}</td><td>${d.effF || '-'}</td><td class="ga-th-t">${effT || '-'}</td>
      <td>${posG || '-'}</td><td>${posF || '-'}</td><td class="ga-th-t">${posT || '-'}</td>
      <td>${d.absG || '-'}</td><td>${d.absF || '-'}</td><td class="ga-th-t">${absT || '-'}</td>
      <td>${efcG || '-'}</td><td>${efcF || '-'}</td><td class="ga-th-t">${efcT || '-'}</td>
      <td>${pctG}</td><td>${pctF}</td><td class="ga-th-t" style="font-weight:700">${pctT}</td>
      <td>${d.j4G || '-'}</td><td>${d.j4F || '-'}</td><td class="ga-th-t">${d.j4G + d.j4F || '-'}</td>
      <td>${d.p4G || '-'}</td><td>${d.p4F || '-'}</td><td class="ga-th-t">${d.p4G + d.p4F || '-'}</td>
      <td>${d.acolG || '-'}</td><td>${d.acolF || '-'}</td><td class="ga-th-t">${d.acolG + d.acolF || '-'}</td>
    </tr>`;
  }).join('');

  const totEffT = totEffG + totEffF, totPosT = totPosG + totPosF, totAbsT = totAbsG + totAbsF, totEfcT = totEfcG + totEfcF;
  const pG = totPosG > 0 ? ((totEfcG / totPosG) * 100).toFixed(2) : '0.00';
  const pF = totPosF > 0 ? ((totEfcF / totPosF) * 100).toFixed(2) : '0.00';
  const pT = totPosT > 0 ? ((totEfcT / totPosT) * 100).toFixed(2) : '0.00';

  return `
    <div class="ga-top-bar">
      <h2>Bilan mensuel par genre (G / F / T) — année scolaire</h2>
      <div class="ga-actions">
        <button type="button" class="ga-btn ga-btn-excel ga-btn-verrouille" id="gaBtnExcelBilan" title="Bientôt disponible">🔒 Excel</button>
        <button type="button" class="ga-btn ga-btn-pdf ga-btn-verrouille" id="gaBtnPdfBilan" title="Bientôt disponible">🔒 PDF</button>
      </div>
    </div>
    <div class="ga-table-scroll">
      <table class="ga-recap-table">
        <thead>
          <tr>
            <th rowspan="2" style="width:50px">MOIS</th><th rowspan="2" style="width:50px">Demi-j.</th>
            <th colspan="3">Effectif ayant fréquenté</th><th colspan="3">Présences possibles</th>
            <th colspan="3">Absences</th><th colspan="3">Présences effectives</th><th colspan="3">% présence</th>
            <th colspan="3">≤ 4 abs.</th><th colspan="3">&gt; 4 abs.</th><th colspan="3">Abs. des élèves &gt; 4</th>
          </tr>
          <tr>
            ${'<th class="ga-recap-sub ga-th-g">G</th><th class="ga-recap-sub ga-th-f">F</th><th class="ga-recap-sub ga-th-t">T</th>'.repeat(8)}
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
        <tfoot>
          <tr class="ga-recap-total">
            <td>TOTAL</td><td>${totDJ}</td>
            <td>${totEffG}</td><td>${totEffF}</td><td>${totEffT}</td>
            <td>${totPosG}</td><td>${totPosF}</td><td>${totPosT}</td>
            <td>${totAbsG}</td><td>${totAbsF}</td><td>${totAbsT}</td>
            <td>${totEfcG}</td><td>${totEfcF}</td><td>${totEfcT}</td>
            <td>${pG}%</td><td>${pF}%</td><td>${pT}%</td>
            <td>${totJ4G}</td><td>${totJ4F}</td><td>${totJ4G + totJ4F}</td>
            <td>${totP4G}</td><td>${totP4F}</td><td>${totP4G + totP4F}</td>
            <td>${totAcolG}</td><td>${totAcolF}</td><td>${totAcolG + totAcolF}</td>
          </tr>
          <tr class="ga-recap-moyenne">
            <td colspan="14" style="text-align:right;padding-right:10px">MOYENNE GÉNÉRALE DU TAUX DE PRÉSENCE :</td>
            <td>${pG}%</td><td>${pF}%</td><td>${pT}%</td><td colspan="10"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function exporterExcelBilanGA(donneesParMois) {
  const table = document.querySelector('.ga-recap-table');
  const html = encodeURIComponent(table.outerHTML);
  const lien = document.createElement('a');
  lien.href = 'data:application/vnd.ms-excel;charset=utf-8,' + html;
  lien.download = `Bilan_Mensuel_GFT.xls`;
  lien.click();
}
