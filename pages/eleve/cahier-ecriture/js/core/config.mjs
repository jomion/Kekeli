let prefixeAppli = "seyes";

// Est-on dans Openboard ?
const hasWindow = typeof window !== "undefined" && window !== null;
let openboard = hasWindow && Boolean(window.widget || window.sankore);
if (hasWindow && openboard) {
	document.body.classList.add("openboard");
}

let afficherMessage = true;

let contenuTexteMarge = "";
let contenuTexteMargeComplementaire = "";
let contenuGraphismes = "";
let contenuImages = "";
let contenuTextePrincipal = "";
let fermetureDuS = true;

// Pour les ligatures
let substitutions = [
	["on", "═"],
	["or", "║"],
	["s ", "╝ "],
	["s\\.", "╝."],
	["s,", "╝,"],
	["s;", "╝;"],
	["s:", "╝:"],
	["s!", "╝!"],
	["s/", "╝/"],
	["s-", "╝-"],
	["s'", "╝'"],
	[" p", " ╰"],
	[" j", " ╮"],
	[" s", " ╠"],
	[" i", " ╱"],
];

const isSmallScreen =
	typeof window !== "undefined" &&
	window.matchMedia("(max-width: 600px)").matches;

let largeur_carreau = isSmallScreen ? 60 : 80;
let largeur_marge_secondaire = largeur_carreau * 2.7;
let largeur_page;
let largeur_page_impression = 1;
let largeur_marge_impression = 1;
let largeur_margesecondaire_impression = 1;
let largeur_carreau_old = largeur_carreau;
let largeur_marge = isSmallScreen ? 60 : 200;
let facteur_taille_police = 0.75;
let taille_police = 60;
let epaisseur_police = "normal";

let ligatures_on = false;

let coef_marge = 0.35;
let coef_marge_windows = 0.3125;
let distance_soulignage = 0.3;
let police_active = "Marelle";
let typeCarreaux = "seyes";

let regleActive = false;
let isDrawing = false;

let espacementLettres = 0;
let espacementMots = 0;
let ajouterLaDate = false;
let soulignerLaDate = false;
let verifierOrthographe = false;
let interligneDouble = false;
let largeurImpression = 3;
let opaciteLignes = 0.8;

let nombreDeCarreaux;
let ecrireAChevalSurLaMarge = false;

let langue = "fr";
let langueChoix = "auto";

let majDateAuto = false;

let dateDuDoc = true;

let selected = false;

const isWindows = /Win/i.test(navigator.userAgent);

let couleursJours = {};

let numeroMessage = 12;

export let config = {
	prefixeAppli,
	largeur_carreau,
	largeur_marge_secondaire,
	largeur_page,
	largeur_page_impression,
	largeur_marge_impression,
	largeur_margesecondaire_impression,
	largeur_carreau_old,
	largeur_marge,
	facteur_taille_police,
	taille_police,
	epaisseur_police,
	ligatures_on,
	coef_marge,
	coef_marge_windows,
	distance_soulignage,
	police_active,
	typeCarreaux,
	regleActive,
	isDrawing,
	espacementLettres,
	espacementMots,
	ajouterLaDate,
	soulignerLaDate,
	verifierOrthographe,
	interligneDouble,
	largeurImpression,
	nombreDeCarreaux,
	ecrireAChevalSurLaMarge,
	langue,
	langueChoix,
	majDateAuto,
	isWindows,
	substitutions,
	openboard,
	selected,
	dateDuDoc,
	afficherMessage,
	opaciteLignes,
	contenuTexteMarge,
	contenuTexteMargeComplementaire,
	contenuGraphismes,
	contenuImages,
	contenuTextePrincipal,
	couleursJours,
	numeroMessage,
	fermetureDuS,
};
