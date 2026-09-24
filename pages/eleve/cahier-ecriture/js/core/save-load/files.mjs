import { config } from "../config.mjs";
import { texte_principal } from "../utils/dom.mjs";
import {
	readDocxFile,
	readOdtFile,
	readFileAsText,
} from "./import-from-docx-odt.mjs";
import { applySettings } from "../settings/applySettings.mjs";
import { loadSettings } from "../settings/loadSettings.mjs";
import { save_texte } from "../settings/read-write.mjs";
import { resetContent } from "../ui/content/resetContent.mjs";

export function ouvrir() {
	// Crée un élément input de type file
	const input = document.createElement("input");
	input.type = "file"; // Spécifie que c'est un champ de fichier
	input.accept = ".json, .sey, .txt, .doc, .docx";

	// Ajoute un écouteur d'événements pour l'ouverture du fichier
	input.addEventListener("change", handleFileSelect);

	// Simule un clic sur l'élément input pour ouvrir la boîte de dialogue de fichier
	input.click();
}

async function handleFileSelect(event) {
	const file = event.target.files[0];

	if (!file) {
		alert("Aucun fichier sélectionné.");
		return;
	}

	const validExtensions = [".json", ".sey", ".odt", ".doc", ".docx", ".txt"];
	if (!validExtensions.some((ext) => file.name.endsWith(ext))) {
		alert(
			"Erreur : fichier non valide. Extensions acceptées : " +
				validExtensions.join(", ")
		);
		return;
	}

	try {
		if (
			file.name.endsWith(".doc") ||
			file.name.endsWith(".docx") ||
			file.name.endsWith(".odt")
		) {
			// On charge la librairie mammoth.js pour pouvoir traiter les fichiers .docx, .doc et .odt
			if (typeof window.mammoth === "undefined") {
				const script = document.createElement("script");
				script.src = "./js/lib/mammoth.browser.min.js";
				document.head.appendChild(script);
				// on attend que le script soit chargé
				await new Promise((resolve, reject) => {
					script.onload = resolve;
					script.onerror = reject;
				});
			}
		}
		if (file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
			const content = await readDocxFile(file);
			insereContenu(content);
		} else if (file.name.endsWith(".odt")) {
			const content = await readOdtFile(file);
			insereContenu(content);
		} else {
			config.nomDuFichierOuvert =
				file.name.split(".").slice(0, -1).join(".") || file.name;

			const content = await readFileAsText(file);
			if (file.name.endsWith(".json") || file.name.endsWith(".sey")) {
				handleJSONFile(content);
			} else {
				insereContenu(content);
			}
		}
	} catch (error) {
		alert("Erreur lors du traitement du fichier : " + error.message);
		console.error(error);
	}
}

// Gestion des fichiers JSON ou SEY
async function handleJSONFile(content) {
	try {
		const data = JSON.parse(content);

		// Stockage des données dans localStorage
		for (const [key, value] of Object.entries(data)) {
			// On stringify uniquement si c'est un objet
			const storedValue =
				typeof value === "object" ? JSON.stringify(value) : value;
			localStorage.setItem(key, storedValue);
		}

		// Appeler loadSettings et applySettings
		await loadSettings();
		applySettings();
	} catch (error) {
		alert("Erreur : le contenu du fichier JSON est invalide.");
		console.error(error);
	}
}

function insereContenu(content) {
	resetContent();
	texte_principal.innerHTML = content;
}

export async function prepareEnregistrement() {
	await save_texte();
	let nomDuFichier = "texte";
	if (config.dateDuDoc) {
		nomDuFichier = `${nomDuFichier}-${config.dateDuDoc}`;
	}
	if (config.nomDuFichierOuvert) {
		nomDuFichier = config.nomDuFichierOuvert;
	}
	if (window.showSaveFilePicker) {
		enregistrerFichierAvecDialogue(`${nomDuFichier}.sey`);
	} else {
		enregistrer(`${nomDuFichier}.sey`);
	}
}

function enregistrer(nomDeFichier) {
	const data = {};

	// Parcourir toutes les clés dans le localStorage
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);

		// Vérifie si la clé commence par le préfixe spécifié
		if (key.startsWith(config.prefixeAppli + "-")) {
			// Récupère la valeur de la clé
			const value = localStorage.getItem(key);

			// Si la clé contient "texte-principal", on ne la transforme pas en JSON (on conserve la chaîne telle quelle)
			if (key === "seyes-texte-principal") {
				data[key] = value;
			} else {
				try {
					// Essaie de parser la valeur comme JSON
					data[key] = JSON.parse(value);
				} catch (e) {
					// Si ce n'est pas du JSON, conserve la valeur sous forme de chaîne
					console.error(e);
					data[key] = value;
				}
			}
		}
	}

	// Convertit les données en JSON
	const jsonData = JSON.stringify(data, null, 2);

	// Crée un Blob contenant les données JSON
	const blob = new Blob([jsonData], { type: "application/json" });

	// Crée un lien pour télécharger le fichier
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = nomDeFichier; // Nom du fichier à télécharger
	link.click(); // Lance le téléchargement
}

async function enregistrerFichierAvecDialogue(
	nomParDefaut,
	prefixeAppli = "seyes"
) {
	const data = {};

	// Parcourir le localStorage et récupérer les données
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);

		if (key.startsWith(prefixeAppli + "-")) {
			const value = localStorage.getItem(key);
			if (key === "seyes-texte-principal") {
				data[key] = value;
			} else {
				try {
					data[key] = JSON.parse(value);
				} catch (e) {
					console.error(e);
					data[key] = value;
				}
			}
		}
	}

	const jsonData = JSON.stringify(data, null, 2);

	try {
		// Affiche la boîte "Enregistrer sous…"
		const handle = await window.showSaveFilePicker({
			suggestedName: nomParDefaut,
			types: [
				{
					description: "Fichier JSON",
					accept: { "application/json": [".json"] },
				},
			],
		});

		const writable = await handle.createWritable();
		await writable.write(jsonData);
		await writable.close();

		alert("Fichier enregistré avec succès !");
	} catch (err) {
		if (err.name !== "AbortError") {
			console.error("Erreur lors de l'enregistrement :", err);
			alert("Une erreur est survenue lors de l'enregistrement.");
		}
	}
}
