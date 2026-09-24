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
 * Opérations d'aperçu PDF partageables entre l'aperçu et l'export.
 *
 * Extrait de dialogue-pdf.mjs (plan refactoring Phase 5).
 *
 * Approche conservatrice : seules les fonctions les plus pures / DOM-adapters
 * sans état sont extraites. Les méthodes stateful (`_genererApercu`,
 * `_captureAllPages`, `_afficherPage`, navigation) restent dans la classe
 * `DialoguePdf` car elles consomment et mutent un contexte complexe
 * (`this.pagesApercu`, `this.pageActuelle`, etc.).
 */

import { journaliseur } from "./journaliseur.mjs";

/**
 * Applique le masquage anti-coupure cursive sur un clone de document.
 * Rend `visibility: hidden` les éléments portant `data-seyes-ligne="X"`
 * correspondant aux `indexVisuel` listés dans `lignesAMasquer`.
 *
 * @param {Document|HTMLElement} documentClone - Document du clone SnapDOM.
 * @param {Array<{indexSeyes:number, indexVisuel:number, type:"precedente"|"suivante"}>} lignesAMasquer
 * @param {{decalageY:number, hauteur:number}|null} [infosCapture] - Optionnel, pour le logging debug.
 */
export function appliquerMasquageLignesDansClone(documentClone, lignesAMasquer, infosCapture = null) {
	const tousLesMarques = documentClone.querySelectorAll("[data-seyes-ligne]");
	journaliseur.debug("MASQUAGE_DETAIL", `Clone contient ${tousLesMarques.length} éléments marqués`);

	const conteneurClone = documentClone.getElementById
		? documentClone.getElementById("conteneur-extensible")
		: documentClone.querySelector("#conteneur-extensible");
	const conteneurRect = conteneurClone ? conteneurClone.getBoundingClientRect() : { top: 0 };

	tousLesMarques.forEach((el) => {
		if (el.textContent.includes("ses")) {
			const elRect = el.getBoundingClientRect();
			const positionRelative = elRect.top - conteneurRect.top;
			journaliseur.debug("MASQUAGE_DETAIL", `Élément "ses": data-seyes-ligne=${el.getAttribute("data-seyes-ligne")}, posY=${positionRelative.toFixed(2)}, contenu="${el.textContent.substring(0, 40)}"`);

			if (infosCapture) {
				const dansZone = positionRelative >= infosCapture.decalageY &&
								 positionRelative < (infosCapture.decalageY + infosCapture.hauteur);
				journaliseur.debug("MASQUAGE_DETAIL", `  → Zone capture: ${infosCapture.decalageY.toFixed(0)} à ${(infosCapture.decalageY + infosCapture.hauteur).toFixed(0)}, élément à ${positionRelative.toFixed(0)}: ${dansZone ? "DANS ZONE" : "HORS ZONE"}`);
			}
		}
	});

	lignesAMasquer.forEach((ligneAMasquer) => {
		const elementsAMasquer = documentClone.querySelectorAll(
			`[data-seyes-ligne="${ligneAMasquer.indexVisuel}"]`,
		);

		journaliseur.debug("MASQUAGE_DETAIL", `Masquage indexVisuel=${ligneAMasquer.indexVisuel}: ${elementsAMasquer.length} éléments trouvés`);

		elementsAMasquer.forEach((el) => {
			journaliseur.debug("MASQUAGE_DETAIL", `  → MASQUÉ: "${el.textContent.substring(0, 50)}"`);
			el.style.visibility = "hidden";
		});
	});
}

