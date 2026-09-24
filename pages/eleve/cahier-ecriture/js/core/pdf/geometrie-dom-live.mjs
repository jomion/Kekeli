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

/**
 * Géométrie DOM live — calcul du nombre de carreaux adaptés au format
 * cahier / interligne, et filtrage des orientations incompatibles.
 *
 * Extrait de dialogue-pdf.mjs (plan refactoring Phase 4).
 *
 * `calculerNombreCarreauxPourGeometrie` est **pure** (aucun DOM).
 * `filtrerOrientationsSelonCahier` est un **DOM-adapter** : mute les
 * `disabled` des options du `<select id="orientation-pdf">`.
 */

import {
	ESPACEMENT_DEUX_PAGES_MM,
	FORMATS_CAHIER,
	FORMATS_PAPIER,
	INTERLIGNE_VALEUR_ECRAN,
} from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";

/**
 * Calcule les dimensions CIBLES d'UNE page individuelle sur papier en mm
 * (marges pré-soustraites), en tenant compte de l'orientation utilisateur
 * ET de `pagesParFeuille` (qui subdivise la feuille en 2 moitiés).
 *
 * En mode Standard + mm, ces dimensions dictent la largeur/hauteur cible
 * pour le calcul de N (carreaux) et lignesParPage au scale naturel, afin
 * que la capture rentre EXACTEMENT dans la demi-feuille (2 pages) ou la
 * feuille entière (1 page) sans déclencher le cap de `calculerPositionnementImage`
 * qui compresserait les carreaux.
 *
 * Règles de subdivision :
 * - 1 page : la cible = feuille finale − marges (pleine largeur × pleine hauteur).
 * - 2 pages orientation portrait : cahiers côte-à-côte sur feuille paysage
 *   → largeur cible = (feuille.largeur − margesH) / 2, hauteur = feuille − margesV.
 * - 2 pages orientation landscape : cahiers empilés sur feuille portrait
 *   → largeur = feuille − margesH, hauteur = (feuille.hauteur − margesV) / 2.
 *
 * @param {{largeur:number, hauteur:number}} papier
 * @param {"portrait"|"landscape"} orientation
 * @param {1|2} pagesParFeuille
 * @param {{haut:number,bas:number,gauche:number,droite:number}} [marges]
 * @returns {{largeurCibleMm:number, hauteurCibleMm:number}}
 */
export function calculerDimensionsCiblePageStandard(papier, orientation, pagesParFeuille, marges) {
	const m = marges || { haut: 0, bas: 0, gauche: 0, droite: 0 };
	const margesH = (m.gauche || 0) + (m.droite || 0);
	const margesV = (m.haut || 0) + (m.bas || 0);

	// Dimensions de la feuille finale après inversions (identique à
	// `calculerDimensionsSortie` dans pagination-options.mjs).
	let feuilleW = papier.largeur;
	let feuilleH = papier.hauteur;
	if (orientation === "landscape") [feuilleW, feuilleH] = [feuilleH, feuilleW];
	if (pagesParFeuille === 2) [feuilleW, feuilleH] = [feuilleH, feuilleW];

	let largeurCibleMm = feuilleW - margesH;
	let hauteurCibleMm = feuilleH - margesV;
	if (pagesParFeuille === 2) {
		if (orientation === "portrait") {
			largeurCibleMm /= 2;
		} else {
			hauteurCibleMm /= 2;
		}
	}
	return { largeurCibleMm, hauteurCibleMm };
}

/**
 * Calcule le nombre de carreaux à appliquer au DOM live selon le format
 * cahier et l'interligne courants. 4 cas :
 *
 * - Cahier + "ecran" : impose `nombreCarreauxOriginal` (réduction).
 *   Fallback formule 2 mm (`floor(cahier.largeurMm / 8)`) si original absent.
 * - Cahier + valeur mm : `floor(cahier.largeurMm / (4 × interligne))`.
 *   Le cahier est placé à sa taille naturelle dans le PDF
 *   (cf `calculerPositionnementImage`), la formule garantit un carreau
 *   imprimé égal à `4 × interligne` mm.
 * - Standard + "ecran" : retourne `nombreCarreauxOriginal` (peut être null
 *   → rien à faire).
 * - Standard + valeur mm :
 *   `floor((largeurPageMm − margesH) / (4 × interligne) − margeSeyesEnCarreaux)`
 *
 *   Le DOM capturé inclut la marge Séyès (bande rouge à gauche, et la
 *   seconde marge si active) en plus du contenu. Quand il est placé dans
 *   le PDF à largeur `papier − marges impression`, la marge Séyès occupe
 *   une part proportionnelle à sa largeur px. Pour que les carreaux du
 *   contenu fassent `4 × interligne` mm réels, on soustrait :
 *   - les marges d'impression horizontales (alignement avec la largeur de
 *     placement — cf `calculerPositionnementImage`),
 *   - l'équivalent en carreaux de la marge Séyès dans le DOM (sinon le
 *     contenu et la marge sont comprimés ensemble, dégradant le carreau).
 *   Dérivation : largeur_carreau_px × placement_mm / (marge_px + N × largeur_carreau_px)
 *   = 4 × interligne → N = placement_mm / (4 × interligne) − marge_px / largeur_carreau_px.
 *
 * @param {Object} options - `{formatCahier, formatPapier, orientation, hauteurInterligne, marges, margeSeyesEnCarreaux?}`
 *   `margeSeyesEnCarreaux` est `largeur_marge_Seyes_px / largeur_carreau_px`
 *   (ratio mesuré sur le DOM live). 0 ou omis si pas de marge Séyès.
 * @param {number|null} nombreCarreauxOriginal
 * @returns {number|null} Nombre de carreaux à écrire dans le DOM, ou null
 *                        si aucune action à prendre.
 */
export function calculerNombreCarreauxPourGeometrie(
	options,
	nombreCarreauxOriginal,
) {
	const interligne = options.hauteurInterligne;
	const cahierKey = options.formatCahier;
	const cahier = cahierKey ? FORMATS_CAHIER[cahierKey] : null;
	const estEcran = interligne === INTERLIGNE_VALEUR_ECRAN;

	if (cahier && estEcran) {
		if (nombreCarreauxOriginal != null) {
			return nombreCarreauxOriginal;
		}
		return Math.max(1, Math.floor(cahier.largeurMm / 8));
	}
	if (cahier) {
		const largeurCarreauMm = 4 * interligne;
		return Math.max(1, Math.floor(cahier.largeurMm / largeurCarreauMm));
	}
	if (estEcran) {
		// Standard + écran : restaurer l'original (ou rien si absent).
		return nombreCarreauxOriginal != null ? nombreCarreauxOriginal : null;
	}
	const formatPapier =
		FORMATS_PAPIER[options.formatPapier] || FORMATS_PAPIER.a4;
	// Largeur cible pour UNE page individuelle (pagesParFeuille=2 portrait
	// divise par 2). `largeurCibleMm` a déjà les marges horizontales soustraites.
	const { largeurCibleMm } = calculerDimensionsCiblePageStandard(
		formatPapier,
		options.orientation,
		options.pagesParFeuille || 1,
		options.marges,
	);
	const largeurPageMM = largeurCibleMm;
	const largeurCarreauMm = 4 * interligne;

	// Formule invariante : `#page.offsetWidth` est constant dans le DOM Seyès
	// (fixé par CSS, ne dépend pas de N). Quand `_changerNombreCarreaux(N)`
	// s'applique, `carreau_source_px` devient `pageWidthPx / N`. Le DOM
	// capturé a une largeur `domTotalPx = pageWidthPx + margeSeyesPx`. Pour
	// que le placement naturel tienne dans `largeurPageMM` avec des carreaux
	// exacts (4 × interligne mm), il faut :
	//   N × largeurCarreauMm × domTotalPx / pageWidthPx ≤ largeurPageMM
	//   ⇒ N ≤ largeurPageMM × pageWidthPx / (largeurCarreauMm × domTotalPx)
	// Cette formule est invariante au timing du reflow DOM après
	// `_changerNombreCarreaux` (qui modifie `carreau_source_px` mais pas
	// `pageWidthPx` ni `margeSeyesPx`).
	const pageWidthPx = options.pageWidthPx || 0;
	const margeSeyesPx = options.margeSeyesPx || 0;
	const domTotalPx = pageWidthPx + margeSeyesPx;
	if (pageWidthPx > 0 && domTotalPx > 0) {
		const nIdeal =
			(largeurPageMM * pageWidthPx) / (largeurCarreauMm * domTotalPx);
		return Math.max(1, Math.floor(nIdeal));
	}

	// Fallback approximatif si l'appelant ne fournit pas les mesures DOM.
	// Ce chemin peut surestimer N d'une unité dans les cas limites (racée).
	const margeSeyesEnCarreaux = options.margeSeyesEnCarreaux || 0;
	const carreauxBruts = largeurPageMM / largeurCarreauMm - margeSeyesEnCarreaux;
	return Math.max(1, Math.floor(carreauxBruts));
}

/**
 * Calcule les dimensions RÉELLES de l'image imprimée à partir des dimensions
 * nominales du cahier et d'un interligne en mm. Fonction pure.
 *
 * Les dimensions nominales `cahier.{largeur,hauteur}Mm` sont des PLAFONDS :
 * l'image est effectivement rendue à son scale naturel (carreau = 4×interligne
 * mm exact) et ses dimensions dépendent du nombre de carreaux et de lignes
 * qui tiennent dans ces plafonds.
 *
 * Respecte l'invariant seyes-pdf-guard n°9 : soustraction de 1.5 carreau
 * avant floor pour absorber la marge jambages (0.5) + l'extension dynamique
 * worst-case (1) ajoutée par `hauteurCaptureDynamique` dans pagination-options.
 *
 * @param {{largeurMm:number, hauteurMm:number}|null} cahier
 * @param {number} interligneMm - valeur mm ou string sentinel (retourne null)
 * @returns {{N:number, lignesParPage:number, largeurImageMm:number, hauteurImageMm:number}|null}
 */
export function calculerDimensionsImageReelle(cahier, interligneMm) {
	if (!cahier || typeof interligneMm !== "number" || !(interligneMm > 0)) {
		return null;
	}
	const largeurCarreauMm = 4 * interligneMm;
	const N = Math.max(1, Math.floor(cahier.largeurMm / largeurCarreauMm));
	const lignesParPage = Math.max(
		1,
		Math.floor(cahier.hauteurMm / largeurCarreauMm - 1.5),
	);
	return {
		N,
		lignesParPage,
		largeurImageMm: N * largeurCarreauMm,
		hauteurImageMm: (lignesParPage + 0.5) * largeurCarreauMm,
	};
}

/**
 * Évalue la compatibilité d'une combinaison (cahier, interligne, papier,
 * orientation, pagesParFeuille, marges) en comparant la dimension RÉELLE
 * de l'image imprimée aux dimensions BRUTES de la feuille.
 *
 * Fonction pure — aucun accès DOM. Le seul critère de compatibilité : image
 * (éventuellement dupliquée en mode 2 pages) ≤ feuille (dimensions brutes,
 * pas de cap 1 cm marges imprimante). Si ok, retourne aussi l'espace
 * disponible par côté et un flag par côté indiquant si la marge utilisateur
 * demandée dépasse cet espace.
 *
 * `espaceDispo` = marges RÉELLEMENT appliquées sur le papier après rendu.
 * Pour 1 page, l'image est centrée et n'est pas influencée par les marges
 * utilisateur → `espaceDispo = (feuille − image) / 2` par côté (identique
 * à l'ancien comportement). Pour 2 pages, `calculerPositionsDeuxPages`
 * centre chaque cahier dans sa demi-région (combinaison de user-marge +
 * espacement/2 + demiLargeur) : la marge qui s'applique sur papier diffère
 * de la marge saisie. `espaceDispo` reflète le **point fixe** (les valeurs
 * user-marges qui, si saisies, produisent elles-mêmes sur papier) afin
 * qu'après auto-bascule, inputs et paper coïncident exactement.
 *
 * Dérivation 2 pages portrait (pages côte-à-côte, feuille devenue paysage) :
 *   left_outer(G, D)  = (W + G − D + e − 2I) / 4  (formule du rendu)
 *   right_outer(G, D) = (W − G + D − e − 2I) / 4
 * Point fixe (left_outer = G et right_outer = D) :
 *   G* = (W + 2e − 2I) / 4
 *   D* = (W − 2e − 2I) / 4
 * Verticalement l'image est centrée → T* = B* = (H − imageH) / 2.
 *
 * @param {Object} params
 * @param {{largeurMm:number,hauteurMm:number}} params.cahier
 * @param {number} params.interligne - mm (valeur sentinel écran → null)
 * @param {{largeur:number,hauteur:number}} params.papier
 * @param {"portrait"|"landscape"} params.orientation
 * @param {1|2} params.pagesParFeuille
 * @param {{haut:number,bas:number,gauche:number,droite:number}} [params.marges]
 * @returns {{
 *   compatible: boolean,
 *   espaceDispo: {haut:number,bas:number,gauche:number,droite:number},
 *   margesDepassees: {haut:boolean,bas:boolean,gauche:boolean,droite:boolean},
 * }}
 */
export function evaluerCompatibilite({
	cahier,
	interligne,
	papier,
	orientation,
	pagesParFeuille,
	marges,
}) {
	const ZERO = { haut: 0, bas: 0, gauche: 0, droite: 0 };
	const TOUT_DEPASSE = { haut: true, bas: true, gauche: true, droite: true };
	const image = calculerDimensionsImageReelle(cahier, interligne);
	if (!image || !papier) {
		return { compatible: false, espaceDispo: { ...ZERO }, margesDepassees: { ...TOUT_DEPASSE } };
	}

	// Dimensions finales de la feuille après inversions orientation + 2pages
	// (même logique que `calculerDimensionsSortie` dans pagination-options.mjs).
	let W = papier.largeur;
	let H = papier.hauteur;
	if (orientation === "landscape") {
		[W, H] = [H, W];
	}
	if (pagesParFeuille === 2) {
		[W, H] = [H, W];
	}

	const I = image.largeurImageMm;
	const Hi = image.hauteurImageMm;
	const e = ESPACEMENT_DEUX_PAGES_MM;

	// Encombrement total pour le test de compatibilité (image tient dans la
	// feuille BRUTE). Cohérent avec calculerPositionsDeuxPages.
	let largeurOccupee = I;
	let hauteurOccupee = Hi;
	if (pagesParFeuille === 2) {
		if (orientation === "portrait") {
			largeurOccupee = 2 * I + e;
		} else {
			hauteurOccupee = 2 * Hi + e;
		}
	}

	const compatible = largeurOccupee <= W && hauteurOccupee <= H;
	if (!compatible) {
		return { compatible: false, espaceDispo: { ...ZERO }, margesDepassees: { ...TOUT_DEPASSE } };
	}

	// Calcul de l'espace disponible = marges réellement appliquées par
	// `calculerPositionsDeuxPages` au point fixe (valeurs stables où
	// user-marges = paper-margin). Se découple en 3 cas selon
	// (pagesParFeuille, orientation).
	let espaceDispo;
	if (pagesParFeuille === 1) {
		// Image centrée, indépendante des marges user.
		const hCentre = (W - I) / 2;
		const vCentre = (H - Hi) / 2;
		espaceDispo = { haut: vCentre, bas: vCentre, gauche: hCentre, droite: hCentre };
	} else if (orientation === "portrait") {
		// 2 pages côte-à-côte. Point fixe horizontal asymétrique (±e/2),
		// centré vertical.
		espaceDispo = {
			gauche: (W + 2 * e - 2 * I) / 4,
			droite: (W - 2 * e - 2 * I) / 4,
			haut: (H - Hi) / 2,
			bas: (H - Hi) / 2,
		};
	} else {
		// 2 pages empilées (landscape). Point fixe vertical asymétrique,
		// centré horizontal.
		espaceDispo = {
			gauche: (W - I) / 2,
			droite: (W - I) / 2,
			haut: (H + 2 * e - 2 * Hi) / 4,
			bas: (H - 2 * e - 2 * Hi) / 4,
		};
	}

	const margesEffectives = marges || ZERO;
	const margesDepassees = {
		haut: margesEffectives.haut > espaceDispo.haut,
		bas: margesEffectives.bas > espaceDispo.bas,
		gauche: margesEffectives.gauche > espaceDispo.gauche,
		droite: margesEffectives.droite > espaceDispo.droite,
	};

	return { compatible: true, espaceDispo, margesDepassees };
}

/**
 * Résout la valeur d'interligne à utiliser pour les calculs de compat.
 * Mode "écran" (valeur sentinel string) → fallback à 2 mm (Seyès standard).
 *
 * @param {number|string} interligne
 * @returns {number}
 */
function _resoudreInterligne(interligne) {
	if (typeof interligne === "number") return interligne;
	return 2;
}

/**
 * Bascule la valeur d'un select vers la première option non-disabled, si
 * l'option courante est disabled. DOM-adapter.
 *
 * @param {HTMLSelectElement} select
 * @returns {string|null} Nouvelle valeur si bascule, sinon null.
 */
function _basculerSiIncompatible(select) {
	const courante = select.options[select.selectedIndex];
	if (!courante || !courante.disabled) return null;
	const premiereValide = Array.from(select.options).find((o) => !o.disabled);
	if (!premiereValide) return null;
	select.value = premiereValide.value;
	return premiereValide.value;
}

/**
 * Filtre les options du `<select id="orientation-pdf">` selon la
 * compatibilité dynamique (cahier × papier × pagesParFeuille × interligne).
 *
 * @param {Object} options - `{formatCahier, hauteurInterligne, pagesParFeuille, marges}`
 * @returns {string|null} Nouvelle orientation si bascule, sinon null.
 */
export function filtrerOrientationsSelonCahier(options) {
	const formatCahier = options.formatCahier;
	const orientationSelect = document.getElementById("orientation-pdf");
	const formatPapierSelect = document.getElementById("format-papier-pdf");
	if (!orientationSelect) return null;

	// Mode standard (hors cahier) : toutes les orientations disponibles.
	if (!formatCahier || !FORMATS_CAHIER[formatCahier] || !formatPapierSelect) {
		Array.from(orientationSelect.options).forEach((opt) => (opt.disabled = false));
		return null;
	}

	const cahier = FORMATS_CAHIER[formatCahier];
	const papier = FORMATS_PAPIER[formatPapierSelect.value];
	if (!cahier || !papier) return null;

	const interligne = _resoudreInterligne(options.hauteurInterligne);
	const pagesParFeuille = options.pagesParFeuille || 1;

	Array.from(orientationSelect.options).forEach((opt) => {
		const res = evaluerCompatibilite({
			cahier,
			interligne,
			papier,
			orientation: opt.value,
			pagesParFeuille,
		});
		opt.disabled = !res.compatible;
	});

	const nouvelle = _basculerSiIncompatible(orientationSelect);
	if (nouvelle) {
		journaliseur.info(
			"ORIENTATION",
			`Bascule auto vers ${nouvelle} : cahier ${formatCahier} ne rentre pas en ${orientationSelect.dataset.ancienneValeur || "?"} sur ${formatPapierSelect.value}`,
		);
	}
	return nouvelle;
}

/**
 * Filtre les options du `<select id="format-papier-pdf">` selon la
 * compatibilité dynamique avec le cahier courant (× orientation ×
 * pagesParFeuille × interligne).
 *
 * @param {Object} options - `{formatCahier, orientation, hauteurInterligne, pagesParFeuille}`
 * @returns {string|null} Nouveau format papier si bascule, sinon null.
 */
export function filtrerFormatPapierSelonCahier(options) {
	const formatCahier = options.formatCahier;
	const formatPapierSelect = document.getElementById("format-papier-pdf");
	if (!formatPapierSelect) return null;

	// Mode standard : tous les papiers disponibles.
	if (!formatCahier || !FORMATS_CAHIER[formatCahier]) {
		Array.from(formatPapierSelect.options).forEach((opt) => (opt.disabled = false));
		return null;
	}

	const cahier = FORMATS_CAHIER[formatCahier];
	const interligne = _resoudreInterligne(options.hauteurInterligne);
	const orientation = options.orientation || "portrait";
	const pagesParFeuille = options.pagesParFeuille || 1;

	Array.from(formatPapierSelect.options).forEach((opt) => {
		const papier = FORMATS_PAPIER[opt.value];
		if (!papier) {
			opt.disabled = true;
			return;
		}
		const res = evaluerCompatibilite({
			cahier,
			interligne,
			papier,
			orientation,
			pagesParFeuille,
		});
		opt.disabled = !res.compatible;
	});

	const nouveau = _basculerSiIncompatible(formatPapierSelect);
	if (nouveau) {
		journaliseur.info(
			"FORMAT_PAPIER",
			`Bascule auto vers ${nouveau} : cahier ${formatCahier} ne rentre pas sur le format papier précédemment sélectionné (${orientation}, ${pagesParFeuille} page${pagesParFeuille > 1 ? "s" : ""})`,
		);
	}
	return nouveau;
}

/**
 * Filtre les options du `<select id="pages-feuille-pdf">` (1 ou 2 pages)
 * selon la compatibilité dynamique avec le cahier courant.
 *
 * @param {Object} options - `{formatCahier, formatPapier, orientation, hauteurInterligne}`
 * @returns {string|null} Nouvelle valeur si bascule (vers "1"), sinon null.
 */
export function filtrerPagesParFeuilleSelonCahier(options) {
	const formatCahier = options.formatCahier;
	const pagesFeuilleSelect = document.getElementById("pages-feuille-pdf");
	if (!pagesFeuilleSelect) return null;

	// Mode standard : 2 pages toujours disponible.
	if (!formatCahier || !FORMATS_CAHIER[formatCahier]) {
		Array.from(pagesFeuilleSelect.options).forEach((opt) => (opt.disabled = false));
		return null;
	}

	const cahier = FORMATS_CAHIER[formatCahier];
	const papier = FORMATS_PAPIER[options.formatPapier];
	if (!cahier || !papier) return null;

	const interligne = _resoudreInterligne(options.hauteurInterligne);
	const orientation = options.orientation || "portrait";

	Array.from(pagesFeuilleSelect.options).forEach((opt) => {
		const pagesParFeuille = parseInt(opt.value, 10);
		const res = evaluerCompatibilite({
			cahier,
			interligne,
			papier,
			orientation,
			pagesParFeuille,
		});
		opt.disabled = !res.compatible;
	});

	const nouveau = _basculerSiIncompatible(pagesFeuilleSelect);
	if (nouveau) {
		journaliseur.info(
			"PAGES_FEUILLE",
			`Bascule auto vers ${nouveau} page${nouveau > "1" ? "s" : ""} : cahier ${formatCahier} ne tient pas en 2 pages sur ${options.formatPapier} ${orientation}`,
		);
	}
	return nouveau;
}
