/* Intégration KEKELI (24 septembre 2026) : regroupement par catégories des
   boutons de la barre d'outils du cahier d'écriture (demande explicite,
   suite de la confusion sur le lot précédent : « Je parle des boutons de
   formatage du cahier d'écriture »). Ce fichier est un AJOUT Kekeli,
   chargé APRÈS script.min.js (le paquet minifié d'origine de Seyes, seul
   fichier réellement exécuté par la page — les sources .mjs de js/core/
   ne sont que des fichiers de correspondance pour les cartes source,
   jamais chargées par index.html, vérifié avant d'écrire ce fichier).
   Aucun fichier de js/core/ ni script.min.js n'est modifié : ce script se
   contente de DÉPLACER (jamais cloner) les boutons déjà existants dans de
   nouveaux panneaux dépliables. Comme le code d'origine retrouve chaque
   bouton par son identifiant (voir js/core/utils/dom.mjs : `get = (id) =>
   document.getElementById(id)`), déplacer un bouton ailleurs dans le DOM
   ne change ni son identifiant ni les écouteurs déjà attachés par
   script.min.js — son comportement reste strictement identique, seule sa
   position visuelle change. */
(function () {
	"use strict";

	function byId(id) {
		return document.getElementById(id);
	}

	// Renvoie l'élément à déplacer comme une seule unité pour l'identifiant
	// donné : le span .multibouton englobant s'il existe (bouton + flèche de
	// choix de couleur, déjà groupés dans le HTML d'origine), sinon
	// l'élément lui-même.
	function uniteBouton(id) {
		const el = byId(id);
		if (!el) return null;
		return el.closest(".multibouton") || el;
	}

	const GROUPES = [
		{
			cle: "fichier",
			icone: "📁",
			label: "Fichier",
			elements: function () {
				// Toute la section "Fichier" d'origine (nouveau / enregistrer /
				// ouvrir / importer CodiMD / imprimer / export PDF / exporter
				// comme lien) est déplacée EN UN SEUL BLOC (span.section), pour
				// ne jamais séparer un bouton des fenêtres qui lui sont
				// associées (confirmation, import, export de lien).
				const bouton = byId("nouveau");
				const section = bouton ? bouton.closest(".section") : null;
				return section ? [section] : [];
			},
		},
		{
			cle: "affichage",
			icone: "🔍",
			label: "Affichage",
			elements: function () {
				return [
					byId("zoom_out"),
					byId("zoom_in"),
					byId("zoneInputNombreDeCarreaux"),
					byId("carreaux"),
					byId("fullscreen"),
					byId("options"),
				].filter(Boolean);
			},
		},
		{
			cle: "police",
			icone: "🔤",
			label: "Police",
			elements: function () {
				return [
					byId("bouton_ligatures"),
					byId("label_choix_police"),
					byId("choix_police"),
				].filter(Boolean);
			},
		},
		{
			cle: "forme",
			icone: "🎨",
			label: "Mise en forme",
			elements: function () {
				return [
					byId("left"),
					byId("center"),
					byId("right"),
					byId("bouton_lirecouleur"),
					byId("boutonBarre"),
					uniteBouton("couleur-texte"),
					uniteBouton("souligne"),
					uniteBouton("couleur-surlignement"),
					byId("bouton_entoure"),
					byId("bouton_clear_format"),
				].filter(Boolean);
			},
		},
		{
			cle: "outils",
			icone: "🧰",
			label: "Outils",
			elements: function () {
				return [byId("bouton_image"), byId("inputFichier"), byId("regle"), byId("timer")].filter(Boolean);
			},
		},
		{
			cle: "aide",
			icone: "❓",
			label: "Aide",
			elements: function () {
				return [byId("a_propos"), byId("aide")].filter(Boolean);
			},
		},
	];

	// Sélecteurs des fenêtres/panneaux flottants déjà existants dans Seyes
	// (position fixed, en dehors du flux normal) : un clic à l'intérieur de
	// l'un d'eux ne doit jamais refermer un panneau de catégorie Kekeli
	// resté ouvert derrière (ex. choisir une couleur dans le sous-menu de
	// "couleur-texte", une fois son groupe "Mise en forme" ouvert).
	const SELECTEUR_POPUPS_SEYES = ".deroule, #panneauOptions, .lightbox, #datepicker";

	function fermerTousLesPanneaux() {
		document.querySelectorAll(".kekeli-groupe-panel").forEach(function (p) {
			p.classList.add("hide");
		});
		document.querySelectorAll(".kekeli-groupe-toggle").forEach(function (b) {
			b.classList.remove("kekeli-groupe-ouvert");
			b.setAttribute("aria-expanded", "false");
		});
	}

	function positionnerPanneau(panneau, bouton) {
		const rect = bouton.getBoundingClientRect();
		panneau.style.top = Math.round(rect.bottom + 4) + "px";
		panneau.style.left = Math.round(rect.left) + "px";
		// Une fois affiché (donc mesurable), recale le panneau s'il dépasse à
		// droite de l'écran — même principe que le recalage déjà utilisé côté
		// Kekeli pour les sous-menus de la sidebar premium élève.
		requestAnimationFrame(function () {
			const largeur = panneau.offsetWidth;
			const maxLeft = window.innerWidth - largeur - 8;
			if (rect.left > maxLeft) {
				panneau.style.left = Math.max(8, Math.round(maxLeft)) + "px";
			}
		});
	}

	function initGroupesBarre() {
		const barre = byId("barre");
		if (!barre) return; // structure inattendue : ne rien casser en silence

		GROUPES.forEach(function (groupe) {
			const elements = groupe.elements();
			if (!elements.length) return; // rien à regrouper pour cette catégorie

			const panneau = document.createElement("div");
			panneau.className = "kekeli-groupe-panel hide";
			panneau.id = "kekeliPanneau-" + groupe.cle;

			const bouton = document.createElement("button");
			bouton.type = "button";
			bouton.className = "kekeli-groupe-toggle";
			bouton.id = "kekeliBouton-" + groupe.cle;
			bouton.setAttribute("aria-controls", panneau.id);
			bouton.setAttribute("aria-expanded", "false");
			bouton.title = groupe.label;
			bouton.innerHTML =
				'<span aria-hidden="true">' +
				groupe.icone +
				"</span><span>" +
				groupe.label +
				'</span><span class="kekeli-groupe-chevron" aria-hidden="true">▾</span>';

			bouton.addEventListener("click", function (e) {
				e.stopPropagation();
				const dejaOuvert = !panneau.classList.contains("hide");
				fermerTousLesPanneaux();
				if (dejaOuvert) return;
				positionnerPanneau(panneau, bouton);
				panneau.classList.remove("hide");
				bouton.classList.add("kekeli-groupe-ouvert");
				bouton.setAttribute("aria-expanded", "true");
			});

			// Insère le bouton-déclencheur à l'endroit du premier élément
			// déplacé, pour garder un ordre de lecture proche de l'original,
			// PUIS déplace (jamais ne clone) chaque élément dans le panneau.
			elements[0].parentNode.insertBefore(bouton, elements[0]);
			elements.forEach(function (el) {
				panneau.appendChild(el);
			});
			barre.appendChild(panneau);
		});

		// Ferme le panneau ouvert au clic en dehors de la barre, et à l'appui
		// sur Échap — comportement déjà attendu de ce type de menu ailleurs
		// sur le site Kekeli.
		document.addEventListener("click", function (e) {
			if (
				e.target.closest(".kekeli-groupe-panel") ||
				e.target.closest(".kekeli-groupe-toggle") ||
				e.target.closest(SELECTEUR_POPUPS_SEYES)
			) {
				return;
			}
			fermerTousLesPanneaux();
		});
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") fermerTousLesPanneaux();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initGroupesBarre);
	} else {
		initGroupesBarre();
	}
})();
