// Seyes est un logiciel libre
// sous licence GNU GPL
// écrit par Arnaud Champollion
// Il fait partie de la suite Éducajou

import "../css/styles.css";
import { initMenu } from "./core/menu/menu.mjs";
import { initDialoguePdf } from "./core/pdf/index.mjs";
import { initSettings } from "./core/settings/initSettings.mjs";
import { initEvents } from "./core/ui/events/init-events.mjs";

initSettings();
initMenu();
initEvents();
initDialoguePdf();
