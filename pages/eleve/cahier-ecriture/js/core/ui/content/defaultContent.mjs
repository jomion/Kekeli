import { calculeDate } from "../../date/date.mjs";
import { getLang } from "../language.mjs";

export async function defaultContent(isOffline) {
	let date = calculeDate();
	let lang = getLang();
	let text;

	if (isOffline || lang === "fr" || !lang) {
		text = "Modifiez-moi";
	} else {
		const response = await fetch(`./js/_locales/${lang}.json`);
		const translations = await response.json();
		text = translations["modifiezMoi_content"] || "Modifiez-moi...";
	}

	return `
		  <div id="divDate"><span>${date}</span></div>
		  <br>
		  ${text}    
	 `;
}
