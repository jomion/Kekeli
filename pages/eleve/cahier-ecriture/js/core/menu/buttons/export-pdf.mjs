import { ouvrirDialoguePdf } from "../../pdf/index.mjs";

/**
 * Handler du bouton #export-pdf.
 * Attaché par menu.mjs via mapClicks.
 */
export function exportPdf() {
	ouvrirDialoguePdf();
}
