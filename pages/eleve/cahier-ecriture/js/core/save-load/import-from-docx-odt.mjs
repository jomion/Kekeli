export async function readDocxFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (event) => {
			const arrayBuffer = event.target.result;
			if (window.mammoth) {
				window.mammoth
					.convertToHtml({ arrayBuffer: arrayBuffer })
					.then((result) => resolve(result.value))
					.catch((err) => reject(err));
			} else {
				reject(new Error("mammoth.js is not loaded"));
			}
		};
		reader.onerror = () =>
			reject(new Error("Impossible de lire le fichier DOC/DOCX."));
		reader.readAsArrayBuffer(file);
	});
}

export async function readOdtFile(file) {
	return new Promise((resolve, reject) => {
		if (typeof window.ODF === "undefined") {
			reject(new Error("La bibliothèque odf.js n'est pas chargée."));
			return;
		}

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const arrayBuffer = event.target.result;
				const uint8Array = new Uint8Array(arrayBuffer);

				const odfDocument = await window.ODF.load(uint8Array);
				const textContent = await odfDocument.getText();
				resolve(textContent);
			} catch (error) {
				reject(
					new Error("Impossible de lire le fichier ODT : " + error.message)
				);
			}
		};

		reader.onerror = () =>
			reject(new Error("Erreur lors de la lecture du fichier ODT."));
		reader.readAsArrayBuffer(file);
	});
}

export function readFileAsText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target.result);
		reader.onerror = () => reject(new Error("Échec de la lecture du fichier."));
		reader.readAsText(file);
	});
}
