import { jours } from "../../_locales/date-days.mjs";
import {
	bouton_ligatures,
	choixCouleurEntete,
	divEntete,
} from "../utils/dom.mjs";
import { adapteCouleurBordureChoixCouleur } from "../ui/display/ui-colors.mjs";
import { loadSettings } from "./loadSettings.mjs";
import { applySettings } from "./applySettings.mjs";
import { handleInitialWarningMessage } from "./initialWarningMessage.mjs";

export async function initSettings() {
	handleInitialWarningMessage();
	bouton_ligatures.style.display = "none";
	const jourActifDepart = document.getElementById("select-jours").value;
	const couleurDepart = jours[jourActifDepart];
	choixCouleurEntete.value = couleurDepart;
	divEntete.style.backgroundColor = couleurDepart;
	choixCouleurEntete.style.backgroundColor = couleurDepart;
	adapteCouleurBordureChoixCouleur();
	await loadSettings();
	applySettings();
}
