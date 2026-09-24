import { ouvre, divApropos } from "../../utils/dom.mjs";

const aboutText = `<ul>
          <span i18_content="apropos_message_part1">Seyes est une application sous licence libre GNU GPL, de la </span>
          <a class="cartouche" style="background-image: url(./images/educajou.png);" href="https://educajou.forge.apps.education.fr/" i18_content="apropos_message_link">suite Éducajou</a>
          <span i18_content="apropos_message_part2">, écrite par Arnaud Champollion.</span>
        </ul>
        <br>
        <h2>Documentation</h2>
        <br>
        <span id="spanCeditNum40">Illustration explicative réalisée par <a target="_blank" href="https://blogacabdx.ac-bordeaux.fr/numerique40/2023/11/22/application-seyes-deducajou/">l'Équipe numérique 40</a> sous licence Creative Commons BY SA</span>
        <br><br>
        <h2 i18_content="apropos_polices_title">Polices utilisées</h2>
        <br>
        <span i18_content="apropos_police_aa_cursive">AA Cursive, par A. Renaudin, sous licence OFL.</span>
        <br>
        <span i18_content="apropos_police_open_dyslexic">OpenDyslexic, police libre destinée à faciliter la lecture des personnes dyslexiques, créée par Abelardo Gonzalez.</span>
        <br>
        <span i18_content="apropos_police_luciole">Luciole, par Laurent Bourcellier et Jonathan Perez, sous licence Creative Commons BY.</span>
        <br>
        <span i18_content="apropos_police_marelle">Marelle, police cursive libre sous licence OFL, créée par Typographies.fr dans le cadre d’une commande de la Direction du Numérique Éducatif.</span>
        <br>
        <span i18_content="apropos_police_arial_acces">Arial et Acces ne sont pas présentes dans l’application. Si elles sont installées sur votre ordinateur, Seyes pourra les utiliser.</span>
        <br><br>
        <h2 i18_content="apropos_bibliotheques_title">Bibliothèques</h2>
        <span i18_content="apropos_bibliotheque_flatpickr_part1">La fonction de calendrier s'appuie sur la bibliothèque </span>
        <a target="_blank" href="https://github.com/flatpickr/flatpickr" i18_content="apropos_bibliotheque_flatpickr_link">flatpickr</a>
        <span i18_content="apropos_bibliotheque_flatpickr_part2"> sous licence MIT.</span>
        <br>
        <span i18_content="apropos_bibliotheque_mammoth_part1">La fonction d'import de fichiers docx s'appuie sur </span>
        <a target="_blank" href="https://github.com/mwilliamson/mammoth.js" i18_content="apropos_bibliotheque_mammoth_link">Mammoth</a>
        <span i18_content="apropos_bibliotheque_mammoth_part2"> sous licence BSD.</span>
        <br><br>
        <h2 i18_content="apropos_utiliser_hors_ligne_title">Utiliser hors ligne</h2>
        <br>
        <ul>
          <span i18_content="apropos_utiliser_hors_ligne_message_part1">Télécharger l'application </span>
          <a class="cartouche" style="background-image: url(./images/zip.png);" href="https://forge.apps.education.fr/educajou/seyes/-/archive/main/seyes-main.zip?path=web" i18_content="apropos_utiliser_hors_ligne_message_link">seyes-main.zip</a>
        </ul>
        <ul i18_content="apropos_extraire_zip_message">Extraire l’archive ZIP</ul>
        <ul i18_content="apropos_ouvrir_fichier_message">Ouvrir le fichier index.html</ul>
        <br>
        <h2 i18_content="apropos_en_savoir_plus_title">En savoir plus et accéder aux sources</h2>
        <br>
        <ul>
          <span i18_content="apropos_en_savoir_plus_message_part1">Voir </span>
          <a class="cartouche" style="background-image: url(./images/forge.png);" href="https://forge.apps.education.fr/educajou/seyes" i18_content="apropos_en_savoir_plus_message_link">la page du projet</a>
          <span i18_content="apropos_en_savoir_plus_message_part2"> sur la Forge des Communs Numériques Éducatifs.</span>
        </ul>
        <br>
        <h2 i18_content="apropos_contact_title">Contact</h2>
        <br>
        <p>
          <span i18_content="apropos_contact_message_part1">Vous pouvez </span>
          <a target="_blank" href="https://forge.apps.education.fr/educajou/seyes/-/issues/new?issuable_template=bug" i18_content="apropos_contact_message_link1">signaler un bug</a>
          <span i18_content="apropos_contact_message_part2"> ou </span>
          <a target="_blank" href="https://forge.apps.education.fr/educajou/seyes/-/issues/new?issuable_template=suggestion" i18_content="apropos_contact_message_link2">proposer une amélioration</a>
        </p>
        <p i18_content="apropos_contact_message_2">Une connexion avec un compte Apps Éducation est nécessaire. Les notifications de réponse sont envoyées sur votre messagerie académique.</p>`;

let aboutInitialized = false;

export function openAbout() {
	if (!aboutInitialized) {
		const aboutContent = divApropos.querySelector(".contenu-lightbox");
		aboutContent.innerHTML = aboutText;
		aboutInitialized = true;
	}
	ouvre(divApropos);
}
