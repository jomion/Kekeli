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
 * Constantes de la feature PDF.
 *
 * Centralise les paramètres immutables consommés par plusieurs modules PDF :
 * formats de papier/cahier, matrices de compatibilité, seuils de rendu,
 * polices locales et niveaux de log.
 *
 * Aucune dépendance runtime.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Paramètres d'impression
// ═══════════════════════════════════════════════════════════════════════════

export const MARGE_PDF_MM = 20; // Marges PDF en millimètres (2 cm)
export const LARGEUR_A4_MM = 210;
export const HAUTEUR_A4_MM = 297;
export const FORMAT_A4 = "a4";
export const ORIENTATION_PORTRAIT = "portrait";

// ═══════════════════════════════════════════════════════════════════════════
// Formats de papier et de cahier
// ═══════════════════════════════════════════════════════════════════════════

export const FORMATS_PAPIER = {
	a3: { largeur: 297, hauteur: 420 },
	a4: { largeur: 210, hauteur: 297 },
	a5: { largeur: 148, hauteur: 210 },
};

export const BLEED_MM = 0.25;

/**
 * Formats de cahiers scolaires français avec bleed de 0.25 mm.
 * Dimensions finales : petit 120.5×188.5, grand A4 160.5×260.5,
 * très grand 192.5×284.5 mm.
 *
 * La compatibilité papier n'est PAS une matrice statique : elle est évaluée
 * dynamiquement par `evaluerCompatibilite` (geometrie-dom-live.mjs) à partir
 * de la dimension RÉELLE de l'image imprimée (qui dépend de l'interligne)
 * contre les dimensions BRUTES de la feuille choisie. Seul cap dur : image
 * plus grande que la feuille → option grisée. Sinon l'option reste activée,
 * et les marges configurées par l'utilisateur sont indicatives (warning si
 * dépassement).
 */
export const FORMATS_CAHIER = {
	petit_cahier: {
		label: "Petit cahier (17×22 cm)",
		carreaux: 15,
		lignes: 22,
		largeurMm: 120 + (2 * BLEED_MM),
		hauteurMm: 188 + (2 * BLEED_MM),
	},
	grand_cahier_a4: {
		label: "Grand cahier A4 (21×29,7 cm)",
		carreaux: 20,
		lignes: 31,
		largeurMm: 160 + (2 * BLEED_MM),
		hauteurMm: 260 + (2 * BLEED_MM),
	},
	tres_grand_cahier: {
		label: "Très grand cahier (24×32 cm)",
		carreaux: 24,
		lignes: 34,
		largeurMm: 192 + (2 * BLEED_MM),
		hauteurMm: 284 + (2 * BLEED_MM),
	},
};

/**
 * Espacement entre deux pages côte-à-côte (ou empilées) sur une feuille
 * en mode 2 pages par feuille. En mm.
 *
 * Utilisé par `calculerPositionsDeuxPages` (pagination-options.mjs) pour
 * positionner les deux cahiers, et par `evaluerCompatibilite`
 * (geometrie-dom-live.mjs) pour calculer l'encombrement total.
 */
export const ESPACEMENT_DEUX_PAGES_MM = 2;

// ═══════════════════════════════════════════════════════════════════════════
// Paramètres Seyès
// ═══════════════════════════════════════════════════════════════════════════

export const POURCENTAGE_DECALAGE_CAPTURE_SEYES = 0.25; // 25 % décalage capture vers le haut
export const RATIO_ESPACE_VIDE_CORRECTION = 0.3; // Correction calcul lignes vides

/**
 * Hauteurs d'interligne (rail d'écriture) proposées dans l'export PDF, en mm.
 * 2 mm = Seyès standard. 3-5 mm = cahiers CP/maternelle à rail élargi.
 * Invariant : carreau carré = 4 × interligne.
 *
 * `INTERLIGNE_VALEUR_ECRAN` (string sentinelle) est une valeur distincte qui
 * signale "adopter le nombre de carreaux affiché dans la barre principale
 * (carreau déduit de cahier.largeurMm ou largeurPageMm)" au lieu d'imposer
 * une hauteur d'interligne en mm. Utilisée comme option "Comme à l'écran"
 * dans le select du dialogue PDF.
 */
export const INTERLIGNES_DISPONIBLES = [2, 2.5, 3, 3.5, 4, 4.5, 5];
export const INTERLIGNE_VALEUR_ECRAN = "ecran";
export const INTERLIGNE_DEFAUT = 2;

/**
 * Identifiant du wrapper DOM utilisé pendant la capture SnapDOM (placé hors
 * écran dans `document.body`). Sert à SCOPER les règles CSS injectées dans
 * ce wrapper (`* { transition: none !important; animation: none !important }`)
 * afin qu'elles n'affectent PAS le reste du document (notamment les spinners
 * de chargement, dont l'animation CSS serait sinon désactivée pendant toute
 * la durée de la capture). Cf. invariant 6 de seyes-pdf-guard.
 */
export const ID_WRAPPER_CAPTURE = "__seyes-pdf-capture-wrapper";

// ═══════════════════════════════════════════════════════════════════════════
// Persistence des options utilisateur
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clé localStorage pour la persistence des options du dialogue PDF
 * (format cahier, orientation, papier, pages/feuille, marges, interligne).
 */
export const CLE_STOCKAGE_OPTIONS_PDF = "SEYES_PDF_OPTIONS";

// ═══════════════════════════════════════════════════════════════════════════
// Seuils de détection et délais
// ═══════════════════════════════════════════════════════════════════════════

export const SEUIL_LIGNE_VIDE_POURCENTAGE = 0.7; // 70 % du carreau = seuil ligne vide
export const DELAI_STABILISATION_POLICES_MS = 300;
export const DELAI_CAPTURE_PAGE_MS = 500;

// ═══════════════════════════════════════════════════════════════════════════
// Qualité de rendu
// ═══════════════════════════════════════════════════════════════════════════

export const ECHELLE_CANVAS_HTML = 1.5;
export const QUALITE_JPEG_PDF = 0.95;
export const COULEUR_FOND_CAPTURE = "#ffffff";

/**
 * DPI cible pour la rasterisation SnapDOM → PDF.
 *
 * 300 DPI = qualité impression pro (A4 210 mm → 2480 px, A3 297 → 3508 px,
 * A5 148 → 1748 px). Le scale SnapDOM est calculé dynamiquement depuis la
 * largeur mm finale et la largeur CSS de la capture pour obtenir cette
 * densité, indépendamment du `devicePixelRatio` du périphérique.
 *
 * Borné par SCALE_CAPTURE_MIN / MAX pour éviter les valeurs extrêmes sur
 * viewports responsive (petit écran mobile où cssWidthPx ~ 320 donnerait
 * scale ~ 7 sans bornage).
 */
export const DPI_CIBLE_PDF = 300;
export const SCALE_CAPTURE_MIN = 1;
export const SCALE_CAPTURE_MAX = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Polices
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Polices cursives nécessitant un masquage anti-coupure pendant la capture.
 * Doit être tenu synchrone avec les @font-face de web/css/styles.css.
 */
export const POLICES_CURSIVES = [
	"Marelle",
	"Marelle Bâton",
	"AA Cursive",
	"Acceseditionscursive",
];

/**
 * Polices locales embarquées par SnapDOM dans la capture canvas.
 * INVARIANT (seyes-pdf-guard) : chaque entrée doit pointer sur un fichier
 * réellement présent dans web/polices/.
 */
export const POLICES_LOCALES = [
	{ family: "Marelle", src: "polices/Marelle-Regular.woff2" },
	{ family: "Marelle Bâton", src: "polices/MarelleBaton-Regular.woff2" },
	{ family: "AA Cursive", src: "polices/ABcursive-Bold.woff2" },
	{ family: "Open Dyslexic", src: "polices/OpenDyslexic-Regular.woff2" },
	{ family: "Luciole", src: "polices/Luciole-Regular.woff2" },
	{ family: "Romain", src: "polices/EcritureA-Romain.woff2" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Système de logging
// ═══════════════════════════════════════════════════════════════════════════

export const NIVEAUX_LOG = {
	OFF: -1,
	DEBUG: 0,
	INFO: 1,
	AVERTISSEMENT: 2,
	ERREUR: 3,
};

/**
 * Niveau de log courant, lu depuis localStorage au chargement.
 * Pour activer le debug :
 *   localStorage.setItem("SEYES_PDF_LOG_LEVEL", "DEBUG")
 *   location.reload()
 */
export const NIVEAU_LOG_ACTUEL = (() => {
	try {
		const niveauStocke = localStorage.getItem("SEYES_PDF_LOG_LEVEL");
		if (niveauStocke && NIVEAUX_LOG[niveauStocke] !== undefined) {
			return NIVEAUX_LOG[niveauStocke];
		}
		// eslint-disable-next-line no-unused-vars
	} catch (e) {
		// localStorage indisponible (mode privé, etc.)
	}
	return NIVEAUX_LOG.AVERTISSEMENT;
})();
