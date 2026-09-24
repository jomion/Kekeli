// ========================================
// DICTIONNAIRE DE COMPRESSION
// ========================================
const COMPRESSION_MAP = {
	// Soulignements
	"souligne-red": "§r",
	"souligne-blue": "§b",
	"souligne-green": "§g",
	"souligne-yellow": "§y",
	"souligne-pink": "§p",
	"souligne-black": "§k",
	"souligne-purple": "§u",
	"souligne-orange": "§o",

	// Barré
	textebarre: "§x",

	// Couleurs
	"couleur-red": "¤r",
	"couleur-coral": "¤cr",
	"couleur-salmon": "¤s",
	"couleur-orange": "¤o",
	"couleur-gold": "¤gd",
	"couleur-yellow": "¤y",
	"couleur-lime": "¤l",
	"couleur-green": "¤g",
	"couleur-olive": "¤ol",
	"couleur-teal": "¤t",
	"couleur-cyan": "¤c",
	"couleur-blue": "¤b",
	"couleur-navy": "¤n",
	"couleur-indigo": "¤i",
	"couleur-purple": "¤p",
	"couleur-magenta": "¤m",
	"couleur-pink": "¤pk",
	"couleur-beige": "¤be",
	"couleur-brown": "¤br",
	"couleur-gray": "¤gr",
	"couleur-silver": "¤sv",
	"couleur-black": "¤bk",
	"couleur-white": "¤w",
	"couleur-transparent": "¤tr",

	// Surlignements
	"surlignement-red": "µr",
	"surlignement-coral": "µcr",
	"surlignement-salmon": "µs",
	"surlignement-orange": "µo",
	"surlignement-gold": "µgd",
	"surlignement-yellow": "µy",
	"surlignement-lime": "µl",
	"surlignement-green": "µg",
	"surlignement-olive": "µol",
	"surlignement-teal": "µt",
	"surlignement-cyan": "µc",
	"surlignement-blue": "µb",
	"surlignement-navy": "µn",
	"surlignement-indigo": "µi",
	"surlignement-purple": "µp",
	"surlignement-magenta": "µm",
	"surlignement-pink": "µpk",
	"surlignement-beige": "µbe",
	"surlignement-brown": "µbr",
	"surlignement-gray": "µgr",
	"surlignement-silver": "µsv",
	"surlignement-black": "µbk",
	"surlignement-white": "µw",
	"surlignement-transparent": "µtr",

	// Autres
	entoure: "◆",
};

// Reverse map pour décompression
const DECOMPRESSION_MAP = Object.fromEntries(
	Object.entries(COMPRESSION_MAP).map(([k, v]) => [v, k]),
);

function escapeTexte(texte) {
	return texte
		.replace(/\\/g, "\\\\")
		.replace(/!/g, "\\!")
		.replace(/\$/g, "\\$");
}

function unescapeTexte(texte) {
	return texte
		.replace(/\\\$/g, "$")
		.replace(/\\!/g, "!")
		.replace(/\\\\/g, "\\");
}

function splitNonEchappe(str) {
	const result = [];
	let current = "";
	let escaped = false;

	for (const char of str) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if (char === "!") {
			result.push(current);
			current = "";
			continue;
		}

		current += char;
	}

	// IMPORTANT :
	// si la string finit par "\" on le garde
	if (escaped) {
		current += "\\";
	}

	result.push(current);

	return result;
}

// ========================================
// Parse les blocs $...$ en respectant \$
// ========================================

function remplacerBlocsDollar(str, callback) {
	let result = "";

	let inside = false;
	let escaped = false;
	let current = "";

	for (const char of str) {
		// Gestion échappement
		if (escaped) {
			if (inside) {
				current += "\\" + char;
			} else {
				result += "\\" + char;
			}

			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		// Début/fin bloc
		if (char === "$") {
			if (inside) {
				// Fin
				result += callback(current);
				current = "";
				inside = false;
			} else {
				// Début
				inside = true;
			}

			continue;
		}

		// Accumulation
		if (inside) {
			current += char;
		} else {
			result += char;
		}
	}

	// Bloc non fermé → on remet brut
	if (inside) {
		result += "$" + current;
	}

	return result;
}

// ========================================
// COMPRESSION
// ========================================

export function compresserHTML(html) {
	console.log("Compression du texte - version script du 18 mai 2026");
	console.log("Texte original");
	console.log(html);
	let resultat = html;

	// .entoure récursif
	resultat = resultat.replace(
		/<span class="entoure">([^]*?)<\/span>/g,
		(match, contenu) => {
			return `◆${compresserHTML(contenu)}◆`;
		},
	);

	// spans classiques
	resultat = resultat.replace(
		/<span class="([^"]*)">([^<]*)<\/span>/g,
		(match, classes, texte) => {
			const classList = classes
				.split(" ")
				.map((c) => c.trim())
				.filter(Boolean);

			const classesComprimees = classList
				.map((c) => COMPRESSION_MAP[c] || c)
				.join("!");

			const texteEscape = escapeTexte(texte);

			if (!classesComprimees) {
				return texteEscape;
			}

			return `$${classesComprimees}!${texteEscape}$`;
		},
	);

	console.log("Texte comprimé");
	console.log(resultat);

	return resultat;
}

// ========================================
// DÉCOMPRESSION
// ========================================

export function decompresserHTML(comprime) {
	console.log("Décompression du texte - version script du 18 mai 2026");
	console.log("Texte comprimé");
	console.log(comprime);

	let resultat = comprime;

	// ========================================
	// .entoure d'abord
	// ========================================

	resultat = resultat.replace(/◆([^]*?)◆/g, (match, contenu) => {
		return `<span class="entoure">${decompresserHTML(contenu)}</span>`;
	});

	// ========================================
	// blocs $...$
	// ========================================

	resultat = remplacerBlocsDollar(resultat, (contenu) => {
		const parties = splitNonEchappe(contenu);

		if (parties.length === 0) {
			return `$${contenu}$`;
		}

		let texte = parties[parties.length - 1];

		const shortcodes = parties.slice(0, -1);

		const classes = shortcodes
			.map((code) => DECOMPRESSION_MAP[code] || code)
			.filter(Boolean)
			.join(" ");

		texte = unescapeTexte(texte);

		if (classes) {
			return `<span class="${classes}">${texte}</span>`;
		}

		return texte;
	});

	console.log("Texte décompressé");
	console.log(resultat);

	return resultat;
}
