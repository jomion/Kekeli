// ========================================
// SUPPRESSION DU FORMATAGE
// ========================================

import { nettoyerSpans } from "./helpers.mjs";

const TOUTES_LES_CLASSES = [
	"souligne-red",
	"souligne-blue",
	"souligne-green",
	"souligne-yellow",
	"souligne-pink",
	"souligne-black",
	"souligne-purple",
	"souligne-orange",
	"textebarre",
	"couleur-red",
	"couleur-coral",
	"couleur-salmon",
	"couleur-orange",
	"couleur-gold",
	"couleur-yellow",
	"couleur-lime",
	"couleur-green",
	"couleur-olive",
	"couleur-teal",
	"couleur-cyan",
	"couleur-blue",
	"couleur-navy",
	"couleur-indigo",
	"couleur-purple",
	"couleur-magenta",
	"couleur-pink",
	"couleur-beige",
	"couleur-brown",
	"couleur-gray",
	"couleur-silver",
	"couleur-black",
	"couleur-white",
	"couleur-transparent",
	"surlignement-red",
	"surlignement-coral",
	"surlignement-salmon",
	"surlignement-orange",
	"surlignement-gold",
	"surlignement-yellow",
	"surlignement-lime",
	"surlignement-green",
	"surlignement-olive",
	"surlignement-teal",
	"surlignement-cyan",
	"surlignement-blue",
	"surlignement-navy",
	"surlignement-indigo",
	"surlignement-purple",
	"surlignement-magenta",
	"surlignement-pink",
	"surlignement-beige",
	"surlignement-brown",
	"surlignement-gray",
	"surlignement-silver",
	"surlignement-black",
	"surlignement-white",
	"surlignement-transparent",
];

export function supprimerFormatage() {
	const sel = window.getSelection();
	if (!sel.rangeCount) return;

	const range = sel.getRangeAt(0);
	if (range.collapsed) return;

	let editableParent = range.commonAncestorContainer;
	if (editableParent.nodeType === Node.TEXT_NODE) {
		editableParent = editableParent.parentElement;
	}
	while (
		editableParent &&
		editableParent.nodeType === Node.ELEMENT_NODE &&
		!editableParent.hasAttribute("contenteditable")
	) {
		editableParent = editableParent.parentElement;
	}

	// Sauvegarder la position
	const texteAvantSelection = range.cloneRange();
	texteAvantSelection.selectNodeContents(editableParent);
	texteAvantSelection.setEnd(range.startContainer, range.startOffset);
	const startOffset = texteAvantSelection.toString().length;
	const endOffset = startOffset + range.toString().length;

	// Supprimer les spans .entoure dans la sélection (unwrap)
	const entoures = Array.from(editableParent.querySelectorAll(".entoure"));
	entoures.forEach((span) => {
		if (range.intersectsNode(span)) {
			const parent = span.parentNode;
			while (span.firstChild) parent.insertBefore(span.firstChild, span);
			span.remove();
		}
	});

	// Collecter les nœuds texte dans la sélection via offsets
	let currentOffset = 0;
	let startNode = null,
		startPos = 0,
		endNode = null,
		endPos = 0;
	const walker = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let node;
	while ((node = walker.nextNode())) {
		const len = node.textContent.length;
		if (!startNode && currentOffset + len > startOffset) {
			startNode = node;
			startPos = startOffset - currentOffset;
		}
		if (!endNode && currentOffset + len >= endOffset) {
			endNode = node;
			endPos = endOffset - currentOffset;
			break;
		}
		currentOffset += len;
	}

	if (!startNode || !endNode) return;

	// Collecter tous les nœuds texte de la sélection
	const walker2 = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	const toProcess = [];
	let inRange = false;
	let n;
	while ((n = walker2.nextNode())) {
		if (n === startNode) inRange = true;
		if (inRange) {
			toProcess.push({
				node: n,
				from: n === startNode ? startPos : 0,
				to: n === endNode ? endPos : n.textContent.length,
			});
		}
		if (n === endNode) break;
	}

	// Supprimer toutes les classes de formatage, en ordre inverse
	// eslint-disable-next-line no-unused-vars
	[...toProcess].reverse().forEach(({ node, from, to }) => {
		const parent = node.parentElement;
		if (parent.tagName === "SPAN" && !parent.classList.contains("entoure")) {
			TOUTES_LES_CLASSES.forEach((cls) => parent.classList.remove(cls));
		} else if (parent.tagName !== "SPAN") {
			// Nœud texte nu : pas de formatage à supprimer
		}
	});

	nettoyerSpans(editableParent);

	// Restaurer la sélection
	let rOffset = 0;
	let rStart = null,
		rStartPos = 0,
		rEnd = null,
		rEndPos = 0;
	const rWalker = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let rNode;
	while ((rNode = rWalker.nextNode())) {
		const len = rNode.textContent.length;
		if (!rStart && rOffset + len > startOffset) {
			rStart = rNode;
			rStartPos = startOffset - rOffset;
		}
		if (!rEnd && rOffset + len >= endOffset) {
			rEnd = rNode;
			rEndPos = endOffset - rOffset;
			break;
		}
		rOffset += len;
	}
	if (rStart && rEnd) {
		try {
			const restored = document.createRange();
			restored.setStart(rStart, rStartPos);
			restored.setEnd(rEnd, rEndPos);
			sel.removeAllRanges();
			sel.addRange(restored);
		} catch (e) {
			console.warn(
				"Impossible de restaurer la sélection après le formatage",
				e,
			);
			sel.removeAllRanges();
		}
	}
}
