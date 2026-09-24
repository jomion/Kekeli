import { config } from "../../config.mjs";
import {
	case2,
	case3,
	divMarge,
	divMargeEntete,
	page,
} from "../../utils/dom.mjs";
import { stocke } from "../../settings/read-write.mjs";
import { majDimensionsPrint } from "../display/print.mjs";

export function adapteMargeCahierDeTexte(valeur = 0) {
	config.largeur_marge = config.largeur_carreau * valeur;
	page.style.width = case3.style.width =
		"calc(100% - " + config.largeur_marge + "px)";
	divMarge.style.width = config.largeur_marge - 3 + "px";
	document.documentElement.style.setProperty(
		"--largeur-marge-impression",
		config.largeur_marge - 3 + "mm"
	);

	divMargeEntete.style.width = config.largeur_marge + "px";
	document.documentElement.style.setProperty(
		"--largeur-marge-secondaire",
		config.largeur_carreau * 2.7 + "px"
	);
	document.documentElement.style.setProperty(
		"--largeur-marge2-impression",
		config.largeur_carreau * 2.7 + "mm"
	);
}

// Règle la largeur de la marge principale
export function regleMarge(largeur) {
	config.largeur_marge = largeur;
	page.style.width = case3.style.width = `calc(100% - ${largeur}px)`;
	divMarge.style.width = `${largeur - 3}px`;
	divMargeEntete.style.width = `${largeur}px`;
	stocke("largeur-marge", config.largeur_marge);
	majDimensionsPrint();
}

// Règle la largeur de la marge secondaire
export function regleMargeSecondaire(largeur) {
	if (largeur >= 3) {
		config.largeur_marge_secondaire = largeur;
		config.margeSecondaire.style.width = case2.style.width = `${largeur - 3}px`;
		stocke("largeur-marge-secondaire", config.largeur_marge_secondaire);
		majDimensionsPrint();
	}
}
