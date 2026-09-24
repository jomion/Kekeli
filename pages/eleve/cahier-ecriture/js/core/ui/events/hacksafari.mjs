export function refresh() {
	// Pour obliger à un rafraîcissement CSS
	const images = document.getElementById("images");
	images.style.opacity = "0.9999";
	new Promise((resolve) => setTimeout(resolve, 1)).then(() => {
		images.style.opacity = "1";
	});
}
