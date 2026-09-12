// Page pages/eleve/jeux-educatifs.html
// Lot "Jeux éducatifs interactifs" (11 septembre 2026, douzième requête
// indépendante) : cette page devient le LANCEUR des 3 jeux d'arcade
// (pages/eleve/jeu-atelier-francais.html, jeu-calcul-mental.html,
// jeu-es-est.html) — elle ne liste plus les séances à palier une par une
// (l'ancienne version de ce fichier). Voir js/jeux/moteur-jeu-arcade.js et
// js/jeux/coquille-jeu-arcade.js pour le moteur commun encore utilisé par
// jeu-es-est.html. **Depuis le 12 septembre 2026 (treizième requête, second
// lot), jeu-atelier-francais.html a rejoint jeu-calcul-mental.html comme
// port quasi-verbatim et autonome d'un fichier de référence fourni par le
// porteur du projet — il ne partage plus ce moteur commun ni le choix de
// palier lié aux vraies séances, sur le même principe (voir
// eleve-jeu-atelier-francais.js et la leçon retenue n°13).

let profilJeux = null;

const JEUX_DISPONIBLES = [
  {
    href: 'jeu-atelier-francais.html', icone: '📚', titre: "L'Atelier du Français",
    desc: 'Conjugaison, grammaire, orthographe, vocabulaire, expression — un défi à la fois, dans le style arcade.',
    couleur: '#8b5cf6'
  },
  {
    href: 'jeu-calcul-mental.html', icone: '🎯', titre: 'Cadran opératoire — Calcul mental',
    desc: "Calcul mental avec un vrai cadran animé, et l'option « masquer l'opération » pour muscler ta mémoire.",
    couleur: '#06b6d4'
  },
  {
    href: 'jeu-es-est.html', icone: '🔬', titre: 'Défi ES & EST',
    desc: 'Éducation Sociale et Éducation Scientifique et Technologique réunies dans un seul jeu à plusieurs types de questions.',
    couleur: '#10b981'
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
