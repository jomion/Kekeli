import { couleurTexte } from "../../text-format/text-color.mjs";
import { couleurSurlignement } from "../../text-format/highlight-color.mjs";

export function handleColorButtons() {
	document
		.querySelectorAll(
			"#boutons-couleur-texte .bouton-couleur, #boutons_couleur-texte .bouton-couleur, #boutons-couleur-texte .deroule-couleur, .deroule-couleur.bouton-couleur",
		)
		.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const couleurBouton = e.currentTarget.value;
				couleurTexte(couleurBouton);
				document.getElementById("couleur-texte").style.color = couleurBouton;
				document.getElementById("couleur-texte").value = couleurBouton;
				if (couleurBouton === "white" || couleurBouton === "transparent") {
					document.getElementById("couleur-texte").style.webkitTextStroke =
						"1px #000000";
				} else {
					document.getElementById("couleur-texte").style.webkitTextStroke =
						"0px";
				}
				// On ferme le menu de couleur de texte après le choix d'une couleur
				document.getElementById("boutons-couleur-texte").classList.add("hide");
			});
		});

	document
		.querySelectorAll(
			"#boutons-couleur-surlignement .bouton-couleur, .deroule-surlignement.bouton-couleur",
		)
		.forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const couleurBouton = e.currentTarget.value;
				couleurSurlignement(couleurBouton);
				document.getElementById("couleur-surlignement").style.backgroundColor =
					couleurBouton;
				document.getElementById("couleur-surlignement").value = couleurBouton;
				// On ferme le menu de couleur de surlignement après le choix d'une couleur
				document
					.getElementById("boutons-couleur-surlignement")
					.classList.add("hide");
			});
		});
}
