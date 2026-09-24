import {
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
} from "../../utils/dom.mjs";
import { save_texte } from "../../settings/read-write.mjs";

export function handleFocus() {
	texte_principal.addEventListener("focusout", save_texte);
	texte_marge.addEventListener("focusout", save_texte);
	texte_marge_complementaire.addEventListener("focusout", save_texte);
}
