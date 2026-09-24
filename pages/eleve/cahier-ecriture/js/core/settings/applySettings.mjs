import { jours, joursRef } from "../../_locales/date-days.mjs";
import { config } from "../config.mjs";
import { changeDate, changeModeDate } from "../date/date.mjs";
import {
	ferme,
	checkboxMessage,
	divMessage,
	choixCouleurEntete,
	divEntete,
	texte_principal,
	texte_marge,
	texte_marge_complementaire,
	graphismes,
	images,
	selectLangue,
	inputEspacement,
	inputEspacementMots,
	inputLargeurImpression,
	inputEcrireACheval,
	checkboxMajDateAuto,
	choix_police,
	checkboxVerifierOrthographe,
	checkboxFermerLeS,
} from "../utils/dom.mjs";
import { reaffecteEventsImages } from "../menu/buttons/insert-image.mjs";
import { opacite } from "../menu/buttons/options-panel.mjs";
import { decompresserHTML } from "../save-load/compression.mjs";
import { checkHash } from "../save-load/importFromHash.mjs";
import {
	changeEcrireACheval,
	changeEspacementLettres,
	changeEspacementMots,
	changeInterligneDouble,
	changeLargeurImpression,
	changeVerifieOrthographe,
	changeS,
} from "../text-format/change-display.mjs";
import { adapteCouleurBordureChoixCouleur } from "../ui/display/ui-colors.mjs";
import { change_police } from "../text-format/fonts/fonts.mjs";
import { changeCarreaux } from "../ui/layout/background.mjs";
import { calculeNombreDeCarreaux } from "../ui/layout/getSize.mjs";
import { changeLangue, loadLanguage } from "../ui/language.mjs";
import {
	regleMarge,
	regleMargeSecondaire,
} from "../ui/layout/margin-manager.mjs";
import { resetContent } from "../ui/content/resetContent.mjs";
import { zoom } from "../ui/zoom/zoom.mjs";

export function applySettings() {
	checkboxMessage.checked = config.afficherMessage;
	if (!config.afficherMessage) {
		ferme(divMessage);
	} else {
		divMessage.style.opacity = "1";
	}

	if (config.couleursJours) {
		try {
			for (let key in JSON.parse(config.couleursJours)) {
				jours[key] = JSON.parse(config.couleursJours)[key];
			}
		} catch (e) {
			console.error("Valeur non parsable :", e);
			for (let key in joursRef) {
				jours[key] = joursRef[key];
			}
		}
	} else {
		for (let key in joursRef) {
			jours[key] = joursRef[key];
		}
	}

	const jourActif = document.getElementById("select-jours").value;
	divEntete.style.backgroundColor = jours[jourActif];
	choixCouleurEntete.value = choixCouleurEntete.style.backgroundColor =
		jours[jourActif];

	inputEspacement.value = config.espacementLettres;
	inputEspacementMots.value = config.espacementMots;
	inputEcrireACheval.checked = config.ecrireAChevalSurLaMarge;
	checkboxMajDateAuto.checked = config.majDateAuto;
	checkboxFermerLeS.checked = config.fermetureDuS;

	changeEcrireACheval();
	adapteCouleurBordureChoixCouleur();

	regleMarge(config.largeur_marge);
	regleMargeSecondaire(config.largeur_marge_secondaire);

	choix_police.value = config.police_active;
	change_police(config.police_active);
	changeCarreaux(config.typeCarreaux);
	opacite(config.opaciteLignes);
	zoom(false, config.largeur_carreau, config.police_active);
	changeModeDate();
	resetContent();

	const contentFromHash = checkHash(
		config.contenuTextePrincipal,
		config.contenuGraphismes,
	);

	config.contenuTextePrincipal = contentFromHash.contenuTextePrincipal;
	config.contenuGraphismes = contentFromHash.contenuGraphismes;

	changeEspacementLettres(config.espacementLettres);
	changeEspacementMots(config.espacementMots);
	opacite(config.opaciteLignes);

	checkboxVerifierOrthographe.checked = config.verifierOrthographe;
	changeVerifieOrthographe();
	changeInterligneDouble();
	changeS();

	inputLargeurImpression.value = config.largeurImpression;
	changeLargeurImpression();

	if (
		config.contenuTextePrincipal != '""' &&
		config.contenuTextePrincipal != null
	) {
		texte_principal.innerHTML = decompresserHTML(config.contenuTextePrincipal);
	}
	if (config.contenuTexteMarge != '""') {
		texte_marge.innerHTML = decompresserHTML(config.contenuTexteMarge);
	}
	if (config.contenuTexteMargeComplementaire != '""') {
		texte_marge_complementaire.innerHTML =
			config.contenuTexteMargeComplementaire;
	}
	if (config.contenuGraphismes != '""') {
		graphismes.innerHTML = config.contenuGraphismes;
	}
	if (config.contenuImages != '""') {
		images.innerHTML = config.contenuImages;
	}
	reaffecteEventsImages();
	calculeNombreDeCarreaux();

	selectLangue.value = config.langueChoix;
	if (config.langue !== "fr") {
		changeLangue(config.langueChoix);
	}

	if (config.majDateAuto) changeDate();

	loadLanguage(config.langue);
}
