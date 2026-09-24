import { handlePasteEvent } from "./paste.mjs";
import { handleMouseMove } from "./mouse-move.mjs";
import { handleResize } from "./resize.mjs";
import { handleFocus } from "./focus.mjs";
import { handleKeyboard } from "./keyboard.mjs";
import { handleClickOnDocument } from "./click.mjs";

export function initEvents() {
	handleMouseMove();
	handlePasteEvent();
	handleResize();
	handleFocus();
	handleKeyboard();
	handleClickOnDocument();
}
