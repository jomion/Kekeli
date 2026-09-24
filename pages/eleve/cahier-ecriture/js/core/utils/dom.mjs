// Small DOM utility helpers
export const get = (id) => document.getElementById(id);

export function ouvre(div) {
	if (!div) return;
	document.querySelectorAll(".darkbox");
	div.classList.remove("hide");
	const darkbox = document.getElementById("darkbox");
	if (darkbox) darkbox.classList.remove("hide");
}

export function ferme(div) {
	if (!div) return;
	div.classList.add("hide");
	const darkbox = document.getElementById("darkbox");
	if (darkbox) darkbox.classList.add("hide");
}

// Constantes - Éléments DOM

// Structure
export const body = document.body;

export const divApropos = document.getElementById("apropos");

// En-tête optionnel (mode cahier de textes)
export const divEntete = document.getElementById("entete");
export const divMargeEntete = document.getElementById("marge-entete");
// export const case1 removed (unused)
export const case2 = document.getElementById("case2");
export const case3 = document.getElementById("case3");

// Contenu général
export const divContenu = document.getElementById("contenu");
export const divMarge = document.getElementById("marge");

export const marge = document.getElementById("marge1");
export const texte_marge = document.getElementById("texte_marge");
export const margeSecondaire = document.getElementById("marge2");

export const texte_marge_complementaire = document.getElementById(
	"texte_marge_complementaire",
);
export const page = document.getElementById("page");

export const graphismes = document.getElementById("graphismes");
export const images = document.getElementById("images");
export const texte_principal = document.getElementById("texte_principal");
// export const texte_apropos removed (unused)

export const divMessage = document.getElementById("message");
export const checkboxMessage = document.getElementById(
	"show-warning-next-time",
);
export const resultatCodi = document.getElementById("resultatCodi");
export const lienCodi = document.getElementById("lienCodi");
export const suiteCodi = document.getElementById("suiteCodi");
export let boutonCodi = document.getElementById("boutonCodi");

// Boutons

// duplicate confirmationNouveau removed (use divConfirmationNouveau)

// export const bouton_a_propos removed (unused)
export const bouton_ligatures = document.getElementById("bouton_ligatures");
// export const bouton_copier removed (unused)
export const choix_police = document.getElementById("choix_police");
export let choixCouleurEntete = document.getElementById("choix-couleur-entete");
// export const couleurTexte removed (unused)
export let inputEspacement = document.getElementById("inputEspacement");
export let inputEspacementMots = document.getElementById("inputEspacementMots");

export let inputOpacite = document.getElementById("inputOpacite");
export let checkboxAjouterDate = document.getElementById("checkboxAjouterDate");
export let checkboxSoulignerDate = document.getElementById(
	"checkboxSoulignerDate",
);
export let checkboxVerifierOrthographe = document.getElementById(
	"checkboxVerifierOrthographe",
);
export let checkboxInterligneDouble = document.getElementById(
	"checkboxInterligneDouble",
);
export let inputLargeurImpression = document.getElementById(
	"inputLargeurImpression",
);
export let inputNombreDeCarreaux = document.getElementById(
	"inputNombreDeCarreaux",
);
export let checkboxMajDateAuto = document.getElementById("checkboxMajDateAuto");

export let inputEcrireACheval = document.getElementById("inputEcrireACheval");

export let checkboxFermerLeS = document.getElementById("checkboxFermerLeS");

// Overlays / dialogs / misc controls
export const divConfirmationNouveau = document.getElementById(
	"confirmation-nouveau",
);
export const divCodi = document.getElementById("divCodi");
export const divIllustration = document.getElementById("divIllustration");
export const darkbox = document.getElementById("darkbox");
export const zone_menu_copie_lien = document.getElementById(
	"zone_menu_copie_lien",
);
export const zone_lien = document.getElementById("zone_lien");
export const fullscreen = document.getElementById("fullscreen");
export const barre = document.getElementById("barre");

// Document root / site
export const site = document.documentElement;

export const selectLangue = document.getElementById("selectLangue");
