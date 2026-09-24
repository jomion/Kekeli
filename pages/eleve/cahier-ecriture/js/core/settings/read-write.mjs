import { config } from "../config.mjs";

import {
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
} from "../utils/dom.mjs";

export function save_texte() {
	stocke("texte-principal", texte_principal.innerHTML);
	stocke("texte-marge", texte_marge.innerHTML);
	stocke("texte-marge-complementaire", texte_marge_complementaire.innerHTML);
}

export function stocke(cle, valeur) {
	if (config.openboard) {
		window.sankore.setPreference(config.prefixeAppli + "-" + cle, valeur);
	} else {
		localStorage.setItem(config.prefixeAppli + "-" + cle, valeur);
	}
}

export async function litDepuisStockage(cle) {
	let valeurAretourner;
	if (config.openboard) {
		// Récupération pour Openboard
		try {
			valeurAretourner = await window.sankore.async.preference(
				`${config.prefixeAppli}-${cle}`
			);
		} catch (error) {
			console.error(
				`Erreur lors de la lecture de la clé ${cle} depuis Openboard:`,
				error
			);
		}
	} else {
		// Récupération en Web
		valeurAretourner = localStorage.getItem(`${config.prefixeAppli}-${cle}`);
	}

	return valeurAretourner;
}

export async function getValueFromUrlOrStorage(urlParams, key) {
	return urlParams.get(key) || (await litDepuisStockage(key));
}
