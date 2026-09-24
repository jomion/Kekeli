// ========================================
// SOULIGNEMENT COLORÉ (lettre par lettre)

import { nettoyerSpans, normaliserSpans } from "./helpers.mjs";

// ========================================
export function souligne(couleur) {
	const couleurBouton = couleur; // conserve la couleur d'origine pour le bouton
	const sel = window.getSelection();

	if (!sel.rangeCount) return;

	const range = sel.getRangeAt(0);
	// Vérifier si la sélection est vide
	const isSelectionEmpty = range.collapsed || range.toString().length === 0;
	// On ajoute un span vide si la sélection est vide, pour recommencer le soulignement à cet endroit
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
			// On vérifie si le dernier span est déjà souligné avec cette couleur
			const lastSpanUnderlined =
				lastSpan && lastSpan.classList.contains(`souligne-${couleur}`);
			// On applique la couleur de soulignement au nouveau span seulement si le dernier span n'est pas déjà souligné avec cette couleur (car sinon, cela veut dire que l'utilisateur veut arrêter le soulignement pour les prochains caractères)
			if (!lastSpanUnderlined) {
				newSpan.classList.add(`souligne-${couleur}`);
			}
			// Insérer un caractère zéro-largeur pour forcer la création
			// d'un nœud texte à l'intérieur du span et placer le caret dedans.
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
			newSpan.classList.add(`souligne-${couleur}`);
			// Insérer un caractère zéro-largeur pour forcer la création
			// d'un nœud texte à l'intérieur du span et placer le caret dedans.
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

	let deSoulignement = false;

	// Bascule : si toute la sélection est déjà soulignée avec cette couleur, désouligner
	if (couleur !== "transparent" && couleur !== "white") {
		deSoulignement = true;
		const classeRecherchee = `souligne-${couleur}`;
		let toutSouligne = true;
		let auMoinsUnCaractere = false;
		let checkOffset = 0;
		const walkerCheck = document.createTreeWalker(
			editableParent,
			NodeFilter.SHOW_TEXT,
			null,
			false,
		);
		let nCheck;
		while ((nCheck = walkerCheck.nextNode())) {
			const len = nCheck.textContent.length;
			const overlapStart = Math.max(checkOffset, startOffset);
			const overlapEnd = Math.min(checkOffset + len, endOffset);
			if (overlapStart < overlapEnd) {
				auMoinsUnCaractere = true;
				const p = nCheck.parentElement;
				if (!(p.tagName === "SPAN" && p.classList.contains(classeRecherchee))) {
					toutSouligne = false;
					break;
				}
			}
			if (checkOffset + len >= endOffset) break;
			checkOffset += len;
		}
		if (auMoinsUnCaractere && toutSouligne) {
			couleur = "transparent";
		}
	}

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

	// Appliquer le soulignement en place (sans toucher à la structure DOM)
	const finalRange = sel.getRangeAt(0);
	const fnStart = finalRange.startContainer;
	const fnEnd = finalRange.endContainer;
	const fnStartOff = finalRange.startOffset;
	const fnEndOff = finalRange.endOffset;

	const classesASupprimer = [
		"souligne-red",
		"souligne-blue",
		"souligne-green",
		"souligne-yellow",
		"souligne-pink",
		"souligne-black",
		"souligne-purple",
		"souligne-orange",
	];

	function stylerSpan(span) {
		classesASupprimer.forEach((cls) => span.classList.remove(cls));
		if (couleur !== "transparent" && couleur !== "white") {
			span.classList.add(`souligne-${couleur}`);
		}
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
			// Span existant : modifier les classes en place
			stylerSpan(parent);
		} else {
			// Nœud texte nu : découper et envelopper la portion sélectionnée
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

	// Boutons
	if (!deSoulignement) {
		document.getElementById("souligne").style.textDecorationColor = couleur;
		document.getElementById("souligne").value = couleurBouton;
	}

	// Optimiser les spans après l'opération
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
			console.warn(
				"Impossible de restaurer la sélection après le soulignement",
				e,
			);
			sel.removeAllRanges();
		}
	}
}

export function update_souligne(distance_soulignage) {
	const texte_principal = document.getElementById("texte_principal");
	const texte_marge = document.getElementById("texte_marge");
	const texte_marge_complementaire = document.getElementById(
		"texte_marge_complementaire",
	);
	if (texte_principal)
		texte_principal.style.textUnderlineOffset = distance_soulignage + "em";
	if (texte_marge)
		texte_marge.style.textUnderlineOffset = distance_soulignage + "em";
	if (texte_marge_complementaire)
		texte_marge_complementaire.style.textUnderlineOffset =
			distance_soulignage + "em";
}
