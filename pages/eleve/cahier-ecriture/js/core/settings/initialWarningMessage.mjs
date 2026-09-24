import { config } from "../config.mjs";
import { stocke } from "./read-write.mjs";

export function handleInitialWarningMessage() {
	document.querySelectorAll("#show-warning-next-time").forEach((cb) => {
		cb.addEventListener("change", (e) => {
			stocke(
				`afficher-message${config.numeroMessage}`,
				e.currentTarget.checked
			);
		});
	});
}
