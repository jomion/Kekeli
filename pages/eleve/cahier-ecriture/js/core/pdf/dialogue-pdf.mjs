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
	ECHELLE_CANVAS_HTML,
	FORMATS_CAHIER,
	FORMATS_PAPIER,
	INTERLIGNES_DISPONIBLES,
	INTERLIGNE_DEFAUT,
	INTERLIGNE_VALEUR_ECRAN,
} from "./constantes.mjs";
import { marquerFondInert, piegerFocus } from "./a11y.mjs";
import { analyserLignesTexte } from "./analyseur-lignes.mjs";
import { calculerScaleDpi, capturerAvecSnapDOM } from "./capture-snapdom.mjs";
import { GenerateurPDFSeyes } from "./generateur-pdf.mjs";
import { journaliseur } from "./journaliseur.mjs";
import { normaliserCSSPourCapture } from "./normalisation-css.mjs";
import {
	calculerDimensionsSortie,
	calculerLargeurNaturelleMm,
	calculerLignesAMasquerPourPage,
	calculerPaginationAvecOptions,
	calculerPositionnementImage,
	calculerPositionsDeuxPages,
	calculerZoneCaptureAvecOptions,
	mapperLignesVersPagesAvecOptions,
	seyesVersVisuelleExact,
	seyesVersVisuellePlusProche,
} from "./pagination-options.mjs";
import {
	basculerMarges as basculerMargesFn,
	basculerMargesSelect as basculerMargesSelectFn,
	lireMargesPersonnalisees,
	validerMarge as validerMargeFn,
} from "./gestion-marges.mjs";
import {
	calculerNombreCarreauxPourGeometrie,
	evaluerCompatibilite,
	filtrerFormatPapierSelonCahier,
	filtrerOrientationsSelonCahier,
	filtrerPagesParFeuilleSelonCahier,
} from "./geometrie-dom-live.mjs";
import { appliquerMasquageLignesDansClone } from "./apercu-pdf.mjs";
import {
    ajusterPagination,
    ajusterZoneCapture,
    appliquerColonnesLive,
    composerHeaderSurPages,
    estCahierDeTextes,
    restaurerColonnesLive,
} from "./cahier-de-textes-pdf.mjs";
import {
	genererPDF2PagesParFeuille,
	genererPDFSimple,
} from "./export-pdf.mjs";
import { creerDocument } from "./pdf-engine/index.mjs";
import { genererNomFichierDefaut, validerNomFichier } from "./validation-nom-fichier.mjs";
import {
	attendreLayoutStable,
	attendreReglureChargee,
	chargerOptionsPDF,
	obtenirConfigSeyes,
	sauvegarderOptionsPDF,
	stabiliserPolices,
} from "./utils.mjs";

/**
 * Dialogue de configuration d'export PDF (classe DialoguePdf).
 *
 * Orchestrateur du flux UI : affiche une fenêtre modale avec aperçu fidèle
 * des pages (gauche) et options d'export (droite) — format cahier,
 * orientation, format papier, pages par feuille, marges, nom de fichier.
 *
 * Architecture post-refactoring (plan `tu-ne-dois-travailler-crystalline-sonnet.md`) :
 * la classe est un **orchestrateur mince** qui conserve l'état mutable
 * (`this.options`, `this.pagesApercu`, `this.pageActuelle`, `this.divDialogue`,
 * `this.generationEnCours`, caches d'aperçu + capture→export, hooks a11y)
 * et délègue la logique métier à 6 modules domaine :
 *
 * - [./validation-nom-fichier.mjs](./validation-nom-fichier.mjs) : génération/validation du nom.
 * - [./pagination-options.mjs](./pagination-options.mjs) : 9 fonctions pures de calcul
 *   pagination/zone/positionnement (Invariant seyes-pdf-guard #5).
 * - [./gestion-marges.mjs](./gestion-marges.mjs) : DOM-adapters des marges personnalisées.
 * - [./geometrie-dom-live.mjs](./geometrie-dom-live.mjs) : calcul nombre de carreaux
 *   + filtrage orientations selon cahier.
 * - [./apercu-pdf.mjs](./apercu-pdf.mjs) : combinaison 2-pages-par-feuille + masquage
 *   anti-coupure cursive dans le clone.
 * - [./export-pdf.mjs](./export-pdf.mjs) : remplissage final du document pdf-engine.
 *
 * Les méthodes publiques `fermer`, `pagePrecedente`, `pageSuivante`,
 * `basculerModeFocus`, `changerHauteurInterligne`, `changerFormatCahier`,
 * `majOptions`, `basculerMargesSelect`, `validerMarge`, `exporterPDF`
 * sont exposées via `window.pdfDialogue` pour les handlers HTML inline du
 * template (onclick=..., onchange=...). À ne **pas** renommer.
 *
 * Exception ES aux conventions upstream : classe justifiée par l'encapsulation
 * d'un état complexe et de nombreuses méthodes interdépendantes.
 *
 * Exports complémentaires :
 * - `ouvrirDialoguePdf()` : point d'entrée attaché au bouton #export-pdf.
 * - `initDialoguePdf()` : instanciation unique + attachement window.pdfDialogue.
 */


// Singleton du générateur, initialisé par initDialoguePdf() ; lu par
// les méthodes de DialoguePdf lorsqu'elles orchestrent l'aperçu et l'export.
let _generateurSingleton = null;

export class DialoguePdf {
    constructor() {
        this.options = {
            formatCahier: null,
            orientation: "portrait",
            formatPapier: "a4",
            pagesParFeuille: 1,
            marges: { haut: 20, bas: 20, gauche: 20, droite: 20 },
            hauteurInterligne: INTERLIGNE_DEFAUT,
        };

        // Fusionne les options persistées (si valides) sur les defaults.
        // Chaque champ est validé contre son domaine — defense-in-depth au cas
        // où les données stockées seraient obsolètes (feature évoluée, etc.).
        this._mergerOptionsPersistees(chargerOptionsPDF());
        this.pagesApercu = [];
        this.pageActuelle = 0;
        this.generationEnCours = false;
        this.divDialogue = null;
        // Sauvegarde du nombre de carreaux original pour restauration
        this._nombreCarreauxOriginal = null;
        // Cache pages entre l'aperçu et l'export : le dialogue étant modal
        // (fond `inert`), le DOM du texte ne change pas pendant la session,
        // on peut réutiliser directement les canvases. Le hash des options
        // pertinentes (formatCahier, orientation, pagesParFeuille,
        // hauteurInterligne) invalide le cache lors d'un changement. Cf.
        // plan [plans/plan-pdf-engine-png-cache.md](../../../../plans/plan-pdf-engine-png-cache.md).
        this._cachePages = null;
        this._cacheOptionsHash = null;
    }

    /**
     * Empreinte des options qui impactent la capture/rasterisation.
     * Les marges et le nom de fichier n'affectent pas les canvases.
     * @private
     */
    _hashOptionsCapture() {
        const o = this.options || {};
        return `${o.formatCahier || ""}|${o.formatPapier || ""}|${o.orientation || ""}|${o.pagesParFeuille || ""}|${o.hauteurInterligne || ""}`;
    }

    /**
     * Vide le cache capture→export. Appelé à l'entrée de `majOptions` et
     * de chaque setter de géométrie, et au début de `_genererApercu` (le
     * nouvel aperçu devient lui-même le cache).
     * @private
     */
    _invaliderCachePages() {
        this._cachePages = null;
        this._cacheOptionsHash = null;
    }

    /**
     * Ouvre le dialogue d'export PDF
     */
    async ouvrir() {
        if (this.generationEnCours) return;

        // Sauvegarder le nombre de carreaux original pour restauration
        const inputCarreaux = document.getElementById("inputNombreDeCarreaux");
        if (inputCarreaux) {
            this._nombreCarreauxOriginal = parseInt(inputCarreaux.value, 10);
        }

        // Créer le dialogue HTML s'il n'existe pas
        if (!this.divDialogue) {
            this._creerDialogueHTML();
        }

        // Réinitialiser les options
        this._reinitialiserOptions();

        // Initialiser le nom de fichier par défaut
        const inputNom = document.getElementById("nom-fichier-pdf");
        if (inputNom) {
            inputNom.value = this._genererNomFichierDefaut();
        }

        // Afficher le dialogue
        this.divDialogue.classList.remove("hide");
        const darkbox = document.getElementById("darkbox");
        if (darkbox) darkbox.classList.remove("hide");

        // A11y : sauvegarder l'élément qui a ouvert le dialogue pour restaurer
        // le focus à la fermeture (pattern WAI-ARIA dialog-modal).
        this._elementOuverture = document.activeElement;

        // A11y : marquer le reste de la page inert et piéger le focus dans le
        // dialogue (Tab cycle + Escape ferme). Cf. `./a11y.mjs`.
        const exemptionsInert = [this.divDialogue];
        if (darkbox) exemptionsInert.push(darkbox);
        this._restaurerFond = marquerFondInert(exemptionsInert);
        this._nettoyerFocusTrap = piegerFocus(this.divDialogue, {
            onEscape: () => this.fermer(),
        });

        // Focus initial sur le titre (tabindex="-1") pour que les lecteurs
        // d'écran annoncent le dialogue avant d'explorer son contenu.
        const titre = document.getElementById("pdf-dialog-title");
        if (titre) titre.focus();

        // Écouter scroll/resize pour positionner dynamiquement les boutons nav
        // en mode responsive (ils suivent le centre vertical visible de la zone
        // d'aperçu et disparaissent si elle sort du viewport).
        //
        // L'event "scroll" NE BULLE PAS : il faut soit écouter sur chaque
        // conteneur scrollable (window, #divDialoguePDF, .dialogue-pdf-options,
        // etc.), soit utiliser capture:true qui intercepte tous les scroll
        // events à la phase de capture, peu importe leur origine. La 2e
        // approche est plus robuste car on n'a pas à connaître à l'avance
        // tous les conteneurs scrollables.
        this._positionnerNavHandler = () => this._positionnerNavigationResponsive();
        document.addEventListener("scroll", this._positionnerNavHandler, {
            passive: true,
            capture: true,
        });
        window.addEventListener("resize", this._positionnerNavHandler);
        // Premier calcul asynchrone pour laisser le dialogue se rendre.
        setTimeout(this._positionnerNavHandler, 0);

        // Générer l'aperçu
        await this._genererApercu();
    }

    /**
     * Ferme le dialogue
     */
    fermer() {
        // Restaurer le nombre de carreaux original
        this._restaurerNombreCarreaux();

        if (this.divDialogue) {
            this.divDialogue.classList.add("hide");
        }
        const darkbox = document.getElementById("darkbox");
        if (darkbox) darkbox.classList.add("hide");

        // Détacher les écouteurs scroll/resize du positionnement nav responsive.
        if (this._positionnerNavHandler) {
            document.removeEventListener("scroll", this._positionnerNavHandler, { capture: true });
            window.removeEventListener("resize", this._positionnerNavHandler);
            this._positionnerNavHandler = null;
        }

        // A11y : retirer le focus trap et l'inert du fond.
        if (this._nettoyerFocusTrap) {
            this._nettoyerFocusTrap();
            this._nettoyerFocusTrap = null;
        }
        if (this._restaurerFond) {
            this._restaurerFond();
            this._restaurerFond = null;
        }

        // A11y : restaurer le focus sur l'élément qui avait ouvert le dialogue.
        if (this._elementOuverture && typeof this._elementOuverture.focus === "function") {
            this._elementOuverture.focus();
            this._elementOuverture = null;
        }

        // Nettoyer les pages d'aperçu + le cache capture→export (les
        // canvases ne doivent pas survivre à la fermeture du dialogue,
        // réservé mémoire des canvases peut dépasser 100 Mo sur document long).
        this.pagesApercu = [];
        this.pageActuelle = 0;
        this._invaliderCachePages();
    }

    /**
     * Positionne les boutons de navigation (précédent, suivant, indicateur de
     * page) en mode responsive :
     * - Flèches centrées verticalement sur la partie VISIBLE de
     *   .apercu-conteneur (pas le centre du canvas entier, qui peut déborder).
     * - Indicateur de page collé au bas visible de la zone.
     * - Si la zone sort complètement du viewport → tout est masqué.
     *
     * En mode desktop (>950 px large & >700 px haut), les styles inline sont
     * nettoyés et le CSS hover-overlay reprend la main.
     * @private
     */
    _positionnerNavigationResponsive() {
        const overlay = this.divDialogue && this.divDialogue.querySelector(".apercu-overlay");
        // Cibler le DIV d'aperçu visible directement (pas .apercu-conteneur qui
        // peut s'étendre bien plus bas que la feuille selon le layout responsive).
        const pageApercu = document.getElementById("apercu-page-pdf");
        if (!overlay || !pageApercu) return;

        const btnPrec = overlay.querySelector(".nav-precedent");
        const btnSuiv = overlay.querySelector(".nav-suivant");
        const indicateur = overlay.querySelector(".indicateur-page");

        const isResponsive = window.innerWidth <= 950 || window.innerHeight <= 700;
        if (!isResponsive) {
            // Mode desktop : purger les styles inline, laisser le CSS hover gérer.
            [btnPrec, btnSuiv, indicateur].forEach((el) => {
                if (el) el.style.cssText = "";
            });
            overlay.style.cssText = "";
            return;
        }

        const rect = pageApercu.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const intersectionTop = Math.max(rect.top, 0);
        const intersectionBottom = Math.min(rect.bottom, viewportHeight);
        const intersectionLeft = Math.max(rect.left, 0);
        const intersectionRight = Math.min(rect.right, viewportWidth);
        const intersectionHeight = intersectionBottom - intersectionTop;
        const intersectionWidth = intersectionRight - intersectionLeft;

        if (intersectionHeight <= 0 || intersectionWidth <= 0) {
            // Div d'aperçu entièrement hors viewport : tout cacher.
            [btnPrec, btnSuiv, indicateur].forEach((el) => {
                if (el) el.style.display = "none";
            });
            return;
        }

        const centreY = intersectionTop + intersectionHeight / 2;
        // Marge de sécurité pour éviter les scrollbars et bord du viewport.
        const margeCote = 15;
        // documentElement.clientWidth exclut la scrollbar verticale, plus
        // précis que window.innerWidth pour ancrer le bouton droit.
        const viewportWidthSansScrollbar = document.documentElement.clientWidth || viewportWidth;

        if (btnPrec) {
            btnPrec.style.cssText = `position:fixed;top:${centreY}px;left:${intersectionLeft + margeCote}px;transform:translateY(-50%);pointer-events:auto;z-index:50;display:block;`;
        }
        if (btnSuiv) {
            const rightOffset = viewportWidthSansScrollbar - intersectionRight + margeCote;
            btnSuiv.style.cssText = `position:fixed;top:${centreY}px;right:${rightOffset}px;left:auto;transform:translateY(-50%);pointer-events:auto;z-index:50;display:block;`;
        }
        if (indicateur) {
            const centreX = intersectionLeft + intersectionWidth / 2;
            indicateur.style.cssText = `position:fixed;top:${intersectionBottom - 10}px;left:${centreX}px;transform:translate(-50%,-100%);pointer-events:auto;z-index:50;bottom:auto;display:block;`;
        }
    }

    /**
     * Restaure le nombre de carreaux original
     * @private
     */
    _restaurerNombreCarreaux() {
        if (this._nombreCarreauxOriginal !== null) {
            const inputCarreaux = document.getElementById("inputNombreDeCarreaux");
            if (inputCarreaux && parseInt(inputCarreaux.value, 10) !== this._nombreCarreauxOriginal) {
                inputCarreaux.value = this._nombreCarreauxOriginal;
                inputCarreaux.dispatchEvent(new Event("change", { bubbles: true }));
            }
            this._nombreCarreauxOriginal = null;
        }
    }

    /**
     * Change le nombre de carreaux à l'écran pour correspondre au format cahier
     * @private
     * @param {number} nombreCarreaux - Nouveau nombre de carreaux
     */
    _changerNombreCarreaux(nombreCarreaux) {
        const inputCarreaux = document.getElementById("inputNombreDeCarreaux");
        if (inputCarreaux && parseInt(inputCarreaux.value, 10) !== nombreCarreaux) {
            inputCarreaux.value = nombreCarreaux;
            inputCarreaux.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    /**
     * Met à jour les options et régénère l'aperçu
     */
    async majOptions() {
        if (this.generationEnCours) return;

        // Tout changement d'option de géométrie invalide le cache capture.
        // (Les setters peuvent aussi l'invalider directement, mais cette
        // barrière unique centralisée garantit la cohérence.)
        this._invaliderCachePages();

        // Lire le format cahier (select)
        const formatCahierSelect = document.getElementById("format-cahier-pdf");
        if (formatCahierSelect) {
            this.options.formatCahier = formatCahierSelect.value || null;
        }

        // Lire le format papier (select)
        const formatSelect = document.getElementById("format-papier-pdf");
        if (formatSelect) {
            this.options.formatPapier = formatSelect.value;
        }

        // Lire pages par feuille (select). Le filtrage de disabled est délégué
        // à _appliquerFiltresCompatibilite() plus bas (filtre dynamique basé
        // sur l'image réelle × feuille brute).
        const pagesFeuilleSelect = document.getElementById("pages-feuille-pdf");
        if (pagesFeuilleSelect) {
            this.options.pagesParFeuille = parseInt(pagesFeuilleSelect.value);
        }

        // Lire le type de marges (select). En mode cahier comme en mode standard
        // on respecte le choix de l'utilisateur : défaut (20 mm), sans (0 mm),
        // ou personnalisées.
        const margesSelect = document.getElementById("type-marges-pdf");
        if (margesSelect) {
            if (margesSelect.value === "defaut") {
                this.options.marges = { haut: 20, bas: 20, gauche: 20, droite: 20 };
            } else if (margesSelect.value === "sans") {
                this.options.marges = { haut: 0, bas: 0, gauche: 0, droite: 0 };
            } else {
                this._lireMargesPersonnalisees();
            }
        }

        // Lire l'orientation (select) — provisoire, peut être basculée par le
        // filtre dynamique plus bas si cahier incompatible avec cette orientation.
        const orientationSelect = document.getElementById("orientation-pdf");
        if (orientationSelect) {
            this.options.orientation = orientationSelect.value;
        }

        // Lire la hauteur de l'interligne (select). Deux familles :
        // - "ecran" (string sentinelle) : carreau dérivé du nombre de carreaux
        //   écran (resp. largeur cahier en mode cahier).
        // - valeur numérique en mm (2, 2.5, …, 5) : carreau = 4 × interligne.
        const interligneSelect = document.getElementById("hauteur-interligne-pdf");
        if (interligneSelect) {
            const valeurBrute = interligneSelect.value;
            const valeurCandidate = valeurBrute === INTERLIGNE_VALEUR_ECRAN
                ? INTERLIGNE_VALEUR_ECRAN
                : parseFloat(valeurBrute);
            if (valeurCandidate === INTERLIGNE_VALEUR_ECRAN
                || INTERLIGNES_DISPONIBLES.includes(valeurCandidate)) {
                this.options.hauteurInterligne = valeurCandidate;
            }
        }
        // Afficher l'info si l'interligne numérique est supérieur au standard
        // Seyès 2 mm. En mode "Comme à l'écran" (valeur string), pas d'info.
        const infoInterligne = document.getElementById("info-interligne");
        if (infoInterligne) {
            const interligne = this.options.hauteurInterligne;
            infoInterligne.style.display = typeof interligne === "number" && interligne > INTERLIGNE_DEFAUT
                ? "block"
                : "none";
        }

        // Appliquer les 3 filtres de compatibilité dynamique (papier → pages
        // feuille → orientation) basés sur l'image réelle vs feuille brute.
        // Peut auto-basculer des valeurs si l'option courante devient
        // incompatible.
        this._appliquerFiltresCompatibilite();

        // Re-appliquer la géométrie DOM live. En mode Standard + mm, le
        // nombre de carreaux N dépend de `pagesParFeuille`/orientation/marges
        // (pages côte-à-côte ou empilées → zone utile divisée par 2) — sans
        // ce re-layout, la capture reste dimensionnée pour une page pleine
        // puis est compressée par le cap dans `calculerPositionnementImage`,
        // ce qui réduit la taille des carreaux en-dessous de 4 × interligne mm.
        this._appliquerGeometrieDOMLive();

        // Gérer les marges incompatibles (auto-bascule défaut → personnalisées
        // OU warning orange sur les inputs en dépassement). Doit s'exécuter
        // APRÈS les filtres de compat pour utiliser les valeurs définitives.
        this._gererMargesIncompatibles();

        // Persister les options pour les sessions suivantes (silencieux si
        // localStorage indisponible). nomFichier n'est pas persisté (généré
        // dynamiquement par date/fichier ouvert).
        sauvegarderOptionsPDF(this._optionsSerialisables());

        // Régénérer l'aperçu
        await this._genererApercu();
    }

    /**
     * Handler du select "Hauteur de l'interligne".
     *
     * L'interligne influe sur la géométrie (taille carreau, nombre de carreaux
     * et de lignes). En mode cahier, le nombre de carreaux du DOM live doit
     * être mis à jour pour que le texte se reflow correctement ; c'est le rôle
     * de `_appliquerGeometrie()`, partagé avec `changerFormatCahier()`.
     */
    async changerHauteurInterligne() {
        // Mettre à jour this.options AVANT _appliquerGeometrieDOMLive car
        // celui-ci lit this.options.hauteurInterligne pour calculer le nombre
        // de carreaux. Sans cette sync préalable, la géométrie est calculée
        // avec la valeur précédente et l'aperçu sort déformé jusqu'à la
        // prochaine régénération (close/open restaure car _reinitialiserOptions
        // applique les options déjà à jour au constructeur).
        const interligneSelect = document.getElementById("hauteur-interligne-pdf");
        if (interligneSelect) {
            const valeurBrute = interligneSelect.value;
            const valeurCandidate = valeurBrute === INTERLIGNE_VALEUR_ECRAN
                ? INTERLIGNE_VALEUR_ECRAN
                : parseFloat(valeurBrute);
            if (valeurCandidate === INTERLIGNE_VALEUR_ECRAN
                || INTERLIGNES_DISPONIBLES.includes(valeurCandidate)) {
                this.options.hauteurInterligne = valeurCandidate;
            }
        }
        this._appliquerGeometrieDOMLive();

        // Laisser le DOM recalculer après le changement du nombre de carreaux
        await new Promise((resolve) => setTimeout(resolve, 100));

        await this.majOptions();
    }

    /**
     * Synchronise le nombre de carreaux du DOM live avec la géométrie déduite
     * du format cahier et de l'interligne courants.
     *
     * 4 cas, selon la combinaison (format cahier ∈ {null, petit/grand/très grand})
     * × (interligne ∈ {"ecran", valeur en mm}) :
     *
     * - Cahier + "ecran" : impose `_nombreCarreauxOriginal` (réduction — le
     *   carreau devient plus petit pour tenir N carreaux dans `cahier.largeurMm`,
     *   sans marge puisque le mode cahier exclut déjà la marge Seyès).
     * - Cahier + mm : `carreaux = floor(cahier.largeurMm / (4 × interligne))`.
     *   Géométrie physique exacte.
     * - Standard + "ecran" : restaure `_nombreCarreauxOriginal` (comportement
     *   historique, le rendu inclut la marge Seyès).
     * - Standard + mm : `carreaux = floor(largeurPageMm / (4 × interligne))`
     *   (papier A4/A3…). Géométrie physique exacte.
     *
     * @private
     */
    _appliquerGeometrieDOMLive() {
        // Mesurer le DOM Seyès pour fournir à `calculerNombreCarreauxPourGeometrie`
        // les invariants dont il a besoin :
        //   - `pageWidthPx = #page.offsetWidth` (constant, ne varie pas avec N)
        //   - `margeSeyesPx = #marge.offsetWidth` (0 si display:none, ex. cahier)
        // Ces valeurs permettent la formule invariante :
        //   N = floor(placement_mm × pageWidthPx / (carreau_target × domTotalPx))
        // qui est immune au reflow racé de `_changerNombreCarreaux`.
        const divMarge = document.getElementById("marge");
        const divPage = document.getElementById("page");
        const margeSeyesPx = divMarge ? divMarge.offsetWidth : 0;
        const pageWidthPx = divPage ? divPage.offsetWidth : 0;
        const carreauPx = obtenirConfigSeyes().largeur_carreau || 80;
        // Fallback `margeSeyesEnCarreaux` conservé pour le fallback du
        // formule quand pageWidthPx n'est pas disponible (tests unitaires,
        // edge cases).
        const margeSeyesEnCarreaux = carreauPx > 0 ? margeSeyesPx / carreauPx : 0;
        const optionsAvecMargeSeyes = {
            ...this.options,
            margeSeyesEnCarreaux,
            margeSeyesPx,
            pageWidthPx,
        };
        const n = calculerNombreCarreauxPourGeometrie(optionsAvecMargeSeyes, this._nombreCarreauxOriginal);
        if (n != null) {
            this._changerNombreCarreaux(n);
        }
    }


    /**
     * Retourne une version sérialisable des options (pour localStorage).
     * Exclut `nomFichier` (dynamique) et évite de stocker des propriétés
     * calculées ou temporaires.
     * @private
     */
    _optionsSerialisables() {
        return {
            formatCahier: this.options.formatCahier,
            orientation: this.options.orientation,
            formatPapier: this.options.formatPapier,
            pagesParFeuille: this.options.pagesParFeuille,
            marges: { ...this.options.marges },
            hauteurInterligne: this.options.hauteurInterligne,
        };
    }

    /**
     * Fusionne des options persistées sur les defaults, en validant chaque
     * champ contre son domaine (ignore silencieusement les valeurs invalides).
     * @private
     * @param {Object|null} persistees
     */
    _mergerOptionsPersistees(persistees) {
        if (!persistees || typeof persistees !== "object") return;

        if (persistees.formatCahier === null || FORMATS_CAHIER[persistees.formatCahier]) {
            this.options.formatCahier = persistees.formatCahier;
        }
        if (persistees.orientation === "portrait" || persistees.orientation === "landscape") {
            this.options.orientation = persistees.orientation;
        }
        if (FORMATS_PAPIER[persistees.formatPapier]) {
            this.options.formatPapier = persistees.formatPapier;
        }
        if (persistees.pagesParFeuille === 1 || persistees.pagesParFeuille === 2) {
            this.options.pagesParFeuille = persistees.pagesParFeuille;
        }
        if (persistees.marges && typeof persistees.marges === "object") {
            const m = persistees.marges;
            const valides = ["haut", "bas", "gauche", "droite"].every(
                (c) => typeof m[c] === "number" && m[c] >= 0 && m[c] <= 100,
            );
            if (valides) {
                this.options.marges = {
                    haut: m.haut,
                    bas: m.bas,
                    gauche: m.gauche,
                    droite: m.droite,
                };
            }
        }
        if (persistees.hauteurInterligne === INTERLIGNE_VALEUR_ECRAN
            || INTERLIGNES_DISPONIBLES.includes(persistees.hauteurInterligne)) {
            this.options.hauteurInterligne = persistees.hauteurInterligne;
        }
    }

    /**
     * Applique les options de `this.options` aux selects DOM de la modale.
     * Appelé à l'ouverture du dialogue après avoir rechargé les options
     * persistées, pour que l'UI reflète les choix mémorisés.
     * @private
     */
    _appliquerOptionsAuxSelects() {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el && value !== undefined && value !== null) el.value = String(value);
        };
        setValue("format-cahier-pdf", this.options.formatCahier || "");
        setValue("orientation-pdf", this.options.orientation);
        setValue("format-papier-pdf", this.options.formatPapier);
        setValue("pages-feuille-pdf", this.options.pagesParFeuille);
        setValue("hauteur-interligne-pdf", this.options.hauteurInterligne);

        // Type de marges : défaut / sans / personnalisées
        const m = this.options.marges;
        const toutes20 = m.haut === 20 && m.bas === 20 && m.gauche === 20 && m.droite === 20;
        const toutes0 = m.haut === 0 && m.bas === 0 && m.gauche === 0 && m.droite === 0;
        const typeMarges = toutes20 ? "defaut" : toutes0 ? "sans" : "personnalisees";
        setValue("type-marges-pdf", typeMarges);
        if (typeMarges === "personnalisees") {
            // `this.options.marges` est stocké en mm (cf. `lireMargesPersonnalisees`
            // dans gestion-marges.mjs qui multiplie les cm saisis par 10). Les
            // inputs attendent du cm au format FR (virgule, 1 décimale). Sans
            // cette conversion, « 15 mm » apparaissait comme "15" dans l'input
            // au lieu de "1,5" à la réouverture — régression déclenchée par
            // l'auto-bascule défaut → personnalisées qui stocke des valeurs
            // non-20 (symétrique de la conversion cm → mm à la lecture).
            const enCm = (mm) => (mm / 10).toFixed(1).replace(".", ",");
            setValue("marge-haut", enCm(m.haut));
            setValue("marge-bas", enCm(m.bas));
            setValue("marge-gauche", enCm(m.gauche));
            setValue("marge-droite", enCm(m.droite));
        }
        this.basculerMarges(typeMarges);
    }

    /**
     * Change le format de cahier et filtre les options disponibles
     */
    async changerFormatCahier() {
        const formatCahierSelect = document.getElementById("format-cahier-pdf");

        const formatCahier = (formatCahierSelect && formatCahierSelect.value) || "";

        // Mettre à jour this.options.formatCahier AVANT _appliquerGeometrieDOMLive
        // qui le lit pour calculer la bonne géométrie. Sans cette sync préalable
        // la capture utilise l'ancienne valeur, résultat : aperçu déformé jusqu'à
        // la prochaine régénération.
        this.options.formatCahier = formatCahier || null;

        const cahier = formatCahier ? FORMATS_CAHIER[formatCahier] : null;

        // Appliquer la géométrie DOM live (nombre de carreaux). Avant ou
        // après avoir potentiellement basculé le papier/pages/orientation,
        // le carreau dépend surtout du cahier + interligne.
        if (cahier) {
            journaliseur.debug("CAHIER_DEBUG", `=== CHANGEMENT FORMAT CAHIER: ${formatCahier} ===`);
            journaliseur.debug("CAHIER_DEBUG", `Carreaux par défaut (interligne 2mm): ${cahier.carreaux}, Lignes: ${cahier.lignes}`);
        }
        this._appliquerGeometrieDOMLive();

        // Appliquer les filtres de compatibilité dynamique (peut auto-basculer
        // papier/pages/orientation si l'option courante est incompatible).
        // Le signalement des marges incompatibles (auto-bascule ou warning
        // orange) remplace l'ancien avertissement « dépasse les marges A4 » :
        // il est plus précis et s'applique à toutes les combinaisons serrées.
        this._appliquerFiltresCompatibilite();

        // Attendre que le DOM se recalcule après le changement de carreaux
        await new Promise(resolve => setTimeout(resolve, 100));

        // Log après délai pour vérifier l'état du DOM
        const inputCarreauxApres = document.getElementById("inputNombreDeCarreaux");
        const configSeyes = obtenirConfigSeyes();
        journaliseur.debug("CAHIER_DEBUG", "=== APRÈS DÉLAI 100ms ===");
        journaliseur.debug("CAHIER_DEBUG", `Input carreaux: ${inputCarreauxApres && inputCarreauxApres.value}`);
        journaliseur.debug("CAHIER_DEBUG", `Config Seyes: carreaux=${configSeyes.nombreDeCarreaux}, largeur_carreau=${configSeyes.largeur_carreau.toFixed(1)}px`);

        // Mettre à jour les options et régénérer l'aperçu
        await this.majOptions();
    }

    /**
     * Orchestre les 3 filtres de compatibilité dynamique (papier → pages
     * par feuille → orientation) en utilisant les valeurs courantes de
     * this.options. Chaque filtre peut faire basculer son option si la
     * valeur courante devient incompatible ; le cas échéant, `this.options`
     * est synchronisé avant d'appliquer les filtres suivants (propagation
     * de la cascade).
     *
     * En mode standard (hors cahier), les 3 filtres ré-activent toutes les
     * options pour lever un éventuel disabled hérité d'une session cahier
     * précédente.
     * @private
     */
    _appliquerFiltresCompatibilite() {
        // 1. Filtre papier : compare le cahier avec chaque format A3/A4/A5.
        const nouveauPapier = filtrerFormatPapierSelonCahier(this.options);
        if (nouveauPapier) {
            this.options.formatPapier = nouveauPapier;
        }

        // 2. Filtre pages par feuille : 1 ou 2 pages selon capacité.
        const nouvellesPages = filtrerPagesParFeuilleSelonCahier(this.options);
        if (nouvellesPages) {
            this.options.pagesParFeuille = parseInt(nouvellesPages, 10);
        }

        // 3. Filtre orientation : portrait / landscape selon capacité.
        const nouvelleOrientation = filtrerOrientationsSelonCahier(this.options);
        if (nouvelleOrientation) {
            this.options.orientation = nouvelleOrientation;
        }
    }

    /**
     * Après l'orchestration des filtres de compatibilité, évalue si les
     * marges configurées dépassent l'espace disponible sur la feuille. Si
     * oui, applique l'UX selon le mode courant :
     *
     * - Mode `defaut` : auto-bascule vers `personnalisees` avec les marges
     *   réduites pré-remplies (min(20, espaceDispo) par côté). Aucune
     *   mise en évidence orange (les valeurs correspondent pile aux limites,
     *   ce n'est pas un dépassement à l'instant t).
     * - Mode `personnalisees` : mise en évidence orange (.marge-depassement)
     *   sur les inputs dont la valeur dépasse espaceDispo. Les valeurs
     *   utilisateur ne sont PAS modifiées (respect de l'input explicite).
     * - Mode `sans` : 0 ≤ tout, jamais de dépassement. Nettoyage complet
     *   d'éventuels warnings résiduels.
     *
     * Dans tous les cas : affiche/masque le message `#info-marges-effectives`.
     * @private
     */
    _gererMargesIncompatibles() {
        const margeHaut = document.getElementById("marge-haut");
        const margeBas = document.getElementById("marge-bas");
        const margeGauche = document.getElementById("marge-gauche");
        const margeDroite = document.getElementById("marge-droite");
        const typeMargesSelect = document.getElementById("type-marges-pdf");
        const infoAjusteesDefaut = document.getElementById("info-marges-ajustees-defaut");
        const infoDepassementPerso = document.getElementById("info-marges-depassement-perso");
        const inputs = { haut: margeHaut, bas: margeBas, gauche: margeGauche, droite: margeDroite };
        const retirerWarnings = () => {
            ["haut", "bas", "gauche", "droite"].forEach((cote) => {
                if (inputs[cote]) inputs[cote].classList.remove("marge-depassement");
            });
            if (infoAjusteesDefaut) infoAjusteesDefaut.style.display = "none";
            if (infoDepassementPerso) infoDepassementPerso.style.display = "none";
        };

        const cahier = this.options.formatCahier ? FORMATS_CAHIER[this.options.formatCahier] : null;
        const papier = FORMATS_PAPIER[this.options.formatPapier];
        if (!cahier || !papier) {
            retirerWarnings();
            return;
        }

        const interligne = typeof this.options.hauteurInterligne === "number"
            ? this.options.hauteurInterligne
            : 2;
        const resultat = evaluerCompatibilite({
            cahier,
            interligne,
            papier,
            orientation: this.options.orientation,
            pagesParFeuille: this.options.pagesParFeuille,
            marges: this.options.marges,
        });

        if (!resultat.compatible) {
            // L'option est grisée par les filtres, marges non applicables.
            retirerWarnings();
            return;
        }

        const auMoinsUnDepassement =
            resultat.margesDepassees.haut || resultat.margesDepassees.bas
            || resultat.margesDepassees.gauche || resultat.margesDepassees.droite;

        if (!auMoinsUnDepassement) {
            retirerWarnings();
            return;
        }

        const mode = typeMargesSelect ? typeMargesSelect.value : "defaut";
        if (mode === "sans") {
            // 0 mm est toujours ≤ tout. Ne devrait pas arriver.
            retirerWarnings();
            return;
        }

        if (mode === "defaut") {
            // Auto-bascule vers personnalisées avec valeurs réduites
            // = min(defaut=20, espaceDispo) par côté.
            const margesReduites = {
                haut: Math.min(20, resultat.espaceDispo.haut),
                bas: Math.min(20, resultat.espaceDispo.bas),
                gauche: Math.min(20, resultat.espaceDispo.gauche),
                droite: Math.min(20, resultat.espaceDispo.droite),
            };
            // mm → cm, format FR (virgule, 1 décimale)
            const enCm = (mm) => (mm / 10).toFixed(1).replace(".", ",");
            if (margeHaut) margeHaut.value = enCm(margesReduites.haut);
            if (margeBas) margeBas.value = enCm(margesReduites.bas);
            if (margeGauche) margeGauche.value = enCm(margesReduites.gauche);
            if (margeDroite) margeDroite.value = enCm(margesReduites.droite);
            this.options.marges = margesReduites;
            if (typeMargesSelect) {
                typeMargesSelect.value = "personnalisees";
                basculerMargesSelectFn();
            }
            // Pas de warning orange — ce sont les valeurs pile = limites.
            ["haut", "bas", "gauche", "droite"].forEach((cote) => {
                if (inputs[cote]) inputs[cote].classList.remove("marge-depassement");
            });
            // Afficher le message d'info « ajustées depuis défaut », masquer l'autre.
            if (infoAjusteesDefaut) infoAjusteesDefaut.style.display = "block";
            if (infoDepassementPerso) infoDepassementPerso.style.display = "none";
            journaliseur.info(
                "MARGES",
                "Auto-bascule défaut → personnalisées : marges réduites pour que le cahier rentre dans la feuille",
                margesReduites,
            );
            return;
        }

        // Mode personnalisées : warning orange sur les inputs en dépassement.
        // Inputs et this.options.marges NON modifiés.
        ["haut", "bas", "gauche", "droite"].forEach((cote) => {
            if (!inputs[cote]) return;
            if (resultat.margesDepassees[cote]) {
                inputs[cote].classList.add("marge-depassement");
            } else {
                inputs[cote].classList.remove("marge-depassement");
            }
        });
        // Afficher le message « marges perso trop grandes », masquer l'autre.
        if (infoDepassementPerso) infoDepassementPerso.style.display = "block";
        if (infoAjusteesDefaut) infoAjusteesDefaut.style.display = "none";
    }

    /**
     * Affiche/masque les champs de marges personnalisées
     */
    basculerMarges(type) {
        basculerMargesFn(type);
    }

    basculerMargesSelect() {
        basculerMargesSelectFn();
    }

    validerMarge(input) {
        validerMargeFn(input);
    }

    /**
     * Affiche la page précédente
     */
    pagePrecedente() {
        if (this.pageActuelle > 0) {
            this.pageActuelle--;
            this._afficherPage(this.pageActuelle);
            this._majNavigationApercu();
        }
    }

    /**
     * Affiche la page suivante
     */
    pageSuivante() {
        if (this.pageActuelle < this.pagesApercu.length - 1) {
            this.pageActuelle++;
            this._afficherPage(this.pageActuelle);
            this._majNavigationApercu();
        }
    }

    /**
     * Bascule entre vue split (aperçu + options) et vue focus (aperçu seul).
     * En mode focus, la colonne options est masquée et l'aperçu exploite toute
     * la largeur de la modale. Pattern réversible via le même bouton.
     */
    basculerModeFocus() {
        const contenu = this.divDialogue && this.divDialogue.querySelector(".dialogue-pdf-contenu");
        const bouton = document.getElementById("btn-focus-apercu");
        if (!contenu) return;

        const enFocus = contenu.classList.toggle("apercu-focus");
        if (bouton) {
            bouton.title = enFocus ? "Réduire l'aperçu" : "Agrandir l'aperçu";
        }

        // Rafraîchir l'aperçu pour qu'il s'adapte à la nouvelle largeur
        // du conteneur (le flex parent passe de 3 à 100% via la classe).
        if (this.pagesApercu && this.pagesApercu.length > 0) {
            this._afficherPage(this.pageActuelle);
        }
    }

    /**
     * Exporte le PDF final
     */
    async exporterPDF() {
        if (this.generationEnCours) return;

        const btnExporter = document.getElementById("btn-exporter-pdf");
        const overlay = document.getElementById("pdf-generation-overlay");

        // Afficher l'overlay de génération
        if (overlay) overlay.style.display = "flex";
        if (btnExporter) btnExporter.disabled = true;

        try {
            this.generationEnCours = true;
            await this._genererPDFAvecOptions();
            this.fermer();
        } catch (erreur) {
            journaliseur.erreur("DIALOGUE_PDF", "Erreur lors de l'export PDF", erreur);
            alert("Erreur lors de la génération du PDF");
        } finally {
            this.generationEnCours = false;
            if (overlay) overlay.style.display = "none";
            if (btnExporter) btnExporter.disabled = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTHODES PRIVÉES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Crée le HTML du dialogue et l'insère dans le DOM
     * @private
     */
    _creerDialogueHTML() {
        const html = `
            <div id="divDialoguePDF" class="lightbox hide" role="dialog" aria-modal="true" aria-labelledby="pdf-dialog-title">
                <button type="button" class="bouton-fermer" onclick="window.pdfDialogue && window.pdfDialogue.fermer()" title="Fermer" i18_title="bouton_fermer_title">×</button>
                <h1 id="pdf-dialog-title" tabindex="-1" i18_content="pdf_export_title">Export PDF</h1>
                <div class="contenu-lightbox dialogue-pdf-contenu">
                    <!-- Colonne Aperçu (gauche) -->
                    <div class="dialogue-pdf-apercu">
                        <div class="apercu-conteneur">
                            <div id="apercu-page-pdf" class="apercu-page">
                                <img id="apercu-image-pdf" alt="">
                                <img id="apercu-image-pdf-2" alt="" hidden>
                            </div>
                            <div class="apercu-chargement" id="apercu-chargement">
                                <div class="spinner"></div>
                                <span i18_content="pdf_apercu_chargement">Génération de l'aperçu...</span>
                            </div>
                            <!-- Navigation en overlay (visible au hover) -->
                            <div class="apercu-overlay">
                                <button type="button" class="nav-btn nav-precedent" onclick="window.pdfDialogue && window.pdfDialogue.pagePrecedente()" id="btn-page-prec" title="Page précédente" i18_title="pdf_nav_page_precedente_title">◀</button>
                                <button type="button" class="nav-btn nav-suivant" onclick="window.pdfDialogue && window.pdfDialogue.pageSuivante()" id="btn-page-suiv" title="Page suivante" i18_title="pdf_nav_page_suivante_title">▶</button>
                                <button type="button" class="nav-btn btn-focus-apercu" onclick="window.pdfDialogue && window.pdfDialogue.basculerModeFocus()" id="btn-focus-apercu" title="Agrandir l'aperçu" i18_title="pdf_nav_focus_apercu_title">⛶</button>
                                <span class="indicateur-page" id="indicateur-page-pdf">Page 1 / 1</span>
                            </div>
                        </div>
                    </div>

                    <!-- Colonne Options (droite) -->
                    <div class="dialogue-pdf-options">
                        <!-- Hauteur de l'interligne (rail d'écriture) -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_hauteur_interligne">Hauteur de l'interligne</legend>
                            <select id="hauteur-interligne-pdf" onchange="window.pdfDialogue && window.pdfDialogue.changerHauteurInterligne()">
                                <optgroup label="Adapté à l'écran">
                                    <option value="ecran" i18_content="pdf_interligne_ecran">Comme à l'écran</option>
                                </optgroup>
                                <optgroup label="Hauteur d'interligne imposée">
                                    <option value="2" selected i18_content="pdf_interligne_2mm">2 mm (Seyès standard)</option>
                                    <option value="2.5" i18_content="pdf_interligne_2_5mm">2,5 mm</option>
                                    <option value="3" i18_content="pdf_interligne_3mm">3 mm</option>
                                    <option value="3.5" i18_content="pdf_interligne_3_5mm">3,5 mm</option>
                                    <option value="4" i18_content="pdf_interligne_4mm">4 mm</option>
                                    <option value="4.5" i18_content="pdf_interligne_4_5mm">4,5 mm</option>
                                    <option value="5" i18_content="pdf_interligne_5mm">5 mm</option>
                                </optgroup>
                            </select>
                            <div id="info-interligne" class="avertissement-format" style="display: none;" i18_content="pdf_info_interligne_elargi">
                                ℹ️ Rail élargi — moins de carreaux et de lignes par page
                            </div>
                        </fieldset>

                        <!-- Format cahier -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_format_cahier">Format cahier</legend>
                            <select id="format-cahier-pdf" onchange="window.pdfDialogue && window.pdfDialogue.changerFormatCahier()">
                                <option value="" selected i18_content="pdf_cahier_standard">Standard (selon écran)</option>
                                <option value="petit_cahier" i18_content="pdf_cahier_petit">Petit cahier (17×22 cm)</option>
                                <option value="grand_cahier_a4" i18_content="pdf_cahier_grand_a4">Grand cahier A4 (21×29,7 cm)</option>
                                <option value="tres_grand_cahier" i18_content="pdf_cahier_tres_grand">Très grand cahier (24×32 cm)</option>
                            </select>
                        </fieldset>

                        <!-- Orientation -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_orientation">Orientation</legend>
                            <select id="orientation-pdf" onchange="window.pdfDialogue && window.pdfDialogue.majOptions()">
                                <option value="portrait" selected i18_content="pdf_orientation_portrait">Portrait</option>
                                <option value="landscape" i18_content="pdf_orientation_paysage">Paysage</option>
                            </select>
                        </fieldset>

                        <!-- Format papier -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_format_papier">Format du papier</legend>
                            <select id="format-papier-pdf" onchange="window.pdfDialogue && window.pdfDialogue.majOptions()">
                                <option value="a4" selected i18_content="pdf_papier_a4">A4 (210 × 297 mm)</option>
                                <option value="a3" i18_content="pdf_papier_a3">A3 (297 × 420 mm)</option>
                                <option value="a5" i18_content="pdf_papier_a5">A5 (148 × 210 mm)</option>
                            </select>
                        </fieldset>

                        <!-- Pages par feuille -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_pages_feuille">Pages par feuille</legend>
                            <select id="pages-feuille-pdf" onchange="window.pdfDialogue && window.pdfDialogue.majOptions()">
                                <option value="1" selected i18_content="pdf_pages_1">1 page</option>
                                <option value="2" i18_content="pdf_pages_2">2 pages</option>
                            </select>
                        </fieldset>

                        <!-- Marges -->
                        <fieldset class="option-groupe">
                            <legend i18_content="pdf_legend_marges">Marges</legend>
                            <select id="type-marges-pdf" onchange="window.pdfDialogue && window.pdfDialogue.basculerMargesSelect(); window.pdfDialogue && window.pdfDialogue.majOptions()">
                                <option value="defaut" selected i18_content="pdf_marges_defaut">Par défaut (2 cm)</option>
                                <option value="sans" i18_content="pdf_marges_sans">Sans marge (0 cm)</option>
                                <option value="personnalisees" i18_content="pdf_marges_personnalisees">Personnalisées...</option>
                            </select>
                            <div id="marges-personnalisees" style="display: none;">
                                <div class="grille-marges">
                                    <div class="marge-input">
                                        <label i18_content="pdf_marge_haut">Haut</label>
                                        <span><input type="text" id="marge-haut" value="2,0" onchange="window.pdfDialogue && window.pdfDialogue.validerMarge(this); window.pdfDialogue && window.pdfDialogue.majOptions()"> <span class="unite">cm</span></span>
                                    </div>
                                    <div class="marge-input">
                                        <label i18_content="pdf_marge_bas">Bas</label>
                                        <span><input type="text" id="marge-bas" value="2,0" onchange="window.pdfDialogue && window.pdfDialogue.validerMarge(this); window.pdfDialogue && window.pdfDialogue.majOptions()"> <span class="unite">cm</span></span>
                                    </div>
                                    <div class="marge-input">
                                        <label i18_content="pdf_marge_gauche">Gauche</label>
                                        <span><input type="text" id="marge-gauche" value="2,0" onchange="window.pdfDialogue && window.pdfDialogue.validerMarge(this); window.pdfDialogue && window.pdfDialogue.majOptions()"> <span class="unite">cm</span></span>
                                    </div>
                                    <div class="marge-input">
                                        <label i18_content="pdf_marge_droite">Droite</label>
                                        <span><input type="text" id="marge-droite" value="2,0" onchange="window.pdfDialogue && window.pdfDialogue.validerMarge(this); window.pdfDialogue && window.pdfDialogue.majOptions()"> <span class="unite">cm</span></span>
                                    </div>
                                </div>
                            </div>
                            <div id="info-marges-ajustees-defaut" class="avertissement-format" style="display: none;" i18_content="pdf_info_marges_ajustees_defaut">
                                ℹ️ Les marges par défaut (2 cm) sont trop grandes pour ce format. Voici des marges adaptées — modifiables si besoin.
                            </div>
                            <div id="info-marges-depassement-perso" class="avertissement-format" style="display: none;" i18_content="pdf_info_marges_depassement_perso">
                                ⚠️ Les marges en orange sont trop grandes pour ce format : l'image les dépassera à l'impression.
                            </div>
                        </fieldset>

                        <!-- Nom du fichier -->
                        <div class="nom-fichier-groupe">
                            <label for="nom-fichier-pdf" i18_content="pdf_label_nom_fichier">Nom du fichier</label>
                            <div class="nom-fichier-input">
                                <input type="text" id="nom-fichier-pdf" maxlength="200" placeholder="seyes-01-01-2025">
                                <span class="extension">.pdf</span>
                            </div>
                        </div>

                        <!-- Boutons d'action -->
                        <div class="dialogue-pdf-actions">
                            <button type="button" class="btn-annuler" onclick="window.pdfDialogue && window.pdfDialogue.fermer()" i18_content="pdf_btn_annuler">Annuler</button>
                            <button type="button" class="btn-exporter" id="btn-exporter-pdf" onclick="window.pdfDialogue && window.pdfDialogue.exporterPDF()" i18_content="pdf_btn_exporter">Exporter PDF</button>
                        </div>
                    </div>
                </div>

                <!-- Overlay de génération PDF -->
                <div class="pdf-generation-overlay" id="pdf-generation-overlay" style="display: none;">
                    <div class="spinner"></div>
                    <span i18_content="pdf_generation_en_cours">Génération du PDF en cours...</span>
                </div>
            </div>
        `;

        // Insérer dans le DOM
        document.body.insertAdjacentHTML("beforeend", html);
        this.divDialogue = document.getElementById("divDialoguePDF");
    }

    /**
     * Synchronise les selects de l'interface avec les options restaurées
     * (depuis localStorage au constructeur, ou les defaults si aucune valeur
     * persistée). Applique aussi la géométrie DOM live (nombre de carreaux
     * selon interligne × format) pour que l'aperçu reflète les réglages.
     *
     * Conserve le nom historique `_reinitialiserOptions` (appelé par `ouvrir()`),
     * mais ne réinitialise plus `this.options` — le constructeur l'a déjà peuplé.
     * @private
     */
    _reinitialiserOptions() {
        // Réactiver toutes les options papier/pages/orientation (les filtres par
        // format cahier seront ré-appliqués plus bas si pertinent). Sans ce
        // reset, une option grisée dans une session précédente resterait grisée.
        const formatPapierSelect = document.getElementById("format-papier-pdf");
        const pagesFeuilleSelect = document.getElementById("pages-feuille-pdf");
        const orientationSelect = document.getElementById("orientation-pdf");
        if (formatPapierSelect) {
            Array.from(formatPapierSelect.options).forEach((opt) => (opt.disabled = false));
        }
        if (pagesFeuilleSelect) {
            Array.from(pagesFeuilleSelect.options).forEach((opt) => (opt.disabled = false));
        }
        if (orientationSelect) {
            Array.from(orientationSelect.options).forEach((opt) => (opt.disabled = false));
        }
        // Appliquer this.options aux selects (format cahier, orientation,
        // papier, pages, marges, interligne).
        this._appliquerOptionsAuxSelects();

        // Appliquer la géométrie DOM live (nombre de carreaux selon format
        // cahier × interligne). Nécessaire pour que le reflow du texte colle
        // aux réglages avant le premier aperçu.
        this._appliquerGeometrieDOMLive();

        // Afficher l'info interligne si nécessaire (valeur numérique > 2 mm).
        // En mode "Comme à l'écran" (valeur string), pas d'info.
        const infoInterligne = document.getElementById("info-interligne");
        if (infoInterligne) {
            const interligne = this.options.hauteurInterligne;
            infoInterligne.style.display = typeof interligne === "number" && interligne > INTERLIGNE_DEFAUT
                ? "block"
                : "none";
        }

        // Ré-appliquer les 3 filtres de compatibilité dynamique (papier → pages
        // → orientation). Nécessaire au restore depuis localStorage pour que
        // les selects reflètent l'état compatibilité courant sans attendre
        // un change utilisateur. Gérer aussi les marges (auto-bascule défaut
        // → personnalisées si nécessaire, warning orange si perso dépasse).
        this._appliquerFiltresCompatibilite();
        this._gererMargesIncompatibles();
    }

    /**
     * Lit les marges personnalisées depuis l'interface
     * @private
     */
    _lireMargesPersonnalisees() {
        this.options.marges = lireMargesPersonnalisees();
    }

    /**
     * Génère le nom de fichier par défaut : seyes-DD-MM-YYYY
     * @private
     * @returns {string} Nom de fichier sans extension
     */
    _genererNomFichierDefaut() {
        return genererNomFichierDefaut();
    }

    _validerNomFichier(nom) {
        return validerNomFichier(nom);
    }

    /**
     * Calcule les dimensions de sortie selon les options
     * @private
     */
    _calculerDimensionsSortie() {
        return calculerDimensionsSortie(this.options);
    }

    /**
     * Génère l'aperçu des pages
     * @private
     */
    async _genererApercu() {
        const chargement = document.getElementById("apercu-chargement");
        const btnExporter = document.getElementById("btn-exporter-pdf");
        if (chargement) chargement.style.display = "flex";
        if (btnExporter) btnExporter.disabled = true;

        try {
            this.generationEnCours = true;
            this.pagesApercu = [];
            this.pageActuelle = 0;

            // Utiliser le générateur existant pour créer les pages
            if (!_generateurSingleton) {
                throw new Error("Générateur PDF non initialisé");
            }

            // Capturer les pages avec les options actuelles
            await this._capturerPages();

            // Afficher la première page
            if (this.pagesApercu.length > 0) {
                this._afficherPage(0);
            }
            this._majNavigationApercu();
        } catch (erreur) {
            journaliseur.erreur("DIALOGUE_PDF", "Erreur lors de la génération de l'aperçu", erreur);
        } finally {
            this.generationEnCours = false;
            if (chargement) chargement.style.display = "none";
            if (btnExporter) btnExporter.disabled = false;
        }
    }

    /**
     * Capture les pages pour l'aperçu avec analyse Ben Nadel
     * @private
     */
    async _capturerPages() {
        // Capture des pages individuelles (avant tout groupement 2p). Cet
        // array est stocké dans le cache capture→export : l'export pourra
        // le réutiliser tel quel sans re-capturer.
        const pagesIndividuelles = await this._captureAllPages("aperçu");

        // Stocker le cache immédiatement après capture (pages individuelles,
        // format commun aux deux modes d'export). Le hash capture l'état
        // des options pertinentes.
        this._cachePages = pagesIndividuelles;
        this._cacheOptionsHash = this._hashOptionsCapture();

        this.pagesApercu = pagesIndividuelles;

        // Si 2 pages par feuille, grouper par paires avec positions en mm
        // pour l'AFFICHAGE. Le cache reste sur les pages individuelles.
        // On ne rasterise PAS en canvas combiné pour l'aperçu : les deux
        // pages sont positionnées en CSS absolu (deux <img> côte-à-côte) dans
        // `_afficherPage`, ce qui préserve la qualité vectorielle à l'affichage.
        // L'export PDF conserve sa propre logique 2-pages dans
        // `_genererPDF2PagesParFeuille` (export-pdf.mjs) sur les canvases.
        if (this.options.pagesParFeuille === 2 && this.pagesApercu.length > 0) {
            this.pagesApercu = this._grouperFeuilles2Pages(this.pagesApercu);
        }
    }

    /**
     * Capture toutes les pages du document selon les options courantes.
     *
     * Pipeline :
     *   1. stabilisation des polices → métriques typographiques figées
     *   2. masquage de #barre → layout reproductible
     *   3. sauvegarde DOM/scroll
     *   4. analyse Ben Nadel + pagination + mapping Seyès
     *   5. pour chaque page : calcul zone de capture + SnapDOM avec masquage
     *      anti-coupure
     *   6. restauration DOM/scroll/barre
     *
     * Utilisé à la fois par l'aperçu (_capturerPages) et l'export PDF
     * (_genererPDFAvecOptions) pour garantir que les deux voient exactement
     * le même contenu. Les appelants spécialisent ensuite (combiner 2 pages,
     * créer le document pdf-engine, etc.).
     *
     * @private
     * @param {string} libelle - Identifiant pour les logs ("aperçu" / "export PDF")
     * @returns {Promise<Array<{canvas: HTMLCanvasElement, svgUrl: string, width: number, height: number}>>}
     *     Une entrée par page mappée. `canvas` pour l'export PDF, `svgUrl`
     *     (data URL SVG+foreignObject) pour l'aperçu via `<img src=>`.
     */
    async _captureAllPages(libelle) {
        // Cache capture → export : si l'aperçu a déjà capturé les pages
        // pour les mêmes options pertinentes (hash), on réutilise les
        // canvases directement. Évite la double capture SnapDOM (principal
        // gain de temps sur l'export). Check protecteur : les canvases du
        // cache doivent encore avoir des dimensions non nulles (pas
        // détachés/GCés) ; sinon on invalide et on recapture.
        if (libelle === "export PDF"
            && this._cachePages
            && this._cacheOptionsHash === this._hashOptionsCapture()
            && this._cachePages.every((p) => p && p.canvas && p.canvas.width > 0)) {
            journaliseur.info(
                "DIALOGUE_PDF",
                `Cache HIT : export réutilise les ${this._cachePages.length} canvases de l'aperçu`,
            );
            return this._cachePages;
        }

        // FIX ROOT CAUSE — transition CSS `background-size 0.3s ease` sur
        // #page/#marge1/#marge2 ([styles.css:465](../../css/styles.css#L465)).
        // Quand `_changerNombreCarreaux` a été appelé avant la capture (via
        // changerHauteurInterligne ou changerFormatCahier), la transition est
        // encore en cours → `largeur_carreau` lit une valeur TRANSITOIRE →
        // analyse Ben Nadel basée sur une géométrie incorrecte → aperçu
        // décalé/incomplet.
        //
        // Solution : désactiver la transition pendant la capture + forcer un
        // reflow synchrone → le navigateur adopte la valeur cible instantanément.
        // Restaurée dans le finally.
        const elementsAvecTransition = ["page", "marge", "marge_secondaire", "marge1", "marge2"]
            .map((id) => document.getElementById(id))
            .filter(Boolean);
        const transitionsOriginales = elementsAvecTransition.map((el) => el.style.transition);
        elementsAvecTransition.forEach((el) => {
            el.style.transition = "none";
        });
        // Force reflow pour appliquer transition:none → saute à la valeur cible.
        elementsAvecTransition.forEach((el) => void el.offsetHeight);

        const conteneur = document.getElementById("contenu");
        const element = document.getElementById("conteneur-extensible");
        const textePrincipal = document.getElementById("texte_principal");

        if (!conteneur || !element || !textePrincipal) {
            // Restauration transition même sur retour précoce
            elementsAvecTransition.forEach((el, i) => {
                el.style.transition = transitionsOriginales[i];
            });
            return [];
        }

        const generateur = _generateurSingleton;
        if (!generateur) {
            journaliseur.erreur("DIALOGUE_PDF", "Générateur PDF non initialisé");
            elementsAvecTransition.forEach((el, i) => {
                el.style.transition = transitionsOriginales[i];
            });
            return [];
        }

        // 1. Stabilisation des polices AVANT l'analyse Ben Nadel — garantit
        //    des métriques typographiques figées, positions Y reproductibles.
        await stabiliserPolices();

        // 1a. Pré-charger les SVG de la réglure courante (Bug Z, 2026-04-30) :
        //     en Firefox, les `background-image: url(.../carreau_*.svg)` posés
        //     en CSS sont chargés paresseusement. Si l'utilisateur ouvre la
        //     modale avant que le browser ait fetché le SVG, SnapDOM rasterise
        //     un fond vide → réglure absente. Le pré-fetch via `Image()` met
        //     le SVG dans le cache navigateur, garantissant rasterisation OK.
        await attendreReglureChargee();

        // 1b. Attendre que le layout du texte soit STABLE (scrollHeight ne
        //    change plus sur 3 frames consécutives). Protège contre les
        //    reflows asynchrones après changement nombreDeCarreaux/interligne :
        //    metrics typographiques ou line-height CSS prennent parfois
        //    plusieurs frames à se propager même après fonts.ready + reflows
        //    forcés dans stabiliserPolices. Symptôme constaté : Ben Nadel
        //    rapporte moins de lignes visuelles juste après un changement
        //    (99 vs 103 stable), donc pagination incorrecte.
        await attendreLayoutStable(textePrincipal, {
            framesStables: 3,
            maxMs: 400,
        });

        // 2. Masquer la barre d'outils pendant la capture → layout identique
        //    à l'export final.
        const barreOutils = document.getElementById("barre");
        const barreEtaitMasquee = barreOutils && barreOutils.style.display === "none";
        if (barreOutils && !barreEtaitMasquee) {
            barreOutils.style.display = "none";
        }

        // 3. Sauvegarde DOM/scroll.
        const htmlOriginal = textePrincipal.innerHTML;
        const scrollOriginal = conteneur.scrollTop;
        // Chaque entrée = {canvas, svgUrl, width, height} produite par
        // capturerAvecSnapDOM (capture-once SnapDOM v2). L'export PDF consomme
        // `.canvas`, l'aperçu consomme `.svgUrl` via <img>.
        const pages = [];

        // 3b. Hook cahier_de_textes : aligne le LIVE DOM sur la prescription
        //     cahier (sync live↔clone pour Ben Nadel). NO-OP hors cahier_de_textes.
        //     Cf. `cahier-de-textes-pdf.mjs#appliquerColonnesLive`.
        const colonnesOriginales = appliquerColonnesLive(this.options);
        if (colonnesOriginales) {
            // Attendre la stabilisation du layout après le changement de colonnes
            // (le texte se re-wrappe). Sans cela, Ben Nadel peut analyser un état
            // partiellement stabilisé (positions Y intermédiaires).
            await attendreLayoutStable(textePrincipal, {
                framesStables: 3,
                maxMs: 400,
            });
        }

        try {
            // 4. Analyse Ben Nadel + pagination + mapping.
            journaliseur.debug("DIALOGUE_PDF", `Analyse Ben Nadel pour ${libelle}...`);

            const analyseComplete = analyserLignesTexte(textePrincipal);
            // Hook cahier_de_textes : ajustement pagination — actuellement no-op
            // (l'identité). Voir cahier-de-textes-pdf.mjs pour le contexte.
            const configPagination = ajusterPagination(this._calculerPaginationAvecOptions());
            const mappagePages = this._mapperLignesVersPagesAvecOptions(analyseComplete, configPagination);
            journaliseur.debug(
                "DIALOGUE_PDF",
                `${libelle}: ${mappagePages.length} pages, ${configPagination.lignesParPage} lignes/page`,
            );

            // 5. Capture page par page avec masquage anti-coupure.
            for (let indexPage = 0; indexPage < mappagePages.length; indexPage++) {
                const infosPage = mappagePages[indexPage];
                const lignesAMasquer = this._calculerLignesAMasquerPourPage(indexPage, infosPage, analyseComplete);
                // Hook cahier_de_textes : override decalageX=0 et largeur=N×carreau
                // pour capturer toute la largeur du cahier (matière+date+texte).
                // NO-OP hors cahier_de_textes + format cahier.
                const infoCapture = ajusterZoneCapture(
                    this._calculerZoneCaptureAvecOptions(infosPage, analyseComplete, configPagination),
                    this.options,
                    configPagination.largeurCarreauEcranPx,
                );

                conteneur.scrollTop = infoCapture.positionScroll;

                // Pas de setTimeout avant capture : la stabilisation est
                // désormais dans capturerAvecSnapDOM (fonts.ready + double rAF
                // + offsetHeight), exécutée juste avant snapdom.toCanvas au
                // moment où le DOM du clone est vraiment prêt.

                // Scale dynamique 300 DPI : la capture a désormais juste
                // assez de pixels pour le format cible. Évite le sur-
                // échantillonnage sur petits formats et le sous-échantillonnage
                // sur A3. Cf. plan [plans/plan-pdf-engine-png-cache.md](../../../../plans/plan-pdf-engine-png-cache.md).
                const dimensionsSortieMm = this._calculerDimensionsSortie();
                const scaleDpi = calculerScaleDpi({
                    widthMm: dimensionsSortieMm.largeur,
                    cssWidthPx: infoCapture.largeur,
                });

                const resultatCapture = await capturerAvecSnapDOM(element, {
                    scale: scaleDpi,
                    backgroundColor: COULEUR_FOND_CAPTURE,
                    height: infoCapture.hauteur,
                    width: infoCapture.largeur,
                    x: infoCapture.decalageX,
                    y: infoCapture.decalageY,
                    onclone: (documentClone) => {
                        normaliserCSSPourCapture(documentClone, {
                            estModeCahier: infoCapture.estModeCahier,
                            formatCahier: this.options.formatCahier || null,
                        });
                        this._appliquerMasquageLignesDansClone(documentClone, lignesAMasquer, infoCapture);

                        const pageClone = documentClone.getElementById("page");
                        if (pageClone) {
                            // Dernière page : hauteur background = contenu dynamique.
                            // Autres pages : toute la zone de capture.
                            const hauteurBackground = infoCapture.estDernierePage
                                ? infoCapture.decalageY + infoCapture.hauteurDynamique
                                : infoCapture.decalageY + infoCapture.hauteur;
                            pageClone.style.minHeight = `${hauteurBackground}px`;

                            // Masquer les 2 premiers px pour éviter la ligne de réglure à 25 %.
                            const masqueHaut = documentClone.createElement("div");
                            masqueHaut.style.cssText = `position:absolute;top:${infoCapture.decalageY}px;left:0;width:100%;height:2px;background:#fff;z-index:9999;`;
                            pageClone.appendChild(masqueHaut);

                            // Note : en mode cahier, le trait rouge à gauche est déjà
                            // fourni par `#marge.border-right: 3px solid red` (CSS
                            // styles.css:349) inclus dans la capture via `decalageX =
                            // largeurMargeSeyes - largeurTraitRouge` (dialogue-pdf.mjs:
                            // 1500-1501). Aucun ajout sur #page n'est nécessaire — un
                            // ajout produirait une accumulation de 6 px visible
                            // disproportionnément aux viewports étroits.
                        }

                        // Le masque ci-dessus ne couvre que #page. La zone #marge
                        // (à gauche du trait rouge) est un élément frère distinct
                        // qui a aussi son propre motif Seyès. Sans masque dédié,
                        // la ligne de réglure à 25 % reste visible dans la marge
                        // pour les pages ≥ 2 (où decalageY > 0 tombe au milieu du
                        // motif SVG).
                        const margeClone = documentClone.getElementById("marge");
                        if (margeClone) {
                            const masqueMarge = documentClone.createElement("div");
                            masqueMarge.style.cssText = `position:absolute;top:${infoCapture.decalageY}px;left:0;width:100%;height:2px;background:#fff;z-index:9999;`;
                            margeClone.appendChild(masqueMarge);
                        }
                    },
                });

                if (resultatCapture && resultatCapture.canvas) pages.push(resultatCapture);
                journaliseur.debug("DIALOGUE_PDF", `${libelle} page ${indexPage + 1}/${mappagePages.length} capturée`);
            }
        } finally {
            // 6. Restauration DOM/scroll/barre.
            textePrincipal.innerHTML = htmlOriginal;
            conteneur.scrollTop = scrollOriginal;
            if (barreOutils && !barreEtaitMasquee) {
                barreOutils.style.display = "";
            }
            // Restaurer la transition CSS (voir note au début de _captureAllPages).
            elementsAvecTransition.forEach((el, i) => {
                el.style.transition = transitionsOriginales[i];
            });
            // Hook cahier_de_textes : restaure les colonnes du LIVE DOM.
            // NO-OP si null (cas non-cahier_de_textes).
            restaurerColonnesLive(colonnesOriginales);
        }

        // Hook cahier_de_textes : composition post-capture du header au-dessus
        // de chaque body. Capturé une seule fois et composé sur chaque page.
        // NO-OP hors cahier_de_textes. Voir cahier-de-textes-pdf.mjs.
        await composerHeaderSurPages(pages, this.options, obtenirConfigSeyes(), this._calculerDimensionsSortie());

        return pages;
    }

    /**
     * Calcule la pagination Seyès avec les options sélectionnées
     * @private
     * @returns {Object} Configuration de pagination
     */
    _calculerPaginationAvecOptions() {
        const configSeyes = obtenirConfigSeyes();
        const element = document.getElementById("conteneur-extensible");
        const largeurContenu = element.offsetWidth;
        return calculerPaginationAvecOptions(
            this.options,
            this._nombreCarreauxOriginal,
            configSeyes,
            largeurContenu,
        );
    }

    /**
     * Mappe les lignes Seyès vers les pages physiques avec options
     * REFACTORED: Utilise les positions Y réelles au lieu d'un compteur de lignes Seyès
     * @private
     */
    _mapperLignesVersPagesAvecOptions(analyseComplete, configPagination) {
        return mapperLignesVersPagesAvecOptions(this.options, analyseComplete, configPagination);
    }

    /**
     * Calcule les lignes à masquer pour éviter la coupure cursive
     * @private
     */
    _calculerLignesAMasquerPourPage(indexPage, infosPage, analyseComplete) {
        return calculerLignesAMasquerPourPage(this.options, indexPage, infosPage, analyseComplete);
    }

    /**
     * Convertit un index Seyès vers ligne visuelle (correspondance exacte)
     * Utilisé pour le MASQUAGE : si la ligne n'existe pas, on ne masque rien
     * @private
     */
    _seyesVersVisuelleExact(indexSeyes, mappageLignes) {
        return seyesVersVisuelleExact(indexSeyes, mappageLignes);
    }

    /**
     * Convertit un index Seyès vers ligne visuelle (première ligne >= demandée)
     * Utilisé pour le POSITIONNEMENT : trouve la prochaine ligne avec contenu
     * @private
     */
    _seyesVersVisuellePlusProche(indexSeyes, mappageLignes) {
        return seyesVersVisuellePlusProche(indexSeyes, mappageLignes);
    }

    /**
     * Calcule la zone de capture pour une page avec options
     * @private
     */
    _calculerZoneCaptureAvecOptions(infosPage, analyseComplete, configPagination) {
        const element = document.getElementById("conteneur-extensible");
        const largeurContenu = element.offsetWidth;
        const configSeyes = obtenirConfigSeyes();
        return calculerZoneCaptureAvecOptions(
            this.options,
            infosPage,
            analyseComplete,
            configPagination,
            configSeyes,
            largeurContenu,
        );
    }

    /**
     * Applique le masquage anti-coupure dans le DOM cloné
     * @private
     */
    _appliquerMasquageLignesDansClone(documentClone, lignesAMasquer, infosCapture = null) {
        appliquerMasquageLignesDansClone(documentClone, lignesAMasquer, infosCapture);
    }

    /**
     * Groupe les pages capturées par paires pour l'aperçu 2 pages/feuille.
     * Chaque entrée sortante représente UNE feuille (1 ou 2 pages dessus), avec
     * les positions en mm pour les deux emplacements. La composition visuelle
     * (placement des 2 <img> dans le div aperçu) est faite côté _afficherPage
     * via CSS absolute — pas de rasterisation canvas pour l'aperçu.
     *
     * L'export PDF conserve sa propre logique dans `_genererPDF2PagesParFeuille`
     * (export-pdf.mjs) qui continue de consommer les canvases directement.
     *
     * @private
     * @param {Array<{canvas, svgUrl, width, height}>} pagesCapturees
     * @returns {Array<{
     *     pagesContenues: Array<{canvas, svgUrl, width, height}|null>,
     *     positions: Array<{x, y, width, height}|null>,
     *     dimensionsFeuille: {largeur: number, hauteur: number},
     * }>}
     */
    _grouperFeuilles2Pages(pagesCapturees) {
        const feuilles = [];
        const dimensions = this._calculerDimensionsSortie();
        const configSeyes = obtenirConfigSeyes();
        for (let i = 0; i < pagesCapturees.length; i += 2) {
            const p1 = pagesCapturees[i];
            const p2 = pagesCapturees[i + 1] || null;
            // calculerPositionsDeuxPages ne lit que .width/.height sur p1/p2,
            // il accepte donc les objets {canvas, svgUrl, width, height}.
            // Injection de largeurNaturelleMm (mode mm) pour convergence
            // aperçu = PDF : mêmes options, même calcul de placement.
            // Utilise sourceWidthPx (DOM px) au lieu de canvas.width / ECHELLE
            // pour éviter le facteur dpr de SnapDOM.
            const largeurNaturelleMm = calculerLargeurNaturelleMm(
                p1.sourceWidthPx || (p1.width && p1.width / ECHELLE_CANVAS_HTML),
                this.options,
                configSeyes,
            );
            const optionsPlacement = largeurNaturelleMm != null
                ? Object.assign({}, this.options, { largeurNaturelleMm })
                : this.options;
            const layout = calculerPositionsDeuxPages(optionsPlacement, p1, p2, dimensions);
            feuilles.push({
                pagesContenues: [p1, p2],
                positions: [layout.pos1, layout.pos2],
                dimensionsFeuille: { largeur: layout.largeurFeuille, hauteur: layout.hauteurFeuille },
            });
        }
        return feuilles;
    }

    /**
     * Calcule les positions (en mm) de deux pages disposées sur une feuille.
     * Logique partagée entre l'aperçu (_grouperFeuilles2Pages) et le PDF final
     * (_genererPDF2PagesParFeuille) pour garantir un rendu identique :
     *   - portrait source → paysage côte à côte
     *   - paysage source → portrait empilé
     * Applique les marges utilisateur sur l'extérieur et un espacement de 2 mm
     * entre les deux pages.
     *
     * @private
     * @param {HTMLCanvasElement} canvas1
     * @param {HTMLCanvasElement|null} canvas2
     * @param {{largeur: number, hauteur: number}} dimensions - Dimensions feuille (mm)
     * @returns {{largeurFeuille, hauteurFeuille, pos1, pos2}}
     */
    _calculerPositionsDeuxPages(canvas1, canvas2, dimensions) {
        return calculerPositionsDeuxPages(this.options, canvas1, canvas2, dimensions);
    }

    /**
     * Calcule le positionnement d'une image sur une page (utilisé pour aperçu ET export)
     * Garantit que aperçu = export
     * @private
     * @param {number} imgWidth - Largeur de l'image source
     * @param {number} imgHeight - Hauteur de l'image source
     * @param {number} pageWidth - Largeur de la page (en mm pour PDF, en px pour aperçu)
     * @param {number} pageHeight - Hauteur de la page
     * @param {Object} marges - {haut, bas, gauche, droite}
     * @returns {Object} {x, y, width, height} - Position et dimensions de l'image
     */
    _calculerPositionnementImage(imgWidth, imgHeight, pageWidth, pageHeight, marges, sourceWidthPx) {
        // Injection de largeurNaturelleMm en mode mm pour convergence
        // aperçu = PDF : les deux chemins passent par le même placement
        // « naturel » quand un interligne en mm est spécifié.
        //
        // `sourceWidthPx` (DOM px capturés) est préféré à `imgWidth / ECHELLE`
        // car SnapDOM applique son propre dpr — `canvas.width / scale` ne
        // donne PAS la largeur DOM source. Fallback sur imgWidth/ECHELLE si
        // sourceWidthPx absent (appelants legacy non migrés).
        //
        // En mode cahier_de_textes (ecran ou mm), active `preserveRatioCahier`
        // pour que `calculerPositionnementImage` utilise le fit-contain
        // (carreaux carrés, max occupation cahier) au lieu du legacy stretch.
        const configSeyes = obtenirConfigSeyes();
        const largeurNaturelleMm = calculerLargeurNaturelleMm(
            sourceWidthPx || (imgWidth && imgWidth / ECHELLE_CANVAS_HTML),
            this.options,
            configSeyes,
        );
        const optionsPlacement = Object.assign({}, this.options);
        if (largeurNaturelleMm != null) optionsPlacement.largeurNaturelleMm = largeurNaturelleMm;
        if (estCahierDeTextes()) optionsPlacement.preserveRatioCahier = true;
        return calculerPositionnementImage(optionsPlacement, imgWidth, imgHeight, pageWidth, pageHeight, marges);
    }

    /**
     * Affiche une feuille (1 ou 2 pages logiques) dans le div aperçu.
     *
     * Pipeline vectoriel : le div #apercu-page-pdf est dimensionné en px
     * pour matérialiser la feuille papier, et l'une ou deux <img> internes
     * sont positionnées en pourcentages du div pour afficher le(s) SVG de
     * capture SnapDOM. Le navigateur rend les SVG à la résolution écran
     * native — plus de downscale bilinéaire qui faisait disparaître les
     * fines lignes de la réglure.
     *
     * @private
     */
    _afficherPage(index) {
        const pageApercu = document.getElementById("apercu-page-pdf");
        if (!pageApercu || !this.pagesApercu[index]) return;

        const pageSource = this.pagesApercu[index];
        // Forme unifiée : si `pagesContenues` est présent, c'est une feuille
        // 2-pages (cf `_grouperFeuilles2Pages`) ; sinon c'est une page simple
        // {canvas, svgUrl, width, height} issue directement de la capture.
        const estFeuille2Pages = pageSource.pagesContenues !== undefined;

        const dimensionsMm = estFeuille2Pages
            ? pageSource.dimensionsFeuille
            : this._calculerDimensionsSortie();
        const ratioFormat = dimensionsMm.hauteur / dimensionsMm.largeur;

        // Dimensions de la div feuille :
        //
        // aspect-ratio inline donne à la div un ratio intrinsèque (remplaçant
        // le ratio intrinsèque que le <canvas> apportait pré-refactor).
        // Sans ce ratio, la div collapse à 0 en responsive où la chaîne flex
        // ne propage pas de hauteur au conteneur.
        //
        // Desktop : on mesure le conteneur et on pose width/height en px
        // explicites. Clear d'abord pour que la mesure ne soit pas polluée
        // par le min-content de l'inline width précédent (cf. fix d9c8e59).
        //
        // Responsive : on laisse CSS driver — les media queries posent
        // `width: 100%; height: auto` sur #apercu-page-pdf, le navigateur
        // calcule la hauteur depuis aspect-ratio × largeur 100%. Pas de
        // mesure JS (conteneur.clientHeight = 0 en responsive).
        pageApercu.style.width = "";
        pageApercu.style.height = "";
        pageApercu.style.aspectRatio = `${dimensionsMm.largeur} / ${dimensionsMm.hauteur}`;

        const isResponsive = window.innerWidth <= 950 || window.innerHeight <= 700;

        let displayWidth;
        let displayHeight;

        if (isResponsive) {
            // CSS prend le relais pour le sizing. Pour le calcul des positions
            // % des <img> internes, on peut se baser sur n'importe quelle
            // paire (largeur, hauteur) proportionnelle au ratio — on utilise
            // directement les dimensions en mm de la feuille puisque les
            // positions sont elles aussi en mm (ou en px display cohérent).
            displayWidth = dimensionsMm.largeur;
            displayHeight = dimensionsMm.hauteur;
        } else {
            const conteneur = pageApercu.parentElement;
            const maxWidth = Math.max(50, conteneur.clientWidth - 20);
            const maxHeight = Math.max(50, conteneur.clientHeight - 20);

            displayWidth = maxWidth;
            displayHeight = maxWidth * ratioFormat;
            if (displayHeight > maxHeight) {
                displayHeight = maxHeight;
                displayWidth = maxHeight / ratioFormat;
            }

            pageApercu.style.width = `${displayWidth}px`;
            pageApercu.style.height = `${displayHeight}px`;
        }

        const img1 = document.getElementById("apercu-image-pdf");
        const img2 = document.getElementById("apercu-image-pdf-2");

        if (estFeuille2Pages) {
            // 2 pages/feuille : positions calculées en mm par
            // calculerPositionsDeuxPages, converties en % du div pour rester
            // fluide si la feuille est retaillée par CSS (focus, resize).
            this._poserImgApercu(
                img1, pageSource.pagesContenues[0], pageSource.positions[0], dimensionsMm,
            );
            this._poserImgApercu(
                img2, pageSource.pagesContenues[1], pageSource.positions[1], dimensionsMm,
            );
        } else {
            // 1 page/feuille : positionnement via calculerPositionnementImage
            // EN MM (mêmes dimensions que l'export PDF) pour convergence
            // aperçu = PDF bit-pour-bit en proportions.
            //
            // `_poserImgApercu` transforme en % du div parent via ratio
            // pos/dimensions, donc n'importe quelle unité cohérente marche.
            // On choisit mm pour matcher l'export PDF et simplifier le calcul
            // de `largeurNaturelleMm` (pas de conversion unité).
            let pos = this._calculerPositionnementImage(
                pageSource.width,
                pageSource.height,
                dimensionsMm.largeur,
                dimensionsMm.hauteur,
                this.options.marges,
                pageSource.sourceWidthPx,
            );
            this._poserImgApercu(
                img1, pageSource, pos,
                dimensionsMm,
            );
            if (img2) {
                img2.hidden = true;
                img2.removeAttribute("src");
            }
        }
    }

    /**
     * Positionne une <img> aperçu en CSS absolue en pourcentages.
     * Accepte une position dans n'importe quelle unité tant que `dimensions`
     * est dans la même unité (mm/mm ou px/px) — le ratio pos/dimensions donne
     * toujours le % du div parent (lui-même sizé en px CSS par `_afficherPage`).
     *
     * @private
     * @param {HTMLImageElement|null} img
     * @param {{svgUrl: string}|null} pageData
     * @param {{x:number, y:number, width:number, height:number}|null} pos
     * @param {{largeur:number, hauteur:number}} dimensions
     */
    _poserImgApercu(img, pageData, pos, dimensions) {
        if (!img) return;
        if (!pageData || !pos) {
            img.hidden = true;
            img.removeAttribute("src");
            return;
        }
        img.hidden = false;
        img.src = pageData.svgUrl;
        img.style.left = `${(pos.x / dimensions.largeur) * 100}%`;
        img.style.top = `${(pos.y / dimensions.hauteur) * 100}%`;
        img.style.width = `${(pos.width / dimensions.largeur) * 100}%`;
        img.style.height = `${(pos.height / dimensions.hauteur) * 100}%`;
    }

    /**
     * Met à jour les boutons de navigation et l'indicateur
     * @private
     */
    _majNavigationApercu() {
        const indicateur = document.getElementById("indicateur-page-pdf");
        const btnPrec = document.getElementById("btn-page-prec");
        const btnSuiv = document.getElementById("btn-page-suiv");

        const totalPages = this.pagesApercu.length || 1;
        const pageAffichee = this.pageActuelle + 1;

        if (indicateur) {
            indicateur.textContent = `Page ${pageAffichee} / ${totalPages}`;
        }

        if (btnPrec) {
            btnPrec.disabled = this.pageActuelle === 0;
        }

        if (btnSuiv) {
            btnSuiv.disabled = this.pageActuelle >= totalPages - 1;
        }

        // Recalculer les positions des boutons nav en mode responsive
        // (après chaque changement de page pour gérer un éventuel
        // redimensionnement du canvas entre pages).
        if (this._positionnerNavHandler) {
            this._positionnerNavHandler();
        }
    }

    /**
     * Génère le PDF final avec les options sélectionnées et analyse Ben Nadel
     * @private
     */
    async _genererPDFAvecOptions() {
        // Capture (stabilisation polices, masquage barre, analyse Ben Nadel,
        // mapping Seyès, capture SnapDOM) factorisée dans _captureAllPages,
        // partagée avec l'aperçu pour garantir strictement le même contenu.
        // Chaque entrée de `pagesCapturees` porte {canvas, svgUrl, sourceWidthPx, ...} ;
        // le pipeline PDF consomme `.canvas` pour l'embarquage image et
        // `.sourceWidthPx` pour calculer la largeur naturelle en précision.
        const pagesCapturees = await this._captureAllPages("export PDF");

        // Préparer les dimensions de sortie et créer le document PDF.
        const dimensions = this._calculerDimensionsSortie();
        const orientationPDF = this.options.pagesParFeuille === 2
            ? (this.options.orientation === "portrait" ? "landscape" : "portrait")
            : this.options.orientation;

        const nomFichier = this._resoudreNomFichier();

        // Chemin unique pdf-engine vendoré (PNG FlateDecode + Predictor 15
        // en passe-plat IDAT ou quantifié selon la taille). Les deux modes
        // 1p et 2p/feuille partagent désormais le même moteur.
        const doc = creerDocument({
            orientation: orientationPDF,
            formatMm: [dimensions.largeur, dimensions.hauteur],
        });
        doc.definirMetadonnees({
            title: nomFichier.replace(/\.pdf$/i, ""),
            creator: "Seyes - Éducajou",
            author: "",
            creationDate: new Date(),
        });

        if (this.options.pagesParFeuille === 1) {
            await this._genererPDFSimple(doc, pagesCapturees, dimensions);
        } else {
            await this._genererPDF2PagesParFeuille(doc, pagesCapturees, dimensions);
        }

        await doc.sauvegarder(nomFichier);
        journaliseur.info(
            "DIALOGUE_PDF",
            `PDF exporté: ${nomFichier} (${doc.getNombrePages()} pages)`,
        );
    }

    /**
     * Résout le nom de fichier final depuis l'input du dialogue, validé.
     * @private
     */
    _resoudreNomFichier() {
        const inputNom = document.getElementById("nom-fichier-pdf");
        const nomSaisi = inputNom ? inputNom.value : "";
        return this._validerNomFichier(nomSaisi);
    }

    /**
     * Génère un PDF avec 1 page par feuille via pdf-engine vendoré.
     * @private
     */
    async _genererPDFSimple(doc, pagesData, dimensions) {
        await genererPDFSimple(doc, pagesData, this.options, dimensions);
    }

    async _genererPDF2PagesParFeuille(doc, pagesData, dimensions) {
        await genererPDF2PagesParFeuille(doc, pagesData, this.options, dimensions);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap du module : singletons et API publique
// ═══════════════════════════════════════════════════════════════════════════

let _dialogueSingleton = null;

/**
 * Initialise la feature dialogue PDF :
 * - instancie le générateur PDF (GenerateurPDFSeyes) ;
 * - instancie le dialogue (DialoguePdf) ;
 * - expose `window.pdfDialogue` pour les onclick inline des templates
 *   HTML générés dynamiquement.
 *
 * Idempotent : les appels suivants sont des no-ops.
 *
 * @returns {Promise<void>}
 */
export async function initDialoguePdf() {
	if (_dialogueSingleton) return;
	_generateurSingleton = new GenerateurPDFSeyes();
	await _generateurSingleton.initialiser();
	_dialogueSingleton = new DialoguePdf();
	window.pdfDialogue = _dialogueSingleton;
	journaliseur.info("DIALOGUE_PDF", "Dialogue PDF initialisé");
}

/**
 * Ouvre le dialogue PDF. Point d'entrée câblé sur `#export-pdf` depuis
 * `web/js/core/menu/buttons/export-pdf.mjs`.
 */
export function ouvrirDialoguePdf() {
	if (!_dialogueSingleton) {
		journaliseur.avertir("DIALOGUE_PDF", "Dialogue non initialisé, appel à ouvrir() ignoré");
		return;
	}
	_dialogueSingleton.ouvrir();
}
