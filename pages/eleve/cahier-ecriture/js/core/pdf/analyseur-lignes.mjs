/*
 * This file is part of Seyes.
 *
 * Copyright (C) 2025-2026 Yannick Defais <yannick.defais@ac-creteil.fr>
 *
 * Seyes is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Seyes is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Seyes. If not, see <https://www.gnu.org/licenses/>.
 */

import { config } from "../config.mjs";
import { RATIO_ESPACE_VIDE_CORRECTION, SEUIL_LIGNE_VIDE_POURCENTAGE } from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";
import { largeurCarreauNormalisee, obtenirConfigSeyes } from "./utils.mjs";

/**
 * Analyseur de lignes visuelles — technique Ben Nadel, version Range globale.
 *
 * Détection précise des retours à la ligne dans le rendu du navigateur en
 * itérant caractère par caractère sur une Range qui s'étend à travers
 * **tous les nœuds texte** du conteneur (pas une Range par nœud) :
 *
 *  - L'ancien parcours par nœud cassait quand des spans formatage
 *    (`couleur-*`, `souligne-*`, `textebarre`, `entoure`, `syllabe-*`)
 *    découpaient le texte d'une ligne physique en plusieurs TEXT_NODES :
 *    chaque fragment devenait une « ligne visuelle » distincte → 3 lignes
 *    Seyès au lieu d'1 → pagination décalée + fins de ligne prématurées.
 *
 *  - La Range globale détecte 1 seule ligne visuelle pour tous les fragments
 *    qui partagent la même position Y. Le marquage (`marquerDomAvecLignes`)
 *    produit ensuite **un seul `<span data-seyes-ligne="N">` par ligne**,
 *    via `Range.extractContents()` + `Range.insertNode()`, englobant les
 *    spans formatage internes (préservation du rendu en aval).
 *
 * Référence Ben Nadel :
 *   https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
 */

/**
 * Analyse principale : détecte les lignes visuelles, crée le mapping Seyès,
 * et marque le DOM avec `[data-seyes-ligne]` pour récupération dans le clone.
 *
 * @param {HTMLElement} elementTextePrincipal
 * @returns {{lignesVisuelles: Array, mappageLignes: Array, totalLignesVisuelles: number}}
 */
export function analyserLignesTexte(elementTextePrincipal) {
	journaliseur.demarrerSection("ANALYSE BEN NADEL");

	nettoyerMarquagePrecedent(elementTextePrincipal);
	const lignesVisuelles = extraireLignesVisuelles(elementTextePrincipal);
	journaliseur.info("ANALYSE_BEN_NADEL", `${lignesVisuelles.length} lignes visuelles détectées`);

	let mappageLignes = mapperLignesSeyes(lignesVisuelles);
	marquerDomAvecLignes(elementTextePrincipal, lignesVisuelles, mappageLignes);

	// En mode cahier_de_textes, le clone capturé applique
	// `[data-seyes-ligne] { display: block }` (Invariant 11). Cette règle CSS
	// décale les Y dans le clone vs live DOM — le décalage dépend de la
	// structure DOM entre paragraphes (browser-specific). Pour que la
	// pagination (qui utilise `positionY`) reflète le rendu capturé, on
	// **recalibre** les positionY en remesurant après application transitoire
	// de display:block sur le live DOM. Browser-agnostique : la mesure devient
	// la vérité absolue, indépendante de la structure HTML (`<br><br>`,
	// `<div><br></div>`, mixte).
	//
	// Puis on **réexécute mapperLignesSeyes** : les coupures de paragraphes
	// (calculées par `detecterCoupuresParagraphes` à partir des écarts Y)
	// peuvent changer si le rendu display:block introduit/supprime des
	// lignes vides apparentes. Le mapping Seyès final reflète le rendu réel.
	if (config.typeCarreaux === "cahier_de_textes") {
		recalibrerPositionsAvecDisplayBlock(elementTextePrincipal, lignesVisuelles);
		mappageLignes = mapperLignesSeyes(lignesVisuelles);
	}

	journaliseur.info("ANALYSE_BEN_NADEL", "Analyse terminée avec succès", {
		lignesVisuelles: lignesVisuelles.length,
		lignesSeyes: mappageLignes.length,
	});
	return {
		lignesVisuelles,
		mappageLignes,
		totalLignesVisuelles: lignesVisuelles.length,
	};
}

/**
 * Recalibre `lignesVisuelles[i].positionY` en remesurant après application
 * transitoire de `display: block; white-space: nowrap` sur les wrappers
 * `[data-seyes-ligne]` du live DOM. Restaure le state après mesure.
 *
 * Utilisé en mode cahier_de_textes pour aligner les Y mesurés sur ceux du
 * rendu capturé (qui applique display:block via normaliserCSSPourCapture).
 *
 * @param {HTMLElement} element
 * @param {Array} lignesVisuelles
 */
function recalibrerPositionsAvecDisplayBlock(element, lignesVisuelles) {
	const wrappers = element.querySelectorAll("[data-seyes-ligne]");
	if (wrappers.length === 0) return;

	const conteneurExtensible = document.getElementById("conteneur-extensible");
	const offsetConteneur = conteneurExtensible
		? conteneurExtensible.getBoundingClientRect().top
		: 0;

	// Sauvegarde + application transitoire.
	const inlineBackup = [];
	wrappers.forEach((w) => {
		inlineBackup.push({
			display: w.style.getPropertyValue("display"),
			displayPriority: w.style.getPropertyPriority("display"),
			whiteSpace: w.style.getPropertyValue("white-space"),
			whiteSpacePriority: w.style.getPropertyPriority("white-space"),
		});
		w.style.setProperty("display", "block", "important");
		w.style.setProperty("white-space", "nowrap", "important");
	});

	// Force reflow synchrone pour que getBoundingClientRect reflète le
	// nouveau layout.
	void element.offsetHeight;

	// Re-mesure des Y dans l'état display:block.
	const newPositions = new Map();
	wrappers.forEach((w) => {
		const indexVisuel = parseInt(w.getAttribute("data-seyes-ligne"), 10);
		const y = w.getBoundingClientRect().top - offsetConteneur;
		newPositions.set(indexVisuel, y);
	});

	// Restauration.
	wrappers.forEach((w, i) => {
		const b = inlineBackup[i];
		if (b.display) w.style.setProperty("display", b.display, b.displayPriority);
		else w.style.removeProperty("display");
		if (b.whiteSpace) w.style.setProperty("white-space", b.whiteSpace, b.whiteSpacePriority);
		else w.style.removeProperty("white-space");
	});

	// Mise à jour de lignesVisuelles[i].positionY avec les Y recalibrés.
	let updated = 0;
	lignesVisuelles.forEach((ligne) => {
		if (newPositions.has(ligne.indexVisuel)) {
			const newY = newPositions.get(ligne.indexVisuel);
			if (Math.abs(newY - ligne.positionY) > 0.5) updated++;
			ligne.positionY = newY;
		}
	});
	journaliseur.debug(
		"RECALIBRAGE_CDT",
		`${updated}/${lignesVisuelles.length} positions Y recalibrées (display:block transitoire)`,
	);
}

/**
 * Range Ben Nadel **globale** sur tous les nœuds texte de l'élément. Itère
 * caractère par caractère et compte les rectangles retournés par
 * `getClientRects()` — un nouveau rectangle = nouvelle ligne visuelle.
 *
 * Chaque ligne visuelle peut contenir plusieurs **fragments** (un par
 * TEXT_NODE traversé). Les fragments d'une même ligne visuelle partagent le
 * même `indexVisuel`, ce qui permet au marquage en aval d'envelopper la
 * ligne entière (formatages compris) dans un seul `<span data-seyes-ligne>`.
 *
 * Coordonnées Y normalisées par rapport à `#conteneur-extensible` (cf.
 * SnapDOM en position relative).
 *
 * @param {HTMLElement} element
 * @returns {Array<{indexVisuel:number, positionY:number, hauteur:number, rectangle:DOMRect, fragments:Array<{noeudTexte:Text, indexDebut:number, indexFin:number}>, contenu:string}>}
 */
export function extraireLignesVisuelles(element) {
	const noeudsTexte = [];
	const marcheur = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
	let n;
	while ((n = marcheur.nextNode())) {
		if (n.textContent.length > 0) noeudsTexte.push(n);
	}
	if (noeudsTexte.length === 0) return [];

	const conteneurExtensible = document.getElementById("conteneur-extensible");
	const offsetConteneur = conteneurExtensible
		? conteneurExtensible.getBoundingClientRect().top
		: 0;

	const range = document.createRange();
	range.setStart(noeudsTexte[0], 0);

	const lignes = [];
	let yLigneCourante = -Infinity;
	let ligneCourante = null;
	let fragmentCourant = null;

	// Tolérance sub-pixel : `getClientRects().top` peut varier de fractions
	// de pixel d'un char à l'autre sur la même ligne (rendu typo). 2 px est
	// très en-dessous d'un interligne minimal (carreau ≥ ~16 px), donc on
	// ne risque pas de fusionner deux vraies lignes contiguës.
	const TOLERANCE_Y_PX = 2;

	for (const noeudTexte of noeudsTexte) {
		const longueur = noeudTexte.textContent.length;
		for (let offset = 0; offset < longueur; offset++) {
			range.setEnd(noeudTexte, offset + 1);
			const rectangles = range.getClientRects();
			if (rectangles.length === 0) continue;

			const dernierRectangle = rectangles[rectangles.length - 1];
			const yPos = dernierRectangle.top - offsetConteneur;

			// Nouvelle ligne SSI Y a sauté significativement. NE PAS utiliser
			// `rectangles.length` comme l'algo Ben Nadel original : per spec
			// CSSOM-View, `getClientRects()` retourne **un rectangle par
			// inline-element box partiellement contenue** par la range, pas
			// un par ligne physique. Avec des spans formatage (`couleur-*`,
			// `souligne-*`, `entoure`, etc.), le rect count saute à chaque
			// frontière de span même sur la même ligne physique → splitterait
			// abusivement une ligne en N entrées. La position Y est l'invariant
			// fiable du rendu typo.
			//
			// Référence : régression 2026-04-26, fix après instrumentation
			// [DBG_TRANSITIONS] qui a montré rect count 3→4→6→7→9 sur 2
			// lignes physiques (Y constant 277.8 puis 401.8) avec 2 spans
			// couleur dans le 1er paragraphe.
			const estNouvelleLigne = yPos > yLigneCourante + TOLERANCE_Y_PX;

			if (estNouvelleLigne) {
				yLigneCourante = yPos;
				ligneCourante = {
					indexVisuel: lignes.length,
					positionY: yPos,
					hauteur: dernierRectangle.height,
					rectangle: dernierRectangle,
					fragments: [],
					contenu: "",
				};
				lignes.push(ligneCourante);
				fragmentCourant = { noeudTexte, indexDebut: offset, indexFin: offset };
				ligneCourante.fragments.push(fragmentCourant);
			} else if (!fragmentCourant || fragmentCourant.noeudTexte !== noeudTexte) {
				// Même ligne visuelle, nouveau nœud texte → nouveau fragment.
				fragmentCourant = { noeudTexte, indexDebut: offset, indexFin: offset };
				ligneCourante.fragments.push(fragmentCourant);
			} else {
				fragmentCourant.indexFin = offset;
			}

			ligneCourante.contenu += noeudTexte.textContent.charAt(offset);

			// Garde la position Y la plus haute (i.e. la plus petite valeur)
			// au cas où un retour de rectangle plus haut survienne sur la
			// même ligne (rare).
			if (yPos < ligneCourante.positionY) {
				ligneCourante.positionY = yPos;
				ligneCourante.rectangle = dernierRectangle;
			}
		}
	}

	lignes.forEach((ligne) => {
		journaliseur.debug(
			"ANALYSE_BEN_NADEL",
			`Ligne ${ligne.indexVisuel}: "${ligne.contenu.substring(0, 40)}" (${ligne.fragments.length} fragment(s))`,
		);
	});

	return lignes;
}

/**
 * Mapping lignes visuelles → lignes Seyès, avec insertion des lignes vides
 * entre paragraphes (détectées par mesure de l'espace vide réel).
 *
 * `mappageLignes[i]` retourne :
 *   { indexVisuel, ligneSeyes, indexLigneSeyes, positionY, contenu,
 *     noeudTexte, indexDebut, indexFin }
 *
 * Le couple (`noeudTexte`, `indexDebut`, `indexFin`) référence le **premier
 * fragment** de la ligne (compat avec consommateurs historiques). Pour les
 * consommateurs qui ont besoin de tous les fragments, utiliser
 * `lignesVisuelles[i].fragments` directement.
 *
 * @param {Array} lignesVisuelles
 * @returns {Array<Object>}
 */
export function mapperLignesSeyes(lignesVisuelles) {
	const configSeyes = obtenirConfigSeyes();
	const largeurCarreau = largeurCarreauNormalisee(configSeyes.largeur_carreau);
	journaliseur.info("MAPPING_SEYES", `Création mapping (carreau: ${largeurCarreau}px)`);

	const coupures = detecterCoupuresParagraphes(lignesVisuelles, largeurCarreau);
	const mapping = [];
	let indexSeyesActuel = 0;

	lignesVisuelles.forEach((ligneVisuelle, indexVisuel) => {
		const coupureAvant = coupures.find((c) => c.avantLigneVisuelle === indexVisuel);
		if (coupureAvant) {
			for (let i = 0; i < coupureAvant.nombreLignesVides; i++) indexSeyesActuel++;
		}

		const premier = ligneVisuelle.fragments[0] || null;
		mapping.push({
			indexVisuel,
			ligneSeyes: indexSeyesActuel + 1,
			indexLigneSeyes: indexSeyesActuel,
			positionY: ligneVisuelle.positionY,
			contenu: ligneVisuelle.contenu,
			noeudTexte: premier ? premier.noeudTexte : null,
			indexDebut: premier ? premier.indexDebut : 0,
			indexFin: premier ? premier.indexFin : 0,
		});
		indexSeyesActuel++;
	});

	journaliseur.info(
		"MAPPING_SEYES",
		`Mapping terminé: ${lignesVisuelles.length} visuelles → ${indexSeyesActuel} Seyès totales`,
	);

	return mapping;
}

/**
 * Marque le DOM avec **un seul `<span data-seyes-ligne="N">` par ligne
 * visuelle**, englobant tous les fragments (formatages internes compris).
 *
 * Utilise `Range.extractContents()` + `Range.insertNode()` :
 *  - Si la ligne se termine au milieu d'un span formatage (cas où un mot
 *    `entoure` est wrappé sur 2 lignes par exemple), `extractContents` split
 *    proprement le span en 2 — chaque moitié reste correctement classée.
 *  - Les espaces de fin de ligne sont **exclus** du wrapper (placés comme
 *    nœud texte séparé) pour éviter le bug bbox-sur-2-lignes documenté
 *    historiquement (cahier de textes + paragraphes).
 *
 * Lignes traitées en **ordre inverse** : les ranges des lignes 0..N−1 ne
 * touchent pas aux nœuds des lignes >N, donc traiter d'abord la ligne N
 * préserve les références noeudTexte des lignes antérieures.
 *
 * @param {HTMLElement} _element - non utilisé (gardé pour symétrie d'API)
 * @param {Array} lignesVisuelles
 * @param {Array} mappageLignes - aligné par index avec `lignesVisuelles`
 */

export function marquerDomAvecLignes(_element, lignesVisuelles, mappageLignes) {
	for (let i = lignesVisuelles.length - 1; i >= 0; i--) {
		const ligne = lignesVisuelles[i];
		const mappage = mappageLignes[i];
		if (!ligne || !ligne.fragments || ligne.fragments.length === 0) continue;

		const premier = ligne.fragments[0];
		const dernier = ligne.fragments[ligne.fragments.length - 1];
		if (!premier.noeudTexte.parentNode || !dernier.noeudTexte.parentNode) continue;

		// Trailing whitespace sur le dernier fragment → exclu du wrapper.
		const texteDernier = dernier.noeudTexte.textContent.substring(
			dernier.indexDebut,
			dernier.indexFin + 1,
		);
		const matchTrailing = texteDernier.match(/^([\s\S]*?)(\s+)$/);
		const offsetFinWrapper = matchTrailing
			? dernier.indexDebut + matchTrailing[1].length
			: dernier.indexFin + 1;

		// Ligne entièrement vide / espaces seulement → skip.
		if (premier.noeudTexte === dernier.noeudTexte && premier.indexDebut >= offsetFinWrapper) {
			continue;
		}

		const range = document.createRange();
		range.setStart(premier.noeudTexte, premier.indexDebut);
		range.setEnd(dernier.noeudTexte, offsetFinWrapper);

		const wrapper = document.createElement("span");
		wrapper.setAttribute("data-seyes-ligne", String(ligne.indexVisuel));
		wrapper.setAttribute("data-seyes-ligne-numero", String(mappage.ligneSeyes));
		wrapper.setAttribute(
			"data-seyes-ligne-contenu",
			(mappage.contenu || "").substring(0, 20),
		);

		const contenuExtrait = range.extractContents();
		wrapper.appendChild(contenuExtrait);
		range.insertNode(wrapper);

		journaliseur.debug(
			"MARQUAGE_DOM",
			`Ligne ${ligne.indexVisuel} (Seyès ${mappage.ligneSeyes}): "${(mappage.contenu || "").substring(0, 40)}"`,
		);
	}
}

/**
 * Détection des coupures de paragraphes par mesure de l'espace vide réel.
 * Un espace > 70 % d'un carreau indique au moins une ligne vide.
 * Formule : nombreLignesVides = floor((espaceVide + 0.3 × carreau) / carreau).
 *
 * @param {Array} lignesVisuelles
 * @param {number} largeurCarreau - en px
 * @returns {Array<{avantLigneVisuelle:number, nombreLignesVides:number}>}
 */
function detecterCoupuresParagraphes(lignesVisuelles, largeurCarreau) {
	const coupures = [];
	if (lignesVisuelles.length < 2) return coupures;

	const seuilUneLineVide = largeurCarreau * SEUIL_LIGNE_VIDE_POURCENTAGE;

	for (let i = 1; i < lignesVisuelles.length; i++) {
		const ligneActuelle = lignesVisuelles[i];
		const lignePrecedente = lignesVisuelles[i - 1];
		const hauteurLignePrecedente = lignePrecedente.hauteur || largeurCarreau;
		const espaceVide = ligneActuelle.positionY - (lignePrecedente.positionY + hauteurLignePrecedente);

		if (espaceVide > seuilUneLineVide) {
			const nombreLignesVides = Math.floor(
				(espaceVide + largeurCarreau * RATIO_ESPACE_VIDE_CORRECTION) / largeurCarreau,
			);
			coupures.push({
				avantLigneVisuelle: i,
				nombreLignesVides: Math.max(1, nombreLignesVides),
			});
			journaliseur.info(
				"COUPURES",
				`Coupure: ${nombreLignesVides} ligne(s) vide(s) avant ligne visuelle ${i + 1}`,
				{ espaceVide: espaceVide.toFixed(1) + "px" },
			);
		}
	}
	return coupures;
}

/**
 * Retire tous les wrappers `[data-seyes-ligne]` en déplaçant leurs enfants
 * (texte + spans formatage internes) au parent, puis normalise les nœuds
 * texte adjacents. Idempotent.
 *
 * @param {HTMLElement} element
 */
export function nettoyerMarquagePrecedent(element) {
	const wrappers = element.querySelectorAll("[data-seyes-ligne]");
	if (wrappers.length === 0) return;

	wrappers.forEach((wrapper) => {
		const parent = wrapper.parentNode;
		if (!parent) return;
		while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
		parent.removeChild(wrapper);
	});
	if (typeof element.normalize === "function") element.normalize();
	journaliseur.debug("NETTOYAGE", `${wrappers.length} marquages précédents retirés`);
}
