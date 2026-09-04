// Page pages/admin/gestion-seances.html
// Anciennement une section du tableau de bord admin (recherche/filtres +
// liste de toutes les séances groupées par matière, avec accès direct à
// l'éditeur) — déplacée dans sa propre page pour que le tableau de bord ne
// garde que les tâches à surveiller et les raccourcis vers les autres pages
// admin. Toute la logique ci-dessous est reprise telle quelle de
// js/pages/admin-tableau-de-bord.js (mêmes noms de fonctions, suffixe -TB
// conservé pour limiter le risque de régression lors du déplacement).

let profilAdminGS = null;
let classesGS = [];
let champsGS = [];
let seancesGS = [];
const filtresGS = { matiere: '', classe: '', statut: '', recherche: '', unite: '', semaine: '', dossier: '', sa: '' };

const LIBELLES_STATUT_GS = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

async function init() {
  profilAdminGS = await requireAdmin();
  if (!profilAdminGS) return;

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdminGS.id,
    badgeHtml: `${profilAdminGS.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapperGS(profilAdminGS.prenom)}`,
    liens: liensAvecPrefixe('admin', '', { superAdmin: profilAdminGS.est_super_admin })
  });

  const [
    { data: classes }, { data: champs }, { data: noeuds }, { data: sa }, { data: seances }
  ] = await Promise.all([
    supabaseClient.from('classes').select('id, nom, ordre').order('ordre'),
    supabaseClient.from('champs_formation').select('id, nom, code, actif').eq('actif', true).order('nom'),
    supabaseClient.from('noeuds_parcours').select('id, classe_id, champ_formation_id, parent_id, type_noeud, titre'),
    supabaseClient.from('sa').select('id, noeud_id, titre, numero'),
    supabaseClient.from('seances').select('id, sa_id, titre, statut, discipline, titre_contenu, ordre, modifie_le').order('modifie_le', { ascending: false })
  ]);

  classesGS = classes || [];
  champsGS = champs || [];

  // Petites tables (quelques dizaines de lignes au total) : on résout les
  // rattachements côté client plutôt que d'imbriquer des jointures PostgREST
  // à 3 niveaux (séance → SA → noeud → classe/matière), ce qui reste rapide
  // et évite les soucis d'ambiguïté de clés étrangères multiples sur un même
  // noeud (classe_id ET champ_formation_id).
  const noeudParId = new Map((noeuds || []).map(n => [n.id, n]));
  const saParId = new Map((sa || []).map(s => [s.id, s]));
  const classeParId = new Map(classesGS.map(c => [c.id, c]));
  const champParId = new Map(champsGS.map(c => [c.id, c]));

  seancesGS = (seances || []).map(s => {
    const saInfo = saParId.get(s.sa_id) || null;
    const noeud = saInfo ? noeudParId.get(saInfo.noeud_id) : null;
    const chemin = saInfo ? remonterCheminHierarchiqueGS(saInfo.noeud_id, noeudParId) : { unite: null, semaine: null, dossier: null };
    // Chemin complet (Thème › Unité › ... › SA), même principe que la page
    // "Séances" partagée (pages/seances.html) — pour retrouver une séance
    // sans avoir à deviner sa place dans l'arborescence depuis cette liste.
    const cheminTitres = saInfo
      ? [...cheminTitresNoeudGS(saInfo.noeud_id, noeudParId), `${saInfo.numero ? 'SA' + saInfo.numero + ' — ' : ''}${saInfo.titre}`]
      : [];
    return {
      ...s,
      saInfo,
      classe: noeud ? classeParId.get(noeud.classe_id) || null : null,
      champ: noeud ? champParId.get(noeud.champ_formation_id) || null : null,
      unite: chemin.unite, semaine: chemin.semaine, dossier: chemin.dossier,
      cheminTitres
    };
  });

  afficherFiltres();
  rendreSeances();
}

// Remonte la chaîne de parent_id d'un noeud (celui qui porte la SA d'une
// séance) pour retrouver ses ancêtres "Unité", "Semaine" et "Dossier", quel
// que soit le nombre de niveaux entre eux (ex: Thème > Unité > Semaine pour
// le français). Sert à filtrer/regrouper les séances sans avoir à connaître
// à l'avance la profondeur exacte de la hiérarchie de chaque matière.
// Chemin des titres d'un noeud en remontant sa chaîne de parent_id (ex:
// ["Thème 1", "Unité 3"]) — même logique que cheminTitresNoeudSea de
// js/pages/seances.js, dupliquée ici car les deux pages ne partagent pas de
// module commun.
function cheminTitresNoeudGS(noeudId, noeudParId, garde) {
  garde = garde || 0;
  const n = noeudParId.get(noeudId);
  if (!n || garde > 30) return [];
  const chemin = n.parent_id ? cheminTitresNoeudGS(n.parent_id, noeudParId, garde + 1) : [];
  return [...chemin, n.titre];
}

function remonterCheminHierarchiqueGS(noeudId, noeudParId) {
  const chemin = { unite: null, semaine: null, dossier: null };
  let n = noeudParId.get(noeudId);
  let garde = 0; // filet de sécurité si une chaîne de parent_id bouclait par erreur
  while (n && garde++ < 30) {
    if (n.type_noeud === 'unite' && !chemin.unite) chemin.unite = n;
    if (n.type_noeud === 'semaine' && !chemin.semaine) chemin.semaine = n;
    if (n.type_noeud === 'dossier' && !chemin.dossier) chemin.dossier = n;
    n = n.parent_id ? noeudParId.get(n.parent_id) : null;
  }
  return chemin;
}

function afficherFiltres() {
  document.getElementById('zoneFiltres').innerHTML = `
    <input type="search" id="rechercheSeanceGS" placeholder="🔎 Rechercher une séance par titre...">
    <select id="filtreMatiereGS">
      <option value="">Toutes les matières</option>
      ${champsGS.map(c => `<option value="${c.id}">${echapperGS(c.nom)}</option>`).join('')}
    </select>
    <select id="filtreClasseGS">
      <option value="">Toutes les classes</option>
      ${classesGS.map(c => `<option value="${c.id}">${echapperGS(c.nom)}</option>`).join('')}
    </select>
    <select id="filtreStatutGS">
      <option value="">Tous les statuts</option>
      <option value="brouillon">Brouillon</option>
      <option value="publie">Publié</option>
      <option value="archive">Archivé</option>
    </select>
    <span id="zoneFiltresHierarchiquesGS" style="display:contents"></span>
  `;
  document.getElementById('rechercheSeanceGS').addEventListener('input', (e) => {
    filtresGS.recherche = e.target.value.trim().toLowerCase();
    rendreSeances();
  });
  document.getElementById('filtreMatiereGS').addEventListener('change', (e) => {
    filtresGS.matiere = e.target.value;
    filtresGS.unite = ''; filtresGS.semaine = ''; filtresGS.dossier = ''; filtresGS.sa = '';
    afficherFiltresHierarchiques();
    rendreSeances();
  });
  document.getElementById('filtreClasseGS').addEventListener('change', (e) => {
    filtresGS.classe = e.target.value;
    filtresGS.unite = ''; filtresGS.semaine = ''; filtresGS.dossier = ''; filtresGS.sa = '';
    afficherFiltresHierarchiques();
    rendreSeances();
  });
  document.getElementById('filtreStatutGS').addEventListener('change', (e) => {
    filtresGS.statut = e.target.value;
    rendreSeances();
  });

  afficherFiltresHierarchiques();
}

// Filtres secondaires calculés automatiquement à partir du contenu réel du
// parcours (pas de valeurs codées en dur) : Unité + Semaine pour le français,
// Dossier pour les mathématiques, ou juste la SA pour les autres matières
// (structure à un seul niveau) — pour retrouver une séance à éditer sans
// avoir à redescendre toute l'arborescence depuis "navigation.html".
function afficherFiltresHierarchiques() {
  const zone = document.getElementById('zoneFiltresHierarchiquesGS');
  if (!filtresGS.matiere) { zone.innerHTML = ''; return; }

  const champSelectionne = champsGS.find(c => String(c.id) === filtresGS.matiere);
  // Séances de la matière choisie (et de la classe choisie, si renseignée) —
  // sert uniquement à calculer les options disponibles dans les filtres.
  const seancesPourOptions = seancesGS.filter(s =>
    String(s.champ?.id ?? '') === filtresGS.matiere &&
    (!filtresGS.classe || String(s.classe?.id ?? '') === filtresGS.classe)
  );

  const optionsUniques = (liste, cle) => {
    const vues = new Map();
    liste.forEach(s => { const n = s[cle]; if (n && !vues.has(n.id)) vues.set(n.id, n); });
    return [...vues.values()].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  };
  const optionsSA = (liste) => {
    const vues = new Map();
    liste.forEach(s => { const sa = s.saInfo; if (sa && !vues.has(sa.id)) vues.set(sa.id, sa); });
    return [...vues.values()].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0) || a.titre.localeCompare(b.titre, 'fr'));
  };
  const libelleSA = (sa) => `${sa.numero ? 'SA' + sa.numero + ' — ' : ''}${sa.titre}`;

  let html = '';

  if (champSelectionne?.code === 'francais') {
    const unites = optionsUniques(seancesPourOptions, 'unite');
    const seancesApresUnite = filtresGS.unite ? seancesPourOptions.filter(s => String(s.unite?.id ?? '') === filtresGS.unite) : seancesPourOptions;
    const semaines = optionsUniques(seancesApresUnite, 'semaine');
    const seancesApresSemaine = filtresGS.semaine ? seancesApresUnite.filter(s => String(s.semaine?.id ?? '') === filtresGS.semaine) : seancesApresUnite;
    const sasDispo = optionsSA(seancesApresSemaine);

    html = `
      <select id="filtreUniteGS"><option value="">Toutes les unités</option>${unites.map(n => `<option value="${n.id}" ${filtresGS.unite === String(n.id) ? 'selected' : ''}>${echapperGS(n.titre)}</option>`).join('')}</select>
      <select id="filtreSemaineGS"><option value="">Toutes les semaines</option>${semaines.map(n => `<option value="${n.id}" ${filtresGS.semaine === String(n.id) ? 'selected' : ''}>${echapperGS(n.titre)}</option>`).join('')}</select>
      <select id="filtreSaGS"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresGS.sa === String(sa.id) ? 'selected' : ''}>${echapperGS(libelleSA(sa))}</option>`).join('')}</select>`;
  } else if (champSelectionne?.code === 'mathematique') {
    const dossiers = optionsUniques(seancesPourOptions, 'dossier');
    const seancesApresDossier = filtresGS.dossier ? seancesPourOptions.filter(s => String(s.dossier?.id ?? '') === filtresGS.dossier) : seancesPourOptions;
    const sasDispo = optionsSA(seancesApresDossier);

    html = `
      <select id="filtreDossierGS"><option value="">Tous les dossiers</option>${dossiers.map(n => `<option value="${n.id}" ${filtresGS.dossier === String(n.id) ? 'selected' : ''}>${echapperGS(n.titre)}</option>`).join('')}</select>
      <select id="filtreSaGS"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresGS.sa === String(sa.id) ? 'selected' : ''}>${echapperGS(libelleSA(sa))}</option>`).join('')}</select>`;
  } else {
    const sasDispo = optionsSA(seancesPourOptions);
    html = `<select id="filtreSaGS"><option value="">Toutes les SA</option>${sasDispo.map(sa => `<option value="${sa.id}" ${filtresGS.sa === String(sa.id) ? 'selected' : ''}>${echapperGS(libelleSA(sa))}</option>`).join('')}</select>`;
  }

  zone.innerHTML = html;

  const filtreUnite = document.getElementById('filtreUniteGS');
  if (filtreUnite) filtreUnite.addEventListener('change', (e) => {
    filtresGS.unite = e.target.value; filtresGS.semaine = ''; filtresGS.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreSemaine = document.getElementById('filtreSemaineGS');
  if (filtreSemaine) filtreSemaine.addEventListener('change', (e) => {
    filtresGS.semaine = e.target.value; filtresGS.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreDossier = document.getElementById('filtreDossierGS');
  if (filtreDossier) filtreDossier.addEventListener('change', (e) => {
    filtresGS.dossier = e.target.value; filtresGS.sa = '';
    afficherFiltresHierarchiques(); rendreSeances();
  });
  const filtreSA = document.getElementById('filtreSaGS');
  if (filtreSA) filtreSA.addEventListener('change', (e) => {
    filtresGS.sa = e.target.value;
    rendreSeances();
  });
}

function rendreSeances() {
  const zone = document.getElementById('zoneSeances');
  const filtrees = seancesGS.filter(s => {
    if (filtresGS.matiere && String(s.champ?.id ?? '') !== filtresGS.matiere) return false;
    if (filtresGS.classe && String(s.classe?.id ?? '') !== filtresGS.classe) return false;
    if (filtresGS.statut && s.statut !== filtresGS.statut) return false;
    if (filtresGS.recherche && !(s.titre || '').toLowerCase().includes(filtresGS.recherche)) return false;
    if (filtresGS.unite && String(s.unite?.id ?? '') !== filtresGS.unite) return false;
    if (filtresGS.semaine && String(s.semaine?.id ?? '') !== filtresGS.semaine) return false;
    if (filtresGS.dossier && String(s.dossier?.id ?? '') !== filtresGS.dossier) return false;
    if (filtresGS.sa && String(s.sa_id ?? '') !== filtresGS.sa) return false;
    return true;
  });

  if (!filtrees.length) {
    zone.innerHTML = `<p style="color:var(--texte-gris)">Aucune séance ne correspond à ces critères.</p>`;
    return;
  }

  const parMatiere = new Map();
  filtrees.forEach(s => {
    const cle = s.champ ? s.champ.nom : '— Sans matière rattachée —';
    if (!parMatiere.has(cle)) parMatiere.set(cle, []);
    parMatiere.get(cle).push(s);
  });
  const matieresTriees = [...parMatiere.keys()].sort((a, b) => a.localeCompare(b, 'fr'));

  zone.innerHTML = matieresTriees.map(nomMatiere => {
    const liste = parMatiere.get(nomMatiere).sort((a, b) => new Date(b.modifie_le) - new Date(a.modifie_le));
    return `
      <div class="groupe-matiere-admin">
        <div class="titre-groupe-matiere">${echapperGS(nomMatiere)} (${liste.length})</div>
        <div class="liste-lignes">${liste.map(ligneSeanceHtmlGS).join('')}</div>
      </div>`;
  }).join('');

  zone.querySelectorAll('[data-publier-seance]').forEach(btn => {
    btn.addEventListener('click', () => changerStatutSeanceGS(
      parseInt(btn.dataset.publierSeance, 10), 'publie',
      'Publier cette séance ? Elle deviendra visible pour les élèves concernés.'
    ));
  });
  zone.querySelectorAll('[data-archiver-seance]').forEach(btn => {
    btn.addEventListener('click', () => changerStatutSeanceGS(
      parseInt(btn.dataset.archiverSeance, 10), 'archive',
      'Archiver cette séance ? Elle ne sera plus visible pour les élèves.'
    ));
  });
}

function ligneSeanceHtmlGS(s) {
  const meta = [
    s.discipline || null,
    s.titre_contenu ? `🔖 ${echapperGS(s.titre_contenu)}` : null,
    `Modifiée le ${formaterDateGS(s.modifie_le)}`
  ].filter(Boolean).join(' · ');
  const chemin = (s.cheminTitres || []).map(t => echapperGS(t)).join(' › ');

  return `
    <div class="ligne ligne-seance-admin">
      <div class="details-seance-admin">
        <span class="titre-ligne">${echapperGS(s.titre)}${s.classe ? ` <span class="badge-classe-admin">${echapperGS(s.classe.nom)}</span>` : ''}</span>
        ${chemin ? `<span class="chemin-ligne-seance-partagee">${chemin}</span>` : ''}
        <span class="meta-seance-admin">${meta}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="statut-pill statut-${s.statut}">${LIBELLES_STATUT_GS[s.statut] || s.statut}</span>
        ${s.statut === 'brouillon' ? `<button type="button" class="btn btn-discret" data-publier-seance="${s.id}">📤 Publier</button>` : ''}
        ${s.statut === 'publie' ? `<button type="button" class="btn btn-discret" data-archiver-seance="${s.id}">🗄️ Archiver</button>` : ''}
        <a href="../editeur-seance.html?id=${s.id}" class="btn btn-primaire">✏️ Éditer</a>
      </div>
    </div>`;
}

async function changerStatutSeanceGS(id, nouveauStatut, message) {
  confirmerAction(message, async () => {
    const { data, error } = await supabaseClient.from('seances').update({ statut: nouveauStatut }).eq('id', id).select('id');
    if (error) return alert('Erreur : ' + error.message);
    if (!data || !data.length) {
      return alert("Cette modification n'a pas été appliquée — vous n'avez peut-être pas les droits d'édition sur cette classe/matière.");
    }
    const s = seancesGS.find(x => x.id === id);
    if (s) s.statut = nouveauStatut;
    rendreSeances();
  });
}

function formaterDateGS(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function echapperGS(v) {
  return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
