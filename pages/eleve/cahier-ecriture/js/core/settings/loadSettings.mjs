import { config } from "../config.mjs";
import { defaultContent } from "../ui/content/defaultContent.mjs";
import {
	litDepuisStockage,
	getValueFromUrlOrStorage,
	stocke,
} from "./read-write.mjs";

export async function loadSettings() {
	const url = window.location.search;
	const urlParams = new URLSearchParams(url);

	const isOffline = !url.startsWith("http");

	// DEV
	if (window.location.href.includes("seyes-dev")) {
		document.body.classList.add("dev");
	}

	// Helpers
	const getRaw = (key) => getValueFromUrlOrStorage(urlParams, key);

	const getBool = async (key, defaultVal) => {
		const v = await getRaw(key);
		if (v === "true") return true;
		if (v === "false") return false;
		return defaultVal;
	};

	const getInt = async (key, defaultVal) => {
		const v = await getRaw(key);
		if (v === null) return defaultVal;
		const n = parseInt(v);
		return isNaN(n) ? defaultVal : n;
	};

	const getFloat = async (key, defaultVal) => {
		const v = await getRaw(key);
		if (v === null) return defaultVal;
		const n = parseFloat(v);
		return isNaN(n) ? defaultVal : n;
	};

	const getString = async (key, defaultVal = "") => {
		const v = await getRaw(key);
		return v !== null && v !== undefined ? v : defaultVal;
	};

	// Message d'accueil (stockage)
	let valeur = await litDepuisStockage(
		`afficher-message${config.numeroMessage}`,
		(v) => v,
	);

	if (valeur === "true") config.afficherMessage = true;
	else if (valeur === "false") config.afficherMessage = false;

	// Primtux
	if (urlParams.get("primtuxmenu")) {
		document.body.classList.add("primtux");
		config.afficherMessage = false;
	}

	// Config simple
	config.langueChoix = await getString("lang", "auto");
	config.couleursJours = await getString("couleurs-jours");
	config.police_active = await getString("police", config.police_active);
	config.largeur_marge = await getString("largeur-marge", config.largeur_marge);

	// Numbers
	config.largeur_marge_secondaire = await getFloat(
		"largeur-marge-secondaire",
		config.largeur_marge_secondaire,
	);

	const dejaVenu = await getBool("deja-venu", 0);

	if (dejaVenu) {
		config.opaciteLignes = await getFloat("opacite-lignes", 1);
	} else {
		stocke("deja-venu", true);
	}

	config.largeur_carreau = await getInt(
		"largeur-carreau",
		config.largeur_carreau,
	);

	config.espacementLettres = await getInt(
		"espacement-lettres",
		config.espacementLettres,
	);

	config.espacementMots = await getInt(
		"espacement-mots",
		config.espacementMots,
	);

	config.largeurImpression = await getInt(
		"largeur-impression",
		config.largeurImpression,
	);

	// Strings
	config.contenuGraphismes = await getString("graphismes");
	config.contenuImages = await getString("images");
	config.contenuTexteMarge = await getString("texte-marge");
	config.contenuTexteMargeComplementaire = await getString(
		"texte-marge-complementaire",
	);

	config.typeCarreaux = await getString("type-carreaux", config.typeCarreaux);

	// Contenu principal
	const contenuPrincipalStorage = await getString("texte-principal");

	if (contenuPrincipalStorage) {
		config.contenuTextePrincipal = contenuPrincipalStorage;
	} else {
		config.contenuTextePrincipal = await defaultContent(isOffline);
	}

	// Booléens (TOUS cohérents maintenant)
	config.fermetureDuS = await getBool("fermer-s", config.fermetureDuS);

	config.ajouterLaDate = await getBool("ajouter-date", config.ajouterLaDate);

	config.soulignerLaDate = await getBool(
		"souligner-date",
		config.soulignerLaDate,
	);

	config.verifierOrthographe = await getBool(
		"verifier-orthographe",
		config.verifierOrthographe,
	);

	config.interligneDouble = await getBool(
		"double-interligne",
		config.interligneDouble,
	);

	config.ecrireAChevalSurLaMarge = await getBool(
		"ecrire-a-cheval",
		config.ecrireAChevalSurLaMarge,
	);

	config.majDateAuto = await getBool("maj-date-auto", config.majDateAuto);

	config.marelle = !config.marelleSecret;
	if (urlParams.has("marelle")) {
		config.marelle = true;
	}

	if (!config.marelle && config.police_active.includes("Marelle")) {
		config.police_active = "Belle Allure CE";
	}

	if (config.marelle && config.police_active.includes("Belle Allure")) {
		config.police_active = "Marelle";
	}
}
