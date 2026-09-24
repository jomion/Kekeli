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

import { config } from "../config.mjs";
import { ID_WRAPPER_CAPTURE } from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";
import { ratioHauteurTuile } from "./lignages-pdf.mjs";
import { largeurCarreauNormalisee, obtenirConfigSeyes } from "./utils.mjs";

/**
 * Normalisation CSS du DOM cloné avant capture SnapDOM.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ INVARIANTS (seyes-pdf-guard) — à NE JAMAIS violer :                     │
 * │                                                                         │
 * │ 1. Utiliser Math.floor() sur largeur_carreau. Pas Math.round(),         │
 * │    pas Math.ceil(), pas laisser flottant. La valeur de référence côté   │
 * │    CSS utilise floor ; tout autre arrondi désaligne progressivement.    │
 * │    Commit de référence : dae36ff.                                       │
 * │                                                                         │
 * │ 2. NE PAS MODIFIER font-size. Un reflow 85.20px → 85px provoque un      │
 * │    recalcul des métriques typographiques et un décalage de 142 px       │
 * │    (un carreau entier) avec mots manquants à la charnière de page.      │
 * │    Commit de référence : 833e959.                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Normalise les valeurs CSS flottantes en entiers dans le document cloné.
 *
 * Corrige le décalage progressif du texte par rapport à la grille Seyès causé
 * par les valeurs flottantes de `largeur_carreau` (ex: 114.66 au lieu de 114).
 *
 * Hauteur de tuile `background-size` adaptée au type de lignage courant : les
 * types `terre`, `trois_couleurs`, `quatre_couleurs`, `bleuviolet` ont un SVG
 * viewBox 1×2 et reçoivent `background-size: ${carreau}px × ${2*carreau}px`.
 * Les types standards 1×1 reçoivent `carreau × carreau`. Cf. `lignages-pdf.mjs`.
 *
 * Mode cahier (`options.estModeCahier === true`) : superpose un trait rouge
 * vertical de 3 px à l'intérieur de `#page` via un `<div>` en
 * `position: absolute; left: 0` pour faire coïncider visuellement la première
 * ligne verticale du quadrillage avec le trait rouge Seyès. Conséquence :
 * `largeurCapture = 15 × carreau_px` pile, carreau imprimé = 4 × interligne
 * mm exact, règle d'or respectée indépendamment de la taille de l'écran.
 *
 * Sauf si `config.typeCarreaux === "cahier_de_textes"` : dans ce lignage la
 * zone capturée inclut matière (#marge1) + date (#marge2) + texte (#page),
 * et le trait rouge serait posé au milieu de la composition (entre la date
 * et le texte). Pas d'injection.
 *
 * @param {Document|HTMLElement} documentClone - Le document cloné à normaliser
 * @param {Object} [options]
 * @param {boolean} [options.estModeCahier=false] - Active la mutation du trait rouge
 */
export function normaliserCSSPourCapture(documentClone, options = {}) {
	const configSeyes = obtenirConfigSeyes();
	const carreauOriginal = configSeyes.largeur_carreau;
	// INVARIANT 1 — via helper partagé largeurCarreauNormalisee (= Math.floor).
	// Tous les modules PDF doivent utiliser ce helper pour garantir la cohérence
	// avec ce que la CSS effective applique lors du rendu.
	const carreauArrondi = largeurCarreauNormalisee(carreauOriginal);
	const facteurCorrection = carreauArrondi / carreauOriginal;

	journaliseur.debug(
		"NORMALISATION_CSS",
		`Normalisation CSS: ${carreauOriginal} → ${carreauArrondi}px (facteur: ${facteurCorrection.toFixed(6)})`,
	);

	// FIX (avril 2026) — Injection du style "transition:none + background-size
	// forcé" EN PREMIER, AVANT toute setProperty. styles.css:462-465 définit
	// `#page, #marge1, #marge2 { transition: background-size 0.3s ease }`. Si
	// on attend après les setProperty pour désactiver les transitions, ces
	// dernières partent et interpolent les valeurs (carreauOriginal flottant
	// → carreauArrondi entier). SnapDOM capture des valeurs intermédiaires.
	// Symptôme historique : la capture reflète un état intermédiaire de la
	// transition au lieu des valeurs cibles — décalage progressif du texte
	// par rapport à la réglure.
	//
	// SCOPE des sélecteurs (FIX spinner figé, avril 2026) : toutes les règles
	// sont préfixées par `#${ID_WRAPPER_CAPTURE}` pour qu'elles s'appliquent
	// UNIQUEMENT aux descendants du wrapper de capture (= le clone), pas au
	// document entier. Sans ce préfixe, `* { animation: none }` désactivait
	// les animations de TOUT le document, figeant notamment les spinners de
	// chargement pendant toute la durée de la capture. Cf. invariant 6
	// seyes-pdf-guard.
	// Hauteur de tuile `background-size` — doublée pour les lignages « sur 2
	// lignes » (types `terre`, `trois_couleurs`, `quatre_couleurs`, `bleuviolet`)
	// dont le SVG source a viewBox 1×2. Sans ce doublement, la force
	// `carreau × carreau` compresse la tuile SVG 2× verticalement, et les
	// bandes colorées du motif deviennent des blocs comprimés à la capture.
	// Les types standards 1×1 gardent le comportement historique `carreau × carreau`.
	const hauteurTuile = carreauArrondi * ratioHauteurTuile(config.typeCarreaux);
	const bgSizeForce = `${carreauArrondi}px ${hauteurTuile}px`;
	const pref = `#${ID_WRAPPER_CAPTURE}`;

	// La règle `[data-seyes-ligne] { display: block; white-space: nowrap }` est
	// scopée AU MODE `cahier_de_textes` UNIQUEMENT (Invariant 11). Hors ce
	// mode, le wrapper `[data-seyes-ligne]` reste inline (default) → le rendu
	// du clone capturé est strictement identique au rendu du live DOM mesuré
	// par Ben Nadel.
	//
	// Pourquoi le scope ? Le `display: block` a été introduit (commit 76d685e
	// puis 2668235) pour résoudre un layout shift live↔clone SPÉCIFIQUE à
	// cahier_de_textes : aux interlignes ≥ 3 mm, `#page` y devient si large
	// que plusieurs spans inline-block fusionnent sur une même ligne physique
	// du clone, créant un mismatch avec les Y mesurés par Ben Nadel.
	// `display: block` rend chaque span atomique (seul sur sa ligne).
	//
	// MAIS l'application globale (toutes modes) introduisait un layout shift
	// INVERSE en mode Standard Firefox (régression 2026-04-27) : entre 2
	// spans block, les `<br><br>` siblings produits par le paste Firefox
	// forment un *anonymous block* qui rend 2 lignes physiques au lieu d'1.
	// → 2 lignes vides au lieu d'1 entre paragraphes, pagination décalée +
	// bleed. Bug confirmé par instrumentation [DBG_FIREFOX_*].
	//
	// Solution : retirer la règle hors cahier_de_textes. En Standard, les
	// blocs `<div>` (Chrome) ou les `<br>` siblings (Firefox) gèrent
	// naturellement le flux ; spans inline ne perturbent rien. Live = clone,
	// browser-agnostique. Mode cahier_de_textes garde la règle (Invariant 11).
	const regleSeyesLigne = config.typeCarreaux === "cahier_de_textes"
		? `${pref} [data-seyes-ligne] {
			display: block !important;
			white-space: nowrap !important;
		}`
		: "";

	// Neutralisation des spans-artefacts Chrome injectés lors de la fusion de
	// paragraphes par BACKSPACE en contenteditable (Bug C, 2026-04-28). Chrome
	// (Blink) wrappe le paragraphe destination dans un `<span style="font-size: …
	// letter-spacing: …; word-spacing: …">` portant les valeurs computed du
	// paragraphe source au moment de la fusion. Si le carreau ou les espacements
	// changent ensuite (config Seyes ajustée), ces valeurs inline figées
	// décalent le texte par rapport à la réglure. Comportement Chrome natif
	// documenté (cf. Summernote #3088, Neoteric Design article).
	//
	// Fix : forcer `font-size/letter-spacing/word-spacing: inherit` sur tout
	// `<span>` descendant de `#texte_principal` qui n'a NI classe (les spans
	// formatage type `couleur-*`, `souligne-*`, `entoure`, `textebarre`,
	// `syllabe-*` ont une classe) NI attribut `data-seyes-ligne` (les wrappers
	// posés par marquerDomAvecLignes). Le span-artefact Chrome n'a ni l'un ni
	// l'autre → la règle le cible précisément.
	//
	// Conformité Invariant 2 ("ne pas modifier font-size dans
	// normaliserCSSPourCapture") : on ne touche pas au font-size des éléments
	// porteurs (`#texte_principal`, `#texte_marge`, etc.). On force seulement
	// les spans-artefacts à RECOUVRIR le font-size hérité du parent (= état
	// désiré, sans drift), donc l'esprit de l'invariant est préservé.
	const styleForce = documentClone.createElement("style");
	styleForce.textContent = `
		${pref} * { transition: none !important; animation: none !important; }
		${pref} #page, ${pref} #conteneur-extensible, ${pref} #marge1, ${pref} #marge2 {
			background-size: ${bgSizeForce} !important;
		}
		${pref} #texte_principal span:not([class]):not([data-seyes-ligne]) {
			font-size: inherit !important;
			letter-spacing: inherit !important;
			word-spacing: inherit !important;
		}
		${regleSeyesLigne}
	`;
	documentClone.head.appendChild(styleForce);
	journaliseur.debug("NORMALISATION_CSS", "Style forcé injecté EN PREMIER (transition:none + background-size, scopé au wrapper) — désactive transitions avant les setProperty");

	// INVARIANT 2 — font-size N'EST PAS dans cette liste, volontairement.
	const selecteursTexte = [
		"#texte_principal",
		"#texte_marge",
		"#texte_marge_complementaire",
	];

	selecteursTexte.forEach((selecteur) => {
		const element = documentClone.querySelector(selecteur);
		if (!element) return;

		// Lire la valeur EFFECTIVE via getComputedStyle, PAS `element.style.X`
		// qui ne voit que les styles inline. Sur PC, line-height est souvent
		// fixée en JS inline (donc visible), mais sur tablettes Android Chrome
		// elle peut hériter d'un CSS sans inline → l'ancien code utilisant
		// `element.style.lineHeight` ne voyait rien et ne normalisait pas.
		const cs = window.getComputedStyle(element);
		const lineHeightActuel = parseFloat(cs.lineHeight) || 0;
		const facteurLigne = lineHeightActuel > carreauOriginal * 1.5 ? 2 : 1;
		const nouveauLineHeight = carreauArrondi * facteurLigne;

		if (lineHeightActuel > 0) {
			element.style.setProperty("line-height", `${nouveauLineHeight}px`, "important");
			journaliseur.debug(
				"NORMALISATION_CSS",
				`${selecteur} lineHeight: ${lineHeightActuel.toFixed(2)} → ${nouveauLineHeight}px !important`,
			);
		}

		const marginActuel = parseFloat(cs.marginTop) || 0;
		if (marginActuel > 0) {
			const marginRecalcule = Math.round(marginActuel * facteurCorrection);
			element.style.setProperty("margin-top", `${marginRecalcule}px`, "important");
			journaliseur.debug(
				"NORMALISATION_CSS",
				`${selecteur} marginTop: ${marginActuel.toFixed(2)} → ${marginRecalcule}px !important`,
			);
		}
		// INVARIANT 2 RAPPEL : font-size est intentionnellement absent ci-dessus.
	});

	// Normalisation du background-size sur les éléments à grille.
	// FIX (avril 2026, bug Android tablette TCL) :
	//  - Sélecteur historique `.page` (CLASS) ne matchait jamais `<div id="page">` (ID).
	//  - Sélecteurs `#marge` et `#marge_secondaire` étaient incorrects :
	//    `#marge` n'est qu'un wrapper flex sans background, et l'élément
	//    réel s'appelle `#marge2`, pas `#marge_secondaire`. Les vraies cibles
	//    porteuses de background-size sont `#marge1` (réglure à gauche, en
	//    permanence) et `#marge2` (réglure à droite, masquée par défaut).
	//    Sans cette correction, #marge1 conservait sa stride flottante
	//    héritée du DOM live (ex: 47.2615px), créant un décalage progressif
	//    texte/réglure UNIQUEMENT à droite de la marge (car #page est bien
	//    normalisé) — la réglure de gauche restait alignée par chance avec
	//    le texte (qui suit la même stride flottante héritée).
	const selecteursFond = ["#page", "#conteneur-extensible", "#marge1", "#marge2"];

	selecteursFond.forEach((selecteur) => {
		const element = documentClone.querySelector(selecteur);
		if (element) {
			element.style.setProperty("background-size", bgSizeForce, "important");
			journaliseur.debug("NORMALISATION_CSS", `${selecteur} backgroundSize: ${bgSizeForce} !important`);
		}
	});

	// Mode cahier : superposer un trait rouge vertical de 3 px à l'intérieur
	// de #page via un <div> absolute à left:0. Ce trait coïncide avec la
	// première ligne verticale du quadrillage (à x=0 de #page), en la colorant
	// en rouge — sémantiquement correct (le trait rouge Seyès EST une des
	// lignes verticales du quadrillage, aux multiples de 4 × interligne).
	//
	// IMPORTANT : ne PAS muter `#marge` (son border-right reste intact).
	// Le viewport de capture commence à `decalageX = largeur_marge =
	// #marge.offsetWidth` (= W+3 car border-right est content-box), c'est-à-dire
	// exactement au left edge de #page dans le DOM live. Toute mutation du
	// box-model de #marge décalerait le flex layout du clone (car #page est
	// flex sibling), faisant glisser #page de 3 px vers la gauche. Comme
	// `decalageX` est calculé AVANT le clonage (sur le DOM live), un tel décalage
	// clipe 3 px de #page par l'overflow:hidden du wrapper SnapDOM — c'est
	// exactement comme ça que j'ai cassé le trait rouge la première fois.
	//
	// De même, éviter `border-left` + `box-sizing: border-box` sur #page :
	// cela modifie le box model et décale la background-image SVG du quadrillage
	// de 3 px (via background-origin: padding-box par défaut), désalignant la
	// grille. Un <div> absolu ne touche pas au box model.
	//
	// #page a déjà `position: relative` (styles.css:380), donc le positionnement
	// absolu s'ancre correctement sur lui.
	//
	// Exception : `cahier_de_textes`. Dans ce lignage, la zone capturée
	// englobe matière (#marge1) + date (#marge2) + texte (#page) ; un trait
	// rouge collé au left edge de #page tomberait au milieu de la composition
	// (entre la date et le texte), ce qui est sémantiquement incorrect. Pas
	// d'injection ici — la séparation matière/date/texte est gérée par les
	// border-right propres à #marge1 et #marge2 dans le DOM live.
	if (options.estModeCahier && config.typeCarreaux !== "cahier_de_textes") {
		const pageClone = documentClone.querySelector("#page");
		if (pageClone) {
			const traitRouge = documentClone.createElement("div");
			traitRouge.id = "__seyes-trait-rouge-cahier";
			// Pas de `z-index` explicite : il faut que le trait soit peint AVANT
			// `#voile_page` (z-index: 0, styles.css:1152) pour être blanchi par
			// l'option « Opacité du lignage » (options-panel.mjs:opacite). Ce
			// voile superpose un rgba(255,255,255, 1 − opaciteLignes) sur #page
			// et blanchit tout ce qui est peint en-dessous. Avec z-index: auto
			// sur notre div, le même niveau stacking que voile est utilisé et
			// l'ordre DOM décide : on insère le trait EN PREMIER via
			// `insertBefore(..., firstChild)`, voile est donc peint par-dessus.
			traitRouge.style.cssText =
				"position:absolute;top:0;left:0;width:3px;height:100%;background:red;pointer-events:none;";
			pageClone.insertBefore(traitRouge, pageClone.firstChild);
			journaliseur.debug("NORMALISATION_CSS", "Mode cahier : trait rouge superposé via <div> absolu inséré en 1er enfant de #page (sous #voile_page)");
		}
	}

	// Note : pour `cahier_de_textes`, le header (#entete) est capturé séparément
	// par `capturerHeaderCahierDeTextes` (cahier-de-textes-pdf.mjs) et composé
	// post-capture sur chaque page. Pas d'injection dans le clone ici. La sync
	// des colonnes est faite côté LIVE DOM via `_appliquerColonnesCahierDeTextesLive`
	// (dialogue-pdf.mjs) avant l'analyse Ben Nadel.
}
