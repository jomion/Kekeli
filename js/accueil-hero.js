// Section "hero" (grand bandeau du haut) de l'accueil publique (index.html),
// rendue dynamique le 4 septembre 2026 à la demande du porteur du projet :
// au lieu d'un texte figé dans le code, le super admin peut créer, modifier,
// supprimer et réordonner librement des blocs (titre + texte + image ou
// emoji) depuis pages/admin/section-accueil.html (table blocs_accueil_hero).
//
// Fonctionnement :
//   - index.html garde un contenu STATIQUE de secours dans le HTML (le texte
//     actuel) : si la requête échoue ou si aucun bloc n'est configuré, ce
//     contenu reste affiché tel quel — aucune régression possible.
//   - S'il y a au moins un bloc actif, on le remplace par un petit carrousel
//     (rotation automatique + points cliquables si plusieurs blocs).
//   - Le bouton "Accéder à mon espace" / "Continuer mon espace" (#lienAccederEspace)
//     N'EST PAS un champ de bloc : il reste un élément fixe de index.html, en
//     dehors de la zone remplacée par ce script, pour conserver simplement son
//     comportement dépendant de la session (voir le script inline de
//     index.html) quel que soit le bloc affiché.

async function initAccueilHero() {
  const conteneurTexte = document.getElementById('heroTexteDynamique');
  const conteneurImage = document.getElementById('heroImageDynamique');
  const conteneurPoints = document.getElementById('heroPoints');
  if (!conteneurTexte || !conteneurImage || typeof supabaseClient === 'undefined') return;

  let blocs = [];
  try {
    const { data, error } = await supabaseClient
      .from('blocs_accueil_hero')
      .select('id, titre, texte, image_url, emoji')
      .eq('actif', true)
      .order('ordre', { ascending: true });
    if (error) throw error;
    blocs = data || [];
  } catch (_e) {
    return; // panne réseau/API -> le contenu statique de secours du HTML reste affiché
  }
  if (!blocs.length) return; // aucun bloc configuré -> idem

  function echapperHero(v) {
    return (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let index = 0;
  let minuteur = null;

  function afficher(i) {
    const b = blocs[i];
    conteneurTexte.innerHTML = `<h1>${echapperHero(b.titre)}</h1>${b.texte ? `<p>${echapperHero(b.texte)}</p>` : ''}`;
    conteneurImage.classList.toggle('avec-photo', !!b.image_url);
    conteneurImage.innerHTML = b.image_url
      ? `<img src="${echapperHero(b.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : echapperHero(b.emoji || '☀️');

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
