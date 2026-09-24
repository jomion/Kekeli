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
 * Support PDF du lignage « cahier de textes » (type 12).
 *
 * Module pivot : centralise TOUTE la logique métier du cahier de textes côté
 * export PDF. Le pipeline générique (`pagination-options.mjs`, capture loop
 * dans `dialogue-pdf.mjs`) reste indépendant — il appelle les fonctions
 * exportées de ce module sans connaître le détail. Les fonctions sont
 * conçues comme **no-op transparents** quand `estCahierDeTextes()` est false :
 * l'appelant peut invoquer sans branchement.
 *
 * ## Approche : composition POST-CAPTURE
 *
 *  - **Corps** (matière/date/texte) capturé via le pipeline standard. Pour
 *    aligner le wrap analysé par Ben Nadel sur ce que rendra le clone, on
 *    pré-applique les largeurs de colonnes prescrites au LIVE DOM
 *    (`appliquerColonnesLive`) avant l'analyse, et on les restaure ensuite
 *    (`restaurerColonnesLive`).
 *
 *  - **Pagination** : `ajusterPagination` est conservée pour compatibilité
 *    d'API avec le pipeline (`dialogue-pdf.mjs` l'invoque sans branchement)
 *    mais elle est désormais une **identité** : la formule
 *    `floor(hauteurUtileMm / carreauMm − 1.5)` de `calculerPaginationAvecOptions`
 *    réserve déjà 1.5 carreau (1 carreau d'extension dynamique + 0.5 carreau
 *    jambages). En config B, le header de 1 carreau prend la place de
 *    l'extension dynamique réservée — pas une nouvelle place. Soustraire à
 *    nouveau aboutit à un double comptage : la composition est trop courte,
 *    une ligne est poussée sur la page suivante, ses ascendantes/descendantes
 *    bleed au-dessus du header de la page suivante (commit 6841ce1f → fix).
 *
 *  - **Zone de capture** : `ajusterZoneCapture` capture toute la largeur du
 *    cahier (incluant matière+date), pas seulement la zone à droite de la
 *    marge Seyes comme en mode cahier standard.
 *
 *  - **Header** : capturé séparément via SnapDOM en ciblant `#entete`
 *    directement (`capturerHeaderCahierDeTextes`), avec ajustement des
 *    sous-colonnes pour matcher le corps.
 *
 *  - **Composition** : `composerHeaderSurPages` capture le header une seule
 *    fois et le compose en haut de chaque page du tableau `pages[]` (mute
 *    en place : remplace `canvas` par le composite et régénère `svgUrl`).
 *
 */

import { config } from "../config.mjs";
import { capturerAvecSnapDOM, calculerScaleDpi } from "./capture-snapdom.mjs";
import {
	BLEED_MM,
	COULEUR_FOND_CAPTURE,
	ECHELLE_CANVAS_HTML,
	FORMATS_CAHIER,
	INTERLIGNE_VALEUR_ECRAN,
	POURCENTAGE_DECALAGE_CAPTURE_SEYES,
} from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";

/**
 * Hauteur en pixels du masque blanc anti-bleed à poser au TOP des captures
 * (`masqueHaut` et `masqueMarge` dans dialogue-pdf.mjs onclone).
 *
 * En config B (cahier_de_textes), retourne `offsetSuperieurPx = 0.25 × carreau`
 * pour couvrir la zone tampon entre la ligne N-1 (page précédente) et la
 * ligne N (première ligne de la page courante). Sans cette extension, les
 * descendantes (jambages) de la ligne N-1 bleed dans cette zone, malgré
 * `visibility:hidden` sur la ligne N-1 (le rasteriseur SnapDOM ne clipper
 * pas parfaitement les glyphes cursifs qui débordent du bbox de leur span).
 *
 * Le masque blanc cache visuellement cette zone — pattern identique au
 * `masqueHaut` 2px existant pour la ligne de réglure 25% (cf. dialogue-pdf.mjs).
 *
 * Dans les autres modes : retourne 2 (la hauteur historique pour masquer la
 * ligne de réglure 25% sans toucher au texte). Aucun changement de comportement.
 *
 * @param {number} largeurCarreauEcranPx - Largeur du carreau écran en px.
 * @returns {number} Hauteur du masque en px.
 */
export function hauteurMasqueAntiBleed(largeurCarreauEcranPx) {
	if (!estCahierDeTextes()) return 2;
	return Math.round(largeurCarreauEcranPx * POURCENTAGE_DECALAGE_CAPTURE_SEYES);
}

/**
 * Hauteur du header en carreaux. Utilisée à la fois pour adapter la
 * pagination (soustraire de `lignesParPage`) et pour dimensionner le header
 * en mm quand l'interligne est en mm (1 × 4 × interligne mm).
 */
export const HAUTEUR_HEADER_CARREAUX = 1;

/**
 * Répartition de référence des colonnes (matière, date, texte) en carreaux,
 * pour interligne 2 mm (= carreau 8 mm). Définit aussi les largeurs cibles
 * en mm de chaque colonne (à partir desquelles le calcul dynamique pour
 * d'autres interlignes est dérivé).
 *
 * Pour les interlignes ≠ 2 mm, utiliser `obtenirRepartitionColonnes(format, interligneMm)`
 * qui renvoie une répartition adaptée pour préserver `carreau_imprime = 4 × interligne mm`.
 *
 * @type {Readonly<Object>}
 */
export const REPARTITION_COLONNES_CAHIER = Object.freeze({
	petit_cahier: Object.freeze({ marge1: 3, marge2: 2, page: 10 }), // 15 × 8 mm = 120 mm
	grand_cahier_a4: Object.freeze({ marge1: 4, marge2: 2, page: 14 }), // 20 × 8 mm = 160 mm
	tres_grand_cahier: Object.freeze({ marge1: 4, marge2: 2, page: 18 }), // 24 × 8 mm = 192 mm
});

/**
 * Largeurs cibles en mm des colonnes matière (`marge1Mm`) et date (`marge2Mm`),
 * dérivées des valeurs de référence à 2 mm d'interligne. Utilisées par
 * `obtenirRepartitionColonnes` pour calculer la répartition à n'importe quel
 * interligne en préservant approximativement les dimensions physiques.
 *
 * @type {Readonly<Object>}
 */
const LARGEURS_COLONNES_MM = Object.freeze({
	petit_cahier: Object.freeze({ marge1Mm: 24, marge2Mm: 16 }), // 3×8, 2×8
	grand_cahier_a4: Object.freeze({ marge1Mm: 32, marge2Mm: 16 }), // 4×8, 2×8
	tres_grand_cahier: Object.freeze({ marge1Mm: 32, marge2Mm: 16 }), // 4×8, 2×8
});

/**
 * Calcule la répartition des colonnes (matière, date, page) en carreaux, en
 * fonction du format de cahier et de l'interligne demandé. Garantit que :
 *   carreau_imprimé = 4 × interligne mm (règle d'or précision)
 *
 * Algorithme :
 *   carreauMm = 4 × interligneMm
 *   nbCarreauxTotal = floor(cahier.largeurMm_sansBleed / carreauMm)
 *   marge1 = max(1, floor(targetMarge1Mm / carreauMm))
 *   marge2 = max(1, floor(targetMarge2Mm / carreauMm))
 *   page   = max(1, nbCarreauxTotal − marge1 − marge2)
 *
 * À 2 mm, retourne la répartition de référence (REPARTITION_COLONNES_CAHIER).
 * À interligne ≥ 2.5 mm, le nombre total de carreaux diminue (les carreaux
 * étant plus larges, moins en tiennent dans la largeur fixe du cahier),
 * mais chaque carreau imprime exactement à 4 × interligne mm — pas de
 * compression par `calculerPositionnementImage`.
 *
 * Pour `interligneMm = INTERLIGNE_VALEUR_ECRAN` (mode écran sans cible mm),
 * retourne la répartition de référence (carreau dérivé du DOM live).
 *
 * @param {string} formatCahier - "petit_cahier" | "grand_cahier_a4" | "tres_grand_cahier"
 * @param {number|string} interligneMm - hauteur d'interligne en mm, ou INTERLIGNE_VALEUR_ECRAN.
 * @returns {{marge1:number, marge2:number, page:number}|null} `null` si format inconnu.
 */
export function obtenirRepartitionColonnes(formatCahier, interligneMm) {
	const reference = REPARTITION_COLONNES_CAHIER[formatCahier];
	const cahier = FORMATS_CAHIER[formatCahier];
	const largeurs = LARGEURS_COLONNES_MM[formatCahier];
	if (!reference || !cahier || !largeurs) return null;

	// Mode ecran : la cible mm n'est pas définie → retourner la répartition
	// de référence (le carreau px live détermine le rendu).
	if (interligneMm === INTERLIGNE_VALEUR_ECRAN || typeof interligneMm !== "number" || !(interligneMm > 0)) {
		return reference;
	}

	const carreauMm = 4 * interligneMm;
	// Largeur cahier sans bleed (le bleed est un débord d'impression, pas une zone utile).
	const largeurCahierMm = cahier.largeurMm - 2 * BLEED_MM;
	const nbCarreauxTotal = Math.max(3, Math.floor(largeurCahierMm / carreauMm));
	const marge1 = Math.max(1, Math.floor(largeurs.marge1Mm / carreauMm));
	const marge2 = Math.max(1, Math.floor(largeurs.marge2Mm / carreauMm));
	const page = Math.max(1, nbCarreauxTotal - marge1 - marge2);

	return { marge1, marge2, page };
}

/**
 * Retourne true si le lignage courant est « cahier de textes ».
 * @returns {boolean}
 */
export function estCahierDeTextes() {
	return config.typeCarreaux === "cahier_de_textes";
}

/**
 * Hauteur du header en mm, fonction de l'interligne courant.
 *
 * @param {{interligneMm: number|null|undefined}} params
 * @returns {number} Hauteur du header en mm. 0 si interligne non numérique.
 */
export function hauteurHeaderMm({ interligneMm }) {
	if (typeof interligneMm !== "number" || !(interligneMm > 0)) return 0;
	return HAUTEUR_HEADER_CARREAUX * 4 * interligneMm;
}

// ============================================================================
// Sync LIVE DOM ↔ clone (avant l'analyse Ben Nadel)
// ============================================================================

/**
 * Si cahier_de_textes + format cahier (petit/grand/tres_grand_cahier) :
 * applique TEMPORAIREMENT à la LIVE DOM les largeurs de colonnes prescrites
 * par `obtenirRepartitionColonnes(formatCahier, options.hauteurInterligne)`.
 * Ben Nadel analyse alors le texte avec le bon wrap → les `data-seyes-ligne`
 * correspondent aux lignes visuelles que le clone rendra réellement.
 *
 * Sans cet alignement live↔clone : Ben Nadel mesure sur la layout par défaut
 * (`adapteMargeCahierDeTexte(7)` = #page 8 carreaux), alors que le clone rend
 * à r.page carreaux (petit_cahier) → text re-wrappe différemment → masquage rate.
 *
 * La répartition est dynamique en fonction de l'interligne : à 2 mm le carreau
 * fait 8 mm × 15 = 120 mm (= cahier petit_cahier), à 4 mm le carreau fait
 * 16 mm × 7 = 112 mm (8 mm de marge à droite mais carreau exact à 16 mm).
 *
 * **NO-OP** si `!estCahierDeTextes()` ou `!options.formatCahier` ou format inconnu.
 *
 * @param {{formatCahier?: string|null, hauteurInterligne?: number|string}} options
 * @returns {Object|null} État pour restauration (à passer à
 *   `restaurerColonnesLive`), ou `null` si aucun ajustement appliqué.
 */
export function appliquerColonnesLive(options) {
	if (!estCahierDeTextes()) return null;
	const formatCahier = options && options.formatCahier;
	const interligneMm = options && options.hauteurInterligne;
	const r = obtenirRepartitionColonnes(formatCahier, interligneMm);
	if (!r) return null;

	const carreauPx = config.largeur_carreau;
	if (!(carreauPx > 0)) return null;

	const marge = document.getElementById("marge");
	const marge1 = document.getElementById("marge1");
	const marge2 = document.getElementById("marge2");
	const page = document.getElementById("page");

	// Sauvegarder l'état pour restauration.
	const etat = {
		marge: marge && { width: marge.style.width },
		marge1: marge1 && { width: marge1.style.width, flex: marge1.style.flex },
		marge2: marge2 && { width: marge2.style.width, display: marge2.style.display },
		page: page && { width: page.style.width },
	};

	// Appliquer la prescription cahier.
	const margeTotalPx = (r.marge1 + r.marge2) * carreauPx;
	if (marge) marge.style.width = `${margeTotalPx}px`;
	if (marge1) marge1.style.flex = `0 0 ${r.marge1 * carreauPx}px`;
	if (marge2) {
		marge2.style.display = "block";
		marge2.style.width = `${r.marge2 * carreauPx}px`;
	}
	if (page) page.style.width = `${r.page * carreauPx}px`;

	// Forcer un reflow synchrone pour que offsetWidth reflète les nouvelles valeurs.
	if (page) void page.offsetWidth;

	return etat;
}

/**
 * Restaure l'état des colonnes capturé par `appliquerColonnesLive`.
 * **NO-OP** si `etat` est `null` (cas non-cahier_de_textes).
 *
 * @param {Object|null} etat - Valeur retournée par `appliquerColonnesLive`.
 */
export function restaurerColonnesLive(etat) {
	if (!etat) return;
	const restore = (id, props) => {
		if (!props) return;
		const el = document.getElementById(id);
		if (!el) return;
		Object.entries(props).forEach(([k, v]) => {
			el.style[k] = v;
		});
	};
	restore("marge", etat.marge);
	restore("marge1", etat.marge1);
	restore("marge2", etat.marge2);
	restore("page", etat.page);
}

// ============================================================================
// Ajustements pagination + zone de capture (en aval des fonctions standard)
// ============================================================================

/**
 * Identité : retourne `configBase` tel quel.
 *
 * **Pourquoi cette fonction est-elle conservée ?** Compatibilité d'API : le
 * pipeline (`dialogue-pdf.mjs._captureAllPages`) appelle systématiquement
 * `ajusterPagination(_calculerPaginationAvecOptions())` sans branchement sur
 * le type de lignage. Garder un point d'extension nommé documente l'intention
 * (« ici on ajusterait la pagination si le lignage de type cahier_de_textes
 * en avait besoin ») et localise tout futur ajustement.
 *
 * **Pourquoi pas de soustraction ?** La formule de
 * `calculerPaginationAvecOptions` en mode mm est
 * `lignesParPage = floor(hauteurUtileMm / carreauMm − 1.5)` (Invariant 9).
 * Les 1.5 carreaux réservés couvrent : 1 carreau d'extension dynamique de
 * capture (worst-case pour `hauteurCaptureDynamique`) + 0.5 carreau de
 * jambages cursifs sous la dernière ligne. En config B, le header de 1
 * carreau composé en haut du body **prend la place** de l'extension dynamique
 * réservée — il ne demande pas de carreau supplémentaire. Composition
 * exacte = body (`lignesParPage × carreau + 0.5`) + header (1 × carreau)
 * = `(lignesParPage + 1.5) × carreau` = `cahier.hauteurMm`. Soustraire
 * provoque un double comptage : la composition devient trop courte d'un
 * carreau, la dernière ligne textuelle de chaque page est repoussée à la
 * page suivante, ses ascendantes/descendantes apparaissent sous le header
 * de la page suivante (bleed visible aux frontières de page).
 *
 * @param {Object} configBase - Sortie de `calculerPaginationAvecOptions`.
 * @returns {Object} `configBase` tel quel (identité).
 */
export function ajusterPagination(configBase) {
	return configBase;
}

/**
 * Si cahier_de_textes + format cahier : override `decalageX = 0` et
 * `largeur = (marge1+marge2+page) × carreau` pour capturer toute la largeur
 * du cahier (incluant matière+date), au lieu de skipper la marge Seyes comme
 * en mode cahier standard.
 *
 * Le nombre total de carreaux dépend de l'interligne (via
 * `obtenirRepartitionColonnes`) afin de préserver `carreau_imprime = 4 × interligne mm`
 * — cf. règle d'or précision (Invariants 1, 9, 10).
 *
 * **NO-OP** dans tous les autres cas (retourne `zoneBase` tel quel).
 *
 * @param {Object} zoneBase - Sortie de `calculerZoneCaptureAvecOptions`
 *   (champs `decalageX`, `largeur`, `decalageY`, `hauteur`, ...).
 * @param {{formatCahier?: string|null, hauteurInterligne?: number|string}} options
 * @param {number} largeurCarreauEcranPx
 * @returns {Object} Nouvelle zone (ou `zoneBase` si non-applicable).
 */
export function ajusterZoneCapture(zoneBase, options, largeurCarreauEcranPx) {
	if (!estCahierDeTextes()) return zoneBase;
	const formatCahier = options && options.formatCahier;
	const interligneMm = options && options.hauteurInterligne;
	const r = obtenirRepartitionColonnes(formatCahier, interligneMm);
	if (!r) return zoneBase;

	const totalCarreaux = r.marge1 + r.marge2 + r.page;
	return {
		...zoneBase,
		decalageX: 0,
		largeur: totalCarreaux * largeurCarreauEcranPx,
	};
}

// ============================================================================
// Capture header indépendante + composition post-capture
// ============================================================================

/**
 * Capture indépendante du `#entete` (header rouge MATIÈRE / POUR LE / jour)
 * via SnapDOM. Le `onclone` ajuste les colonnes pour matcher la largeur cible
 * et aligner les sous-colonnes (#case1, #case2, #case3) sur celles du corps.
 *
 * Cette fonction ne vérifie PAS `estCahierDeTextes()` : elle est appelée
 * uniquement depuis `composerHeaderSurPages` qui fait la garde.
 *
 * @private
 * @param {Object} options
 * @param {string|null} options.formatCahier
 * @param {number|string} options.interligneMm - hauteur d'interligne en mm, ou INTERLIGNE_VALEUR_ECRAN.
 * @param {number} options.carreauPx
 * @param {number} options.largeurCiblePx
 * @param {number} options.scaleDpi
 * @returns {Promise<HTMLCanvasElement|null>}
 */
async function _capturerHeader(options) {
	const enteteLive = document.getElementById("entete");
	if (!enteteLive) return null;

	const hauteurHeaderPx = HAUTEUR_HEADER_CARREAUX * options.carreauPx;
	const repartition = obtenirRepartitionColonnes(options.formatCahier, options.interligneMm);

	const resultat = await capturerAvecSnapDOM(enteteLive, {
		scale: options.scaleDpi,
		backgroundColor: COULEUR_FOND_CAPTURE,
		width: options.largeurCiblePx,
		height: hauteurHeaderPx,
		onclone: (documentClone) => {
			const enteteClone = documentClone.getElementById("entete");
			if (!enteteClone) return;

			enteteClone.style.setProperty("display", "flex", "important");
			enteteClone.style.setProperty("width", `${options.largeurCiblePx}px`, "important");
			enteteClone.style.setProperty("height", `${hauteurHeaderPx}px`, "important");
			enteteClone.style.setProperty("box-sizing", "border-box", "important");

			// MATIÈRE / POUR LE collés vers le bas (comportement Seyes écran).
			const hautMargeClone = enteteClone.querySelector("#haut-marge");
			const basMargeClone = enteteClone.querySelector("#bas-marge");
			const demiHauteurPx = hauteurHeaderPx / 2;
			if (hautMargeClone) {
				hautMargeClone.style.setProperty("height", `${demiHauteurPx}px`, "important");
				hautMargeClone.style.setProperty("flex-shrink", "0", "important");
			}
			if (basMargeClone) {
				basMargeClone.style.setProperty("height", `${demiHauteurPx}px`, "important");
				basMargeClone.style.setProperty("flex-shrink", "0", "important");
			}

			// Masquer le bouton de couleur (input type="color") inutile dans un PDF.
			const boutonCouleur = enteteClone.querySelector("#choix-couleur-entete");
			if (boutonCouleur) {
				boutonCouleur.style.setProperty("display", "none", "important");
			}

			// Format cahier : aligner #marge-entete et #case3 sur les ratios prescrits.
			if (repartition) {
				const margeEnteteClone = enteteClone.querySelector("#marge-entete");
				const case3Clone = enteteClone.querySelector("#case3");
				const case1Clone = enteteClone.querySelector("#case1");
				const case2Clone = enteteClone.querySelector("#case2");

				const margeEntetePx = (repartition.marge1 + repartition.marge2) * options.carreauPx;
				const case3Px = repartition.page * options.carreauPx;
				const case1Px = repartition.marge1 * options.carreauPx;
				const case2Px = repartition.marge2 * options.carreauPx;

				if (margeEnteteClone) {
					margeEnteteClone.style.setProperty("width", `${margeEntetePx}px`, "important");
					margeEnteteClone.style.setProperty("flex-shrink", "0", "important");
				}
				if (case3Clone) {
					case3Clone.style.setProperty("width", `${case3Px}px`, "important");
					case3Clone.style.setProperty("flex-shrink", "0", "important");
				}
				if (case1Clone) {
					case1Clone.style.setProperty("flex", `0 0 ${case1Px}px`, "important");
					case1Clone.style.setProperty("width", `${case1Px}px`, "important");
				}
				if (case2Clone) {
					case2Clone.style.setProperty("width", `${case2Px}px`, "important");
					case2Clone.style.setProperty("flex-shrink", "0", "important");
				}
			}
		},
	});

	return resultat && resultat.canvas ? resultat.canvas : null;
}

/**
 * Compose un canvas final = header en haut + body en dessous.
 * Exporté pour les tests unitaires.
 *
 * @param {HTMLCanvasElement|null} headerCanvas
 * @param {HTMLCanvasElement|null} bodyCanvas
 * @returns {HTMLCanvasElement} Canvas composite (ou l'un des deux si l'autre est null).
 */
export function composerHeaderEtBody(headerCanvas, bodyCanvas) {
	if (!headerCanvas) return bodyCanvas;
	if (!bodyCanvas) return headerCanvas;

	const largeurFinale = Math.max(headerCanvas.width, bodyCanvas.width);
	const ratioHeader = largeurFinale / headerCanvas.width;
	const ratioBody = largeurFinale / bodyCanvas.width;
	const hauteurHeader = Math.round(headerCanvas.height * ratioHeader);
	const hauteurBody = Math.round(bodyCanvas.height * ratioBody);
	const hauteurFinale = hauteurHeader + hauteurBody;

	const finalCanvas = document.createElement("canvas");
	finalCanvas.width = largeurFinale;
	finalCanvas.height = hauteurFinale;

	const ctx = finalCanvas.getContext("2d");
	ctx.drawImage(headerCanvas, 0, 0, largeurFinale, hauteurHeader);
	ctx.drawImage(bodyCanvas, 0, hauteurHeader, largeurFinale, hauteurBody);

	return finalCanvas;
}

/**
 * Si cahier_de_textes : capture le header une seule fois et le compose en
 * haut de chaque page du tableau `pages[]` (mute en place : `canvas`
 * remplacé par le composite, `svgUrl` régénéré depuis le composite).
 * Sinon : **NO-OP**.
 *
 * @param {Array<{canvas: HTMLCanvasElement, svgUrl?: string, sourceWidthPx?: number, height?: number}>} pages
 * @param {{formatCahier?: string|null}} options
 * @param {{largeur_carreau: number}} configSeyes
 * @param {{largeur: number}} dimensionsSortieMm - {largeur, hauteur} du PDF final en mm.
 * @returns {Promise<void>}
 */
export async function composerHeaderSurPages(pages, options, configSeyes, dimensionsSortieMm) {
	if (!estCahierDeTextes()) return;
	if (!pages || pages.length === 0) return;

	const carreauPx = Math.floor(configSeyes.largeur_carreau);
	if (!(carreauPx > 0)) return;

	// Largeur cible = largeur du body capturé (même pour toutes les pages).
	const ref = pages[0];
	const largeurBodySourcePx = ref.sourceWidthPx
		|| (ref.canvas && ref.canvas.width / ECHELLE_CANVAS_HTML);
	if (!(largeurBodySourcePx > 0)) return;

	const scaleDpi = calculerScaleDpi({
		widthMm: dimensionsSortieMm.largeur,
		cssWidthPx: largeurBodySourcePx,
	});

	const headerCanvas = await _capturerHeader({
		formatCahier: (options && options.formatCahier) || null,
		interligneMm: (options && options.hauteurInterligne),
		carreauPx,
		largeurCiblePx: largeurBodySourcePx,
		scaleDpi,
	});

	if (!headerCanvas) {
		journaliseur.avertir("CAHIER_DE_TEXTES", "Capture du header échouée — pages affichées sans header");
		return;
	}

	for (const page of pages) {
		if (!page.canvas) continue;
		const composite = composerHeaderEtBody(headerCanvas, page.canvas);
		page.canvas = composite;
		page.height = composite.height;
		// Régénère svgUrl pour que l'aperçu (consommé via <img src=>) reflète le composite.
		page.svgUrl = composite.toDataURL("image/png");
	}
}
