// ========================================
// ENTOURAGE / SURBRILLANCE (intelligent)
// ========================================

export function entoure() {
	const sel = window.getSelection();
	if (!sel.rangeCount) return;

	const range = sel.getRangeAt(0);
	if (range.collapsed) return;

	const selectedText = range.toString();

	// Trouver le parent contenteditable
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

	// Sauvegarder les positions
	const texteAvantSelection = range.cloneRange();
	texteAvantSelection.selectNodeContents(editableParent);
	texteAvantSelection.setEnd(range.startContainer, range.startOffset);
	const startOffset = texteAvantSelection.toString().length;
	const endOffset = startOffset + selectedText.length;

	// Cloner la range pour vérifier le contenu
	const testRange = range.cloneRange();
	const fragment = testRange.cloneContents();

	// Vérifier s'il y a des spans .entoure dans la sélection
	const tempDiv = document.createElement("div");
	tempDiv.appendChild(fragment);
	const entouresInSelection = tempDiv.querySelectorAll(".entoure");

	// Cas 1 : La sélection est ENTIÈREMENT dans un seul span .entoure
	if (
		entouresInSelection.length === 1 &&
		entouresInSelection[0].textContent === selectedText
	) {
		const tousLesEntoures = Array.from(
			editableParent.querySelectorAll(".entoure"),
		);
		const entoureSpanVrai = tousLesEntoures.find(
			(e) =>
				e.textContent === selectedText &&
				range.intersectsNode(e) &&
				e.textContent.trim() === selectedText.trim(),
		);

		if (entoureSpanVrai) {
			// Unwrap : supprimer le span mais garder le contenu
			const parent = entoureSpanVrai.parentNode;
			while (entoureSpanVrai.firstChild) {
				parent.insertBefore(entoureSpanVrai.firstChild, entoureSpanVrai);
			}
			entoureSpanVrai.remove();
			return;
		}
	}

	// Cas 2 & 3 : Détecter tous les spans .entoure qui chevauchent
	const tousLesEntoures = Array.from(
		editableParent.querySelectorAll(".entoure"),
	);
	const entouresAUnwrap = [];

	tousLesEntoures.forEach((entoureSpan) => {
		if (range.intersectsNode(entoureSpan)) {
			entouresAUnwrap.push(entoureSpan);
		}
	});

	// Unwrap tous les spans .entoure qui chevauchent
	entouresAUnwrap.forEach((entoureSpan) => {
		const parent = entoureSpan.parentNode;
		while (entoureSpan.firstChild) {
			parent.insertBefore(entoureSpan.firstChild, entoureSpan);
		}
		entoureSpan.remove();
	});

	// Recréer la range après unwrap
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

	if (!startNode || !endNode) {
		console.warn("Impossible de recréer la sélection");
		return;
	}

	// Créer la nouvelle range
	const newRange = document.createRange();
	try {
		newRange.setStart(startNode, startPos);
		newRange.setEnd(endNode, endPos);
	} catch (e) {
		console.warn("Erreur setStart/setEnd:", e);
		return;
	}

	// Remonter jusqu'à l'enfant direct d'un parent donné
	function childOf(node, parent) {
		while (node && node.parentNode !== parent) node = node.parentNode;
		return node;
	}

	// Découper les nœuds texte directs aux limites si la sélection est partielle
	let actualStart = newRange.startContainer;
	if (
		actualStart.nodeType === Node.TEXT_NODE &&
		newRange.startOffset > 0 &&
		actualStart.parentNode === editableParent
	) {
		actualStart.splitText(newRange.startOffset);
		actualStart = actualStart.nextSibling;
	}

	let actualEnd = newRange.endContainer;
	if (
		actualEnd.nodeType === Node.TEXT_NODE &&
		newRange.endOffset < actualEnd.textContent.length &&
		actualEnd.parentNode === editableParent
	) {
		actualEnd.splitText(newRange.endOffset);
	}

	const startTop = childOf(actualStart, editableParent);
	const endTop = childOf(actualEnd, editableParent);

	const allChildren = Array.from(editableParent.childNodes);
	const si = allChildren.indexOf(startTop);
	const ei = allChildren.indexOf(endTop);

	if (si < 0 || ei < 0 || si > ei) return;

	try {
		// Boucle unifiée : gère les structures div, inline (br/texte) et mixtes
		let inlineSeg = [];

		function flushInlineSeg() {
			if (inlineSeg.length === 0) return;
			const nodes = inlineSeg.filter((n) => n.textContent.trim());
			inlineSeg = [];
			if (nodes.length === 0) return;
			const span = document.createElement("span");
			span.classList.add("entoure");
			editableParent.insertBefore(span, nodes[0]);
			nodes.forEach((n) => span.appendChild(n));
		}

		for (let idx = si; idx <= ei; idx++) {
			const block = allChildren[idx];

			// Nœud texte ou span inline : accumuler dans le segment courant
			if (block.nodeType !== Node.ELEMENT_NODE || block.tagName === "SPAN") {
				inlineSeg.push(block);
				continue;
			}

			// BR : vider le segment inline courant
			if (block.tagName === "BR") {
				flushInlineSeg();
				continue;
			}

			// Élément bloc (div, etc.) : vider d'abord le segment inline, puis traiter le bloc
			flushInlineSeg();

			if (!block.textContent.trim()) continue; // ignorer les blocs vides

			// Trouver les nœuds à envelopper dans ce bloc
			let firstToWrap = null;
			let lastToWrap = null;

			if (idx === si) {
				const startInBlock = newRange.startContainer;
				const topInBlock = childOf(startInBlock, block);
				if (topInBlock) {
					if (
						newRange.startOffset > 0 &&
						startInBlock.nodeType === Node.TEXT_NODE &&
						startInBlock.parentNode === block
					) {
						startInBlock.splitText(newRange.startOffset);
						firstToWrap = startInBlock.nextSibling;
					} else {
						firstToWrap = topInBlock;
					}
				}
			}
			if (!firstToWrap) firstToWrap = block.firstChild;

			if (idx === ei) {
				const endInBlock = newRange.endContainer;
				const topInBlock = childOf(endInBlock, block);
				if (topInBlock) {
					if (
						newRange.endOffset < endInBlock.textContent.length &&
						endInBlock.nodeType === Node.TEXT_NODE &&
						endInBlock.parentNode === block
					) {
						endInBlock.splitText(newRange.endOffset);
						lastToWrap = endInBlock;
					} else {
						lastToWrap = topInBlock;
					}
				}
			}
			if (!lastToWrap) {
				lastToWrap = block.lastChild;
				while (lastToWrap && lastToWrap.tagName === "BR")
					lastToWrap = lastToWrap.previousSibling;
			}

			if (!firstToWrap || !lastToWrap) continue;

			const blockChildren = Array.from(block.childNodes);
			const dsi = blockChildren.indexOf(firstToWrap);
			const dei = blockChildren.indexOf(lastToWrap);
			if (dsi < 0 || dei < 0 || dsi > dei) continue;

			const nodesToWrap = blockChildren
				.slice(dsi, dei + 1)
				.filter((n) => n.tagName !== "BR");
			if (nodesToWrap.length === 0) continue;

			const span = document.createElement("span");
			span.classList.add("entoure");
			block.insertBefore(span, nodesToWrap[0]);
			nodesToWrap.forEach((n) => span.appendChild(n));
		}

		// Vider tout segment inline restant à la fin
		flushInlineSeg();
	} catch (e) {
		console.warn("Erreur lors de la création du span entoure:", e);
	}

	// Restaurer la sélection d'origine
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
			console.warn("Impossible de restaurer la sélection après l'entourage", e);
			sel.removeAllRanges();
		}
	}
}
