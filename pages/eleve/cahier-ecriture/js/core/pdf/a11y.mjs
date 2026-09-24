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
 * Utilitaires d'accessibilité pour le dialogue PDF.
 *
 * `piegerFocus(dialog, { onEscape })` met en place un focus trap WAI-ARIA
 * standard : Tab/Shift+Tab cyclent dans les éléments focusables du dialogue,
 * Escape appelle le callback `onEscape`. Retourne une fonction `cleanup()`
 * à appeler à la fermeture du dialogue pour retirer les listeners.
 *
 * Référence : https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

const SELECTEUR_FOCUSABLE = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

/**
 * Liste les éléments focusables à l'intérieur du conteneur, dans l'ordre de
 * tabulation naturel.
 *
 * @param {HTMLElement} conteneur
 * @returns {HTMLElement[]}
 */
function elementsFocusables(conteneur) {
	return Array.from(conteneur.querySelectorAll(SELECTEUR_FOCUSABLE)).filter(
		(el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
	);
}

/**
 * Pose un focus trap sur `dialog` : Tab/Shift+Tab cyclent dans le dialogue,
 * Escape déclenche `onEscape`. Les listeners sont attachés sur le dialogue
 * lui-même (phase de capture pour intercepter avant les handlers internes).
 *
 * @param {HTMLElement} dialog - Conteneur du dialogue modal.
 * @param {{ onEscape?: () => void }} [options]
 * @returns {() => void} Fonction de cleanup à appeler à la fermeture.
 */
export function piegerFocus(dialog, options) {
	const onEscape = options && options.onEscape;

	const gestionnaire = (event) => {
		if (event.key === "Escape" && typeof onEscape === "function") {
			event.preventDefault();
			onEscape();
			return;
		}
		if (event.key !== "Tab") return;

		const focusables = elementsFocusables(dialog);
		if (focusables.length === 0) {
			event.preventDefault();
			return;
		}
		const premier = focusables[0];
		const dernier = focusables[focusables.length - 1];
		const actif = document.activeElement;

		if (event.shiftKey && actif === premier) {
			event.preventDefault();
			dernier.focus();
		} else if (!event.shiftKey && actif === dernier) {
			event.preventDefault();
			premier.focus();
		}
	};

	dialog.addEventListener("keydown", gestionnaire);

	return function cleanup() {
		dialog.removeEventListener("keydown", gestionnaire);
	};
}

/**
 * Marque tous les enfants directs de `<body>` comme `inert`, sauf ceux
 * présents dans `exceptions`. Retourne une fonction de cleanup qui
 * restaure l'état initial.
 *
 * @param {HTMLElement[]} exceptions - Éléments à ne pas rendre inert.
 * @returns {() => void}
 */
export function marquerFondInert(exceptions) {
	const exemptions = new Set(exceptions || []);
	const cibles = Array.from(document.body.children).filter((el) => !exemptions.has(el));
	const etatPrecedent = cibles.map((el) => ({ el, inert: el.inert }));
	cibles.forEach((el) => {
		el.inert = true;
	});

	return function restaurer() {
		etatPrecedent.forEach(({ el, inert }) => {
			el.inert = inert;
		});
	};
}
