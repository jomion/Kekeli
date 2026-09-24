import { majDimensionsPrint } from "../display/print.mjs";
import { calculeNombreDeCarreaux } from "../layout/getSize.mjs";

export function handleResize() {
	window.addEventListener("resize", () => {
		calculeNombreDeCarreaux();
		majDimensionsPrint();
	});
}
