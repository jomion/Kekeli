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
 * Calculs de pagination et de positionnement pour l'export PDF.
 *
 * Fonctions pures extraites de dialogue-pdf.mjs (plan refactoring Phase 2).
 * Aucun état mutable, aucun accès DOM direct : toutes les valeurs DOM sont
 * passées en paramètres (largeurContenu, configSeyes) pour que les fonctions
 * restent testables sans setup DOM.
 *
 * Invariant seyes-pdf-guard #5 (stride clone ↔ DOM live) : `calculerZoneCapture`
 * applique `facteurCorrectionStride = largeurCarreauEcranPx /
 * configSeyes.largeur_carreau` aux positions Y mesurées dans le DOM live, pour
 * les exprimer dans la stride normalisée du clone. Ne pas retirer ce facteur.
 */

import {
	ESPACEMENT_DEUX_PAGES_MM,
	FORMATS_CAHIER,
	FORMATS_PAPIER,
	INTERLIGNE_VALEUR_ECRAN,
	POURCENTAGE_DECALAGE_CAPTURE_SEYES,
} from "./constantes.mjs";
import { calculerDimensionsCiblePageStandard } from "./geometrie-dom-live.mjs";
import { journaliseur } from "./journaliseur.mjs";

/**
 * Retourne la ligne visuelle correspondant exactement à `indexSeyes`.
 * Si la ligne Seyès est vide (absente du mapping), `existe` vaut false.
 *
 * @param {number} indexSeyes
 * @param {Array<{ligneSeyes:number, indexVisuel:number, positionY:number}>} mappageLignes
 * @returns {{existe:boolean, indexVisuel:number, positionY:number|null}}
 */
export function seyesVersVisuelleExact(indexSeyes, mappageLignes) {
	const ligne = mappageLignes.find((l) => l.ligneSeyes === indexSeyes);
	if (ligne) {
		return { existe: true, indexVisuel: ligne.indexVisuel, positionY: ligne.positionY };
	}
	return { existe: false, indexVisuel: -1, positionY: null };
}

/**
 * Retourne la première ligne visuelle dont `ligneSeyes >= indexSeyes`
 * (saute les lignes vides entre paragraphes).
 *
 * @param {number} indexSeyes
 * @param {Array} mappageLignes
 * @returns {{existe:boolean, indexVisuel:number, positionY:number|null, ligneSeyes:number}}
 */
export function seyesVersVisuellePlusProche(indexSeyes, mappageLignes) {
	const ligne = mappageLignes.find((l) => l.ligneSeyes >= indexSeyes);
	if (ligne) {
		return {
			existe: true,
			indexVisuel: ligne.indexVisuel,
			positionY: ligne.positionY,
			ligneSeyes: ligne.ligneSeyes,
		};
	}
	return { existe: false, indexVisuel: -1, positionY: null, ligneSeyes: -1 };
}

/**
 * Retourne les dimensions de sortie finales en mm, selon format papier,
 * orientation et 2-pages-par-feuille (qui inverse l'orientation une
 * deuxième fois).
 *
 * @param {Object} options - `{formatPapier, orientation, pagesParFeuille}`
 * @returns {{largeur:number, hauteur:number}}
 */
export function calculerDimensionsSortie(options) {
	const format = FORMATS_PAPIER[options.formatPapier] || FORMATS_PAPIER.a4;
	let largeur = format.largeur;
	let hauteur = format.hauteur;

	if (options.orientation === "landscape") {
		[largeur, hauteur] = [hauteur, largeur];
	}
	if (options.pagesParFeuille === 2) {
		[largeur, hauteur] = [hauteur, largeur];
	}
	return { largeur, hauteur };
}

/**
 * Calcule la largeur naturelle d'une image capturée en mm pour qu'elle
 * s'imprime au scale 1:1 — chaque carreau source de `carreau_source_px`
 * pixels rend exactement `4 × interligne` mm dans le PDF.
 *
 * Prend la largeur SOURCE en DOM px (pas `canvas.width`) : SnapDOM applique
 * son propre `devicePixelRatio` en plus du scale, donc `canvas.width /
 * scale` n'est pas égal aux DOM px capturés. L'appelant doit fournir
 * `sourceWidthPx` qui est la valeur passée à SnapDOM comme option `width`.
 *
 * Retourne null si mode "ecran" (pas de cible mm → l'appelant gardera le
 * chemin stretch-to-fill) ou si `carreau_source_px` est invalide.
 *
 * @param {number} sourceWidthPx - Largeur DOM capturée en px (pas canvas.width)
 * @param {Object} options - `{hauteurInterligne}` (numeric en mm ou "ecran")
 * @param {{largeur_carreau:number}} configSeyes
 * @returns {number|null}
 */
export function calculerLargeurNaturelleMm(sourceWidthPx, options, configSeyes) {
	if (typeof options.hauteurInterligne !== "number") return null;
	if (!configSeyes || !(configSeyes.largeur_carreau > 0)) return null;
	if (!(sourceWidthPx > 0)) return null;
	const carreauTargetMm = 4 * options.hauteurInterligne;
	return sourceWidthPx * carreauTargetMm / configSeyes.largeur_carreau;
}

/**
 * Positionne une image capturée sur une page PDF.
 *
 * - Mode précision (`options.largeurNaturelleMm` fourni et > 0) :
 *   largeur = largeurNaturelleMm, hauteur = largeurNaturelleMm × ratio image.
 *   Cap graceful à la zone disponible (cahier.largeurMm ou papier − marges)
 *   pour ne jamais déborder. Produit un blanc centré si la naturelle est
 *   plus petite que la zone disponible — c'est voulu (carreau exact).
 * - Mode cahier fit-contain (`options.preserveRatioCahier` ET cahier sans
 *   largeurNaturelleMm) : maximise l'occupation du cahier en préservant le
 *   ratio d'aspect du composite source (carreaux carrés). L'axe le plus
 *   contraint atteint la dimension cahier complète, l'autre laisse une marge.
 *   Activé pour cahier_de_textes en mode ecran (fix Invariant 13).
 * - Mode cahier legacy (sans largeurNaturelleMm ni preserveRatioCahier) :
 *   dimensions exactes du cahier (stretch si ratio image diffère).
 * - Mode standard legacy (sans largeurNaturelleMm) : largeur = page − marges,
 *   hauteur ajustée au ratio, réduction si le ratio déborde.
 *
 * Toujours centré sur la page.
 *
 * @param {Object} options - `{formatCahier, largeurNaturelleMm?, preserveRatioCahier?}`
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {{haut:number, bas:number, gauche:number, droite:number}} marges
 * @returns {{x:number, y:number, width:number, height:number}}
 */
export function calculerPositionnementImage(options, imgWidth, imgHeight, pageWidth, pageHeight, marges) {
	let largeurImg;
	let hauteurImg;

	const cahier = options.formatCahier && FORMATS_CAHIER[options.formatCahier]
		? FORMATS_CAHIER[options.formatCahier]
		: null;
	const largeurNaturelleMm = typeof options.largeurNaturelleMm === "number" && options.largeurNaturelleMm > 0
		? options.largeurNaturelleMm
		: null;

	if (largeurNaturelleMm) {
		// Mode précision : placer à la largeur naturelle (aspect ratio image).
		const ratioImage = imgHeight / imgWidth;
		const largeurMax = cahier
			? cahier.largeurMm
			: pageWidth - marges.gauche - marges.droite;
		const hauteurMax = cahier
			? cahier.hauteurMm
			: pageHeight - marges.haut - marges.bas;
		largeurImg = Math.min(largeurNaturelleMm, largeurMax);
		hauteurImg = largeurImg * ratioImage;
		if (hauteurImg > hauteurMax) {
			hauteurImg = hauteurMax;
			largeurImg = hauteurImg / ratioImage;
		}
	} else if (cahier && options.preserveRatioCahier) {
		// Mode cahier fit-contain : maximise l'occupation du cahier en
		// préservant le ratio d'aspect du composite source (= carreaux carrés).
		// L'axe le plus contraint atteint la dimension cahier complète,
		// l'autre laisse une marge centrée. Utilisé en cahier_de_textes mode
		// ecran : sans cette branche, le legacy stretch déformerait les
		// carreaux et donc les cursives.
		const ratioImage = imgHeight / imgWidth;
		const ratioCahier = cahier.hauteurMm / cahier.largeurMm;
		if (ratioImage > ratioCahier) {
			// Composite plus haut (relativement) que cahier → cap par hauteur,
			// laisse marge horizontale.
			hauteurImg = cahier.hauteurMm;
			largeurImg = hauteurImg / ratioImage;
		} else {
			// Composite plus large (relativement) que cahier → cap par largeur,
			// laisse marge verticale.
			largeurImg = cahier.largeurMm;
			hauteurImg = largeurImg * ratioImage;
		}
	} else if (cahier) {
		largeurImg = cahier.largeurMm;
		hauteurImg = cahier.hauteurMm;
	} else {
		const ratioImage = imgHeight / imgWidth;
		const largeurDispo = pageWidth - marges.gauche - marges.droite;
		const hauteurDispo = pageHeight - marges.haut - marges.bas;

		largeurImg = largeurDispo;
		hauteurImg = largeurImg * ratioImage;

		if (hauteurImg > hauteurDispo) {
			hauteurImg = hauteurDispo;
			largeurImg = hauteurImg / ratioImage;
		}
	}

	const x = (pageWidth - largeurImg) / 2;
	const y = (pageHeight - hauteurImg) / 2;
	return { x, y, width: largeurImg, height: hauteurImg };
}

/**
 * Positionne deux pages côte-à-côte (portrait → paysage) ou empilées
 * (paysage → portrait) sur une feuille 2-pages-par-feuille.
 *
 * @param {Object} options - `{orientation, marges, formatCahier}`
 * @param {HTMLCanvasElement|null} canvas1
 * @param {HTMLCanvasElement|null} canvas2
 * @param {{largeur:number, hauteur:number}} dimensions
 * @returns {{largeurFeuille:number, hauteurFeuille:number, pos1, pos2}}
 */
export function calculerPositionsDeuxPages(options, canvas1, canvas2, dimensions) {
	const isPortrait = options.orientation === "portrait";
	const largeurFeuille = dimensions.largeur;
	const hauteurFeuille = dimensions.hauteur;
	const espacement = ESPACEMENT_DEUX_PAGES_MM;
	const marges = options.marges;

	let pos1;
	let pos2;

	if (isPortrait) {
		const demiLargeur = (largeurFeuille - marges.gauche - marges.droite) / 2;
		const margesGauche = { haut: marges.haut, bas: marges.bas, gauche: marges.gauche, droite: espacement / 2 };
		const margesDroite = { haut: marges.haut, bas: marges.bas, gauche: espacement / 2, droite: marges.droite };

		pos1 = canvas1
			? calculerPositionnementImage(
				options,
				canvas1.width,
				canvas1.height,
				demiLargeur + marges.gauche + espacement / 2,
				hauteurFeuille,
				margesGauche,
			)
			: null;

		if (canvas2) {
			const posBrute = calculerPositionnementImage(
				options,
				canvas2.width,
				canvas2.height,
				demiLargeur + marges.droite + espacement / 2,
				hauteurFeuille,
				margesDroite,
			);
			const offsetX = marges.gauche + demiLargeur;
			pos2 = { x: offsetX + posBrute.x, y: posBrute.y, width: posBrute.width, height: posBrute.height };
		} else {
			pos2 = null;
		}
	} else {
		const demiHauteur = (hauteurFeuille - marges.haut - marges.bas) / 2;
		const margesHaut = { haut: marges.haut, bas: espacement / 2, gauche: marges.gauche, droite: marges.droite };
		const margesBas = { haut: espacement / 2, bas: marges.bas, gauche: marges.gauche, droite: marges.droite };

		pos1 = canvas1
			? calculerPositionnementImage(
				options,
				canvas1.width,
				canvas1.height,
				largeurFeuille,
				demiHauteur + marges.haut + espacement / 2,
				margesHaut,
			)
			: null;

		if (canvas2) {
			const posBrute = calculerPositionnementImage(
				options,
				canvas2.width,
				canvas2.height,
				largeurFeuille,
				demiHauteur + marges.bas + espacement / 2,
				margesBas,
			);
			const offsetY = marges.haut + demiHauteur;
			pos2 = { x: posBrute.x, y: offsetY + posBrute.y, width: posBrute.width, height: posBrute.height };
		} else {
			pos2 = null;
		}
	}

	return { largeurFeuille, hauteurFeuille, pos1, pos2 };
}

/**
 * Calcule la configuration de pagination (taille de page, nombre de
 * lignes, stride carreau…) à partir des options et de la config Seyès
 * live.
 *
 * @param {Object} options - `{formatCahier, formatPapier, orientation, marges, hauteurInterligne}`
 * @param {number|null} nombreCarreauxOriginal - Nombre de carreaux écran avant modale (mode "ecran" cahier).
 * @param {{nombreDeCarreaux:number, largeur_carreau:number, largeur_marge:number}} configSeyes
 * @param {number} largeurContenu - Largeur de #conteneur-extensible en px.
 * @returns {Object} Configuration pagination.
 */
export function calculerPaginationAvecOptions(options, nombreCarreauxOriginal, configSeyes, largeurContenu) {
	const nombreCarreaux = configSeyes.nombreDeCarreaux;
	const largeurCarreauEcran = Math.floor(configSeyes.largeur_carreau);
	const largeurMargeRouge = configSeyes.largeur_marge;

	const cahier = options.formatCahier ? FORMATS_CAHIER[options.formatCahier] : null;

	let largeurPageMM;
	let hauteurPageMM;

	if (cahier) {
		largeurPageMM = cahier.largeurMm;
		hauteurPageMM = cahier.hauteurMm;
	} else {
		const format = FORMATS_PAPIER[options.formatPapier];
		largeurPageMM = format.largeur;
		hauteurPageMM = format.hauteur;

		if (options.orientation === "landscape") {
			[largeurPageMM, hauteurPageMM] = [hauteurPageMM, largeurPageMM];
		}
	}

	const margeHaut = options.marges.haut;
	const margeBas = options.marges.bas;
	const margeGauche = options.marges.gauche;
	const margeDroite = options.marges.droite;

	const ratioPixelVersMm = largeurPageMM / (largeurMargeRouge + largeurCarreauEcran * nombreCarreaux);
	const largeurMargeRougeMm = largeurMargeRouge * ratioPixelVersMm;

	const largeurImpressionMm = largeurPageMM - margeGauche - margeDroite;
	const largeurDisponibleCarreaux = largeurImpressionMm - largeurMargeRougeMm;
	const carreauImpressionMm = largeurDisponibleCarreaux / nombreCarreaux;

	const ratioPxToMm = largeurContenu / largeurImpressionMm;
	const ratioFormat = hauteurPageMM / largeurPageMM;
	const hauteurCanvasRatioFidelePx = largeurContenu * ratioFormat;

	let lignesParPage;
	let hauteurCaptureBaseeNombreLignes;
	const margeJambagesPx = largeurCarreauEcran * 0.5;

	if (cahier !== null) {
		const interligne = options.hauteurInterligne;
		let largeurCarreauMm;
		let interligneMm;
		if (interligne === INTERLIGNE_VALEUR_ECRAN && nombreCarreauxOriginal) {
			largeurCarreauMm = cahier.largeurMm / nombreCarreauxOriginal;
			interligneMm = largeurCarreauMm / 4;
		} else {
			interligneMm = interligne === INTERLIGNE_VALEUR_ECRAN ? 2 : interligne;
			largeurCarreauMm = 4 * interligneMm;
		}
		// Soustraire 1.5 carreau pour absorber la marge jambages (0.5) +
		// l'extension dynamique worst-case (1 carreau) ajoutée par
		// `hauteurCaptureDynamique` ligne 601. Sans cette soustraction,
		// la hauteur capture à scale naturel dépasse hauteurMax et force
		// un cap qui compresse les carreaux.
		lignesParPage = Math.max(1, Math.floor(cahier.hauteurMm / largeurCarreauMm - 1.5));
		hauteurCaptureBaseeNombreLignes = lignesParPage * largeurCarreauEcran + margeJambagesPx;

		journaliseur.info("PAGINATION", "=== PAGINATION CAHIER (lignes dérivées interligne) ===", {
			cahier: options.formatCahier,
			interligne,
			interligneMm,
			largeurCarreauMm,
			lignesParPage,
			carreauEcranPx: largeurCarreauEcran,
			hauteurCapturePx: hauteurCaptureBaseeNombreLignes.toFixed(1),
			ratioCahierMm: (cahier.hauteurMm / cahier.largeurMm).toFixed(4),
		});
	} else {
		// Standard+mm : baser lignesParPage sur la hauteur naturelle mm cible
		// (4 × interligne par carreau), pour garantir que les carreaux imprimés
		// fassent exactement 4×interligne mm sans clipping en bas de page.
		// On soustrait 1.5 carreau pour absorber la marge jambages (0.5) et
		// l'extension dynamique worst-case (1 carreau) ajoutée par
		// `hauteurCaptureDynamique` ligne 601, sinon le cap hauteur se
		// déclenche dans `calculerPositionnementImage` et compresse les carreaux.
		//
		// Hauteur cible = hauteur utilisable d'UNE page individuelle après
		// inversions. En pagesParFeuille=2 landscape, les pages sont empilées
		// verticalement sur feuille portrait → demi-hauteur. `calculerDimensions-
		// CiblePageStandard` gère cette subdivision (et le cas par défaut 1 page
		// ou 2 pages portrait → pleine hauteur).
		//
		// Standard+ecran : garder la logique basée sur le canvas (pas de cible mm).
		const interligne = options.hauteurInterligne;
		if (typeof interligne === "number") {
			const carreauMmCible = 4 * interligne;
			const { hauteurCibleMm } = calculerDimensionsCiblePageStandard(
				FORMATS_PAPIER[options.formatPapier] || FORMATS_PAPIER.a4,
				options.orientation,
				options.pagesParFeuille || 1,
				options.marges,
			);
			lignesParPage = Math.max(1, Math.floor(hauteurCibleMm / carreauMmCible - 1.5));
		} else {
			lignesParPage = Math.floor((hauteurCanvasRatioFidelePx - margeJambagesPx) / largeurCarreauEcran);
		}
		hauteurCaptureBaseeNombreLignes = lignesParPage * largeurCarreauEcran + margeJambagesPx;
	}

	// Note : pour `cahier_de_textes`, le module `cahier-de-textes-pdf.mjs`
	// applique en aval `ajusterPagination(configBase)` qui soustrait
	// `HAUTEUR_HEADER_CARREAUX` à `lignesParPage` et recalcule la hauteur
	// de capture. Cette fonction reste générique.

	const hauteurDisponibleMm = hauteurPageMM - margeHaut - margeBas;

	journaliseur.debug("PAGINATION", "=== DIAGNOSTIC PAGINATION ===");
	journaliseur.debug("PAGINATION", `Configuration: ${nombreCarreaux} carreaux, carreau=${largeurCarreauEcran}px`);
	journaliseur.debug("PAGINATION", `Format: ${options.formatPapier} ${options.orientation} (${largeurPageMM}×${hauteurPageMM}mm)`);
	journaliseur.debug("PAGINATION", `Ratio format: ${ratioFormat.toFixed(4)}`);
	journaliseur.debug("PAGINATION", `largeurContenu: ${largeurContenu}px`);
	journaliseur.debug("PAGINATION", `hauteurCanvasRatioFidelePx: ${hauteurCanvasRatioFidelePx.toFixed(2)}px`);
	journaliseur.debug("PAGINATION", `lignesParPage=${lignesParPage}`);
	journaliseur.debug("PAGINATION", `hauteurCaptureBaseeNombreLignes: ${hauteurCaptureBaseeNombreLignes.toFixed(2)}px`);

	return {
		carreauMm: carreauImpressionMm,
		lignesParPage,
		hauteurPageMm: hauteurDisponibleMm,
		hauteurCanvasOptimalePx: hauteurCanvasRatioFidelePx,
		ratioPxToMm,
		largeurCarreauEcranPx: largeurCarreauEcran,
		hauteurCaptureBaseeNombreLignes,
		hauteurCanvasRatioFormat: hauteurCanvasRatioFidelePx,
		largeurPageMM,
		hauteurPageMM,
		estModeCahier: cahier !== null,
	};
}

/**
 * Mappe les lignes Seyès vers les pages physiques.
 *
 * @param {Object} options - non utilisé (réservé pour évolutions). Accepté pour uniformité de signature.
 * @param {{mappageLignes:Array, lignesVisuelles:Array}} analyseComplete
 * @param {Object} configPagination
 * @returns {Array<Object>} Pages `[{numeroPage, premiereLigneSeyes, derniereLigneSeyes, nombreLignes, estDernierePage}]`
 */
export function mapperLignesVersPagesAvecOptions(options, analyseComplete, configPagination) {
	const { mappageLignes, lignesVisuelles } = analyseComplete;
	const { hauteurCaptureBaseeNombreLignes, largeurCarreauEcranPx, estModeCahier, lignesParPage } = configPagination;

	const hauteurPagePx = hauteurCaptureBaseeNombreLignes;
	const offsetSuperieurPx = largeurCarreauEcranPx * POURCENTAGE_DECALAGE_CAPTURE_SEYES;

	if (mappageLignes.length === 0) {
		return [{
			numeroPage: 1,
			premiereLigneSeyes: 1,
			derniereLigneSeyes: 1,
			nombreLignes: 1,
			estDernierePage: true,
		}];
	}

	const pages = [];

	if (estModeCahier) {
		const totalLignesSeyes = Math.max(...mappageLignes.map((l) => l.ligneSeyes));
		let debut = 1;
		while (debut <= totalLignesSeyes) {
			const fin = Math.min(debut + lignesParPage - 1, totalLignesSeyes);
			const lignesDePage = mappageLignes.filter((l) => l.ligneSeyes >= debut && l.ligneSeyes <= fin);

			if (lignesDePage.length > 0) {
				pages.push({
					numeroPage: pages.length + 1,
					premiereLigneSeyes: debut,
					derniereLigneSeyes: fin,
					nombreLignes: lignesDePage.length,
					estDernierePage: fin >= totalLignesSeyes,
				});
			}
			debut = fin + 1;
		}

		if (pages.length > 0) {
			pages.forEach((p, i) => {
				p.estDernierePage = i === pages.length - 1;
			});
		}
	} else {
		const lignesTriees = [...mappageLignes].sort((a, b) => {
			const posA = (lignesVisuelles[a.indexVisuel] && lignesVisuelles[a.indexVisuel].positionY) || 0;
			const posB = (lignesVisuelles[b.indexVisuel] && lignesVisuelles[b.indexVisuel].positionY) || 0;
			return posA - posB;
		});

		let indexLigne = 0;
		while (indexLigne < lignesTriees.length) {
			const premiereLigne = lignesTriees[indexLigne];
			const positionDebutPage = (lignesVisuelles[premiereLigne.indexVisuel] && lignesVisuelles[premiereLigne.indexVisuel].positionY) || 0;
			const ajustementBas = largeurCarreauEcranPx * 0.25;
			const finZoneCapture = positionDebutPage - offsetSuperieurPx + hauteurPagePx + ajustementBas;

			let dernierIndexPage = indexLigne;
			while (dernierIndexPage < lignesTriees.length) {
				const ligneCourante = lignesTriees[dernierIndexPage];
				const positionLigne = (lignesVisuelles[ligneCourante.indexVisuel] && lignesVisuelles[ligneCourante.indexVisuel].positionY) || 0;
				if (positionLigne <= finZoneCapture) {
					dernierIndexPage++;
				} else {
					break;
				}
			}

			const lignesDePage = lignesTriees.slice(indexLigne, dernierIndexPage);
			const premiereLigneSeyes = Math.min(...lignesDePage.map((l) => l.ligneSeyes));
			const derniereLigneSeyes = Math.max(...lignesDePage.map((l) => l.ligneSeyes));

			pages.push({
				numeroPage: pages.length + 1,
				premiereLigneSeyes,
				derniereLigneSeyes,
				nombreLignes: lignesDePage.length,
				estDernierePage: dernierIndexPage >= lignesTriees.length,
			});

			indexLigne = dernierIndexPage;
		}
	}

	journaliseur.debug("PAGINATION", `=== MAPPING ${pages.length} PAGES (basé sur positions Y, hauteurPage=${hauteurPagePx.toFixed(0)}px) ===`);
	pages.forEach((p) => {
		journaliseur.debug("PAGINATION", `Page ${p.numeroPage}: lignes Seyès ${p.premiereLigneSeyes}-${p.derniereLigneSeyes} (${p.nombreLignes} lignes visuelles)${p.estDernierePage ? " [DERNIÈRE]" : ""}`);
	});
	return pages;
}

/**
 * Liste les lignes à masquer pour éviter la coupure cursive entre pages.
 *
 * Règle 1 : 1re ligne des pages ≥ 2 → masquer la ligne précédente
 * (descendantes qui tombent sur la ligne courante).
 * Règle 2 : sauf sur la dernière page → masquer toutes les lignes visuelles
 * de la page suivante dont le sommet tombe dans la zone de capture (ascendantes).
 *
 * @param {Object} options - non utilisé (réservé). Accepté pour uniformité.
 * @param {number} indexPage
 * @param {{premiereLigneSeyes:number, derniereLigneSeyes:number, estDernierePage:boolean, numeroPage:number}} infosPage
 * @param {{mappageLignes:Array}} analyseComplete
 * @returns {Array<{indexSeyes:number, indexVisuel:number, type:"precedente"|"suivante"}>}
 */
export function calculerLignesAMasquerPourPage(options, indexPage, infosPage, analyseComplete) {
	const lignesAMasquer = [];
	const { mappageLignes } = analyseComplete;

	journaliseur.debug("MASQUAGE", `=== Page ${infosPage.numeroPage} (index ${indexPage}) ===`);
	journaliseur.debug("MASQUAGE", `Lignes Seyès: ${infosPage.premiereLigneSeyes} à ${infosPage.derniereLigneSeyes}, estDernierePage=${infosPage.estDernierePage}`);

	if (indexPage > 0 && infosPage.premiereLigneSeyes > 1) {
		const ligneSeyesAMasquer = infosPage.premiereLigneSeyes - 1;
		const ligneVisuelle = seyesVersVisuelleExact(ligneSeyesAMasquer, mappageLignes);

		journaliseur.debug("MASQUAGE", `Règle 1 (descendantes): cherche ligneSeyes=${ligneSeyesAMasquer}, trouvée=${ligneVisuelle.existe}, indexVisuel=${ligneVisuelle.indexVisuel}`);

		if (ligneVisuelle.existe) {
			const ligneTrouvee = mappageLignes.find((l) => l.indexVisuel === ligneVisuelle.indexVisuel);
			if (ligneTrouvee) {
				journaliseur.debug("MASQUAGE", `  → Ligne trouvée a ligneSeyes=${ligneTrouvee.ligneSeyes} (demandé: ${ligneSeyesAMasquer})`);
			}
			lignesAMasquer.push({
				indexSeyes: ligneSeyesAMasquer,
				indexVisuel: ligneVisuelle.indexVisuel,
				type: "precedente",
			});
		}
	}

	if (!infosPage.estDernierePage) {
		const ligneSeyesFrontiere = infosPage.derniereLigneSeyes;
		const lignesSuivantes = mappageLignes.filter((l) => l.ligneSeyes > ligneSeyesFrontiere);

		journaliseur.debug(
			"MASQUAGE",
			`Règle 2 (ascendantes) : masquage de ${lignesSuivantes.length} lignes visuelles appartenant aux pages suivantes (ligneSeyes>${ligneSeyesFrontiere})`,
		);

		lignesSuivantes.forEach((ligne) => {
			lignesAMasquer.push({
				indexSeyes: ligne.ligneSeyes,
				indexVisuel: ligne.indexVisuel,
				type: "suivante",
			});
		});
	}

	journaliseur.debug("MASQUAGE", `Lignes à masquer pour page ${infosPage.numeroPage}: ${JSON.stringify(lignesAMasquer)}`);
	return lignesAMasquer;
}

/**
 * Calcule la zone de capture SnapDOM pour une page donnée.
 *
 * Applique le **facteur de correction stride** (Invariant seyes-pdf-guard #5) :
 * les positions Y lues dans le DOM live sont en stride flottante ; le clone est
 * en stride Math.floor. Sans correction, l'erreur s'accumule de ~6 px/page.
 *
 * @param {Object} options - `{formatCahier}`
 * @param {{premiereLigneSeyes:number, derniereLigneSeyes:number, estDernierePage:boolean, numeroPage:number}} infosPage
 * @param {{mappageLignes:Array, lignesVisuelles:Array}} analyseComplete
 * @param {Object} configPagination
 * @param {{largeur_carreau:number, largeur_marge:number}} configSeyes - Config live pour facteurCorrectionStride.
 * @param {number} largeurContenu - Largeur #conteneur-extensible px.
 * @returns {{largeur:number, hauteur:number, decalageY:number, decalageX:number, positionScroll:number, estDernierePage:boolean, hauteurDynamique:number, estModeCahier:boolean}}
 */
export function calculerZoneCaptureAvecOptions(options, infosPage, analyseComplete, configPagination, configSeyes, largeurContenu) {
	const { mappageLignes, lignesVisuelles } = analyseComplete;
	const premiereLigneVisuelle = seyesVersVisuellePlusProche(infosPage.premiereLigneSeyes, mappageLignes);

	journaliseur.debug("CAPTURE_ZONE", `Page ${infosPage.numeroPage}: cherche ligneSeyes=${infosPage.premiereLigneSeyes}, trouvée=${premiereLigneVisuelle.existe}, indexVisuel=${premiereLigneVisuelle.indexVisuel}`);

	let decalageY;
	const largeurCarreauEcranPx = configPagination.largeurCarreauEcranPx;
	const offsetSuperieurPx = largeurCarreauEcranPx * POURCENTAGE_DECALAGE_CAPTURE_SEYES;
	const hauteurCaptureTheorique = configPagination.hauteurCaptureBaseeNombreLignes;

	// Invariant seyes-pdf-guard #5 — facteur de correction stride DOM live
	// (flottant) ↔ clone normalisé (Math.floor).
	const facteurCorrectionStride = largeurCarreauEcranPx / configSeyes.largeur_carreau;

	const lignesDeCettePage = mappageLignes.filter((l) =>
		l.ligneSeyes >= infosPage.premiereLigneSeyes && l.ligneSeyes <= infosPage.derniereLigneSeyes,
	);
	let hauteurCaptureDynamique = hauteurCaptureTheorique;
	const estModeCahier = configPagination.estModeCahier || false;

	if (premiereLigneVisuelle.existe && lignesDeCettePage.length > 0) {
		const positionPremiere = (lignesVisuelles[premiereLigneVisuelle.indexVisuel] && lignesVisuelles[premiereLigneVisuelle.indexVisuel].positionY) || 0;
		const positionDerniere = Math.max(...lignesDeCettePage.map((l) =>
			(lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY) || 0,
		));

		const ecartNormalise = (positionDerniere - positionPremiere) * facteurCorrectionStride;
		hauteurCaptureDynamique = ecartNormalise + largeurCarreauEcranPx + largeurCarreauEcranPx * 0.5;

		journaliseur.debug("CAPTURE_ZONE", `Page ${infosPage.numeroPage}: hauteur dynamique calculée`, {
			nombreLignesTrouvees: lignesDeCettePage.length,
			positionPremiere: positionPremiere.toFixed(2),
			positionDerniere: positionDerniere.toFixed(2),
			ecartPositions: (positionDerniere - positionPremiere).toFixed(2),
			hauteurCaptureDynamique: hauteurCaptureDynamique.toFixed(2),
			hauteurCaptureTheorique: hauteurCaptureTheorique.toFixed(2),
			estModeCahier,
		});
	}

	const largeurMargeSeyes = configSeyes.largeur_marge;

	const hauteurCapture = Math.max(hauteurCaptureTheorique, hauteurCaptureDynamique);

	if (estModeCahier && options.formatCahier && FORMATS_CAHIER[options.formatCahier]) {
		const cahier = FORMATS_CAHIER[options.formatCahier];
		journaliseur.debug("CAHIER_DEBUG", "=== CAPTURE CAHIER ===", {
			format: options.formatCahier,
			lignesAttendues: cahier.lignes,
			hauteurTheorique: hauteurCaptureTheorique.toFixed(1) + "px",
			hauteurDynamique: hauteurCaptureDynamique.toFixed(1) + "px",
			hauteurRetenue: hauteurCapture.toFixed(1) + "px",
			carreauEcran: largeurCarreauEcranPx + "px",
		});
	}

	if (!premiereLigneVisuelle.existe) {
		const premiereLigneDisponible = lignesVisuelles[0];
		decalageY = premiereLigneDisponible ? Math.max(0, premiereLigneDisponible.positionY * facteurCorrectionStride) : 0;
		journaliseur.avertir("CAPTURE_ZONE", `⚠️ Page ${infosPage.numeroPage}: FALLBACK à ligne 0! ligneSeyes=${infosPage.premiereLigneSeyes} non trouvée dans mapping (${mappageLignes.length} lignes mappées)`);
	} else {
		const ligneVisuelle = lignesVisuelles[premiereLigneVisuelle.indexVisuel];
		const positionYNormalisee = ligneVisuelle.positionY * facteurCorrectionStride;
		const decalageLignesVidesPx = (premiereLigneVisuelle.ligneSeyes - infosPage.premiereLigneSeyes) * largeurCarreauEcranPx;
		decalageY = Math.max(0, positionYNormalisee - decalageLignesVidesPx - offsetSuperieurPx);

		journaliseur.debug("CAPTURE_ZONE",
			`Page ${infosPage.numeroPage}: decalageY=${decalageY.toFixed(2)} (decalageLignesVides=${decalageLignesVidesPx.toFixed(2)}px)`);

		const finCapture = decalageY + hauteurCapture;

		const lignesProcheFin = mappageLignes.filter((l) => {
			const posY = (lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY) || 0;
			return Math.abs(posY - finCapture) < largeurCarreauEcranPx * 2;
		});

		journaliseur.debug("CAPTURE_ZONE_DETAIL", `Page ${infosPage.numeroPage}: DIAGNOSTIC ZONE`, {
			ligneSeyes: infosPage.premiereLigneSeyes,
			ligneVisuelle_indexVisuel: premiereLigneVisuelle.indexVisuel,
			ligneVisuelle_positionY: ligneVisuelle.positionY.toFixed(2),
			offsetSuperieurPx: offsetSuperieurPx.toFixed(2),
			decalageY: decalageY.toFixed(2),
			hauteurCapture: hauteurCapture.toFixed(2),
			finCapture: finCapture.toFixed(2),
			largeurCarreau: largeurCarreauEcranPx,
			lignesProcheFin: lignesProcheFin.map((l) => ({
				ligneSeyes: l.ligneSeyes,
				indexVisuel: l.indexVisuel,
				positionY: lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY && lignesVisuelles[l.indexVisuel].positionY.toFixed(2),
				contenu: l.contenu && l.contenu.substring(0, 30),
			})),
		});

		const lignesAuDelaDerniere = mappageLignes.filter((l) => {
			const posY = (lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY) || 0;
			return l.ligneSeyes > infosPage.derniereLigneSeyes && posY < finCapture;
		});

		if (lignesAuDelaDerniere.length > 0) {
			journaliseur.debug("CAPTURE_ZONE_DETAIL", `Page ${infosPage.numeroPage}: LIGNES HORS PAGE CAPTURÉES`, {
				lignesDerniereSeyes: infosPage.derniereLigneSeyes,
				lignesCapturees: lignesAuDelaDerniere.map((l) => ({
					ligneSeyes: l.ligneSeyes,
					indexVisuel: l.indexVisuel,
					positionY: lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY && lignesVisuelles[l.indexVisuel].positionY.toFixed(2),
					contenu: l.contenu && l.contenu.substring(0, 30),
				})),
			});
		}

		const lignesAssigneesHorsZone = mappageLignes.filter((l) => {
			const posY = (lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY) || 0;
			const ligneAppartientPage = l.ligneSeyes >= infosPage.premiereLigneSeyes && l.ligneSeyes <= infosPage.derniereLigneSeyes;
			const ligneHorsZone = posY < decalageY || posY >= finCapture;
			return ligneAppartientPage && ligneHorsZone;
		});

		if (lignesAssigneesHorsZone.length > 0) {
			journaliseur.avertir("CAPTURE_ZONE_DETAIL", `⚠️ Page ${infosPage.numeroPage}: LIGNES ASSIGNÉES MAIS HORS ZONE DE CAPTURE!`);
			lignesAssigneesHorsZone.forEach((l) => {
				const posY = (lignesVisuelles[l.indexVisuel] && lignesVisuelles[l.indexVisuel].positionY) || 0;
				const status = posY < decalageY ? "AU-DESSUS" : "EN-DESSOUS";
				journaliseur.avertir("CAPTURE_ZONE_DETAIL", `  → Ligne Seyès ${l.ligneSeyes} (${status}): posY=${posY.toFixed(0)}, zone=[${decalageY.toFixed(0)}, ${finCapture.toFixed(0)}], contenu="${l.contenu && l.contenu.substring(0, 40)}"`);
			});
		}
	}

	// Mode cahier : capture exactement `#page.offsetWidth = N × carreau_px`, en
	// démarrant à la frontière droite de `#marge`. Le trait rouge vertical est
	// repositionné par `normaliserCSSPourCapture` ({ estModeCahier: true }) comme
	// border-left de #page (box-sizing: border-box), donc il tombe sur la ligne
	// verticale gauche du premier carreau sans occuper de largeur supplémentaire.
	// Conséquence : largeurNaturelleMm = N × (4 × interligne) mm pile, cap
	// `cahier.largeurMm` jamais déclenché, carreau imprimé = 4 × interligne mm
	// exact sur toute taille d'écran.
	//
	// Note : pour `cahier_de_textes`, le module `cahier-de-textes-pdf.mjs`
	// applique en aval `ajusterZoneCapture` qui override `decalageX=0` et
	// `largeur=(marge1+marge2+page)×carreau` pour capturer toute la largeur
	// du cahier. Cette fonction reste générique.
	const largeurCapture = estModeCahier ? largeurContenu - largeurMargeSeyes : largeurContenu;
	const decalageX = estModeCahier ? largeurMargeSeyes : 0;

	if (estModeCahier) {
		const cahier = options.formatCahier ? FORMATS_CAHIER[options.formatCahier] : null;
		journaliseur.debug("CAHIER_DEBUG", "=== DIAGNOSTIC CAPTURE CAHIER ===");
		journaliseur.debug("CAHIER_DEBUG", `Format: ${options.formatCahier}, Lignes attendues: ${cahier && cahier.lignes}, Carreaux: ${cahier && cahier.carreaux}`);
		journaliseur.debug("CAHIER_DEBUG", `Largeur capture: ${Math.round(largeurCapture)}px (contenu=${largeurContenu}px, marge=${largeurMargeSeyes}px)`);
		journaliseur.debug("CAHIER_DEBUG", `Hauteur capture: ${Math.round(hauteurCapture)}px (théorique=${hauteurCaptureTheorique.toFixed(1)}px)`);
		journaliseur.debug("CAHIER_DEBUG", `Carreau écran: ${largeurCarreauEcranPx}px`);
		journaliseur.debug("CAHIER_DEBUG", `Ratio capture (L/H): ${(largeurCapture / hauteurCapture).toFixed(4)}`);
		journaliseur.debug("CAHIER_DEBUG", `Ratio cahier mm: ${((cahier && cahier.largeurMm) / (cahier && cahier.hauteurMm)).toFixed(4)}`);
	}

	const MARGE_BORD_PIPELINE_PX = 2;

	const zone = {
		largeur: Math.round(largeurCapture),
		hauteur: Math.ceil(hauteurCapture) + MARGE_BORD_PIPELINE_PX,
		decalageY: Math.round(decalageY),
		decalageX: Math.round(decalageX),
		positionScroll: 0,
		estDernierePage: infosPage.estDernierePage,
		hauteurDynamique: Math.ceil(hauteurCaptureDynamique) + MARGE_BORD_PIPELINE_PX,
		estModeCahier,
	};

	return zone;
}
