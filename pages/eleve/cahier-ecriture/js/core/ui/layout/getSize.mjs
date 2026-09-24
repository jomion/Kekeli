import { config } from "../../config.mjs";
import { texte_principal, inputNombreDeCarreaux } from "../../utils/dom.mjs";

export function calculeNombreDeCarreaux() {
	// Largeur de page
	const largeurPage = calculerLargeurTextePrincipal();

	// Calculer le nombre de carreaux
	config.nombreDeCarreaux = Math.round(largeurPage / config.largeur_carreau);

	// Mettre à jour l'inpur
	inputNombreDeCarreaux.value = config.nombreDeCarreaux;
}

export function calculerLargeurTextePrincipal() {
	// Obtenir la largeur totale de l'élément, y compris le padding et les bordures
	const offsetWidth = texte_principal.offsetWidth;

	// Récupérer les styles calculés de l'élément
	const styles = getComputedStyle(texte_principal);
	const marginLeft = parseFloat(styles.marginLeft);
	const marginRight = parseFloat(styles.marginRight);

	// Calculer la largeur totale en incluant les marges
	const totalWidth = offsetWidth + marginLeft + marginRight;

	return totalWidth;
}
