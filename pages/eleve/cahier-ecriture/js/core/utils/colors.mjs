export function normaliseCouleur(couleur) {
	// Dictionnaire français vers noms de couleurs HTML/CSS standards
	const couleurs = {
		// Couleurs de base
		noir: "Black",
		bleu: "Blue",
		marron: "Brown",
		cyan: "Cyan",
		gris: "Gray",
		vert: "Green",
		magenta: "Magenta",
		bordeaux: "Maroon",
		marine: "Navy",
		olive: "Olive",
		violet: "Purple",
		rouge: "Red",
		argent: "Silver",
		sarcelle: "Teal",
		blanc: "White",
		jaune: "Yellow",

		// Couleurs composées préconstruites
		vertolive: "OliveDrab",
		bleuciel: "SkyBlue",
		bleuroi: "RoyalBlue",
		bleumarine: "Navy",
		vertforet: "ForestGreen",
		vertcitron: "LimeGreen",
		vertmer: "SeaGreen",
		rosefonce: "DeepPink",
		bleunuit: "MidnightBlue",

		// Combinaisons courantes
		"vert olive": "OliveDrab",
		"vert-olive": "OliveDrab",
		"bleu ciel": "SkyBlue",
		"bleu-ciel": "SkyBlue",
		"bleu roi": "RoyalBlue",
		"bleu-roi": "RoyalBlue",
		"bleu marine": "Navy",
		"bleu-marine": "Navy",
		"vert foret": "ForestGreen",
		"vert-foret": "ForestGreen",
		"vert citron": "LimeGreen",
		"vert-citron": "LimeGreen",
		"vert mer": "SeaGreen",
		"vert-mer": "SeaGreen",
		"rose fonce": "DeepPink",
		"rose-fonce": "DeepPink",
		"bleu nuit": "MidnightBlue",
		"bleu-nuit": "MidnightBlue",
	};

	// Fonction pour vérifier si une chaîne est un code hexadécimal valide
	function estCodeHexadecimal(str) {
		return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(str);
	}

	// Nettoyer l'entrée : convertir en minuscules et supprimer les espaces superflus
	couleur = couleur.toLowerCase().trim();

	// Si c'est déjà un code hexadécimal, le retourner tel quel
	if (estCodeHexadecimal(couleur)) {
		return couleur;
	}

	// Vérifier d'abord la couleur exacte dans le dictionnaire
	if (couleurs[couleur]) {
		return couleurs[couleur];
	}

	// Essayer différentes variantes de formatage
	// 1. Supprimer tous les espaces
	const sansEspaces = couleur.replace(/\s+/g, "");
	if (couleurs[sansEspaces]) {
		return couleurs[sansEspaces];
	}

	// 2. Remplacer les tirets par des espaces
	const avecEspaces = couleur.replace(/-/g, " ");
	if (couleurs[avecEspaces]) {
		return couleurs[avecEspaces];
	}

	// 3. Gérer les modificateurs génériques (clair/foncé)
	const patterns = [
		/^(.*?)\s+clair$/, // "bleu clair"
		/^(.*?)-clair$/, // "bleu-clair"
		/^(.*?)\s+fonce$/, // "bleu fonce"
		/^(.*?)-fonce$/, // "bleu-fonce"
		/^(.*?)\s+foncé$/, // "bleu foncé"
		/^(.*?)-foncé$/, // "bleu-foncé"
	];

	for (let pattern of patterns) {
		const match = couleur.match(pattern);
		if (match) {
			const baseCouleur = match[1];
			const baseAnglais = couleurs[baseCouleur];

			if (baseAnglais) {
				if (pattern.source.includes("clair")) {
					return `Light${baseAnglais}`;
				} else {
					return `Dark${baseAnglais}`;
				}
			}
		}
	}

	// Si aucune correspondance n'est trouvée, retourner la couleur d'origine
	return couleur;
}
