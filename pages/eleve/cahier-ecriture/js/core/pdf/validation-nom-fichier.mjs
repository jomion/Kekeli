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
 * Validation et génération du nom de fichier PDF.
 *
 * Fonctions pures extraites de dialogue-pdf.mjs (plan refactoring Phase 1).
 * Aucun état, aucun DOM.
 */

/**
 * Génère un nom de fichier par défaut au format `seyes-DD-MM-YYYY` (sans
 * extension). Utilise la date courante du système.
 *
 * @returns {string}
 */
export function genererNomFichierDefaut() {
	const date = new Date();
	const jour = String(date.getDate()).padStart(2, "0");
	const mois = String(date.getMonth() + 1).padStart(2, "0");
	const annee = date.getFullYear();
	return `seyes-${jour}-${mois}-${annee}`;
}

/**
 * Nettoie un nom saisi par l'utilisateur pour qu'il soit compatible cross-
 * platform (Windows, macOS, Linux) et ajoute l'extension `.pdf`.
 *
 * Règles appliquées :
 * - Remplace les caractères interdits `\/:*?"<>|` par un tiret.
 * - Retire les points en début (fichier caché Unix).
 * - Trim des espaces.
 * - Compacte les tirets multiples en un seul.
 * - Tronque à 200 caractères (hors extension).
 * - Fallback sur `genererNomFichierDefaut()` si vide/non-string/vide après
 *   nettoyage.
 *
 * @param {string} nom - Nom saisi par l'utilisateur.
 * @returns {string} Nom nettoyé, terminé par `.pdf`.
 */
export function validerNomFichier(nom) {
	if (!nom || typeof nom !== "string") {
		return genererNomFichierDefaut() + ".pdf";
	}

	let nomNettoye = nom.replace(/\.pdf$/i, "");
	nomNettoye = nomNettoye.replace(/[\\/:*?"<>|]/g, "-");
	nomNettoye = nomNettoye.replace(/^\.+/, "");
	nomNettoye = nomNettoye.trim();
	nomNettoye = nomNettoye.replace(/-+/g, "-");

	if (nomNettoye.length > 200) {
		nomNettoye = nomNettoye.substring(0, 200);
	}

	if (!nomNettoye) {
		nomNettoye = genererNomFichierDefaut();
	}

	return nomNettoye + ".pdf";
}
