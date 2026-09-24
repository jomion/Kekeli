export function ouvreOptions() {
	const divPanneauOptions = document.getElementById("panneauOptions");
	if (!divPanneauOptions) return;
	divPanneauOptions.classList.toggle("hide");
}

export function opacite(valeur) {
	const inputOpacite = document.getElementById("inputOpacite");
	const voile_page = document.getElementById("voile_page");
	const voile_marge = document.getElementById("voile_marge");
	const voile_marge2 = document.getElementById("voile_marge2");
	if (typeof valeur === "string") valeur = parseFloat(valeur);
	if (inputOpacite) inputOpacite.value = valeur;
	if (voile_page)
		voile_page.style.backgroundColor =
			"rgba(255,255,255," + (+1 - valeur) + ")";
	if (voile_marge)
		voile_marge.style.backgroundColor =
			"rgba(255,255,255," + (+1 - valeur) + ")";
	if (voile_marge2)
		voile_marge2.style.backgroundColor =
			"rgba(255,255,255," + (+1 - valeur) + ")";
	try {
		localStorage.setItem("seyes-opacite-lignes", valeur);
	} catch (error) {
		console.error(error);
	}
}
