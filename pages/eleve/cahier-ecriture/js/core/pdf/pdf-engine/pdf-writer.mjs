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
 * Moteur d'assemblage PDF.
 *
 * Produit un PDF 1.4 multi-pages à partir d'images préparées par
 * `image-encoder.mjs`. API procédurale :
 *
 *   const doc = creerDocument({ orientation, formatMm: [210, 297] });
 *   doc.definirMetadonnees({ title, creator, author, creationDate });
 *   doc.ajouterPage({ formatMm: [210, 297], orientation });
 *   doc.ajouterImage({ image: dataPreparee, xMm, yMm, wMm, hMm });
 *   await doc.sauvegarder("mon-fichier.pdf");
 *
 * Dérivé du plugin `@zumer/snapdom-plugins/pdf-image` (MIT) étendu pour
 * multi-pages, formats mm arbitraires et métadonnées. L'écriture binaire
 * mélange texte (via `TextEncoder`) et octets bruts (Uint8Array) pour les
 * streams image zlib.
 */

/** 1 mm = 1/25.4 × 72 points PDF. */
export const MM_VERS_PT = 72 / 25.4;

const encodeur = new TextEncoder();

function octetsTexte(s) {
	return encodeur.encode(s);
}

/**
 * Formate un nombre pour un PDF : 3 décimales max, sans notation scientifique.
 * @private
 */
function fmt(n) {
	if (!Number.isFinite(n)) return "0";
	return Math.round(n * 1000) / 1000 + "";
}

/**
 * Encode une string pour metadata PDF.
 * - ASCII pur : format littéral `(...)` avec échappements minimaux.
 * - Non-ASCII : hex string UTF-16BE avec BOM `<FEFF...>`.
 * @private
 */
function encodeStringPdf(s) {
	if (!s) return "()";
	let asciiPur = true;
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) > 0x7e) { asciiPur = false; break; }
	}
	if (asciiPur) {
		const echap = s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
		return `(${echap})`;
	}
	// UTF-16BE + BOM
	let hex = "FEFF";
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		hex += ((c >> 8) & 0xff).toString(16).padStart(2, "0").toUpperCase();
		hex += (c & 0xff).toString(16).padStart(2, "0").toUpperCase();
	}
	return `<${hex}>`;
}

/**
 * Formate une Date JavaScript au format PDF : `D:YYYYMMDDHHmmSSZ`.
 * @private
 */
function formaterDatePdf(date) {
	const d = date instanceof Date ? date : new Date(date);
	const p = (n) => String(n).padStart(2, "0");
	return (
		"D:"
		+ d.getUTCFullYear()
		+ p(d.getUTCMonth() + 1)
		+ p(d.getUTCDate())
		+ p(d.getUTCHours())
		+ p(d.getUTCMinutes())
		+ p(d.getUTCSeconds())
		+ "Z"
	);
}

/**
 * Construit la chaîne `/DecodeParms` pour un filtre PNG predictor.
 * @private
 */
function construireDecodeParms(image) {
	if (image.predictor === 1) return null;
	return (
		"<< /Predictor " + image.predictor
		+ " /Colors " + image.composantes
		+ " /BitsPerComponent 8"
		+ " /Columns " + image.width
		+ " >>"
	);
}

/**
 * Construit le ColorSpace pour un XObject Image.
 * Pour /Indexed avec palette RGB : `[/Indexed /DeviceRGB N-1 <hex>]`.
 * @private
 */
function construireColorSpace(image) {
	if (image.colorSpace === "Indexed" && image.palette) {
		const n = image.palette.length / 3;
		let hex = "";
		for (let i = 0; i < image.palette.length; i++) {
			hex += image.palette[i].toString(16).padStart(2, "0");
		}
		return `[ /Indexed /DeviceRGB ${n - 1} <${hex}> ]`;
	}
	return "/" + image.colorSpace;
}

/**
 * Déclenche un téléchargement navigateur d'un Blob.
 * @private
 */
function telechargerBlob(blob, nomFichier) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = nomFichier;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Crée un nouveau document PDF.
 *
 * @param {Object} [options]
 * @param {string} [options.orientation="portrait"] - Orientation par défaut des pages
 * @param {[number, number]} [options.formatMm=[210, 297]] - Format par défaut (A4)
 * @returns {Object} Handle d'API (ajouterPage, ajouterImage, définirMetadonnees, sauvegarder, toBlob)
 */
export function creerDocument(options = {}) {
	const orientationDefaut = options.orientation || "portrait";
	const formatDefaut = options.formatMm || [210, 297];

	// Structures internes
	const pages = []; // [{ largeurPt, hauteurPt, operations: [contentOps] }]
	const imagesEmbarquees = []; // [{ image, objId }]
	const metadonnees = {
		title: "",
		creator: "",
		author: "",
		creationDate: new Date(),
	};

	function ajouterPageInterne(opts) {
		const fmtMm = (opts && opts.formatMm) || formatDefaut;
		const orient = (opts && opts.orientation) || orientationDefaut;
		let largeurMm = fmtMm[0];
		let hauteurMm = fmtMm[1];
		if (orient === "landscape" && largeurMm < hauteurMm) {
			[largeurMm, hauteurMm] = [hauteurMm, largeurMm];
		}
		pages.push({
			largeurPt: largeurMm * MM_VERS_PT,
			hauteurPt: hauteurMm * MM_VERS_PT,
			operations: [], // opérations de content stream à concaténer
			images: [], // images référencées par cette page (objId)
		});
	}

	function ajouterImageInterne({ image, xMm, yMm, wMm, hMm }) {
		if (pages.length === 0) {
			// Auto-ajout page par défaut si aucune page déjà créée
			ajouterPageInterne();
		}
		const page = pages[pages.length - 1];

		const wPt = wMm * MM_VERS_PT;
		const hPt = hMm * MM_VERS_PT;
		const xPt = xMm * MM_VERS_PT;
		// PDF : origine bas-gauche. xMm/yMm sont depuis le haut-gauche.
		const yPt = page.hauteurPt - (yMm * MM_VERS_PT) - hPt;

		imagesEmbarquees.push({ image, indexPage: pages.length - 1, indexImage: page.images.length });
		const ressourceNom = "Im" + (page.images.length);
		page.images.push({ ressourceNom, imageRef: imagesEmbarquees.length - 1 });
		page.operations.push(
			`q\n${fmt(wPt)} 0 0 ${fmt(hPt)} ${fmt(xPt)} ${fmt(yPt)} cm\n/${ressourceNom} Do\nQ\n`,
		);
	}

	function definirMetadonneesInterne(meta) {
		if (meta.title != null) metadonnees.title = meta.title;
		if (meta.creator != null) metadonnees.creator = meta.creator;
		if (meta.author != null) metadonnees.author = meta.author;
		if (meta.creationDate != null) metadonnees.creationDate = meta.creationDate;
	}

	/**
	 * Assemble le PDF final en Blob. Effet de bord : réalise l'écriture
	 * d'objets dans un tableau `parts` et construit la table xref.
	 */
	async function assemblerBlob() {
		// Attribution des IDs d'objets :
		// 1 = Catalog, 2 = Pages root, 3 = Info
		// 4..(4+nPages-1) = Page objects
		// (4+nPages)..(4+nPages+nImages-1) = XObject Image objects
		// (4+nPages+nImages)..(4+2*nPages+nImages-1) = Content stream objects
		const nPages = pages.length;
		const nImages = imagesEmbarquees.length;

		const OBJ_CATALOG = 1;
		const OBJ_PAGES_ROOT = 2;
		const OBJ_INFO = 3;
		const OBJ_PAGE_BASE = 4;
		const OBJ_IMAGE_BASE = OBJ_PAGE_BASE + nPages;
		const OBJ_CONTENT_BASE = OBJ_IMAGE_BASE + nImages;
		const totalObjets = 3 + 2 * nPages + nImages;

		const parties = []; // Array<Uint8Array>
		const offsets = [0]; // offsets[i] = offset de l'objet i+1 (0 réservé trailer)
		let positionCourante = 0;

		function ajouterTexte(s) {
			const bytes = octetsTexte(s);
			parties.push(bytes);
			positionCourante += bytes.length;
		}

		function ajouterOctets(bytes) {
			parties.push(bytes);
			positionCourante += bytes.length;
		}

		function ecrireObjet(id, construireContenu) {
			offsets[id] = positionCourante;
			ajouterTexte(id + " 0 obj\n");
			construireContenu();
			ajouterTexte("\nendobj\n");
		}

		// Header PDF 1.4 + binaire (4 octets non-ASCII pour aider les détecteurs de type)
		ajouterTexte("%PDF-1.4\n");
		ajouterOctets(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

		// Catalog
		ecrireObjet(OBJ_CATALOG, () => {
			ajouterTexte(`<< /Type /Catalog /Pages ${OBJ_PAGES_ROOT} 0 R >>`);
		});

		// Pages root
		ecrireObjet(OBJ_PAGES_ROOT, () => {
			const kids = [];
			for (let i = 0; i < nPages; i++) kids.push(`${OBJ_PAGE_BASE + i} 0 R`);
			ajouterTexte(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${nPages} >>`);
		});

		// Info
		ecrireObjet(OBJ_INFO, () => {
			let info = "<<";
			info += ` /Title ${encodeStringPdf(metadonnees.title)}`;
			info += ` /Creator ${encodeStringPdf(metadonnees.creator)}`;
			info += ` /Producer ${encodeStringPdf(metadonnees.creator)}`;
			info += ` /Author ${encodeStringPdf(metadonnees.author)}`;
			const dateStr = formaterDatePdf(metadonnees.creationDate);
			info += ` /CreationDate (${dateStr})`;
			info += ` /ModDate (${dateStr})`;
			info += " >>";
			ajouterTexte(info);
		});

		// Page objects
		for (let i = 0; i < nPages; i++) {
			const page = pages[i];
			ecrireObjet(OBJ_PAGE_BASE + i, () => {
				let s = `<< /Type /Page /Parent ${OBJ_PAGES_ROOT} 0 R`;
				s += ` /MediaBox [0 0 ${fmt(page.largeurPt)} ${fmt(page.hauteurPt)}]`;
				s += ` /Contents ${OBJ_CONTENT_BASE + i} 0 R`;
				if (page.images.length > 0) {
					s += " /Resources << /XObject <<";
					for (const im of page.images) {
						const imgRef = imagesEmbarquees[im.imageRef];
						s += ` /${im.ressourceNom} ${OBJ_IMAGE_BASE + im.imageRef} 0 R`;
						// (imgRef sert à valider l'index — non utilisé directement ici)
						void imgRef;
					}
					s += " >> >>";
				} else {
					s += " /Resources << >>";
				}
				s += " >>";
				ajouterTexte(s);
			});
		}

		// XObject Image objects (streams)
		for (let i = 0; i < nImages; i++) {
			const { image } = imagesEmbarquees[i];
			ecrireObjet(OBJ_IMAGE_BASE + i, () => {
				let header = "<< /Type /XObject /Subtype /Image";
				header += ` /Width ${image.width}`;
				header += ` /Height ${image.height}`;
				header += ` /ColorSpace ${construireColorSpace(image)}`;
				header += " /BitsPerComponent 8";
				header += " /Filter /FlateDecode";
				const decodeParms = construireDecodeParms(image);
				if (decodeParms) header += ` /DecodeParms ${decodeParms}`;
				header += ` /Length ${image.compresse.length}`;
				header += " >>\nstream\n";
				ajouterTexte(header);
				ajouterOctets(image.compresse);
				ajouterTexte("\nendstream");
			});
		}

		// Content streams
		for (let i = 0; i < nPages; i++) {
			const page = pages[i];
			const content = page.operations.join("");
			const contentBytes = octetsTexte(content);
			ecrireObjet(OBJ_CONTENT_BASE + i, () => {
				ajouterTexte(`<< /Length ${contentBytes.length} >>\nstream\n`);
				ajouterOctets(contentBytes);
				ajouterTexte("\nendstream");
			});
		}

		// xref table
		const xrefOffset = positionCourante;
		let xref = `xref\n0 ${totalObjets + 1}\n`;
		xref += "0000000000 65535 f \n";
		for (let id = 1; id <= totalObjets; id++) {
			xref += String(offsets[id] || 0).padStart(10, "0") + " 00000 n \n";
		}
		ajouterTexte(xref);

		// Trailer
		let trailer = `trailer\n<< /Size ${totalObjets + 1}`;
		trailer += ` /Root ${OBJ_CATALOG} 0 R`;
		trailer += ` /Info ${OBJ_INFO} 0 R >>`;
		trailer += `\nstartxref\n${xrefOffset}\n%%EOF\n`;
		ajouterTexte(trailer);

		// Concaténation finale
		let tailleTotale = 0;
		for (const p of parties) tailleTotale += p.length;
		const pdfOctets = new Uint8Array(tailleTotale);
		let pos = 0;
		for (const p of parties) {
			pdfOctets.set(p, pos);
			pos += p.length;
		}
		return new Blob([pdfOctets], { type: "application/pdf" });
	}

	async function sauvegarderInterne(nomFichier) {
		const blob = await assemblerBlob();
		telechargerBlob(blob, nomFichier);
		return blob;
	}

	return {
		ajouterPage: ajouterPageInterne,
		ajouterImage: ajouterImageInterne,
		definirMetadonnees: definirMetadonneesInterne,
		sauvegarder: sauvegarderInterne,
		toBlob: assemblerBlob,
		getNombrePages: () => pages.length,
	};
}
