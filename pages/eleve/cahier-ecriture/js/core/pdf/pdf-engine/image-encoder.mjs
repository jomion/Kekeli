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
 * Encodeur image pour XObject PDF.
 *
 * Décision deux-chemins selon la taille du PNG canvas :
 *
 * - **Passe-plat IDAT** (PNG < SEUIL_QUANTIZATION_OCTETS) : l'IDAT déjà
 *   compressé en zlib par le navigateur est injecté tel quel dans le stream
 *   PDF FlateDecode avec Predictor 15. Aucun decode/recode, aucun JS.
 *
 * - **Quantifié custom** (PNG > seuil OU RGBA OU interlacé) : extraction
 *   RGB depuis le canvas → quantization k-d tree 256 couleurs →
 *   compression via `CompressionStream('deflate')` (API native, produit du
 *   zlib RFC 1950). XObject indexed avec Predictor 1 (optimal pour indices
 *   faiblement corrélés).
 *
 * Invariant 7 seyes-pdf-guard : la largeur source est lue depuis IHDR (PNG)
 * ou depuis canvas.width (cohérent puisque on ne multiplie pas par dpr ici).
 */

import { composantesPourColorType, parsePng } from "./png-chunks.mjs";
import { quantifier } from "./quantizer.mjs";

export const SEUIL_QUANTIZATION_OCTETS = 100000;
export const TAILLE_PALETTE_MAX = 256;

/**
 * Vérifie la disponibilité de `CompressionStream('deflate')`.
 * Supporté : Chrome 80+ (2020), Firefox 113+ (mai 2023), Safari 16.4+ (mars 2023).
 */
export function compressionStreamDisponible() {
	try {
		return typeof CompressionStream !== "undefined"
			&& typeof new CompressionStream("deflate") === "object";
	// eslint-disable-next-line no-unused-vars
	} catch (e) {
		return false;
	}
}

/**
 * Compresse des octets via l'API native `CompressionStream('deflate')`.
 * Produit du zlib RFC 1950 (header 0x78 + deflate + Adler-32) — format
 * accepté nativement par PDF FlateDecode et PNG IDAT.
 *
 * @param {Uint8Array} octets
 * @returns {Promise<Uint8Array>}
 */
export async function compresserZlib(octets) {
	if (!compressionStreamDisponible()) {
		throw new Error(
			"[image-encoder] CompressionStream('deflate') indisponible. "
				+ "Navigateur minimum : Chrome 80, Firefox 113, Safari 16.4.",
		);
	}
	const stream = new Blob([octets]).stream()
		.pipeThrough(new CompressionStream("deflate"));
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}

/**
 * Obtient le PNG d'un canvas via `toBlob` (async, plus efficace mémoire
 * que `toDataURL`).
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Uint8Array>} Octets PNG complets (signature + chunks)
 */
export async function canvasVersPng(canvas) {
	const blob = await new Promise((resolve, reject) => {
		if (typeof canvas.toBlob !== "function") {
			reject(new Error("[image-encoder] canvas.toBlob indisponible"));
			return;
		}
		canvas.toBlob((b) => {
			if (b) resolve(b);
			else reject(new Error("[image-encoder] canvas.toBlob a retourné null"));
		}, "image/png");
	});
	return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Extrait les composantes RGB d'un canvas (skip alpha pour nos pages
 * opaques). Alternative à un PNG intermédiaire pour la branche quantifiée.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ rgba: Uint8ClampedArray, width: number, height: number }}
 */
export function extraireRgbaCanvas(canvas) {
	const ctx = canvas.getContext("2d");
	const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
	return { rgba: img.data, width: canvas.width, height: canvas.height };
}

/**
 * Prépare les données d'une image à embarquer dans un XObject PDF.
 *
 * Résultat commun aux deux chemins : `{width, height, compresse, filtre,
 * predictor, colorSpace, palette}`. `compresse` = octets zlib (Filter
 * /FlateDecode), ready-to-inject.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [options]
 * @param {number} [options.seuilQuantization=SEUIL_QUANTIZATION_OCTETS]
 * @param {boolean} [options.forcerQuantization=false]
 * @returns {Promise<{
 *   width: number, height: number,
 *   compresse: Uint8Array,
 *   predictor: number,
 *   colorSpace: "DeviceRGB"|"Indexed",
 *   palette: Uint8Array|null,
 *   composantes: number
 * }>}
 */
export async function preparerImagePourPdf(canvas, options = {}) {
	const seuil = options.seuilQuantization != null
		? options.seuilQuantization
		: SEUIL_QUANTIZATION_OCTETS;
	const forcer = options.forcerQuantization === true;

	const pngOctets = await canvasVersPng(canvas);
	const chunks = parsePng(pngOctets);

	const doitQuantifier = forcer
		|| pngOctets.length > seuil
		|| chunks.interlace !== 0
		|| chunks.colorType === 6 // RGBA : passage obligatoire par extraction RGB
		|| chunks.colorType === 4; // Gris + Alpha : idem

	if (!doitQuantifier && (chunks.colorType === 2 || chunks.colorType === 3)) {
		// Chemin A : passe-plat IDAT
		return {
			width: chunks.width,
			height: chunks.height,
			compresse: chunks.idat,
			predictor: 15,
			colorSpace: chunks.colorType === 3 ? "Indexed" : "DeviceRGB",
			palette: chunks.plte,
			composantes: composantesPourColorType(chunks.colorType),
		};
	}

	// Chemin B : quantification + compression custom
	const { rgba, width, height } = extraireRgbaCanvas(canvas);
	const { palette, indices } = quantifier(
		rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer || rgba),
		TAILLE_PALETTE_MAX,
	);
	const compresse = await compresserZlib(indices);
	return {
		width,
		height,
		compresse,
		predictor: 1, // Aucun filtre : optimal pour indices faiblement corrélés
		colorSpace: "Indexed",
		palette,
		composantes: 1,
	};
}
