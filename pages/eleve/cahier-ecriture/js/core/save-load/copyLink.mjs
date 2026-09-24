import { config } from "../config.mjs";
import { compresserHTML } from "./compression.mjs";
import {
	ferme,
	darkbox,
	divContenu,
	graphismes,
	texte_marge,
	texte_marge_complementaire,
	texte_principal,
	zone_lien,
	zone_menu_copie_lien,
} from "../utils/dom.mjs";
import { nettoyerSpans } from "../text-format/helpers.mjs";

function initCloseCopyLinkMenu() {
	const fermeCopie = document.getElementById("ferme_menu_copie_lien");
	if (fermeCopie)
		fermeCopie.addEventListener("click", () => {
			if (zone_menu_copie_lien) ferme(zone_menu_copie_lien);
			else {
				const el = document.getElementById("zone_menu_copie_lien");
				if (el) el.classList.add("hide");
			}
		});
}

let firstTimeCopierLien = true;

export function menu_copier_lien() {
	if (firstTimeCopierLien) {
		initCloseCopyLinkMenu();
		firstTimeCopierLien = false;
	}
	majLien();
	zone_menu_copie_lien.classList.toggle("hide");
	if (!zone_menu_copie_lien.classList.contains("hide")) {
		darkbox.classList.remove("hide");
	}
}

function majLien() {
	// Base URL (tu peux la modifier selon tes besoins)
	let baseURL =
		window.location.protocol +
		"//" +
		window.location.host +
		window.location.pathname +
		"?";
	if (window.widget) {
		baseURL = "https://educajou.forge.apps.education.fr/seyes?";
	}

	// Construction des paramètres de l'URL en encodant les contenus des textes et les variables globales
	const params = new URLSearchParams({
		marge: texte_marge ? texte_marge.innerHTML : "",
		"marge-secondaire": texte_marge_complementaire
			? texte_marge_complementaire.innerHTML
			: "",
		police: config.police_active || "",
		"largeur-carreau": config.largeur_carreau || "",
		"type-carreaux": config.typeCarreaux || "",
		"opacite-lignes": config.opaciteLignes || "",
		"largeur-marge": config.largeur_marge || 0,
		"largeur-marge-secondaire": config.largeur_marge_secondaire || 0,
		"interligne-double": config.interligneDouble || "",
		"verifier-orthographe": config.verifierOrthographe || false,
		"ecrire-a-cheval": config.ecrireAChevalSurLaMarge || false,
		lang: config.langueChoix,
		"maj-date-auto": config.majDateAuto,
	});

	nettoyerSpans(texte_principal);

	// Encodage du texte principal et des graphismes dans un seul hash, séparés par "|_|"
	const hash =
		encodeURIComponent(compresserHTML(texte_principal.innerHTML)) +
		"|_|" +
		encodeURIComponent(compresserHTML(graphismes.innerHTML));

	// Construction du lien final avec le hash pour le texte principal
	const lienFinal = baseURL + params.toString() + "#" + hash;

	zone_lien.innerText = lienFinal;
}

// Fonction pour copier le lien et afficher un popup
export function copier() {
	// Récupération du contenu de la zone de lien
	const zoneLien = document.getElementById("zone_lien");
	const texteLien = zoneLien.innerText;

	// Copie du texte dans le presse-papiers
	navigator.clipboard
		.writeText(texteLien)
		.then(() => {
			// Création du popup "Lien copié"
			const popup = document.createElement("div");
			popup.innerHTML = "Lien copié";
			popup.style.position = "fixed";
			popup.style.backgroundColor = "black";
			popup.style.color = "white";
			popup.style.fontSize = "12px";
			popup.style.padding = "5px 10px";
			popup.style.borderRadius = "5px";
			popup.style.zIndex = "2000";
			popup.style.opacity = "0";
			popup.style.transition = "opacity 0.3s";

			// Position du popup près du bouton "copier"
			const bouton = document.getElementById("copier");
			const rect = bouton.getBoundingClientRect();
			popup.style.left = rect.left + window.scrollX + "px";
			popup.style.top = rect.top + window.scrollY - 30 + "px"; // 30px au-dessus du bouton

			// Ajout du popup au document
			divContenu.appendChild(popup);

			// Faire apparaître le popup
			setTimeout(() => {
				popup.style.opacity = "1";
			}, 10);

			// Faire disparaître le popup après 2 secondes
			setTimeout(() => {
				popup.style.opacity = "0";
				setTimeout(() => {
					divContenu.removeChild(popup);
				}, 300); // Retire le popup du DOM après la transition
			}, 2000);
		})
		.catch((err) => {
			console.error("Erreur lors de la copie : ", err);
		});
}
