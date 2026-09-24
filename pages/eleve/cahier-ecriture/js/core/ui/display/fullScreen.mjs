import { fullscreen, site } from "../../utils/dom.mjs";

let pleinecran_on = false;

export function pleinecran() {
	if (pleinecran_on) {
		fullscreen.style.backgroundPosition = null;
		pleinecran_sortir();
	} else {
		fullscreen.style.backgroundPosition = "0% 0%";
		pleinecran_ouvrir();
	}
	pleinecran_on = !pleinecran_on;
}

function pleinecran_ouvrir() {
	// Demande le mode plein écran pour l'élément
	if (site.requestFullscreen) {
		site.requestFullscreen();
	} else if (site.mozRequestFullScreen) {
		// Pour Firefox
		site.mozRequestFullScreen();
	} else if (site.webkitRequestFullscreen) {
		// Pour Chrome, Safari et Opera
		site.webkitRequestFullscreen();
	} else if (site.msRequestFullscreen) {
		// Pour Internet Explorer et Edge
		site.msRequestFullscreen();
	}
}

function pleinecran_sortir() {
	// Pour sortir du mode plein écran
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.mozCancelFullScreen) {
		// Pour Firefox
		document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		// Pour Chrome, Safari et Opera
		document.webkitExitFullscreen();
	} else if (document.msExitFullscreen) {
		// Pour Internet Explorer et Edge
		document.msExitFullscreen();
	}
}
