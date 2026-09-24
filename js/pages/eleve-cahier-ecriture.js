// Page pages/eleve/cahier-ecriture.html
//
// 24 septembre 2026 (requête G2, en complément de l'intégration initiale du
// 24 septembre 2026 — voir js/navigation-config.js) : "Je veux que ça soit
// vraiment intégrer à kekeli avec l'affichage du logo et du menu de
// navigation. Ajoute également les classes du CI au CM2 en prévoyant des
// réglures par défaut pour chaque classe."
//
// Cette page NE remplace PAS l'outil Seyes/Éducajou (pages/eleve/cahier-
// ecriture/index.html, copié tel quel — voir la demande initiale "adapter
// exactement ce fichier") : elle l'embarque dans un <iframe>, à l'intérieur
// du vrai en-tête/pied de page/sidebar Kekeli (via initEnteteNavigation, la
// même fonction que toutes les autres pages élève). L'outil garde son code
// interne intact ; on ne fait que lui passer un paramètre d'URL qu'il sait
// déjà lire nativement (voir js/core/settings/loadSettings.mjs de l'outil :
// `config.typeCarreaux = await getString("type-carreaux", ...)`, qui lit
// d'abord l'URL puis retombe sur le localStorage) — aucune modification du
// code de l'outil n'a donc été nécessaire pour cette fonctionnalité.

let profilCahier = null;

// Les 6 classes de Kekeli (mêmes libellés/âges que js/pages/navigation.js,
// "CYCLES_CLASSES") et la réglure Seyes proposée par défaut pour chacune.
//
// Choix pédagogique (valeurs = les ids des boutons de lignage de l'outil,
// SANS le préfixe "carreau_" — voir pages/eleve/cahier-ecriture/index.html) :
//   - CI  (5-6 ans, découverte de l'écriture/graphisme) : lignage "terre"
//     (terre-ciel) — le repère visuel le plus explicite pour situer les
//     tracés des lettres, pensé pour les tout premiers essais graphiques.
//   - CP  (6-7 ans, écriture courante) : lignage Seyes "trois couleurs" —
//     le support classique pour apprendre les 3 zones de la cursive au
//     moment où l'écriture liée démarre vraiment.
//   - CE1 (7-8 ans) : lignage Seyes "gris" — un repère plus discret, pour
//     continuer à consolider une fois les couleurs d'apprentissage plus
//     nécessaires.
//   - CE2 (8-9 ans, rédaction guidée) : lignage Seyes standard — la
//     réglure de référence, à mesure que l'écriture devient autonome.
//   - CM1 (9-10 ans) : lignage Seyes "noir" — le grand quadrillage complet
//     classique des cahiers d'école à ce niveau.
//   - CM2 (10-11 ans, rédaction libre) : lignage Seyes standard (même
//     réglure que CE2) — demande explicite du 24 septembre 2026 ("Pour le
//     CM2 utilise le lignage seyes"), en remplacement du lignage "petit"
//     initialement proposé.
//
// Ce ne sont que des PAR DÉFAUT : l'élève garde la main dans l'outil
// lui-même pour changer de lignage à tout moment (menu "Type de lignage").
const CLASSES_CAHIER_ECRITURE = [
  { nom: 'CI', age: '5 - 6 ans', reglure: 'terre' },
  { nom: 'CP', age: '6 - 7 ans', reglure: 'trois_couleurs' },
  { nom: 'CE1', age: '7 - 8 ans', reglure: 'seyes_gris' },
  { nom: 'CE2', age: '8 - 9 ans', reglure: 'seyes' },
  { nom: 'CM1', age: '9 - 10 ans', reglure: 'seyes_noir' },
  { nom: 'CM2', age: '10 - 11 ans', reglure: 'seyes' },
];

const CLE_CLASSE_CHOISIE_CAHIER = 'kekeli-cahier-ecriture-classe-choisie';

(async function () {
  profilCahier = await requireRole('eleve');
  if (!profilCahier) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilCahier.id, badgeHtml: `🟢 ${echapperCahier(profilCahier.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await afficherCahierEcriture();
})();

async function afficherCahierEcriture() {
  const conteneur = document.getElementById('contenu');

  // Classe réelle de l'élève (juste pour proposer un choix par défaut
  // pertinent — l'élève peut très bien choisir une autre classe, par
  // exemple pour un frère/une sœur, ou pour s'entraîner sur un lignage
  // différent).
  let classeReelle = '';
  try {
    const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilCahier.id).maybeSingle();
    if (fiche?.classe_id) {
      const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).maybeSingle();
      classeReelle = classe?.nom || '';
    }
  } catch (_e) { /* pas bloquant : on retombe sur un choix par défaut simple */ }

  let classeChoisie = '';
  try { classeChoisie = localStorage.getItem(CLE_CLASSE_CHOISIE_CAHIER) || ''; } catch (_e) { /* ignore */ }
  if (!CLASSES_CAHIER_ECRITURE.some(c => c.nom === classeChoisie)) {
    classeChoisie = CLASSES_CAHIER_ECRITURE.some(c => c.nom === classeReelle) ? classeReelle : 'CI';
  }

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1 style="margin:0">✍️ Cahier d'écriture</h1>
      <p>Choisis une page d'écriture Seyes adaptée à ta classe : lettres cursives, export PDF/impression, sauvegarde automatique sur cet appareil.</p>
    </div>

    <div class="cahier-selecteur-classe" id="cahierSelecteurClasse">
      ${CLASSES_CAHIER_ECRITURE.map(c => `
        <button type="button" class="cahier-bouton-classe${c.nom === classeChoisie ? ' selectionnee' : ''}${c.nom === classeReelle ? ' classe-eleve' : ''}" data-classe="${c.nom}">
          <span>${c.nom}</span>
          <span class="cahier-bouton-classe-age">${c.age}</span>
        </button>`).join('')}
    </div>
    <p class="cahier-note-reglure" id="cahierNoteReglure"></p>

    <div class="cahier-cadre-outil">
      <iframe id="cahierIframeOutil" title="Cahier d'écriture Seyes" src=""></iframe>
    </div>
  `;

  document.getElementById('cahierSelecteurClasse').addEventListener('click', (evt) => {
    const bouton = evt.target.closest('.cahier-bouton-classe');
    if (!bouton) return;
    choisirClasseCahier(bouton.dataset.classe, classeReelle);
  });

  choisirClasseCahier(classeChoisie, classeReelle);
}

function choisirClasseCahier(nomClasse, classeReelle) {
  const infos = CLASSES_CAHIER_ECRITURE.find(c => c.nom === nomClasse) || CLASSES_CAHIER_ECRITURE[0];

  document.querySelectorAll('.cahier-bouton-classe').forEach(b => {
    b.classList.toggle('selectionnee', b.dataset.classe === infos.nom);
  });

  const note = document.getElementById('cahierNoteReglure');
  if (note) {
    note.textContent = `Lignage proposé par défaut pour ${infos.nom} : ${LIBELLES_REGLURE_CAHIER[infos.reglure] || infos.reglure}. Modifiable à tout moment dans l'outil (menu « Type de lignage »).`;
  }

  try { localStorage.setItem(CLE_CLASSE_CHOISIE_CAHIER, infos.nom); } catch (_e) { /* ignore */ }

  const iframe = document.getElementById('cahierIframeOutil');
  if (iframe) {
    iframe.src = `cahier-ecriture/index.html?type-carreaux=${encodeURIComponent(infos.reglure)}`;
  }
}

const LIBELLES_REGLURE_CAHIER = {
  terre: 'Lignage terre (repère sol/ciel)',
  trois_couleurs: 'Lignage Seyes trois couleurs',
  seyes_gris: 'Lignage Seyes gris',
  seyes: 'Lignage Seyes standard',
  seyes_noir: 'Lignage Seyes noir',
  petit: 'Lignage petit',
};

function echapperCahier(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
