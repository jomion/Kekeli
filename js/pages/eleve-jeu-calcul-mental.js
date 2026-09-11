// Page pages/eleve/jeu-calcul-mental.html — jeu "Cadran opératoire / Calcul
// mental" (lot "Jeux éducatifs interactifs", 11 septembre 2026, douzième
// requête). Reprend le cadran visuel du fichier de référence fourni
// ("Cadran opératoire.html") en flourish COSMÉTIQUE : il ne s'anime que
// lorsque la vraie question tirée des séances de la classe (matière
// Mathématiques, champ_formation_id = 2) est un calcul simple détectable
// ("A + B", "7 x 8"...) — voir jeuAnalyserCalculSimple dans
// js/jeux/moteur-jeu-arcade.js. Sinon la question s'affiche normalement,
// sans jamais inventer un contenu qui ne correspondrait pas à l'énoncé réel.
//
// Intègre aussi le réglage "masquer l'affichage de l'opération pour
// entraîner la mémoire" (preferences_navigation.masquer_operation_jeux,
// réglable depuis Paramètres) : tant qu'il est actif, le centre/l'opérateur/
// le nombre cible du cadran (et le texte de l'énoncé) restent cachés jusqu'à
// ce que l'élève clique sur "👁️ Revoir l'opération" (bouton géré par
// js/jeux/coquille-jeu-arcade.js).

// Positionne les 13 nombres du cadran en cercle (mêmes coordonnées polaires
// que le fichier de référence : rayon 80, décalage du centre 105 — voir
// css/jeux-arcade.css #jeu-dial-wrap 210x210).
function dessinerCadranCosmetique(container, { centre, operateur, cible, masque }) {
  const total = 13;
  const radius = 80;
  const centerOffset = 105;
  const symboles = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  let html = `<div class="jeu-dial-wrap">
    <div class="jeu-dial-center jeu-dial-actif">${masque ? '❓' : centre}</div>
    <div class="jeu-dial-op jeu-dial-actif" style="top:18px;left:${centerOffset}px">${masque ? '' : (symboles[operateur] || operateur)}</div>`;

  for (let i = 0; i < total; i++) {
    const val = i; // disposition "ordonnée" (0 à 12) — la plus lisible pour un cadran cosmétique
    const angle = (i * (2 * Math.PI / total)) - (Math.PI / 2);
    const x = centerOffset + radius * Math.cos(angle);
    const y = centerOffset + radius * Math.sin(angle);
    const estCible = !masque && cible === val;
    html += `<div class="jeu-dial-outer-num${estCible ? ' jeu-dial-actif' : ''}" style="left:${x}px;top:${y}px">${masque ? '' : val}</div>`;
  }
  html += `</div>`;
  container.insertAdjacentHTML('afterbegin', html);
}

function transformerZoneCalculMental(zoneEl, q, etat) {
  if (q.type !== 'reponse_numerique') return;
  const calc = jeuAnalyserCalculSimple(q.enonce);
  if (!calc || !Number.isInteger(calc.b) || calc.b < 0 || calc.b > 12) return; // pas un calcul simple exploitable par le cadran : on garde l'affichage texte normal
  const masque = etat.masquerOperation && etat.operationReveleeIndex !== etat.index;
  dessinerCadranCosmetique(zoneEl, { centre: calc.a, operateur: calc.op, cible: calc.b, masque });
}

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profil.id, badgeHtml: `🟢 ${profil.prenom}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  const classeId = await jeuTrouverClasseEleve(profil.id);
  const jeu = creerJeuArcade({
    champFormationIds: [2], // Mathématiques
    dureesParDefautSecondes: 12,
    permettreMasquerOperation: true,
    transformerZoneQuestion: transformerZoneCalculMental,
  });
  await jeu.init(profil, classeId);
})();
