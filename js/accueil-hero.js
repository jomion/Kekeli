// Section "hero" (grand bandeau du haut) de l'accueil publique (index.html),
// rendue dynamique le 4 septembre 2026 à la demande du porteur du projet :
// au lieu d'un texte figé dans le code, le super admin peut créer, modifier,
// supprimer et réordonner librement des blocs (titre + texte + image ou
// emoji) depuis pages/admin/section-accueil.html (table blocs_accueil_hero).
//
// Étendu le 5 septembre 2026 : chaque bloc a désormais une taille d'image
// (petite/moyenne/grande, ~30/40/50% de l'espace du héro sur PC — 100% sur
// mobile, voir css/style-public.css) et une position (gauche/droite/centre),
// et un réglage global (table parametres_accueil_hero, une seule ligne)
// choisit la disposition d'ensemble quand plusieurs blocs sont actifs :
//   - carrousel (comportement d'origine, inchangé) : un seul bloc affiché à
//     la fois dans #heroSlideUnique, rotation automatique + points cliquables.
//   - grille / sections_compactes : tous les blocs actifs affichés en même
//     temps dans #heroBlocsMultiples, sans défilement pour un nombre
//     raisonnable de blocs (voir le commentaire CSS correspondant).
//
// Fonctionnement (fallback inchangé) :
//   - index.html garde un contenu STATIQUE de secours dans le HTML (le texte
//     actuel) : si la requête échoue, si aucun bloc n'est configuré, ou si un
//     champ inattendu manque, ce contenu reste affiché tel quel — aucune
//     régression possible.
//   - Le bouton "Accéder à mon espace" / "Continuer mon espace" (#lienAccederEspace)
//     N'EST PAS un champ de bloc : il reste un élément fixe de index.html, en
//     dehors de la zone remplacée par ce script, pour conserver simplement son
//     comportement dépendant de la session (voir le script inline de
//     index.html) quel que soit le bloc ou la disposition affichés.

async function initAccueilHero() {
  const heroSection = document.getElementById('heroSection');
  const slideUnique = document.getElementById('heroSlideUnique');
  const blocsMultiples = document.getElementById('heroBlocsMultiples');
  const conteneurTexte = document.getElementById('heroTexteDynamique');
  const conteneurImage = document.getElementById('heroImageDynamique');
  const conteneurPoints = document.getElementById('heroPoints');
  if (!heroSection || !slideUnique || !conteneurTexte || !conteneurImage || typeof supabaseClient === 'undefined') return;

  let blocs = [];
  let disposition = 'carrousel';
  try {
    const [{ data: donneesBlocs, error: erreurBlocs }, { data: reglage }] = await Promise.all([
      supabaseClient
        .from('blocs_accueil_hero')
        .select('id, titre, texte, image_url, emoji, taille_image, position_image')
        .eq('actif', true)
        .order('ordre', { ascending: true }),
      supabaseClient.from('parametres_accueil_hero').select('disposition').eq('id', 1).maybeSingle(),
    ]);
    if (erreurBlocs) throw erreurBlocs;
    blocs = donneesBlocs || [];
    if (reglage && reglage.disposition) disposition = reglage.disposition;
  } catch (_e) {
    return; // panne réseau/API -> le contenu statique de secours du HTML reste affiché
  }
  if (!blocs.length) return; // aucun bloc configuré -> idem

  function echapperHero(v) {
    return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (disposition === 'grille' || disposition === 'sections_compactes') {
    afficherDispositionMultiple(disposition);
  } else {
    afficherCarrousel();
  }

  // ===== Disposition "Carrousel" (comportement d'origine) =====
  function afficherCarrousel() {
    if (blocsMultiples) blocsMultiples.style.display = 'none';
    slideUnique.style.display = 'contents';

    let index = 0;
    let minuteur = null;

    function afficher(i) {
      const b = blocs[i];
      conteneurTexte.innerHTML = `<h1>${echapperHero(b.titre)}</h1>${b.texte ? `<p>${echapperHero(b.texte)}</p>` : ''}`;
      conteneurImage.className = `hero-image taille-${b.taille_image || 'moyenne'}${b.image_url ? ' avec-photo' : ''}`;
      conteneurImage.innerHTML = b.image_url
        ? `<img src="${echapperHero(b.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`
        : echapperHero(b.emoji || '☀️');
      heroSection.classList.remove('position-gauche', 'position-droite', 'position-centre');
      heroSection.classList.add(`position-${b.position_image || 'droite'}`);

      if (conteneurPoints) {
        if (blocs.length > 1) {
          conteneurPoints.innerHTML = blocs.map((_, j) =>
            `<button type="button" class="hero-point${j === i ? ' actif' : ''}" data-point="${j}" aria-label="Diapositive ${j + 1}"></button>`
          ).join('');
          conteneurPoints.querySelectorAll('[data-point]').forEach(btn => {
            btn.addEventListener('click', () => {
              index = parseInt(btn.dataset.point, 10);
              afficher(index);
              relancerMinuteur();
            });
          });
        } else {
          conteneurPoints.innerHTML = '';
        }
      }
    }

    function relancerMinuteur() {
      if (minuteur) clearInterval(minuteur);
      if (blocs.length > 1) {
        minuteur = setInterval(() => {
          index = (index + 1) % blocs.length;
          afficher(index);
        }, 6000);
      }
    }

    afficher(0);
    relancerMinuteur();
  }

  // ===== Dispositions "Grille" et "Sections compactes" (tous les blocs
  // actifs affichés en même temps, sans carrousel) =====
  function afficherDispositionMultiple(mode) {
    if (!blocsMultiples) { afficherCarrousel(); return; } // page qui n'a pas ce conteneur -> repli sûr
    slideUnique.style.display = 'none';
    heroSection.classList.remove('position-gauche', 'position-droite', 'position-centre');
    blocsMultiples.style.display = '';
    blocsMultiples.className = `hero-blocs-multiples mode-${mode === 'grille' ? 'grille' : 'sections'}`;

    blocsMultiples.innerHTML = blocs.map(b => {
      const taille = b.taille_image || 'moyenne';
      const position = b.position_image || 'droite';
      const imageHtml = b.image_url
        ? `<img src="${echapperHero(b.image_url)}" alt="">`
        : echapperHero(b.emoji || '☀️');

      if (mode === 'grille') {
        return `
          <div class="hero-carte-multi taille-${taille} position-${position}">
            <div class="hero-carte-multi-image">${imageHtml}</div>
            <div>
              <h3>${echapperHero(b.titre)}</h3>
              ${b.texte ? `<p>${echapperHero(b.texte)}</p>` : ''}
            </div>
          </div>`;
      }
      // sections_compactes : lignes horizontales serrées, "centre" retombe
      // sur "droite" pour rester compact (voir commentaire CSS).
      const positionCompacte = position === 'centre' ? 'droite' : position;
      return `
        <div class="hero-section-compacte taille-${taille} position-${positionCompacte}">
          <div class="hero-section-compacte-image">${imageHtml}</div>
          <div class="hero-section-compacte-texte">
            <h3>${echapperHero(b.titre)}</h3>
            ${b.texte ? `<p>${echapperHero(b.texte)}</p>` : ''}
          </div>
        </div>`;
    }).join('');
  }
}
