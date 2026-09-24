export function align(cote) {
	// Récupérer la sélection de l'utilisateur
	const selection = document.getSelection();

	// Vérifier qu'il y a bien une sélection
	if (selection.rangeCount > 0) {
		// Récupérer le premier élément du range sélectionné
		let element = selection.anchorNode;

		// Remonter jusqu'à trouver le premier parent de type DIV
		while (element && element.tagName !== "DIV") {
			element = element.parentNode;
		}

		// S'assurer qu'on est bien sur un DIV avant d'appliquer l'alignement
		if (element) {
			element.style.textAlign = cote;
		} else {
			console.warn("Aucun élément de type DIV trouvé");
		}
	} else {
		console.warn("Aucune sélection trouvée");
	}
}
