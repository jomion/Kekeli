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
  // 11 septembre 2026 : "Exercice" n'est plus un bloc à questions structurées
  // (ce modèle reste réservé à Activité/Quiz/Évaluation) — c'est désormais un
  // bloc de texte libre, au même titre que "Texte", pour permettre à
  // l'enseignant de proposer un exercice indépendant rédigé à la main (dans
  // un manuel, à recopier, etc.). Voir TYPES_TEXTE_LIBRE ci-dessous et le
  // nouveau bloc "Correction" juste après, pensé pour le suivre.
  { valeur: 'exercice',   label: 'Exercice',    icone: '✏️', usage: 'Exercice libre (texte), à faire suivre d\'un bloc Correction', couleur: '#1D4ED8' },
  // Bloc "Correction" (11 septembre 2026) : corrigé d'un bloc Exercice libre.
  // Contenu masqué par défaut côté élève, révélé via un bouton "Voir la
  // correction" (cf. rendreBlocLecture dans js/pages/eleve-seance.js) — pas
  // de lien de dépendance strict en base avec le bloc Exercice qui précède,
  // l'enseignant l'ajoute simplement juste après quand il le souhaite.
  { valeur: 'correction', label: 'Correction',  icone: '✅', usage: 'Corrigé d\'un exercice libre (masqué, révélé par l\'élève)', couleur: '#065F46' },
  // Bloc "Problème" (11 septembre 2026) : problème mathématique avec un
  // tableau de résolution à 3 colonnes (phrase/équation, résultat, opération
  // posée) — demande explicite : "les opérations soient facilement posée
  // verticalement et à les effectuer sans créer des décalages désordonnés
  // surtout pour la division". Voir html_editeurProbleme/html_lectureProbleme
  // plus bas dans ce fichier.
  { valeur: 'probleme',   label: 'Problème',    icone: '🧮', usage: 'Problème mathématique + tableau de résolution', couleur: '#9A3412' },
  { valeur: 'quiz',       label: 'Quiz',        icone: '❓', usage: 'Questions',           couleur: '#C2410C' },
  { valeur: 'evaluation', label: 'Évaluation',  icone: '🧾', usage: 'Évaluation / épreuve', couleur: '#B91C1C' },
  { valeur: 'ressource',  label: 'Ressource',   icone: '📎', usage: 'Document ou média',   couleur: '#64748B' },
  { valeur: 'consigne',   label: 'Consigne',    icone: '📋', usage: 'Section pouvant contenir des items', couleur: '#003366' },
  { valeur: 'item',       label: 'Item',        icone: '▫️', usage: 'Élément d\'une consigne (Item 1, Item 2...)', couleur: '#475569' },
  { valeur: 'autre',      label: 'Autre',       icone: '🧩', usage: 'Bloc personnalisé (nom libre)', couleur: '#64748B' },
  { valeur: 'resume',     label: 'Résumé',      icone: '🗒️', usage: 'Synthèse (à la main ou générée par IA)', couleur: '#334155' },
  // Bloc "HTML libre" (11 septembre 2026) : restauré après avoir été repéré
  // manquant côté admin ET côté élève alors que 3 blocs de ce type existaient
  // déjà en base (créés entre le 7 et le 10 septembre 2026, séances 40/45/147)
  // — le code de ce type de bloc n'avait jamais été livré dans une zip de ce
  // projet et n'était donc présent dans aucune version de ce fichier suivie
  // ici ; il a fallu le reconstruire à partir du contenu réel déjà en base
  // (voir contenuHtmlLibreVersIframe ci-dessous) plutôt que de le retrouver
  // tel quel. Permet de coller un document HTML complet (avec ses propres
  // balises <style>, SVG, tableaux...) affiché isolé du reste de la page.
  { valeur: 'html_libre', label: 'HTML libre',  icone: '🌐', usage: 'Code HTML/CSS/SVG personnalisé (avancé)', couleur: '#0F172A' }
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

// 'exercice' et 'correction' ajoutés le 11 septembre 2026 : bloc Exercice
// remodelé en texte libre (voir TYPES_BLOCS ci-dessus), bloc Correction
// nouvellement créé sur le même modèle (texte libre masqué côté élève).
const TYPES_TEXTE_LIBRE = ['texte', 'a_retenir', 'definition', 'exemple', 'attention', 'astuce', 'item', 'resume', 'exercice', 'correction'];

// Types dont le contenu textuel peut être assisté par l'IA (bouton "Générer"/"Améliorer"
// dans l'entête du bloc). On indique, par type, quel champ de `contenu` contient le texte.
const TYPES_IA_CHAMP_TEXTE = [...TYPES_TEXTE_LIBRE, 'titre', 'consigne', 'autre'];
const TYPES_IA_CHAMP_CONSIGNE = ['activite', 'quiz', 'evaluation'];
function champIA(typeBloc) {
  // Bloc "Problème" : l'IA (générer/améliorer) agit sur l'énoncé (c.enonce),
  // jamais sur le tableau de résolution (rempli à la main par l'enseignant).
  if (typeBloc === 'probleme') return 'enonce';
  if (TYPES_IA_CHAMP_TEXTE.includes(typeBloc)) return 'texte';
  if (TYPES_IA_CHAMP_CONSIGNE.includes(typeBloc)) return 'consigne';
  return null;
}
// Types dont le champ IA (voir champIA ci-dessus) contient du HTML riche
// (généré par html_zoneTexteRiche) plutôt que du texte brut — sert à
// js/pages/editeur-seance.js pour savoir s'il faut passer le résultat de
// l'IA par markdownVersHtml (riche) ou nettoyerMarkdown (brut) avant de
// l'enregistrer. 'probleme' n'est volontairement PAS dans TYPES_TEXTE_LIBRE
// (son bloc entier a un rendu dédié, pas un simple champ "texte"), mais son
// champ IA ('enonce') est bien du texte riche comme les autres.
const TYPES_CHAMP_IA_RICHE = [...TYPES_TEXTE_LIBRE, 'probleme'];

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
    case 'correction':
      return html_editeurTexteRiche(bloc, c);

    case 'exercice':
      return html_editeurExerciceLibre(bloc, c);

    case 'probleme':
      return html_editeurProbleme(bloc, c);

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

    case 'activite': case 'quiz': case 'evaluation':
      return html_editeurExercice(bloc, c);

    case 'html_libre':
      return `
        <p class="note-future">⚠️ Colle ici un document HTML complet (avec ses propres balises &lt;style&gt;, tableaux, SVG...). Une fois enregistré, il s'affiche à l'élève dans un cadre isolé du reste de la page (pas de conflit avec les styles du site) — aucun script n'y est exécuté, par sécurité. Réservé à un usage avancé.</p>
        <textarea data-champ="code" class="champ-code-html" placeholder="Colle ici ton code HTML..." spellcheck="false" rows="14">${echapper(c.code)}</textarea>`;

    default:
      return `<p class="note-future">Type de bloc non reconnu.</p>`;
  }
}

// --- ÉDITEUR DE TEXTE RICHE ---------------------------------------------
// Gras/Italique/Souligné/Listes + police, alignement, couleur de police,
// couleur de fond, avec une palette de couleurs par défaut.
//
// Généralisé (5 septembre 2026, 8e lot) pour être réutilisable ailleurs
// qu'un bloc "texte" : la consigne d'une activité/d'un exercice, et l'énoncé
// de chaque question, utilisent maintenant la même barre d'outils — voir
// html_zoneTexteRiche ci-dessous. `attributRiche` porte l'attribut data-*
// que le JS de câblage (editeur-seance.js/devoir-blocs.js) utilise ensuite
// pour savoir où stocker le HTML modifié ; `classeBarreOutils` permet de
// donner une classe distincte à la barre d'outils d'un champ d'ÉNONCÉ (une
// question) pour que le câblage au niveau du BLOC (un seul champ riche,
// texte ou consigne) ne la capte pas aussi par erreur — voir
// attacherEcouteursBloc/wirerQuestions dans editeur-seance.js.
function html_zoneTexteRiche(attributRiche, valeurInitiale, classeBarreOutils = 'barre-outils-texte') {
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
    <div class="${classeBarreOutils}">
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
    <div class="editeur-riche" contenteditable="true" ${attributRiche}>${contenuRicheInitial(valeurInitiale)}</div>`;
}

function html_editeurTexteRiche(bloc, c) {
  return html_zoneTexteRiche('data-champ-riche="texte"', c.texte);
}

// Éditeur du bloc "Exercice" (texte libre, 11 septembre 2026) — avec une
// option "HTML brut" pour les cas de rédaction complexes (demande explicite :
// "Prévois [...] la possibilité d'ajouter du html brut dans les exercices
// pour des exercices particulier dont la rédaction serait complexe"). Même
// principe de confiance que le bloc "HTML libre" existant (voir
// html_blocHtmlLibre) : le HTML n'est PAS filtré, l'isolation vient
// uniquement du cadre <iframe sandbox=""> à l'affichage élève — donc pas un
// simple textarea de plus, un vrai second mode d'édition, actif seulement
// si la case est cochée (bloc.contenu.htmlBrut). Le texte riche (c.texte)
// reste conservé tel quel pendant qu'on bascule, pour ne rien perdre si
// l'enseignant décoche ensuite la case.
function html_editeurExerciceLibre(bloc, c) {
  const modeHtmlBrut = !!c.htmlBrut;
  return `
    <label class="case-html-brut-exercice">
      <input type="checkbox" data-champ-case-html-brut ${modeHtmlBrut ? 'checked' : ''}>
      🌐 Rédiger cet exercice en HTML brut (mise en page complexe : tableau personnalisé, schéma...)
    </label>
    ${modeHtmlBrut
      ? `<p class="note-future">⚠️ Affiché à l'élève dans un cadre isolé (sandbox), comme le bloc « HTML libre » — aucun script ne s'y exécute.</p>
         <textarea data-champ="code" class="champ-code-html" placeholder="Colle ici ton code HTML..." spellcheck="false" rows="12">${echapper(c.code)}</textarea>`
      : html_zoneTexteRiche('data-champ-riche="texte"', c.texte)}
  `;
}

// --- BLOC "PROBLÈME" v2 (11 septembre 2026, REMPLACEMENT du v1) --------------
// Demande explicite du porteur du projet, avec un fichier de référence fourni
// (outil_math.html) : "remplace le bloc problème par un bloc de même
// fonctionnalité que ce fichier [...] ajoute la possibilité de laisser le
// maitre décider si l'élève doit aussi poser lui-même l'opération avant
// d'effectuer". Le v1 (phrase/résultat/opération tapés à la main par
// l'enseignant, jamais interactif) est entièrement remplacé par un moteur qui
// PARSE l'équation saisie par l'enseignant (ex : "15 caisses * 24 € =") pour
// générer automatiquement une grille de calcul posé (addition/soustraction/
// division : grille simple ; multiplication : grille avec produits
// intermédiaires) — porté fidèlement depuis outil_math.html
// (parseDataElement/autoGenerateOperation/generateStandardGrid/
// generateMultiplicationGrid). Décision de conception : plutôt que de garder
// en plus l'ancien système v1 (textarea libre + gabarit de division dédié)
// comme "mode difficile" séparé, la demande "l'élève pose lui-même
// l'opération" est satisfaite en réutilisant CE MÊME moteur de grille : les
// cases des opérandes (normalement toujours pré-remplies, y compris côté
// élève dans le fichier de référence) deviennent, elles aussi, des cases à
// remplir quand `poseParEleve` est coché — un seul moteur, jamais deux
// structures pédagogiques concurrentes pour la même chose. Aucune notation
// automatique : la notation (Solution/Équation/Résultat, un nombre libre par
// case, sans "sur X" fixe) se fait entièrement à la correction manuelle (voir
// js/pages/activites-correction.js et js/devoirs-notes-rendu.js), la note
// finale étant la SOMME de tous ces nombres (demande explicite : "il n'y a
// pas de sur et après toute les notes sera sommés pour avoir la note sur
// 20") — stockée dans rendus_activites.note (sur rendus_activites.bareme,
// déjà à 20 par défaut), le détail dans rendus_activites.details_notation
// (jsonb). Soumission élève interactive dans rendus_activites (même table
// que les blocs "activité"/"exercice"), aussi bien en séance qu'en devoir
// (les deux, demande explicite du porteur du projet) — voir
// js/pages/eleve-seance.js / js/pages/eleve-devoir-rendu.js.
//
// Forme de bloc.contenu :
//   { enonce, modeAffichage: 'eleve'|'corrige', poseParEleve: bool,
//     prepMode: 'auto'|'manuel', explicationPos: 'solution'|'operation'|'dessous',
//     donneesManuelles, inconnuesManuelles (texte, une entrée par ligne),
//     lignes: [ { description, equation, explication } ] }

// Classe une valeur+étiquette détectée dans une équation (ex: "24", "€") en
// une "nature" affichable (Prix/Coût, Masse, Volume, Longueur, Durée, ou
// "Nombre de X" par défaut) — porté depuis parseDataElement() du fichier de
// référence, à l'identique (mêmes familles d'unités).
function problemeParseElement(valeur, etiquette) {
  const label = String(etiquette || '').trim();
  const l = label.toLowerCase();
  if (['€', '$', 'eur', 'usd', 'francs', 'fcfa'].some(x => l.includes(x))) return { nature: 'Prix / Coût', texte: `${valeur} ${label}`, uniteReelle: true, uniteSeule: label };
  if (['kg', 'g', 'mg', 't'].some(x => l.includes(x))) return { nature: 'Masse', texte: `${valeur} ${label}`, uniteReelle: true, uniteSeule: label };
  if (['l', 'ml', 'cl', 'dl'].some(x => l.includes(x))) return { nature: 'Volume', texte: `${valeur} ${label}`, uniteReelle: true, uniteSeule: label };
  if (['m', 'cm', 'mm', 'km'].some(x => l.includes(x))) return { nature: 'Longueur', texte: `${valeur} ${label}`, uniteReelle: true, uniteSeule: label };
  if (['h', 'min', 's', 'sec', 'ans', 'jours'].some(x => l.includes(x))) return { nature: 'Durée', texte: `${valeur} ${label}`, uniteReelle: true, uniteSeule: label };
  const nom = label || 'éléments';
  return { nature: `Nombre de ${nom}`, texte: `${valeur}`, uniteReelle: false, uniteSeule: '' };
}

// Analyse une équation du type "15 caisses * 24 € =" -> { n1, unite1, type,
// n2, unite2, resultat, uniteDetectee } ou null si non reconnue — porté
// depuis autoGenerateOperation() (partie analyse) du fichier de référence.
function problemeAnalyserEquation(equation) {
  const eq = String(equation || '').trim();
  const m = eq.match(/(\d+)(?:\s*([a-zA-Zà-üÀ-Ü€$]+))?\s*([+\-*/xX])\s*(\d+)(?:\s*([a-zA-Zà-üÀ-Ü€$]+))?/);
  if (!m) return null;
  const n1 = m[1], unite1 = m[2] || '';
  let type = m[3].toLowerCase(); if (type === 'x') type = '*';
  const n2 = m[4], unite2 = m[5] || '';
  const p1 = problemeParseElement(n1, unite1);
  const p2 = problemeParseElement(n2, unite2);
  const uniteDetectee = p2.uniteReelle ? p2.uniteSeule : (p1.uniteReelle ? p1.uniteSeule : '');
  const a = parseInt(n1, 10), b = parseInt(n2, 10);
  let resultat;
  if (type === '*') resultat = a * b;
  else if (type === '+') resultat = a + b;
  else if (type === '-') resultat = a - b;
  else if (type === '/') resultat = b === 0 ? NaN : Number((a / b).toFixed(2));
  else return null;
  if (Number.isNaN(resultat)) return null;
  return { n1, unite1, type, n2, unite2, resultat, uniteDetectee };
}

// À partir des équations de toutes les lignes, calcule les listes "Données
// connues" / "Inconnues à trouver" affichées en mode auto — porté depuis
// updateDataAndUnknowns() du fichier de référence (les nombres détectés dans
// chaque équation pour les données, la description de chaque étape —
// débarrassée de son "Étape N :" — pour les inconnues).
function problemeCalculerDonneesInconnues(lignes) {
  const donnees = [];
  const inconnues = [];
  (lignes || []).forEach(l => {
    const desc = String(l.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc) inconnues.push(desc.replace(/^\s*(<strong>)?\s*Étape\s*\d+\s*:?\s*(<\/strong>)?\s*/i, ''));
    const eq = String(l.equation || '');
    const re = /(\d+)\s*([a-zA-Zà-üÀ-Ü€$]*)/g;
    let m;
    while ((m = re.exec(eq))) {
      if (m[1] && m[1] !== '0') {
        const p = problemeParseElement(m[1], m[2] || '');
        const formatte = `<span class="nature-donnee-probleme">${echapper(p.nature)}</span> : ${echapper(p.texte)}`;
        if (!donnees.includes(formatte)) donnees.push(formatte);
      }
    }
  });
  return { donnees, inconnues };
}

// Une case de la grille de calcul posé. Toujours un <input maxlength=1> (même
// en lecture seule) pour que le style visuel soit rigoureusement identique
// entre l'aperçu enseignant, le corrigé et le formulaire élève — seul
// l'attribut `readonly` change. `nom` sert de clé de soumission (data-cellule-probleme)
// quand la case est modifiable, pour relire les valeurs saisies par l'élève.
function problemeCelluleHtml(valeur, editable, id, classesExtra, nom) {
  const classes = ['case-calcul-probleme', ...(classesExtra || [])].filter(Boolean).join(' ');
  const attrs = [
    'type="text"', 'maxlength="1"', `class="${classes}"`,
    id ? `id="${echapper(id)}"` : '',
    (editable && nom) ? `data-cellule-probleme="${echapper(nom)}"` : '',
    editable ? '' : 'readonly tabindex="-1"',
    `value="${valeur == null ? '' : echapper(String(valeur))}"`
  ].filter(Boolean).join(' ');
  return `<input ${attrs}>`;
}

// Les N-1 lignes de produits intermédiaires d'une multiplication posée (une
// ligne par chiffre du second facteur, décalée d'autant de zéros) — porté
// depuis getMultiplicationIntermediateRows() du fichier de référence.
function problemeLignesIntermediairesMultiplication(n1Str, n2Str, totalCols) {
  const n1 = parseInt(n1Str, 10);
  const lignes = [];
  const chiffresN2 = n2Str.split('').reverse();
  for (let i = 0; i < chiffresN2.length; i++) {
    const chiffre = parseInt(chiffresN2[i], 10);
    const produit = n1 * chiffre;
    const zeros = '0'.repeat(i);
    const valStr = (i > 0 && produit === 0) ? '0'.repeat(i + 1) : (produit.toString() + (i > 0 ? zeros : ''));
    lignes.push(valStr.padStart(totalCols, ' '));
  }
  return lignes;
}

// Génère la grille de calcul posé complète pour une équation déjà analysée
// (problemeAnalyserEquation). `opts.interactif` = false -> tout est déjà
// résolu et en lecture seule (aperçu enseignant, mode "corrigé", vue de
// correction). `opts.interactif` = true -> les cases de retenues, produits
// intermédiaires et résultat sont à remplir par l'élève ; les cases des
// opérandes (les chiffres de l'équation elle-même) restent pré-remplies EN
// LECTURE SEULE, sauf si `opts.poseParEleve` est vrai — c'est précisément le
// réglage ajouté à la demande du porteur du projet, qui n'existe pas dans le
// fichier de référence (celui-ci garde toujours les opérandes pré-remplies,
// même en mode élève). `opts.valeurs` (optionnel) réinjecte des valeurs déjà
// saisies (brouillon élève, ou relecture de sa copie par le correcteur —
// voir `opts.revision` : lecture seule, mais affichant ce que l'ÉLÈVE a
// réellement écrit plutôt que le corrigé, pour que le correcteur voie sa
// copie telle quelle, y compris les cases qu'il a laissées vides).
function problemeGenererGrilleHtml(analyse, opts) {
  const o = opts || {};
  const interactif = !!o.interactif;
  const poseParEleve = !!o.poseParEleve;
  const revision = !!o.revision;
  const prefixeId = o.prefixeId || 'grille-probleme';
  const valeurs = o.valeurs || null;
  const lire = (cle, defaut) => (valeurs && Object.prototype.hasOwnProperty.call(valeurs, cle)) ? valeurs[cle] : defaut;

  const { n1, n2, type, resultat, uniteDetectee } = analyse;
  const operandeEditable = interactif && poseParEleve;
  const calculEditable = interactif;
  // En relecture (revision), une case "opérande" retombe sur le chiffre
  // correct si l'élève ne l'a pas saisie (cases jamais éditables quand
  // poseParEleve=false) ; une case "calcul" retombe sur vide (on montre ce
  // qu'il a écrit, pas le corrigé) si elle est absente de sa copie.
  const valeurOperande = (c, cle, correcte) => revision ? lire(cle, correcte) : (operandeEditable ? lire(cle, '') : correcte);
  const valeurCalcul = (cle, correcte) => revision ? lire(cle, '') : (calculEditable ? lire(cle, '') : correcte);
  let cols, html;

  if (type === '*') {
    const rowsN2 = n2.length;
    cols = n1.length + n2.length + 1;
    const resStr = String(resultat).padStart(cols, ' ');
    html = `<div class="grille-calcul-probleme" style="grid-template-columns:repeat(${cols},32px)">`;
    for (let c = 0; c < cols; c++) html += problemeCelluleHtml(valeurCalcul(`retenue-${c}`, ''), interactif && !revision, `${prefixeId}-retenue-${c}`, ['case-retenue-probleme'], `retenue-${c}`);
    const paddedN1 = n1.padStart(cols, ' ');
    for (let c = 0; c < cols; c++) {
      const correcte = paddedN1[c] === ' ' ? '' : paddedN1[c];
      html += problemeCelluleHtml(valeurOperande(c, `n1-${c}`, correcte), operandeEditable && !revision, `${prefixeId}-n1-${c}`, [], `n1-${c}`);
    }
    html += problemeCelluleHtml('×', false, null, ['case-bordure-basse-probleme']);
    const paddedN2 = n2.padStart(cols - 1, ' ');
    for (let c = 0; c < cols - 1; c++) {
      const correcte = paddedN2[c] === ' ' ? '' : paddedN2[c];
      html += problemeCelluleHtml(valeurOperande(c, `n2-${c}`, correcte), operandeEditable && !revision, `${prefixeId}-n2-${c}`, ['case-bordure-basse-probleme'], `n2-${c}`);
    }
    let ligneIdx = 0;
    if (rowsN2 > 1) {
      const inter = problemeLignesIntermediairesMultiplication(n1, n2, cols);
      for (let r = 0; r < rowsN2; r++) {
        const derniere = r === rowsN2 - 1;
        for (let c = 0; c < cols; c++) {
          const correcte = inter[r][c] === ' ' ? '' : inter[r][c];
          html += problemeCelluleHtml(valeurCalcul(`inter-${ligneIdx}-${c}`, correcte), calculEditable && !revision, `${prefixeId}-inter-${ligneIdx}-${c}`, derniere ? ['case-bordure-basse-probleme'] : [], `inter-${ligneIdx}-${c}`);
        }
        ligneIdx++;
      }
    }
    for (let c = 0; c < cols; c++) {
      const correcte = resStr[c] === ' ' ? '' : resStr[c];
      html += problemeCelluleHtml(valeurCalcul(`resultat-${c}`, correcte), calculEditable && !revision, `${prefixeId}-resultat-${c}`, [], `resultat-${c}`);
    }
    html += `</div>`;
  } else {
    // Addition, soustraction et division partagent la même grille simple
    // (posée mais sans potence de division dédiée) — fidèle au fichier de
    // référence, qui traite les trois de la même façon.
    cols = Math.max(n1.length, n2.length) + 1;
    const resStr = String(resultat).padStart(cols, ' ');
    html = `<div class="grille-calcul-probleme" style="grid-template-columns:repeat(${cols},32px)">`;
    for (let c = 0; c < cols; c++) html += problemeCelluleHtml(valeurCalcul(`retenue-${c}`, ''), interactif && !revision, `${prefixeId}-retenue-${c}`, ['case-retenue-probleme'], `retenue-${c}`);
    const paddedN1 = n1.padStart(cols, ' ');
    for (let c = 0; c < cols; c++) {
      const correcte = paddedN1[c] === ' ' ? '' : paddedN1[c];
      html += problemeCelluleHtml(valeurOperande(c, `n1-${c}`, correcte), operandeEditable && !revision, `${prefixeId}-n1-${c}`, [], `n1-${c}`);
    }
    const symbole = type === '+' ? '+' : (type === '-' ? '-' : '÷');
    html += problemeCelluleHtml(symbole, false, null, ['case-bordure-basse-probleme']);
    const paddedN2 = n2.padStart(cols - 1, ' ');
    for (let c = 0; c < cols - 1; c++) {
      const correcte = paddedN2[c] === ' ' ? '' : paddedN2[c];
      html += problemeCelluleHtml(valeurOperande(c, `n2-${c}`, correcte), operandeEditable && !revision, `${prefixeId}-n2-${c}`, ['case-bordure-basse-probleme'], `n2-${c}`);
    }
    for (let c = 0; c < cols; c++) {
      const correcte = resStr[c] === ' ' ? '' : resStr[c];
      html += problemeCelluleHtml(valeurCalcul(`resultat-${c}`, correcte), calculEditable && !revision, `${prefixeId}-resultat-${c}`, [], `resultat-${c}`);
    }
    html += `</div>`;
  }

  let enveloppe = `<div class="conteneur-calcul-probleme">${html}`;
  if (uniteDetectee) enveloppe += `<div class="badge-unite-probleme">Unité : ${echapper(uniteDetectee)}</div>`;
  enveloppe += `</div>`;
  return enveloppe;
}

function problemeLigneParDefaut() {
  return { description: '<strong>Étape 1 :</strong> ', equation: '', explication: '' };
}

// Une ligne du tableau de résolution, côté ÉDITEUR (aperçu de la grille en
// lecture seule à titre indicatif — la vraie interactivité élève est gérée à
// part, voir js/pages/eleve-seance.js / eleve-devoir-rendu.js).
function html_ligneEditeurProbleme(bloc, ligne, i, ctx) {
  const l = ligne || problemeLigneParDefaut();
  const analyse = problemeAnalyserEquation(l.equation);
  const idPrefixe = `probleme-${bloc.id || 'x'}-${i}`;
  const grilleHtml = analyse
    ? problemeGenererGrilleHtml(analyse, { interactif: false, prefixeId: idPrefixe })
    : `<p class="operation-vide">Saisissez une équation avec deux nombres et un opérateur (ex : 15 * 24 =) pour générer la grille.</p>`;
  const explicationChamp = `<textarea data-probleme-champ="explication" data-probleme-ligne="${i}" class="explication-probleme" rows="2" placeholder="💡 Explication pour l'élève (optionnelle)...">${echapper(l.explication)}</textarea>`;

  return `
    <div class="ligne-probleme" data-ligne-probleme="${i}">
      <div class="colonne-solution-probleme">
        <div class="champ-description-probleme" contenteditable="true" data-probleme-champ="description" data-probleme-ligne="${i}">${l.description || ''}</div>
        <input type="text" class="champ-equation-probleme" data-probleme-champ="equation" data-probleme-ligne="${i}" placeholder="Ex : 15 caisses * 24 € =" value="${echapper(l.equation)}">
        ${ctx.explicationPos === 'solution' ? explicationChamp : ''}
        <button type="button" class="btn btn-discret bouton-supprimer-ligne-probleme" data-action-probleme="supprimer-ligne" data-probleme-ligne="${i}">🗑️ Supprimer cette étape</button>
      </div>
      <div class="colonne-operation-probleme">
        <div class="apercu-grille-probleme" data-apercu-grille-probleme="${i}">${grilleHtml}</div>
        ${ctx.explicationPos === 'operation' ? explicationChamp : ''}
      </div>
    </div>
    ${ctx.explicationPos === 'dessous' ? explicationChamp : ''}
  `;
}

function html_editeurProbleme(bloc, c) {
  const lignes = Array.isArray(c.lignes) && c.lignes.length ? c.lignes : [problemeLigneParDefaut()];
  const modeAffichage = c.modeAffichage === 'corrige' ? 'corrige' : 'eleve';
  const poseParEleve = !!c.poseParEleve;
  const prepMode = c.prepMode === 'manuel' ? 'manuel' : 'auto';
  const explicationPos = ['solution', 'operation', 'dessous'].includes(c.explicationPos) ? c.explicationPos : 'operation';
  const auto = prepMode === 'auto' ? problemeCalculerDonneesInconnues(lignes) : null;
  const ctx = { modeAffichage, poseParEleve, explicationPos };

  return `
    ${html_zoneTexteRiche('data-champ-riche="enonce"', c.enonce)}

    <div class="reglages-probleme">
      <div class="champ-reglage-probleme">
        <label>⚙️ Mode d'affichage à l'élève</label>
        <select data-champ-probleme="modeAffichage">
          <option value="eleve" ${modeAffichage === 'eleve' ? 'selected' : ''}>✏️ Élève (exercice interactif à compléter)</option>
          <option value="corrige" ${modeAffichage === 'corrige' ? 'selected' : ''}>🤖 Corrigé (exemple entièrement résolu, lecture seule)</option>
        </select>
      </div>
      <div class="champ-reglage-probleme">
        <label>📋 Données &amp; Inconnues</label>
        <select data-champ-probleme="prepMode">
          <option value="auto" ${prepMode === 'auto' ? 'selected' : ''}>🤖 Détection automatique (depuis les équations)</option>
          <option value="manuel" ${prepMode === 'manuel' ? 'selected' : ''}>✍️ Remplissage manuel</option>
        </select>
      </div>
      <div class="champ-reglage-probleme">
        <label>💬 Emplacement de l'explication</label>
        <select data-champ-probleme="explicationPos">
          <option value="solution" ${explicationPos === 'solution' ? 'selected' : ''}>Dans la colonne Solution / Équation</option>
          <option value="operation" ${explicationPos === 'operation' ? 'selected' : ''}>Sous l'opération posée</option>
          <option value="dessous" ${explicationPos === 'dessous' ? 'selected' : ''}>En bas du tableau</option>
        </select>
      </div>
      <label class="case-pose-par-eleve-probleme">
        <input type="checkbox" data-champ-case-probleme="poseParEleve" ${poseParEleve ? 'checked' : ''}>
        ✍️ En mode élève, l'élève doit aussi poser lui-même l'opération (recopier les chiffres dans la grille) avant de l'effectuer
      </label>
    </div>

    <div class="prep-grille-probleme">
      <div class="prep-boite-probleme">
        <h4>📥 Données connues</h4>
        ${prepMode === 'manuel'
          ? `<textarea data-champ="donneesManuelles" rows="3" placeholder="Une donnée par ligne...">${echapper(c.donneesManuelles)}</textarea>`
          : `<ul class="liste-auto-probleme" data-liste-donnees-probleme>${auto.donnees.length ? auto.donnees.map(d => `<li>${d}</li>`).join('') : '<li><em>Saisissez une équation…</em></li>'}</ul>`}
      </div>
      <div class="prep-boite-probleme">
        <h4>❓ Inconnues à trouver</h4>
        ${prepMode === 'manuel'
          ? `<textarea data-champ="inconnuesManuelles" rows="3" placeholder="Une inconnue par ligne...">${echapper(c.inconnuesManuelles)}</textarea>`
          : `<ul class="liste-auto-probleme" data-liste-inconnues-probleme>${auto.inconnues.length ? auto.inconnues.map(u => `<li>${echapper(u)}</li>`).join('') : '<li><em>Saisissez une étape…</em></li>'}</ul>`}
      </div>
    </div>

    <p class="note-future">Tableau de résolution : une ligne par étape. Décrivez l'étape puis saisissez l'équation (ex : <code>15 caisses * 24 € =</code>) — la grille de calcul posé est générée automatiquement (addition, soustraction, division : grille simple ; multiplication : produits intermédiaires). Aucune note ici : la notation se fait entièrement à la correction (Solution / Équation / Résultat, un nombre libre par case, sans "sur X" fixe — ces nombres sont ensuite sommés pour donner la note finale sur ${bloc.seuil_reussite != null ? '20' : '20'}).</p>

    <div class="lignes-probleme" data-lignes-probleme>
      ${lignes.map((l, i) => html_ligneEditeurProbleme(bloc, l, i, ctx)).join('')}
    </div>
    <button type="button" class="btn btn-discret" data-action-probleme="ajouter-ligne">+ Ajouter une étape</button>
  `;
}

// Rendu en LECTURE SEULE (« corrigé ») du bloc "Problème" — partagé entre
// l'aperçu de l'éditeur (js/pages/editeur-seance.js, rendreBlocApercu), la
// vue élève quand modeAffichage='corrige' et l'aperçu compact
// (js/apercu-blocs-seance.js). L'interactivité (modeAffichage='eleve') est
// gérée par des fonctions dédiées côté élève (rendreProbleme dans
// eleve-seance.js / eleve-devoir-rendu.js), pas ici — cette fonction ne
// produit jamais de formulaire soumissible.
// Construit la boîte "Données connues / Inconnues à trouver" — partagée
// entre le corrigé statique (ci-dessous) et le rendu élève interactif
// (js/pages/eleve-seance.js / eleve-devoir-rendu.js, rendreProbleme) pour ne
// jamais faire diverger cette logique entre les deux.
function html_prepDonneesInconnuesProbleme(c, lignes) {
  const prepMode = c.prepMode === 'manuel' ? 'manuel' : 'auto';
  const auto = prepMode === 'auto' ? problemeCalculerDonneesInconnues(lignes) : null;
  const donnees = prepMode === 'manuel'
    ? String(c.donneesManuelles || '').split('\n').map(s => s.trim()).filter(Boolean).map(echapper)
    : auto.donnees;
  const inconnues = prepMode === 'manuel'
    ? String(c.inconnuesManuelles || '').split('\n').map(s => s.trim()).filter(Boolean).map(echapper)
    : auto.inconnues;
  if (!donnees.length && !inconnues.length) return '';
  return `
    <div class="prep-grille-probleme-lecture">
      ${donnees.length ? `<div class="prep-boite-probleme-lecture"><h4>📥 Données connues</h4><ul>${donnees.map(d => `<li>${d}</li>`).join('')}</ul></div>` : ''}
      ${inconnues.length ? `<div class="prep-boite-probleme-lecture"><h4>❓ Inconnues à trouver</h4><ul>${inconnues.map(u => `<li>${u}</li>`).join('')}</ul></div>` : ''}
    </div>`;
}

function explicationLectureProbleme(texte) {
  return texte ? `<div class="explication-lecture-probleme">💡 ${echapper(texte)}</div>` : '';
}

function html_lectureProbleme(c, blocId) {
  const lignes = Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : [];
  const explicationPos = ['solution', 'operation', 'dessous'].includes(c.explicationPos) ? c.explicationPos : 'operation';
  const explicationHtml = explicationLectureProbleme;
  const explicationsDessous = [];

  const lignesHtml = lignes.map((l, i) => {
    const analyse = problemeAnalyserEquation(l.equation);
    const grille = analyse
      ? problemeGenererGrilleHtml(analyse, { interactif: false, prefixeId: `probleme-lect-${blocId || 'x'}-${i}` })
      : '<p class="operation-vide">—</p>';
    if (explicationPos === 'dessous' && l.explication) explicationsDessous.push(l.explication);
    return `
      <tr>
        <td class="cellule-solution-probleme-lecture">
          <div>${l.description || ''}</div>
          ${l.equation ? `<p class="equation-lecture-probleme">${echapper(l.equation)}</p>` : ''}
          ${explicationPos === 'solution' ? explicationHtml(l.explication) : ''}
        </td>
        <td class="cellule-operation-probleme-lecture">
          ${grille}
          ${explicationPos === 'operation' ? explicationHtml(l.explication) : ''}
        </td>
      </tr>`;
  }).join('');

  return `
    ${c.enonce ? `<div class="contenu-riche-lecture enonce-probleme">${contenuRicheInitial(c.enonce)}</div>` : ''}
    ${html_prepDonneesInconnuesProbleme(c, lignes)}
    ${lignesHtml ? `<table class="tableau-probleme-lecture-v2"><tbody>${lignesHtml}</tbody></table>` : ''}
    ${explicationsDessous.length ? `<div class="explications-dessous-probleme">${explicationsDessous.map(explicationHtml).join('')}</div>` : ''}
  `;
}

// Corps du FORMULAIRE interactif (mode élève) du bloc "Problème" — partagé
// entre js/pages/eleve-seance.js et js/pages/eleve-devoir-rendu.js (séance ET
// devoir, demande explicite du porteur du projet). Ne produit ni la balise
// <form>, ni le bouton de soumission (chaque appelant les ajoute avec son
// propre texte/état "nouvel essai", comme pour les blocs "activité"
// existants) — seulement l'énoncé, les données/inconnues et une grille par
// étape avec des cases <input> à remplir (voir problemeGenererGrilleHtml,
// interactif:true). Quand `poseParEleve` est coché, l'équation elle-même
// n'est PAS montrée en clair : le but est que l'élève la détermine lui-même
// à partir de l'énoncé et de la description de l'étape, puis la pose dans la
// grille — sans quoi "poser soi-même l'opération" ne serait qu'une recopie.
function html_formulaireProbleme(bloc, c) {
  const lignes = Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : [];
  const poseParEleve = !!c.poseParEleve;
  const explicationPos = ['solution', 'operation', 'dessous'].includes(c.explicationPos) ? c.explicationPos : 'operation';
  const explicationsDessous = [];

  const lignesHtml = lignes.map((l, i) => {
    const analyse = problemeAnalyserEquation(l.equation);
    const idPrefixe = `probleme-forme-${bloc.id}-${i}`;
    const grille = analyse
      ? problemeGenererGrilleHtml(analyse, { interactif: true, poseParEleve, prefixeId: idPrefixe })
      : '<p class="operation-vide">—</p>';
    if (explicationPos === 'dessous' && l.explication) explicationsDessous.push(l.explication);
    const equationVisible = !poseParEleve && l.equation ? `<p class="equation-lecture-probleme">${echapper(l.equation)}</p>` : '';
    return `
      <div class="ligne-probleme-eleve" data-ligne-probleme-eleve="${i}">
        <div class="colonne-solution-probleme-eleve">
          <div>${l.description || ''}</div>
          ${equationVisible}
          ${explicationPos === 'solution' ? explicationLectureProbleme(l.explication) : ''}
        </div>
        <div class="colonne-operation-probleme-eleve">
          ${grille}
          ${explicationPos === 'operation' ? explicationLectureProbleme(l.explication) : ''}
        </div>
      </div>`;
  }).join('');

  return `
    ${c.enonce ? `<div class="contenu-riche-lecture enonce-probleme">${contenuRicheInitial(c.enonce)}</div>` : ''}
    ${html_prepDonneesInconnuesProbleme(c, lignes)}
    ${poseParEleve ? '<p class="note-future">✍️ À toi de poser l\'opération dans la grille (recopie les chiffres au bon endroit) avant de l\'effectuer.</p>' : ''}
    <div class="lignes-probleme-eleve" data-lignes-probleme-eleve>${lignesHtml}</div>
    ${explicationsDessous.length ? `<div class="explications-dessous-probleme">${explicationsDessous.map(explicationLectureProbleme).join('')}</div>` : ''}
  `;
}

// Relit une copie déjà rendue (en attente de correction, ou déjà corrigée) :
// même mise en page que le formulaire, mais entièrement en lecture seule et
// affichant ce que l'ÉLÈVE a réellement écrit (voir `revision` dans
// problemeGenererGrilleHtml) — jamais un formulaire soumissible.
// `reponseLignes` est le tableau `lignes` déjà décodé de rendus_activites.reponse_texte
// (voir formatReponseProbleme / lireReponseProbleme dans eleve-seance.js).
function html_relectureProbleme(c, reponseLignes) {
  const lignes = Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : [];
  const lignesHtml = lignes.map((l, i) => {
    const analyse = problemeAnalyserEquation(l.equation);
    const valeurs = (Array.isArray(reponseLignes) && reponseLignes[i] && reponseLignes[i].grille) || null;
    const grille = analyse
      ? problemeGenererGrilleHtml(analyse, { interactif: false, revision: true, prefixeId: `probleme-rev-${i}`, valeurs })
      : '<p class="operation-vide">—</p>';
    return `
      <div class="ligne-probleme-eleve">
        <div class="colonne-solution-probleme-eleve">
          <div>${l.description || ''}</div>
          ${l.equation ? `<p class="equation-lecture-probleme">${echapper(l.equation)}</p>` : ''}
        </div>
        <div class="colonne-operation-probleme-eleve">${grille}</div>
      </div>`;
  }).join('');
  return `
    ${c.enonce ? `<div class="contenu-riche-lecture enonce-probleme">${contenuRicheInitial(c.enonce)}</div>` : ''}
    <div class="lignes-probleme-eleve lignes-probleme-relecture">${lignesHtml}</div>
  `;
}

// Lit les valeurs saisies par l'élève dans le formulaire (voir
// html_formulaireProbleme) pour un bloc donné, sous la forme attendue par
// rendus_activites.reponse_texte (JSON.stringify de { lignes: [{grille}] }).
// Partagé par eleve-seance.js/eleve-devoir-rendu.js pour ne jamais faire
// diverger le format de sérialisation des deux côtés.
function collecterReponseProbleme(formEl, nbLignes) {
  const lignes = [];
  for (let i = 0; i < nbLignes; i++) {
    const conteneur = formEl.querySelector(`[data-ligne-probleme-eleve="${i}"]`);
    const grille = {};
    if (conteneur) {
      conteneur.querySelectorAll('[data-cellule-probleme]').forEach(input => {
        grille[input.dataset.celluleProbleme] = input.value;
      });
    }
    lignes.push({ grille });
  }
  return JSON.stringify({ lignes });
}

function lireReponseProbleme(reponseTexte) {
  try {
    const data = JSON.parse(reponseTexte || '{}');
    return Array.isArray(data.lignes) ? data.lignes : [];
  } catch (_e) {
    return [];
  }
}

// Somme tous les nombres saisis par le correcteur (Solution/Équation/Résultat,
// un par étape) pour obtenir la note finale — demande explicite du porteur du
// projet : "il n'y a pas de sur et après toute les notes sera sommés pour
// avoir la note sur 20". `details` est la forme stockée dans
// rendus_activites.details_notation : { lignes: [{solution, equation, resultat}] }.
// Partagé par js/pages/activites-correction.js (séance) et
// js/devoirs-notes-rendu.js (devoir) pour ne jamais faire diverger le calcul.
function sommeNotesDetailleesProbleme(details) {
  const lignes = (details && Array.isArray(details.lignes)) ? details.lignes : [];
  let total = 0;
  lignes.forEach(l => {
    ['solution', 'equation', 'resultat'].forEach(champ => {
      const v = parseFloat(l && l[champ]);
      if (!Number.isNaN(v)) total += v;
    });
  });
  return total;
}

// Corps HTML du formulaire de correction détaillée d'un rendu de bloc
// "Problème" (voir sommeNotesDetailleesProbleme ci-dessus pour la règle de
// calcul) : une grille en lecture seule montrant ce que l'élève a réellement
// écrit (mode `revision` de problemeGenererGrilleHtml), avec à côté trois
// champs numériques libres (Solution/Équation/Résultat, sans maximum fixe —
// demande explicite du porteur du projet) par étape. Partagé par
// js/pages/activites-correction.js (contexte séance) et
// js/devoirs-notes-rendu.js (contexte devoir), chacun l'insérant dans sa
// propre modale bespoke (le système générique ouvrirModal de js/modal.js ne
// permet pas une liste de champs dynamique comme celle-ci).
function html_formulaireCorrectionProbleme(c, reponseLignes, detailsExistants) {
  const lignes = Array.isArray(c.lignes) ? c.lignes.filter(l => l && (l.description || l.equation)) : [];
  const detailsLignes = (detailsExistants && Array.isArray(detailsExistants.lignes)) ? detailsExistants.lignes : [];
  const champNote = (i, nom, label) => {
    const brut = detailsLignes[i] ? detailsLignes[i][nom] : null;
    const valeur = (brut === null || brut === undefined) ? '' : brut;
    return `<label class="champ-note-probleme">${label}
      <input type="number" step="any" data-note-probleme="${i}" data-note-probleme-champ="${nom}" value="${echapper(String(valeur))}" placeholder="0">
    </label>`;
  };
  const lignesHtml = lignes.map((l, i) => {
    const valeurs = (Array.isArray(reponseLignes) && reponseLignes[i] && reponseLignes[i].grille) || null;
    const analyse = problemeAnalyserEquation(l.equation);
    const grille = analyse
      ? problemeGenererGrilleHtml(analyse, { interactif: false, revision: true, prefixeId: `probleme-correction-${i}`, valeurs })
      : '<p class="operation-vide">—</p>';
    return `
      <div class="ligne-correction-probleme" data-ligne-correction-probleme="${i}">
        <div class="colonne-solution-probleme-eleve">
          <div>${l.description || ''}</div>
          ${l.equation ? `<p class="equation-lecture-probleme">${echapper(l.equation)}</p>` : ''}
        </div>
        <div class="colonne-operation-probleme-eleve">${grille}</div>
        <div class="notes-correction-probleme">
          ${champNote(i, 'solution', 'Note Solution')}
          ${champNote(i, 'equation', 'Note Équation')}
          ${champNote(i, 'resultat', 'Note Résultat')}
        </div>
      </div>`;
  }).join('');
  return `
    ${c.enonce ? `<div class="contenu-riche-lecture enonce-probleme">${contenuRicheInitial(c.enonce)}</div>` : ''}
    <div class="lignes-correction-probleme" data-lignes-correction-probleme>${lignesHtml}</div>
    <p class="total-note-correction-probleme">Total : <strong data-total-note-correction-probleme>${sommeNotesDetailleesProbleme(detailsExistants)}</strong> / 20</p>
  `;
}

// Relit les notes saisies par le correcteur dans le formulaire produit par
// html_formulaireCorrectionProbleme, sous la forme attendue par
// rendus_activites.details_notation : { lignes: [{solution, equation, resultat}] }.
function collecterDetailsNotationProbleme(formEl, nbLignes) {
  const lignes = [];
  for (let i = 0; i < nbLignes; i++) {
    const conteneur = formEl.querySelector(`[data-ligne-correction-probleme="${i}"]`);
    const ligne = {};
    if (conteneur) {
      conteneur.querySelectorAll('[data-note-probleme]').forEach(input => {
        ligne[input.dataset.noteProblemeChamp] = input.value === '' ? null : parseFloat(input.value);
      });
    }
    lignes.push(ligne);
  }
  return { lignes };
}

// Recalcule et affiche en direct le total du formulaire de correction dès
// qu'un correcteur modifie une note (voir html_formulaireCorrectionProbleme).
function attacherMiseAJourTotalCorrectionProbleme(formEl) {
  const total = formEl.querySelector('[data-total-note-correction-probleme]');
  if (!total) return;
  const recalculer = () => {
    let somme = 0;
    formEl.querySelectorAll('[data-note-probleme]').forEach(input => {
      const v = parseFloat(input.value);
      if (!Number.isNaN(v)) somme += v;
    });
    total.textContent = somme;
  };
  formEl.querySelectorAll('[data-note-probleme]').forEach(input => input.addEventListener('input', recalculer));
}

// Câblage JS d'UNE zone de texte riche générée par html_zoneTexteRiche
// ci-dessus (execCommand + barre d'outils) — partagé par js/pages/editeur-seance.js
// (blocs de séance, énoncé de question) ET js/editeur/devoir-blocs.js (consigne
// et énoncé de question d'un bloc de devoir), pour ne jamais faire diverger
// cette logique assez complexe (sélection, alignement, couleurs, taille) entre
// les deux éditeurs. Vit ici plutôt que dans un des deux fichiers appelants
// car blocs.js est chargé avant les deux (voir les balises <script> des
// pages qui les utilisent).
function configurerZoneRiche(zoneRiche, barresOutils, onChange) {
  const sauverContenuRiche = () => onChange(zoneRiche.innerHTML);
  zoneRiche.addEventListener('input', sauverContenuRiche);

  // La sélection de texte se perd dès qu'on clique un bouton hors de la
  // zone éditable (le focus part sur le bouton) : c'est ce qui empêchait
  // le formatage couleur (et les autres commandes) de s'appliquer.
  // On la sauvegarde en continu et on la restaure juste avant chaque commande.
  let selectionSauvegardee = null;
  const sauvegarderSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && zoneRiche.contains(sel.anchorNode)) {
      selectionSauvegardee = sel.getRangeAt(0).cloneRange();
    }
  };
  zoneRiche.addEventListener('mouseup', sauvegarderSelection);
  zoneRiche.addEventListener('keyup', sauvegarderSelection);
  const restaurerSelectionEtFocus = () => {
    zoneRiche.focus();
    if (selectionSauvegardee) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(selectionSauvegardee);
    }
  };

  if (!barresOutils.length) return;

  // queryCommandState('justifyCenter'/'justifyRight'/'justifyFull') est peu
  // fiable dans les navigateurs (il peut répondre "vrai" par défaut sur une
  // zone vide) — c'est ce qui donnait l'impression que le curseur était
  // "centré par défaut". On calcule donc l'alignement réel nous-mêmes, en
  // lisant le text-align effectivement appliqué autour du curseur.
  const alignementActuel = () => {
    const sel = window.getSelection();
    let noeud = sel && sel.rangeCount && zoneRiche.contains(sel.anchorNode) ? sel.anchorNode : zoneRiche;
    let el2 = noeud.nodeType === 3 ? noeud.parentElement : noeud;
    while (el2 && el2 !== zoneRiche.parentElement) {
      const align = getComputedStyle(el2).textAlign;
      if (align && align !== 'start') return align;
      el2 = el2.parentElement;
    }
    return 'left';
  };
  const commandesEtatSimple = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
  const commandesAlignement = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
  const boutonsCommande = [];
  const mettreAJourEtatBarreOutils = () => {
    const align = alignementActuel();
    boutonsCommande.forEach(b => {
      const cmd = b.dataset.cmd;
      if (commandesEtatSimple.includes(cmd)) {
        try { b.classList.toggle('actif', document.queryCommandState(cmd)); } catch (_e) { /* ignoré */ }
      } else if (commandesAlignement[cmd]) {
        b.classList.toggle('actif', commandesAlignement[cmd] === align);
      }
    });
  };

  barresOutils.forEach(barreOutils => {
    barreOutils.querySelectorAll('button[data-cmd]').forEach(btn => {
      boutonsCommande.push(btn);
      // Empêche le bouton de voler le focus au mousedown (sinon la
      // sélection dans la zone éditable est perdue avant même le clic).
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        restaurerSelectionEtFocus();
        if (btn.dataset.cmd === 'hiliteColor') {
          document.execCommand('styleWithCSS', false, true);
          document.execCommand('hiliteColor', false, btn.dataset.valeur === 'transparent' ? 'transparent' : btn.dataset.valeur);
        } else if (btn.dataset.cmd === 'foreColor') {
          document.execCommand('styleWithCSS', false, true);
          document.execCommand('foreColor', false, btn.dataset.valeur);
        } else {
          document.execCommand(btn.dataset.cmd, false, null);
        }
        sauvegarderSelection();
        sauverContenuRiche();
        mettreAJourEtatBarreOutils();
      });
    });

    // Roues de couleur personnalisées (en plus des 9 teintes de la palette) :
    // pas de preventDefault sur mousedown ici, sinon le sélecteur de couleur
    // natif du navigateur ne s'ouvrirait jamais.
    barreOutils.querySelectorAll('input[type="color"][data-cmd]').forEach(inputCouleur => {
      inputCouleur.addEventListener('input', () => {
        restaurerSelectionEtFocus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand(inputCouleur.dataset.cmd, false, inputCouleur.value);
        sauvegarderSelection();
        sauverContenuRiche();
      });
    });

    // Menus déroulants de couleur (🎨 Texte / 🖍️ Surlignage) : remplacent
    // l'ancien alignement de pastilles en permanence dans la barre.
    barreOutils.querySelectorAll('.menu-couleur-riche').forEach(menu => {
      const boutonMenu = menu.querySelector('[data-ouvrir-couleur-riche]');
      const palette = menu.querySelector('[data-palette-riche]');
      if (!boutonMenu || !palette) return;
      boutonMenu.addEventListener('mousedown', (e) => e.preventDefault());
      boutonMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const etaitOuverte = palette.classList.contains('ouverte');
        document.querySelectorAll('.palette-riche.ouverte, .palette-bloc.ouverte').forEach(p => p.classList.remove('ouverte'));
        if (!etaitOuverte) palette.classList.add('ouverte');
      });
    });

    const selectPolice = barreOutils.querySelector('[data-cmd-select="fontName"]');
    if (selectPolice) selectPolice.addEventListener('change', () => {
      restaurerSelectionEtFocus();
      document.execCommand('fontName', false, selectPolice.value);
      sauvegarderSelection();
      sauverContenuRiche();
    });

    // Taille de texte : execCommand('fontSize') utilise une échelle héritée
    // 1-7 censée être remplacée par un <font size="n"> — mais Chrome
    // l'applique en fait directement en mot-clé CSS (ex: "xxx-large" pour le
    // niveau 7), sans jamais créer de <font> à remplacer. Résultat vérifié :
    // le texte devenait énorme quelle que soit la taille choisie, et les
    // sélections suivantes n'avaient plus aucun effet visible. On applique
    // donc la taille nous-mêmes, directement en pixels, sans passer par
    // execCommand : il faut une sélection de texte (pas juste un curseur).
    const selectTaille = barreOutils.querySelector('[data-cmd-select-taille]');
    if (selectTaille) selectTaille.addEventListener('change', () => {
      restaurerSelectionEtFocus();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
        alert('Sélectionnez d\'abord le texte dont vous voulez changer la taille, puis choisissez une taille.');
        return;
      }
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = selectTaille.value + 'px';
      try {
        range.surroundContents(span);
      } catch (_e) {
        // La sélection traverse plusieurs éléments (ex : à cheval sur un
        // passage déjà en gras et du texte simple) — surroundContents()
        // refuse ce cas précis ; on extrait puis on réinsère à la place.
        const contenu = range.extractContents();
        span.appendChild(contenu);
        range.insertNode(span);
      }
      sel.removeAllRanges();
      const nouvelle = document.createRange();
      nouvelle.selectNodeContents(span);
      sel.addRange(nouvelle);
      sauvegarderSelection();
      sauverContenuRiche();
    });
  });

  // Les boutons Gras/Italique/Alignement/... reflètent l'état du texte sous
  // le curseur, comme dans un vrai traitement de texte (plus intuitif : on
  // voit tout de suite si la sélection actuelle est déjà en gras, alignée
  // à droite, etc. — et l'alignement par défaut s'affiche bien à gauche).
  zoneRiche.addEventListener('keyup', mettreAJourEtatBarreOutils);
  zoneRiche.addEventListener('mouseup', mettreAJourEtatBarreOutils);
  zoneRiche.addEventListener('focus', mettreAJourEtatBarreOutils);
  mettreAJourEtatBarreOutils();
}

// Découpe un texte en mots (espaces = séparateurs, ponctuation gardée collée
// au mot) pour le type de question "Sélectionner des mots dans un texte" —
// LA MÊME fonction doit être utilisée à l'édition (admin, ici) et à la
// lecture (élève, js/pages/eleve-seance.js et eleve-devoir-rendu.js) pour que
// les index de mots correspondent exactement des deux côtés : c'est pour ça
// qu'elle vit dans ce fichier partagé plutôt que dupliquée.
function tokeniserMots(texte) {
  return String(texte || '').trim().split(/\s+/).filter(Boolean);
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

// Sélecteur de compétences travaillées par ce bloc (Phase 2 — Accompagnement
// pédagogique personnalisé, Premium) : liste à cocher, une compétence par
// pastille. `dispo` est fourni par l'appelant (chargé pour la classe/matière
// de la séance ou du devoir en cours) — jamais construit ici pour éviter de
// coupler ce fichier partagé à une source de données précise. La sélection
// courante du bloc n'est PAS dans bloc.contenu : elle vit dans la table de
// liaison `blocs_competences`, chargée à part et posée sur bloc.competencesIds
// par l'appelant avant le premier rendu (voir chargerBlocs() côté éditeur de
// séance et chargerBlocsDevoir() côté éditeur de devoir).
function html_selectCompetencesBloc(bloc, dispo) {
  if (!Array.isArray(dispo) || !dispo.length) {
    return '<p class="note-future">Aucune compétence configurée pour cette matière/classe — gérez le référentiel dans Admin ▸ Compétences pour pouvoir suivre la progression des élèves sur ce bloc (fonctionnalité Premium).</p>';
  }
  const selectionnees = new Set((bloc.competencesIds || []).map(String));
  return `
    <div class="champ-ligne" style="flex-direction:column;align-items:flex-start;gap:6px">
      <label>🧩 Compétences travaillées (suivi de progression Premium)</label>
      <div class="liste-competences-bloc" data-liste-competences-bloc style="display:flex;flex-wrap:wrap;gap:6px">
        ${dispo.map(c => `
          <label class="checkbox-modal" style="display:inline-flex;align-items:center;gap:5px;border:1px solid var(--bordure);border-radius:20px;padding:3px 10px;font-size:12px;cursor:pointer">
            <input type="checkbox" data-competence-bloc="${c.id}" ${selectionnees.has(String(c.id)) ? 'checked' : ''}> ${echapper(c.intitule)}
          </label>`).join('')}
      </div>
    </div>`;
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
  classement: 'Classement (trier en catégories)',
  intrus_lexical: 'Trouve l\'intrus (plusieurs séries de mots)',
  reponse_numerique: 'Réponse numérique / calcul',
  selection_mots: 'Sélectionner des mots dans un texte',
  vrai_faux_justifie: 'Vrai / Faux avec justification (IA)',
  texte_a_trous_glisser: 'Texte à trous — glisser-déposer'
};

// Types dont l'énoncé reste en texte BRUT (pas d'éditeur riche) : leur texte
// est analysé littéralement (détection des "___", découpage en mots) et un
// HTML de mise en forme (gras, listes...) casserait cette analyse. Ajouté le
// 5 septembre 2026 (8e lot) en même temps que le passage de l'énoncé des
// AUTRES types en éditeur riche — voir html_questionEditeur ci-dessous et
// rendreEnonce()/tokeniserMots() côté rendu élève.
const TYPES_ENONCE_PLAT = ['texte_a_trous', 'texte_a_trous_glisser', 'selection_mots'];

function html_editeurExercice(bloc, c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  return `
    <div class="champ-consigne-riche">
      <label class="etiquette-outils">Consigne générale (ex : Réponds aux questions suivantes)</label>
      ${html_zoneTexteRiche('data-champ-riche="consigne"', c.consigne)}
    </div>
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
    ${html_selectCompetencesBloc(bloc, typeof COMPETENCES_DISPONIBLES_EDITEUR !== 'undefined' ? COMPETENCES_DISPONIBLES_EDITEUR : [])}
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
  } else if (q.type === 'intrus_lexical') {
    // Plusieurs séries de mots ; dans chaque série, l'élève doit trouver
    // l'intrus. q.series (public, envoyé à l'élève) ne contient QUE les
    // listes de mots — jamais lequel est l'intrus, qui reste uniquement
    // dans le corrigé privé (c.bonneReponse, un index par série, aligné sur
    // l'ordre de q.series), pour ne rien laisser deviner côté navigateur.
    const series = Array.isArray(q.series) ? q.series : [];
    const intrusAttendus = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse : [];
    corpsCorrige = `
      <div class="series-intrus" data-series-intrus>
        <p class="note-future">Une série par ligne : saisis les mots séparés par une virgule, puis coche celui qui est l'intrus.</p>
        ${series.map((s, si) => {
          const mots = Array.isArray(s?.mots) ? s.mots : [];
          return `
          <div class="serie-intrus-ligne" data-serie-intrus-index="${si}">
            <input type="text" data-serie-intrus-mots="${si}" value="${echapper(mots.join(', '))}" placeholder="mot1, mot2, mot3, mot4" ${enAttente ? 'disabled' : ''}>
            <div class="serie-intrus-choix">
              ${mots.length
                ? mots.map((m, mi) => `<label><input type="radio" name="intrus-${q.id}-${si}" data-serie-intrus-radio="${si}" value="${mi}" ${intrusAttendus[si] === mi ? 'checked' : ''} ${enAttente ? 'disabled' : ''}> ${echapper(m) || '(vide)'}</label>`).join('')
                : '<span class="note-future">Saisis d\'abord les mots ci-dessus.</span>'}
            </div>
            <button type="button" data-supprimer-serie-intrus="${si}" title="Supprimer cette série">🗑️</button>
          </div>`;
        }).join('')}
        <button type="button" class="btn btn-discret" data-ajouter-serie-intrus style="align-self:flex-start;font-size:12px">+ Série</button>
      </div>`;
  } else if (q.type === 'reponse_numerique') {
    const attendu = !enAttente && c.bonneReponse ? c.bonneReponse : {};
    corpsCorrige = `
      <div class="champ-ligne">
        <label>Réponse exacte</label>
        <input type="number" step="any" data-question-numerique-valeur value="${attendu.valeur ?? ''}" ${enAttente ? 'disabled' : ''}>
        <label>Tolérance (+/-)</label>
        <input type="number" step="any" min="0" data-question-numerique-tolerance value="${attendu.tolerance ?? 0}" style="width:80px" ${enAttente ? 'disabled' : ''}>
      </div>
      <p class="note-future">L'élève tape un nombre ; sa réponse est comptée correcte si l'écart avec la réponse exacte ne dépasse pas la tolérance (0 = réponse exacte attendue).</p>`;
  } else if (q.type === 'selection_mots') {
    // L'énoncé de ce type reste en texte BRUT (voir TYPES_ENONCE_PLAT) : il
    // est découpé en mots cliquables, à l'édition comme à la lecture, avec
    // exactement la même fonction (tokeniserMots) pour que les index
    // correspondent des deux côtés. Le corrigé (quels mots sont corrects)
    // reste privé (c.bonneReponse), jamais visible dans l'énoncé public.
    const mots = tokeniserMots(q.enonce || '');
    const correctsAttendus = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse.map(String) : [];
    corpsCorrige = `
      <div class="mots-selectionnables-editeur">
        <p class="note-future">Clique sur le ou les mots corrects ci-dessous (déduits de l'énoncé saisi plus haut — ${mots.length} mot${mots.length > 1 ? 's' : ''} détecté${mots.length > 1 ? 's' : ''}).</p>
        <div class="mots-selectionnables">
          ${mots.length
            ? mots.map((m, mi) => `<button type="button" class="chip-mot ${correctsAttendus.includes(String(mi)) ? 'chip-mot-correct' : ''}" data-mot-selection-index="${mi}" ${enAttente ? 'disabled' : ''}>${echapper(m)}</button>`).join('')
            : '<span class="note-future">Saisis d\'abord l\'énoncé ci-dessus, puis quitte le champ pour voir apparaître les mots.</span>'}
        </div>
      </div>`;
  } else if (q.type === 'vrai_faux_justifie') {
    const val = !enAttente ? (c.bonneReponse === true || c.bonneReponse === 'true') : null;
    const bareme = !enAttente ? (c.bareme || '') : '';
    corpsCorrige = `
      <div class="vrai-faux-choix">
        <label><input type="radio" name="vf-${q.id}" data-question-bonne-vf="true" ${val === true ? 'checked' : ''} ${enAttente ? 'disabled' : ''}> Vrai</label>
        <label><input type="radio" name="vf-${q.id}" data-question-bonne-vf="false" ${val === false ? 'checked' : ''} ${enAttente ? 'disabled' : ''}> Faux</label>
      </div>
      <div class="bareme-champ">
        <label>Éléments de correction attendus pour la justification (barème indicatif pour l'IA)</label>
        <textarea data-question-bareme placeholder="Ex : l'élève doit expliquer que..." ${enAttente ? 'disabled' : ''}>${echapper(bareme)}</textarea>
      </div>
      <p class="note-future">🤖 Le Vrai/Faux est corrigé automatiquement ; la justification est notée par IA (note + commentaire), comme une réponse longue.</p>`;
  } else if (q.type === 'texte_a_trous_glisser') {
    // Même principe que "Texte à trous" (des "___" dans l'énoncé, resté en
    // texte brut — voir TYPES_ENONCE_PLAT), mais l'élève glisse un mot
    // depuis une banque proposée au lieu de taper une réponse libre. Le bon
    // mot par trou (c.bonneReponse) est une chaîne piochée dans la banque
    // (q.banqueMots, publique — peut contenir des intrus en plus des bonnes
    // réponses).
    const nbTrous = (String(q.enonce || '').match(/___/g) || []).length;
    const banque = Array.isArray(q.banqueMots) ? q.banqueMots : [];
    const reponsesTrous = !enAttente && Array.isArray(c.bonneReponse) ? c.bonneReponse : [];
    corpsCorrige = `
      <div class="trous-glisser-champ">
        <p class="note-future">Utilise <code>___</code> (3 tirets bas) dans l'énoncé ci-dessus pour chaque trou. ${nbTrous} trou${nbTrous > 1 ? 's' : ''} détecté${nbTrous > 1 ? 's' : ''} pour l'instant.</p>
        <label>Mots proposés dans la banque (séparés par une virgule — inclus les bonnes réponses, et si tu veux des intrus en plus)
          <input type="text" data-question-banque-mots value="${echapper(banque.join(', '))}" placeholder="Ex: chat, chien, souris" ${enAttente ? 'disabled' : ''}>
        </label>
        ${Array.from({ length: nbTrous }).map((_, i) => `
          <div class="champ-ligne">
            <label>Trou ${i + 1} — bon mot (parmi la banque)</label>
            <select data-question-trou-glisser-index="${i}" ${enAttente ? 'disabled' : ''}>
              <option value="">— choisir —</option>
              ${banque.map((m) => `<option value="${echapper(m)}" ${reponsesTrous[i] === m ? 'selected' : ''}>${echapper(m)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>`;
  }

  const enonceRiche = !TYPES_ENONCE_PLAT.includes(q.type);

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
      ${enonceRiche
        ? html_zoneTexteRiche(`data-question-champ-riche="enonce" data-question-riche-id="${q.id}"`, q.enonce, 'barre-outils-texte-question')
        : `<textarea data-question-champ="enonce" placeholder="Énoncé de la question...">${echapper(q.enonce)}</textarea>`}
      <input type="text" data-question-champ="consigne" placeholder="Consigne pour l'élève (optionnel — ex : « Complète les mots manquants »)" value="${echapper(q.consigne)}">
      ${corpsCorrige}
      ${html_commentaireQuestion(q, c, enAttente)}
    </div>`;
}

// Commentaire enseignant (11 septembre 2026), pour toutes les questions à
// correction AUTOMATIQUE (pas reponse_longue/vrai_faux_justifie, qui ont déjà
// un champ de commentaire équivalent — le barème indicatif lu par l'IA, qui
// génère elle-même sa propre explication). Stocké dans le corrigé privé
// (c.commentaire, comme c.bareme) — jamais envoyé à l'élève tant qu'il n'a
// pas répondu — puis rendu après sa correction (voir corriger-exercice et
// rendreResultatExercice/rendreResultatExerciceDevoir côté élève).
const TYPES_QUESTION_SANS_COMMENTAIRE_DEDIE = ['reponse_longue', 'vrai_faux_justifie'];
function html_commentaireQuestion(q, c, enAttente) {
  if (TYPES_QUESTION_SANS_COMMENTAIRE_DEDIE.includes(q.type)) return '';
  const commentaire = c ? (c.commentaire || '') : '';
  return `
    <div class="commentaire-question-champ">
      <label>💬 Commentaire pour l'élève (optionnel — affiché après sa réponse, pour expliquer la correction si besoin)</label>
      <textarea data-question-commentaire placeholder="Ex : Attention, on n'accorde pas l'adjectif avec le nom complément..." ${enAttente ? 'disabled' : ''}>${echapper(commentaire)}</textarea>
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

// Rend un bloc "HTML libre" (11 septembre 2026 — reconstruit, voir la note
// dans TYPES_BLOCS ci-dessus). c.code est un document HTML COMPLET, avec ses
// propres balises <style>/<svg>/<table>... : l'injecter directement dans la
// page comme les autres blocs de texte (via innerHTML) ferait fuiter ses
// styles sur tout le site (ex: une règle "body{...}" du code collé
// s'appliquerait à la vraie page). On l'isole donc dans un <iframe srcdoc>,
// qui lui donne son propre document/head/body. `sandbox=""` (toutes les
// restrictions activées, aucune levée) : le CSS/SVG/tableaux s'affichent
// normalement — seul le chargement des ressources est concerné, jamais les
// scripts — mais aucun <script> ne peut s'y exécuter, aucune redirection de
// la page, aucun accès aux cookies/au stockage du site. Ce bloc est réservé
// à du contenu statique (schémas, tableaux personnalisés...), jamais à du
// HTML interactif. Fonction partagée (comme contenuRicheInitial ci-dessus)
// entre la vraie page élève (js/pages/eleve-seance.js) et l'aperçu élève de
// l'éditeur (js/pages/editeur-seance.js), pour qu'ils restent identiques.
function html_blocHtmlLibre(code, titre) {
  return `<iframe class="cadre-html-libre" srcdoc="${echapper(code)}" sandbox="" loading="lazy" title="${echapper(titre || 'Contenu personnalisé')}"></iframe>`;
}
