// Blocs pédagogiques (cahier des charges §6.1 + extensions).
// Réutilisé par l'éditeur (édition) et, plus tard, par la vue élève (lecture seule).

const TYPES_BLOCS = [
  { valeur: 'texte',      label: 'Texte',       icone: '📝', usage: 'Explication',        couleur: '#003366' },
  // Valeur interne 'titre' conservée (base de données, résumé IA...) même si
  // le libellé affiché est désormais "Contenu" : son propre texte ne
  // s'affiche plus nulle part côté élève (ni dans l'aperçu élève de
  // l'éditeur) — seuls les blocs qu'elle contient sont visibles. Le champ
  // texte reste éditable dans la liste de blocs de l'éditeur, pour que
  // l'admin puisse s'y retrouver (repère interne uniquement).
  { valeur: 'titre',      label: 'Contenu',     icone: '🔠', usage: 'Section (peut contenir d\'autres blocs, jamais de blocs d\'exercice/activité)', couleur: '#1D4ED8' },
  { valeur: 'a_retenir',  label: 'À retenir',   icone: '⭐', usage: 'Notion essentielle',  couleur: '#B8860B' },
  { valeur: 'definition', label: 'Définition',  icone: '📖', usage: 'Terme',               couleur: '#6D28D9' },
  { valeur: 'exemple',    label: 'Exemple',     icone: '💡', usage: 'Illustration',        couleur: '#15803D' },
  { valeur: 'attention',  label: 'Attention',   icone: '⚠️', usage: 'Point de vigilance',  couleur: '#B91C1C' },
  { valeur: 'astuce',     label: 'Astuce',      icone: '🎯', usage: 'Mémo / méthode',      couleur: '#C2410C' },
  { valeur: 'image',      label: 'Image',       icone: '🖼️', usage: 'Illustration',       couleur: '#0369A1' },
  { valeur: 'video',      label: 'Vidéo',       icone: '🎬', usage: 'Ressource',           couleur: '#0369A1' },
  { valeur: 'tableau',    label: 'Tableau',     icone: '📊', usage: 'Données',             couleur: '#0F766E' },
  { valeur: 'formule',    label: 'Formule',     icone: '🧮', usage: 'Mathématiques',       couleur: '#6D28D9' },
  { valeur: 'activite',   label: 'Activité',    icone: '🙋', usage: 'Activité pédagogique', couleur: '#15803D' },
  { valeur: 'exercice',   label: 'Exercice',    icone: '✏️', usage: 'Entraînement interactif', couleur: '#1D4ED8' },
  { valeur: 'quiz',       label: 'Quiz',        icone: '❓', usage: 'Questions',           couleur: '#C2410C' },
  { valeur: 'evaluation', label: 'Évaluation',  icone: '🧾', usage: 'Évaluation / épreuve', couleur: '#B91C1C' },
  { valeur: 'ressource',  label: 'Ressource',   icone: '📎', usage: 'Document ou média',   couleur: '#64748B' },
  { valeur: 'consigne',   label: 'Consigne',    icone: '📋', usage: 'Section pouvant contenir des items', couleur: '#003366' },
  { valeur: 'item',       label: 'Item',        icone: '▫️', usage: 'Élément d\'une consigne (Item 1, Item 2...)', couleur: '#475569' },
  { valeur: 'autre',      label: 'Autre',       icone: '🧩', usage: 'Bloc personnalisé (nom libre)', couleur: '#64748B' },
  { valeur: 'resume',     label: 'Résumé',      icone: '🗒️', usage: 'Synthèse (à la main ou générée par IA)', couleur: '#334155' }
];

// Convertit une couleur hexadécimale en fond très clair (pour harmoniser
// automatiquement le fond d'un bloc avec sa couleur de police/bordure).
function teinteClaire(hex, alpha = 0.08) {
  if (!hex || hex === 'transparent') return 'transparent';
  const h = hex.replace('#', '');
  const complet = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(complet.substring(0, 2), 16);
  const g = parseInt(complet.substring(2, 4), 16);
  const b = parseInt(complet.substring(4, 6), 16);
  if ([r, g, b].some(isNaN)) return 'transparent';
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Choisit un texte blanc ou foncé selon la luminosité du fond, pour que
// la couleur de police reste toujours lisible quel que soit le fond choisi.
function texteContrastant(hex) {
  if (!hex || hex === 'transparent') return '#003366';
  const h = hex.replace('#', '');
  const complet = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(complet.substring(0, 2), 16);
  const g = parseInt(complet.substring(2, 4), 16);
  const b = parseInt(complet.substring(4, 6), 16);
  if ([r, g, b].some(isNaN)) return '#003366';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1E293B' : '#ffffff';
}

function infoType(valeur) {
  return TYPES_BLOCS.find(t => t.valeur === valeur) || { label: valeur, icone: '❔' };
}

const TYPES_TEXTE_LIBRE = ['texte', 'a_retenir', 'definition', 'exemple', 'attention', 'astuce', 'item', 'resume'];

// Types dont le contenu textuel peut être assisté par l'IA (bouton "Générer"/"Améliorer"
// dans l'entête du bloc). On indique, par type, quel champ de `contenu` contient le texte.
const TYPES_IA_CHAMP_TEXTE = [...TYPES_TEXTE_LIBRE, 'titre', 'consigne', 'autre'];
const TYPES_IA_CHAMP_CONSIGNE = ['activite', 'exercice', 'quiz', 'evaluation'];
function champIA(typeBloc) {
  if (TYPES_IA_CHAMP_TEXTE.includes(typeBloc)) return 'texte';
  if (TYPES_IA_CHAMP_CONSIGNE.includes(typeBloc)) return 'consigne';
  return null;
}

// Types de blocs qui agissent comme des SECTIONS : ils peuvent contenir
// d'autres blocs en leur sein (voir parent_bloc_id). La liste définitive
// des sections et des profondeurs autorisées sera affinée plus tard —
// pour l'instant, Titre et Consigne sont les deux sections disponibles.
const TYPES_SECTIONS = ['titre', 'consigne'];

// Palette de couleurs par défaut, réutilisée pour la couleur de police,
// la couleur de fond du texte et la couleur de fond du tableau.
const PALETTE_COULEURS = [
  { nom: 'Bleu KEKELI', valeur: '#003366' },
  { nom: 'Jaune KEKELI', valeur: '#FFCC00' },
  { nom: 'Noir', valeur: '#1E293B' },
  { nom: 'Gris', valeur: '#64748B' },
  { nom: 'Rouge', valeur: '#c0392b' },
  { nom: 'Vert', valeur: '#2ECC71' },
  { nom: 'Orange', valeur: '#E67E22' },
  { nom: 'Violet', valeur: '#9B59B6' },
  { nom: 'Blanc', valeur: '#ffffff' },
  { nom: 'Transparent', valeur: 'transparent' }
];

// Génère le HTML d'édition d'un bloc. Aucune valeur n'est injectée dans un
// attribut on*="" : tous les écouteurs sont attachés ensuite via data-attributs
// (voir attacherEcouteursBloc dans editeur-seance.js) pour éviter tout souci
// d'échappement de guillemets dans le contenu.
function html_editeurBloc(bloc) {
  const c = bloc.contenu || {};
  switch (bloc.type_bloc) {
    case 'titre':
      return `<input type="text" data-champ="texte" placeholder="Repère interne (non affiché à l'élève)" value="${echapper(c.texte)}">
        <p class="note-future">Section "Contenu" : sert uniquement à regrouper d'autres blocs (texte, définition, exemple...). Ce champ n'est jamais affiché à l'élève — c'est juste un repère pour vous y retrouver dans l'éditeur. Ajoutez les blocs à l'intérieur avec "+ Ajouter un bloc ici" ci-dessous.</p>`;

    case 'consigne':
      return `<textarea data-champ="texte" placeholder="Consigne générale (ex: Lis le texte puis réponds aux items suivants)">${echapper(c.texte)}</textarea>
        <p class="note-future">Section : ajoutez des blocs "Item" (ou autres) à l'intérieur pour détailler la consigne.</p>`;

    case 'autre':
      return `
        <div class="champ-ligne"><label>Nom du bloc</label><input type="text" data-champ="nom" placeholder="Ex: Anecdote, Citation, Remarque..." value="${echapper(c.nom)}"></div>
        <textarea data-champ="texte" placeholder="Contenu...">${echapper(c.texte)}</textarea>`;

    case 'texte': case 'a_retenir': case 'definition': case 'exemple': case 'attention': case 'astuce': case 'item': case 'resume':
      return html_editeurTexteRiche(bloc, c);

    case 'image': case 'video':
      return `
        <div class="champ-ligne"><label>URL</label><input type="url" data-champ="url" placeholder="https://..." value="${echapper(c.url)}"></div>
        <div class="champ-ligne"><label>Légende</label><input type="text" data-champ="legende" placeholder="Légende / description" value="${echapper(c.legende)}"></div>`;

    case 'ressource':
      return `
        <div class="champ-ligne"><label>Nom</label><input type="text" data-champ="nom" value="${echapper(c.nom)}"></div>
        <div class="champ-ligne"><label>URL</label><input type="url" data-champ="url" placeholder="https://..." value="${echapper(c.url)}"></div>`;

    case 'formule':
      return `<input type="text" data-champ="formule" placeholder="Ex: (a + b)² = a² + 2ab + b²" value="${echapper(c.formule)}">
        <p class="note-future">Rendu mathématique enrichi (LaTeX) prévu à une étape ultérieure.</p>`;

    case 'tableau':
      return html_editeurTableau(bloc, c);

    case 'activite': case 'exercice': case 'quiz': case 'evaluation':
      return html_editeurExercice(bloc, c);

    default:
      return `<p class="note-future">Type de bloc non reconnu.</p>`;
  }
}

// --- ÉDITEUR DE TEXTE RICHE ---------------------------------------------
// Gras/Italique/Souligné/Listes + police, alignement, couleur de police,
// couleur de fond, avec une palette de couleurs par défaut.
function html_editeurTexteRiche(bloc, c) {
  const swatchesPolice = PALETTE_COULEURS.map(col =>
    `<button type="button" class="pastille-couleur" data-cmd="foreColor" data-valeur="${col.valeur}" title="Texte ${col.nom}" style="background:${col.valeur}"></button>`
  ).join('');
  const swatchesFond = PALETTE_COULEURS.map(col =>
    `<button type="button" class="pastille-couleur" data-cmd="hiliteColor" data-valeur="${col.valeur}" title="Surligner en ${col.nom}" style="background:${col.valeur}"></button>`
  ).join('');

  // Une seule barre d'outils, regroupée par sections (séparées visuellement),
  // pour qu'elle se lise comme un vrai traitement de texte plutôt que comme
  // plusieurs blocs de boutons séparés. Les couleurs sont maintenant dans un
  // petit menu déroulant (🎨 / 🖍️) plutôt qu'alignées en permanence dans la
  // barre, avec une roue de couleur personnalisée en plus des 9 teintes fixes.
  return `
    <div class="barre-outils-texte">
      <div class="groupe-outils">
        <button type="button" data-cmd="bold" title="Gras (Ctrl+B)"><b>G</b></button>
        <button type="button" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Souligné (Ctrl+U)"><u>S</u></button>
      </div>
      <span class="separateur-outils"></span>
      <div class="groupe-outils">
        <select data-cmd-select="fontName" title="Police">
          <option value="Segoe UI">Segoe UI</option>
          <option value="Georgia">Georgia</option>
          <option value="'Courier New'">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="'Comic Sans MS'">Comic Sans MS</option>
          <option value="'Caveat', cursive">Cursive</option>
        </select>
        <select data-cmd-select-taille="1" title="Taille du texte">
          <option value="12">12</option>
          <option value="13">13</option>
          <option value="14" selected>14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
        </select>
      </div>
      <span class="separateur-outils"></span>
      <div class="groupe-outils">
        <button type="button" data-cmd="justifyLeft" title="Aligner à gauche">⯇</button>
        <button type="button" data-cmd="justifyCenter" title="Centrer">☰</button>
        <button type="button" data-cmd="justifyRight" title="Aligner à droite">⯈</button>
        <button type="button" data-cmd="justifyFull" title="Justifier">▤</button>
      </div>
      <span class="separateur-outils"></span>
      <div class="groupe-outils">
        <button type="button" data-cmd="insertUnorderedList" title="Liste à puces">• Liste</button>
        <button type="button" data-cmd="insertOrderedList" title="Liste numérotée">1. Liste</button>
      </div>
      <span class="separateur-outils"></span>
      <div class="groupe-outils">
        <div class="menu-couleur-riche">
          <button type="button" class="bouton-couleur-riche" data-ouvrir-couleur-riche title="Couleur du texte">🎨 Texte</button>
          <div class="palette-riche" data-palette-riche>
            <div class="etiquette-outils etiquette-pleine-largeur">Couleur du texte</div>
            ${swatchesPolice}
            <label class="couleur-personnalisee" title="Choisir une couleur personnalisée">
              <input type="color" data-cmd="foreColor" value="#1E293B">
            </label>
          </div>
        </div>
        <div class="menu-couleur-riche">
          <button type="button" class="bouton-couleur-riche" data-ouvrir-couleur-riche title="Couleur de surlignage">🖍️ Surlignage</button>
          <div class="palette-riche" data-palette-riche>
            <div class="etiquette-outils etiquette-pleine-largeur">Surlignage</div>
            ${swatchesFond}
            <label class="couleur-personnalisee" title="Choisir une couleur personnalisée">
              <input type="color" data-cmd="hiliteColor" value="#ffffff">
            </label>
          </div>
        </div>
      </div>
      <span class="separateur-outils"></span>
      <div class="groupe-outils">
        <button type="button" data-cmd="removeFormat" class="bouton-effacer-format" title="Effacer toute la mise en forme">⌫ Format</button>
      </div>
    </div>
    <div class="editeur-riche" contenteditable="true" data-champ-riche="texte">${contenuRicheInitial(c.texte)}</div>`;
}

// --- ÉDITEUR DE TABLEAU (titre, en-tête, bordure, fusion) ---------------

function html_editeurTableau(bloc, c) {
  const lignes = c.lignes && c.lignes.length ? c.lignes : [['', ''], ['', '']];
  const fusions = c.fusions || []; // [{ligne, colonneDebut, colonneFin}]
  const aUnTitre = !!(c.titre && c.titre.trim());

  function celluleEstMasquee(i, j) {
    return fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
  }
  function colspanCellule(i, j) {
    const f = fusions.find(f => f.ligne === i && f.colonneDebut === j);
    return f ? (f.colonneFin - f.colonneDebut + 1) : 1;
  }
  function estFusionnable(i, j) {
    // Fusionnable avec la cellule suivante si ni l'une ni l'autre n'est déjà dans une fusion
    return j < lignes[i].length - 1 && !celluleEstMasquee(i, j) && !celluleEstMasquee(i, j + 1) && colspanCellule(i, j) === 1;
  }
  function estDejaFusionnee(i, j) {
    return colspanCellule(i, j) > 1;
  }

  const html = lignes.map((ligne, i) => `<tr>${ligne.map((cellule, j) => {
    if (celluleEstMasquee(i, j)) return '';
    const colspan = colspanCellule(i, j);
    return `<td ${colspan > 1 ? `colspan="${colspan}"` : ''}>
      <input type="text" data-tableau-ligne="${i}" data-tableau-colonne="${j}" value="${echapper(cellule)}">
      ${estDejaFusionnee(i, j)
        ? `<button type="button" class="bouton-fusion" data-action="separer-cellule" data-ligne="${i}" data-colonne="${j}" title="Séparer">✂️</button>`
        : (estFusionnable(i, j) ? `<button type="button" class="bouton-fusion" data-action="fusionner-cellule" data-ligne="${i}" data-colonne="${j}" title="Fusionner avec la cellule suivante">🔗</button>` : '')}
    </td>`;
  }).join('')}</tr>`).join('');

  const swatchesFondTableau = PALETTE_COULEURS.map(col =>
    `<button type="button" class="pastille-couleur" data-action="couleur-entete" data-valeur="${col.valeur}" title="${col.nom}" style="background:${col.valeur}"></button>`
  ).join('');

  return `
    <div class="champ-ligne" style="align-items:center;gap:8px">
      <input type="text" data-champ="titre" placeholder="Titre du tableau (optionnel)" value="${echapper(c.titre)}" style="flex-grow:1">
      ${aUnTitre ? `<button class="btn btn-discret" data-action="supprimer-titre-tableau" type="button" title="Supprimer le titre">🗑️ Titre</button>` : ''}
    </div>
    <label class="champ-ligne" style="align-items:center;gap:6px;font-size:13px;color:var(--texte-gris)">
      <input type="checkbox" data-champ-entete="1" ${c.entete ? 'checked' : ''}> Première ligne = en-tête
    </label>
    <label class="champ-ligne" style="align-items:center;gap:6px;font-size:13px;color:var(--texte-gris)">
      <input type="checkbox" data-champ-bordures="1" ${c.bordures !== false ? 'checked' : ''}> Afficher les bordures
    </label>
    <div class="barre-outils-texte"><span class="etiquette-outils">Couleur d'en-tête :</span>${swatchesFondTableau}</div>
    <table class="tableau-bloc ${c.entete ? 'avec-entete' : ''} ${c.bordures === false ? 'sans-bordures' : ''}" data-tableau="1" style="${c.couleurEntete ? `--couleur-entete-tableau:${c.couleurEntete};--couleur-texte-entete-tableau:${texteContrastant(c.couleurEntete)}` : ''}"><tbody>${html}</tbody></table>
    <div class="champ-ligne">
      <button class="btn btn-discret" data-action="ajouter-ligne" type="button">+ Ligne</button>
      <button class="btn btn-discret" data-action="supprimer-ligne" type="button">🗑️ Dernière ligne</button>
      <button class="btn btn-discret" data-action="ajouter-colonne" type="button">+ Colonne</button>
      <button class="btn btn-discret" data-action="supprimer-colonne" type="button">🗑️ Dernière colonne</button>
    </div>
    <p class="note-future">Astuce : le bouton 🔗 sur une cellule la fusionne avec sa voisine de droite (une seule ligne à la fois pour l'instant).</p>`;
}

function html_selectPalier(bloc) {
  const paliers = [
    { v: '', l: '— aucun —' },
    { v: 'azovi', l: '🌱 Azɔ̀ví (très facile)' },
    { v: 'devi', l: '🪘 Dèví (moyen)' },
    { v: 'ogan', l: '🦁 Ògán (difficile)' },
    { v: 'axosu', l: '👑 Axɔ́sú (très difficile)' }
  ];
  return `<select class="palier-select" data-champ-palier="1">
    ${paliers.map(p => `<option value="${p.v}" ${(bloc.palier || '') === p.v ? 'selected' : ''}>${p.l}</option>`).join('')}
  </select>`;
}

// --- ÉDITEUR D'EXERCICE / QUIZ / ÉVALUATION (questions + corrigé) ----------
// Les questions (énoncé, type, options) restent dans bloc.contenu.questions —
// c'est ce que l'élève reçoit pour répondre. Le corrigé (bonnes réponses,
// barème) vit à part, dans la table corriges_exercices : jamais envoyé au
// navigateur élève. Ici, dans l'éditeur admin, on affiche les deux côte à
// côte pour que ce soit pratique à saisir — voir attacherEcouteursQuestions
// dans editeur-seance.js pour le chargement du corrigé et la sauvegarde.

const LIBELLES_TYPE_QUESTION = {
  qcm: 'QCM (choix multiple)',
  vrai_faux: 'Vrai / Faux',
  reponse_courte: 'Réponse courte',
  reponse_longue: 'Réponse longue (corrigée par IA)',
  texte_a_trous: 'Texte à trous',
  remise_en_ordre: 'Remise en ordre',
  association: 'Association (relier des paires)',
  qcm_multiple: 'QCM à réponses multiples',
  classement: 'Classement (trier en catégories)'
};

function html_editeurExercice(bloc, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  return `
    <textarea data-champ="consigne" placeholder="Consigne générale (ex: Réponds aux questions suivantes)">${echapper(c.consigne)}</textarea>
    <div class="champ-ligne"><label>Palier</label>${html_selectPalier(bloc)}</div>
    <div data-bloc-seuil style="display:${bloc.palier ? 'block' : 'none'}">
      <div class="champ-ligne">
        <label>Seuil de réussite (%)</label>
        <input type="number" min="0" max="100" step="0.1" data-champ-seuil-reussite value="${bloc.seuil_reussite ?? 66.7}" style="width:80px">
      </div>
      <p class="note-future">Le seuil de réussite sert à valider ce bloc pour la progression par palier et l'attribution des badges (66,7% par défaut).</p>
    </div>
    <!-- Sans palier, cet exercice est un bloc de contenu ordinaire : ni seuil
         ni progression à configurer, uniquement visible/masqué via data-bloc-seuil
         ci-dessus (le champ garde sa valeur en base, juste masqué à l'écran). -->
    <div class="editeur-questions" data-questions-bloc="${bloc.id}">
      <div class="liste-questions" data-liste-questions>
        ${questions.length ? questions.map((q, i) => html_questionEditeur(q, i, null)).join('') : '<p class="note-future">Aucune question pour l\'instant.</p>'}
      </div>
      <div class="champ-ligne" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-discret" data-ajouter-question>+ Ajouter une question</button>
        <button type="button" class="btn btn-discret" data-generer-activite-ia
          title="Générer des questions (avec leur corrigé) — le palier est demandé/confirmé dans la fenêtre de génération ; le bloc reste en brouillon jusqu'à relecture">
          🧠 Générer des questions (IA)
        </button>
      </div>
      <p class="note-future" data-etat-corrige>Chargement du corrigé...</p>
    </div>`;
}

// Question "association" : l'admin saisit des paires {gauche, droite} bien
// alignées (q.paires, jamais envoyé à l'élève). On en dérive ce qui EST
// envoyé à l'élève (q.gauche, dans l'ordre de saisie, et q.droite, mélangé)
// et, séparément, la correspondance correcte — stockée dans le corrigé
// privé (jamais lisible par l'élève), pas dans les champs publics : sinon
// l'ordre de q.droite révélerait directement la bonne réponse. Recalculé à
// chaque modification d'une paire (ajout/suppression/texte).
function recalculerAssociation(q, c) {
  const paires = Array.isArray(q.paires) ? q.paires : [];
  const n = paires.length;
  const permutation = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  q.gauche = paires.map(p => (p && p.gauche) || '');
  q.droite = permutation.map(idxOrigine => (paires[idxOrigine] && paires[idxOrigine].droite) || '');
  if (c) c.bonneReponse = paires.map((_, i) => permutation.indexOf(i));
}

// Question "classement" : l'admin saisit des catégories (ex: Nom, Verbe,
// Adjectif) et des mots, chacun affecté à une catégorie (q.items[i].categorie,
// jamais envoyé à l'élève). L'élève reçoit la liste des mots (q.motsAClasser)
// et la liste des catégories (q.categories) — l'ordre des mots ne révèle rien
// puisque l'affectation correcte reste uniquement dans le corrigé privé.
function recalculerClassement(q, c) {
  const items = Array.isArray(q.items) ? q.items : [];
  q.motsAClasser = items.map(it => (it && it.mot) || '');
  q.categories = Array.isArray(q.categories) ? q.categories : [];
  if (c) c.bonneReponse = items.map(it => (it && typeof it.categorieIndex === 'number') ? it.categorieIndex : null);
}

// corrige peut être `null` (corrigé pas encore chargé depuis la base — les
// champs de correction s'affichent alors désactivés le temps du chargement).
function html_questionEditeur(q, index, corrige) {
  const c = corrige ? (corrige[q.id] || {}) : null;
  const enAttente = corrige === null;
  const points = c ? (c.points ?? 1) : 1;

  let corpsCorrige = '';
  if (q.type === 'qcm') {
    const options = Array.isArray(q.options) ? q.options : [];
    corpsCorrige = `
      <div class="options-qcm">
        ${options.map((opt, i) => `
          <div class="option-qcm">
            <input type="radio" name="bonne-${q.id}" data-question-bonne-index="${i}" ${!enAttente && String(c.bonneReponse) === String(i) ? 'checked' : ''} ${enAttente ? 'disabled' : ''}>
            <input type="text" data-option-index="${i}" value="${echapper(opt)}" placeholder="Option ${i + 1}">
            <button type="button" data-supprimer-option="${i}" title="Supprimer cette option">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-option style="align-self:flex-start;font-size:12px">+ Option</button>
      </div>`;
  } else if (q.type === 'vrai_faux') {
    const val = !enAttente ? (c.bonneReponse === true || c.bonneReponse === 'true') : null;
    corpsCorrige = `
      <div class="vrai-faux-choix">
        <label><input type="radio" name="vf-${q.id}" data-question-bonne-vf="true" ${val === true ? 'checked' : ''} ${enAttente ? 'disabled' : ''}> Vrai</label>
        <label><input type="radio" name="vf-${q.id}" data-question-bonne-vf="false" ${val === false ? 'checked' : ''} ${enAttente ? 'disabled' : ''}> Faux</label>
      </div>`;
  } else if (q.type === 'reponse_courte') {
    const valeur = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse.join(', ') : '';
    corpsCorrige = `
      <div class="reponse-courte-champ">
        <label>Réponse(s) acceptée(s) (séparées par une virgule)</label>
        <input type="text" data-question-reponse-courte value="${echapper(valeur)}" placeholder="Ex: Paris, paris" ${enAttente ? 'disabled' : ''}>
      </div>`;
  } else if (q.type === 'reponse_longue') {
    const bareme = !enAttente ? (c.bareme || '') : '';
    corpsCorrige = `
      <div class="bareme-champ">
        <label>Éléments de correction attendus (barème indicatif pour l'IA)</label>
        <textarea data-question-bareme placeholder="Ex: l'élève doit citer au moins 2 exemples..." ${enAttente ? 'disabled' : ''}>${echapper(bareme)}</textarea>
      </div>
      <p class="note-future">🤖 Réponse ouverte : sera notée par IA (note + commentaire), avec relecture possible ensuite.</p>`;
  } else if (q.type === 'texte_a_trous') {
    const nbTrous = (String(q.enonce || '').match(/___/g) || []).length;
    const reponsesTrous = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse : [];
    corpsCorrige = `
      <div class="trous-champ">
        <p class="note-future">Utilise <code>___</code> (3 tirets bas) dans l'énoncé pour chaque trou à compléter. ${nbTrous} trou${nbTrous > 1 ? 's' : ''} détecté${nbTrous > 1 ? 's' : ''} pour l'instant.</p>
        ${Array.from({ length: nbTrous }).map((_, i) => `
          <label>Trou ${i + 1} — réponse(s) acceptée(s) (séparées par une virgule)
            <input type="text" data-question-trou-index="${i}" value="${echapper(Array.isArray(reponsesTrous[i]) ? reponsesTrous[i].join(', ') : '')}" placeholder="Ex: chat, Chat" ${enAttente ? 'disabled' : ''}>
          </label>`).join('')}
      </div>`;
  } else if (q.type === 'remise_en_ordre') {
    const options = Array.isArray(q.options) ? q.options : [];
    const ordreCorrect = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse : [];
    corpsCorrige = `
      <div class="options-ordre">
        <p class="note-future">Indique le rang correct (1, 2, 3...) de chaque élément dans l'ordre attendu.</p>
        ${options.map((opt, i) => {
          const pos = ordreCorrect.indexOf(i);
          return `
          <div class="option-qcm">
            <input type="number" min="1" data-question-rang-index="${i}" value="${pos >= 0 ? pos + 1 : ''}" placeholder="Rang" style="width:60px" ${enAttente ? 'disabled' : ''}>
            <input type="text" data-option-index="${i}" value="${echapper(opt)}" placeholder="Élément ${i + 1}">
            <button type="button" data-supprimer-option="${i}" title="Supprimer cet élément">✕</button>
          </div>`;
        }).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-option style="align-self:flex-start;font-size:12px">+ Élément</button>
      </div>`;
  } else if (q.type === 'association') {
    // Paires {gauche, droite} : l'élève doit relier chaque élément de
    // gauche à son élément de droite (proposés mélangés côté élève) —
    // correction automatique paire par paire.
    const paires = Array.isArray(q.paires) ? q.paires : [];
    corpsCorrige = `
      <div class="options-association">
        <p class="note-future">Chaque ligne est une paire à relier (ex: un mot ↔ sa définition). L'élève verra la colonne de droite mélangée.</p>
        ${paires.map((p, i) => `
          <div class="option-qcm">
            <input type="text" data-association-gauche-index="${i}" value="${echapper(p?.gauche)}" placeholder="Élément ${i + 1} (gauche)">
            <input type="text" data-association-droite-index="${i}" value="${echapper(p?.droite)}" placeholder="Correspond à... (droite)">
            <button type="button" data-supprimer-paire="${i}" title="Supprimer cette paire">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-paire style="align-self:flex-start;font-size:12px">+ Paire</button>
      </div>`;
  } else if (q.type === 'qcm_multiple') {
    // Comme le QCM classique, mais plusieurs bonnes réponses possibles (ex:
    // "Activité 1 — Je reconnais les mots" : entourer plusieurs mots dans une
    // liste). Toutes les cases cochées doivent correspondre exactement aux
    // bonnes réponses pour que la question soit comptée correcte.
    const options = Array.isArray(q.options) ? q.options : [];
    const bonnes = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse.map(String) : [];
    corpsCorrige = `
      <p class="note-future">Coche toutes les bonnes réponses (au moins une). L'élève verra des cases à cocher.</p>
      <div class="options-qcm">
        ${options.map((opt, i) => `
          <div class="option-qcm">
            <input type="checkbox" data-question-bonne-multi-index="${i}" ${bonnes.includes(String(i)) ? 'checked' : ''} ${enAttente ? 'disabled' : ''}>
            <input type="text" data-option-index="${i}" value="${echapper(opt)}" placeholder="Option ${i + 1}">
            <button type="button" data-supprimer-option="${i}" title="Supprimer cette option">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-option style="align-self:flex-start;font-size:12px">+ Option</button>
      </div>`;
  } else if (q.type === 'classement') {
    // Catégories (colonnes du tableau, ex: Nom / Verbe / Adjectif) + mots à
    // classer, chacun affecté à sa bonne catégorie (menu déroulant). L'élève
    // recevra la liste des mots et des catégories, jamais l'affectation.
    const categories = Array.isArray(q.categories) ? q.categories : [];
    const items = Array.isArray(q.items) ? q.items : [];
    corpsCorrige = `
      <div class="categories-classement">
        <p class="note-future">Catégories (colonnes proposées à l'élève) :</p>
        ${categories.map((cat, i) => `
          <div class="option-qcm">
            <input type="text" data-categorie-index="${i}" value="${echapper(cat)}" placeholder="Catégorie ${i + 1} (ex: Nom)">
            <button type="button" data-supprimer-categorie="${i}" title="Supprimer cette catégorie">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-categorie style="align-self:flex-start;font-size:12px">+ Catégorie</button>
      </div>
      <div class="items-classement" style="margin-top:8px">
        <p class="note-future">Mots à classer, avec leur bonne catégorie :</p>
        ${items.map((it, i) => `
          <div class="option-qcm">
            <input type="text" data-item-classement-index="${i}" value="${echapper(it?.mot)}" placeholder="Mot ${i + 1}">
            <select data-item-categorie-index="${i}" ${enAttente ? 'disabled' : ''}>
              <option value="">— Catégorie —</option>
              ${categories.map((cat, k) => `<option value="${k}" ${it && it.categorieIndex === k ? 'selected' : ''}>${echapper(cat)}</option>`).join('')}
            </select>
            <button type="button" data-supprimer-item-classement="${i}" title="Supprimer ce mot">✕</button>
          </div>`).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-item-classement style="align-self:flex-start;font-size:12px">+ Mot</button>
      </div>`;
  }

  return `
    <div class="question-editeur" data-question-id="${q.id}">
      <div class="question-entete">
        <span style="font-size:12px;font-weight:700;color:var(--texte-gris)">Q${index + 1}</span>
        <select data-question-champ="type">
          ${Object.entries(LIBELLES_TYPE_QUESTION).map(([v, l]) => `<option value="${v}" ${q.type === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <label>Points <input type="number" min="0" step="0.5" data-question-points value="${points}" ${enAttente ? 'disabled' : ''}></label>
        <button type="button" class="bouton-supprimer-question" data-supprimer-question title="Supprimer cette question">🗑️</button>
      </div>
      <textarea data-question-champ="enonce" placeholder="Énoncé de la question...">${echapper(q.enonce)}</textarea>
      <input type="text" data-question-champ="consigne" placeholder="Consigne pour l'élève (optionnel — ex : « Complète les mots manquants »)" value="${echapper(q.consigne)}">
      ${corpsCorrige}
    </div>`;
}

function echapper(v) {
  return (v || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Le contenu riche (data-champ-riche) est stocké en HTML depuis cette mise à jour.
// Pour l'ancien contenu (texte brut sans formatage), on échappe et on convertit
// les retours à la ligne en <br> pour préserver l'affichage.
function contenuRicheInitial(texte) {
  const v = (texte || '').toString();
  if (v.includes('<')) return v; // déjà du HTML (contenu créé avec le nouvel éditeur)
  return echapper(v).replace(/\n/g, '<br>');
}
