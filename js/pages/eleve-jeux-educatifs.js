// Page pages/eleve/jeux-educatifs.html
// Lot "Jeux éducatifs interactifs" (11 septembre 2026, douzième requête
// indépendante) : cette page devient le LANCEUR des jeux d'arcade — elle ne
// liste plus les séances à palier une par une (l'ancienne version de ce
// fichier). Voir js/jeux/moteur-jeu-arcade.js et js/jeux/coquille-jeu-
// arcade.js pour le moteur commun.
//
// **24 septembre 2026** (demande : "Pour le français, faut lier les
// questionnaires à au séances réelles. Sépare l'ES de L'EST et lie chacun au
// séances réelles du site") : deux changements côté liste ci-dessous —
// jeu-atelier-francais.html a rejoint le moteur commun (il pioche à nouveau
// dans les vraies séances publiées de Français, avec un filtre par catégorie
// en plus du palier — voir eleve-jeu-atelier-francais.js — après avoir été,
// entre le 12 et le 24 septembre 2026, un port autonome d'une banque de 30
// questions statiques) ; et l'ancien jeu combiné "Défi ES & EST"
// (jeu-es-est.html) est remplacé par deux jeux séparés, jeu-es.html
// (Éducation Sociale) et jeu-est.html (Éducation Scientifique et
// Technologique), chacun ciblant sa seule matière — le contenu était déjà
// tiré des vraies séances avant cette séparation, seule la fusion des deux
// matières dans un même jeu disparaît.

let profilJeux = null;

const JEUX_DISPONIBLES = [
  {
    href: 'jeu-atelier-francais.html', icone: '📚', titre: "L'Atelier du Français",
    desc: 'Conjugaison, grammaire, orthographe, vocabulaire, expression — un défi à la fois, tiré de tes vraies séances de français.',
    couleur: '#8b5cf6'
  },
  {
    href: 'jeu-calcul-mental.html', icone: '🎯', titre: 'Cadran opératoire — Calcul mental',
    desc: "Calcul mental avec un vrai cadran animé, et l'option « masquer l'opération » pour muscler ta mémoire.",
    couleur: '#06b6d4'
  },
  {
    href: 'jeu-es.html', icone: '🏛️', titre: 'Défi Éducation Sociale',
    desc: 'Des questions tirées de tes vraies séances d\'Éducation Sociale, à plusieurs types de questions.',
    couleur: '#10b981'
  },
  {
    href: 'jeu-est.html', icone: '🔬', titre: 'Défi Éducation Scientifique',
    desc: 'Des questions tirées de tes vraies séances d\'Éducation Scientifique et Technologique, à plusieurs types de questions.',
    couleur: '#f59e0b'
  }
];

(async function () {
  profilJeux = await requireRole('eleve');
  if (!profilJeux) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilJeux.id, badgeHtml: `🟢 ${echapperJeux(profilJeux.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await afficherLanceurJeux();
})();

async function afficherLanceurJeux() {
  const conteneur = document.getElementById('contenu');
  const { data: niveauActuel } = await supabaseClient.rpc('niveau_agilite_actuel', { p_eleve_id: profilJeux.id });
  const LIBELLES_PALIER_JEUX = {
    azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú'
  };

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1 style="margin:0">🎮 Jeux éducatifs</h1>
      <p>Choisis un jeu, puis ton niveau — les 4 niveaux de difficulté correspondent à tes paliers habituels${niveauActuel ? ` (ton niveau actuel : <strong>${LIBELLES_PALIER_JEUX[niveauActuel] || niveauActuel}</strong>)` : ''}. Chaque partie réussie compte pour tes vraies médailles et badges !</p>
    </div>

    <div class="grille-paliers-eleve" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      ${JEUX_DISPONIBLES.map(j => `
        <a href="${j.href}" class="palier-card-eleve" style="border-top-color:${j.couleur};text-align:left;text-decoration:none;color:inherit;display:block">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="font-weight:800">${j.titre}</div>
            <div class="palier-icon-eleve" style="margin:0;font-size:1.6rem">${j.icone}</div>
          </div>
          <p style="font-size:12px;color:var(--text-gris);margin:8px 0 12px">${j.desc}</p>
          <span class="btn-palier-eleve" style="background:${j.couleur}">🎮 Jouer</span>
        </a>`).join('')}
    </div>
  `;
}

function echapperJeux(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
