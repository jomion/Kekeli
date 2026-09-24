export function handleCloseButtons() {
	document.querySelectorAll(".bouton-fermer").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const lb = e.currentTarget.closest(".lightbox");
			if (lb) lb.classList.add("hide");
			const db = document.getElementById("darkbox");
			if (db) db.classList.add("hide");
		});
	});
}
