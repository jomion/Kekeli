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

import { snapdom } from "@zumer/snapdom";
import {
	COULEUR_FOND_CAPTURE,
	DPI_CIBLE_PDF,
	ECHELLE_CANVAS_HTML,
	ID_WRAPPER_CAPTURE,
	POLICES_LOCALES,
	SCALE_CAPTURE_MAX,
	SCALE_CAPTURE_MIN,
} from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";
import { attendreFramesStables } from "./utils.mjs";

/**
 * Calcule le scale SnapDOM cible pour une densité de rasterisation donnée
 * (par défaut DPI_CIBLE_PDF = 300).
 *
 * Formule : `scale = (dpi × widthMm / 25.4) / (cssWidthPx × dpr)`. SnapDOM
 * applique déjà `devicePixelRatio` en sus du scale, d'où la division.
 *
 * Borné à [SCALE_CAPTURE_MIN, SCALE_CAPTURE_MAX] pour éviter les valeurs
 * extrêmes sur petits viewports. Retourne `ECHELLE_CANVAS_HTML` (1.5, le
 * comportement historique) si les entrées sont invalides.
 *
 * @param {Object} args
 * @param {number} args.widthMm - Largeur finale dans le PDF (mm)
 * @param {number} args.cssWidthPx - Largeur de capture en CSS pixels
 * @param {number} [args.dpi=DPI_CIBLE_PDF] - Densité cible
 * @param {number} [args.dpr=window.devicePixelRatio||1]
 * @returns {number} Scale à passer à `capturerAvecSnapDOM`
 */
export function calculerScaleDpi(args) {
	const { widthMm, cssWidthPx } = args;
	const dpi = typeof args.dpi === "number" ? args.dpi : DPI_CIBLE_PDF;
	const dpr = typeof args.dpr === "number" ? args.dpr
		: (typeof window !== "undefined" && window.devicePixelRatio) || 1;

	if (!Number.isFinite(widthMm) || widthMm <= 0
		|| !Number.isFinite(cssWidthPx) || cssWidthPx <= 0) {
		return ECHELLE_CANVAS_HTML;
	}
	const pxCible = dpi * widthMm / 25.4;
	const scaleBrut = pxCible / (cssWidthPx * dpr);
	if (!Number.isFinite(scaleBrut) || scaleBrut <= 0) {
		return ECHELLE_CANVAS_HTML;
	}
	return Math.min(SCALE_CAPTURE_MAX, Math.max(SCALE_CAPTURE_MIN, scaleBrut));
}

// Profiling gated par `?debug=1` (conformément à la convention du fork :
// mêmes paramètre URL que l'activation d'Eruda). Les marks/measures sont
// alors exposés dans DevTools → Performance.
function debugActif() {
	try {
		return new URLSearchParams(window.location.search).has("debug");
		// eslint-disable-next-line no-unused-vars
	} catch (e) {
		return false;
	}
}

// Lit la dernière mesure nommée et retourne sa durée arrondie (ms).
function dureeMesure(nom) {
	const entries = performance.getEntriesByName(nom, "measure");
	if (!entries.length) return null;
	return Math.round(entries[entries.length - 1].duration);
}

/**
 * Wrapper SnapDOM pour la capture PDF Seyès.
 *
 * Remplace l'usage direct de window.snapdom par l'import ES via npm
 * (@zumer/snapdom). Ajoute le support des décalages X et Y (SnapDOM ne les
 * fournit pas nativement) via un wrapper DOM avec overflow:hidden et marges
 * négatives sur le clone.
 *
 * Le callback `onclone` est exposé pour la normalisation CSS et le masquage
 * cursif, analogue au hook onclone de html2canvas.
 */

/**
 * Capture un élément DOM avec SnapDOM, avec support des décalages X et Y.
 *
 * Utilise le pattern v2 capture-once : un seul clone/normalisation produit
 * à la fois un `canvas` (pour l'export PDF) et un `svgUrl` (data URL
 * SVG+foreignObject avec fontes et backgrounds inlinés, pour l'aperçu
 * vectoriel). L'aperçu rendu via `<img src=svgUrl>` laisse le navigateur
 * rasterizer à la résolution écran native — plus de downscale bilinéaire
 * qui faisait disparaître les fines lignes de la réglure Séyès.
 *
 * @param {HTMLElement} element - Élément à capturer
 * @param {Object} options
 * @param {number} [options.scale=1.5]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {number} [options.x=0]
 * @param {number} [options.y=0]
 * @param {string} [options.backgroundColor="#ffffff"]
 * @param {Function} [options.onclone] - Reçoit un pseudo-document
 * @returns {Promise<{canvas: HTMLCanvasElement, svgUrl: string, width: number, height: number, sourceWidthPx: number, sourceHeightPx: number}>}
 *     `width` / `height` = dimensions du canvas en pixels canvas
 *     (= DOM_px × scale × devicePixelRatio de SnapDOM).
 *     `sourceWidthPx` / `sourceHeightPx` = dimensions source en DOM px
 *     (= options.width / options.height). Nécessaire pour les calculs de
 *     précision carreau où le dpr intermédiaire de SnapDOM pollue
 *     `canvas.width / scale`.
 */
export async function capturerAvecSnapDOM(element, options = {}) {
	const {
		scale = ECHELLE_CANVAS_HTML,
		width,
		height,
		x = 0,
		y = 0,
		backgroundColor = COULEUR_FOND_CAPTURE,
		onclone,
	} = options;

	journaliseur.debug(
		"SNAPDOM",
		`Capture: scale=${scale}, width=${width}, height=${height}, x=${x}, y=${y}`,
	);

	// Wrapper DOM pour gérer les décalages X et Y (overflow:hidden + marges
	// négatives sur le clone). Placé hors écran pendant la capture.
	//
	// L'ID `ID_WRAPPER_CAPTURE` sert à SCOPER les règles CSS injectées par
	// `normaliserCSSPourCapture` (via le pseudo-document head.appendChild
	// plus bas) : sans ce préfixe, des règles comme `* { animation: none }`
	// affecteraient tout le document pendant la capture et figeraient
	// notamment les spinners de chargement. Cf. invariant 6 seyes-pdf-guard.
	const wrapper = document.createElement("div");
	wrapper.id = ID_WRAPPER_CAPTURE;
	wrapper.style.cssText = `
		position: fixed;
		left: -99999px;
		top: 0;
		overflow: hidden;
		width: ${width}px;
		height: ${height}px;
		background-color: ${backgroundColor};
	`;

	const clone = element.cloneNode(true);
	clone.style.marginTop = `-${y}px`;
	clone.style.marginLeft = `-${x}px`;
	clone.style.position = "relative";

	wrapper.appendChild(clone);
	document.body.appendChild(wrapper);

	try {
		if (onclone && typeof onclone === "function") {
			// Pseudo-document compatible avec le callback attendu (même forme que
			// le document du hook html2canvas / normaliserCSSPourCapture).
			const pseudoDoc = {
				querySelector: (sel) => clone.querySelector(sel) || wrapper.querySelector(sel),
				querySelectorAll: (sel) => clone.querySelectorAll(sel),
				getElementById: (id) => clone.querySelector(`#${id}`) || wrapper.querySelector(`#${id}`),
				createElement: (tag) => document.createElement(tag),
				head: {
					appendChild: (el) => {
						if (el.tagName === "STYLE") {
							wrapper.insertBefore(el.cloneNode(true), wrapper.firstChild);
						}
					},
				},
			};
			onclone(pseudoDoc);
		}

		// Stabilisation AVANT snapdom.toCanvas :
		// - document.fonts.ready : les polices locales (cursives custom) sont
		//   chargées avant que SnapDOM sérialise les styles.
		// - double rAF : le wrapper (tout juste appendChild) + les modifs de
		//   onclone sont layoutées + peintes.
		// - offsetHeight : force un flush synchrone du layout du wrapper avant
		//   que SnapDOM lise les dimensions.
		// C'est LE point correct : après toutes les manipulations DOM du clone,
		// juste avant la capture. Équivalent au hook stabilisation qui suivait
		// `conteneur.scrollTop = ...` dans l'ancien pipeline (setTimeout 500 ms).
		//
		// Instrumentation gated par `?debug=1` : marks/measures exposés à
		// DevTools → Performance + log résumé via journaliseur (BP-4). Hors
		// debug, aucune mesure pour ne pas polluer le hot path.
		const profiling = debugActif();
		if (profiling) performance.mark("pdf:capture:debut");

		if (document.fonts && document.fonts.ready) {
			await document.fonts.ready;
		}
		if (profiling) performance.mark("pdf:capture:fonts-pretes");

		await attendreFramesStables();
		if (profiling) performance.mark("pdf:capture:raf");

		void wrapper.offsetHeight;
		if (profiling) performance.mark("pdf:capture:reflow");

		// Pattern SnapDOM v2 capture-once : une seule phase de clone +
		// normalisation + inline des fontes/images, puis exports multiples.
		// `capture.url` est la data URL SVG déjà prête (foreignObject + fontes
		// base64 + backgrounds inlinés). `capture.toCanvas()` rasterise la
		// même représentation interne au scale demandé.
		const capture = await snapdom(wrapper, {
			scale,
			backgroundColor,
			embedFonts: true,
			localFonts: POLICES_LOCALES,
		});
		const canvas = await capture.toCanvas();
		const svgUrl = capture.url;
		if (profiling) {
			performance.mark("pdf:capture:snapdom");
			performance.measure("pdf:capture:fonts", "pdf:capture:debut", "pdf:capture:fonts-pretes");
			performance.measure("pdf:capture:rAF", "pdf:capture:fonts-pretes", "pdf:capture:raf");
			performance.measure("pdf:capture:reflowSync", "pdf:capture:raf", "pdf:capture:reflow");
			performance.measure("pdf:capture:toCanvas", "pdf:capture:reflow", "pdf:capture:snapdom");
			performance.measure("pdf:capture:total", "pdf:capture:debut", "pdf:capture:snapdom");

			journaliseur.info("PROFILING_SNAPDOM", "Capture SnapDOM détaillée (ms)", {
				fontsReady: dureeMesure("pdf:capture:fonts"),
				doubleRAF: dureeMesure("pdf:capture:rAF"),
				reflowSync: dureeMesure("pdf:capture:reflowSync"),
				snapdomToCanvas: dureeMesure("pdf:capture:toCanvas"),
				totalStabilisation: dureeMesure("pdf:capture:total"),
				canvasPx: `${canvas.width}×${canvas.height}`,
			});

			// Les marks/measures restent dans le buffer pour inspection DevTools.
			// Les performances-entries cycliques (nombreuses captures) sont
			// bornées par le buffer navigateur par défaut (~150 entries) ;
			// on nettoie le préfixe pdf:capture pour garder un buffer propre.
			performance.clearMarks();
			performance.clearMeasures();
		}
		journaliseur.debug("SNAPDOM", `Canvas capturé: ${canvas.width}x${canvas.height}px`);
		return {
			canvas,
			svgUrl,
			width: canvas.width,
			height: canvas.height,
			sourceWidthPx: width,
			sourceHeightPx: height,
		};
	} finally {
		if (wrapper.parentNode) {
			wrapper.parentNode.removeChild(wrapper);
		}
	}
}
