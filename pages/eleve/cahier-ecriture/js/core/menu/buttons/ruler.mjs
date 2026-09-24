import { config } from "../../config.mjs";
import { page, barre } from "../../utils/dom.mjs";

export function activeRegle() {
	config.regleActive = !config.regleActive;
	page.classList.toggle("trace");
	barre.classList.toggle("trace");
	document.getElementById("regle").classList.toggle("trace");

	if (!config.regleActive) {
		page.style.cursor = null;
	}
}

export function changeCouleurTrait(couleur) {
	if (config.selected) {
		config.selected.style.backgroundColor = couleur;
		config.selected.classList.remove("select");
		config.selected = null;
	} else {
		alert("Aucun trait n'est sélectionné.");
	}
}
