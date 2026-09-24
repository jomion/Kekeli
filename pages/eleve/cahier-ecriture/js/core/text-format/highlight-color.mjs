import { nettoyerSpans, normaliserSpans } from "./helpers.mjs";

// ========================================
// COULEUR DE SURLIGNEMENT (lettre par lettre)
// ===================================

// =====
export function couleurSurlignement(couleur) {
	const sel = window.getSelection();
	if (!sel.rangeCount) return;

	const range = sel.getRangeAt(0);
	// Vérifier si la sélection est vide
	const isSelectionEmpty = range.collapsed || range.toString().length === 0;
	// On ajoute un span vide si la sélection est vide, pour pouvoir appliquer le surlignement au texte à venir après le curseur
	if (isSelectionEmpty) {
		// On vérifie si on est en fin de ligne
		const isEndOfLine =
			sel.anchorNode.nodeType === Node.TEXT_NODE &&
			sel.anchorOffset === sel.anchorNode.textContent.length;
		if (isEndOfLine) {
			// On repère d'abord le dernier élément span juste avant le curseur
			const lastSpan = sel.anchorNode.parentElement.closest("span");
			// On insère après ce dernier span un nouveau span vide avec la classe de soulignement
			const newSpan = document.createElement("span");
			// On ajoute à ce span la classe de surlignement
			newSpan.classList.add(`surlignement-${couleur}`);
			// Insérer un caractère zéro-largeur pour forcer la création
			// d'un nœud texte à l'intérieur du span et placer le curseur dedans.
			const ZW = "\u200B";
			newSpan.textContent = ZW;
			if (lastSpan && lastSpan.parentNode) {
				lastSpan.parentNode.insertBefore(newSpan, lastSpan.nextSibling);
			} else if (sel.anchorNode.nodeType === Node.TEXT_NODE) {
				sel.anchorNode.parentNode.insertBefore(
					newSpan,
					sel.anchorNode.nextSibling,
				);
			} else {
				sel.anchorNode.appendChild(newSpan);
			}
			// On place le curseur à l'intérieur du texte zéro-largeur
			const textNode = newSpan.firstChild;
			const newRange = document.createRange();
			// Positionner après le caractère zéro-largeur pour que la frappe
			// insère du contenu dans `newSpan`.
			newRange.setStart(textNode, 1);
			newRange.setEnd(textNode, 1);
			sel.removeAllRanges();
			sel.addRange(newRange);
		} else {
			// Si on n'est pas en fin de ligne, il faut insérer un span vide à la position du curseur
			const newSpan = document.createElement("span");
			newSpan.classList.add(`surlignement-${couleur}`);
			// Insérer un caractère zéro-largeur pour forcer la création
			// d'un nœud texte à l'intérieur du span et placer le curseur dedans.
			const ZW = "\u200B";
			newSpan.textContent = ZW;
			if (sel.anchorNode.nodeType === Node.TEXT_NODE) {
				const textNode = sel.anchorNode;
				const offset = sel.anchorOffset;
				const parent = textNode.parentNode;

				// Diviser le nœud texte en deux parties
				const beforeText = textNode.textContent.slice(0, offset);
				const afterText = textNode.textContent.slice(offset);

				// Créer un nouveau nœud texte pour la partie après le curseur
				const afterTextNode = document.createTextNode(afterText);

				// Mettre à jour le nœud texte existant avec la partie avant le curseur
				textNode.textContent = beforeText;

				// Insérer le nouveau span et le nœud texte après le curseur
				parent.insertBefore(newSpan, textNode.nextSibling);
				parent.insertBefore(afterTextNode, newSpan.nextSibling);

				// Placer le curseur à l'intérieur du texte zéro-largeur
				const newRange = document.createRange();
				newRange.setStart(newSpan.firstChild, 1);
				newRange.setEnd(newSpan.firstChild, 1);
				sel.removeAllRanges();
				sel.addRange(newRange);
			} else {
				sel.anchorNode.appendChild(newSpan);
				const newRange = document.createRange();
				newRange.setStart(newSpan.firstChild, 1);
				newRange.setEnd(newSpan.firstChild, 1);
				sel.removeAllRanges();
				sel.addRange(newRange);
			}
		}
		return; // On ne fait rien d'autre si la sélection est vide
	}

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

	// Normaliser les spans
	normaliserSpans(editableParent);

	// Recréer la sélection
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
		const nodeLength = node.textContent.length;

		if (!startNode && currentOffset + nodeLength > startOffset) {
			startNode = node;
			startPos = startOffset - currentOffset;
		}

		if (!endNode && currentOffset + nodeLength >= endOffset) {
			endNode = node;
			endPos = endOffset - currentOffset;
			break;
		}

		currentOffset += nodeLength;
	}

	if (startNode && endNode) {
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
	} else {
		return;
	}

	// Appliquer la couleur en place (sans toucher à la structure DOM)
	const finalRange = sel.getRangeAt(0);
	const fnStart = finalRange.startContainer;
	const fnEnd = finalRange.endContainer;
	const fnStartOff = finalRange.startOffset;
	const fnEndOff = finalRange.endOffset;

	const surlignementClasses = [
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

	function stylerSpan(span) {
		surlignementClasses.forEach((cls) => span.classList.remove(cls));
		span.classList.add(`surlignement-${couleur}`);
	}

	// Collecter les nœuds texte dans la sélection avec leurs offsets
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
		if (parent.tagName === "SPAN" && !parent.classList.contains("entoure")) {
			stylerSpan(parent);
		} else {
			const text = node.textContent;
			const frag = document.createDocumentFragment();
			if (from > 0)
				frag.appendChild(document.createTextNode(text.slice(0, from)));
			for (let i = from; i < to; i++) {
				const s = document.createElement("span");
				s.textContent = text[i];
				stylerSpan(s);
				frag.appendChild(s);
			}
			if (to < text.length)
				frag.appendChild(document.createTextNode(text.slice(to)));
			parent.insertBefore(frag, node);
			node.remove();
		}
	});

	document.getElementById("couleur-surlignement").style.backgroundColor =
		couleur;
	document.getElementById("couleur-surlignement").value = couleur;

	// Optimiser les spans après l'opération
	nettoyerSpans(editableParent);
}
