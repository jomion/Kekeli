import { config } from "../../config.mjs";
import { inputNombreDeCarreaux } from "../../utils/dom.mjs";
import { calculerLargeurTextePrincipal } from "../layout/getSize.mjs";
import { zoom } from "./zoom.mjs";

export function zoomAutoCarreaux() {
	// Vérification de l'input
	let entree = parseInt(inputNombreDeCarreaux.value);
	if (isNaN(entree) || entree === 0) {
		entree = 5;
	}

	// Mise à jour du nombre de carreaux
	config.nombreDeCarreaux = entree;
	inputNombreDeCarreaux.value = config.nombreDeCarreaux;

	// Largeur de page
	const largeurPage = calculerLargeurTextePrincipal();

	// Largeur de carreau à atteindre
	let largeurDeCarreauAAtteindre = largeurPage / config.nombreDeCarreaux;

	// Application
	zoom(false, largeurDeCarreauAAtteindre, config.police_active);
}
