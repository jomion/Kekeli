import { zoom } from "../ui/zoom/zoom.mjs";
import { config } from "../config.mjs";
import {
	checkboxInterligneDouble,
	checkboxVerifierOrthographe,
	divMarge,
	inputEcrireACheval,
	inputLargeurImpression,
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
	checkboxFermerLeS,
} from "../utils/dom.mjs";
import { stocke } from "../settings/read-write.mjs";

export function changeEcrireACheval() {
	config.ecrireAChevalSurLaMarge = inputEcrireACheval.checked;

	if (config.ecrireAChevalSurLaMarge) {
		divMarge.style.whiteSpace = "nowrap";
	} else {
		divMarge.style.whiteSpace = null;
	}

	stocke("ecrire-a-cheval", config.ecrireAChevalSurLaMarge);
}

export function changeVerifieOrthographe() {
	config.verifierOrthographe = checkboxVerifierOrthographe.checked;
	stocke("verifier-orthographe", config.verifierOrthographe);
	[texte_marge, texte_marge_complementaire, texte_principal].forEach(
		(texte) => {
			texte.spellcheck = config.verifierOrthographe;
			texte.focus();
		},
	);
}

export function changeInterligneDouble() {
	config.interligneDouble = checkboxInterligneDouble.checked;
	stocke("double-interligne", config.interligneDouble);
	zoom();
}

export function changeS() {
	config.fermetureDuS = checkboxFermerLeS.checked;
	majFontFeatures();
	stocke("fermer-s", config.fermetureDuS);
	zoom();
}

export function changeLargeurImpression() {
	let valeurEntree = inputLargeurImpression.value;

	config.largeurImpression = parseFloat(valeurEntree);

	stocke("largeur-impression", config.largeurImpression);
	zoom();
}

export function changeEspacementLettres(valeur) {
	config.espacementLettres = parseFloat(valeur);
	stocke("espacement-lettres", config.espacementLettres);

	texte_principal.style.letterSpacing = valeur / 100 + "em";

	majFontFeatures();
}

function majFontFeatures() {
	let calt = config.espacementLettres === 0 ? "1" : "0";
	let ss06 = config.fermetureDuS === true ? "1" : "0";

	document.documentElement.style.setProperty(
		"--ligatures",
		`"calt" ${calt}, "rlig" ${calt}, "ss06" ${ss06} `,
	);
}

export function changeEspacementMots(valeur) {
	config.espacementMots = parseFloat(valeur);
	stocke("espacement-mots", config.espacementMots);

	if (config.espacementMots === 0) {
		texte_principal.style.wordSpacing = "normal";
		texte_marge.style.wordSpacing = "normal";
		texte_marge_complementaire.style.wordSpacing = "normal";
	} else {
		texte_principal.style.wordSpacing = valeur + "em";
		texte_marge.style.wordSpacing = valeur + "em";
		texte_marge_complementaire.style.wordSpacing = valeur + "em";
	}
}
