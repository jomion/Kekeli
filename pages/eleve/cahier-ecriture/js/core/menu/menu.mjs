import {
	changeDate,
	changeJour,
	ouvreSelecteurDate,
	changeModeDate,
	toogleMajDateAuto,
} from "../date/date.mjs";
import { ouvreBoutonsCouleurs } from "./buttons/choose-text-color.mjs";
import { opacite, ouvreOptions } from "./buttons/options-panel.mjs";
import { ouvreBoutonsSouligne } from "./buttons/underline.mjs";
import { ouvreBoutonsCarreau } from "./buttons/tiles.mjs";
import { cree_image } from "./buttons/insert-image.mjs";
import { cree_timer } from "./buttons/insert-timer.mjs";
import { activeRegle, changeCouleurTrait } from "./buttons/ruler.mjs";
import { menu_copier_lien, copier } from "../save-load/copyLink.mjs";
import { pleinecran } from "../ui/display/fullScreen.mjs";
import { align } from "../text-format/align.mjs";
import { entoure } from "../text-format/highlight.mjs";
import { souligne } from "../text-format/underline.mjs";
import { barre } from "../text-format/cross.mjs";
import { supprimerFormatage } from "../text-format/clear-format.mjs";
import { couleurTexte } from "../text-format/text-color.mjs";
import { colorierSyllabes } from "../text-format/syllables.mjs";
import { changeCouleurEntete } from "../ui/display/ui-colors.mjs";
import {
	changeEcrireACheval,
	changeEspacementLettres,
	changeEspacementMots,
	changeInterligneDouble,
	changeLargeurImpression,
	changeVerifieOrthographe,
	changeS,
} from "../text-format/change-display.mjs";
import { traiteInputCodi } from "../save-load/import-from-markdown.mjs";
import { ligatures, change_police } from "../text-format/fonts/fonts.mjs";
import { ouvrir, prepareEnregistrement } from "../save-load/files.mjs";
import { changeLangue } from "../ui/language.mjs";
import { ouvre, get, divIllustration } from "../utils/dom.mjs";
import { zoom } from "../ui/zoom/zoom.mjs";
import { zoomAutoCarreaux } from "../ui/zoom/zoomTiles.mjs";
import { imprimer } from "../ui/display/print.mjs";
import { nouveauTexte } from "./buttons/newDocument.mjs";
import { exportPdf } from "./buttons/export-pdf.mjs";
import { importMarkdownButton } from "./buttons/importMarkdown.mjs";
import { handleNoButton, handleYesButton } from "./buttons/yes-no-buttons.mjs";
import { handleCloseButtons } from "./buttons/close-buttons.mjs";
import { openAbout } from "./buttons/about.mjs";
import { handleColorButtons } from "./buttons/color-buttons.mjs";
import { ouvreBoutonsSurlignement } from "./buttons/choose-highlight-color.mjs";
import { couleurSurlignement } from "../text-format/highlight-color.mjs";

export function initMenu() {
	// Gestion des clics sur les boutons du menu
	const mapClicks = {
		nouveau: nouveauTexte,
		enregistrer: prepareEnregistrement,
		ouvrir: ouvrir,
		imprimer: imprimer,
		"export-pdf": exportPdf,
		codi: importMarkdownButton,
		copielien: menu_copier_lien,
		copier: copier,
		date: changeDate,
		bouton_deroule_date: ouvreSelecteurDate,
		zoom_out: () => {
			zoom(-10);
		},
		zoom_in: () => {
			zoom(10);
		},
		carreaux: ouvreBoutonsCarreau,
		bouton_ligatures: ligatures,
		left: () => {
			align("left");
		},
		center: () => {
			align("center");
		},
		right: () => {
			align("right");
		},
		"couleur-texte": (e) => {
			couleurTexte(e.currentTarget.value);
		},
		bouton_deroule_couleurs: ouvreBoutonsCouleurs,
		souligne: (e) => {
			souligne(e.currentTarget.value);
		},
		bouton_deroule_souligne: ouvreBoutonsSouligne,
		"couleur-surlignement": (e) => {
			couleurSurlignement(e.currentTarget.value);
		},
		bouton_deroule_surlignement: ouvreBoutonsSurlignement,
		bouton_entoure: entoure,
		bouton_lirecouleur: colorierSyllabes,
		regle: activeRegle,
		a_propos: openAbout,
		aide: () => {
			ouvre(divIllustration);
		},
		fullscreen: pleinecran,
		timer: cree_timer,
		options: ouvreOptions,
		panneauOptions_close_button: ouvreOptions,
		oui: handleYesButton,
		non: handleNoButton,
		boutonBarre: barre,
		bouton_clear_format: supprimerFormatage,
	};

	Object.keys(mapClicks).forEach((id) => {
		const el = get(id);
		if (el) el.addEventListener("click", mapClicks[id]);
	});

	// Gestion des événements "change" dans les éléments du menu
	const mapChanges = {
		choix_police: change_police,
		inputEcrireACheval: changeEcrireACheval,
		inputOpacite: opacite,
		checkboxInterligneDouble: changeInterligneDouble,
		checkboxFermerLeS: changeS,
		checkboxAjouterDate: changeModeDate,
		checkboxMajDateAuto: toogleMajDateAuto,
		checkboxSoulignerDate: changeModeDate,
		checkboxVerifierOrthographe: changeVerifieOrthographe,
		inputLargeurImpression: changeLargeurImpression,
		selectLangue: changeLangue,
		inputNombreDeCarreaux: zoomAutoCarreaux,
	};

	Object.keys(mapChanges).forEach((id) => {
		const el = get(id);
		if (el)
			el.addEventListener("change", (e) => {
				mapChanges[id](e.currentTarget.value);
			});
	});

	// Gestion des événements "input" dans les éléments du menu
	const mapInputs = {
		inputEspacement: changeEspacementLettres,
		inputEspacementMots: changeEspacementMots,
		inputOpacite: opacite,
		inputCodi: traiteInputCodi,
		inputCouleurTrait: changeCouleurTrait,
		"choix-couleur-entete": changeCouleurEntete,
		selectJours: changeJour,
		inputFichier: cree_image,
	};

	Object.keys(mapInputs).forEach((id) => {
		const el = get(id);
		if (el)
			el.addEventListener("input", (e) => {
				if (id == "inputFichier") {
					mapInputs[id](e);
				} else {
					mapInputs[id](e.currentTarget.value);
				}
			});
	});

	handleCloseButtons();
	handleColorButtons();
}
