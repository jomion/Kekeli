// ========================================
// COLORATION SYLLABIQUE (LireCouleur)
// Moteur phonétique : Marie-Pierre Brungard — GPL v3
// ========================================

import { LireCouleur } from "../../lib/lirecouleur.mjs";
import { nettoyerSpans, normaliserSpans } from "./helpers.mjs";

// Regex pour isoler les mots français (lettres + accents)
const MOT_REGEX = /[a-zA-ZÀ-ÿ\u0100-\u017F]+/g;

// Classes couleur-* à retirer lors de l'application
const COULEUR_CLASSES = [
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
];

// Construit un tableau indiquant pour chaque caractère du texte brut :
//   null  = non-mot (espace, ponctuation)
//   0     = lettre muette → syllabe-muet (gris)
//   1     = syllabe impaire → syllabe-1 (rouge)
//   2     = syllabe paire  → syllabe-2 (bleu)
function buildSyllabeMap(text) {
	const map = new Array(text.length).fill(null);
	let globalSylIdx = 0;

	MOT_REGEX.lastIndex = 0;
	let match;
	while ((match = MOT_REGEX.exec(text)) !== null) {
		const word = match[0];
		const wordStart = match.index;

		let handled = false;
		try {
			const phonemes = LireCouleur.extrairePhonemes(word);
			if (phonemes && phonemes.length > 0) {
				const syllabes = LireCouleur.extraireSyllabes(phonemes);
				if (syllabes && syllabes.length > 0) {
					// Vérifier que la somme des longueurs correspond au mot
					let totalLen = 0;
					for (const syl of syllabes)
						for (const ph of syl.phonemes) totalLen += ph.lettres.length;

					if (totalLen === word.length) {
						let charPos = wordStart;
						for (const syl of syllabes) {
							for (const ph of syl.phonemes) {
								const val = ph.estPhonemeMuet() ? 0 : (globalSylIdx % 2) + 1;
								for (let i = 0; i < ph.lettres.length; i++)
									map[charPos + i] = val;
								charPos += ph.lettres.length;
							}
							globalSylIdx++;
						}
						handled = true;
					}
				}
			}
		} catch (e) {
			console.warn("Erreur lors de l'analyse phonétique du mot :", word, e);
		}

		if (!handled) {
			// Mot inconnu : une seule syllabe, pas de lettre muette détectée
			for (let i = 0; i < word.length; i++)
				map[wordStart + i] = (globalSylIdx % 2) + 1;
			globalSylIdx++;
		}
	}

	return map;
}

// ========================================
export function colorierSyllabes() {
	const sel = window.getSelection();
	if (!sel.rangeCount) return;

	const range = sel.getRangeAt(0);
	if (range.collapsed) return;

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

	// Sauvegarder les offsets texte
	const texteAvant = range.cloneRange();
	texteAvant.selectNodeContents(editableParent);
	texteAvant.setEnd(range.startContainer, range.startOffset);
	const startOffset = texteAvant.toString().length;
	const endOffset = startOffset + range.toString().length;

	// Normaliser les spans
	normaliserSpans(editableParent);

	// Reconstruire la sélection après normalisation
	let currentOff = 0;
	let startNode = null,
		startPos = 0,
		endNode = null,
		endPos = 0;
	const walkerRebuild = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let rn;
	while ((rn = walkerRebuild.nextNode())) {
		const len = rn.textContent.length;
		if (!startNode && currentOff + len > startOffset) {
			startNode = rn;
			startPos = startOffset - currentOff;
		}
		if (!endNode && currentOff + len >= endOffset) {
			endNode = rn;
			endPos = endOffset - currentOff;
			break;
		}
		currentOff += len;
	}
	if (!startNode || !endNode) return;

	try {
		const newRange = document.createRange();
		newRange.setStart(startNode, startPos);
		newRange.setEnd(endNode, endPos);
		sel.removeAllRanges();
		sel.addRange(newRange);
	} catch (e) {
		console.warn("Erreur lors de la reconstruction de la sélection", e);
		return;
	}

	// Collecter les nœuds texte dans la sélection avec leurs offsets
	const finalRange = sel.getRangeAt(0);
	const fnStart = finalRange.startContainer;
	const fnEnd = finalRange.endContainer;
	const fnStartOff = finalRange.startOffset;
	const fnEndOff = finalRange.endOffset;

	const toProcess = [];
	let inRange = false;
	let selOffset = 0;
	const walkerFinal = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let n;
	while ((n = walkerFinal.nextNode())) {
		if (n === fnStart) inRange = true;
		if (inRange) {
			const from = n === fnStart ? fnStartOff : 0;
			const to = n === fnEnd ? fnEndOff : n.textContent.length;
			toProcess.push({ node: n, from, to, selStart: selOffset });
			selOffset += to - from;
		}
		if (n === fnEnd) break;
	}
	if (toProcess.length === 0) return;

	// Texte brut de la sélection et carte des syllabes
	const plainText = toProcess
		.map(({ node, from, to }) => node.textContent.slice(from, to))
		.join("");
	const syllabeMap = buildSyllabeMap(plainText);

	// Détection du toggle : tous les caractères-mots ont-ils déjà la classe syllabe ?
	let totalWordChars = 0;
	let wordCharsWithClass = 0;
	toProcess.forEach(({ node, from, to, selStart }) => {
		const parent = node.parentElement;
		for (let i = from; i < to; i++) {
			const mapIdx = selStart + (i - from);
			if (syllabeMap[mapIdx] !== null) {
				totalWordChars++;
				if (
					parent.tagName === "SPAN" &&
					!parent.classList.contains("entoure") &&
					(parent.classList.contains("syllabe-1") ||
						parent.classList.contains("syllabe-2") ||
						parent.classList.contains("syllabe-muet"))
				) {
					wordCharsWithClass++;
				}
			}
		}
	});
	const isToggleOff =
		totalWordChars > 0 && wordCharsWithClass === totalWordChars;

	// Appliquer en ordre inverse pour préserver les positions DOM
	[...toProcess].reverse().forEach(({ node, from, to, selStart }) => {
		const parent = node.parentElement;

		if (parent.tagName === "SPAN" && !parent.classList.contains("entoure")) {
			// Span mono-caractère : modifier en place
			if (isToggleOff) {
				parent.classList.remove("syllabe-1", "syllabe-2", "syllabe-muet");
			} else {
				const sylIdx = syllabeMap[selStart];
				if (sylIdx !== null) {
					COULEUR_CLASSES.forEach((cls) => parent.classList.remove(cls));
					parent.classList.remove("syllabe-1", "syllabe-2", "syllabe-muet");
					parent.classList.add(
						sylIdx === 0 ? "syllabe-muet" : `syllabe-${sylIdx}`,
					);
				}
			}
		} else {
			// Nœud texte nu : découper et envelopper caractère par caractère
			const text = node.textContent;
			const frag = document.createDocumentFragment();

			if (from > 0)
				frag.appendChild(document.createTextNode(text.slice(0, from)));

			for (let i = from; i < to; i++) {
				const s = document.createElement("span");
				s.textContent = text[i];
				if (!isToggleOff) {
					const mapIdx = selStart + (i - from);
					const sylIdx = syllabeMap[mapIdx];
					if (sylIdx !== null) {
						s.classList.add(
							sylIdx === 0 ? "syllabe-muet" : `syllabe-${sylIdx}`,
						);
					}
				}
				frag.appendChild(s);
			}

			if (to < text.length) {
				frag.appendChild(document.createTextNode(text.slice(to)));
			}

			parent.insertBefore(frag, node);
			node.remove();
		}
	});

	// Restaurer la sélection
	let rCurrentOff = 0;
	let rStartNode = null,
		rStartPos = 0,
		rEndNode = null,
		rEndPos = 0;
	const walkerRestore = document.createTreeWalker(
		editableParent,
		NodeFilter.SHOW_TEXT,
		null,
		false,
	);
	let rv;
	while ((rv = walkerRestore.nextNode())) {
		const len = rv.textContent.length;
		if (!rStartNode && rCurrentOff + len > startOffset) {
			rStartNode = rv;
			rStartPos = startOffset - rCurrentOff;
		}
		if (!rEndNode && rCurrentOff + len >= endOffset) {
			rEndNode = rv;
			rEndPos = endOffset - rCurrentOff;
			break;
		}
		rCurrentOff += len;
	}
	if (rStartNode && rEndNode) {
		try {
			const restoredRange = document.createRange();
			restoredRange.setStart(rStartNode, rStartPos);
			restoredRange.setEnd(rEndNode, rEndPos);
			sel.removeAllRanges();
			sel.addRange(restoredRange);
		} catch (e) {
			console.warn("Erreur lors de la reconstruction de la sélection", e);
			sel.removeAllRanges();
		}
	}

	nettoyerSpans(editableParent);
}
