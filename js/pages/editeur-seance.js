// Page pages/editeur-seance.html
// Éditeur à blocs pour une séance (cahier des charges §6)

const idSeance = new URLSearchParams(window.location.search).get('id');
let seance = null;
let chaineNavigation = null; // { sa, noeud, classe_id, champ_id, classeNom, champNom }
let blocs = [];
let profilAdmin = null;
let peutEditer = false;
let peutValider = false;
let minuteriesSauvegarde = {}; // debounce par bloc

// Sections dépliées (persiste tant que la page reste ouverte, pour ne pas
// tout refermer à chaque sauvegarde/ajout).
const sectionsOuvertes = new Set();

// État du glisser-déposer, partagé entre tous les conteneurs (racine +
// chaque section) : permet de déplacer un bloc d'un conteneur à un autre
// (ex: le faire entrer dans une section, ou en sortir) — on garde son
// conteneur et son parent d'origine pour pouvoir recompacter les positions
// restantes là-bas si le bloc en repart. Les règles de profondeur (limiter
// l'imbrication) ne sont pas encore appliquées — à affiner plus tard.
let dragEtat = { element: null, conteneurOrigine: null, parentBlocIdOrigine: undefined };

const contenu = document.getElementById('contenu');
const filAriane = document.getElementById('filAriane');

async function init() {
  profilAdmin = await requireAdmin();
  if (!profilAdmin) return;

  document.getElementById('zoneDroite').innerHTML = `
    <span class="badge-utilisateur">${profilAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${profilAdmin.prenom}</span>
    <button class="btn btn-discret" onclick="deconnecterAdmin()">Déconnexion</button>
  `;

  if (!idSeance) { contenu.innerHTML = '<p class="message-erreur">Aucune séance spécifiée.</p>'; return; }

  await chargerSeanceEtContexte();
  if (!seance) { contenu.innerHTML = '<p class="message-erreur">Séance introuvable ou accès refusé.</p>'; return; }

  // Le retour "Navigation" ramène directement au parent immédiat (la SA),
  // pas à la racine — on ne peut construire ce lien qu'une fois le contexte chargé.
  const urlRetourSA = urlNavigationVersSA();
  document.getElementById('zoneDroite').insertAdjacentHTML('afterbegin',
    `<a href="${urlRetourSA}" class="btn btn-discret">← Retour à la SA</a>`);

  peutEditer = await appelerPermission('peut_editer_perimetre');
  peutValider = await appelerPermission('peut_valider_perimetre');

  if (!peutEditer) {
    contenu.innerHTML = '<p class="message-erreur">Vous n\'avez pas les droits d\'édition sur ce contenu (classe/champ hors de votre périmètre).</p>';
    return;
  }

  await chargerBlocs();
  rendreFilAriane();
  rendre();
}

async function appelerPermission(nomFonction) {
  const { data } = await supabaseClient.rpc(nomFonction, {
    p_id: profilAdmin.id, p_classe_id: chaineNavigation.classe_id, p_champ_id: chaineNavigation.champ_id
  });
  return !!data;
}

async function chargerSeanceEtContexte() {
  const { data: s, error } = await supabaseClient.from('seances').select('*').eq('id', idSeance).single();
  if (error || !s) return;
  seance = s;

  const { data: sa } = await supabaseClient.from('sa').select('*').eq('id', s.sa_id).single();
  const { data: noeud } = await supabaseClient.from('noeuds_parcours').select('*').eq('id', sa.noeud_id).single();
  const { data: classe } = await supabaseClient.from('classes').select('*').eq('id', noeud.classe_id).single();
  const { data: champ } = await supabaseClient.from('champs_formation').select('*').eq('id', noeud.champ_formation_id).single();

  chaineNavigation = { sa, noeud, classe_id: noeud.classe_id, champ_id: noeud.champ_formation_id, classeNom: classe.nom, champNom: champ.nom };
}

function urlNavigationVersClasse() {
  return `navigation.html?classeId=${chaineNavigation.classe_id}`;
}
function urlNavigationVersChamp() {
  return `${urlNavigationVersClasse()}&champId=${chaineNavigation.champ_id}`;
}
function urlNavigationVersSA() {
  return `${urlNavigationVersChamp()}&saId=${chaineNavigation.sa.id}`;
}

function rendreFilAriane() {
  // Chaque niveau (immédiat ou éloigné) est cliquable et ramène exactement
  // à cet endroit dans la navigation (pas à la racine).
  filAriane.innerHTML = `
    <span class="segment" data-retour="${urlNavigationVersClasse()}" title="Retour à ce champ de formation">${echapper(chaineNavigation.classeNom)}</span><span class="sep">›</span>
    <span class="segment" data-retour="${urlNavigationVersChamp()}" title="Retour à ce champ de formation">${echapper(chaineNavigation.champNom)}</span><span class="sep">›</span>
    <span class="segment" data-retour="${urlNavigationVersSA()}" title="Retour à cette Situation d'Apprentissage">${echapper(chaineNavigation.sa.titre)}</span><span class="sep">›</span>
    <span class="segment actif">${echapper(seance.titre)}</span>`;

  filAriane.querySelectorAll('[data-retour]').forEach(el => {
    el.addEventListener('click', () => { window.location.href = el.dataset.retour; });
  });
}

async function chargerBlocs() {
  const { data, error } = await supabaseClient.from('blocs_seance').select('*').eq('seance_id', idSeance).order('ordre');
  if (error) { console.error(error); return; }
  blocs = data;
}

// --- RENDU GÉNÉRAL -------------------------------------------------------

function rendre() {
  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

  contenu.innerHTML = `
    <div class="barre-editeur">
      <div>
        <h2 style="margin:0 0 4px;color:var(--bleu-principal)">${echapper(seance.titre)}</h2>
        <input type="text" id="inputDiscipline" placeholder="Discipline (ex: Lecture, Grammaire, Conjugaison...)" value="${echapper(seance.discipline)}"
          style="border:1px solid var(--bordure);border-radius:6px;padding:4px 8px;font-size:12px;margin:4px 0;width:260px">
        <br><span class="infos-sauvegarde" id="infoSauvegarde">Dernier enregistrement : ${seance.modifie_le ? new Date(seance.modifie_le).toLocaleString('fr-FR') : '—'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select class="statut-select" id="selectStatut">
          ${Object.entries(pillsStatut).map(([v, l]) => `<option value="${v}" ${seance.statut === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        ${(peutValider && seance.statut !== 'publie') ? `<button class="btn btn-primaire" id="btnValider">✅ Valider et publier</button>` : ''}
        <button class="btn btn-discret" onclick="dupliquerSeance()">📑 Dupliquer la séance</button>
        <button class="btn btn-accent" onclick="ouvrirApercu()">👁️ Aperçu élève</button>
      </div>
    </div>

    <div id="listeBlocs"></div>

    <div class="menu-ajout">
      <button class="btn btn-primaire" onclick="basculerMenuAjout()">+ Ajouter un élément</button>
      <div class="liste-types" id="listeTypes">
        ${TYPES_BLOCS.map(t => `<button data-ajouter-type="${t.valeur}">${t.icone} ${t.label} <span style="color:var(--texte-gris);font-size:11px">— ${t.usage}</span></button>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('selectStatut').addEventListener('change', gererChangementStatut);
  const btnValider = document.getElementById('btnValider');
  if (btnValider) btnValider.addEventListener('click', async () => {
    const { error } = await supabaseClient.from('seances').update({ statut: 'publie' }).eq('id', seance.id);
    if (error) return alert(error.message);
    seance.statut = 'publie';
    rendre();
  });
  document.getElementById('inputDiscipline').addEventListener('change', async (e) => {
    seance.discipline = e.target.value || null;
    await supabaseClient.from('seances').update({ discipline: seance.discipline }).eq('id', seance.id);
    afficherSauvegarde();
  });
  document.getElementById('listeTypes').addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-ajouter-type]');
    if (bouton) ajouterBloc(bouton.dataset.ajouterType, null);
  });

  // Ferme toute palette de couleur ouverte si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-couleur-bloc')) {
      document.querySelectorAll('.palette-bloc.ouverte').forEach(p => p.classList.remove('ouverte'));
    }
    if (!e.target.closest('.menu-couleur-riche')) {
      document.querySelectorAll('.palette-riche.ouverte').forEach(p => p.classList.remove('ouverte'));
    }
  });

  rendreListeBlocs();
}

function basculerMenuAjout() {
  document.getElementById('listeTypes').classList.toggle('ouvert');
}

// --- LISTE DES BLOCS (imbrication + glisser-déposer) ----------------------

function rendreListeBlocs() {
  const conteneurBlocs = document.getElementById('listeBlocs');
  const topNiveau = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);

  conteneurBlocs.innerHTML = topNiveau.length
    ? topNiveau.map(b => htmlBloc(b)).join('')
    : '<p class="chargement">Aucun bloc pour l\'instant — cliquez sur « + Ajouter un élément ».</p>';

  blocs.forEach(b => attacherEcouteursBloc(b));

  activerGlisserDeposer(conteneurBlocs, null);
  document.querySelectorAll('[data-conteneur-enfants]').forEach(c => {
    activerGlisserDeposer(c, parseInt(c.dataset.conteneurEnfants, 10));
  });
}

function htmlBloc(b) {
  const info = infoType(b.type_bloc);
  const estSection = TYPES_SECTIONS.includes(b.type_bloc);
  const enfants = estSection ? blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre) : [];
  const ouvert = sectionsOuvertes.has(b.id);
  const couleur = (b.contenu && b.contenu.couleurBloc) || info.couleur;
  const afficherTitre = !(b.contenu && b.contenu.afficherTitre === false);
  const libelle = (b.contenu && b.contenu.libelle) || info.label;

  const swatchesBloc = PALETTE_COULEURS.map(col =>
    `<button type="button" class="pastille-couleur" data-choisir-couleur-bloc="${col.valeur}" title="${col.nom}" style="background:${col.valeur}"></button>`
  ).join('');

  const champIa = champIA(b.type_bloc);
  const texteExistantIa = champIa && b.contenu && (b.contenu[champIa] || '').toString().replace(/<[^>]*>/g, '').trim();

  return `
    <div class="bloc" draggable="true" data-bloc-id="${b.id}" style="border-left-color:${couleur};background:${teinteClaire(couleur)}">
      <div class="bloc-entete">
        <span class="bloc-type" style="color:${couleur}">
          ${info.icone}
          <input type="text" class="libelle-bloc-editable" data-libelle-bloc value="${echapper(libelle)}" style="color:${couleur}">
        </span>
        <div class="bloc-actions">
          <label title="Afficher ce nom dans l'aperçu élève" style="display:flex;align-items:center;gap:3px;font-size:11px;font-weight:400;color:var(--texte-gris)">
            <input type="checkbox" data-toggle-titre-bloc ${afficherTitre ? 'checked' : ''}> Titre visible
          </label>
          ${champIa ? `
          <button type="button" title="Générer un brouillon avec l'IA" data-action-ia="generer">✨</button>
          ${texteExistantIa ? `<button type="button" title="Améliorer ce texte avec l'IA" data-action-ia="ameliorer">🪄</button>` : ''}` : ''}
          <div class="menu-couleur-bloc">
            <button type="button" title="Couleur du bloc" data-ouvrir-couleur-bloc>🎨</button>
            <div class="palette-bloc" data-palette-bloc>${swatchesBloc}</div>
          </div>
          <button title="Dupliquer" data-action-bloc="dupliquer">📑</button>
          <button title="Supprimer" data-action-bloc="supprimer">🗑️</button>
        </div>
      </div>
      <div class="bloc-corps">${html_editeurBloc(b)}</div>
      ${estSection ? `
        <div class="zone-section">
          <button type="button" class="btn btn-discret" data-toggle-section="${b.id}">${ouvert ? '▾' : '▸'} Contenu (${enfants.length} bloc${enfants.length > 1 ? 's' : ''})</button>
          <div class="sous-blocs" data-conteneur-enfants="${b.id}" style="display:${ouvert ? 'block' : 'none'}">
            ${enfants.map(e => htmlBloc(e)).join('')}
            <button class="btn btn-accent" style="margin-top:8px" data-ajouter-dans-section="${b.id}" type="button">+ Ajouter un bloc ici</button>
          </div>
        </div>` : ''}
    </div>`;
}

function attacherEcouteursBloc(bloc) {
  const el = document.querySelector(`.bloc[data-bloc-id="${bloc.id}"]`);
  if (!el) return;

  // Champs simples (texte, url, légende, nom, formule, consigne...)
  el.querySelectorAll(':scope > .bloc-corps [data-champ]').forEach(champEl => {
    champEl.addEventListener('input', () => {
      bloc.contenu = { ...bloc.contenu, [champEl.dataset.champ]: champEl.value };
      programmerSauvegardeBloc(bloc);
    });
  });

  // Éditeur de texte riche
  const zoneRiche = el.querySelector(':scope > .bloc-corps [data-champ-riche]');
  if (zoneRiche) {
    const sauverContenuRiche = () => {
      bloc.contenu = { ...bloc.contenu, [zoneRiche.dataset.champRiche]: zoneRiche.innerHTML };
      programmerSauvegardeBloc(bloc);
    };
    zoneRiche.addEventListener('input', sauverContenuRiche);

    // La sélection de texte se perd dès qu'on clique un bouton hors de la
    // zone éditable (le focus part sur le bouton) : c'est ce qui empêchait
    // le formatage couleur (et les autres commandes) de s'appliquer.
    // On la sauvegarde en continu et on la restaure juste avant chaque commande.
    let selectionSauvegardee = null;
    const sauvegarderSelection = () => {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && zoneRiche.contains(sel.anchorNode)) {
        selectionSauvegardee = sel.getRangeAt(0).cloneRange();
      }
    };
    zoneRiche.addEventListener('mouseup', sauvegarderSelection);
    zoneRiche.addEventListener('keyup', sauvegarderSelection);
    const restaurerSelectionEtFocus = () => {
      zoneRiche.focus();
      if (selectionSauvegardee) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(selectionSauvegardee);
      }
    };

    // Bug corrigé : la barre d'outils est désormais un seul bloc (voir blocs.js),
    // mais on utilise quand même querySelectorAll par précaution — avec l'ancien
    // découpage en 3 barres séparées, querySelector() ne renvoyait que la
    // première, et les boutons de couleur (texte/surlignage) des barres
    // suivantes ne recevaient jamais leurs écouteurs : c'est pour ça qu'ils
    // ne fonctionnaient pas.
    const barresOutils = el.querySelectorAll(':scope > .bloc-corps .barre-outils-texte');
    if (barresOutils.length) {
      // queryCommandState('justifyCenter'/'justifyRight'/'justifyFull') est peu
      // fiable dans les navigateurs (il peut répondre "vrai" par défaut sur une
      // zone vide) — c'est ce qui donnait l'impression que le curseur était
      // "centré par défaut". On calcule donc l'alignement réel nous-mêmes, en
      // lisant le text-align effectivement appliqué autour du curseur.
      const alignementActuel = () => {
        const sel = window.getSelection();
        let noeud = sel && sel.rangeCount && zoneRiche.contains(sel.anchorNode) ? sel.anchorNode : zoneRiche;
        let el2 = noeud.nodeType === 3 ? noeud.parentElement : noeud;
        while (el2 && el2 !== zoneRiche.parentElement) {
          const align = getComputedStyle(el2).textAlign;
          if (align && align !== 'start') return align;
          el2 = el2.parentElement;
        }
        return 'left';
      };
      const commandesEtatSimple = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
      const commandesAlignement = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
      const boutonsCommande = [];
      const mettreAJourEtatBarreOutils = () => {
        const align = alignementActuel();
        boutonsCommande.forEach(b => {
          const cmd = b.dataset.cmd;
          if (commandesEtatSimple.includes(cmd)) {
            try { b.classList.toggle('actif', document.queryCommandState(cmd)); } catch (_e) { /* ignoré */ }
          } else if (commandesAlignement[cmd]) {
            b.classList.toggle('actif', commandesAlignement[cmd] === align);
          }
        });
      };

      barresOutils.forEach(barreOutils => {
        barreOutils.querySelectorAll('button[data-cmd]').forEach(btn => {
          boutonsCommande.push(btn);
          // Empêche le bouton de voler le focus au mousedown (sinon la
          // sélection dans la zone éditable est perdue avant même le clic).
          btn.addEventListener('mousedown', (e) => e.preventDefault());
          btn.addEventListener('click', () => {
            restaurerSelectionEtFocus();
            if (btn.dataset.cmd === 'hiliteColor') {
              document.execCommand('styleWithCSS', false, true);
              document.execCommand('hiliteColor', false, btn.dataset.valeur === 'transparent' ? 'transparent' : btn.dataset.valeur);
            } else if (btn.dataset.cmd === 'foreColor') {
              document.execCommand('styleWithCSS', false, true);
              document.execCommand('foreColor', false, btn.dataset.valeur);
            } else {
              document.execCommand(btn.dataset.cmd, false, null);
            }
            sauvegarderSelection();
            sauverContenuRiche();
            mettreAJourEtatBarreOutils();
          });
        });

        // Roues de couleur personnalisées (en plus des 9 teintes de la palette) :
        // pas de preventDefault sur mousedown ici, sinon le sélecteur de couleur
        // natif du navigateur ne s'ouvrirait jamais.
        barreOutils.querySelectorAll('input[type="color"][data-cmd]').forEach(inputCouleur => {
          inputCouleur.addEventListener('input', () => {
            restaurerSelectionEtFocus();
            document.execCommand('styleWithCSS', false, true);
            document.execCommand(inputCouleur.dataset.cmd, false, inputCouleur.value);
            sauvegarderSelection();
            sauverContenuRiche();
          });
        });

        // Menus déroulants de couleur (🎨 Texte / 🖍️ Surlignage) : remplacent
        // l'ancien alignement de pastilles en permanence dans la barre.
        barreOutils.querySelectorAll('.menu-couleur-riche').forEach(menu => {
          const boutonMenu = menu.querySelector('[data-ouvrir-couleur-riche]');
          const palette = menu.querySelector('[data-palette-riche]');
          if (!boutonMenu || !palette) return;
          boutonMenu.addEventListener('mousedown', (e) => e.preventDefault());
          boutonMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const etaitOuverte = palette.classList.contains('ouverte');
            document.querySelectorAll('.palette-riche.ouverte, .palette-bloc.ouverte').forEach(p => p.classList.remove('ouverte'));
            if (!etaitOuverte) palette.classList.add('ouverte');
          });
        });

        const selectPolice = barreOutils.querySelector('[data-cmd-select="fontName"]');
        if (selectPolice) selectPolice.addEventListener('change', () => {
          restaurerSelectionEtFocus();
          document.execCommand('fontName', false, selectPolice.value);
          sauvegarderSelection();
          sauverContenuRiche();
        });

        // Taille de texte : execCommand('fontSize') utilise une échelle héritée
        // 1-7 censée être remplacée par un <font size="n"> — mais Chrome
        // l'applique en fait directement en mot-clé CSS (ex: "xxx-large" pour le
        // niveau 7), sans jamais créer de <font> à remplacer. Résultat vérifié :
        // le texte devenait énorme quelle que soit la taille choisie, et les
        // sélections suivantes n'avaient plus aucun effet visible. On applique
        // donc la taille nous-mêmes, directement en pixels, sans passer par
        // execCommand : il faut une sélection de texte (pas juste un curseur).
        const selectTaille = barreOutils.querySelector('[data-cmd-select-taille]');
        if (selectTaille) selectTaille.addEventListener('change', () => {
          restaurerSelectionEtFocus();
          const sel = window.getSelection();
          if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
            alert('Sélectionnez d\'abord le texte dont vous voulez changer la taille, puis choisissez une taille.');
            return;
          }
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontSize = selectTaille.value + 'px';
          try {
            range.surroundContents(span);
          } catch (_e) {
            // La sélection traverse plusieurs éléments (ex : à cheval sur un
            // passage déjà en gras et du texte simple) — surroundContents()
            // refuse ce cas précis ; on extrait puis on réinsère à la place.
            const contenu = range.extractContents();
            span.appendChild(contenu);
            range.insertNode(span);
          }
          sel.removeAllRanges();
          const nouvelle = document.createRange();
          nouvelle.selectNodeContents(span);
          sel.addRange(nouvelle);
          sauvegarderSelection();
          sauverContenuRiche();
        });
      });

      // Les boutons Gras/Italique/Alignement/... reflètent l'état du texte sous
      // le curseur, comme dans un vrai traitement de texte (plus intuitif : on
      // voit tout de suite si la sélection actuelle est déjà en gras, alignée
      // à droite, etc. — et l'alignement par défaut s'affiche bien à gauche).
      zoneRiche.addEventListener('keyup', mettreAJourEtatBarreOutils);
      zoneRiche.addEventListener('mouseup', mettreAJourEtatBarreOutils);
      zoneRiche.addEventListener('focus', mettreAJourEtatBarreOutils);
      mettreAJourEtatBarreOutils();
    }
  }

  // Palier
  const selectPalier = el.querySelector(':scope > .bloc-corps [data-champ-palier]');
  if (selectPalier) {
    selectPalier.addEventListener('change', () => {
      bloc.palier = selectPalier.value || null;
      programmerSauvegardeBloc(bloc);
    });
  }

  // Nom du bloc modifiable (remplace le libellé figé du type)
  const inputLibelle = el.querySelector(':scope > .bloc-entete [data-libelle-bloc]');
  if (inputLibelle) inputLibelle.addEventListener('input', () => {
    bloc.contenu = { ...bloc.contenu, libelle: inputLibelle.value };
    programmerSauvegardeBloc(bloc);
  });

  // Afficher/masquer le nom du bloc dans l'aperçu élève
  const caseTitreVisible = el.querySelector(':scope > .bloc-entete [data-toggle-titre-bloc]');
  if (caseTitreVisible) caseTitreVisible.addEventListener('change', () => {
    bloc.contenu = { ...bloc.contenu, afficherTitre: caseTitreVisible.checked };
    programmerSauvegardeBloc(bloc);
  });

  // Couleur du bloc (harmonise automatiquement fond + bordure + libellé)
  const boutonCouleur = el.querySelector(':scope > .bloc-entete [data-ouvrir-couleur-bloc]');
  const paletteBloc = el.querySelector(':scope > .bloc-entete [data-palette-bloc]');
  if (boutonCouleur && paletteBloc) {
    boutonCouleur.addEventListener('click', (e) => {
      e.stopPropagation();
      paletteBloc.classList.toggle('ouverte');
    });
    paletteBloc.querySelectorAll('[data-choisir-couleur-bloc]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        bloc.contenu = { ...bloc.contenu, couleurBloc: swatch.dataset.choisirCouleurBloc };
        programmerSauvegardeBloc(bloc);
        rendreListeBlocs();
      });
    });
  }

  attacherEcouteursTableau(el, bloc);
  attacherEcouteursQuestions(el, bloc);

  // Assistant IA (générer un brouillon / améliorer le texte existant)
  const boutonGenererIA = el.querySelector(':scope > .bloc-entete [data-action-ia="generer"]');
  if (boutonGenererIA) boutonGenererIA.addEventListener('click', () => ouvrirGenerationIA(bloc));
  const boutonAmeliorerIA = el.querySelector(':scope > .bloc-entete [data-action-ia="ameliorer"]');
  if (boutonAmeliorerIA) boutonAmeliorerIA.addEventListener('click', () => ameliorerBlocAvecIA(bloc, boutonAmeliorerIA));

  // Sections : déplier/replier + ajouter un bloc à l'intérieur
  const boutonToggleSection = el.querySelector(`:scope > .zone-section [data-toggle-section="${bloc.id}"]`);
  if (boutonToggleSection) boutonToggleSection.addEventListener('click', () => {
    const conteneurEnfants = el.querySelector(`[data-conteneur-enfants="${bloc.id}"]`);
    const ouvert = sectionsOuvertes.has(bloc.id);
    if (ouvert) sectionsOuvertes.delete(bloc.id); else sectionsOuvertes.add(bloc.id);
    conteneurEnfants.style.display = ouvert ? 'none' : 'block';
    boutonToggleSection.textContent = boutonToggleSection.textContent.replace(ouvert ? '▾' : '▸', ouvert ? '▸' : '▾');
  });
  const boutonAjouterDansSection = el.querySelector(`:scope > .zone-section [data-ajouter-dans-section="${bloc.id}"]`);
  if (boutonAjouterDansSection) boutonAjouterDansSection.addEventListener('click', () => ouvrirAjoutBlocDansSection(bloc.id));

  // Actions dupliquer / supprimer
  el.querySelectorAll(':scope > .bloc-entete [data-action-bloc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.actionBloc === 'dupliquer') dupliquerBloc(bloc);
      if (btn.dataset.actionBloc === 'supprimer') supprimerBloc(bloc);
    });
  });
}

function ouvrirAjoutBlocDansSection(parentBlocId) {
  ouvrirModal({
    titre: 'Ajouter un bloc dans cette section',
    champs: [{
      nom: 'type', label: 'Type de bloc', type: 'select',
      options: TYPES_BLOCS.map(t => ({ valeur: t.valeur, label: `${t.icone} ${t.label}` }))
    }],
    texteValider: 'Ajouter',
    onValider: ({ type }) => ajouterBloc(type, parentBlocId)
  });
}

// --- TABLEAU : cellules, lignes/colonnes, en-tête, bordures, fusion -------

function attacherEcouteursTableau(el, bloc) {
  const c = () => bloc.contenu || {};

  el.querySelectorAll(':scope > .bloc-corps [data-tableau-ligne]').forEach(cellEl => {
    cellEl.addEventListener('input', () => {
      const i = parseInt(cellEl.dataset.tableauLigne, 10);
      const j = parseInt(cellEl.dataset.tableauColonne, 10);
      const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
      lignes[i][j] = cellEl.value;
      bloc.contenu = { ...c(), lignes };
      programmerSauvegardeBloc(bloc);
    });
  });

  const declencherRerendu = (nouveauxChamps) => {
    bloc.contenu = { ...c(), ...nouveauxChamps };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  };

  const boutonLigne = el.querySelector(':scope > .bloc-corps [data-action="ajouter-ligne"]');
  if (boutonLigne) boutonLigne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    lignes.push(lignes[0].map(() => ''));
    declencherRerendu({ lignes });
  });
  const boutonSupprimerLigne = el.querySelector(':scope > .bloc-corps [data-action="supprimer-ligne"]');
  if (boutonSupprimerLigne) boutonSupprimerLigne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    if (lignes.length <= 1) return alert('Le tableau doit garder au moins une ligne.');
    lignes.pop();
    declencherRerendu({ lignes, fusions: (c().fusions || []).filter(f => f.ligne < lignes.length) });
  });
  const boutonColonne = el.querySelector(':scope > .bloc-corps [data-action="ajouter-colonne"]');
  if (boutonColonne) boutonColonne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l, '']);
    declencherRerendu({ lignes });
  });
  const boutonSupprimerColonne = el.querySelector(':scope > .bloc-corps [data-action="supprimer-colonne"]');
  if (boutonSupprimerColonne) boutonSupprimerColonne.addEventListener('click', () => {
    const lignes = (c().lignes || [['', ''], ['', '']]).map(l => [...l]);
    if (lignes[0].length <= 1) return alert('Le tableau doit garder au moins une colonne.');
    const derniereColonne = lignes[0].length - 1;
    lignes.forEach(l => l.pop());
    declencherRerendu({ lignes, fusions: (c().fusions || []).filter(f => f.colonneFin < derniereColonne) });
  });
  const boutonSupprimerTitreTableau = el.querySelector(':scope > .bloc-corps [data-action="supprimer-titre-tableau"]');
  if (boutonSupprimerTitreTableau) boutonSupprimerTitreTableau.addEventListener('click', () => declencherRerendu({ titre: '' }));

  const caseEntete = el.querySelector(':scope > .bloc-corps [data-champ-entete]');
  if (caseEntete) caseEntete.addEventListener('change', () => declencherRerendu({ entete: caseEntete.checked }));

  const caseBordures = el.querySelector(':scope > .bloc-corps [data-champ-bordures]');
  if (caseBordures) caseBordures.addEventListener('change', () => declencherRerendu({ bordures: caseBordures.checked }));

  el.querySelectorAll(':scope > .bloc-corps [data-action="couleur-entete"]').forEach(btn => {
    btn.addEventListener('click', () => declencherRerendu({ couleurEntete: btn.dataset.valeur }));
  });

  el.querySelectorAll(':scope > .bloc-corps [data-action="fusionner-cellule"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ligne = parseInt(btn.dataset.ligne, 10);
      const colonne = parseInt(btn.dataset.colonne, 10);
      const fusions = [...(c().fusions || []), { ligne, colonneDebut: colonne, colonneFin: colonne + 1 }];
      declencherRerendu({ fusions });
    });
  });
  el.querySelectorAll(':scope > .bloc-corps [data-action="separer-cellule"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ligne = parseInt(btn.dataset.ligne, 10);
      const colonne = parseInt(btn.dataset.colonne, 10);
      const fusions = (c().fusions || []).filter(f => !(f.ligne === ligne && f.colonneDebut === colonne));
      declencherRerendu({ fusions });
    });
  });
}

// --- EXERCICE / QUIZ / ÉVALUATION : questions (publiques) + corrigé (privé) --
// Les questions vivent dans bloc.contenu.questions (comme le reste du bloc,
// envoyées à l'élève). Le corrigé vit dans une table séparée (corriges_exercices,
// jamais lisible par un élève via les policies RLS) : on le charge à part, de
// façon asynchrone, la première fois que ce bloc s'affiche dans l'éditeur.
function attacherEcouteursQuestions(el, bloc) {
  const conteneur = el.querySelector(':scope > .bloc-corps [data-questions-bloc]');
  if (!conteneur) return;

  const listeEl = conteneur.querySelector('[data-liste-questions]');
  const etatCorrigeEl = conteneur.querySelector('[data-etat-corrige]');
  const btnAjouterQuestion = conteneur.querySelector('[data-ajouter-question]');
  let corrigeActuel = null; // null tant que le corrigé n'est pas encore chargé

  const questions = () => Array.isArray(bloc.contenu && bloc.contenu.questions) ? bloc.contenu.questions : [];
  const majQuestions = (liste) => { bloc.contenu = { ...bloc.contenu, questions: liste }; programmerSauvegardeBloc(bloc); };
  const sauvegarderCorrige = () => { if (corrigeActuel) programmerSauvegardeCorrige(bloc.id, corrigeActuel); };

  function rerender() {
    const qs = questions();
    listeEl.innerHTML = qs.length
      ? qs.map((q, i) => html_questionEditeur(q, i, corrigeActuel)).join('')
      : '<p class="note-future">Aucune question pour l\'instant.</p>';
    wirerQuestions();
  }

  function wirerQuestions() {
    listeEl.querySelectorAll('[data-question-id]').forEach(qEl => {
      const qId = qEl.dataset.questionId;
      const q = questions().find(x => x.id === qId);
      if (!q) return;
      const c = corrigeActuel ? (corrigeActuel[qId] = corrigeActuel[qId] || {}) : null;

      qEl.querySelector('[data-question-champ="type"]').addEventListener('change', (e) => {
        q.type = e.target.value;
        if (q.type === 'qcm' && !Array.isArray(q.options)) q.options = ['', ''];
        majQuestions(questions());
        rerender();
      });

      qEl.querySelector('[data-champ="enonce"]').addEventListener('input', (e) => {
        q.enonce = e.target.value;
        majQuestions(questions());
      });

      const inputPoints = qEl.querySelector('[data-question-points]');
      if (inputPoints) inputPoints.addEventListener('input', () => {
        if (!c) return;
        c.points = parseFloat(inputPoints.value) || 0;
        sauvegarderCorrige();
      });

      qEl.querySelector('[data-supprimer-question]').addEventListener('click', () => {
        majQuestions(questions().filter(x => x.id !== qId));
        if (corrigeActuel) { delete corrigeActuel[qId]; sauvegarderCorrige(); }
        rerender();
      });

      if (q.type === 'qcm') {
        qEl.querySelectorAll('[data-option-index]').forEach(inputOpt => {
          inputOpt.addEventListener('input', () => {
            const i = parseInt(inputOpt.dataset.optionIndex, 10);
            q.options[i] = inputOpt.value;
            majQuestions(questions());
          });
        });
        qEl.querySelectorAll('[data-question-bonne-index]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            c.bonneReponse = radio.dataset.questionBonneIndex;
            sauvegarderCorrige();
          });
        });
        const btnAjouterOption = qEl.querySelector('[data-ajouter-option]');
        if (btnAjouterOption) btnAjouterOption.addEventListener('click', () => {
          q.options = [...(q.options || []), ''];
          majQuestions(questions());
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-option]').forEach(btn => {
          btn.addEventListener('click', () => {
            q.options.splice(parseInt(btn.dataset.supprimerOption, 10), 1);
            majQuestions(questions());
            rerender();
          });
        });
      }

      if (q.type === 'vrai_faux') {
        qEl.querySelectorAll('[data-question-bonne-vf]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            c.bonneReponse = radio.dataset.questionBonneVf === 'true';
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'reponse_courte') {
        const inputRc = qEl.querySelector('[data-question-reponse-courte]');
        if (inputRc) inputRc.addEventListener('input', () => {
          if (!c) return;
          c.bonneReponse = inputRc.value.split(',').map(s => s.trim()).filter(Boolean);
          sauvegarderCorrige();
        });
      }

      if (q.type === 'reponse_longue') {
        const texteBareme = qEl.querySelector('[data-question-bareme]');
        if (texteBareme) texteBareme.addEventListener('input', () => {
          if (!c) return;
          c.bareme = texteBareme.value;
          sauvegarderCorrige();
        });
      }
    });
  }

  if (btnAjouterQuestion) {
    btnAjouterQuestion.disabled = true; // le temps que le corrigé charge, pour ne rien écraser
    btnAjouterQuestion.addEventListener('click', () => {
      if (!corrigeActuel) return;
      const nouvelleQuestion = { id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), type: 'qcm', enonce: '', options: ['', ''] };
      majQuestions([...questions(), nouvelleQuestion]);
      corrigeActuel[nouvelleQuestion.id] = { points: 1 };
      sauvegarderCorrige();
      rerender();
    });
  }

  supabaseClient.from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle()
    .then(({ data }) => {
      corrigeActuel = (data && data.corrige) || {};
      if (etatCorrigeEl) etatCorrigeEl.remove();
      if (btnAjouterQuestion) btnAjouterQuestion.disabled = false;
      rerender();
    });
}

let minuteriesSauvegardeCorrige = {};
function programmerSauvegardeCorrige(blocId, corrige) {
  clearTimeout(minuteriesSauvegardeCorrige[blocId]);
  minuteriesSauvegardeCorrige[blocId] = setTimeout(async () => {
    await supabaseClient.from('corriges_exercices').upsert(
      { bloc_id: blocId, corrige, modifie_le: new Date().toISOString() }, { onConflict: 'bloc_id' }
    );
    afficherSauvegarde();
  }, 700);
}

// --- GLISSER-DÉPOSER (scopé par conteneur : racine ou une section) --------

// Bug corrigé : déplacer un bloc RACINE ↔ SECTION (ou d'une section à une
// autre) ne faisait rien, car le survol d'un autre conteneur que celui
// d'origine était explicitement ignoré ("pas de déplacement entre
// conteneurs pour l'instant"), et le dépôt ne recalculait ni la position ni
// le parent du bloc déplacé dans ce cas. Le déplacement entre conteneurs est
// maintenant géré : la position (ordre) ET le rattachement (parent_bloc_id)
// sont recalculés à la fois dans le conteneur d'arrivée et, si le bloc en
// est parti, dans celui de départ.
function activerGlisserDeposer(conteneur, parentBlocId) {
  const blocsDirects = [...conteneur.querySelectorAll(':scope > .bloc')];

  // Permet aussi de déposer après le dernier bloc, ou dans une section
  // encore vide (survol du fond du conteneur, pas d'un bloc existant).
  conteneur.addEventListener('dragover', (e) => {
    if (!dragEtat.element || e.target !== conteneur) return;
    e.preventDefault();
    conteneur.appendChild(dragEtat.element);
  });
  conteneur.addEventListener('drop', (e) => {
    if (!dragEtat.element || e.target !== conteneur) return;
    e.preventDefault();
    finaliserDepot(conteneur, parentBlocId);
  });

  blocsDirects.forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      dragEtat = { element: el, conteneurOrigine: conteneur, parentBlocIdOrigine: parentBlocId };
      el.classList.add('en-glissement');
    });
    el.addEventListener('dragend', (e) => {
      e.stopPropagation();
      el.classList.remove('en-glissement');
      dragEtat = { element: null, conteneurOrigine: null, parentBlocIdOrigine: undefined };
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragEtat.element || dragEtat.element === el || dragEtat.element.contains(el)) return;
      const rect = el.getBoundingClientRect();
      const apres = (e.clientY - rect.top) > rect.height / 2;
      conteneur.insertBefore(dragEtat.element, apres ? el.nextSibling : el);
    });
    el.addEventListener('drop', (e) => {
      e.stopPropagation();
      finaliserDepot(conteneur, parentBlocId);
    });
  });
}

async function finaliserDepot(conteneurDestination, parentBlocIdDestination) {
  const conteneurOrigine = dragEtat.conteneurOrigine;
  const parentBlocIdOrigine = dragEtat.parentBlocIdOrigine;
  await enregistrerNouvelOrdre(conteneurDestination, parentBlocIdDestination);
  // Le bloc a changé de conteneur : celui de départ a une place vide à
  // recompacter (les blocs restants n'ont pas changé de parent, seule leur
  // position se resserre).
  if (conteneurOrigine && conteneurOrigine !== conteneurDestination) {
    await enregistrerNouvelOrdre(conteneurOrigine, parentBlocIdOrigine);
  }
}

async function enregistrerNouvelOrdre(conteneur, parentBlocId) {
  const idsOrdonnes = [...conteneur.querySelectorAll(':scope > .bloc')].map(el => parseInt(el.dataset.blocId, 10));
  idsOrdonnes.forEach((id, index) => {
    const b = blocs.find(x => x.id === id);
    if (b) {
      b.ordre = index;
      b.parent_bloc_id = parentBlocId ?? null; // rattache au conteneur où le bloc se trouve réellement
    }
  });
  for (const id of idsOrdonnes) {
    const b = blocs.find(x => x.id === id);
    await supabaseClient.from('blocs_seance').update({ ordre: b.ordre, parent_bloc_id: b.parent_bloc_id }).eq('id', id);
  }
  afficherSauvegarde();
}

// --- SAUVEGARDE (debounce par bloc) ----------------------------------------

function programmerSauvegardeBloc(bloc) {
  clearTimeout(minuteriesSauvegarde[bloc.id]);
  minuteriesSauvegarde[bloc.id] = setTimeout(async () => {
    await supabaseClient.from('blocs_seance').update({ contenu: bloc.contenu, palier: bloc.palier }).eq('id', bloc.id);
    await supabaseClient.from('seances').update({ modifie_le: new Date().toISOString(), modifie_par: profilAdmin.id }).eq('id', seance.id);
    afficherSauvegarde();
  }, 700);
}

function afficherSauvegarde() {
  const el = document.getElementById('infoSauvegarde');
  if (el) el.textContent = `Dernier enregistrement : ${new Date().toLocaleString('fr-FR')}`;
}

// --- ASSISTANT IA (générer un brouillon / améliorer un texte) --------------
// Appelle la fonction Supabase Edge "assistant-ia", qui contacte l'IA côté
// serveur (la clé de service n'est jamais exposée dans le navigateur).

async function appelerAssistantIA(payload) {
  const { data, error } = await supabaseClient.functions.invoke('assistant-ia', { body: payload });
  if (error) {
    let message = error.message || "Le service IA n'a pas répondu.";
    try {
      const corps = await error.context?.json?.();
      if (corps?.error) message = corps.error;
    } catch (_ignore) { /* on garde le message par défaut */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return (data?.texte || '').trim();
}

function texteBrutDepuisHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

// L'IA reçoit la consigne de ne pas utiliser de Markdown, mais elle en glisse
// parfois quand même (**gras**, listes à puces, titres #). Ces deux fonctions
// nettoient ça : l'une produit du vrai HTML pour les champs "riches"
// (contenteditable), l'autre du texte simple débarrassé des symboles pour les
// champs classiques (input/textarea), où ces symboles s'afficheraient tels quels.

function nettoyerMarkdown(texte) {
  return (texte || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, '$1$2')
    .replace(/`{1,3}([^`]+?)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .trim();
}

function markdownVersHtml(texte) {
  const lignes = (texte || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lignes.length) return `<p>${echapper(texte)}</p>`;
  const inline = (ligne) => echapper(ligne)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`{1,3}([^`]+?)`{1,3}/g, '<code>$1</code>');
  let html = '';
  let listeOuverte = null; // 'ul' | 'ol' | null
  const fermerListe = () => { if (listeOuverte) { html += `</${listeOuverte}>`; listeOuverte = null; } };
  for (const ligne of lignes) {
    const puce = ligne.match(/^[-*+]\s+(.*)$/);
    const numero = ligne.match(/^\d+[.)]\s+(.*)$/);
    const titre = ligne.match(/^#{1,6}\s+(.*)$/);
    if (puce) {
      if (listeOuverte !== 'ul') { fermerListe(); html += '<ul>'; listeOuverte = 'ul'; }
      html += `<li>${inline(puce[1])}</li>`;
    } else if (numero) {
      if (listeOuverte !== 'ol') { fermerListe(); html += '<ol>'; listeOuverte = 'ol'; }
      html += `<li>${inline(numero[1])}</li>`;
    } else {
      fermerListe();
      html += titre ? `<p><strong>${inline(titre[1])}</strong></p>` : `<p>${inline(ligne)}</p>`;
    }
  }
  fermerListe();
  return html;
}

async function ameliorerBlocAvecIA(bloc, bouton) {
  const champ = champIA(bloc.type_bloc);
  if (!champ) return;
  const estRiche = TYPES_TEXTE_LIBRE.includes(bloc.type_bloc);
  const valeurActuelle = (bloc.contenu && bloc.contenu[champ]) || '';
  const texteActuel = estRiche ? texteBrutDepuisHtml(valeurActuelle) : valeurActuelle.toString();
  if (!texteActuel.trim()) return alert('Ce bloc est vide — rien à améliorer pour le moment.');

  const texteBoutonOriginal = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = '⏳';
  try {
    const resultat = await appelerAssistantIA({
      action: 'ameliorer', texte: texteActuel, typeBloc: bloc.type_bloc,
      classe: chaineNavigation?.classeNom, champ: chaineNavigation?.champNom
    });
    bloc.contenu = { ...bloc.contenu, [champ]: estRiche ? markdownVersHtml(resultat) : nettoyerMarkdown(resultat) };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  } catch (e) {
    alert("Erreur IA : " + e.message);
  } finally {
    if (bouton.isConnected) { bouton.disabled = false; bouton.textContent = texteBoutonOriginal; }
  }
}

function ouvrirGenerationIA(bloc) {
  const champ = champIA(bloc.type_bloc);
  if (!champ) return;
  ouvrirModal({
    titre: "Générer un brouillon avec l'IA",
    champs: [{ nom: 'sujet', label: 'Sujet à donner à l\'IA', type: 'textarea', placeholder: 'Ex : la conjugaison du verbe être au présent' }],
    texteValider: 'Générer',
    onValider: async ({ sujet }) => {
      if (!sujet || !sujet.trim()) return;
      try {
        const resultat = await appelerAssistantIA({
          action: 'generer', sujet, typeBloc: bloc.type_bloc,
          classe: chaineNavigation?.classeNom, champ: chaineNavigation?.champNom
        });
        const estRiche = TYPES_TEXTE_LIBRE.includes(bloc.type_bloc);
        bloc.contenu = { ...bloc.contenu, [champ]: estRiche ? markdownVersHtml(resultat) : nettoyerMarkdown(resultat) };
        programmerSauvegardeBloc(bloc);
        rendreListeBlocs();
      } catch (e) {
        alert("Erreur IA : " + e.message);
      }
    }
  });
}

// --- AJOUT / DUPLICATION / SUPPRESSION DE BLOCS -----------------------------

async function ajouterBloc(type, parentBlocId) {
  document.getElementById('listeTypes').classList.remove('ouvert');
  const fratrie = blocs.filter(b => (b.parent_bloc_id || null) === (parentBlocId || null));
  const ordreMax = fratrie.length ? Math.max(...fratrie.map(b => b.ordre)) : -1;
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: type, contenu: {}, ordre: ordreMax + 1, parent_bloc_id: parentBlocId || null
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);
  if (parentBlocId) sectionsOuvertes.add(parentBlocId);
  rendreListeBlocs();
  afficherSauvegarde();
}

async function dupliquerBloc(bloc) {
  const fratrie = blocs.filter(b => (b.parent_bloc_id || null) === (bloc.parent_bloc_id || null));
  const ordreMax = Math.max(...fratrie.map(b => b.ordre));
  const { data, error } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: bloc.type_bloc, contenu: bloc.contenu, palier: bloc.palier,
    ordre: ordreMax + 1, parent_bloc_id: bloc.parent_bloc_id || null
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);

  // Pour un exercice/quiz/évaluation, le corrigé vit dans une table séparée
  // (corriges_exercices) : il faut le copier explicitement vers le nouveau
  // bloc, sinon la copie garderait des questions sans aucune bonne réponse.
  if (['exercice', 'quiz', 'evaluation'].includes(bloc.type_bloc)) {
    const { data: corrigeSource } = await supabaseClient
      .from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle();
    if (corrigeSource) {
      await supabaseClient.from('corriges_exercices').insert({ bloc_id: data.id, corrige: corrigeSource.corrige });
    }
  }

  rendreListeBlocs();
  // Note : les sous-blocs d'une section dupliquée ne sont pas encore
  // copiés automatiquement — à affiner avec les règles de profondeur.
}

function supprimerBloc(bloc) {
  const nbEnfants = blocs.filter(b => b.parent_bloc_id === bloc.id).length;
  confirmerAction(nbEnfants ? `Supprimer ce bloc et les ${nbEnfants} bloc(s) qu'il contient ?` : 'Supprimer ce bloc ?', async () => {
    const { error } = await supabaseClient.from('blocs_seance').delete().eq('id', bloc.id);
    if (error) return alert(error.message);
    blocs = blocs.filter(b => b.id !== bloc.id && b.parent_bloc_id !== bloc.id);
    rendreListeBlocs();
  });
}

// --- STATUT (brouillon / publié / archivé) ----------------------------------

async function gererChangementStatut(e) {
  const nouveauStatut = e.target.value;
  if (nouveauStatut === 'publie' && !peutValider) {
    alert("Vous n'avez pas les droits de validation nécessaires pour publier cette séance. Elle reste en l'état actuel.");
    e.target.value = seance.statut;
    return;
  }
  const { error } = await supabaseClient.from('seances').update({ statut: nouveauStatut }).eq('id', seance.id);
  if (error) { alert(error.message); e.target.value = seance.statut; return; }
  seance.statut = nouveauStatut;
  afficherSauvegarde();
}

// --- DUPLICATION DE SÉANCE ---------------------------------------------------

function dupliquerSeance() {
  confirmerAction('Dupliquer cette séance (avec tous ses blocs) ?', async () => {
    const { data: nouvelleSeance, error } = await supabaseClient.from('seances').insert({
      sa_id: seance.sa_id, titre: seance.titre + ' (copie)', statut: 'brouillon', ordre: seance.ordre + 1,
      cree_par: profilAdmin.id
    }).select().single();
    if (error) return alert(error.message);

    // On duplique d'abord les blocs de premier niveau, puis leurs enfants,
    // pour reconstituer les sections avec leur contenu.
    const correspondance = {}; // ancien id -> nouvel id
    const topNiveau = blocs.filter(b => !b.parent_bloc_id);
    for (const b of topNiveau) {
      const { data: copie } = await supabaseClient.from('blocs_seance').insert({
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier, ordre: b.ordre
      }).select().single();
      correspondance[b.id] = copie.id;
    }
    const enfants = blocs.filter(b => b.parent_bloc_id);
    for (const b of enfants) {
      const { data: copieEnfant } = await supabaseClient.from('blocs_seance').insert({
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier,
        ordre: b.ordre, parent_bloc_id: correspondance[b.parent_bloc_id] || null
      }).select().single();
      if (copieEnfant) correspondance[b.id] = copieEnfant.id;
    }

    // Corrigés des exercices/quiz/évaluations : table séparée, à copier à part
    // (sinon la séance dupliquée aurait des questions sans aucune bonne réponse).
    const blocsNotables = blocs.filter(b => ['exercice', 'quiz', 'evaluation'].includes(b.type_bloc));
    for (const b of blocsNotables) {
      if (!correspondance[b.id]) continue;
      const { data: corrigeSource } = await supabaseClient
        .from('corriges_exercices').select('corrige').eq('bloc_id', b.id).maybeSingle();
      if (corrigeSource) {
        await supabaseClient.from('corriges_exercices').insert({ bloc_id: correspondance[b.id], corrige: corrigeSource.corrige });
      }
    }

    window.location.href = `editeur-seance.html?id=${nouvelleSeance.id}`;
  });
}

// --- APERÇU ÉLÈVE (lecture seule, dans un nouvel onglet) ---------------------

function ouvrirApercu() {
  const fenetre = window.open('', '_blank');

  function rendreBlocApercu(b, estEnfant = false) {
    const info = infoType(b.type_bloc);
    const c = b.contenu || {};
    const couleur = c.couleurBloc || info.couleur;
    const afficherTitre = !(c.afficherTitre === false);
    const libelle = c.libelle || info.label;
    let corps = '';
    if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div>${contenuRicheInitial(c.texte)}</div>`;
    else if (b.type_bloc === 'titre') corps = `<h3 style="margin:0">${echapper(c.texte)}</h3>`;
    else if (b.type_bloc === 'consigne') corps = `<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'autre') corps = `${c.nom ? `<p style="font-weight:700">${echapper(c.nom)}</p>` : ''}<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" style="max-width:100%;border-radius:8px"><p><em>${echapper(c.legende)}</em></p>`;
    else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank">${echapper(c.legende) || c.url}</a></p>`;
    else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank">${echapper(c.nom)}</a></p>`;
    else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
    else if (b.type_bloc === 'tableau') {
      const fusions = c.fusions || [];
      const masquee = (i, j) => fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
      const colspan = (i, j) => { const f = fusions.find(f => f.ligne === i && f.colonneDebut === j); return f ? (f.colonneFin - f.colonneDebut + 1) : 1; };
      const bordure = c.bordures === false ? 'none' : '1px solid #E2E8F0';
      const couleurEntete = c.couleurEntete || '#F4F7F9';
      const texteEntete = c.couleurEntete ? texteContrastant(c.couleurEntete) : '#003366';
      const lignesHtml = (c.lignes || []).map((l, i) => {
        const style = c.entete && i === 0 ? ` style="background:${couleurEntete};font-weight:800;color:${texteEntete}"` : '';
        return `<tr${style}>${l.map((cel, j) => masquee(i, j) ? '' : `<td ${colspan(i, j) > 1 ? `colspan="${colspan(i, j)}"` : ''} style="border:${bordure};padding:6px">${echapper(cel)}</td>`).join('')}</tr>`;
      }).join('');
      corps = `${c.titre ? `<p style="font-weight:700;margin-bottom:6px">${echapper(c.titre)}</p>` : ''}<table style="border-collapse:collapse;width:100%">${lignesHtml}</table>`;
    }
    else if (['exercice', 'quiz', 'evaluation'].includes(b.type_bloc)) {
      const questions = Array.isArray(c.questions) ? c.questions : [];
      corps = `
        ${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}
        ${b.palier ? `<p><em>Palier : ${b.palier}</em></p>` : ''}
        ${questions.length ? questions.map((q, i) => {
          let champ = '';
          if (q.type === 'qcm') {
            champ = `<div style="margin-top:6px">${(q.options || []).map(opt => `<label style="display:block;margin-bottom:4px"><input type="radio" disabled> ${echapper(opt)}</label>`).join('')}</div>`;
          } else if (q.type === 'vrai_faux') {
            champ = `<div style="margin-top:6px;display:flex;gap:16px"><label><input type="radio" disabled> Vrai</label><label><input type="radio" disabled> Faux</label></div>`;
          } else if (q.type === 'reponse_courte') {
            champ = `<input type="text" disabled placeholder="Réponse..." style="margin-top:6px;width:100%;max-width:300px;padding:6px;border:1px solid #E2E8F0;border-radius:6px">`;
          } else {
            champ = `<textarea disabled placeholder="Réponse..." style="margin-top:6px;width:100%;min-height:70px;padding:6px;border:1px solid #E2E8F0;border-radius:6px"></textarea>`;
          }
          return `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed #E2E8F0">
            <p style="font-weight:700;margin:0">${i + 1}. ${echapper(q.enonce)}</p>
            ${champ}
          </div>`;
        }).join('') : `<p style="color:#94A3B8;font-style:italic">Aucune question pour l'instant.</p>`}
      `;
    }
    else corps = `<p>${echapper(c.consigne)}</p>${b.palier ? `<p><em>Palier : ${b.palier}</em></p>` : ''}`;

    const enfants = blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
    const contenuInterieur = `
      ${afficherTitre ? `<div style="font-size:12px;font-weight:bold;color:${couleur};text-transform:uppercase;margin-bottom:6px">${info.icone} ${echapper(libelle)}</div>` : ''}
      ${corps}
      ${enfants.length ? `<div style="margin-top:10px">${enfants.map(x => rendreBlocApercu(x, true)).join('')}</div>` : ''}
    `;
    // Un bloc rattaché à une section (Titre/Consigne) n'a pas sa propre carte :
    // il s'affiche dans le prolongement direct du contenu parent, aligné avec lui.
    if (estEnfant) return contenuInterieur;
    return `<div style="margin-bottom:18px;padding:14px;border-left:4px solid ${couleur};background:${teinteClaire(couleur, 0.06)};border-radius:8px">${contenuInterieur}</div>`;
  }

  const topNiveau = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const html = topNiveau.map(b => rendreBlocApercu(b)).join('');

  // La discipline est mise en avant (au-dessus du titre), comme dans l'arborescence.
  const enTeteTitre = seance.discipline
    ? `<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#FFCC00;background:#003366;display:inline-block;padding:4px 12px;border-radius:6px;margin-bottom:8px">${echapper(seance.discipline)}</div>
       <h1 style="color:#003366;margin:0 0 20px">${echapper(seance.titre)}</h1>`
    : `<h1 style="color:#003366;margin:0 0 20px">${echapper(seance.titre)}</h1>`;

  fenetre.document.write(`
    <html><head><meta charset="UTF-8"><title>Aperçu — ${echapper(seance.titre)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet">
    <style>body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:30px auto;padding:0 20px;color:#1E293B}</style>
    </head><body>${enTeteTitre}${html}</body></html>`);
  fenetre.document.close();
}

init();
