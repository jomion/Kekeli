import { divContenu, texte_principal } from "../../utils/dom.mjs";

export function ajusterScroll(coefAgrandissement) {
	// Hauteur du texte avant zoom
	let hauteurTexte = texte_principal.scrollHeight;
	let hauteurPage = divContenu.clientHeight;
	let scrollDebut = divContenu.scrollTop;

	// Si tout le texte tient dans l'écran, on remet le scroll en haut.
	if (hauteurTexte * coefAgrandissement <= hauteurPage) {
		divContenu.scrollTop = 0;
		return;
	}

	// Calcul de la position relative du centre de l'écran dans le texte (entre 0 et 1)
	let positionRelative = (scrollDebut + hauteurPage / 2) / hauteurTexte;

	// Nouvelle hauteur du texte après zoom
	let hauteurTexteApresZoom = hauteurTexte * coefAgrandissement;

	// Nouvelle position après zoom (toujours centrée au même endroit)
	let nouveauScroll =
		positionRelative * hauteurTexteApresZoom - hauteurPage / 2;

	// Correction progressive pour éviter l'effet d'écrasement en bas
	let correctif = Math.pow(coefAgrandissement, 1.2); // Ajustement plus progressif en bas

	nouveauScroll *= correctif;

	// Sécurité : on s'assure que le scroll reste dans les limites valides
	nouveauScroll = Math.max(
		0,
		Math.min(nouveauScroll, hauteurTexteApresZoom - hauteurPage)
	);

	// Application du scroll
	divContenu.scrollTop = nouveauScroll;
}
