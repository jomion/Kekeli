import { config } from "../config.mjs";
import {
	checkboxAjouterDate,
	checkboxMajDateAuto,
	checkboxSoulignerDate,
	choixCouleurEntete,
	divEntete,
	texte_principal,
} from "../utils/dom.mjs";
import { stocke } from "../settings/read-write.mjs";
import { adapteCouleurBordureChoixCouleur } from "../ui/display/ui-colors.mjs";
import { jours, nomJours } from "../../_locales/date-days.mjs";
import { nomMois } from "../../_locales/date-months.mjs";
import flatpickr from "../../lib/flatpickr.mjs";
import { flatpickrFrench } from "../../_locales/flatpickr-fr.mjs";
import { flatpickrItalian } from "../../_locales/flatpickr-it.mjs";
import { flatpickrOccitan } from "../../_locales/flatpickr-oc.mjs";

export function calculeDate(format = "complet", date = null) {
	// helper pour convertir/valider en Date
	const normalize = (d) => {
		let dt = d ? (d instanceof Date ? d : new Date(d)) : new Date();
		if (!(dt instanceof Date) || isNaN(dt.getTime())) {
			dt = new Date();
		}
		return dt;
	};

	let options;

	switch (format) {
		case "complet":
			options = {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			};
			break;
		case "sansJour":
			options = { year: "numeric", month: "long", day: "numeric" };
			break;
		case "sansAnnee":
			options = { weekday: "long", month: "long", day: "numeric" };
			break;
		case "court": {
			const dateObj = normalize(date);
			const dateCourt = `${dateObj.getDate().toString().padStart(2, "0")}/${(
				dateObj.getMonth() + 1
			)
				.toString()
				.padStart(2, "0")}/${dateObj.getFullYear()}`;

			return dateCourt;
		}
		default:
			options = {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			};
	}

	const dateObj = normalize(date);

	let dateDuJour = dateObj.toLocaleDateString(config.langue, options);

	dateDuJour = dateDuJour.replace(/\b1\b/, '1<span class="exposant">er</span>');

	let date_formatee = dateDuJour.charAt(0).toUpperCase() + dateDuJour.slice(1);

	if (config.langue === "oc") {
		date_formatee = traduireDateEnOccitan(date_formatee);
	}

	return date_formatee;
}

export function traduireDateEnOccitan(dateStr) {
	for (let jour of nomJours) {
		const regexJour = new RegExp(`\\b${jour.fr}\\b`, "g");
		dateStr = dateStr.replace(regexJour, jour.oc);
	}
	for (let mois of nomMois) {
		const regexMois = new RegExp(`\\b${mois.fr}\\b`, "g");
		dateStr = dateStr.replace(regexMois, mois.oc);
	}
	return dateStr;
}

export function creeDate() {
	const nouveauSpan = document.createElement("span");
	nouveauSpan.innerHTML = calculeDate();
	const divDate = document.createElement("div");
	divDate.id = "divDate";
	divDate.appendChild(nouveauSpan);
	if (config.soulignerLaDate) {
		nouveauSpan.style.textDecoration = "underline red";
	}
	texte_principal.prepend(divDate);
	const br2 = document.createElement("br");
	texte_principal.insertBefore(br2, divDate.nextSibling);
}

let calendarInstance = null;

let flatpickrLocalization = "";

export async function ouvreSelecteurDate() {
	const datepickerDiv = document.getElementById("datepicker");
	const inputDate = document.getElementById("date-input");
	if (!datepickerDiv || !inputDate) return;
	const rect = document.getElementById("date").getBoundingClientRect();
	let positionLeft = rect.left;
	datepickerDiv.classList.remove("hide");
	const flatpickrCalendar = document.querySelector(".flatpickr-calendar");
	if (flatpickrCalendar) {
		flatpickrCalendar.style.left = positionLeft + "px";
		flatpickrCalendar.classList.remove("hide");
	}
	inputDate.focus();
	if (!calendarInstance) {
		// on charge le CSS de flatpickr pour la première fois
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "./js/lib/flatpickr.min.css";
		document.head.appendChild(link);
		// On attend que le CSS soit chargé
		await new Promise((resolve, reject) => {
			link.onload = resolve;
			link.onerror = reject;
		});
	}
	if (!calendarInstance || flatpickrLocalization !== config.langue) {
		flatpickrLocalization = config.langue;
		let flatpickrLocales;
		// localization de flatpickr
		switch (config.langue) {
			case "fr":
				flatpickrLocales = flatpickrFrench;
				break;
			case "it":
				flatpickrLocales = flatpickrItalian;
				break;
			case "oc":
				flatpickrLocales = flatpickrOccitan;
				break;
			default:
				break;
		}
		calendarInstance = flatpickr(inputDate, {
			inline: true,
			dateFormat: "Y-m-d",
			locale: flatpickrLocales,
			onChange: function (selectedDates) {
				changeDate && changeDate(selectedDates[0]);
				datepickerDiv.classList.add("hide");
				const flatpickrCalendar = document.querySelector(".flatpickr-calendar");
				if (flatpickrCalendar) flatpickrCalendar.classList.add("hide");
			},
		});

		const flatpickrCalendar2 = document.querySelector(".flatpickr-calendar");
		if (flatpickrCalendar2) {
			flatpickrCalendar2.style.left = positionLeft + "px";
			flatpickrCalendar2.classList.remove("hide");
		}
	}
}

export function changeDate(date = null) {
	let dateAutiliser = null;
	if (date) {
		dateAutiliser = calculeDate("complet", date);
	} else {
		dateAutiliser = calculeDate();
	}
	const divDate = document.getElementById("divDate");
	if (!divDate) {
		creeDate();
		return;
	}
	const nouveauSpan = document.createElement("span");
	nouveauSpan.innerHTML = dateAutiliser;
	if (config.soulignerLaDate) {
		nouveauSpan.style.textDecoration = "underline red";
	}
	config.dateDuDoc = dateAutiliser;
	divDate.innerHTML = "";
	divDate.appendChild(nouveauSpan);
}

export function changeJour(jour) {
	// Récupérer la couleur du jour depuis l'objet jours
	let couleur = jours[jour];

	// Appliquer la couleur en arrière-plan de divEntete
	divEntete.style.backgroundColor = couleur;
	choixCouleurEntete.value = choixCouleurEntete.style.backgroundColor = couleur;
	adapteCouleurBordureChoixCouleur();
}

export function changeModeDate() {
	config.ajouterLaDate = checkboxAjouterDate.checked;
	config.soulignerLaDate = checkboxSoulignerDate.checked;
	stocke("ajouter-date", config.ajouterLaDate);
	stocke("souligner-date", config.soulignerLaDate);
	const divDate = document.getElementById("divDate");
	if (divDate) {
		if (config.soulignerLaDate) {
			divDate.querySelector("span").style.textDecoration = "underline red";
		} else {
			divDate.querySelector("span").style.textDecoration = null;
		}
	}
}

export function toogleMajDateAuto() {
	config.majDateAuto = checkboxMajDateAuto.checked;
	stocke("maj-date-auto", config.majDateAuto);
	if (config.majDateAuto) changeDate();
}
