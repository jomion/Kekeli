import { config } from "../../config.mjs";
import { divMarge, margeSecondaire, page } from "../../utils/dom.mjs";

export function imprimer() {
	window.print();
}

export function majDimensionsPrint() {
	config.largeur_page = page.offsetWidth;
	config.largeur_marge = divMarge.offsetWidth;
	config.largeur_marge_secondaire = margeSecondaire.offsetWidth;
	config.largeur_page_impression =
		(config.largeur_page / config.largeur_carreau) *
		config.largeurImpression *
		4;
	config.largeur_marge_impression =
		(config.largeur_marge / config.largeur_carreau) *
		config.largeurImpression *
		4;
	config.largeur_marge_secondaire_impression =
		(config.largeur_marge_secondaire / config.largeur_carreau) *
		config.largeurImpression *
		4;
	document.documentElement.style.setProperty(
		"--largeur-page-impression",
		config.largeur_page_impression + "mm"
	);
	document.documentElement.style.setProperty(
		"--largeur-marge-impression",
		config.largeur_marge_impression + "mm"
	);
	document.documentElement.style.setProperty(
		"--largeur-marge2-impression",
		config.largeur_margesecondaire_impression + "mm"
	);
}
