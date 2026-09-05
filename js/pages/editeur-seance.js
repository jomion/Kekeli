// Page pages/editeur-seance.html
// Éditeur à blocs pour une séance (cahier des charges §6)

const idSeance = new URLSearchParams(window.location.search).get('id');
let seance = null;
let chaineNavigation = null; // { sa, noeud, classe_id, champ_id, classeNom, champNom }
let blocs = [];
// Compétences du référentiel disponibles pour la classe/matière de cette
// séance (Phase 2 — Accompagnement pédagogique personnalisé, Premium) — lu
// par html_selectCompetencesBloc() dans js/editeur/blocs.js. Chaque bloc
// exercice/quiz/évaluation/activité porte sa propre sélection dans
// bloc.competencesIds (posée par chargerBlocs(), jamais dans bloc.contenu :
// la source de vérité reste la table de liaison blocs_competences).
let COMPETENCES_DISPONIBLES_EDITEUR = [];
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

  await initEnteteNavigation({
    role: 'admin', utilisateurId: profilAdmin.id,
    badgeHtml: `${profilAdmin.est_super_admin ? '👑 Super admin' : '🛠️ Admin'} : ${echapper(profilAdmin.prenom)}`,
    liens: liensAvecPrefixe('admin', 'admin/', { superAdmin: profilAdmin.est_super_admin }),
    avecCloche: false
  });

  if (!idSeance) { contenu.innerHTML = '<p class="message-erreur">Aucune séance spécifiée.</p>'; return; }

  await chargerSeanceEtContexte();
  if (!seance) { contenu.innerHTML = '<p class="message-erreur">Séance introuvable ou accès refusé.</p>'; return; }

  // Le retour "Navigation" ramène directement au parent immédiat (la SA),
  // pas à la racine — on ne peut construire ce lien qu'une fois le contexte chargé.
  const urlRetourSA = urlNavigationVersSA();
  const zoneLiensEntete = document.querySelector('.entete-kekeli-liens');
  if (zoneLiensEntete) zoneLiensEntete.insertAdjacentHTML('afterbegin', `<a href="${urlRetourSA}">← Retour à la SA</a>`);

  peutEditer = await appelerPermission('peut_editer_perimetre');
  peutValider = await appelerPermission('peut_valider_perimetre');

  if (!peutEditer) {
    contenu.innerHTML = '<p class="message-erreur">Vous n\'avez pas les droits d\'édition sur ce contenu (classe/champ hors de votre périmètre).</p>';
    return;
  }

  await chargerBlocs();
  await rendreFilAriane();
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
function urlNavigationVersNoeud(noeudId) {
  return `${urlNavigationVersChamp()}&noeudId=${noeudId}`;
}
function urlNavigationVersSA() {
  return `${urlNavigationVersChamp()}&saId=${chaineNavigation.sa.id}`;
}

// Chemin COMPLET et cliquable : Classe › Champ de formation › chaque noeud
// intermédiaire (Thème/Unité/Semaine/Dossier...) › SA › Séance. Avant, le fil
// d'ariane sautait directement du champ à la SA sans les noeuds intermédiaires
// (contrairement à ouvrirApercu(), qui remonte déjà toute la chaîne — même
// logique reprise ici, mais avec des liens cliquables réels).
async function rendreFilAriane() {
  const segments = [
    { label: chaineNavigation.classeNom, url: urlNavigationVersClasse(), titre: 'Retour à cette classe' },
    { label: chaineNavigation.champNom, url: urlNavigationVersChamp(), titre: 'Retour à ce champ de formation' }
  ];

  let n = chaineNavigation.noeud;
  let garde = 0;
  const noeudsAncetres = [];
  while (n && garde++ < 20) {
    noeudsAncetres.unshift(n);
    if (!n.parent_id) break;
    const { data: parent } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, titre').eq('id', n.parent_id).single();
    n = parent;
  }
  noeudsAncetres.forEach(noeud => {
    segments.push({ label: noeud.titre, url: urlNavigationVersNoeud(noeud.id), titre: 'Retour à ce niveau' });
  });

  segments.push({ label: chaineNavigation.sa.titre, url: urlNavigationVersSA(), titre: "Retour à cette Situation d'Apprentissage" });

  filAriane.innerHTML = segments.map(s =>
    `<span class="segment" data-retour="${s.url}" title="${echapper(s.titre)}">${echapper(s.label)}</span><span class="sep">›</span>`
  ).join('') + `<span class="segment actif">${echapper(seance.titre)}</span>`;

  filAriane.querySelectorAll('[data-retour]').forEach(el => {
    el.addEventListener('click', () => { window.location.href = el.dataset.retour; });
  });
}

async function chargerBlocs() {
  const { data, error } = await supabaseClient.from('blocs_seance').select('*').eq('seance_id', idSeance).order('ordre');
  if (error) { console.error(error); return; }
  blocs = data;

  // Compétences déjà rattachées à chaque bloc (table de liaison, jamais dans
  // bloc.contenu — voir html_selectCompetencesBloc dans js/editeur/blocs.js).
  const idsBlocs = blocs.map(b => b.id);
  if (idsBlocs.length) {
    const { data: liens } = await supabaseClient.from('blocs_competences').select('bloc_id, competence_id').in('bloc_id', idsBlocs);
    const idsParBloc = {};
    (liens || []).forEach(l => { (idsParBloc[l.bloc_id] ??= []).push(l.competence_id); });
    blocs.forEach(b => { b.competencesIds = idsParBloc[b.id] || []; });
  }

  await chargerCompetencesDisponiblesEditeur();
}

// Compétences actives du référentiel pour la classe/matière de cette séance
// (transversales incluses, classe_id null) — proposées dans le sélecteur de
// chaque bloc exercice/quiz/évaluation/activité.
async function chargerCompetencesDisponiblesEditeur() {
  const { data } = await supabaseClient.from('competences').select('id, intitule, domaine, ordre')
    .eq('champ_formation_id', chaineNavigation.champ_id).eq('actif', true)
    .or(`classe_id.eq.${chaineNavigation.classe_id},classe_id.is.null`)
    .order('domaine').order('ordre');
  COMPETENCES_DISPONIBLES_EDITEUR = data || [];
}

// --- RENDU GÉNÉRAL -------------------------------------------------------

function rendre() {
  const pillsStatut = { brouillon: 'Brouillon', publie: 'Publié', archive: 'Archivé' };

  contenu.innerHTML = `
    <div class="barre-editeur">
      <div>
        <input type="text" id="inputTitreSeance" value="${echapper(seance.titre)}" placeholder="Titre de la séance"
          title="Titre de la séance — sert de repère unique dans toutes les listes et pour l'IA (ex: « Séance 1 — Les fractions »)."
          style="border:none;border-bottom:1px solid transparent;background:transparent;font-size:20px;font-weight:700;color:var(--bleu-principal);padding:2px 0;margin:0 0 4px;width:100%;max-width:520px"
          onfocus="this.style.borderBottomColor='var(--bordure)'" onblur="this.style.borderBottomColor='transparent'">
        <br>
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
        <button class="btn btn-discret" onclick="ouvrirGenerationResume()">🗒️ Résumé IA</button>
        <button class="btn btn-discret" id="btnGenererSeanceIA" onclick="ouvrirGenerationSeanceIA()">🧠 Générer avec l'IA</button>
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
  document.getElementById('inputTitreSeance').addEventListener('change', async (e) => {
    const nouveauTitre = e.target.value.trim();
    if (!nouveauTitre) { e.target.value = seance.titre; return; } // titre obligatoire, on annule un vidage accidentel
    seance.titre = nouveauTitre;
    await supabaseClient.from('seances').update({ titre: seance.titre }).eq('id', seance.id);
    await rendreFilAriane(); // le dernier segment (nom de la séance) doit refléter le nouveau titre
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
  // Le bloc "Contenu" (valeur interne 'titre') est masqué à l'élève par
  // défaut (son propre nom n'a pas de sens à afficher, seuls les blocs
  // qu'il contient comptent) — les autres types restent visibles par
  // défaut comme avant. Reste modifiable au cas par cas via la case
  // "Titre visible" ci-dessous.
  const afficherTitreParDefaut = b.type_bloc !== 'titre';
  const afficherTitre = typeof (b.contenu && b.contenu.afficherTitre) === 'boolean' ? b.contenu.afficherTitre : afficherTitreParDefaut;
  const libelle = (b.contenu && b.contenu.libelle) || info.label;

  const swatchesBloc = PALETTE_COULEURS.map(col =>
    `<button type="button" class="pastille-couleur" data-choisir-couleur-bloc="${col.valeur}" title="${col.nom}" style="background:${col.valeur}"></button>`
  ).join('');

  const champIa = champIA(b.type_bloc);
  const texteExistantIa = champIa && b.contenu && (b.contenu[champIa] || '').toString().replace(/<[^>]*>/g, '').trim();
  const estResume = b.type_bloc === 'resume';
  // Le statut brouillon/publié (déjà utilisé pour le Résumé IA) s'applique
  // aussi aux blocs d'exercice/quiz/évaluation/activité : leurs questions
  // peuvent désormais être générées par l'IA (voir "🧠 Générer des questions
  // (IA)", js/editeur/blocs.js) et doivent rester masquées aux élèves tant
  // que l'admin ne les a pas relues et explicitement publiées.
  const estExerciceType = ['exercice', 'quiz', 'evaluation', 'activite'].includes(b.type_bloc);
  const estBrouillonable = estResume || estExerciceType;
  const resumeBrouillon = estBrouillonable && b.statut_bloc !== 'publie';
  // Verrou IA : exclut ce bloc de la génération groupée "🧠 Générer avec
  // l'IA" (voir ouvrirGenerationSeanceIA). N'a de sens que pour les blocs de
  // contenu (pas les sections Contenu/Consigne, qui n'y sont de toute façon
  // jamais proposées). Simple clé dans contenu JSON, comme couleurBloc/libelle.
  const estSectionType = TYPES_SECTIONS.includes(b.type_bloc);
  const verrouilleIA = !!(b.contenu && b.contenu.verrouilleIA);

  return `
    <div class="bloc" draggable="true" data-bloc-id="${b.id}" style="border-left-color:${couleur};background:${teinteClaire(couleur)}">
      <div class="bloc-entete">
        <span class="bloc-type" style="color:${couleur}">
          <span class="badge-type-bloc" style="background:${couleur};color:${texteContrastant(couleur)}" title="Type de bloc : ${echapper(info.label)}">${info.icone} ${echapper(info.label)}</span>
          <input type="text" class="libelle-bloc-editable" data-libelle-bloc value="${echapper(libelle)}" style="color:${couleur}" title="Nom personnalisé affiché (repère interne : ${echapper(info.label)})">
        </span>
        <div class="bloc-actions">
          ${estBrouillonable ? `
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;${resumeBrouillon ? 'background:#FEF3C7;color:#92620A' : 'background:#DCFCE7;color:#15803D'}" title="${resumeBrouillon ? 'Non visible des élèves tant que non publié' : 'Visible des élèves'}">${resumeBrouillon ? '🔸 Brouillon' : '✅ Publié'}</span>
          <button type="button" data-toggle-statut-resume title="${resumeBrouillon ? 'Publier (le rendre visible des élèves)' : 'Repasser en brouillon (le masquer aux élèves)'}">${resumeBrouillon ? '📤 Publier' : '↩️ Dépublier'}</button>` : ''}
          <label title="Afficher ce nom dans l'aperçu élève" style="display:flex;align-items:center;gap:3px;font-size:11px;font-weight:400;color:var(--texte-gris)">
            <input type="checkbox" data-toggle-titre-bloc ${afficherTitre ? 'checked' : ''}> Titre visible
          </label>
          ${champIa ? `
          ${!estSectionType ? `<button type="button" title="${verrouilleIA ? "Déverrouiller pour la génération IA groupée (🧠 Générer avec l'IA)" : 'Verrouiller pour la génération IA groupée (contenu protégé)'}" data-toggle-verrou-ia>${verrouilleIA ? '🔒' : '🔓'}</button>` : ''}
          <button type="button" title="Générer un brouillon avec l'IA" data-action-ia="generer">✨</button>
          ${texteExistantIa ? `<button type="button" title="Améliorer ce texte avec l'IA" data-action-ia="ameliorer">🪄</button>` : ''}` : ''}
          <div class="menu-couleur-bloc">
            <button type="button" title="Couleur du bloc" data-ouvrir-couleur-bloc>🎨</button>
            <div class="palette-bloc" data-palette-bloc>${swatchesBloc}</div>
          </div>
          <button title="Déplacer vers une autre section" data-action-bloc="deplacer">📦</button>
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
      // Sans palier, un exercice redevient un simple bloc de contenu : le
      // seuil de réussite (qui ne sert qu'à la progression par palier / aux
      // badges) n'a plus de sens à configurer, donc on le masque aussitôt.
      const blocSeuil = el.querySelector(':scope > .bloc-corps [data-bloc-seuil]');
      if (blocSeuil) blocSeuil.style.display = bloc.palier ? 'block' : 'none';
      programmerSauvegardeBloc(bloc);
    });
  }

  // Compétences travaillées (Phase 2 "Accompagnement personnalisé", Premium)
  // — persistées directement dans blocs_competences (table de liaison), pas
  // dans bloc.contenu : chaque coche/décoche déclenche un insert/delete
  // immédiat, sans passer par programmerSauvegardeBloc (pas de debounce ici,
  // il n'y a rien à taper — une seule action = une seule écriture).
  el.querySelectorAll(':scope > .bloc-corps [data-competence-bloc]').forEach(caseCompetence => {
    caseCompetence.addEventListener('change', async () => {
      const competenceId = parseInt(caseCompetence.dataset.competenceBloc, 10);
      bloc.competencesIds = Array.isArray(bloc.competencesIds) ? bloc.competencesIds : [];
      if (caseCompetence.checked) {
        if (!bloc.competencesIds.includes(competenceId)) {
          const { error } = await supabaseClient.from('blocs_competences').insert({ bloc_id: bloc.id, competence_id: competenceId });
          if (error) { caseCompetence.checked = false; alert(error.message); return; }
          bloc.competencesIds.push(competenceId);
        }
      } else {
        const { error } = await supabaseClient.from('blocs_competences').delete().eq('bloc_id', bloc.id).eq('competence_id', competenceId);
        if (error) { caseCompetence.checked = true; alert(error.message); return; }
        bloc.competencesIds = bloc.competencesIds.filter(id => id !== competenceId);
      }
    });
  });

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

  // Brouillon ↔ publié (Résumé IA, et maintenant aussi les blocs d'exercice/
  // quiz/évaluation/activité dont les questions ont été générées par IA) :
  // indépendant du statut de la séance elle-même (voir gererChangementStatut,
  // qui ne touche jamais les blocs).
  const boutonToggleResume = el.querySelector(':scope > .bloc-entete [data-toggle-statut-resume]');
  if (boutonToggleResume) boutonToggleResume.addEventListener('click', async () => {
    const nouveauStatut = bloc.statut_bloc === 'publie' ? 'brouillon' : 'publie';
    const { error } = await supabaseClient.from('blocs_seance').update({ statut_bloc: nouveauStatut }).eq('id', bloc.id);
    if (error) return alert(error.message);
    bloc.statut_bloc = nouveauStatut;
    rendreListeBlocs();
  });

  // Assistant IA (générer un brouillon / améliorer le texte existant)
  const boutonGenererIA = el.querySelector(':scope > .bloc-entete [data-action-ia="generer"]');
  if (boutonGenererIA) boutonGenererIA.addEventListener('click', () => ouvrirGenerationIA(bloc));
  const boutonAmeliorerIA = el.querySelector(':scope > .bloc-entete [data-action-ia="ameliorer"]');
  if (boutonAmeliorerIA) boutonAmeliorerIA.addEventListener('click', () => ameliorerBlocAvecIA(bloc, boutonAmeliorerIA));

  // Verrou IA (exclusion de la génération groupée "🧠 Générer avec l'IA")
  const boutonVerrouIA = el.querySelector(':scope > .bloc-entete [data-toggle-verrou-ia]');
  if (boutonVerrouIA) boutonVerrouIA.addEventListener('click', () => {
    const verrouille = !!(bloc.contenu && bloc.contenu.verrouilleIA);
    bloc.contenu = { ...bloc.contenu, verrouilleIA: !verrouille };
    programmerSauvegardeBloc(bloc);
    rendreListeBlocs();
  });

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
      if (btn.dataset.actionBloc === 'deplacer') ouvrirDeplacerBloc(bloc);
    });
  });
}

// Une section "Contenu" (valeur interne 'titre') ne doit contenir que des
// blocs d'édition de contenu pédagogique — jamais un bloc évalué/noté
// (exercice, quiz, évaluation, activité) ni les blocs propres aux consignes
// à items (consigne, item), qui gardent leur propre logique de correction
// indépendante. La section "Consigne" (l'autre section existante) n'est pas
// concernée par cette restriction : elle continue d'accepter tout type.
const TYPES_INTERDITS_DANS_CONTENU = ['exercice', 'quiz', 'evaluation', 'activite', 'consigne', 'item'];

function typesAutorisesPourParent(parentBlocId) {
  if (!parentBlocId) return TYPES_BLOCS;
  const parent = blocs.find(b => b.id === parentBlocId);
  if (parent && parent.type_bloc === 'titre') {
    return TYPES_BLOCS.filter(t => !TYPES_INTERDITS_DANS_CONTENU.includes(t.valeur));
  }
  return TYPES_BLOCS;
}

function ouvrirAjoutBlocDansSection(parentBlocId) {
  ouvrirModal({
    titre: 'Ajouter un bloc dans cette section',
    champs: [{
      nom: 'type', label: 'Type de bloc', type: 'select',
      options: typesAutorisesPourParent(parentBlocId).map(t => ({ valeur: t.valeur, label: `${t.icone} ${t.label}` }))
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

  // Seuil de réussite (%) : champ hors du conteneur des questions (juste au-dessus),
  // mais géré ici pour rester à côté de la sauvegarde du reste du bloc.
  const inputSeuil = el.querySelector(':scope > .bloc-corps [data-champ-seuil-reussite]');
  if (inputSeuil) inputSeuil.addEventListener('input', () => {
    const v = parseFloat(inputSeuil.value);
    bloc.seuil_reussite = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 66.7;
    programmerSauvegardeBloc(bloc);
  });

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
        if ((q.type === 'qcm' || q.type === 'qcm_multiple' || q.type === 'remise_en_ordre') && !Array.isArray(q.options)) q.options = ['', ''];
        if (q.type === 'association' && !Array.isArray(q.paires)) {
          q.paires = [{ gauche: '', droite: '' }, { gauche: '', droite: '' }];
          recalculerAssociation(q, c);
        }
        if (q.type === 'classement' && !Array.isArray(q.categories)) {
          q.categories = ['', ''];
          q.items = [{ mot: '', categorieIndex: null }, { mot: '', categorieIndex: null }];
          recalculerClassement(q, c);
        }
        majQuestions(questions());
        if (c) sauvegarderCorrige();
        rerender();
      });

      qEl.querySelector('[data-question-champ="enonce"]').addEventListener('input', (e) => {
        q.enonce = e.target.value;
        majQuestions(questions());
      });
      const inputConsigne = qEl.querySelector('[data-question-champ="consigne"]');
      if (inputConsigne) inputConsigne.addEventListener('input', (e) => {
        q.consigne = e.target.value;
        majQuestions(questions());
      });
      if (q.type === 'texte_a_trous') {
        // Le nombre de champs de correction dépend du nombre de "___" dans
        // l'énoncé : on ne peut pas le recalculer à chaque frappe (ça ferait
        // perdre le focus du champ en cours d'édition), donc on le fait au
        // blur (quand l'enseignant quitte le champ énoncé) plutôt qu'au input.
        qEl.querySelector('[data-question-champ="enonce"]').addEventListener('blur', () => rerender());
      }

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

      if (q.type === 'qcm' || q.type === 'qcm_multiple' || q.type === 'remise_en_ordre') {
        qEl.querySelectorAll('[data-option-index]').forEach(inputOpt => {
          inputOpt.addEventListener('input', () => {
            const i = parseInt(inputOpt.dataset.optionIndex, 10);
            q.options[i] = inputOpt.value;
            majQuestions(questions());
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
            const i = parseInt(btn.dataset.supprimerOption, 10);
            q.options.splice(i, 1);
            majQuestions(questions());
            // Le corrigé QCM/ordre référence les options par index : on retire
            // aussi l'index supprimé (et on décale les index suivants) pour ne
            // pas garder une bonne réponse pointant vers un élément disparu.
            if (c && q.type === 'qcm' && String(c.bonneReponse) === String(i)) c.bonneReponse = undefined;
            if (c && Array.isArray(c.bonneReponse)) {
              c.bonneReponse = c.bonneReponse.filter(x => x !== i).map(x => x > i ? x - 1 : x);
            }
            if (c) sauvegarderCorrige();
            rerender();
          });
        });
      }

      if (q.type === 'qcm') {
        qEl.querySelectorAll('[data-question-bonne-index]').forEach(radio => {
          radio.addEventListener('change', () => {
            if (!c) return;
            c.bonneReponse = radio.dataset.questionBonneIndex;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'qcm_multiple') {
        qEl.querySelectorAll('[data-question-bonne-multi-index]').forEach(checkbox => {
          checkbox.addEventListener('change', () => {
            if (!c) return;
            const i = parseInt(checkbox.dataset.questionBonneMultiIndex, 10);
            const actuel = Array.isArray(c.bonneReponse) ? c.bonneReponse.filter(x => x !== i) : [];
            if (checkbox.checked) actuel.push(i);
            c.bonneReponse = actuel;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'remise_en_ordre') {
        qEl.querySelectorAll('[data-question-rang-index]').forEach(input => {
          input.addEventListener('input', () => {
            if (!c) return;
            const i = parseInt(input.dataset.questionRangIndex, 10);
            const rang = parseInt(input.value, 10);
            const ordreActuel = Array.isArray(c.bonneReponse) ? c.bonneReponse.filter(x => x !== i) : [];
            const position = Math.max(0, Math.min(ordreActuel.length, (rang || 1) - 1));
            ordreActuel.splice(position, 0, i);
            c.bonneReponse = ordreActuel;
            sauvegarderCorrige();
          });
        });
      }

      if (q.type === 'texte_a_trous') {
        qEl.querySelectorAll('[data-question-trou-index]').forEach(input => {
          input.addEventListener('input', () => {
            if (!c) return;
            const i = parseInt(input.dataset.questionTrouIndex, 10);
            c.bonneReponse = Array.isArray(c.bonneReponse) ? [...c.bonneReponse] : [];
            c.bonneReponse[i] = input.value.split(',').map(s => s.trim()).filter(Boolean);
            sauvegarderCorrige();
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

      if (q.type === 'association') {
        const rafraichirAssociation = () => {
          recalculerAssociation(q, c);
          majQuestions(questions());
          if (c) sauvegarderCorrige();
        };
        qEl.querySelectorAll('[data-association-gauche-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.associationGaucheIndex, 10);
            q.paires = Array.isArray(q.paires) ? [...q.paires] : [];
            q.paires[i] = { ...(q.paires[i] || {}), gauche: input.value };
            rafraichirAssociation();
          });
        });
        qEl.querySelectorAll('[data-association-droite-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.associationDroiteIndex, 10);
            q.paires = Array.isArray(q.paires) ? [...q.paires] : [];
            q.paires[i] = { ...(q.paires[i] || {}), droite: input.value };
            rafraichirAssociation();
          });
        });
        const btnAjouterPaire = qEl.querySelector('[data-ajouter-paire]');
        if (btnAjouterPaire) btnAjouterPaire.addEventListener('click', () => {
          q.paires = [...(q.paires || []), { gauche: '', droite: '' }];
          rafraichirAssociation();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-paire]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerPaire, 10);
            q.paires.splice(i, 1);
            rafraichirAssociation();
            rerender();
          });
        });
      }

      if (q.type === 'classement') {
        const rafraichirClassement = () => {
          recalculerClassement(q, c);
          majQuestions(questions());
          if (c) sauvegarderCorrige();
        };
        qEl.querySelectorAll('[data-categorie-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.categorieIndex, 10);
            q.categories = Array.isArray(q.categories) ? [...q.categories] : [];
            q.categories[i] = input.value;
            rafraichirClassement();
          });
        });
        const btnAjouterCategorie = qEl.querySelector('[data-ajouter-categorie]');
        if (btnAjouterCategorie) btnAjouterCategorie.addEventListener('click', () => {
          q.categories = [...(q.categories || []), ''];
          rafraichirClassement();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-categorie]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerCategorie, 10);
            q.categories.splice(i, 1);
            // Un mot affecté à la catégorie supprimée (ou à une catégorie
            // suivante) doit voir son index recalculé, sinon il pointerait
            // vers la mauvaise colonne ou une colonne disparue.
            (q.items || []).forEach(it => {
              if (it.categorieIndex === i) it.categorieIndex = null;
              else if (typeof it.categorieIndex === 'number' && it.categorieIndex > i) it.categorieIndex -= 1;
            });
            rafraichirClassement();
            rerender();
          });
        });
        qEl.querySelectorAll('[data-item-classement-index]').forEach(input => {
          input.addEventListener('input', () => {
            const i = parseInt(input.dataset.itemClassementIndex, 10);
            q.items = Array.isArray(q.items) ? [...q.items] : [];
            q.items[i] = { ...(q.items[i] || {}), mot: input.value };
            rafraichirClassement();
          });
        });
        qEl.querySelectorAll('[data-item-categorie-index]').forEach(select => {
          select.addEventListener('change', () => {
            const i = parseInt(select.dataset.itemCategorieIndex, 10);
            q.items = Array.isArray(q.items) ? [...q.items] : [];
            q.items[i] = { ...(q.items[i] || {}), categorieIndex: select.value === '' ? null : parseInt(select.value, 10) };
            rafraichirClassement();
          });
        });
        const btnAjouterItem = qEl.querySelector('[data-ajouter-item-classement]');
        if (btnAjouterItem) btnAjouterItem.addEventListener('click', () => {
          q.items = [...(q.items || []), { mot: '', categorieIndex: null }];
          rafraichirClassement();
          rerender();
        });
        qEl.querySelectorAll('[data-supprimer-item-classement]').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.supprimerItemClassement, 10);
            q.items.splice(i, 1);
            rafraichirClassement();
            rerender();
          });
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

  const btnGenererActiviteIA = conteneur.querySelector('[data-generer-activite-ia]');
  if (btnGenererActiviteIA) btnGenererActiviteIA.addEventListener('click', () => ouvrirGenerationActiviteIA(bloc));

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

// --- GÉNÉRATION IA D'ACTIVITÉS (questions + corrigé) -----------------------
// Bouton "🧠 Générer des questions (IA)" de l'éditeur d'exercice/quiz/
// évaluation/activité (voir html_editeurExercice, js/editeur/blocs.js).
// Décisions prises avec l'administrateur avant l'implémentation :
// - l'IA génère les questions ET leur corrigé (jamais envoyé à l'élève,
//   comme pour toute question saisie à la main — table corriges_exercices) ;
// - tous les types de question automatisables (qcm, qcm_multiple, vrai_faux,
//   reponse_courte, texte_a_trous, remise_en_ordre, association, classement)
//   sont autorisés, JAMAIS reponse_longue (correction ouverte, hors périmètre) ;
// - l'admin choisit le palier AVANT de générer (bloc.palier, déjà présent
//   dans l'éditeur) : l'IA adapte la difficulté à ce seul palier ;
// - la génération tient compte du contenu déjà présent dans la séance
//   (texteContextePourActiviteIA), pour rester cohérente avec le cours.
// Comme le Résumé IA, le résultat reste en BROUILLON (bloc.statut_bloc)
// jusqu'à relecture et publication explicite par l'admin — voir htmlBloc/
// attacherEcouteursBloc, dont l'affichage brouillon/publié est maintenant
// commun au résumé ET aux blocs d'exercice.

// Contenu texte des AUTRES blocs de la séance courante (jamais le bloc
// qu'on est en train de générer, jamais un corrigé) — sert de contexte à
// l'IA pour qu'elle propose des questions cohérentes avec ce qui a été
// enseigné dans cette séance précise. Réutilise texteBlocPourResume (voir
// plus haut, section Résumé IA).
function texteContextePourActiviteIA(blocCible) {
  const parNiveau = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  function texteListe(liste) {
    return liste.map(b => {
      if (b.id === blocCible.id) return '';
      const texte = texteBlocPourResume(b);
      const enfants = blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
      return [texte, enfants.length ? texteListe(enfants) : ''].filter(Boolean).join('\n');
    }).filter(Boolean).join('\n');
  }
  return texteListe(parNiveau);
}

// Le palier n'est plus vérifié EN AMONT (bouton désactivé tant qu'aucun
// palier n'était choisi sur le bloc) : il est désormais demandé À CHAQUE
// génération, dans la fenêtre elle-même — l'admin doit explicitement
// confirmer (ou changer) le palier juste avant de lancer l'IA, ce qui force
// l'IA à toujours recevoir un palier à jour, y compris pour une toute
// première génération sur un bloc qui n'en avait pas encore. Le palier
// choisi ici est aussi répercuté sur le bloc (même effet que le sélecteur
// de palier de l'éditeur), pour rester cohérent avec le seuil de réussite,
// la progression et les badges.
const PALIERS_MODAL_IA = [
  { valeur: 'azovi', label: '🌱 Azɔ̀ví (très facile)' },
  { valeur: 'devi', label: '🪘 Dèví (moyen)' },
  { valeur: 'ogan', label: '🦁 Ògán (difficile)' },
  { valeur: 'axosu', label: '👑 Axɔ́sú (très difficile)' }
];

function ouvrirGenerationActiviteIA(bloc) {
  ouvrirModal({
    titre: "🧠 Générer des questions avec l'IA",
    champs: [
      {
        nom: 'palier', label: 'Palier de difficulté (obligatoire — l\'IA doit savoir pour quel niveau proposer les activités)',
        type: 'select', valeur: bloc.palier || '',
        options: [{ valeur: '', label: '— Choisis un palier —' }, ...PALIERS_MODAL_IA]
      },
      { nom: 'nombre', label: 'Nombre de questions à générer', type: 'number', valeur: 5, placeholder: '5' },
      {
        nom: 'instructions', requis: false, type: 'textarea',
        label: "Consignes pour l'IA (facultatif) — ex : privilégie les QCM, insiste sur le vocabulaire de la séance...",
        placeholder: 'Laisser vide pour une sélection libre des types de questions'
      }
    ],
    texteValider: 'Générer',
    onValider: async ({ palier, nombre, instructions }) => {
      if (!palier) { alert("Choisis un palier avant de générer."); return; }
      const n = Math.max(1, Math.min(12, parseInt(nombre, 10) || 5));
      if (palier !== bloc.palier) {
        bloc.palier = palier;
        await supabaseClient.from('blocs_seance').update({ palier }).eq('id', bloc.id);
        rendreListeBlocs();
      }
      lancerGenerationActiviteIA(bloc, n, (instructions || '').trim());
    }
  });
}

// Convertit UNE question reçue de l'IA (forme "auteur", proche de ce que
// saisirait un admin dans l'éditeur — voir le prompt côté serveur) en
// {question, corrigeEntree} exploitables par le reste de l'éditeur. Rejette
// (renvoie question:null) toute question dont la forme ne correspond pas
// exactement à ce qui est attendu, plutôt que d'enregistrer un contenu
// à moitié valide qui casserait le rendu élève.
function construireQuestionDepuisIA(qBrute, id) {
  const type = qBrute && typeof qBrute.type === 'string' ? qBrute.type : '';
  const enonce = (qBrute && typeof qBrute.enonce === 'string' ? qBrute.enonce : '').trim();
  if (!enonce) return { question: null };
  // La consigne par question, optionnelle, est désormais générée par l'IA
  // (surtout aux paliers 1-2, voir edge function assistant-ia) — avant, ce
  // champ était toujours écrasé par '' ici, donc jamais transmis à l'élève
  // même quand l'IA en proposait une. On la garde si l'IA en a fourni une.
  const consigneIA = (qBrute && typeof qBrute.consigne === 'string' ? qBrute.consigne : '').trim().slice(0, 300);
  const base = { id, type, enonce, consigne: consigneIA };
  const corrigeEntree = { points: 1 };

  if (type === 'qcm') {
    const options = Array.isArray(qBrute.options) ? qBrute.options.map(String).filter(Boolean) : [];
    const idx = Number.isInteger(qBrute.bonneReponseIndex) ? qBrute.bonneReponseIndex : -1;
    if (options.length < 2 || idx < 0 || idx >= options.length) return { question: null };
    corrigeEntree.bonneReponse = String(idx);
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'qcm_multiple') {
    const options = Array.isArray(qBrute.options) ? qBrute.options.map(String).filter(Boolean) : [];
    const idxs = Array.isArray(qBrute.bonnesReponsesIndex) ? qBrute.bonnesReponsesIndex.filter(i => Number.isInteger(i) && i >= 0 && i < options.length) : [];
    if (options.length < 2 || !idxs.length) return { question: null };
    corrigeEntree.bonneReponse = idxs.map(String);
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'vrai_faux') {
    if (typeof qBrute.bonneReponse !== 'boolean') return { question: null };
    corrigeEntree.bonneReponse = qBrute.bonneReponse;
    return { question: base, corrigeEntree };
  }
  if (type === 'reponse_courte') {
    const reponses = Array.isArray(qBrute.reponsesAcceptees) ? qBrute.reponsesAcceptees.map(String).filter(Boolean) : [];
    if (!reponses.length) return { question: null };
    corrigeEntree.bonneReponse = reponses;
    return { question: base, corrigeEntree };
  }
  if (type === 'texte_a_trous') {
    const nbTrous = (enonce.match(/___/g) || []).length;
    const reponsesParTrou = Array.isArray(qBrute.reponsesParTrou)
      ? qBrute.reponsesParTrou.map(r => (Array.isArray(r) ? r.map(String).filter(Boolean) : [String(r)].filter(Boolean)))
      : [];
    if (!nbTrous || reponsesParTrou.length !== nbTrous || reponsesParTrou.some(r => !r.length)) return { question: null };
    corrigeEntree.bonneReponse = reponsesParTrou;
    return { question: base, corrigeEntree };
  }
  if (type === 'remise_en_ordre') {
    const elements = Array.isArray(qBrute.elementsEnOrdre) ? qBrute.elementsEnOrdre.map(String).filter(Boolean) : [];
    if (elements.length < 2 || new Set(elements).size !== elements.length) return { question: null }; // doublons -> corrigé non fiable
    // Mélange pour l'affichage (jamais dans l'ordre correct par défaut,
    // sinon l'exercice serait déjà résolu), puis calcule le corrigé (index,
    // dans ce mélange, de chaque élément dans l'ordre attendu).
    const options = [...elements];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const bonneReponse = elements.map(texte => options.indexOf(texte));
    corrigeEntree.bonneReponse = bonneReponse;
    return { question: { ...base, options }, corrigeEntree };
  }
  if (type === 'association') {
    const paires = Array.isArray(qBrute.paires)
      ? qBrute.paires.map(p => ({ gauche: String((p && p.gauche) || ''), droite: String((p && p.droite) || '') })).filter(p => p.gauche && p.droite)
      : [];
    if (paires.length < 2) return { question: null };
    const q = { ...base, paires };
    recalculerAssociation(q, corrigeEntree); // dérive q.gauche/q.droite + corrigeEntree.bonneReponse (js/editeur/blocs.js)
    return { question: q, corrigeEntree };
  }
  if (type === 'classement') {
    const categories = Array.isArray(qBrute.categories) ? qBrute.categories.map(String).filter(Boolean) : [];
    const items = Array.isArray(qBrute.items)
      ? qBrute.items
          .map(it => ({ mot: String((it && it.mot) || ''), categorieIndex: Number.isInteger(it && it.categorieIndex) ? it.categorieIndex : null }))
          .filter(it => it.mot && it.categorieIndex !== null && it.categorieIndex >= 0 && it.categorieIndex < categories.length)
      : [];
    if (categories.length < 2 || items.length < 2) return { question: null };
    const q = { ...base, categories, items };
    recalculerClassement(q, corrigeEntree); // dérive q.motsAClasser/q.categories + corrigeEntree.bonneReponse
    return { question: q, corrigeEntree };
  }
  return { question: null };
}

async function lancerGenerationActiviteIA(bloc, nombre, instructions) {
  const btn = document.querySelector(`.bloc[data-bloc-id="${bloc.id}"] [data-generer-activite-ia]`);
  const texteBoutonOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération en cours...'; }
  try {
    const contexteSeance = texteContextePourActiviteIA(bloc);
    // Questions déjà présentes dans CE bloc (générées avant, à un palier
    // éventuellement différent, ou saisies à la main) : transmises comme
    // liste à ne pas reproduire, pour que régénérer (y compris à un autre
    // palier) ne redonne pas des questions déjà posées — voir le prompt
    // côté serveur (edge function assistant-ia, action genererActivite).
    const questionsExistantes = Array.isArray(bloc.contenu && bloc.contenu.questions) ? bloc.contenu.questions : [];
    const enoncesExistants = questionsExistantes.map(q => (q && q.enonce) || '').filter(Boolean);
    // Réponse en forme { questions, fournisseur } (pas { texte }) : on passe
    // par appelerAssistantIABlocs, comme la génération groupée "genererSeance"
    // (voir invoquerAssistantIA plus bas dans ce fichier).
    const resultat = await appelerAssistantIABlocs({
      action: 'genererActivite', typeBloc: bloc.type_bloc, palier: bloc.palier,
      consigne: (bloc.contenu && bloc.contenu.consigne) || '', contexteSeance, nombre, instructions,
      questionsExistantes: enoncesExistants,
      classe: chaineNavigation?.classeNom, champ: chaineNavigation?.champNom
    });
    const questionsRecues = Array.isArray(resultat.questions) ? resultat.questions : [];

    const { data: corrigeRow } = await supabaseClient.from('corriges_exercices').select('corrige').eq('bloc_id', bloc.id).maybeSingle();
    const corrige = (corrigeRow && corrigeRow.corrige) || {};
    const nouvellesQuestions = [];

    questionsRecues.forEach((qBrute, i) => {
      const id = 'q_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 7);
      const { question, corrigeEntree } = construireQuestionDepuisIA(qBrute, id);
      if (!question) return;
      nouvellesQuestions.push(question);
      corrige[id] = corrigeEntree;
    });

    if (!nouvellesQuestions.length) {
      alert("L'IA n'a renvoyé aucune question exploitable — réessaie, ou reformule les consignes.");
      return;
    }

    bloc.contenu = { ...bloc.contenu, questions: [...questionsExistantes, ...nouvellesQuestions] };
    bloc.statut_bloc = 'brouillon'; // toujours à relire avant publication, comme le Résumé IA
    await Promise.all([
      supabaseClient.from('blocs_seance').update({ contenu: bloc.contenu, statut_bloc: 'brouillon' }).eq('id', bloc.id),
      supabaseClient.from('corriges_exercices').upsert({ bloc_id: bloc.id, corrige, modifie_le: new Date().toISOString() }, { onConflict: 'bloc_id' })
    ]);
    afficherSauvegarde();
    rendreListeBlocs();
  } catch (e) {
    alert('Erreur IA : ' + e.message);
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = texteBoutonOriginal; }
  }
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
  const elementDeplace = dragEtat.element;
  const conteneurOrigine = dragEtat.conteneurOrigine;
  const parentBlocIdOrigine = dragEtat.parentBlocIdOrigine;

  // Le glisser-déposer contourne ajouterBloc() : on applique la même règle
  // ici (une section "Contenu" n'accepte pas les blocs évalués/notés) avant
  // d'enregistrer quoi que ce soit, sinon la restriction serait facile à
  // contourner en déplaçant un bloc existant plutôt qu'en en créant un nouveau.
  if (parentBlocIdDestination && elementDeplace) {
    const blocDeplace = blocs.find(b => b.id === parseInt(elementDeplace.dataset.blocId, 10));
    const parentDestination = blocs.find(b => b.id === parentBlocIdDestination);
    if (blocDeplace && parentDestination && parentDestination.type_bloc === 'titre' &&
        TYPES_INTERDITS_DANS_CONTENU.includes(blocDeplace.type_bloc)) {
      alert("Ce type de bloc n'est pas autorisé à l'intérieur d'une section « Contenu » (réservée aux blocs de contenu pédagogique).");
      if (conteneurOrigine) conteneurOrigine.appendChild(elementDeplace);
      return;
    }
  }

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
    await supabaseClient.from('blocs_seance').update({ contenu: bloc.contenu, palier: bloc.palier, seuil_reussite: bloc.seuil_reussite }).eq('id', bloc.id);
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

// Fonction bas niveau, partagée par toutes les actions de l'assistant IA :
// appelle l'edge function et renvoie la réponse brute (déjà validée / sans
// erreur). `appelerAssistantIA` (texte) et `appelerAssistantIABlocs` (blocs
// structurés, voir génération groupée plus bas) en sont de fins habillages,
// selon la forme de réponse attendue par l'action appelée.
async function invoquerAssistantIA(payload) {
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
  return data || {};
}

async function appelerAssistantIA(payload) {
  const data = await invoquerAssistantIA(payload);
  return (data.texte || '').trim();
}

// Action "genererSeance" (génération groupée) : la réponse est { blocks, fournisseur }
// et non { texte, fournisseur } — on renvoie l'objet tel quel, sans le réduire à une chaîne.
async function appelerAssistantIABlocs(payload) {
  return invoquerAssistantIA(payload);
}

function texteBrutDepuisHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
}

// L'IA reçoit désormais la consigne d'utiliser directement un petit jeu de
// balises HTML autorisées pour mettre le texte en valeur (gras, souligné,
// couleur, listes — voir la fonction "contexte" de l'edge function
// assistant-ia) plutôt que du Markdown, mais elle en glisse parfois quand
// même (**gras**, puces avec des tirets, titres #), et peut aussi produire
// une balise non prévue malgré la consigne. Ces fonctions nettoient tout ça,
// pour TOUS les blocs (résumé, définition, exemple, consigne, exercice...) :
// - markdownResiduelleVersHtml() convertit la Markdown résiduelle en HTML
//   équivalent, sans toucher aux vraies balises HTML déjà présentes dans le
//   texte (elles sont filtrées ensuite par assainirHtmlIA, pas ré-échappées ici).
// - assainirHtmlIA() retire toute balise qui n'est pas dans la liste
//   autorisée (le texte à l'intérieur est conservé) — filet de sécurité
//   avant d'injecter ce texte via innerHTML dans une page vue par des élèves.
// - markdownVersHtml() produit le HTML final pour les champs "riches"
//   (contenteditable) : du vrai gras/souligné/couleur/listes, plus aucune
//   balise affichée "en code".
// - nettoyerMarkdown() produit du texte simple, débarrassé de toute
//   syntaxe Markdown ET de toute balise HTML, pour les champs classiques
//   (input/textarea, ex. Titre, Consigne, l'énoncé d'un exercice), qui ne
//   savent pas interpréter ces balises et les afficheraient telles quelles.

// TABLE/THEAD/TBODY/TR/TH/TD : ajoutés pour permettre à l'IA de produire de
// vrais tableaux (ex. conjugaison, comparaison) — voir la fonction "contexte"
// de l'edge function assistant-ia, qui autorise maintenant explicitement ces
// balises. Le rendu élève sait déjà les styler (voir .bloc-lecture table
// dans css/style-public.css, utilisé aussi par les blocs "tableau" saisis à
// la main par l'admin).
const BALISES_HTML_AUTORISEES_IA = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'SPAN', 'UL', 'OL', 'LI', 'BR', 'P', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);

function markdownResiduelleVersHtml(texte) {
  return (texte || '')
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1')
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\*)([^*\n]+?)\*(?!\*)/gm, '$1<em>$2</em>')
    .replace(/`{1,3}([^`\n]+?)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s+(.*)$/gm, '<strong>$1</strong>');
}

function assainirHtmlIA(html) {
  const conteneur = document.createElement('div');
  conteneur.innerHTML = html || '';
  const nettoyerNoeud = (noeud) => {
    [...noeud.childNodes].forEach((enfant) => {
      if (enfant.nodeType !== Node.ELEMENT_NODE) return;
      nettoyerNoeud(enfant);
      if (!BALISES_HTML_AUTORISEES_IA.has(enfant.tagName)) {
        while (enfant.firstChild) enfant.parentNode.insertBefore(enfant.firstChild, enfant);
        enfant.parentNode.removeChild(enfant);
        return;
      }
      [...enfant.attributes].forEach((attr) => {
        const styleCouleurValide = enfant.tagName === 'SPAN' && attr.name === 'style'
          && /^\s*color\s*:\s*#?[0-9a-z]{3,8}\s*;?\s*$/i.test(attr.value);
        if (!styleCouleurValide) enfant.removeAttribute(attr.name);
      });
    });
  };
  nettoyerNoeud(conteneur);
  return conteneur.innerHTML;
}

function nettoyerMarkdown(texte) {
  const conteneur = document.createElement('div');
  conteneur.innerHTML = markdownResiduelleVersHtml(texte);
  // Reconvertit d'éventuelles structures de bloc (puces, paragraphes) en
  // texte simple mais toujours lisible (tirets + sauts de ligne) avant de
  // retirer toute balise HTML restante — ces champs (input/textarea) ne
  // savent afficher que du texte brut, mais une liste ne doit pas pour
  // autant se retrouver collée en une seule phrase.
  conteneur.querySelectorAll('li').forEach((li) => { li.textContent = `- ${li.textContent}`; });
  conteneur.querySelectorAll('li, p, br').forEach((el) => { el.insertAdjacentText('afterend', '\n'); });
  return (conteneur.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function markdownVersHtml(texte) {
  const brut = (texte || '').trim();
  if (!brut) return '<p></p>';
  const converti = markdownResiduelleVersHtml(brut);
  // Si le texte contient déjà une vraie structure de blocs HTML (produite par
  // l'IA elle-même, ou par la conversion ci-dessus), on la confie telle
  // quelle au parseur HTML plutôt que de la découper ligne par ligne, ce qui
  // la fragmenterait à tort (ex. un <ul>...</ul> réparti sur plusieurs lignes).
  let html;
  if (/<\/?(ul|ol|li|p|table|thead|tbody|tr|th|td)\b/i.test(converti)) {
    html = converti;
  } else {
    const lignes = converti.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let corps = '';
    let listeOuverte = null; // 'ul' | 'ol' | null
    const fermerListe = () => { if (listeOuverte) { corps += `</${listeOuverte}>`; listeOuverte = null; } };
    for (const ligne of lignes) {
      const puce = ligne.match(/^[-*+]\s+(.*)$/);
      const numero = ligne.match(/^\d+[.)]\s+(.*)$/);
      if (puce) {
        if (listeOuverte !== 'ul') { fermerListe(); corps += '<ul>'; listeOuverte = 'ul'; }
        corps += `<li>${puce[1]}</li>`;
      } else if (numero) {
        if (listeOuverte !== 'ol') { fermerListe(); corps += '<ol>'; listeOuverte = 'ol'; }
        corps += `<li>${numero[1]}</li>`;
      } else {
        fermerListe();
        corps += `<p>${ligne}</p>`;
      }
    }
    fermerListe();
    html = corps;
  }
  return assainirHtmlIA(html) || `<p>${echapper(brut)}</p>`;
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

// --- RÉSUMÉ IA (une ou plusieurs séances, "progressif") ---------------------
// Génère un nouveau bloc de type "resume" à partir du contenu texte des
// blocs de la séance courante, éventuellement complété par celui de séances
// précédentes déjà publiées de la même SA (résumé cumulatif). Le résultat
// est toujours inséré en BROUILLON (bloc.statut_bloc = 'brouillon') : il
// n'est jamais visible des élèves tant que l'admin ne l'a pas relu et
// explicitement publié (bouton "📤 Publier", voir htmlBloc/attacherEcouteursBloc).
// Le corrigé des exercices n'est jamais chargé ici : seuls les blocs eux-mêmes
// (déjà présents en mémoire ou rechargés via blocs_seance) sont utilisés,
// donc aucune bonne réponse ne peut fuiter dans le résumé.

// Extrait le texte "utile" d'un bloc pour la synthèse — ignore les blocs non
// textuels (image/vidéo/ressource) et ne reprend, pour un exercice/quiz/
// évaluation/activité, que la consigne et les énoncés (jamais le corrigé,
// qui vit dans une table séparée et n'est de toute façon pas chargé ici).
function texteBlocPourResume(bloc) {
  const c = bloc.contenu || {};
  if (TYPES_TEXTE_LIBRE.includes(bloc.type_bloc)) return texteBrutDepuisHtml(c.texte);
  if (bloc.type_bloc === 'titre') return c.texte ? `— ${c.texte} —` : '';
  if (bloc.type_bloc === 'consigne' || bloc.type_bloc === 'autre') return [c.nom, c.texte].filter(Boolean).join(' : ');
  if (['exercice', 'quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    return [c.consigne, ...questions.map(q => q.enonce)].filter(Boolean).join('\n');
  }
  if (bloc.type_bloc === 'tableau') return c.titre || '';
  if (bloc.type_bloc === 'formule') return c.formule || '';
  return ''; // image / video / ressource : rien de textuel à résumer
}

// Agrège tous les blocs (racine + enfants de section) d'une séance en un
// seul texte, sous un petit en-tête "### Séance : ...".
function texteSeancePourResume(titreSeance, blocsDeCetteSeance) {
  const parNiveau = blocsDeCetteSeance.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const texteListe = (liste) => liste.map(b => {
    const texte = texteBlocPourResume(b);
    const enfants = blocsDeCetteSeance.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
    return [texte, enfants.length ? texteListe(enfants) : ''].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');
  return `### Séance : ${titreSeance}\n${texteListe(parNiveau)}`;
}

function ouvrirGenerationResume() {
  supabaseClient.from('seances').select('id, titre, ordre')
    .eq('sa_id', chaineNavigation.sa.id).eq('statut', 'publie').lt('ordre', seance.ordre).order('ordre')
    .then(({ data: seancesPrecedentes }) => {
      const liste = seancesPrecedentes || [];
      // Consigne libre et facultative : par défaut le résumé suit une consigne
      // fixe (points clés, phrases courtes, concis) — ce champ permet de la
      // préciser au cas par cas (longueur, ton, ce sur quoi insister...) sans
      // avoir à retoucher le résultat après coup.
      const champInstructions = {
        nom: 'instructions', requis: false, type: 'textarea',
        label: 'Consignes pour l\'IA (facultatif) — ex : insiste sur le vocabulaire, fais très court, présente en puces...',
        placeholder: 'Laisser vide pour un résumé standard'
      };
      ouvrirModal({
        titre: '🗒️ Générer un résumé avec l\'IA',
        champs: liste.length ? [{
          nom: 'seances',
          label: `Un bloc "Résumé" sera ajouté à cette séance (« ${seance.titre} »), en brouillon — à relire avant de le publier. Inclure aussi ces séances précédentes déjà publiées de cette SA, pour un résumé progressif (facultatif) :`,
          type: 'checkboxes', requis: false, options: liste.map(s => ({ valeur: s.id, label: s.titre })), valeur: []
        }, champInstructions] : [champInstructions],
        texteValider: 'Générer',
        onValider: ({ seances: idsChoisis, instructions }) => {
          const idsSelectionnes = (idsChoisis || []).map(v => parseInt(v, 10));
          lancerGenerationResume(idsSelectionnes, liste, (instructions || '').trim());
        }
      });
    });
}

async function lancerGenerationResume(idsAutresSeances, seancesDisponibles, instructionsPersonnalisees) {
  // Le bloc brouillon est créé tout de suite (avec un texte d'attente),
  // pour que l'admin voie immédiatement qu'une génération est en cours —
  // l'appel IA peut prendre plusieurs secondes.
  const fratrie = blocs.filter(b => !b.parent_bloc_id);
  const ordreMax = fratrie.length ? Math.max(...fratrie.map(b => b.ordre)) : -1;
  const { data: nouveauBloc, error: erreurInsertion } = await supabaseClient.from('blocs_seance').insert({
    seance_id: idSeance, type_bloc: 'resume',
    contenu: { texte: '<p><em>⏳ Génération du résumé en cours...</em></p>' },
    ordre: ordreMax + 1, statut_bloc: 'brouillon'
  }).select().single();
  if (erreurInsertion) return alert(erreurInsertion.message);
  blocs.push(nouveauBloc);
  rendreListeBlocs();
  afficherSauvegarde();

  const enregistrerTexteBloc = async (html) => {
    const b = blocs.find(x => x.id === nouveauBloc.id);
    if (!b) return; // supprimé entre-temps par l'admin
    b.contenu = { texte: html };
    await supabaseClient.from('blocs_seance').update({ contenu: b.contenu }).eq('id', nouveauBloc.id);
    rendreListeBlocs();
    afficherSauvegarde();
  };

  try {
    const seancesChoisies = seancesDisponibles.filter(s => idsAutresSeances.includes(s.id)).sort((a, b) => a.ordre - b.ordre);
    let source = '';
    for (const s of seancesChoisies) {
      const { data: blocsAutreSeance } = await supabaseClient.from('blocs_seance').select('*').eq('seance_id', s.id).order('ordre');
      source += texteSeancePourResume(s.titre, blocsAutreSeance || []) + '\n\n';
    }
    source += texteSeancePourResume(seance.titre, blocs.filter(b => b.id !== nouveauBloc.id));

    // Garde-fou de taille (contexte du modèle IA, temps de réponse) : si le
    // résumé porte sur beaucoup de séances, on garde le contenu le plus
    // récent (la séance courante en dernier dans `source`) plutôt que de
    // tronquer arbitrairement le début.
    const LIMITE_CARACTERES = 14000;
    if (source.length > LIMITE_CARACTERES) source = source.slice(source.length - LIMITE_CARACTERES);

    const resultat = await appelerAssistantIA({
      action: 'resumer', contenuSource: source, instructions: instructionsPersonnalisees || '',
      classe: chaineNavigation?.classeNom, champ: chaineNavigation?.champNom
    });
    await enregistrerTexteBloc(markdownVersHtml(resultat));
  } catch (e) {
    await enregistrerTexteBloc(`<p><em>⚠️ Échec de la génération IA : ${echapper(e.message)}. Vous pouvez réessayer (🪄) ou rédiger ce résumé vous-même.</em></p>`);
  }
}

// --- GÉNÉRATION IA GROUPÉE (plusieurs blocs d'un coup) ----------------------
// Bouton "🧠 Générer avec l'IA" de la barre d'outils. Contrairement au ✨
// par bloc (sujet libre, un seul champ) ou au 🗒️ Résumé IA (dédié, inchangé),
// cette fonctionnalité regarde toute la séance : elle envoie à l'IA le
// contenu déjà présent dans les autres blocs (pour cohérence, jamais recopié)
// et une liste FERMÉE de blocs à générer — c'est toujours l'admin qui choisit
// cette liste (via la fenêtre ci-dessous), jamais l'IA. Couvre à elle seule
// les 4 cas d'usage (rien coché = blocs vides seulement ; "Tout sélectionner"
// = toute la séance ; un seul bloc coché = régénération ciblée ; plusieurs
// = régénération groupée) : une seule fenêtre plutôt que 4 boutons séparés.

// Ordre de lecture (racine puis enfants de chaque section, comme à l'écran) —
// réutilisé pour la liste de la fenêtre ET pour construire le contexte envoyé à l'IA.
function blocsEnOrdreLecture(listeBlocs) {
  const parNiveau = listeBlocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const resultat = [];
  const empiler = (liste) => {
    liste.forEach(b => {
      resultat.push(b);
      const enfants = listeBlocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
      if (enfants.length) empiler(enfants);
    });
  };
  empiler(parNiveau);
  return resultat;
}

// Le "rôle" d'un bloc pour l'IA : son libellé personnalisé (ex: "Objectif",
// "Découverte"...) s'il en a un, sinon le nom du type de bloc.
function libelleRoleBloc(bloc) {
  return (bloc.contenu && bloc.contenu.libelle) || infoType(bloc.type_bloc).label;
}

function blocIAEstVide(bloc) {
  const champ = champIA(bloc.type_bloc);
  const valeur = (bloc.contenu && bloc.contenu[champ]) || '';
  return !texteBrutDepuisHtml(valeur.toString()).trim();
}

// Extrait court (texte brut, ~300 caractères) du contenu d'un bloc, pour
// donner à l'IA de quoi éviter les répétitions sans gonfler inutilement le
// prompt (voir texteBlocPourResume, déjà utilisé par le Résumé IA).
function extraitTexteBlocPourIA(bloc) {
  const texte = texteBlocPourResume(bloc);
  if (!texte) return '';
  return texte.length > 300 ? texte.slice(0, 300) + '…' : texte;
}

// Blocs éligibles à la génération groupée : ont un champ IA (texte/consigne),
// ne sont pas des sections (Contenu/Consigne — leur propre texte n'est qu'un
// repère interne, jamais affiché à l'élève), et ne sont pas verrouillés.
function blocsEligiblesGenerationIA() {
  return blocsEnOrdreLecture(blocs).filter(b =>
    champIA(b.type_bloc) && !TYPES_SECTIONS.includes(b.type_bloc) && !(b.contenu && b.contenu.verrouilleIA)
  );
}

function ouvrirGenerationSeanceIA() {
  const eligibles = blocsEligiblesGenerationIA();
  if (!eligibles.length) {
    return alert("Aucun bloc éligible à la génération IA groupée dans cette séance (tous les blocs compatibles sont verrouillés, ou la séance n'en contient aucun pour l'instant).");
  }
  const options = eligibles.map(b => ({
    valeur: String(b.id),
    label: `${infoType(b.type_bloc).icone} ${echapper(libelleRoleBloc(b))} — ${blocIAEstVide(b) ? 'vide' : 'déjà rempli'}`
  }));
  const valeurParDefaut = eligibles.filter(blocIAEstVide).map(b => String(b.id));
  ouvrirModal({
    titre: "🧠 Générer avec l'IA (plusieurs blocs)",
    champs: [
      {
        nom: 'cibles',
        label: 'Choisissez les blocs à générer ou régénérer (les blocs vides sont pré-cochés ; les blocs verrouillés 🔒 ne sont pas proposés) :',
        type: 'checkboxes', requis: false, options, valeur: valeurParDefaut,
        toutCocherLabel: 'Tout sélectionner (y compris les blocs déjà remplis)'
      },
      {
        nom: 'instructions', requis: false, type: 'textarea',
        label: "Consignes pour l'IA (facultatif) — ex : insiste sur le vocabulaire, reste très simple...",
        placeholder: 'Laisser vide pour une génération standard'
      }
    ],
    texteValider: 'Générer',
    onValider: ({ cibles, instructions }) => {
      const idsCibles = (cibles || []).map(v => parseInt(v, 10));
      if (!idsCibles.length) return alert('Sélectionnez au moins un bloc à générer.');
      lancerGenerationSeanceIA(idsCibles, (instructions || '').trim());
    }
  });
}

async function lancerGenerationSeanceIA(idsCibles, instructionsPersonnalisees) {
  const bouton = document.getElementById('btnGenererSeanceIA');
  const texteBoutonOriginal = bouton ? bouton.textContent : '';
  if (bouton) { bouton.disabled = true; bouton.textContent = '⏳ Génération en cours...'; }
  try {
    const ordre = blocsEnOrdreLecture(blocs);
    const idsCiblesSet = new Set(idsCibles);

    const blocsCibles = ordre.filter(b => idsCiblesSet.has(b.id)).map(b => ({
      block_id: String(b.id), type_bloc: b.type_bloc, role: libelleRoleBloc(b), vide: blocIAEstVide(b)
    }));
    // Contexte : les autres blocs déjà remplis (jamais les cibles elles-mêmes,
    // jamais les sections, jamais un bloc vide qui n'apporterait rien) — pour
    // que l'IA évite les répétitions sans qu'on lui envoie toute la séance.
    const blocsContexte = ordre
      .filter(b => !idsCiblesSet.has(b.id) && champIA(b.type_bloc) && !TYPES_SECTIONS.includes(b.type_bloc))
      .map(b => ({ role: libelleRoleBloc(b), extrait: extraitTexteBlocPourIA(b) }))
      .filter(x => x.extrait);

    const resultat = await appelerAssistantIABlocs({
      action: 'genererSeance',
      classe: chaineNavigation?.classeNom, champ: chaineNavigation?.champNom, discipline: seance.discipline,
      titreSeance: seance.titre, titreContenu: seance.titre_contenu,
      blocsCibles, blocsContexte, instructions: instructionsPersonnalisees || ''
    });

    let nbAppliques = 0;
    for (const item of (resultat.blocks || [])) {
      const idBloc = parseInt(item.block_id, 10);
      if (!idsCiblesSet.has(idBloc)) continue; // seconde vérification côté client, en plus du filtrage serveur
      const bloc = blocs.find(b => b.id === idBloc);
      if (!bloc) continue;
      const champ = champIA(bloc.type_bloc);
      if (!champ || typeof item.content !== 'string' || !item.content.trim()) continue;
      const estRiche = TYPES_TEXTE_LIBRE.includes(bloc.type_bloc);
      bloc.contenu = { ...bloc.contenu, [champ]: estRiche ? markdownVersHtml(item.content) : nettoyerMarkdown(item.content) };
      programmerSauvegardeBloc(bloc);
      nbAppliques++;
    }
    rendreListeBlocs();
    afficherSauvegarde();
    if (!nbAppliques) alert("L'IA n'a renvoyé aucun contenu exploitable pour les blocs sélectionnés — réessayez.");
  } catch (e) {
    alert('Erreur IA : ' + e.message);
  } finally {
    if (bouton) { bouton.disabled = false; bouton.textContent = texteBoutonOriginal; }
  }
}

// --- AJOUT / DUPLICATION / SUPPRESSION DE BLOCS -----------------------------

async function ajouterBloc(type, parentBlocId) {
  document.getElementById('listeTypes').classList.remove('ouvert');
  if (parentBlocId && !typesAutorisesPourParent(parentBlocId).some(t => t.valeur === type)) {
    return alert("Ce type de bloc n'est pas autorisé à l'intérieur d'une section « Contenu » (réservée aux blocs de contenu pédagogique — pas d'exercice, quiz, évaluation, activité, consigne ou item).");
  }
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
    seuil_reussite: bloc.seuil_reussite, ordre: ordreMax + 1, parent_bloc_id: bloc.parent_bloc_id || null
  }).select().single();
  if (error) return alert(error.message);
  blocs.push(data);

  // Pour un exercice/quiz/évaluation/activité, le corrigé vit dans une table
  // séparée (corriges_exercices) : il faut le copier explicitement vers le
  // nouveau bloc, sinon la copie garderait des questions sans aucune bonne réponse.
  if (['exercice', 'quiz', 'evaluation', 'activite'].includes(bloc.type_bloc)) {
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

// Complément au glisser-déposer existant (pas pratique sur mobile, ni pour
// atteindre une section éloignée dans une longue séance) : un menu direct
// « Déplacer vers... » listant toutes les sections valides + la racine.
function sectionsDisponiblesPour(bloc) {
  // Une section ne peut pas se retrouver dans elle-même ni dans l'un de ses
  // propres descendants (boucle de parenté) ; on respecte aussi la même
  // restriction que pour l'ajout normal : une section "Contenu" n'accepte
  // pas les blocs évalués/notés ni consigne/item (TYPES_INTERDITS_DANS_CONTENU).
  const estUneSection = TYPES_SECTIONS.includes(bloc.type_bloc);
  const descendants = new Set();
  if (estUneSection) {
    const pile = [bloc.id];
    while (pile.length) {
      const id = pile.pop();
      blocs.filter(b => b.parent_bloc_id === id).forEach(enfant => { descendants.add(enfant.id); pile.push(enfant.id); });
    }
  }
  return blocs
    .filter(b => TYPES_SECTIONS.includes(b.type_bloc) && b.id !== bloc.id && !descendants.has(b.id))
    .filter(b => !(b.type_bloc === 'titre' && TYPES_INTERDITS_DANS_CONTENU.includes(bloc.type_bloc)))
    .sort((a, b) => a.ordre - b.ordre);
}

function ouvrirDeplacerBloc(bloc) {
  const sectionsCibles = sectionsDisponiblesPour(bloc);
  const options = [
    { valeur: '', label: '— Racine (hors section) —' },
    ...sectionsCibles.map(s => ({ valeur: String(s.id), label: (s.contenu && s.contenu.libelle) || infoType(s.type_bloc).label }))
  ];

  ouvrirModal({
    titre: 'Déplacer ce bloc',
    champs: [
      { nom: 'cible', label: 'Déplacer vers', type: 'select', valeur: bloc.parent_bloc_id ? String(bloc.parent_bloc_id) : '', options }
    ],
    texteValider: 'Déplacer',
    onValider: async ({ cible }) => {
      const nouveauParentId = cible ? parseInt(cible, 10) : null;
      const ancienParentId = bloc.parent_bloc_id || null;
      if (nouveauParentId === ancienParentId) return; // déjà là, rien à faire

      const fratrie = blocs.filter(b => (b.parent_bloc_id || null) === (nouveauParentId || null) && b.id !== bloc.id);
      const ordreMax = fratrie.length ? Math.max(...fratrie.map(b => b.ordre)) : -1;

      bloc.parent_bloc_id = nouveauParentId;
      bloc.ordre = ordreMax + 1;
      const { error } = await supabaseClient.from('blocs_seance').update({ parent_bloc_id: nouveauParentId, ordre: bloc.ordre }).eq('id', bloc.id);
      if (error) return alert(error.message);

      if (nouveauParentId) sectionsOuvertes.add(nouveauParentId);
      rendreListeBlocs();
      afficherSauvegarde();
    }
  });
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
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier,
        seuil_reussite: b.seuil_reussite, ordre: b.ordre
      }).select().single();
      correspondance[b.id] = copie.id;
    }
    const enfants = blocs.filter(b => b.parent_bloc_id);
    for (const b of enfants) {
      const { data: copieEnfant } = await supabaseClient.from('blocs_seance').insert({
        seance_id: nouvelleSeance.id, type_bloc: b.type_bloc, contenu: b.contenu, palier: b.palier,
        seuil_reussite: b.seuil_reussite, ordre: b.ordre, parent_bloc_id: correspondance[b.parent_bloc_id] || null
      }).select().single();
      if (copieEnfant) correspondance[b.id] = copieEnfant.id;
    }

    // Corrigés des exercices/quiz/évaluations/activités : table séparée, à
    // copier à part (sinon la séance dupliquée aurait des questions sans
    // aucune bonne réponse).
    const blocsNotables = blocs.filter(b => ['exercice', 'quiz', 'evaluation', 'activite'].includes(b.type_bloc));
    for (const b of blocsNotables) {
      if (!correspondance[b.id]) continue;
      const { data: corrigeSource } = await supabaseClient
        .from('corriges_exercices').select('corrige').eq('bloc_id', b.id).maybeSingle();
      if (corrigeSource) {
        await supabaseClient.from('corriges_exercices').insert({ bloc_id: correspondance[b.id], corrige: corrigeSource.corrige });
      }
      // Compétences rattachées (Phase 2 "Accompagnement personnalisé") : même
      // logique que le corrigé ci-dessus — sans cette copie, un bloc dupliqué
      // perdrait silencieusement son suivi de progression.
      if (Array.isArray(b.competencesIds) && b.competencesIds.length) {
        await supabaseClient.from('blocs_competences').insert(
          b.competencesIds.map(competenceId => ({ bloc_id: correspondance[b.id], competence_id: competenceId }))
        );
      }
    }

    window.location.href = `editeur-seance.html?id=${nouvelleSeance.id}`;
  });
}

// --- APERÇU ÉLÈVE (lecture seule, dans un nouvel onglet) ---------------------
//
// Cet aperçu doit être VISUELLEMENT IDENTIQUE à la vraie page publique
// (pages/eleve/seance.html, js/pages/eleve-seance.js) : même feuille de
// style (css/style-public.css, chargée via <base> + lien relatif plutôt que
// dupliquée), mêmes classes CSS pour l'en-tête et les blocs, même ordre
// titre → discipline, mêmes types de bloc reconnaissables (icône + couleur
// via infoType). Seules différences volontaires : les questions d'exercice
// sont affichées en lecture seule (champs désactivés, pas de vraie
// soumission), les paliers sont tous montrés déverrouillés (il n'y a pas
// d'élève réel pour calculer une progression), et un bloc brouillon (ex.
// résumé IA pas encore publié) reste visible ici avec une mention explicite,
// pour que l'administrateur puisse le relire avant publication — alors que
// la vraie page élève le masque entièrement. Ces fonctions dupliquent celles
// de js/pages/eleve-seance.js (aucun module partagé entre les deux pages,
// même convention que le reste du code) : toute évolution du rendu public
// doit être reportée ici pour que l'aperçu ne redevienne pas obsolète.
const TYPES_TRAVAIL_APERCU = ['exercice', 'quiz', 'evaluation', 'activite'];
const LIBELLES_PALIER_APERCU = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };

async function ouvrirApercu() {
  const fenetre = window.open('', '_blank');

  // Fil d'ariane complet (mêmes niveaux que la vraie page élève) — remonte
  // la chaîne de noeuds jusqu'à la racine, comme remonterCheminNoeudsEleve()
  // dans js/pages/eleve-seance.js. Pas de liens cliquables ici : c'est un
  // aperçu statique dans un nouvel onglet, pas la navigation réelle.
  const segmentsChemin = [];
  {
    let n = chaineNavigation.noeud;
    let garde = 0;
    const titresNoeuds = [];
    while (n && garde++ < 20) {
      titresNoeuds.unshift(n.titre);
      if (!n.parent_id) break;
      const { data: parent } = await supabaseClient.from('noeuds_parcours').select('id, parent_id, titre').eq('id', n.parent_id).single();
      n = parent;
    }
    // Reproduit exactement le fil d'ariane de la vraie page élève (voir
    // js/pages/eleve-seance.js) : la séquence (SA) n'apparaît pas, le dernier
    // niveau affiché est la discipline si renseignée, sinon le titre.
    segmentsChemin.push(chaineNavigation.classeNom, chaineNavigation.champNom, ...titresNoeuds, seance.discipline || seance.titre_contenu || seance.titre);
  }
  const filArianeHtml = segmentsChemin.filter(Boolean).map(s => `<span>${echapper(s)}</span>`).join(' <span class="sep-arbo-eleve">›</span> ');

  function rendreApercuChampQuestion(q, i) {
    if (q.type === 'texte_a_trous') {
      let idxTrou = -1;
      const morceaux = echapper(q.enonce).split('___');
      const enonceAvecTrous = morceaux.map((morceau, k) => {
        if (k === morceaux.length - 1) return morceau;
        idxTrou++;
        return `${morceau}<input type="text" class="champ-trou" disabled style="width:110px;display:inline-block;margin:0 4px">`;
      }).join('');
      return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p></div>`;
    }
    let champ = '';
    if (q.type === 'qcm') {
      champ = (q.options || []).map(opt => `<label><input type="radio" disabled> ${echapper(opt)}</label>`).join('');
    } else if (q.type === 'vrai_faux') {
      champ = `<div class="vf-choix"><label><input type="radio" disabled> Vrai</label><label><input type="radio" disabled> Faux</label></div>`;
    } else if (q.type === 'reponse_courte') {
      champ = `<input type="text" disabled placeholder="Réponse...">`;
    } else if (q.type === 'remise_en_ordre') {
      champ = `<ol>${(q.options || []).map(opt => `<li>${echapper(opt)}</li>`).join('')}</ol>`;
    } else if (q.type === 'association') {
      const gauche = Array.isArray(q.gauche) ? q.gauche : [];
      const droite = Array.isArray(q.droite) ? q.droite : [];
      champ = gauche.map(g => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span style="flex:1">${echapper(g)}</span>
          <select disabled><option>— Choisis —</option>${droite.map(d => `<option>${echapper(d)}</option>`).join('')}</select>
        </div>`).join('');
    } else if (q.type === 'qcm_multiple') {
      champ = (q.options || []).map(opt => `<label><input type="checkbox" disabled> ${echapper(opt)}</label>`).join('');
    } else if (q.type === 'classement') {
      const mots = Array.isArray(q.motsAClasser) ? q.motsAClasser : [];
      const categories = Array.isArray(q.categories) ? q.categories : [];
      champ = mots.map(mot => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span style="flex:1">${echapper(mot)}</span>
          <select disabled><option>— Choisis —</option>${categories.map(c2 => `<option>${echapper(c2)}</option>`).join('')}</select>
        </div>`).join('');
    } else {
      champ = `<textarea disabled placeholder="Réponse..."></textarea>`;
    }
    return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${echapper(q.enonce)}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
  }

  function rendreApercuExercice(c) {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    if (!questions.length) return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant.</p>`;
    return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}${questions.map((q, i) => rendreApercuChampQuestion(q, i)).join('')}`;
  }

  function rendreBlocApercuTravail(b) {
    const info = infoType(b.type_bloc);
    const c = b.contenu || {};
    const couleur = c.couleurBloc || info.couleur || '#0000D1';
    const libelle = c.libelle || info.label;
    return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">
      <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
      ${rendreApercuExercice(c)}
    </div>`;
  }

  function rendreBlocApercu(b, estEnfant = false) {
    const info = infoType(b.type_bloc);
    const c = b.contenu || {};
    const couleur = c.couleurBloc || info.couleur || '#0000D1';
    const afficherTitre = typeof c.afficherTitre === 'boolean' ? c.afficherTitre : b.type_bloc !== 'titre';
    const libelle = c.libelle || info.label;
    let corps = '';
    if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div class="contenu-riche-lecture">${contenuRicheInitial(c.texte)}</div>`;
    else if (b.type_bloc === 'titre') corps = `<h3 style="margin:0">${echapper(c.texte)}</h3>`;
    else if (b.type_bloc === 'consigne') corps = `<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'autre') corps = `${c.nom ? `<p style="font-weight:700">${echapper(c.nom)}</p>` : ''}<p>${echapper(c.texte)}</p>`;
    else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" alt=""><p><em>${echapper(c.legende)}</em></p>`;
    else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.legende) || c.url}</a></p>`;
    else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.nom)}</a></p>`;
    else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
    else if (b.type_bloc === 'tableau') {
      const fusions = c.fusions || [];
      const masquee = (i, j) => fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
      const colspan = (i, j) => { const f = fusions.find(f => f.ligne === i && f.colonneDebut === j); return f ? (f.colonneFin - f.colonneDebut + 1) : 1; };
      const couleurEntete = c.couleurEntete || '#F4F7F9';
      const texteEntete = c.couleurEntete ? texteContrastant(c.couleurEntete) : '#003366';
      const lignesHtml = (c.lignes || []).map((l, i) => {
        const style = c.entete && i === 0 ? ` style="background:${couleurEntete};font-weight:800;color:${texteEntete}"` : '';
        return `<tr${style}>${l.map((cel, j) => masquee(i, j) ? '' : `<td ${colspan(i, j) > 1 ? `colspan="${colspan(i, j)}"` : ''}>${echapper(cel)}</td>`).join('')}</tr>`;
      }).join('');
      corps = `${c.titre ? `<p style="font-weight:700;margin-bottom:6px">${echapper(c.titre)}</p>` : ''}<table>${lignesHtml}</table>`;
    }
    else corps = `<p>${echapper(c.consigne || c.texte || '')}</p>`;

    const enfants = blocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
    const noteBrouillonResume = b.statut_bloc && b.statut_bloc !== 'publie'
      ? ' <span style="font-weight:400;text-transform:none;color:#B45309">(brouillon — pas encore visible des élèves)</span>' : '';
    const contenuInterieur = `
      ${afficherTitre ? `<div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}${noteBrouillonResume}</div>` : ''}
      ${corps}
      ${enfants.length ? `<div style="margin-top:10px">${enfants.filter(x => !TYPES_TRAVAIL_APERCU.includes(x.type_bloc)).map(x => rendreBlocApercu(x, true)).join('')}</div>` : ''}
    `;
    // Un bloc rattaché à une section (Contenu/Consigne) n'a pas sa propre
    // carte : il s'affiche dans le prolongement direct du parent, aligné
    // avec lui — exactement comme sur la vraie page élève.
    if (estEnfant) return contenuInterieur;
    return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleur, 0.04)}">${contenuInterieur}</div>`;
  }

  function html_sectionPaliersApercu(blocsParPalier) {
    const paliersPresents = ['azovi', 'devi', 'ogan', 'axosu'].filter(p => (blocsParPalier[p] || []).length);
    if (!paliersPresents.length) return '';
    return `
      <div class="section-title-eleve" style="margin-top:24px">🎯 Paliers de cette séance</div>
      <p style="font-size:12px;color:var(--text-gris);margin-top:-10px">Aperçu : les paliers sont montrés ici tous déverrouillés — l'élève les débloque progressivement, palier après palier.</p>
      ${paliersPresents.map(p => {
        const blocsPalier = (blocsParPalier[p] || []).sort((a, b) => a.ordre - b.ordre);
        return `<div class="bloc-lecture" style="border-left-color:var(--bleu-kekeli);margin-top:14px">
          <div class="bloc-lecture-titre">${LIBELLES_PALIER_APERCU[p] || p}</div>
          ${blocsPalier.map(b => TYPES_TRAVAIL_APERCU.includes(b.type_bloc) ? rendreBlocApercuTravail(b) : rendreBlocApercu(b)).join('')}
        </div>`;
      }).join('')}
    `;
  }

  const tousBlocsTop = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const blocsGeneraux = tousBlocsTop.filter(b => !b.palier);
  const blocsLecture = blocsGeneraux.filter(b => !TYPES_TRAVAIL_APERCU.includes(b.type_bloc));
  const blocsTravail = blocsGeneraux.filter(b => TYPES_TRAVAIL_APERCU.includes(b.type_bloc));
  const blocsParPalier = {};
  tousBlocsTop.filter(b => b.palier).forEach(b => { (blocsParPalier[b.palier] ??= []).push(b); });
  const aDesPaliers = Object.keys(blocsParPalier).length > 0;
  const colonneExerciceVide = blocsTravail.length === 0 && aDesPaliers;

  // Reproduit exactement l'en-tête de la vraie page élève (voir
  // js/pages/eleve-seance.js) : titre_contenu si renseigné (sinon le titre
  // brut), avec la discipline affichée à côté plutôt qu'à sa place.
  const enTete = `
    <div style="background:#FFF7DA;border:1px solid #F5D77A;border-radius:8px;padding:6px 12px;font-size:12px;color:#7A5A00;margin-bottom:14px;text-align:center">
      🔍 Aperçu élève — lecture seule, tel qu'affiché à un élève sur la vraie page
    </div>
    <div class="entete-seance-eleve">
      <p style="margin:0" class="miniature-arborescence-eleve">${filArianeHtml}</p>
      <h1 class="titre-seance-eleve">${echapper(seance.titre_contenu || seance.titre)}${seance.discipline ? ` <span style="font-size:13px;font-weight:600;color:var(--text-gris);vertical-align:middle">— ${echapper(seance.discipline)}</span>` : ''}</h1>
    </div>`;

  const corpsHtml = `
    <div class="zone-travail-seance"${colonneExerciceVide ? ' style="grid-template-columns:1fr"' : ''}>
      <div class="colonne-lecture-seance">
        ${blocsLecture.length ? blocsLecture.map(b => rendreBlocApercu(b)).join('') : '<p style="color:var(--text-gris)">Aucun support de cours pour cette séance.</p>'}
      </div>
      ${colonneExerciceVide ? '' : `<div class="colonne-exercice-seance">
        ${blocsTravail.length ? blocsTravail.map(rendreBlocApercuTravail).join('') : '<div class="bloc-lecture" style="border-left-color:#94A3B8"><p style="color:var(--text-gris);margin:0">Aucun exercice ni activité pour cette séance.</p></div>'}
      </div>`}
    </div>
    ${html_sectionPaliersApercu(blocsParPalier)}
  `;

  fenetre.document.write(`
    <html><head><meta charset="UTF-8"><title>Aperçu — ${echapper(seance.titre)}</title>
    <base href="${window.location.href}">
    <link rel="stylesheet" href="../css/style-public.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet">
    </head><body><div class="conteneur-tableau-bord">${enTete}${corpsHtml}</div></body></html>`);
  fenetre.document.close();
}

init();
