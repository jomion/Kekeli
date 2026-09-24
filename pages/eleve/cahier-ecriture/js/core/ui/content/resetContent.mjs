import { config } from "../../config.mjs";
import { creeDate } from "../../date/date.mjs";
import {
	graphismes,
	images,
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
} from "../../utils/dom.mjs";

export function resetContent() {
	// Réinitialiser le contenu HTML de divers éléments
	texte_principal.innerHTML = "";
	graphismes.innerHTML = "";
	images.innerHTML = "";
	texte_marge.innerHTML = texte_marge_complementaire.innerHTML = "";

	if (config.ajouterLaDate) {
		creeDate();
	}

	// Mettre le focus sur l'élément texte_principal
	texte_principal.focus();

	// Créer un objet Range pour manipuler la position du curseur
	const range = document.createRange();
	const selection = window.getSelection();

	// Trouver la dernière balise <br> et positionner le curseur juste après
	const brElements = texte_principal.getElementsByTagName("br");
	if (brElements.length > 0) {
		const lastBr = brElements[brElements.length - 1];
		range.setStartAfter(lastBr); // Place le curseur après le dernier <br>
		range.collapse(true); // Fusionne le point de début et de fin pour positionner le curseur
		selection.removeAllRanges(); // Vide la sélection actuelle
		selection.addRange(range); // Ajoute la nouvelle plage
	}
}
