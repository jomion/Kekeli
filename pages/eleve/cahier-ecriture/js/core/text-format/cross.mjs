// ========================================
// TEXTE BARRÉ (caractère par caractère + toggle)

import { nettoyerSpans, normaliserSpans } from "./helpers.mjs";

// ========================================
export function barre() {
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

	// ========================================
	// Sauvegarde position (comme underline)
	const texteAvantSelection = range.cloneRange();
	texteAvantSelection.selectNodeContents(editableParent);
	texteAvantSelection.setEnd(range.startContainer, range.startOffset);
	const startOffset = texteAvantSelection.toString().length;
	const endOffset = startOffset + range.toString().length;

	// Normalisation
	normaliserSpans(editableParent);

	// ========================================
	// Reconstruction de la sélection
	let currentOffset = 0;
	let startNode = null;
	let startPos = 0;
	let endNode = null;
	let endPos = 0;

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

	try {
		const newRange = document.createRange();
		newRange.setStart(startNode, startPos);
		newRange.setEnd(endNode, endPos);
		sel.removeAllRanges();
		sel.addRange(newRange);
	} catch (e) {
		console.warn("Impossible de restaurer la sélection", e);
		return;
	}

	// ========================================
	// Détecter l'état global (toggle) en place
	const finalRange = sel.getRangeAt(0);
	const fnStart = finalRange.startContainer;
	const fnEnd = finalRange.endContainer;
	const fnStartOff = finalRange.startOffset;
	const fnEndOff = finalRange.endOffset;

	// Première passe : compter les caractères barrés vs total
	const walkerCount = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let total = 0;
	let barres = 0;
	let inRangeCount = false;
	let nc;

	while ((nc = walkerCount.nextNode())) {
		if (nc === fnStart) inRangeCount = true;
		if (inRangeCount) {
			const from = nc === fnStart ? fnStartOff : 0;
			const to = nc === fnEnd ? fnEndOff : nc.textContent.length;
			const parent = nc.parentElement;
			const isEntoure =
				parent.classList && parent.classList.contains("entoure");
			if (!isEntoure) {
				total += to - from;
				if (
					parent.tagName === "SPAN" &&
					parent.classList.contains("textebarre")
				) {
					barres += to - from;
				}
			}
		}
		if (nc === fnEnd) break;
	}

	const action = barres === total && total > 0 ? "remove" : "add";

	// Deuxième passe : collecter les nœuds à modifier
	const walkerFinal = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	const toProcess = [];
	let inRange = false;
	let n;

	while ((n = walkerFinal.nextNode())) {
		if (n === fnStart) inRange = true;
		if (inRange) {
			toProcess.push({
				node: n,
				from: n === fnStart ? fnStartOff : 0,
				to: n === fnEnd ? fnEndOff : n.textContent.length,
			});
		}
		if (n === fnEnd) break;
	}

	// Traitement en ordre inverse pour préserver les positions DOM
	[...toProcess].reverse().forEach(({ node, from, to }) => {
		const parent = node.parentElement;
		if (parent.classList && parent.classList.contains("entoure")) return;

		if (parent.tagName === "SPAN") {
			// Span existant : modifier la classe en place
			if (action === "add") {
				parent.classList.add("textebarre");
			} else {
				parent.classList.remove("textebarre");
			}
		} else {
			// Nœud texte nu : découper et envelopper
			const text = node.textContent;
			const frag = document.createDocumentFragment();
			if (from > 0)
				frag.appendChild(document.createTextNode(text.slice(0, from)));
			for (let i = from; i < to; i++) {
				const s = document.createElement("span");
				s.textContent = text[i];
				if (action === "add") s.classList.add("textebarre");
				frag.appendChild(s);
			}
			if (to < text.length)
				frag.appendChild(document.createTextNode(text.slice(to)));
			parent.insertBefore(frag, node);
			node.remove();
		}
	});

	// Nettoyage final
	nettoyerSpans(editableParent);

	// Restaurer la sélection (les nœuds texte ont été supprimés/remplacés)
	let rCurrentOffset = 0;
	let rStartNode = null,
		rStartPos = 0,
		rEndNode = null,
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
		if (!rStartNode && rCurrentOffset + len > startOffset) {
			rStartNode = rNode;
			rStartPos = startOffset - rCurrentOffset;
		}
		if (!rEndNode && rCurrentOffset + len >= endOffset) {
			rEndNode = rNode;
			rEndPos = endOffset - rCurrentOffset;
			break;
		}
		rCurrentOffset += len;
	}
	if (rStartNode && rEndNode) {
		try {
			const restoredRange = document.createRange();
			restoredRange.setStart(rStartNode, rStartPos);
			restoredRange.setEnd(rEndNode, rEndPos);
			sel.removeAllRanges();
			sel.addRange(restoredRange);
		} catch (e) {
			console.warn("Impossible de restaurer la sélection après le barré", e);
			sel.removeAllRanges();
		}
	}
}
