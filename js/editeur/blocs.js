// Blocs pédagogiques (cahier des charges §6.1 + extensions).
// Réutilisé par l'éditeur (édition) et, plus tard, par la vue élève (lecture seule).

const TYPES_BLOCS = [
  { valeur: 'texte',      label: 'Texte',       icone: '📝', usage: 'Explication',        couleur: '#003366' },
  { valeur: 'titre',      label: 'Titre',       icone: '🔠', usage: 'Section (peut contenir d\'autres blocs)', couleur: '#1D4ED8' },
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
  { valeur: 'autre',      label: 'Autre',       icone: '🧩', usage: 'Bloc personnalisé (nom libre)', couleur: '#64748B' }
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

const TYPES_TEXTE_LIBRE = ['texte', 'a_retenir', 'definition', 'exemple', 'attention', 'astuce', 'item'];

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
      return `<input type="text" data-champ="texte" placeholder="Titre de la section" value="${echapper(c.texte)}">
        <p class="note-future">Section : vous pouvez ajouter d'autres blocs à l'intérieur (voir "Contenu" ci-dessous).</p>`;

    case 'consigne':
      return `<textarea data-champ="texte" placeholder="Consigne générale (ex: Lis le texte puis réponds aux items suivants)">${echapper(c.texte)}</textarea>
        <p class="note-future">Section : ajoutez des blocs "Item" (ou autres) à l'intérieur pour détailler la consigne.</p>`;

    case 'autre':
      return `
        <div class="champ-ligne"><label>Nom du bloc</label><input type="text" data-champ="nom" placeholder="Ex: Anecdote, Citation, Remarque..." value="${echapper(c.nom)}"></div>
        <textarea data-champ="texte" placeholder="Contenu...">${echapper(c.texte)}</textarea>`;

    case 'texte': case 'a_retenir': case 'definition': case 'exemple': case 'attention': case 'astuce': case 'item':
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

    case 'activite':
      return `<textarea data-champ="consigne" placeholder="Consigne de l'activité...">${echapper(c.consigne)}</textarea>
        <div class="champ-ligne"><label>Palier</label>${html_selectPalier(bloc)}</div>`;

    case 'exercice': case 'quiz': case 'evaluation':
      return `<textarea data-champ="consigne" placeholder="Consigne (l'éditeur détaillé — questions, correction automatique — arrive à l'étape dédiée du projet)">${echapper(c.consigne)}</textarea>
        <p class="note-future">Éditeur complet (questions, correction automatique, barème) prévu à l'étape "Exercices &amp; épreuves" du projet.</p>`;

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
