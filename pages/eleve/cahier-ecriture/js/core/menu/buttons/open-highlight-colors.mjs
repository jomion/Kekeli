export function ouvreBoutonsSurlignement(event) {
    if (event) event.stopPropagation();
    const rect = document.getElementById("couleur-surlignement")
        ? document.getElementById("couleur-surlignement").getBoundingClientRect()
        : null;
    if (!rect) return;
    let positionLeft = rect.left;
    const el = document.getElementById("boutons-couleur-surlignement");
    if (!el) return;
    el.style.left = positionLeft + "px";
    el.classList.toggle("hide");
}
