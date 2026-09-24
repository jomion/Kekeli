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
 * Gestion des marges du dialogue PDF.
 *
 * DOM-adapters extraits de dialogue-pdf.mjs (plan refactoring Phase 3).
 * Aucun état interne : la fonction `lireMarges` retourne un objet que la
 * classe DialoguePdf peut affecter à `this.options.marges`.
 */

/**
 * Affiche/masque le bloc de marges personnalisées selon la valeur du type.
 *
 * @param {"defaut"|"sans"|"personnalisees"} type
 */
export function basculerMarges(type) {
	const divMarges = document.getElementById("marges-personnalisees");
	if (divMarges) {
		divMarges.style.display = type === "personnalisees" ? "block" : "none";
	}
}

/**
 * Variante appelée depuis le `<select>` de type de marges : lit la valeur
 * courante et délègue à `basculerMarges`.
 */
export function basculerMargesSelect() {
	const margesSelect = document.getElementById("type-marges-pdf");
	if (margesSelect) {
		basculerMarges(margesSelect.value);
	}
}

/**
 * Valide une valeur de marge saisie par l'utilisateur. Format FR accepté
 * (virgule comme séparateur décimal). Valeur arrondie à 1 décimale.
 * Plage acceptée : [0, 10] cm.
 *
 * @param {HTMLInputElement} input
 */
export function validerMarge(input) {
	const valeur = input.value.replace(",", ".");
	const nombre = parseFloat(valeur);

	if (isNaN(nombre) || nombre < 0 || nombre > 10) {
		input.setCustomValidity("Valeur entre 0 et 10 cm");
	} else {
		input.setCustomValidity("");
		input.value = nombre.toFixed(1).replace(".", ",");
	}
}

/**
 * Lit les valeurs des inputs de marges personnalisées et les convertit
 * en millimètres. Fallback à 20 mm si l'input est absent ou la valeur
 * non numérique.
 *
 * @returns {{haut:number, bas:number, gauche:number, droite:number}}
 */
export function lireMargesPersonnalisees() {
	const lireValeur = (id) => {
		const input = document.getElementById(id);
		if (input) {
			const valeur = parseFloat(input.value.replace(",", "."));
			return isNaN(valeur) ? 20 : valeur * 10; // cm → mm
		}
		return 20;
	};

	return {
		haut: lireValeur("marge-haut"),
		bas: lireValeur("marge-bas"),
		gauche: lireValeur("marge-gauche"),
		droite: lireValeur("marge-droite"),
	};
}
