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
 * Moteur PDF vendoré : façade.
 *
 * Remplace jsPDF pour l'export PDF Seyès. Zéro dépendance runtime tierce :
 * - `png-chunks` : parse Blob PNG → IHDR + IDAT + PLTE (sans décompresser).
 * - `quantizer` : k-d tree 256 couleurs (extrait UPNG.js MIT, ES2018).
 * - `image-encoder` : canvas → stream zlib via `CompressionStream('deflate')`.
 * - `pdf-writer` : assemblage XObject + xref + metadata.
 *
 * Cf. [plans/archive/...](../../../../../plans/archive/) pour la genèse du plan.
 */

export { parsePng, composantesPourColorType } from "./png-chunks.mjs";
export { quantifier } from "./quantizer.mjs";
export {
	SEUIL_QUANTIZATION_OCTETS,
	TAILLE_PALETTE_MAX,
	canvasVersPng,
	compresserZlib,
	compressionStreamDisponible,
	extraireRgbaCanvas,
	preparerImagePourPdf,
} from "./image-encoder.mjs";
export { MM_VERS_PT, creerDocument } from "./pdf-writer.mjs";
