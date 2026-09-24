import { jours } from "../../../_locales/date-days.mjs";
import { choixCouleurEntete, divEntete } from "../../utils/dom.mjs";
import { stocke } from "../../settings/read-write.mjs";

export function changeCouleurEntete(couleur) {
	// Récupérer le jour sélectionné dans le select
	let jourActif = document.getElementById("select-jours").value;

	// Mettre à jour la couleur dans l'objet jours pour le jour sélectionné
	jours[jourActif] = couleur;

	// Appliquer la couleur en arrière-plan de divEntete
	divEntete.style.backgroundColor = couleur;
	choixCouleurEntete.style.backgroundColor = couleur;
	adapteCouleurBordureChoixCouleur();

	// Sauvegarder le réglage de couleur des jours
	stocke("couleurs-jours", JSON.stringify(jours));
}

export function adapteCouleurBordureChoixCouleur() {
	let couleurFond = choixCouleurEntete.value;

	// Convertir la couleur HEX en RGB
	function hexToRgb(hex) {
		let r = 0,
			g = 0,
			b = 0;

		// Si la couleur est définie en hexadécimal
		if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		} else if (hex.length === 7) {
			r = parseInt(hex[1] + hex[2], 16);
			g = parseInt(hex[3] + hex[4], 16);
			b = parseInt(hex[5] + hex[6], 16);
		}

		return [r, g, b];
	}

	// Calculer la luminosité de la couleur
	function luminosite(rgb) {
		return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
	}

	// Changer la couleur de la bordure selon la luminosité
	let rgb = hexToRgb(couleurFond);
	let lumi = luminosite(rgb);

	// Si la luminosité est inférieure à un seuil, mettre la bordure en blanc
	if (lumi < 128) {
		choixCouleurEntete.style.borderColor = "white"; // Couleur de bordure blanche
	} else {
		choixCouleurEntete.style.borderColor = "black"; // Couleur de bordure noire
	}
}
