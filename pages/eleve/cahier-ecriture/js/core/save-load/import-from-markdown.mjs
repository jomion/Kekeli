import { config } from "../config.mjs";
import { changeCarreaux } from "../ui/layout/background.mjs";
import { opacite } from "../menu/buttons/options-panel.mjs";
import {
	boutonCodi,
	checkboxSoulignerDate,
	choix_police,
	divContenu,
	lienCodi,
	resultatCodi,
	suiteCodi,
	texte_principal,
} from "../utils/dom.mjs";
import { change_police } from "../text-format/fonts/fonts.mjs";
import { changeDate } from "../date/date.mjs";
import { getLang, loadLanguage } from "../ui/language.mjs";
import { decompresserHTML } from "./compression.mjs";
import { normaliseCouleur } from "../utils/colors.mjs";

let lienHashCodi;

export async function traiteInputCodi(entree) {
	if (entree.length != 0) {
		let lang = getLang();

		const response = await fetch(`./js/_locales/${lang}.json`);
		const translations = await response.json();
		const textOK =
			translations["codiOK_content"] || "Texte correctement récupéré";
		const textPasOK =
			translations["codiPasOK_content"] || "Erreur. Lien invalide ?";

		const texteValide = await getTexte("#" + entree);
		suiteCodi.classList.add("hide");
		if (texteValide) {
			resultatCodi.classList.add("correct");
			resultatCodi.classList.remove("incorrect");
			resultatCodi.innerHTML = textOK;

			lienCodi.innerHTML = lienHashCodi =
				window.location.origin + window.location.pathname + "#" + entree;
			suiteCodi.classList.remove("hide");
		} else {
			resultatCodi.classList.add("incorrect");
			resultatCodi.classList.remove("correct");
			resultatCodi.innerHTML = textPasOK;
		}
	}
}

export function copieLienCodi() {
	// Copie du texte dans le presse-papiers
	navigator.clipboard
		.writeText(lienHashCodi)
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
			popup.style.zIndex = "10000";
			popup.style.opacity = "0";
			popup.style.transition = "opacity 0.3s";

			// Position du popup près du bouton "copier"
			const rect = boutonCodi.getBoundingClientRect();
			popup.style.left = rect.left + window.scrollX + "px";
			popup.style.top = rect.top + window.scrollY - 30 + "px"; // 30px au-dessus du bouton

			// Ajout du popup au DOM

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

export async function getTexte(hash) {
	let chaine_a_examiner = hash.substring(1);
	let url = handleURL(chaine_a_examiner);

	try {
		let texte = await fetchTextFromURL(url);
		// On transforme les balises `<u>` en `<span class="souligne-red">` pour éviter les conflits avec le soulignement par défaut du navigateur
		texte = texte.replace(/<u>/g, '<span class="souligne-red">');
		texte = texte.replace(/<\/u>/g, "</span>");

		afficheTexteDistant(texte);
		return true;
	} catch (err) {
		console.error("Erreur lors de la récupération du texte:", err);
		return false;
	}
}

function handleURL(url) {
	if (url !== "") {
		// Gestion des fichiers hébergés sur github
		if (url.startsWith("https://github.com")) {
			url = url.replace(
				"https://github.com",
				"https://raw.githubusercontent.com",
			);
			url = url.replace("/blob/", "/");
		}
		// gestion des fichiers hébergés sur codiMD / hedgedoc / digipage
		if (
			url.startsWith("https://codimd") ||
			url.includes("hedgedoc") ||
			url.includes("digipage")
		) {
			url = url
				.replace("?edit", "")
				.replace("?both", "")
				.replace("?view", "")
				.replace(/#$/, "")
				.replace(/\/$/, "");
			url = url.indexOf("download") === -1 ? url + "/download" : url;
		}
		// gestion des fichiers hébergés sur framapad
		if (url.includes("framapad") && !url.endsWith("/export/txt")) {
			url = url.replace(/\?.*/, "") + "/export/txt";
		}
	}
	return url;
}

async function fetchTextFromURL(url) {
	try {
		let response = await fetch(url);
		if (!response.ok) {
			throw new Error("Network response was not ok " + response.statusText);
		}
		let texte = await response.text();
		return texte;
	} catch (error) {
		console.error("There has been a problem with your fetch operation:", error);
		throw error;
	}
}

// Fonction pour afficher le texte
function afficheTexteDistant(texte) {
	// Identifier l'en-tête et le contenu en se basant sur `---`
	const sections = texte.split("---");
	let entete = "";
	let contenu = "";

	if (sections.length >= 3) {
		entete = sections[1].trim(); // L'en-tête est entre les deux `---`

		// Traiter les retours à la ligne après les `---` pour éviter les lignes vides
		contenu = sections
			.slice(2)
			.join("---")
			.replace(/^\s*\n/, "")
			.trim(); // Ignorer le premier saut de ligne après les `---`
	} else {
		contenu = texte.trim(); // Si pas de délimiteurs `---`, afficher tout le texte
	}

	// Extraire les paramètres depuis l'en-tête
	const lignesEntete = entete.split("\n");
	let police = "";
	let lignage = "";
	let autodate = false;
	let opaciteCodim;
	let couleur;

	// Helper compatible ES2018 pour récupérer la valeur après le ':' (ou undefined)
	function valueAfterColon(ligne) {
		const parts = ligne.split(":");
		if (parts.length < 2) return undefined;
		// Rejoindre au cas où la valeur contient des ':' et retourner trimée
		const val = parts.slice(1).join(":").trim();
		return val === "" ? undefined : val;
	}

	lignesEntete.forEach((ligne) => {
		if (ligne.startsWith("police:")) {
			police = valueAfterColon(ligne);
		} else if (ligne.startsWith("lang:") || ligne.startsWith("langue:")) {
			const langVal = valueAfterColon(ligne);
			if (langVal) {
				config.langue = langVal.toLowerCase().replace(/\s+/g, "_"); // Normalisation
				loadLanguage(config.langue);
				majUrl("lang", config.langue);
			}
		} else if (ligne.startsWith("lignage:")) {
			const lignageVal = valueAfterColon(ligne);
			if (lignageVal) {
				lignage = lignageVal.toLowerCase().replace(/\s+/g, "_"); // Normalisation
			}
		} else if (ligne.startsWith("autodate:")) {
			const autodateVal = valueAfterColon(ligne);
			autodate = autodateVal && autodateVal.toLowerCase() === "true";
		} else if (ligne.startsWith("souligner-date:")) {
			const soulignerVal = valueAfterColon(ligne);
			config.soulignerLaDate =
				soulignerVal && soulignerVal.toLowerCase() === "true";
			checkboxSoulignerDate.checked = config.soulignerLaDate;
		} else if (ligne.startsWith("couleur:")) {
			const couleurVal = valueAfterColon(ligne);
			if (couleurVal) couleur = couleurVal.toLowerCase();
		} else if (ligne.startsWith("opacite-lignage:")) {
			// Récupérer la valeur après 'opacite:' et la nettoyer (enlever les espaces)
			let opaciteVal = valueAfterColon(ligne);

			if (opaciteVal && opaciteVal.includes("%")) {
				opaciteVal = opaciteVal.replace("%", "").trim();
				opaciteVal = parseFloat(opaciteVal) / 100;
			} else if (opaciteVal) {
				opaciteVal = opaciteVal.replace(",", ".").trim();
				opaciteVal = parseFloat(opaciteVal);
			}

			if (!isNaN(opaciteVal) && opaciteVal >= 0 && opaciteVal <= 1) {
				opaciteCodim = opaciteVal;
			} else if (opaciteVal !== undefined) {
				console.warn(
					"La valeur de l'opacité est invalide. Elle doit être entre 0 et 1.",
				);
			}
		}
	});

	// Appliquer les paramètres extraits
	if (opaciteCodim) {
		opacite(opaciteCodim);
	}

	if (police) {
		change_police(police);
		choix_police.value = police; // Mise à jour de l'élément sélectionné (choix_police)
	}
	if (lignage) {
		changeCarreaux(lignage);
	}
	if (couleur) {
		couleur = normaliseCouleur(couleur);
		document.documentElement.style.setProperty("--couleur-texte", couleur);
	}

	// Remplacer les retours à la ligne dans le contenu par des <div>
	const contenuHtml = contenu
		.split("\n") // Diviser le contenu en lignes
		.map((ligne) => {
			const trimmedLigne = ligne.trim(); // Supprimer les espaces avant et après la ligne
			// Si la ligne est vide après trim, ajouter un <br> à l'intérieur de la <div>
			return `<div>${trimmedLigne || "<br>"}</div>`;
		})
		.join(""); // Joindre les div ensemble

	// Afficher le contenu dans le DOM
	if (texte_principal) {
		texte_principal.innerHTML = decompresserHTML(contenuHtml);
	}

	// Ajouter la date automatiquement si autodate est activé
	if (autodate) {
		changeDate();
	}
}

function majUrl(cle, valeur) {
	// Récupère l'URL actuelle
	const url = new URL(window.location);

	// Met à jour ou ajoute le paramètre
	url.searchParams.set(cle, valeur);

	// Modifie l'URL sans recharger la page
	window.history.replaceState({}, "", url);
}
