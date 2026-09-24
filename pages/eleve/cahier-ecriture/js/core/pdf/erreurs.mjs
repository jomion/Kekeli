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
 * Classe d'erreur spécialisée pour les opérations PDF Seyès.
 *
 * Porte un `type` (catégorie, ex: "POLICE_NON_TROUVEE"), un `message` lisible,
 * un objet `details` libre et un `timestamp`.
 */
export class ErreurSeyes extends Error {
	/**
	 * @param {string} type - Type d'erreur (ex: "POLICE_NON_TROUVEE")
	 * @param {string} message - Message d'erreur explicite
	 * @param {Object} details - Détails additionnels
	 */
	constructor(type, message, details = {}) {
		super(message);
		this.name = "ErreurSeyes";
		this.type = type;
		this.details = details;
		this.timestamp = new Date().toISOString();
	}
}
