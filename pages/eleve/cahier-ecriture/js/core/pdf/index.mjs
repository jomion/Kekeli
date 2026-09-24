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
 * Point d'entrée de la feature PDF.
 *
 * Charge le CSS du dialogue (bundlé par rollup-plugin-postcss dans
 * styles.min.css) et ré-exporte l'API publique pour les consommateurs
 * (main.mjs pour l'init, menu/buttons/export-pdf.mjs pour l'attachement
 * du bouton #export-pdf).
 */

import "../../../css/pdf.css";

export { initDialoguePdf, ouvrirDialoguePdf, DialoguePdf } from "./dialogue-pdf.mjs";
