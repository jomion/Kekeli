import { config } from "../../config.mjs";
import { souligne } from "../../text-format/underline.mjs";
import { refresh } from "./hacksafari.mjs";

export function handleKeyboard() {
	window.addEventListener("keydown", function (event) {
		// Hack pour forcer un refresh sur Safari
		setTimeout(function () {
			refresh();
		}, 100);

		// Vérifie si la touche "Suppr" (Delete) est appuyée
		if (event.key === "Delete") {
			// Si un élément est sélectionné, le supprimer
			if (config.selected) {
				config.selected.remove(); // Supprime l'élément du DOM
				config.selected = false; // Réinitialise la variable
			}
		}
		// Si l'utilisateur a voulu souligner du texte avec Ctrl+U (Cmd+U sur Mac)
		if ((event.ctrlKey || event.metaKey) && event.key === "u") {
			// On empêche le comportement par défaut du navigateur, qui dans certains cas, va ajouter une balise <u> autour du texte sélectionné, ce qui n'est pas souhaité ici.
			event.preventDefault();
			// On récupère la couleur du bouton de soulignement
			const couleurBouton = document.querySelector("#souligne")
				? document.querySelector("#souligne").value
				: "red";
			if (couleurBouton) {
				souligne(couleurBouton);
			}
		}
		// Si la touche Backspace est appuyée et si le caractère avant le caractère qui va être supprimé est un zero-width space (U+200B), on supprime aussi ce caractère
		if (event.key === "Backspace") {
			const sel = window.getSelection();
			if (sel.rangeCount > 0) {
				const range = sel.getRangeAt(0);
				if (range.startOffset > 0) {
					const textNode = range.startContainer;
					if (textNode.nodeType === Node.TEXT_NODE) {
						const text = textNode.textContent;
						if (text[range.startOffset - 1] === "\u200B") {
							textNode.textContent =
								text.slice(0, range.startOffset - 1) +
								text.slice(range.startOffset);
							range.setStart(textNode, range.startOffset - 1);
							range.setEnd(textNode, range.startOffset - 1);
							sel.removeAllRanges();
							sel.addRange(range);
						}
					}
				}
			}
		}
	});
}
