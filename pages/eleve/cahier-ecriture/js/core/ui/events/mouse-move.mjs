import { config } from "../../config.mjs";
import {
	case2,
	case3,
	divMarge,
	divMargeEntete,
	graphismes,
	images,
	margeSecondaire,
	page,
} from "../../utils/dom.mjs";
import { activeRegle } from "../../menu/buttons/ruler.mjs";
import { save_texte, stocke } from "../../settings/read-write.mjs";
import { majDimensionsPrint } from "../display/print.mjs";
import { calculeNombreDeCarreaux } from "../layout/getSize.mjs";

let dragged = null;

// Mouse / drag position helpers
let posX = 0;
let posY = 0;
let posXDepartSouris = 0;
let posYDepartSouris = 0;
let posXSouris = 0;
let posYSouris = 0;
let diffsourisx = 0;
let diffsourisy = 0;
let diffX = 0;
let diffY = 0;
let redim = false;
let startX, startY; // Position de départ du trait
let lineDiv = null; // La div représentant le trait

let imageRedim = false;
let imageRedimDimension = null;
let imageRedimTaille = null;

let sensRedimImageEnCours =
	(imageRedimDimension =
	imageRedim =
	imageRedimTaille =
		false);

// Fonction pour ajuster la position de la souris au quadrillage
function snapToGrid(value, gridSize = config.largeur_carreau) {
	return Math.round(value / gridSize) * gridSize;
}

function touchClientX(event) {
	return (
		event &&
		event.targetTouches &&
		event.targetTouches[0] &&
		event.targetTouches[0].clientX
	);
}
function touchClientY(event) {
	return (
		event &&
		event.targetTouches &&
		event.targetTouches[0] &&
		event.targetTouches[0].clientY
	);
}
function clientX(event) {
	return touchClientX(event) || (event && event.clientX);
}
function clientY(event) {
	return touchClientY(event) || (event && event.clientY);
}
// --- fin helpers ---

// Fonction pour changer le curseur lors du survol des points d'accroche
function moveCursor(event) {
	const rect = page.getBoundingClientRect();
	const mouseX = clientX(event) - rect.left;
	const mouseY = clientY(event) - rect.top;

	if (config.regleActive) {
		const snappedX = snapToGrid(mouseX);
		const snappedY = snapToGrid(mouseY);

		if (
			Math.abs(mouseX - snappedX) < config.largeur_carreau / 8 &&
			Math.abs(mouseY - snappedY) < config.largeur_carreau / 8
		) {
			page.style.cursor = "url(./images/crayonrouge.png) 0 30, auto";
		} else if (!config.isDrawing) {
			page.style.cursor = "url(./images/crayon.png) 0 30, auto ";
		}
	}
}

function clic(event) {
	save_texte();

	if (event.target.classList.contains("gestion-texte")) {
		event.preventDefault();
	}

	// DÉSELCTION DES CONTENEURS IMAGES SÉLECTIONNES

	if (!event.target.closest(".selectionne")) {
		const imagesSelectionnees = images.querySelectorAll(".selectionne");
		imagesSelectionnees.forEach((conteneurImage) => {
			conteneurImage.classList.remove("selectionne");
		});
	}

	// FERMETURE AUTO DES MENUS
	const menuSoulignement = document.getElementById("boutons_soulignement");
	const menuSurlignement = document.getElementById(
		"boutons-couleur-surlignement",
	);
	const menuCarreaux = document.getElementById("boutons_carreaux");
	const menuCouleurTexte = document.getElementById("boutons-couleur-texte");
	const datepickerDiv = document.getElementById("datepicker");
	const flatpickrCalendar = document.querySelector(".flatpickr-calendar");

	const clicSurEnfantdeCalendar = objetOuEnfantDe(
		event.target,
		flatpickrCalendar,
	);

	// Si le clic n'a pas été fait sur un des menus déroulants ou le calendrier, fermer les menus
	if (
		!clicSurEnfantdeCalendar &&
		!event.target.classList.contains("deroule-couleur") &&
		!event.target.classList.contains("deroule-surlignement") &&
		!event.target.classList.contains("deroule-souligne") &&
		!event.target.classList.contains("deroule_carreaux") &&
		!event.target.classList.contains("flatpickr-calendar")
	) {
		// Ferme tous les menus
		menuSurlignement.classList.add("hide");
		menuSoulignement.classList.add("hide");
		menuCarreaux.classList.add("hide");
		menuCouleurTexte.classList.add("hide");
		datepickerDiv.classList.add("hide"); // Cache le calendrier après sélection

		if (flatpickrCalendar) {
			flatpickrCalendar.classList.add("hide"); // Cache le calendrier
		}
	}
	// FIN DE LA FERMETURE AUTO DES MENUS

	if (
		event.target.classList.contains("bouton-supprimer-trait") &&
		!config.regleActive &&
		config.selected
	) {
		config.selected.remove();
		config.selected = null;
	}

	if (
		event.target.classList.contains("bouton-couleur-trait") &&
		!config.regleActive &&
		config.selected
	) {
		document.getElementById("inputCouleurTrait").click();
	}

	if (event.target.classList.contains("trait") && !config.regleActive) {
		if (config.selected) {
			config.selected.classList.remove("select");
		}
		event.target.classList.add("select");
		config.selected = event.target;
	} else if (
		config.selected &&
		!event.target.classList.contains("bouton-couleur-trait")
	) {
		config.selected.classList.remove("select");
		config.selected = null;
	}

	const borderWidth = 10; // Largeur de la bordure (en pixels)
	const rect = page.getBoundingClientRect(); // Récupère les dimensions et la position de la div "page"
	const rect2 = margeSecondaire.getBoundingClientRect(); // Récupère les dimensions et la position de la div "page"
	posX = clientX(event);
	posY = clientY(event);
	const mouseX = posX - rect.left; // Position de la souris horizontalement par rapport à la div "page"
	const mouseY = posY - rect.top;
	const mouseXmarge = posX - rect2.left; // Position de la souris horizontalement par rapport à la div "page"

	let draggable_item = false;
	if (event.target.classList.contains("draggable_item")) {
		draggable_item = true;
	}

	if (event.target.classList.contains("poignee")) {
		sensRedimImageEnCours = event.target.classList[1];
		document.body.style.cursor = sensRedimImageEnCours + "-resize";

		posXDepartSouris = posX;
		posYDepartSouris = posY;

		let conteneurImage = event.target.closest(".conteneur-image");
		let image =
			conteneurImage.querySelector(".image") ||
			conteneurImage.querySelector(".timer");
		imageRedim = image;
		let imageRedimWidth = image.clientWidth;
		let imageRedimHeight = image.clientHeight;
		imageRedimDimension =
			imageRedimHeight > imageRedimWidth ? "height" : "width";
		imageRedimTaille = Math.max(imageRedimWidth, imageRedimHeight);
	} else if (event.target.classList.contains("draggable") || draggable_item) {
		event.preventDefault();
		if (draggable_item) {
			dragged = event.target.parentNode;
		} else {
			dragged = event.target;
		}
		diffsourisx = posX - dragged.offsetLeft;
		diffsourisy = posY - dragged.offsetTop;
		dragged.classList.add("dragged");
	} else if (mouseX <= borderWidth && mouseX > -borderWidth) {
		// Vérifie si le clic est dans une zone de 5px de la bordure gauche
		redim = page;
		document.body.style.cursor = "ew-resize";
		posXDepartSouris = posX;
		config.largeur_page = page.offsetWidth;
		config.largeur_marge = divMarge.offsetWidth;
	} else if (mouseXmarge <= borderWidth && mouseXmarge > -borderWidth) {
		// Vérifie si le clic est dans une zone de 5px de la bordure gauche
		redim = margeSecondaire;
		document.body.style.cursor = "ew-resize";
		posXDepartSouris = posX;
		config.largeur_marge_secondaire = margeSecondaire.offsetWidth;
	} else if (config.regleActive) {
		// Gérer le traçage des lignes si regleActive est vrai
		const snappedX = snapToGrid(mouseX);
		const snappedY = snapToGrid(mouseY);
		if (
			Math.abs(mouseX - snappedX) < config.largeur_carreau / 8 &&
			Math.abs(mouseY - snappedY) < config.largeur_carreau / 8
		) {
			config.isDrawing = true;
			startX = snappedX;
			startY = snappedY;

			// Créer une div pour représenter le trait
			lineDiv = document.createElement("div");
			lineDiv.classList.add("trait");
			lineDiv.classList.add("horizontal");
			lineDiv.classList.add("draggable");

			lineDiv.style.position = "absolute";
			lineDiv.style.backgroundColor = "red";
			lineDiv.style.width = "6px"; // Par défaut, un trait vertical
			lineDiv.style.height = "6px"; // Minimum taille
			lineDiv.style.left = startX + "px";
			lineDiv.style.top = startY + "px";

			let boutonSupprimer = document.createElement("button");
			boutonSupprimer.classList.add("bouton-supprimer-trait");
			lineDiv.appendChild(boutonSupprimer);

			let boutonCouleur = document.createElement("button");
			boutonCouleur.classList.add("bouton-couleur-trait");
			lineDiv.appendChild(boutonCouleur);

			graphismes.appendChild(lineDiv);
		}
	}
}

function move(event) {
	posXSouris = clientX(event);
	posYSouris = clientY(event);
	const rect = page.getBoundingClientRect();
	const mouseX = posXSouris - rect.left;
	const mouseY = posYSouris - rect.top;

	if (sensRedimImageEnCours) {
		diffX = posXSouris - posXDepartSouris;
		diffY = posYSouris - posYDepartSouris;

		if (sensRedimImageEnCours.includes("w")) {
			diffX = -diffX;
		}
		if (sensRedimImageEnCours.includes("n")) {
			diffY = -diffY;
		}

		let diff = diffX + diffY;

		if (imageRedim.classList.contains("timer")) {
			imageRedim.style.width = imageRedim.style.height = `${
				imageRedimTaille + diff
			}px`;
		} else {
			imageRedim.style[imageRedimDimension] = `${imageRedimTaille + diff}px`;
		}
	} else if (redim === page) {
		diffX = posXSouris - posXDepartSouris;
		if (config.largeur_marge + diffX >= 60) {
			page.style.width = case3.style.width = config.largeur_page - diffX + "px";
			divMarge.style.width = config.largeur_marge + diffX - 3 + "px";

			divMargeEntete.style.width = config.largeur_marge + diffX + "px";
		} else {
			page.style.width = case3.style.width = "calc(100% - 60px)";
			divMarge.style.width = divMargeEntete.style.width = "57px";
			divMargeEntete.style.width = divMargeEntete.style.width = "60px";
		}
		calculeNombreDeCarreaux();
	} else if (redim === margeSecondaire) {
		diffX = posXSouris - posXDepartSouris;
		if (
			config.largeur_marge_secondaire - diffX >=
			config.largeur_carreau * 2.7
		) {
			margeSecondaire.style.width =
				config.largeur_marge_secondaire - diffX + "px";
			case2.style.width = config.largeur_marge_secondaire - diffX + "px";
		} else {
			margeSecondaire.style.width = config.largeur_carreau * 2.7 + "px";
			case2.style.width = config.largeur_carreau * 2.7 + "px";
		}
		calculeNombreDeCarreaux();
	}

	if (dragged) {
		dragged.style.right = null;
		dragged.style.bottom = null;
		event.preventDefault();
		const pageX = clientX(event) || 0;
		const pageY = clientY(event) || 0;
		dragged.style.left = pageX - diffsourisx + "px";
		dragged.style.top = pageY - diffsourisy + "px";
	} else if (config.isDrawing && lineDiv) {
		// Gérer le traçage de la ligne
		const snappedX = snapToGrid(mouseX);
		const snappedY = snapToGrid(mouseY);

		// Calculer la direction du trait (horizontal ou vertical)
		const diffX = snappedX - startX;
		const diffY = snappedY - startY;

		if (Math.abs(diffX) > Math.abs(diffY)) {
			// Traçage horizontal
			let longueur = Math.abs(diffX);
			lineDiv.style.width =
				longueur + config.largeur_carreau * 0.02117171 + "px";
			lineDiv.style.height = "6px";
			lineDiv.style.top = startY + "px";
			lineDiv.style.left = startX + "px";
			lineDiv.classList.remove("vertical");
			lineDiv.classList.add("horizontal");

			if (diffX < 0) {
				lineDiv.style.left = snappedX + "px"; // Ajuster la position si on dessine vers la gauche
			}
		} else {
			// Traçage vertical
			lineDiv.style.height =
				Math.abs(diffY) + config.largeur_carreau * 0.02117171 + "px";
			lineDiv.style.width = "6px";
			lineDiv.classList.remove("horizontal");
			lineDiv.classList.add("vertical");
			if (diffY < 0) {
				lineDiv.style.top = snappedY + "px"; // Ajuster la position si on dessine vers le haut
			}
		}
	}
}

function release() {
	redim = false;
	document.body.style.cursor = null;
	config.largeur_page = page.offsetWidth;
	config.largeur_marge = divMarge.offsetWidth;
	config.largeur_marge_secondaire = margeSecondaire.offsetWidth;
	majDimensionsPrint();

	stocke("largeur-marge", config.largeur_marge);
	stocke("largeur-marge-secondaire", config.largeur_marge_secondaire);
	stocke("graphismes", graphismes.innerHTML);
	stocke("images", images.innerHTML);

	if (sensRedimImageEnCours) {
		sensRedimImageEnCours = false;
	}

	// Fin du déplacement d'élément
	if (dragged) {
		dragged.classList.remove("dragged");

		if (dragged.classList.contains("trait")) {
			// On récupère la position actuelle de l'élément dragged (position absolute)
			let currentLeft = parseInt(dragged.style.left, 10);
			let currentTop = parseInt(dragged.style.top, 10);

			// Calculer les nouvelles coordonnées alignées sur la grille
			let newLeft =
				Math.round(currentLeft / config.largeur_carreau) *
				config.largeur_carreau;
			let newTop =
				Math.round(currentTop / config.largeur_carreau) *
				config.largeur_carreau;

			// Repositionner dragged sur la grille invisible
			dragged.style.left = `${newLeft}px`;
			dragged.style.top = `${newTop}px`;
		}

		dragged = null;
	}

	// Fin du traçage de la ligne
	if (config.isDrawing) {
		config.isDrawing = false;
		lineDiv = null;
		activeRegle();
	}
}

export function handleMouseMove() {
	document.addEventListener("mousemove", moveCursor);

	// Écouteurs de souris
	document.addEventListener("touchstart", clic);
	document.addEventListener("touchmove", move);
	document.addEventListener("touchend", release);
	// Pour le tactile
	document.addEventListener("mousedown", clic);
	document.addEventListener("mousemove", move);
	document.addEventListener("mouseup", release);
}

function objetOuEnfantDe(cible, objet) {
	if (cible === objet) return true;
	let parent = cible.parentNode;
	while (parent) {
		if (parent === objet) return true;
		parent = parent.parentNode;
	}
	return false;
}
