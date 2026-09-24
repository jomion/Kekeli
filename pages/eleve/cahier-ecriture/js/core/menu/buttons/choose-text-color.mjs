export function ouvreBoutonsCouleurs(event) {
	if (event) event.stopPropagation();
	const rect = document.getElementById("couleur-texte")
		? document.getElementById("couleur-texte").getBoundingClientRect()
		: null;
	if (!rect) return;
	let positionLeft = rect.left;
	const el = document.getElementById("boutons-couleur-texte");
	if (!el) return;
	el.style.left = positionLeft + "px";
	el.classList.toggle("hide");
}
