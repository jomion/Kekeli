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
 * Génération finale du PDF — positionnement des pages sur le document.
 *
 * Extrait de dialogue-pdf.mjs (plan refactoring Phase 6).
 *
 * Deux modes :
 * - 1 page par feuille (`genererPDFSimple`) : chaque canvas capturé devient
 *   une page du PDF, positionné via `calculerPositionnementImage`. Utilise
 *   le moteur pdf-engine vendoré (PNG FlateDecode + Predictor 15 passe-plat
 *   ou quantifié via CompressionStream selon la taille).
 * - 2 pages par feuille (`genererPDF2PagesParFeuille`) : idem, paires
 *   combinées via `calculerPositionsDeuxPages`.
 */

import { estCahierDeTextes } from "./cahier-de-textes-pdf.mjs";
import {
	calculerLargeurNaturelleMm,
	calculerPositionnementImage,
	calculerPositionsDeuxPages,
} from "./pagination-options.mjs";
import { preparerImagePourPdf } from "./pdf-engine/index.mjs";
import { obtenirConfigSeyes } from "./utils.mjs";

/**
 * Enrichit `options` avec `largeurNaturelleMm` calculée pour la source DOM,
 * et avec `preserveRatioCahier` en mode cahier_de_textes.
 *
 * `sourceWidthPx` est la largeur DOM capturée (pas canvas.width : SnapDOM
 * applique son dpr intermédiaire, donc canvas.width ≠ DOM_px × scale, et
 * depuis le scale dynamique 300 DPI ce rapport change par format). La
 * structure `pageData` de `capturerAvecSnapDOM` expose `sourceWidthPx`
 * directement. En l'absence de `sourceWidthPx`, on laisse
 * `calculerLargeurNaturelleMm` traiter la valeur `undefined` (retombe sur
 * stretch-to-fill) plutôt que d'essayer une division par un scale devenu
 * variable — cf. invariant 7 seyes-pdf-guard.
 *
 * Mode ecran (sans cahier_de_textes) → largeurNaturelleMm absent + pas de
 * preserveRatioCahier → `calculerPositionnementImage` retombe sur le chemin
 * stretch-to-fill (inchangé). Mode ecran + cahier_de_textes →
 * preserveRatioCahier=true → fit-contain (carreaux carrés). Mode mm →
 * largeurNaturelleMm défini → mode précision (inchangé).
 *
 * @private
 */
function optionsAvecLargeurNaturelle(options, pageData) {
	const largeurNaturelleMm = calculerLargeurNaturelleMm(
		pageData.sourceWidthPx,
		options,
		obtenirConfigSeyes(),
	);
	const enrichies = Object.assign({}, options);
	if (largeurNaturelleMm != null) enrichies.largeurNaturelleMm = largeurNaturelleMm;
	if (estCahierDeTextes()) enrichies.preserveRatioCahier = true;
	return enrichies;
}

/**
 * Remplit le document pdf-engine en mode 1 page par feuille.
 *
 * @param {Object} doc - Document pdf-engine (`creerDocument(...)`)
 * @param {Array<{canvas: HTMLCanvasElement, sourceWidthPx: number}>} pagesData
 *     Chaque entrée porte le canvas + la largeur DOM source (pour précision mm).
 * @param {Object} options - `{orientation, formatCahier, marges, ...}`
 * @param {{largeur:number, hauteur:number}} dimensions - Dimensions feuille (mm).
 */
export async function genererPDFSimple(doc, pagesData, options, dimensions) {
	for (let i = 0; i < pagesData.length; i++) {
		if (i > 0) {
			doc.ajouterPage({
				formatMm: [dimensions.largeur, dimensions.hauteur],
				orientation: options.orientation,
			});
		}

		const pageData = pagesData[i];
		const canvas = pageData.canvas;
		const optionsPlacement = optionsAvecLargeurNaturelle(options, pageData);

		const pos = calculerPositionnementImage(
			optionsPlacement,
			canvas.width,
			canvas.height,
			dimensions.largeur,
			dimensions.hauteur,
			options.marges,
		);

		// Préparation image via pdf-engine : décision passe-plat IDAT vs
		// quantifié custom selon la taille du PNG produit par toBlob.
		// Boucle strictement séquentielle : `for + await` (pas de
		// Promise.all) pour préserver l'invariant 5 (stride stable d'une
		// page à l'autre).
		const preparee = await preparerImagePourPdf(canvas);
		doc.ajouterImage({
			image: preparee,
			xMm: pos.x,
			yMm: pos.y,
			wMm: pos.width,
			hMm: pos.height,
		});
	}
}

/**
 * Remplit le document pdf-engine en mode 2 pages par feuille. L'orientation
 * de sortie est l'inverse de celle des pages sources (portrait source →
 * paysage feuille, et vice-versa).
 *
 * @param {Object} doc - Document pdf-engine (`creerDocument(...)`)
 * @param {Array<{canvas: HTMLCanvasElement, sourceWidthPx: number}>} pagesData
 * @param {Object} options - `{orientation, marges, formatCahier, formatPapier, pagesParFeuille}`
 * @param {{largeur:number, hauteur:number}} dimensions - Dimensions feuille (mm).
 */
export async function genererPDF2PagesParFeuille(doc, pagesData, options, dimensions) {
	const orientationSortie = options.orientation === "portrait" ? "landscape" : "portrait";

	for (let i = 0; i < pagesData.length; i += 2) {
		if (i > 0) {
			doc.ajouterPage({
				formatMm: [dimensions.largeur, dimensions.hauteur],
				orientation: orientationSortie,
			});
		}

		const pageData1 = pagesData[i];
		const pageData2 = pagesData[i + 1] || null;
		const canvas1 = pageData1.canvas;
		const canvas2 = pageData2 ? pageData2.canvas : null;

		// Injecte largeurNaturelleMm basée sur pageData1 (les deux pages ont
		// mêmes dimensions source en pratique puisque capturées même scale).
		const optionsPlacement = optionsAvecLargeurNaturelle(options, pageData1);
		const layout = calculerPositionsDeuxPages(optionsPlacement, canvas1, canvas2, dimensions);

		// Boucle strictement séquentielle (invariant 5) : on prépare la 1re
		// page puis la 2e, sans Promise.all.
		if (canvas1 && layout.pos1) {
			const preparee1 = await preparerImagePourPdf(canvas1);
			doc.ajouterImage({
				image: preparee1,
				xMm: layout.pos1.x,
				yMm: layout.pos1.y,
				wMm: layout.pos1.width,
				hMm: layout.pos1.height,
			});
		}
		if (canvas2 && layout.pos2) {
			const preparee2 = await preparerImagePourPdf(canvas2);
			doc.ajouterImage({
				image: preparee2,
				xMm: layout.pos2.x,
				yMm: layout.pos2.y,
				wMm: layout.pos2.width,
				hMm: layout.pos2.height,
			});
		}
	}
}
