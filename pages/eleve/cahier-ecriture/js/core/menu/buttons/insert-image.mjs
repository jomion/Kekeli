import { divContenu, images } from "../../utils/dom.mjs";

export function reaffecteEventsImages() {
	const images = document.getElementById("images");
	if (!images) return;
	let imagesATraiter = images.querySelectorAll(".conteneur-image");

	imagesATraiter.forEach((conteneurImage) => {
		let boutonSupprimer = conteneurImage.querySelector(
			".bouton-supprimer-image"
		);
		let boutonCadre = conteneurImage.querySelector(".bouton-cadre-image");

		conteneurImage.addEventListener("click", function () {
			conteneurImage.classList.add("selectionne");
		});

		if (boutonSupprimer)
			boutonSupprimer.addEventListener("click", function () {
				conteneurImage.remove();
			});

		if (boutonCadre)
			boutonCadre.addEventListener("click", function () {
				conteneurImage.classList.toggle("encadre");
			});
	});
}

export function cree_image(event) {
	let input = event.target;
	let nouvelle_image = new Image();

	if (input.files && input.files[0]) {
		var reader = new FileReader();

		reader.onload = function (e) {
			nouvelle_image.onload = function () {
				let ratio = nouvelle_image.naturalWidth / nouvelle_image.naturalHeight;

				if (ratio > 1) {
					// Image plus large que haute : on fixe la largeur à 400px
					nouvelle_image.style.width = "400px";
				} else {
					// Image plus haute que large : on fixe la hauteur à 400px
					nouvelle_image.style.height = "400px";
				}
			};
			nouvelle_image.src = e.target.result;
		};

		reader.readAsDataURL(input.files[0]);
	}

	let nouveauConteneurImage = document.createElement("div");
	nouveauConteneurImage.addEventListener("click", function () {
		nouveauConteneurImage.classList.add("selectionne");
	});
	nouveauConteneurImage.style.top = `${
		divContenu.scrollTop + document.body.clientHeight / 2
	}px`;
	nouveauConteneurImage.classList.add("draggable", "conteneur-image");
	nouvelle_image.classList.add("image");
	nouveauConteneurImage.appendChild(nouvelle_image);

	let boutonSupprimer = document.createElement("button");
	boutonSupprimer.title = "Supprimer";
	boutonSupprimer.classList.add("bouton-supprimer-image");
	boutonSupprimer.addEventListener("click", function () {
		nouveauConteneurImage.remove();
	});

	nouveauConteneurImage.appendChild(boutonSupprimer);

	let boutonCadre = document.createElement("button");
	boutonCadre.title = "Bordure";
	boutonCadre.classList.add("bouton-cadre-image");
	boutonCadre.addEventListener("click", function () {
		nouveauConteneurImage.classList.toggle("encadre");
	});

	nouveauConteneurImage.appendChild(boutonCadre);

	let poigneeNO = document.createElement("div");
	poigneeNO.classList.add("poignee", "nw");

	let poigneeNE = document.createElement("div");
	poigneeNE.classList.add("poignee", "ne");

	let poigneeSO = document.createElement("div");
	poigneeSO.classList.add("poignee", "sw");

	let poigneeSE = document.createElement("div");
	poigneeSE.classList.add("poignee", "se");

	nouveauConteneurImage.appendChild(poigneeNO);
	nouveauConteneurImage.appendChild(poigneeNE);
	nouveauConteneurImage.appendChild(poigneeSO);
	nouveauConteneurImage.appendChild(poigneeSE);

	images.appendChild(nouveauConteneurImage);
}
