import { divConfirmationNouveau, ferme } from "../../utils/dom.mjs";
import { resetContent } from "../../ui/content/resetContent.mjs";

export function handleYesButton() {
	try {
		ferme(divConfirmationNouveau);
		resetContent();
	} catch (e) {
		console.error(e);
	}
}

export function handleNoButton() {
	try {
		ferme(divConfirmationNouveau);
	} catch (e) {
		console.error(e);
	}
}
