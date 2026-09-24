import { getTexte } from "./import-from-markdown.mjs";

export function checkHash(contenuTextePrincipal, contenuGraphismes) {
	// Récupération de l'URL et des paramètres
	let url = window.location.search;

	// Remplacer les occurrences de '&amp;' par '&' uniquement dans les paramètres de l'URL
	if (url.includes("&amp;")) {
		url = url.replace(/&amp;/g, "&");
	}

	if (window.location.hash) {
		if (window.location.hash.startsWith("#http")) {
			getTexte(window.location.hash);
		} else {
			// Enlève le '#' initial et décode le hash
			const hashValues = decodeURIComponent(
				window.location.hash.substring(1)
			).split("|_|");

			// Vérifie que les deux parties sont bien présentes dans le hash
			if (hashValues.length === 2) {
				let textePrincipalRecupere = hashValues[0];
				let graphismesRecupere = hashValues[1];

				// Met à jour le contenu des éléments avec les valeurs récupérées
				contenuTextePrincipal = textePrincipalRecupere;
				contenuGraphismes = graphismesRecupere;
			} else {
				// Si seulement une partie est présente (par exemple si le hash n'a pas "|_|"), gère cela
				contenuTextePrincipal = hashValues[0];
			}

			// Nettoyage de l'URL après traitement des paramètres
			const baseUrl =
				window.location.protocol +
				"//" +
				window.location.host +
				window.location.pathname;

			// Remplace l'URL actuelle avec l'URL de base (sans les paramètres et sans hash) sans recharger la page
			window.history.replaceState({}, document.title, baseUrl);
		}
	}
	return { contenuTextePrincipal, contenuGraphismes };
}
