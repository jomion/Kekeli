import { config } from "../../config.mjs";
import { zoom } from "../zoom/zoom.mjs";
import { stocke } from "../../settings/read-write.mjs";
import {
	divEntete,
	page,
	divMarge,
	marge,
	margeSecondaire,
} from "../../utils/dom.mjs";
import { adapteMargeCahierDeTexte } from "../layout/margin-manager.mjs";

export function changeCarreaux(type) {
	let ancienTypeCareaux = config.typeCarreaux;

	config.typeCarreaux = type;
	if (config.typeCarreaux) {
		marge.style.backgroundImage =
			"url('./images/carreau_marge_" + config.typeCarreaux + ".svg";
		margeSecondaire.style.backgroundImage =
			"url('./images/carreau_marge_" + config.typeCarreaux + ".svg";

		page.style.backgroundImage =
			"url('./images/carreau_" + config.typeCarreaux + ".svg";
		document.getElementById(
			"carreaux"
		).style.backgroundImage = `url(./images/carreau_${type}.svg`;
	}
	if (type === "terre") {
		page.style.borderLeft = "none";
	} else {
		page.style.borderLeft = null;
	}
	if (type === "cahier_de_textes") {
		margeSecondaire.style.display = "block";
		adapteMargeCahierDeTexte(7);
		divMarge.style.borderRightColor = "#000000";
		divEntete.style.display = "flex";
	} else {
		margeSecondaire.style.display = null;
		divEntete.style.display = "none";
		if (ancienTypeCareaux === "cahier_de_textes") {
			adapteMargeCahierDeTexte(4);
		}
		divMarge.style.borderRightColor = null;
	}
	zoom(0, false, config.police_active);
	stocke("type-carreaux", config.typeCarreaux);
}
