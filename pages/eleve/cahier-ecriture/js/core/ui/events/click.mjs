import { images, texte_principal } from "../../utils/dom.mjs";

export function handleClickOnDocument() {
	images.addEventListener("click", () => {
		texte_principal.focus();
		// On déplace le curseur à la fin du texte
		const range = document.createRange();
		range.selectNodeContents(texte_principal);
		range.collapse(false);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	});
}
