// Page pages/eleve/favoris.html
// Nouvelle page "Favoris" (19 septembre 2026, demande "Active les pages mes
// progrès et favoris... favoris affiche les matières qui sont marqué de
// coeur" + clarification AskUserQuestion, réponse libre de l'utilisateur :
// "le coeur apparait sur les titre de séance") — réutilise TEL QUEL le
// mécanisme d'épinglage déjà existant (table seances_epinglees, coeur
// cliquable déjà présent sur chaque carte séance du thème premium, voir
// js/pages/eleve-matiere.js#attacherEpinglageMat) : cette page n'ajoute NI
// nouvelle table NI nouveau bouton de coeur ailleurs — elle liste seulement
// les séances déjà épinglées par l'élève, groupées par matière, avec le même
// coeur pour désépingler directement depuis ici.

let profilFavEleve = null;
let seancesFavorites = [];

(async function () {
  profilFavEleve = await requireRole('eleve');
  if (!profilFavEleve) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilFavEleve.id, badgeHtml: `🟢 ${echapperFavEleve(profilFavEleve.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });

  await chargerFavoris();
  rendreFavoris();
})();

async function chargerFavoris() {
  const [{ data: pins }, { data: terminees }] = await Promise.all([
    supabaseClient.from('seances_epinglees')
      .select('seance_id, seances(id, titre, titre_contenu, discipline, statut, sa(noeud_id, noeuds_parcours(champ_formation_id, champs_formation(nom, code))))')
      .eq('utilisateur_id', profilFavEleve.id),
    supabaseClient.from('seances_terminees').select('seance_id').eq('eleve_id', profilFavEleve.id),
  ]);
  const idsTerminees = new Set((terminees || []).map(t => t.seance_id));
  seancesFavorites = (pins || [])
    .map(p => p.seances)
    // Défensif : une séance dépubliée depuis (ou une ligne orpheline) ne
    // doit jamais s'afficher ici — l'élève ne doit voir que du contenu
    // toujours accessible, comme partout ailleurs sur le site.
    .filter(s => s && s.statut === 'publie')
    .map(s => ({
      id: s.id,
      titre: s.titre_contenu || s.titre,
      discipline: s.discipline,
      champNom: s.sa?.noeuds_parcours?.champs_formation?.nom || 'Autre',
      termine: idsTerminees.has(s.id),
    }));
}

function rendreFavoris() {
  const conteneur = document.getElementById('contenu');
  if (!seancesFavorites.length) {
    conteneur.innerHTML = `
      <div class="carte-bienvenue">
        <h1>❤️ Favoris</h1>
        <p>Tu n'as encore épinglé aucune séance.</p>
      </div>
      <p style="color:var(--text-gris)">Appuie sur le ❤️ affiché sur une séance (dans « Mes matières ») pour l'ajouter ici.</p>
    `;
    return;
  }

  const parMatiere = {};
  seancesFavorites.forEach(s => { (parMatiere[s.champNom] ??= []).push(s); });

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1>❤️ Favoris</h1>
      <p>${seancesFavorites.length} séance${seancesFavorites.length > 1 ? 's' : ''} épinglée${seancesFavorites.length > 1 ? 's' : ''}.</p>
    </div>
    ${Object.entries(parMatiere).map(([champ, liste]) => `
      <div class="section-title-eleve">${echapperFavEleve(champ)}</div>
      <div class="fav-liste-seances">
        ${liste.map(s => `
          <div class="session-card-eleve">
            <div class="session-icon-eleve">📌</div>
            <div class="session-content-eleve">
              <div class="session-title-eleve">${echapperFavEleve(s.titre)}</div>
              ${s.discipline ? `<div style="font-size:12px;color:var(--text-gris);font-weight:600;margin-top:2px">${echapperFavEleve(s.discipline)}</div>` : ''}
            </div>
            <button type="button" class="fav-btn-coeur" data-desepingler-fav="${s.id}" title="Retirer des favoris">${typeof iconePrem === 'function' ? iconePrem('coeur', 18) : '❤️'}</button>
            <div><a class="btn-palier-eleve" style="background:${s.termine ? '#22A559' : 'var(--bleu-kekeli)'}" href="seance.html?id=${s.id}">${s.termine ? 'Revoir' : 'Continuer'}</a></div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;

  document.querySelectorAll('[data-desepingler-fav]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.desepinglerFav, 10);
      btn.disabled = true;
      await supabaseClient.from('seances_epinglees').delete().eq('utilisateur_id', profilFavEleve.id).eq('seance_id', id);
      seancesFavorites = seancesFavorites.filter(s => s.id !== id);
      rendreFavoris();
    });
  });
}

function echapperFavEleve(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
