import { zoom } from "../../ui/zoom/zoom.mjs";
import { config } from "../../config.mjs";
import {
	bouton_ligatures,
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
} from "../../utils/dom.mjs";
import { update_souligne } from "../underline.mjs";
import { typesPolices } from "./font-params.mjs";

let sens = window.sens || [1, 0];

export function ligatures(mode, sens_force) {
	if (config.ligatures_on) {
		if (mode != "auto") {
			bouton_ligatures.style.backgroundPosition = null;
			config.ligatures_on = false;
			texte_principal.spellcheck = true;
			texte_marge.spellcheck = true;
			texte_marge_complementaire.spellcheck = true;
		}
		sens = [1, 0];
	} else {
		if (mode != "auto") {
			bouton_ligatures.style.backgroundPosition = "0% 0%";
			config.ligatures_on = true;
			texte_principal.spellcheck = false;
			texte_marge.spellcheck = false;
			texte_marge_complementaire.spellcheck = false;
		}
		sens = [0, 1];
	}
	if (sens_force) {
		sens = sens_force;
	}
	let texte = texte_principal.innerHTML;
	for (let i = 0; i < config.substitutions.length; i++) {
		let recherche = config.substitutions[i][sens[0]];
		let subsitution = config.substitutions[i][sens[1]];
		texte = texte.replace(new RegExp(recherche, "g"), subsitution);
	}
	texte_principal.innerHTML = texte;
	texte = texte_marge.innerHTML;
	for (let i = 0; i < config.substitutions.length; i++) {
		let recherche = config.substitutions[i][sens[0]];
		let subsitution = config.substitutions[i][sens[1]];
		texte = texte.replace(new RegExp(recherche, "g"), subsitution);
	}
	texte_marge.innerHTML = texte;
}

// Fonction pour changer la police
export function change_police(police) {
	// Récupérer le texte sélectionné

	// Désactivation
	let texteSelectionne = false;
	//let texteSelectionne = window.getSelection().toString();

	if (texteSelectionne) {
		changePoliceSelection(police);
	} else {
		texte_principal.style.fontFamily = police;
		texte_marge.style.fontFamily = police;
		texte_marge_complementaire.style.fontFamily = police;
		config.police_active = police;

		if (!window.widget) {
			localStorage.setItem("seyes-police", police);
		}

		// Si la police existe dans notre objet typesPolices
		if (typesPolices[police]) {
			let newConfig = typesPolices[police];
			config.coef_marge = newConfig.coef_marge;
			config.coef_marge_windows = newConfig.coef_marge_windows;
			config.facteur_taille_police = newConfig.facteur_taille_police;
			config.coef_marge_double = newConfig.coef_marge_double;
			config.coef_marge_double_windows = newConfig.coef_marge_double_windows;
			config.epaisseur_police = newConfig.epaisseur_police;
			config.distance_soulignage = newConfig.distance_soulignage;
			config.distance_barre = newConfig.distance_barre;
			bouton_ligatures.style.display = newConfig.bouton_ligatures_display;
			ligatures("auto", newConfig.ligatures);
		}
		zoom(0, false, config.police_active);
		update_souligne(config.distance_soulignage);

		document.documentElement.style.setProperty(
			"--distance-soulignement-exposant",
			config.distance_soulignage * 6 + "em",
		);
	}
}

export function changePoliceSelection(police, element = null) {
	// Si un élément est passé, on applique la police à cet élément
	if (element) {
		let config = typesPolices[police];

		if (config) {
			let style = `
					 font-family: ${police};
					 font-size: ${config.facteur_taille_police * config.largeur_carreau}px;
					 font-weight: ${config.epaisseur_police};
					 line-height: ${config.facteur_taille_police * config.largeur_carreau}px;
				`;

			element.style.cssText = style; // Appliquer le style à l'élément
		}
	} else {
		// Sinon, on applique la police sur la sélection actuelle
		let selection = window.getSelection();
		let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
		let texteSelectionne = selection.toString();

		if (texteSelectionne && range && typesPolices[police]) {
			let config = typesPolices[police];

			let style = `
					 font-family: ${police};
					 font-size: ${config.facteur_taille_police * config.largeur_carreau}px;
					 font-weight: ${config.epaisseur_police};
					 line-height: ${config.facteur_taille_police * config.largeur_carreau}px;
				`;

			let startContainer = range.startContainer;
			let endContainer = range.endContainer;

			if (startContainer !== endContainer) {
				let fragment = range.cloneContents();
				let elements = fragment.querySelectorAll("*");

				elements.forEach((el) => {
					if (el.textContent.trim() !== "") {
						let spanStyled = document.createElement("span");
						spanStyled.className = "customfont";
						spanStyled.style.cssText = style;
						spanStyled.innerHTML = el.innerHTML;
						el.innerHTML = "";
						el.appendChild(spanStyled);
					}
				});

				range.deleteContents();
				range.insertNode(fragment);
			} else {
				let spanStyled = document.createElement("span");
				spanStyled.className = "customfont";
				spanStyled.style.cssText = style;
				spanStyled.textContent = texteSelectionne;

				range.deleteContents();
				range.insertNode(spanStyled);

				selection.removeAllRanges();
				let newRange = document.createRange();
				newRange.setStart(spanStyled.firstChild, 0);
				newRange.setEnd(spanStyled.firstChild, spanStyled.firstChild.length);
				selection.addRange(newRange);
			}
		}
	}
}
