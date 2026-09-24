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

import { NIVEAUX_LOG, NIVEAU_LOG_ACTUEL } from "./constantes.mjs";

/**
 * Système de logging de la feature PDF.
 *
 * Niveaux : OFF, DEBUG, INFO, AVERTISSEMENT, ERREUR.
 * Lazy evaluation des messages/données (fonctions évaluées uniquement si le
 * niveau est actif).
 *
 * Activation du debug depuis la console :
 *   localStorage.setItem("SEYES_PDF_LOG_LEVEL", "DEBUG")
 *   location.reload()
 */
export const journaliseur = {
	niveaux: NIVEAUX_LOG,
	niveauActuel: NIVEAU_LOG_ACTUEL,

	_evaluer(valeur) {
		return typeof valeur === "function" ? valeur() : valeur;
	},

	// OFF (-1) désactive tous les niveaux ; sinon niveau courant ≤ niveau cible.
	_actif(niveauCible) {
		return this.niveauActuel !== this.niveaux.OFF && this.niveauActuel <= niveauCible;
	},

	/**
	 * @param {string} categorie
	 * @param {string|Function} message - Chaîne ou fonction (lazy evaluation).
	 * @param {*} [donnees]
	 */
	debug(categorie, message, donnees = null) {
		if (this._actif(this.niveaux.DEBUG)) {
			this._loggerAvecStyle("🔍", "DEBUG", categorie, this._evaluer(message), this._evaluer(donnees), "#666");
		}
	},

	/**
	 * @param {string} categorie
	 * @param {string|Function} message
	 * @param {*} [donnees]
	 */
	info(categorie, message, donnees = null) {
		if (this._actif(this.niveaux.INFO)) {
			this._loggerAvecStyle("📍", "INFO", categorie, this._evaluer(message), this._evaluer(donnees), "#2196F3");
		}
	},

	/**
	 * @param {string} categorie
	 * @param {string|Function} message
	 * @param {*} [donnees]
	 */
	avertir(categorie, message, donnees = null) {
		if (this._actif(this.niveaux.AVERTISSEMENT)) {
			this._loggerAvecStyle("⚠️", "WARN", categorie, this._evaluer(message), this._evaluer(donnees), "#FF9800");
		}
	},

	/**
	 * @param {string} categorie
	 * @param {string|Function} message
	 * @param {*} [donnees]
	 */
	erreur(categorie, message, donnees = null) {
		if (this._actif(this.niveaux.ERREUR)) {
			this._loggerAvecStyle("❌", "ERROR", categorie, this._evaluer(message), this._evaluer(donnees), "#F44336");
		}
	},

	_loggerAvecStyle(emoji, niveau, categorie, message, donnees, couleur) {
		const timestamp = new Date().toLocaleTimeString();
		const logMessage = `${emoji} [${timestamp}] ${niveau} ${categorie}: ${message}`;
		console.log(`%c${logMessage}`, `color: ${couleur}; font-weight: bold;`);
		if (donnees !== null) {
			console.log("   Données:", donnees);
		}
	},

	demarrerSection(titre) {
		const ligne = "═".repeat(titre.length + 4);
		this.info("SYSTÈME", `╔${ligne}╗`);
		this.info("SYSTÈME", `║  ${titre}  ║`);
		this.info("SYSTÈME", `╚${ligne}╝`);
	},
};
