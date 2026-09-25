// Module partagé "Cahier d'écriture" — utilisé par les pages personnelles de
// TOUS les rôles (pages/eleve/cahier-ecriture.html, pages/parent/..., pages/
// enseignant/..., pages/admin/..., pages/autorite/...).
//
// 24 septembre 2026 : généralisation du cahier d'écriture, jusque-là réservé
// à l'élève (js/pages/eleve-cahier-ecriture.js, resté tel quel dans son
// esprit — voir l'historique complet en tête de ce fichier-là). Demande
// explicite : "Ajoute le cahier d'écriture à tous les rôles et ajoute
// l'enregistrement en base à tout le monde en premium." Ce module reprend
// donc le sélecteur de classe (CI à CM2, réglure par défaut adaptée) tel
// quel, et y ajoute la SAUVEGARDE CLOUD (Supabase) :
//
//   - localStorage reste la source primaire sur l'appareil (comportement
//     identique à avant si hors-ligne, ou si la sauvegarde cloud échoue pour
//     une raison quelconque) — décision utilisateur du 24/09/2026 ("Garder
//     les deux, BDD en sauvegarde").
//   - Au chargement, si le cahier local de CET appareil est vide (nouvel
//     appareil), on restaure depuis la base AVANT de charger l'outil dans
//     l'iframe (sinon l'outil démarrerait sur un cahier vide puis un futur
//     rechargement écraserait la restauration). Ce comportement-là reste
//     automatique (ce n'est pas un "enregistrement", c'est une simple
//     lecture au chargement).
//
// 25 septembre 2026 : demande explicite — "Pour le cahier d'écriture
// l'enregistrement en base doit être déclenché par un bouton à appuyer.
// Supprime l'enregistrement automatique." La sauvegarde périodique (toutes
// les 20 secondes) + les déclencheurs visibilitychange/beforeunload ont donc
// été entièrement retirés : la sauvegarde vers la fonction SQL
// sauvegarder_cahier_ecriture() n'a désormais lieu QUE sur un clic explicite
// du bouton "💾 Enregistrer en ligne" (voir _sauvegarderCahierCloudPartage,
// appelée uniquement depuis le clic). Elle réplique toujours EXACTEMENT la
// même collecte de clés localStorage que l'outil Seyes fait lui-même pour
// son propre export (voir pages/eleve/cahier-ecriture/js/core/save-load/
// files.mjs, fonction enregistrer()).
//
// Pour l'ÉLÈVE uniquement, la sauvegarde cloud est un service Premium
// (cahier_ecriture_cloud) : GRATUIT ET ILLIMITÉ pour tous les autres rôles
// (aucun système de facturation Premium personnel n'existe pour les comptes
// adultes/staff sur cette plateforme — décision utilisateur du 24/09/2026).
// Le contrôle réel d'accès est fait CÔTÉ SERVEUR, dans la fonction SQL
// sauvegarder_cahier_ecriture() elle-même (via etat_acces_service). La
// vérification faite ICI côté client (etat_acces_service en lecture) ne
// sert QUE À L'AFFICHAGE d'un bandeau informatif — jamais à décider si on
// tente la sauvegarde ou non : le bouton reste cliquable dans tous les cas,
// c'est le serveur qui accepte ou refuse (même principe que l'ancien
// mécanisme automatique, transposé au clic).

const PREFIXE_STOCKAGE_SEYES_PARTAGE = 'seyes-';
const CLE_CLASSE_CHOISIE_CAHIER = 'kekeli-cahier-ecriture-classe-choisie';

// Les 6 classes de Kekeli et la réglure Seyes proposée par défaut pour
// chacune — reprises telles quelles de js/pages/eleve-cahier-ecriture.js
// (voir ce fichier pour le détail du choix pédagogique de chaque réglure).
const CLASSES_CAHIER_ECRITURE = [
  { nom: 'CI', age: '5 - 6 ans', reglure: 'terre' },
  { nom: 'CP', age: '6 - 7 ans', reglure: 'trois_couleurs' },
  { nom: 'CE1', age: '7 - 8 ans', reglure: 'seyes_gris' },
  { nom: 'CE2', age: '8 - 9 ans', reglure: 'seyes' },
  { nom: 'CM1', age: '9 - 10 ans', reglure: 'seyes_noir' },
  { nom: 'CM2', age: '10 - 11 ans', reglure: 'seyes' },
];

const LIBELLES_REGLURE_CAHIER = {
  terre: 'Lignage terre (repère sol/ciel)',
  trois_couleurs: 'Lignage Seyes trois couleurs',
  seyes_gris: 'Lignage Seyes gris',
  seyes: 'Lignage Seyes standard',
  seyes_noir: 'Lignage Seyes noir',
  petit: 'Lignage petit',
};

let _cahierPartageProfil = null;
let _cahierPartageEstEleve = false;
let _cahierPartageDernierPayloadEnvoye = null;

// initialiserCahierEcriturePartage(profil, options)
//   profil  : le profil connecté (id, prenom...) — son propre cahier.
//   options.estEleve            : true pour le rôle élève (gate Premium).
//   options.recupererClasseReelle : fonction async optionnelle -> nom de
//     classe réel (ex. lookup eleves.classe_id), pour proposer un choix par
//     défaut pertinent et afficher l'étoile "★ ma classe". Absente pour les
//     rôles sans classe propre (parent/enseignant/admin/autorité).
async function initialiserCahierEcriturePartage(profil, options) {
  const opts = options || {};
  _cahierPartageProfil = profil;
  _cahierPartageEstEleve = !!opts.estEleve;
  _cahierPartageDernierPayloadEnvoye = null;

  const conteneur = document.getElementById('contenu');

  let classeReelle = '';
  if (typeof opts.recupererClasseReelle === 'function') {
    try { classeReelle = (await opts.recupererClasseReelle()) || ''; } catch (_e) { /* pas bloquant */ }
  }

  let classeChoisie = '';
  try { classeChoisie = localStorage.getItem(CLE_CLASSE_CHOISIE_CAHIER) || ''; } catch (_e) { /* ignore */ }
  if (!CLASSES_CAHIER_ECRITURE.some(c => c.nom === classeChoisie)) {
    classeChoisie = CLASSES_CAHIER_ECRITURE.some(c => c.nom === classeReelle) ? classeReelle : 'CI';
  }

  _injecterStylesCahierPartage();

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1 style="margin:0">✍️ Cahier d'écriture</h1>
      <p>Choisis une page d'écriture Seyes adaptée : lettres cursives, export PDF/impression, sauvegarde automatique sur cet appareil.</p>
    </div>

    <div class="cahier-barre-cloud" id="cahierBarreCloudPartage">
      <p class="cahier-etat-cloud" id="cahierEtatCloudPartage"></p>
      <button type="button" class="cahier-bouton-enregistrer" id="cahierBoutonEnregistrerPartage">💾 Enregistrer en ligne</button>
    </div>

    <div class="cahier-selecteur-classe" id="cahierSelecteurClassePartage">
      ${CLASSES_CAHIER_ECRITURE.map(c => `
        <button type="button" class="cahier-bouton-classe${c.nom === classeChoisie ? ' selectionnee' : ''}${c.nom === classeReelle ? ' classe-eleve' : ''}" data-classe="${c.nom}">
          <span>${c.nom}</span>
          <span class="cahier-bouton-classe-age">${c.age}</span>
        </button>`).join('')}
    </div>
    <p class="cahier-note-reglure" id="cahierNoteReglurePartage"></p>

    <div class="cahier-cadre-outil">
      <iframe id="cahierIframeOutilPartage" title="Cahier d'écriture Seyes" src=""></iframe>
    </div>
  `;

  document.getElementById('cahierSelecteurClassePartage').addEventListener('click', (evt) => {
    const bouton = evt.target.closest('.cahier-bouton-classe');
    if (!bouton) return;
    _choisirClasseCahierPartage(bouton.dataset.classe, classeReelle);
  });

  document.getElementById('cahierBoutonEnregistrerPartage').addEventListener('click', () => {
    _sauvegarderCahierCloudPartage({ manuel: true });
  });

  // Restauration cloud -> localStorage, UNIQUEMENT si ce cahier n'a encore
  // aucune trace locale sur CET appareil (nouvel appareil) — on ne touche
  // jamais à un cahier déjà présent, pour ne jamais écraser un travail local
  // plus récent que la dernière sauvegarde cloud. Fait AVANT de fixer le src
  // de l'iframe : l'outil Seyes lit son propre localStorage dès son
  // initialisation, une fois chargé.
  await _restaurerCahierDepuisCloudSiVide(profil.id);

  _choisirClasseCahierPartage(classeChoisie, classeReelle);
  _afficherBandeauCloudCahier(opts.eleveIdPourPremium || profil.id);
}

function _choisirClasseCahierPartage(nomClasse, classeReelle) {
  const infos = CLASSES_CAHIER_ECRITURE.find(c => c.nom === nomClasse) || CLASSES_CAHIER_ECRITURE[0];

  document.querySelectorAll('#cahierSelecteurClassePartage .cahier-bouton-classe').forEach(b => {
    b.classList.toggle('selectionnee', b.dataset.classe === infos.nom);
  });

  const note = document.getElementById('cahierNoteReglurePartage');
  if (note) {
    note.textContent = `Lignage proposé par défaut pour ${infos.nom} : ${LIBELLES_REGLURE_CAHIER[infos.reglure] || infos.reglure}. Modifiable à tout moment dans l'outil (menu « Type de lignage »).`;
  }

  try { localStorage.setItem(CLE_CLASSE_CHOISIE_CAHIER, infos.nom); } catch (_e) { /* ignore */ }

  const iframe = document.getElementById('cahierIframeOutilPartage');
  if (iframe) {
    // Chemin relatif à la page du rôle courant, comme dans l'ancienne page
    // élève : toutes les pages "cahier-ecriture.html" (une par rôle) vivent
    // au même niveau (pages/<role>/cahier-ecriture.html) et pointent donc
    // toutes vers le même outil partagé pages/eleve/cahier-ecriture/.
    iframe.src = `${CHEMIN_OUTIL_CAHIER_ECRITURE}?type-carreaux=${encodeURIComponent(infos.reglure)}`;
  }
}

// Restauration : même logique que handleJSONFile() dans files.mjs (l'import
// natif de l'outil) — on réinjecte chaque clé telle quelle, en JSON.stringify
// uniquement les valeurs objet (seyes-texte-principal reste une chaîne HTML
// brute, exactement comme dans l'outil d'origine).
async function _restaurerCahierDepuisCloudSiVide(profilId) {
  try {
    const dejaLocal = Object.keys(localStorage).some(k => k.startsWith(PREFIXE_STOCKAGE_SEYES_PARTAGE));
    if (dejaLocal) return;
    const { data, error } = await supabaseClient.from('cahiers_ecriture').select('contenu').eq('profil_id', profilId).maybeSingle();
    if (error || !data || !data.contenu) return;
    for (const [cle, valeur] of Object.entries(data.contenu)) {
      if (!cle.startsWith(PREFIXE_STOCKAGE_SEYES_PARTAGE)) continue;
      const stocke = (typeof valeur === 'object' && valeur !== null) ? JSON.stringify(valeur) : valeur;
      localStorage.setItem(cle, stocke);
    }
  } catch (_e) { /* pas bloquant : l'élève repart simplement d'un cahier vide sur cet appareil */ }
}

// Collecte : même logique que enregistrer() dans files.mjs (export natif de
// l'outil) — mêmes clés (préfixe "seyes-"), même traitement JSON.
function _collecterPayloadCahierPartage() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i);
    if (!cle || !cle.startsWith(PREFIXE_STOCKAGE_SEYES_PARTAGE)) continue;
    const valeur = localStorage.getItem(cle);
    if (cle === 'seyes-texte-principal') {
      data[cle] = valeur;
    } else {
      try { data[cle] = JSON.parse(valeur); } catch (_e) { data[cle] = valeur; }
    }
  }
  return data;
}

// 25 septembre 2026 : n'est plus jamais appelée automatiquement (minuteur,
// visibilitychange, beforeunload) — uniquement sur clic du bouton "💾
// Enregistrer en ligne" (voir l'écouteur posé dans
// initialiserCahierEcriturePartage). { manuel: true } pilote le retour
// visuel sur le bouton lui-même ; le bandeau au-dessus reste, lui, purement
// informatif sur l'accès (Premium ou non), indépendamment du résultat d'un
// clic donné.
async function _sauvegarderCahierCloudPartage(options) {
  const manuel = !!(options && options.manuel);
  const bouton = document.getElementById('cahierBoutonEnregistrerPartage');
  if (!_cahierPartageProfil) return;

  if (manuel && bouton) {
    bouton.disabled = true;
    bouton.textContent = '⏳ Enregistrement...';
  }

  try {
    const payload = _collecterPayloadCahierPartage();
    const serialise = JSON.stringify(payload);
    if (serialise === _cahierPartageDernierPayloadEnvoye) {
      // Rien de nouveau depuis le dernier enregistrement réussi : on le dit
      // quand même si le clic est manuel, plutôt que de rester muet.
      if (manuel) _reinitialiserBoutonEnregistrerCahier('✅ Déjà à jour');
      return;
    }
    const { error } = await supabaseClient.rpc('sauvegarder_cahier_ecriture', { p_contenu: payload });
    if (!error) {
      _cahierPartageDernierPayloadEnvoye = serialise;
      _majBandeauCloudCahier('ok');
      if (manuel) _reinitialiserBoutonEnregistrerCahier('✅ Enregistré');
    } else if (_cahierPartageEstEleve) {
      // Le refus le plus probable pour un élève est l'absence d'accès
      // Premium (voir sauvegarder_cahier_ecriture côté serveur) — jamais
      // interprété comme une erreur bloquante : le cahier reste sauvegardé
      // localement normalement.
      _majBandeauCloudCahier('premium_requis');
      if (manuel) _reinitialiserBoutonEnregistrerCahier('🔒 Premium requis');
    } else if (manuel) {
      _reinitialiserBoutonEnregistrerCahier('❌ Échec, réessaie');
    }
  } catch (_e) {
    // La sauvegarde locale (localStorage), elle, continue de fonctionner
    // normalement dans tous les cas.
    if (manuel) _reinitialiserBoutonEnregistrerCahier('❌ Échec, réessaie');
  } finally {
    if (manuel && bouton && bouton.textContent.startsWith('⏳')) {
      // Filet de sécurité : ne devrait pas arriver (tous les chemins
      // ci-dessus repassent par _reinitialiserBoutonEnregistrerCahier), mais
      // évite de laisser le bouton bloqué en cas d'oubli futur.
      _reinitialiserBoutonEnregistrerCahier('💾 Enregistrer en ligne');
    }
  }
}

// Réaffiche un libellé temporaire sur le bouton (confirmation/erreur), puis
// revient au libellé normal après un court délai, et réactive le bouton.
function _reinitialiserBoutonEnregistrerCahier(libelleTemporaire) {
  const bouton = document.getElementById('cahierBoutonEnregistrerPartage');
  if (!bouton) return;
  bouton.textContent = libelleTemporaire;
  setTimeout(() => {
    const b = document.getElementById('cahierBoutonEnregistrerPartage');
    if (!b) return;
    b.disabled = false;
    b.textContent = '💾 Enregistrer en ligne';
  }, 1800);
}

// Bandeau purement informatif sur l'ACCÈS (Premium ou non) : n'intervient
// JAMAIS dans la décision de tenter ou non la sauvegarde — le bouton reste
// cliquable dans tous les cas, c'est le serveur, dans
// sauvegarder_cahier_ecriture(), qui accepte ou refuse à chaque clic.
async function _afficherBandeauCloudCahier(eleveIdPourPremium) {
  if (!_cahierPartageEstEleve) {
    _majBandeauCloudCahier('gratuit_role');
    return;
  }
  try {
    const { data, error } = await supabaseClient.rpc('etat_acces_service', {
      p_eleve_id: eleveIdPourPremium, p_service: 'cahier_ecriture_cloud',
    });
    _majBandeauCloudCahier(!error && data && data.autorise ? 'ok' : 'premium_requis');
  } catch (_e) {
    // Pas d'information fiable disponible : on n'affiche rien plutôt que
    // d'afficher un message potentiellement faux.
  }
}

function _majBandeauCloudCahier(etat) {
  const zone = document.getElementById('cahierEtatCloudPartage');
  if (!zone) return;
  if (etat === 'gratuit_role') {
    zone.innerHTML = '☁️ Sauvegarde en ligne disponible — appuie sur « Enregistrer en ligne » pour rendre ton cahier accessible depuis un autre appareil.';
    zone.classList.remove('cahier-etat-cloud-verrouille');
  } else if (etat === 'ok') {
    zone.innerHTML = '☁️ Sauvegarde en ligne activée (Premium) — appuie sur « Enregistrer en ligne » quand tu veux mettre à jour la copie en ligne.';
    zone.classList.remove('cahier-etat-cloud-verrouille');
  } else if (etat === 'premium_requis') {
    zone.innerHTML = '🔒 La sauvegarde en ligne (accessible depuis un autre appareil) est une fonctionnalité <strong>Premium</strong> — le cahier reste sauvegardé automatiquement sur cet appareil.';
    zone.classList.add('cahier-etat-cloud-verrouille');
  }
}

// Injecté une seule fois dans <head> (le module est partagé par 5 pages qui
// n'ont pas toutes ces règles dans leur propre <style>) plutôt que dupliqué
// dans chacune des 5 pages de rôle.
function _injecterStylesCahierPartage() {
  if (document.getElementById('cahier-partage-styles-injectees')) return;
  const style = document.createElement('style');
  style.id = 'cahier-partage-styles-injectees';
  style.textContent = `
    .cahier-barre-cloud {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap;
    }
    .cahier-barre-cloud .cahier-etat-cloud { margin: 0; flex: 1 1 260px; }
    .cahier-bouton-enregistrer {
      border: none; background: #1e293b; color: #fff; border-radius: 10px;
      padding: 9px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer;
      white-space: nowrap; transition: background .15s ease;
    }
    .cahier-bouton-enregistrer:hover:not(:disabled) { background: #334155; }
    .cahier-bouton-enregistrer:disabled { opacity: .75; cursor: default; }
  `;
  document.head.appendChild(style);
}
