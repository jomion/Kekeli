import { calculeNombreDeCarreaux } from "../layout/getSize.mjs";
import { config } from "../../config.mjs";
import {
	graphismes,
	marge,
	margeSecondaire,
	page,
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
} from "../../utils/dom.mjs";
import { typesPolices } from "../../text-format/fonts/font-params.mjs";
import { stocke } from "../../settings/read-write.mjs";
import { majDimensionsPrint } from "../display/print.mjs";
import { ajusterScroll } from "./adjustScroll.mjs";

let calc_marge;
let calc_marge_double;

export function zoom(coef, largeur, police) {
	// Mise à jour de la largeur et de la taille de police
	config.largeur_carreau_old = config.largeur_carreau;

	if (coef) {
		config.largeur_carreau = config.largeur_carreau + coef;
	} else if (largeur) {
		config.largeur_carreau = largeur;
	}

	let coefAgrandissement = config.largeur_carreau / config.largeur_carreau_old;

	// Ajuster le scroll
	if (coef) {
		ajusterScroll(coefAgrandissement);
	}

	// Calculs supplémentaires pour la police et les marges
	let largeur_carreau_impression = config.largeurImpression * 4;
	config.taille_police = config.largeur_carreau * config.facteur_taille_police;
	let taille_police_impression =
		largeur_carreau_impression * config.facteur_taille_police;

	texte_principal.style.fontWeight = config.epaisseur_police;
	texte_marge.style.fontWeight = config.epaisseur_police;
	texte_marge_complementaire.style.fontWeight = config.epaisseur_police;

	let calc_marge_impression;
	let calc_marge_double_impression;
	if (config.isWindows) {
		calc_marge = config.largeur_carreau * config.coef_marge_windows;
		calc_marge_double =
			config.largeur_carreau * config.coef_marge_double_windows;
		calc_marge_impression =
			largeur_carreau_impression * config.coef_marge_windows;
		calc_marge_double_impression =
			config.largeur_carreau * config.coef_marge_double_windows;
	} else {
		calc_marge = config.largeur_carreau * config.coef_marge;
		calc_marge_double = config.largeur_carreau * config.coef_marge_double;
		calc_marge_impression = largeur_carreau_impression * config.coef_marge;
		calc_marge_double_impression =
			largeur_carreau_impression * config.coef_marge_double;
	}

	if (police === "Open Dyslexic") {
		calc_marge = calc_marge * 0.9;
	}

	page.style.backgroundSize = config.largeur_carreau + "px";
	marge.style.backgroundSize = config.largeur_carreau + "px";
	margeSecondaire.style.backgroundSize = config.largeur_carreau + "px";

	document.documentElement.style.setProperty(
		"--largeur-carreau-impression",
		`${largeur_carreau_impression}mm`,
	);
	texte_principal.style.fontSize = config.taille_police + "px";
	document.documentElement.style.setProperty(
		"--taille-police-impression",
		`${taille_police_impression}mm`,
	);
	texte_principal.style.marginLeft = config.largeur_carreau / 5 + "px";
	texte_principal.style.marginRight = config.largeur_carreau / 5 + "px";
	texte_marge.style.fontSize = texte_marge_complementaire.style.fontSize =
		config.taille_police + "px";
	texte_marge.style.marginTop = texte_marge_complementaire.style.marginTop =
		calc_marge + "px";
	texte_marge.style.marginLeft = texte_marge_complementaire.style.marginLeft =
		config.largeur_carreau / 5 + "px";
	texte_marge.style.marginRight = texte_marge_complementaire.style.marginRight =
		config.largeur_carreau / 5 + "px";
	document.documentElement.style.setProperty(
		"--marge-impression",
		`${largeur_carreau_impression / 5}mm`,
	);

	// Ajustement de l'interligne et des marges
	if (
		config.typeCarreaux === "terre" ||
		config.typeCarreaux === "bleuviolet" ||
		config.typeCarreaux === "trois_couleurs" ||
		config.typeCarreaux === "quatre_couleurs" ||
		config.interligneDouble
	) {
		texte_marge.style.lineHeight = 2 * config.largeur_carreau + "px";
		texte_principal.style.lineHeight = 2 * config.largeur_carreau + "px";
		document.documentElement.style.setProperty(
			"--hauteur-ligne-impression",
			`${2 * largeur_carreau_impression}mm`,
		);
		console.log("Police", config.police_active, "Marge top", calc_marge_double);
		texte_principal.style.marginTop = calc_marge_double + "px";
		document.documentElement.style.setProperty(
			"--marge-top-impression",
			`${calc_marge_double_impression}mm`,
		);
	} else {
		texte_marge_complementaire.style.lineHeight = texte_marge.style.lineHeight =
			config.largeur_carreau + "px";
		texte_principal.style.lineHeight = config.largeur_carreau + "px";
		document.documentElement.style.setProperty(
			"--hauteur-ligne-impression",
			`${largeur_carreau_impression}mm`,
		);
		texte_principal.style.marginTop = calc_marge + "px";
		document.documentElement.style.setProperty(
			"--marge-top-impression",
			`${calc_marge_impression}mm`,
		);
	}

	document.documentElement.style.setProperty(
		"--largeur-marge-secondaire",
		config.largeur_carreau * 2.7 + "px",
	);

	document.documentElement.style.setProperty(
		"--distance-barre",
		config.distance_barre,
	);

	// Mise à jour des éléments de texte personnalisés
	const tousLesSpanCustomFont = document.querySelectorAll(".customfont");
	tousLesSpanCustomFont.forEach((span) => {
		// Utilisation de getComputedStyle pour récupérer la propriété fontFamily réelle
		let policeCustom = getComputedStyle(span).fontFamily.trim(); // trim() pour éviter les espaces indésirables
		let facteurCustom = typesPolices[policeCustom]
			? typesPolices[policeCustom].facteur_taille_police
			: null; // Utilisation de la clé policeCustom dans l'objet typesPolices

		if (facteurCustom) {
			span.style.fontSize = span.style.lineHeight =
				config.largeur_carreau * facteurCustom + "px";
		} else {
			console.warn(
				`La police ${policeCustom} n'a pas été trouvée dans l'objet typesPolices.`,
			);
		}
	});

	// Adaptation des graphismes
	const tousLesGraphismes = graphismes.querySelectorAll(".trait");
	tousLesGraphismes.forEach((graphisme) => {
		graphisme.style.transition = "none ";

		let computedStyle = window.getComputedStyle(graphisme);

		let positionX = parseInt(
			parseFloat(computedStyle.getPropertyValue("left")) /
				config.largeur_carreau_old,
		);
		let positionY = parseInt(
			parseFloat(computedStyle.getPropertyValue("top")) /
				config.largeur_carreau_old,
		);
		let width = parseInt(
			parseFloat(computedStyle.getPropertyValue("width")) /
				config.largeur_carreau_old,
		);
		let height = parseInt(
			parseFloat(computedStyle.getPropertyValue("height")) /
				config.largeur_carreau_old,
		);

		// Vérifie que les valeurs ne sont pas NaN
		if (isNaN(positionX)) positionX = 0;
		if (isNaN(positionY)) positionY = 0;
		if (isNaN(width)) width = 0;
		if (isNaN(height)) height = 0;

		// Ajustement de 'left' et 'top' en fonction de la proportion unique
		let newPositionX = positionX * config.largeur_carreau;
		let newPositionY = positionY * config.largeur_carreau;

		// Applique les nouvelles valeurs de 'left' et 'top' à l'élément
		graphisme.style.left = `${newPositionX}px`;
		graphisme.style.top = `${newPositionY}px`;

		// Ajustement de la largeur et hauteur des éléments graphiques
		if (graphisme.classList.contains("horizontal")) {
			let newWidth =
				width * config.largeur_carreau + config.largeur_carreau * 0.02117171;
			graphisme.style.width = `${newWidth}px`;
		}

		if (graphisme.classList.contains("vertical")) {
			let newHeight =
				height * config.largeur_carreau + config.largeur_carreau * 0.02117171;
			graphisme.style.height = `${newHeight}px`;
		}

		graphisme.style.transition = "";
	});

	majDimensionsPrint();
	updateTransform();
	calculeNombreDeCarreaux();
	stocke("largeur-carreau", config.largeur_carreau);
}

// Fonction pour modifier la position
function updateTransform() {
	document.documentElement.style.setProperty(
		"--decalage-depart",
		-config.largeur_carreau * 0.02117171 + "px",
	);
	document.documentElement.style.setProperty(
		"--decalage-position",
		-2 - config.largeur_carreau * 0.02117171 + "px",
	);
}
