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
import { CLE_STOCKAGE_OPTIONS_PDF, POLICES_CURSIVES } from "./constantes.mjs";
import { journaliseur } from "./journaliseur.mjs";

/**
 * Attend que le navigateur ait layouté + peint la frame courante via un
 * double `requestAnimationFrame`. Pattern cross-browser sans `setTimeout`.
 *
 * - 1er rAF : enregistre le callback pour la prochaine frame.
 * - 2e rAF (imbriqué) : garantit qu'au moins une frame complète a été
 *   layoutée ET peinte entre-temps.
 *
 * Utile avant toute capture DOM (SnapDOM) pour que les modifications de
 * style/DOM précédentes soient visibles par la capture.
 *
 * Durée typique : ~16-32 ms (1 ou 2 refresh frames @ 60 Hz).
 *
 * @returns {Promise<void>}
 */
export function attendreFramesStables() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

/**
 * Attend que le layout d'un élément soit stable : son `scrollHeight` ne change
 * plus sur N frames consécutives. Protège contre les reflows asynchrones (ex :
 * métriques typographiques qui finissent de s'appliquer après un changement
 * de `nombreDeCarreaux` ou de police).
 *
 * Condition-based wait (skill systematic-debugging) — préférable à un
 * `setTimeout` arbitraire.
 *
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @param {number} [options.framesStables=3] - Nombre de frames consécutives stables
 * @param {number} [options.maxMs=600] - Timeout maximum (protège contre pages infinies)
 * @returns {Promise<{stable: boolean, frames: number, dureeMs: number}>}
 */
export async function attendreLayoutStable(element, { framesStables = 3, maxMs = 600 } = {}) {
	const debut = performance.now();
	let lastHeight = element.scrollHeight;
	let consecutivesStables = 0;
	let frames = 0;

	while (performance.now() - debut < maxMs) {
		await new Promise((r) => requestAnimationFrame(r));
		frames++;
		void element.offsetHeight; // force reflow sync
		const currentHeight = element.scrollHeight;
		if (currentHeight === lastHeight) {
			consecutivesStables++;
			if (consecutivesStables >= framesStables) {
				return { stable: true, frames, dureeMs: Math.round(performance.now() - debut) };
			}
		} else {
			consecutivesStables = 0;
			lastHeight = currentHeight;
		}
	}
	return { stable: false, frames, dureeMs: Math.round(performance.now() - debut) };
}

/**
 * Utilitaires pour la feature PDF.
 *
 * Converti depuis la classe UtilitairesSeyes (méthodes statiques) vers des
 * fonctions libres, conformément aux conventions upstream.
 *
 * Les dépendances window.jspdf / window.snapdom ne sont plus nécessaires
 * après la conversion ES : les modules consommateurs importent jsPDF et
 * snapdom via npm.
 */

/**
 * Normalise la largeur du carreau en entier cohérent avec le rendu CSS.
 *
 * INVARIANT seyes-pdf-guard #1 : la CSS utilise `Math.floor()` pour calculer
 * la valeur de référence du carreau. Tout module qui convertit la largeur
 * flottante en entier DOIT utiliser ce helper (et donc `Math.floor`), sinon
 * la divergence entraîne un décalage progressif du mapping Seyès par rapport
 * aux positions rendues (symptôme : coupures de paragraphes mal détectées,
 * pagination décalée, mots coupés en frontière de page).
 *
 * @param {number} largeurCarreauBrute - La valeur flottante lue depuis le CSS.
 * @returns {number} Entier via Math.floor, aligné avec le CSS.
 */
export function largeurCarreauNormalisee(largeurCarreauBrute) {
	return Math.floor(largeurCarreauBrute);
}

/**
 * Récupère la configuration Seyès courante depuis le DOM.
 *
 * @returns {{nombreDeCarreaux: number, largeur_carreau: number, largeur_marge: number}}
 */
export function obtenirConfigSeyes() {
	// Nombre de carreaux
	const inputCarreaux = document.getElementById("inputNombreDeCarreaux");
	const nombreDeCarreaux = inputCarreaux ? parseInt(inputCarreaux.value, 10) || 21 : 21;

	// Largeur du carreau depuis le background-size de #page
	const page = document.getElementById("page");
	let largeur_carreau = 80;
	if (page) {
		const bgSize = getComputedStyle(page).backgroundSize;
		const match = bgSize.match(/^([\d.]+)px/);
		if (match) {
			largeur_carreau = parseFloat(match[1]);
		}
	}

	// Largeur de la marge
	const marge = document.getElementById("marge");
	const largeur_marge = marge ? marge.offsetWidth : 200;

	return { nombreDeCarreaux, largeur_carreau, largeur_marge };
}

/**
 * Attend que les polices soient chargées, force un reflow, puis temporise.
 *
 * @returns {Promise<void>}
 */
export async function stabiliserPolices() {
	journaliseur.debug("UTILITAIRES", "Stabilisation des polices en cours...");

	if (document.fonts && document.fonts.ready) {
		await document.fonts.ready;
	}

	const elements = [
		document.getElementById("texte_principal"),
		document.getElementById("texte_marge"),
		document.getElementById("texte_marge_secondaire"),
	].filter(Boolean);

	elements.forEach((element) => {
		const familleOriginale = element.style.fontFamily;
		element.style.fontFamily = "Arial";

		element.offsetHeight; // Force un reflow
		element.style.fontFamily = familleOriginale;

		element.offsetHeight; // Force un autre reflow
	});

	// Double rAF au lieu de setTimeout(300 ms) — même garantie (paint terminé)
	// sans le surcoût d'attente fixe.
	await attendreFramesStables();

	journaliseur.debug("UTILITAIRES", "Polices stabilisées");
}

/**
 * Attend que les SVG du lignage courant (réglure Seyès) soient chargés et
 * décodés par le navigateur. Pré-fetch via `new Image()` avec `decode()` pour
 * garantir que l'image soit dans le cache navigateur ET parsée avant qu'on
 * tente de capturer la zone.
 *
 * **Pourquoi** (Bug Z, 2026-04-30) : la règle CSS `background-image: url(...)`
 * sur `#page` et `#marge1` est posée avant l'export, mais Firefox charge la
 * ressource paresseusement. Si l'utilisateur ouvre la modale PDF avant que
 * la requête HTTP ait abouti et que le SVG soit décodé, la rasterisation
 * SnapDOM affiche un fond vide (sans réglure). Bug intermittent observé en
 * Firefox quand l'utilisateur est rapide après changement de lignage.
 * Chrome préfetche/cache plus agressivement les `background-image` et n'est
 * donc pas affecté.
 *
 * Le pré-fetch via `Image()` charge l'image dans le cache navigateur. Les
 * références CSS subséquentes sont des cache-hits → rasterisation OK.
 *
 * Lit les URLs depuis le `background-image` effectivement appliqué (via
 * `getComputedStyle`), donc fonctionne pour tous les lignages sans coder
 * en dur le mapping `typeCarreaux` → fichier SVG.
 *
 * @returns {Promise<void>}
 */
export async function attendreReglureChargee() {
	const elements = ["page", "marge1", "marge2", "conteneur-extensible"]
		.map((id) => document.getElementById(id))
		.filter(Boolean);

	const urls = new Set();
	for (const el of elements) {
		const bgImage = window.getComputedStyle(el).backgroundImage;
		if (!bgImage || bgImage === "none") continue;
		// Extrait l'URL depuis `url("...")` ou `url(...)`. Plusieurs URLs
		// possibles si plusieurs background-image (rare).
		const matches = bgImage.matchAll(/url\((["']?)([^"')]+)\1\)/g);
		for (const match of matches) {
			urls.add(match[2]);
		}
	}

	if (urls.size === 0) {
		journaliseur.debug("UTILITAIRES", "Aucun SVG de réglure à pré-charger");
		return;
	}

	const promesses = Array.from(urls).map((url) => new Promise((resolve) => {
		const img = new Image();
		// `onload` se déclenche quand l'image est récupérée. `decode()`
		// garantit en plus qu'elle soit parsée et prête à peindre. Si une
		// erreur survient (URL invalide, CORS, etc.), on résout tout de même
		// pour ne pas bloquer l'export.
		img.onload = () => {
			if (typeof img.decode === "function") {
				img.decode().then(resolve).catch(resolve);
			} else {
				resolve();
			}
		};
		img.onerror = () => resolve();
		img.src = url;
	}));

	await Promise.all(promesses);
	journaliseur.debug(
		"UTILITAIRES",
		`Réglure chargée : ${urls.size} SVG(s) en cache navigateur`,
	);
}

/**
 * Détecte si la police active (dans #choix_police ou sur #texte_principal)
 * est une police cursive, listée dans POLICES_CURSIVES.
 *
 * @returns {boolean}
 */
export function estPoliceCursive() {
	const selecteurPolice = document.getElementById("choix_police");
	let policeActive = (selecteurPolice && selecteurPolice.value) || null;

	if (!policeActive) {
		const textePrincipal = document.getElementById("texte_principal");
		if (textePrincipal) {
			const styleCalcule = window.getComputedStyle(textePrincipal);
			policeActive = styleCalcule.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
		}
	}

	const estCursive = POLICES_CURSIVES.includes(policeActive);
	journaliseur.debug("UTILITAIRES", `Détection police cursive: ${policeActive}`, {
		police: policeActive,
		estCursive,
	});
	return estCursive;
}

/**
 * Génère un nom de fichier PDF par défaut : "seyes-DD-MM-YYYY.pdf" ou le
 * nom du fichier ouvert si disponible (config.nomDuFichierOuvert).
 *
 * @returns {string} Nom de fichier avec extension .pdf
 */
export function genererNomFichier() {
	let nom = "seyes";

	const dateDoc = config.dateDuDoc || null;
	if (dateDoc && typeof dateDoc === "string") {
		nom += `-${dateDoc.replace(/\s+/g, "-")}`;
	} else {
		const aujourdHui = new Date();
		const dateStr = aujourdHui.toLocaleDateString("fr-FR").replace(/\//g, "-");
		nom += `-${dateStr}`;
	}

	if (config.nomDuFichierOuvert) {
		nom = config.nomDuFichierOuvert;
	}

	if (!nom.endsWith(".pdf")) {
		nom += ".pdf";
	}

	journaliseur.debug("UTILITAIRES", `Nom fichier généré: ${nom}`);
	return nom;
}

/**
 * Charge les options PDF persistées depuis localStorage.
 *
 * Retourne un objet partiel (à merger sur les defaults) ou null si aucune
 * valeur n'a été stockée, si le JSON est invalide, ou si localStorage est
 * indisponible (mode privé, quota, etc.).
 *
 * L'appelant reste responsable de valider chaque champ contre son domaine
 * (defense-in-depth : données stockées potentiellement obsolètes).
 *
 * @returns {Object|null}
 */
export function chargerOptionsPDF() {
	try {
		const str = localStorage.getItem(CLE_STOCKAGE_OPTIONS_PDF);
		if (!str) return null;
		return JSON.parse(str);
	} catch (e) {
		journaliseur.debug("UTILITAIRES", `chargerOptionsPDF: échec lecture (${e.message})`);
		return null;
	}
}

/**
 * Sauvegarde les options PDF dans localStorage (silencieux en cas d'erreur).
 *
 * @param {Object} options - Objet à sérialiser en JSON
 */
export function sauvegarderOptionsPDF(options) {
	try {
		localStorage.setItem(CLE_STOCKAGE_OPTIONS_PDF, JSON.stringify(options));
	} catch (e) {
		journaliseur.debug("UTILITAIRES", `sauvegarderOptionsPDF: échec écriture (${e.message})`);
	}
}
