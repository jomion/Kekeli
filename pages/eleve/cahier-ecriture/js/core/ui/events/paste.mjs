import { refresh } from "./hacksafari.mjs";

export function handlePasteEvent() {
	document.addEventListener("paste", function (e) {
		e.preventDefault(); // Empêcher le comportement par défaut

		let clipboardData = e.clipboardData || e.originalEvent.clipboardData;

		// Gestion du texte
		let text = clipboardData.getData("text/plain");
		if (text) {
			text = text.replace(/<[^>]*>/g, ""); // Supprime les balises HTML
			document.execCommand("insertText", false, text);
		}

		// Gestion des images
		let items = clipboardData.items;
		for (let item of items) {
			if (item.type.indexOf("image") !== -1) {
				let file = item.getAsFile();
				let reader = new FileReader();

				reader.onload = function (event) {
					let img = document.createElement("img");
					img.src = event.target.result;
					img.style.maxWidth = "100%"; // Ajustement du style si nécessaire
					document.execCommand("insertHTML", false, img.outerHTML);
				};

				reader.readAsDataURL(file);
			}
		}
	});

	refresh();
}
