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

import {
	COULEUR_FOND_CAPTURE,
	HAUTEUR_A4_MM,
	LARGEUR_A4_MM,
	MARGE_PDF_MM,
	ORIENTATION_PORTRAIT,
	POURCENTAGE_DECALAGE_CAPTURE_SEYES,
} from "./constantes.mjs";
import { creerDocument, preparerImagePourPdf } from "./pdf-engine/index.mjs";
import { analyserLignesTexte } from "./analyseur-lignes.mjs";
import { calculerScaleDpi, capturerAvecSnapDOM } from "./capture-snapdom.mjs";
import { ErreurSeyes } from "./erreurs.mjs";
import { journaliseur } from "./journaliseur.mjs";
import { normaliserCSSPourCapture } from "./normalisation-css.mjs";
import { genererNomFichier, largeurCarreauNormalisee, obtenirConfigSeyes, stabiliserPolices } from "./utils.mjs";

/**
 * Générateur PDF Seyès avec masquage anti-coupure cursive et découpage canvas
 * optimisé (ratio A4 préservé).
 *
 * Pipeline :
 *   1. Stabilisation des polices (document.fonts.ready + reflow)
 *   2. Analyse Ben Nadel sur le DOM original
 *   3. Calcul de pagination Seyès mathématique (lignes par page en pixels)
 *   4. Mapping lignes Seyès → pages physiques
 *   5. Capture page par page avec masquage anti-coupure
 *   6. Assemblage via pdf-engine vendoré et sauvegarde
 */
export class GenerateurPDFSeyes {
	constructor() {
		this.estEnCourGeneration = false;
		this.modeDebugActive = false;
	}

	/**
	 * Initialisation : check compatibilité + badge visuel.
	 * @returns {Promise<boolean>}
	 */
	async initialiser() {
		try {
			journaliseur.info("INITIALISATION", "Initialisation du générateur PDF Seyès...");
			// Moteur PDF : pdf-engine vendoré (zéro dépendance tierce).
			journaliseur.info("INITIALISATION", "Générateur PDF Seyès initialisé avec succès");
			return true;
		} catch (erreur) {
			journaliseur.erreur("INITIALISATION", "Échec de l'initialisation", erreur);
			return false;
		}
	}

	/** @returns {GenerateurPDFSeyes} */
	activerModeDebug() {
		this.modeDebugActive = true;
		journaliseur.niveauActuel = journaliseur.niveaux.DEBUG;
		journaliseur.info("CONFIGURATION", "Mode debug activé");
		return this;
	}

	/** @returns {GenerateurPDFSeyes} */
	avecMarges(marges) {
		journaliseur.info("CONFIGURATION", `Marges configurées: ${marges}mm`);
		return this;
	}

	/** @returns {GenerateurPDFSeyes} */
	avecQualite(qualite) {
		journaliseur.info("CONFIGURATION", `Qualité configurée: ${qualite}`);
		return this;
	}

	/**
	 * Point d'entrée principal : orchestre le pipeline complet.
	 * @returns {Promise<void>}
	 */
	async genererPDF() {
		if (this.estEnCourGeneration) {
			journaliseur.avertir("GENERATION", "Génération déjà en cours, ignore la nouvelle demande");
			return;
		}
		this.estEnCourGeneration = true;

		try {
			journaliseur.demarrerSection("GÉNÉRATION PDF SEYÈS");
			await stabiliserPolices();

			const barreOutils = document.getElementById("barre");
			const barreEtaitMasquee = barreOutils && barreOutils.style.display === "none";
			if (barreOutils && !barreEtaitMasquee) {
				barreOutils.style.display = "none";
			}

			try {
				await this._creerPDFAvecBenNadel();
			} finally {
				if (barreOutils && !barreEtaitMasquee) {
					barreOutils.style.display = "";
				}
			}

			journaliseur.info("GENERATION", "PDF généré avec succès - technique Ben Nadel");
		} catch (erreur) {
			journaliseur.erreur("GENERATION", "Erreur lors de la génération PDF", erreur);
			throw erreur;
		} finally {
			this.estEnCourGeneration = false;
		}
	}

	/** @private */
	async _creerPDFAvecBenNadel() {
		const conteneur = document.getElementById("contenu");
		const element = document.getElementById("conteneur-extensible");
		const textePrincipal = document.getElementById("texte_principal");

		if (!conteneur || !element || !textePrincipal) {
			throw new ErreurSeyes("ELEMENTS_MANQUANTS", "Éléments Seyès requis non trouvés dans le DOM", {
				conteneur: !!conteneur,
				element: !!element,
				textePrincipal: !!textePrincipal,
			});
		}

		const scrollOriginal = conteneur.scrollTop;
		const htmlOriginal = textePrincipal.innerHTML;

		const pdf = creerDocument({
			orientation: ORIENTATION_PORTRAIT,
			formatMm: [LARGEUR_A4_MM, HAUTEUR_A4_MM],
		});

		try {
			journaliseur.demarrerSection("ANALYSE BEN NADEL (DOM ORIGINAL)");
			const analyseComplete = analyserLignesTexte(textePrincipal);

			journaliseur.demarrerSection("CALCUL PAGINATION SEYÈS");
			const configPagination = this._calculerPaginationSeyes();

			journaliseur.demarrerSection("MAPPING LIGNES → PAGES");
			const mappagePages = this._mapperLignesVersPages(analyseComplete, configPagination);

			journaliseur.demarrerSection("CAPTURE AVEC MASQUAGE");
			for (let indexPage = 0; indexPage < mappagePages.length; indexPage++) {
				await this._genererPageAvecMasquage(
					indexPage,
					mappagePages[indexPage],
					analyseComplete,
					configPagination,
					pdf,
					conteneur,
					element,
				);
			}

			const nomFichier = genererNomFichier();
			pdf.definirMetadonnees({
				title: nomFichier.replace(/\.pdf$/, ""),
				creator: "Seyes - Éducajou",
				author: "",
				creationDate: new Date(),
			});
			await pdf.sauvegarder(nomFichier);
			journaliseur.info("GENERATION", `PDF sauvegardé: ${nomFichier} (${pdf.getNombrePages()} pages)`);
		} finally {
			journaliseur.info("RESTAURATION", "Restauration DOM original...");
			textePrincipal.innerHTML = htmlOriginal;
			conteneur.scrollTop = scrollOriginal;
		}
	}

	/**
	 * Calcule la pagination Seyès mathématique pour impression A4.
	 * Préserve le ratio A4 exact et détermine le nombre de lignes par page
	 * en pixels canvas.
	 * @private
	 */
	_calculerPaginationSeyes() {
		journaliseur.info("PAGINATION", "Calcul pagination Seyès mathématique...");

		const configSeyes = obtenirConfigSeyes();
		const nombreCarreaux = configSeyes.nombreDeCarreaux;
		const largeurCarreauEcran = largeurCarreauNormalisee(configSeyes.largeur_carreau);
		const largeurMargeRouge = configSeyes.largeur_marge;

		journaliseur.debug("PAGINATION", "Variables Seyès:", {
			nombreDeCarreaux: nombreCarreaux,
			largeurCarreauEcran: largeurCarreauEcran + "px",
			largeurMargeRouge: largeurMargeRouge + "px",
		});

		// Ratio stable indépendant des marges PDF
		const largeurTotaleA4mm = LARGEUR_A4_MM;
		const ratioPixelVersMm = largeurTotaleA4mm / (largeurMargeRouge + largeurCarreauEcran * nombreCarreaux);
		const largeurMargeRougeMm = largeurMargeRouge * ratioPixelVersMm;

		const largeurImpressionMm = largeurTotaleA4mm - 2 * MARGE_PDF_MM;
		const largeurDisponibleCarreaux = largeurImpressionMm - largeurMargeRougeMm;
		const carreauImpressionMm = largeurDisponibleCarreaux / nombreCarreaux;

		journaliseur.debug("PAGINATION", "Calcul taille carreau:", {
			largeurTotaleA4: largeurTotaleA4mm + "mm",
			largeurImpression: largeurImpressionMm + "mm",
			margeRougeSeyes: largeurMargeRougeMm.toFixed(2) + "mm",
			largeurDisponible: largeurDisponibleCarreaux.toFixed(2) + "mm",
			tailleCarreau: carreauImpressionMm.toFixed(2) + "mm",
		});

		const element = document.getElementById("conteneur-extensible");
		const largeurContenu = element.offsetWidth;

		const ratioPxToMm = largeurContenu / largeurImpressionMm;
		const ratioA4 = HAUTEUR_A4_MM / LARGEUR_A4_MM;
		const hauteurCanvasRatioFidelePx = largeurContenu * ratioA4;

		// En Seyès, 1 ligne d'écriture = 1 carreau entier (ascendantes + minuscules +
		// jambages). N lignes = N × carreau exactement, sans marge descendantes extra.
		const lignesParPage = Math.floor(hauteurCanvasRatioFidelePx / largeurCarreauEcran);
		const hauteurCaptureBaseeNombreLignes = lignesParPage * largeurCarreauEcran;

		const ratioCapture = hauteurCaptureBaseeNombreLignes / largeurContenu;
		const ecartRatioA4 = Math.abs(ratioCapture - ratioA4);
		const respecteRatioA4 = ecartRatioA4 < 0.01;

		const hauteurDisponibleMm = HAUTEUR_A4_MM - 2 * MARGE_PDF_MM;

		journaliseur.info("PAGINATION", "Résultats calculs:", {
			hauteurDisponible: hauteurDisponibleMm + "mm",
			hauteurCanvasRatioFidele: hauteurCanvasRatioFidelePx.toFixed(0) + "px",
			tailleCarreauEcran: largeurCarreauEcran + "px",
			lignesParPage,
			hauteurCaptureNombreLignes: hauteurCaptureBaseeNombreLignes.toFixed(0) + "px",
			ratioCapture: ratioCapture.toFixed(3),
			ratioA4Theorique: ratioA4.toFixed(3),
			respecteRatioA4: respecteRatioA4 ? "✅" : "❌",
			ecartRatio: (ecartRatioA4 * 100).toFixed(2) + "%",
		});

		if (!respecteRatioA4) {
			journaliseur.avertir("PAGINATION", `Écart ratio A4 détecté: ${(ecartRatioA4 * 100).toFixed(2)}% (>1%)`);
		}

		return {
			carreauMm: carreauImpressionMm,
			lignesParPage,
			hauteurPageMm: hauteurDisponibleMm,
			hauteurCanvasOptimalePx: hauteurCanvasRatioFidelePx,
			ratioPxToMm,
			largeurCarreauEcranPx: largeurCarreauEcran,
			hauteurCaptureBaseeNombreLignes,
			hauteurCanvasRatioA4: hauteurCanvasRatioFidelePx,
		};
	}

	/** @private */
	_mapperLignesVersPages(analyseComplete, configPagination) {
		journaliseur.info("MAPPING_PAGES", "Mapping lignes Seyès → pages physiques...");

		const { mappageLignes } = analyseComplete;
		const { lignesParPage } = configPagination;

		const totalLignesSeyes =
			mappageLignes.length > 0 ? Math.max(...mappageLignes.map((ligne) => ligne.ligneSeyes)) : 0;

		journaliseur.debug(
			"MAPPING_PAGES",
			`Total lignes Seyès: ${totalLignesSeyes} (vs ${analyseComplete.lignesVisuelles.length} visuelles)`,
		);

		const pages = [];
		let ligneActuelle = 1;

		while (ligneActuelle <= totalLignesSeyes) {
			const lignesRestantes = totalLignesSeyes - ligneActuelle + 1;
			const lignesDansCettePage = Math.min(lignesParPage, lignesRestantes);
			const premiereLigneSeyes = ligneActuelle;
			const derniereLigneSeyes = ligneActuelle + lignesDansCettePage - 1;

			pages.push({
				numeroPage: pages.length + 1,
				premiereLigneSeyes,
				derniereLigneSeyes,
				nombreLignes: lignesDansCettePage,
				estDernierePage: ligneActuelle + lignesDansCettePage > totalLignesSeyes,
			});

			journaliseur.debug(
				"MAPPING_PAGES",
				`Page ${pages.length}: lignes Seyès ${premiereLigneSeyes}-${derniereLigneSeyes} (${lignesDansCettePage} lignes)`,
			);
			ligneActuelle += lignesDansCettePage;
		}

		return pages;
	}

	/** @private */
	_seyesVersLigneVisuelle(indexSeyes, mappageLignes) {
		const ligneCorrespondante = mappageLignes.find((ligne) => ligne.ligneSeyes === indexSeyes);

		if (ligneCorrespondante) {
			return {
				existe: true,
				indexVisuel: ligneCorrespondante.indexVisuel,
				positionY: ligneCorrespondante.positionY,
				noeudTexte: ligneCorrespondante.noeudTexte,
				indexDebut: ligneCorrespondante.indexDebut,
				indexFin: ligneCorrespondante.indexFin,
			};
		}
		return { existe: false, indexVisuel: -1, positionY: null };
	}

	/** @private */
	async _genererPageAvecMasquage(indexPage, infosPage, analyseComplete, configPagination, pdf, conteneur, element) {
		journaliseur.info(
			"CAPTURE",
			`Génération page ${indexPage + 1}/${infosPage.numeroPage} (lignes Seyès ${infosPage.premiereLigneSeyes}-${infosPage.derniereLigneSeyes})`,
		);

		const lignesAMasquer = this._calculerLignesAMasquer(indexPage, infosPage, analyseComplete);
		const infoCapture = this._calculerZoneCapture(infosPage, analyseComplete, configPagination);
		conteneur.scrollTop = infoCapture.positionScroll;

		journaliseur.debug("CAPTURE", "Configuration capture:", {
			scroll: infoCapture.positionScroll + "px",
			zone: `${infoCapture.largeur}x${infoCapture.hauteur}px`,
			decalageY: infoCapture.decalageY + "px",
		});

		// Stabilisation prise en charge par capturerAvecSnapDOM (fonts.ready +
		// double rAF + offsetHeight) juste avant snapdom.toCanvas.

		// Scale dynamique 300 DPI ; chemin "simple" utilise A4 portrait.
		const scaleDpi = calculerScaleDpi({
			widthMm: LARGEUR_A4_MM,
			cssWidthPx: infoCapture.largeur,
		});
		const resultatCapture = await capturerAvecSnapDOM(element, {
			scale: scaleDpi,
			backgroundColor: COULEUR_FOND_CAPTURE,
			height: infoCapture.hauteur,
			width: infoCapture.largeur,
			y: infoCapture.decalageY,
			onclone: (documentClone) => {
				normaliserCSSPourCapture(documentClone);
				this._appliquerMasquageLignes(documentClone, lignesAMasquer);
			},
		});
		const canvas = resultatCapture.canvas;

		journaliseur.debug("CAPTURE", `Canvas capturé: ${canvas.width}x${canvas.height}px`);

		if (indexPage > 0) {
			pdf.ajouterPage({
				formatMm: [LARGEUR_A4_MM, HAUTEUR_A4_MM],
				orientation: ORIENTATION_PORTRAIT,
			});
		}

		const largeurPDF = LARGEUR_A4_MM;
		const hauteurPDF = HAUTEUR_A4_MM;
		const largeurImage = largeurPDF - 2 * MARGE_PDF_MM;
		const ratioA4 = hauteurPDF / largeurPDF;
		const hauteurImage = largeurImage * ratioA4;
		const hauteurDisponible = hauteurPDF - 2 * MARGE_PDF_MM;
		const margeVerticaleAjustee = MARGE_PDF_MM + (hauteurDisponible - hauteurImage) / 2;

		const preparee = await preparerImagePourPdf(canvas);
		pdf.ajouterImage({
			image: preparee,
			xMm: MARGE_PDF_MM,
			yMm: margeVerticaleAjustee,
			wMm: largeurImage,
			hMm: hauteurImage,
		});

		journaliseur.info("CAPTURE", `Page ${indexPage + 1} ajoutée au PDF`);
	}

	/** @private */
	_calculerZoneCapture(infosPage, analyseComplete, configPagination) {
		const element = document.getElementById("conteneur-extensible");
		const largeurContenu = element.offsetWidth;

		journaliseur.debug(
			"ZONE_CAPTURE",
			`Calcul zone capture optimisée pour page Seyès ${infosPage.premiereLigneSeyes}-${infosPage.derniereLigneSeyes}`,
		);

		const premiereLigneVisuelle = this._seyesVersLigneVisuelle(
			infosPage.premiereLigneSeyes,
			analyseComplete.mappageLignes,
		);

		let decalageY;
		if (!premiereLigneVisuelle.existe) {
			journaliseur.avertir(
				"ZONE_CAPTURE",
				`Première ligne Seyès ${infosPage.premiereLigneSeyes} ne correspond à aucune ligne visuelle`,
			);
			const premiereLigneDisponible = analyseComplete.lignesVisuelles[0];
			decalageY = Math.max(0, premiereLigneDisponible.positionY);
		} else {
			const ligneVisuelle = analyseComplete.lignesVisuelles[premiereLigneVisuelle.indexVisuel];
			const carreauImpressionMm = configPagination.carreauMm;
			const largeurCarreauEcranPx = configPagination.largeurCarreauEcranPx;
			const ratioMmVersPixel = largeurCarreauEcranPx / carreauImpressionMm;
			const offsetSuperieurPx = carreauImpressionMm * POURCENTAGE_DECALAGE_CAPTURE_SEYES * ratioMmVersPixel;

			decalageY = Math.max(0, ligneVisuelle.positionY - offsetSuperieurPx);

			journaliseur.debug(
				"ZONE_CAPTURE",
				`Première ligne Seyès ${infosPage.premiereLigneSeyes} → visuelle ${premiereLigneVisuelle.indexVisuel}`,
				{
					positionY: ligneVisuelle.positionY + "px",
					offsetSuperieur: offsetSuperieurPx.toFixed(1) + "px",
					decalageY: decalageY + "px",
				},
			);
		}

		const hauteurPageBaseeNombreLignes = configPagination.hauteurCaptureBaseeNombreLignes;
		const hauteurCanvasRatioA4 = configPagination.hauteurCanvasRatioA4;
		const ecartHauteur = hauteurCanvasRatioA4 - hauteurPageBaseeNombreLignes;
		const ratioCapture = hauteurPageBaseeNombreLignes / largeurContenu;
		const ratioA4Theorique = HAUTEUR_A4_MM / LARGEUR_A4_MM;

		journaliseur.info("ZONE_CAPTURE", "Zone de capture basée nombre de lignes:", {
			largeur: largeurContenu + "px",
			hauteurBaseeNombreLignes: hauteurPageBaseeNombreLignes.toFixed(0) + "px",
			hauteurRatioA4Theorique: hauteurCanvasRatioA4.toFixed(0) + "px",
			ecartHauteur:
				ecartHauteur.toFixed(0) +
				"px (" +
				((ecartHauteur / hauteurCanvasRatioA4) * 100).toFixed(1) +
				"%)",
			decalageY: Math.round(decalageY) + "px",
			lignesParPage: configPagination.lignesParPage,
			ratioCapture: ratioCapture.toFixed(3),
			ratioA4Reference: ratioA4Theorique.toFixed(3),
			respecteRatio: Math.abs(ratioCapture - ratioA4Theorique) < 0.01 ? "✅" : "⚠️",
		});

		return {
			largeur: largeurContenu,
			hauteur: Math.round(hauteurPageBaseeNombreLignes),
			decalageY: Math.round(decalageY),
			positionScroll: 0,
		};
	}

	/** @private */
	_calculerLignesAMasquer(indexPage, infosPage, analyseComplete) {
		const lignesAMasquer = [];

		journaliseur.debug("MASQUAGE", `Calcul masquage pour page ${indexPage + 1}:`, {
			pageSeyes: `lignes ${infosPage.premiereLigneSeyes}-${infosPage.derniereLigneSeyes}`,
			estPremierePage: indexPage === 0,
			estDernierePage: infosPage.estDernierePage,
		});

		// Règle 1 : pages 2+ masquent la ligne précédente (descendantes)
		if (indexPage > 0 && infosPage.premiereLigneSeyes > 1) {
			const ligneSeyesAMasquer = infosPage.premiereLigneSeyes - 1;
			const ligneVisuelle = this._seyesVersLigneVisuelle(ligneSeyesAMasquer, analyseComplete.mappageLignes);

			if (ligneVisuelle.existe) {
				lignesAMasquer.push({
					indexSeyes: ligneSeyesAMasquer,
					indexVisuel: ligneVisuelle.indexVisuel,
					type: "precedente",
					raison: "descendantes de la ligne précédente",
				});
				journaliseur.debug(
					"MASQUAGE",
					`Masquer ligne Seyès ${ligneSeyesAMasquer} (visuelle ${ligneVisuelle.indexVisuel}) - descendantes`,
				);
			}
		}

		// Règle 2 : pages hors-dernière masquent la ligne suivante (ascendantes)
		if (!infosPage.estDernierePage) {
			const totalLignesSeyes = Math.max(...analyseComplete.mappageLignes.map((l) => l.ligneSeyes));
			const ligneSeyesAMasquer = infosPage.derniereLigneSeyes + 1;

			if (ligneSeyesAMasquer <= totalLignesSeyes) {
				const ligneVisuelle = this._seyesVersLigneVisuelle(ligneSeyesAMasquer, analyseComplete.mappageLignes);

				if (ligneVisuelle.existe) {
					lignesAMasquer.push({
						indexSeyes: ligneSeyesAMasquer,
						indexVisuel: ligneVisuelle.indexVisuel,
						type: "suivante",
						raison: "ascendantes de la ligne suivante",
					});
					journaliseur.debug(
						"MASQUAGE",
						`Masquer ligne Seyès ${ligneSeyesAMasquer} (visuelle ${ligneVisuelle.indexVisuel}) - ascendantes`,
					);
				}
			}
		}

		journaliseur.info("MASQUAGE", `Total lignes à masquer: ${lignesAMasquer.length}`);
		return lignesAMasquer;
	}

	/** @private */
	_appliquerMasquageLignes(documentClone, lignesAMasquer) {
		journaliseur.debug("MASQUAGE", `Application masquage anti-coupure (${lignesAMasquer.length} lignes)...`);

		lignesAMasquer.forEach((ligneAMasquer) => {
			const elementsAMasquer = documentClone.querySelectorAll(`[data-seyes-ligne="${ligneAMasquer.indexVisuel}"]`);

			journaliseur.debug(
				"MASQUAGE",
				`Masquage ligne Seyès ${ligneAMasquer.indexSeyes} (visuelle ${ligneAMasquer.indexVisuel}): ${elementsAMasquer.length} éléments (${ligneAMasquer.raison})`,
			);

			elementsAMasquer.forEach((el) => {
				// visibility:hidden préserve l'espace (display:none recasserait la mise en page)
				el.style.visibility = "hidden";
				journaliseur.debug("MASQUAGE", `→ Masqué: "${el.getAttribute("data-seyes-ligne-contenu")}..."`);
			});
		});
	}
}
