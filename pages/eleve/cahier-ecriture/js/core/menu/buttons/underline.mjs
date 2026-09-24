import { souligne } from "../../text-format/underline.mjs";

function handleSousLigneClick() {
	document
		.querySelectorAll(
			"#boutons_soulignement .deroule-souligne, .deroule-souligne",
		)
		.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const couleurBouton = e.currentTarget.value;
				souligne(couleurBouton);
				const sel = window.getSelection();
				if (sel.isCollapsed) {
					// S'il n'y a pas de texte sélectionné, on définit malgré tout la couleur de soulignement avec la nouvelle couleur choisie
					document.getElementById("souligne").value = couleurBouton;
					document.getElementById("souligne").style.textDecorationColor =
						couleurBouton;
					// on ferme le menu de soulignement
					ouvreBoutonsSouligne();
				}
			});
		});
}

let firstTimeSouligne = true;

export function ouvreBoutonsSouligne(event) {
	if (firstTimeSouligne) {
		handleSousLigneClick();
		firstTimeSouligne = false;
	}
	if (event) event.stopPropagation();
	const rect = document.getElementById("souligne")
		? document.getElementById("souligne").getBoundingClientRect()
		: null;
	if (!rect) return;
	let positionLeft = rect.left;
	const el = document.getElementById("boutons_soulignement");
	if (!el) return;
	el.style.left = positionLeft + "px";
	el.classList.toggle("hide");
}
