/*
 * This file is part of Seyes.
 *
 * Copyright (C) 2025-2026 Yannick Defais <yannick.defais@ac-creteil.fr>
 *
 * Seyes is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Seyes is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Seyes. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Typologie des lignages Seyes pour la capture PDF.
 *
 * Certains types de lignage sélectionnables via le bouton « changer le
 * lignage » utilisent un SVG source au viewBox rectangulaire 1×2 (hauteur
 * = 2 × largeur). Leur motif (bandes colorées) s'étend sur 2 lignes du
 * quadrillage au lieu d'une seule. À l'écran, le navigateur rasterise
 * correctement la tuile en respectant son ratio natif. À la capture PDF
 * cependant, `normaliserCSSPourCapture` force `background-size` à la taille
 * d'UN carreau (cf. invariant 6 seyes-pdf-guard), ce qui compresse
 * verticalement la tuile 1×2.
 *
 * Ce module expose la liste des types concernés et un helper `ratioHauteurTuile`
 * consommé par `normalisation-css.mjs` pour calculer la bonne hauteur de
 * `background-size` en capture. Un futur lignage 2× s'ajoute en une ligne
 * dans `TYPES_LIGNAGE_DEUX_LIGNES`.
 *
 * SVG concernés (`web/images/carreau_*.svg`) :
 *   carreau_terre.svg            — viewBox="0 0 33.867 67.734", height=256
 *   carreau_trois_couleurs.svg   — viewBox="0 0 33.867 67.734", height=256
 *   carreau_quatre_couleurs.svg  — viewBox="0 0 33.867 67.734", height=256
 *   carreau_bleuviolet.svg       — viewBox="0 0 33.867 67.734", height=256
 *
 * Cette liste est dupliquée d'une liste similaire dans
 * `web/js/core/ui/zoom/zoom.mjs` qui double le `line-height` du texte
 * pour ces mêmes types (territoire upstream, pas d'import direct côté
 * fork PDF). Après chaque merge upstream, vérifier la cohérence :
 * si upstream ajoute un 5e type 2×, l'ajouter ici aussi.
 */

/**
 * Types de lignage dont le SVG source a un ratio 1×2 (tuile deux fois plus
 * haute que large).
 *
 * @type {ReadonlyArray<string>}
 */
export const TYPES_LIGNAGE_DEUX_LIGNES = Object.freeze([
	"terre",
	"trois_couleurs",
	"quatre_couleurs",
	"bleuviolet",
	// Ajouter ici les futurs lignages 2×.
]);

/**
 * Retourne true si le typeCarreaux désigne un lignage « sur 2 lignes ».
 *
 * @param {string|null|undefined} typeCarreaux
 * @returns {boolean}
 */
export function estLignageDeuxLignes(typeCarreaux) {
	return TYPES_LIGNAGE_DEUX_LIGNES.includes(typeCarreaux);
}

/**
 * Retourne le ratio de hauteur de tuile SVG pour un type de lignage donné.
 * 2 pour les lignages « sur 2 lignes », 1 sinon (défaut sûr pour les types
 * inconnus, null ou undefined).
 *
 * Utilisé par `normaliserCSSPourCapture` pour calculer
 * `background-size: ${carreau}px × ${ratio × carreau}px` dans le clone SnapDOM.
 *
 * @param {string|null|undefined} typeCarreaux
 * @returns {1 | 2}
 */
export function ratioHauteurTuile(typeCarreaux) {
	return estLignageDeuxLignes(typeCarreaux) ? 2 : 1;
}
