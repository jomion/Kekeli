import { ferme, ouvre, boutonCodi, divCodi } from "../../utils/dom.mjs";
import { copieLienCodi } from "../../save-load/import-from-markdown.mjs";

function initImportMarkdownButtons() {
	const boutonFermeCodi = document.getElementById("boutonFermeCodi");
	if (boutonCodi)
		boutonCodi.addEventListener("click", () => {
			copieLienCodi();
		});
	if (boutonFermeCodi)
		boutonFermeCodi.addEventListener("click", () => {
			if (divCodi) ferme(divCodi);
			else {
				if (divCodi) divCodi.classList.add("hide");
			}
		});
}

let firstTimeImportMarkdown = true;

export function importMarkdownButton() {
	if (firstTimeImportMarkdown) {
		initImportMarkdownButtons();
		firstTimeImportMarkdown = false;
	}
	const target = divCodi;
	if (target) ouvre(target);
	const ic = document.getElementById("inputCodi");
	if (ic) ic.focus();
}
