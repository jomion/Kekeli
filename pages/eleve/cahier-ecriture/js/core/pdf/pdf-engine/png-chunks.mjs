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
 * Parseur PNG minimal pour le pipeline passe-plat PDF.
 *
 * Extrait d'un Blob PNG (produit par `canvas.toBlob('image/png')`) les
 * informations nécessaires pour embarquer l'image dans un XObject PDF
 * FlateDecode + Predictor 15 SANS décompresser l'IDAT : on concatène les
 * chunks IDAT tels quels et on les injecte dans le stream PDF, puisque
 * PNG IDAT et PDF FlateDecode utilisent tous deux le format zlib (RFC 1950).
 *
 * Aucune dépendance runtime : parsing chunks par chunks via DataView.
 */

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Valide la signature PNG (8 premiers octets).
 * @private
 */
function verifierSignaturePng(octets) {
	if (octets.length < 8) return false;
	for (let i = 0; i < 8; i++) {
		if (octets[i] !== SIGNATURE_PNG[i]) return false;
	}
	return true;
}

/**
 * Encode le nom d'un chunk (type) en ASCII 4 caractères.
 * @private
 */
function lireTypeChunk(octets, offset) {
	return String.fromCharCode(
		octets[offset],
		octets[offset + 1],
		octets[offset + 2],
		octets[offset + 3],
	);
}

/**
 * Parse un PNG et retourne les chunks utiles pour l'export PDF.
 *
 * @param {Uint8Array} octets - Octets d'un PNG complet (signature + chunks).
 * @returns {{
 *   width: number,
 *   height: number,
 *   bitDepth: number,
 *   colorType: number,
 *   interlace: number,
 *   idat: Uint8Array,
 *   plte: Uint8Array|null,
 *   trns: Uint8Array|null
 * }}
 * @throws {Error} si la signature est invalide ou IHDR absent.
 */
export function parsePng(octets) {
	if (!verifierSignaturePng(octets)) {
		throw new Error("[png-chunks] signature PNG invalide");
	}

	const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
	let offset = 8;

	let ihdr = null;
	let plte = null;
	let trns = null;
	const idatMorceaux = [];
	let idatLongueurTotale = 0;

	while (offset < octets.length) {
		const longueur = vue.getUint32(offset, false);
		const type = lireTypeChunk(octets, offset + 4);
		const debutDonnees = offset + 8;
		const finDonnees = debutDonnees + longueur;

		if (type === "IHDR") {
			ihdr = {
				width: vue.getUint32(debutDonnees, false),
				height: vue.getUint32(debutDonnees + 4, false),
				bitDepth: octets[debutDonnees + 8],
				colorType: octets[debutDonnees + 9],
				// compression (offset+10) et filter (offset+11) : toujours 0 en PNG standard
				interlace: octets[debutDonnees + 12],
			};
		} else if (type === "PLTE") {
			plte = octets.slice(debutDonnees, finDonnees);
		} else if (type === "tRNS") {
			trns = octets.slice(debutDonnees, finDonnees);
		} else if (type === "IDAT") {
			// Peut y avoir plusieurs chunks IDAT — concaténation obligatoire
			// (spec PNG §5.3). Le stream zlib résultant reste valide puisque
			// PNG garantit que les chunks IDAT sont consécutifs et que le
			// stream zlib est continu à travers ces chunks.
			idatMorceaux.push(octets.subarray(debutDonnees, finDonnees));
			idatLongueurTotale += longueur;
		} else if (type === "IEND") {
			break;
		}

		// length + type + data + CRC32
		offset = finDonnees + 4;
	}

	if (!ihdr) {
		throw new Error("[png-chunks] chunk IHDR absent");
	}
	if (idatLongueurTotale === 0) {
		throw new Error("[png-chunks] aucun chunk IDAT");
	}

	// Concaténation des IDAT en un seul Uint8Array
	const idat = new Uint8Array(idatLongueurTotale);
	let pos = 0;
	for (const morceau of idatMorceaux) {
		idat.set(morceau, pos);
		pos += morceau.length;
	}

	return {
		width: ihdr.width,
		height: ihdr.height,
		bitDepth: ihdr.bitDepth,
		colorType: ihdr.colorType,
		interlace: ihdr.interlace,
		idat,
		plte,
		trns,
	};
}

/**
 * Nombre de composantes couleur par pixel selon le colorType PNG.
 * Utilisé pour `/Colors` dans `/DecodeParms` PDF (predictor PNG).
 *
 * @param {number} colorType
 * @returns {number}
 */
export function composantesPourColorType(colorType) {
	switch (colorType) {
		case 0: return 1; // Gris
		case 2: return 3; // RGB
		case 3: return 1; // Indexé (un index par pixel)
		case 4: return 2; // Gris + Alpha
		case 6: return 4; // RGBA
		default: throw new Error(`[png-chunks] colorType inconnu : ${colorType}`);
	}
}
