export function cree_timer() {
	const images = document.getElementById("images");
	const divContenu = document.getElementById("contenu");
	const body = document.body;
	let timer = document.createElement("iframe");
	timer.src = "https://educajou.forge.apps.education.fr/tuxtimer/";

	let nouveauConteneurImage = document.createElement("div");
	nouveauConteneurImage.addEventListener("click", function () {
		nouveauConteneurImage.classList.add("selectionne");
	});
	nouveauConteneurImage.style.top = `${
		divContenu.scrollTop + body.clientHeight / 2
	}px`;
	nouveauConteneurImage.classList.add("draggable", "conteneur-image");
	timer.classList.add("timer");
	nouveauConteneurImage.appendChild(timer);

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

	["nw", "ne", "sw", "se"].forEach((pos) => {
		let poignee = document.createElement("div");
		poignee.classList.add("poignee", pos);
		nouveauConteneurImage.appendChild(poignee);
	});

	if (images) images.appendChild(nouveauConteneurImage);
}
