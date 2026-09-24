import { get } from "../../utils/dom.mjs";
import { changeCarreaux } from "../../ui/layout/background.mjs";

function ajouterBackgroundImages() {
	// Sélectionner tous les boutons dans la div boutons_soulignement
	const boutons = document.querySelectorAll("#boutons_soulignement button");

	// Parcourir chaque bouton
	boutons.forEach((bouton) => {
		// Récupérer l'ID du bouton
		const boutonId = bouton.id;

		// Construire l'URL de l'image en fonction de l'ID du bouton
		const imageUrl = `./images/${boutonId}.svg`;

		// Appliquer le background-image au bouton
		bouton.style.backgroundImage = `url('${imageUrl}')`;
	});

	// Sélectionner tous les boutons dans la div boutons_soulignement
	const boutonsCarreau = document.querySelectorAll(
		"#boutons_carreaux button:not(.bouton-fermer)"
	);

	// Parcourir chaque bouton
	boutonsCarreau.forEach((bouton) => {
		// Récupérer l'ID du bouton
		const boutonId = bouton.id;

		// Construire l'URL de l'image en fonction de l'ID du bouton
		let imageUrl = `./images/${boutonId}.svg`;
		// Appliquer le background-image au bouton
		if (imageUrl === "./images/carreau_cahier_de_textes.svg") {
			imageUrl = "./images/cahier_de_textes.svg";
		}
		bouton.style.backgroundImage = `url('${imageUrl}')`;
	});
}

function initChooseTilesPanel() {
	ajouterBackgroundImages();

	const carreauMap = {
		carreau_seyes: "seyes",
		carreau_seyes_noir: "seyes_noir",
		carreau_seyes_gris: "seyes_gris",
		carreau_ligne_base: "ligne_base",
		carreau_simple_ligne: "simple_ligne",
		carreau_double_ligne: "double_ligne",
		carreau_petit: "petit",
		carreau_terre: "terre",
		carreau_trois_couleurs: "trois_couleurs",
		carreau_quatre_couleurs: "quatre_couleurs",
		carreau_bleuviolet: "bleuviolet",
		carreau_cahier_de_textes: "cahier_de_textes",
	};
	Object.keys(carreauMap).forEach((id) => {
		const b = get(id);
		if (b)
			b.addEventListener("click", () => {
				changeCarreaux(carreauMap[id]);
			});
	});

	const closeCarreaux = document.querySelector(
		"#boutons_carreaux .bouton-fermer"
	);
	if (closeCarreaux)
		closeCarreaux.addEventListener("click", () => {
			const el = document.getElementById("boutons_carreaux");
			if (el) el.classList.add("hide");
		});
}

let firstTime = true;

export function ouvreBoutonsCarreau() {
	if (firstTime) {
		initChooseTilesPanel();
		firstTime = false;
	}
	const rect = document.getElementById("carreaux").getBoundingClientRect();
	let positionLeft = rect.left;
	document.getElementById("boutons_carreaux").style.left = positionLeft + "px";
	document.getElementById("boutons_carreaux").classList;
	document.getElementById("boutons_carreaux").classList.toggle("hide");
}
