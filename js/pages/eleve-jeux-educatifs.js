// Page pages/eleve/jeux-educatifs.html
// "Jeux éducatifs" = les activités à palier (azovi/devi/ogan/axosu) de la
// classe de l'élève, présentées séance par séance — voir la même logique de
// paliers dans js/pages/eleve-seance.js (etat_paliers_seance) et
// js/pages/eleve-tableau-de-bord.js (niveau_agilite_actuel). Cette page ne
// duplique pas le moteur de jeu : elle liste simplement, pour chaque palier,
// les séances publiées de la classe qui contiennent au moins un bloc de ce
// palier, avec un lien direct vers la séance (pages/eleve/seance.html), où
// la section "🎯 Paliers de cette séance" prend le relais.
//
// Réutilise les classes existantes .grille-paliers-eleve/.palier-card-eleve
// (déjà définies dans css/style-public.css pour le formatage gratuit) :
// cette page reste donc lisible même hors du look premium — voir
// css/theme-premium-eleve.css pour son habillage renforcé quand le thème
// premium est actif.

let profilJeux = null;

const LIBELLES_PALIER_JEUX = {
  azovi: { icone: '🌱', nom: 'Azɔ̀ví', couleur: '#2ECC71', desc: 'Niveau débutant' },
  devi:  { icone: '🪘', nom: 'Dèví', couleur: '#3498DB', desc: 'Niveau intermédiaire' },
  ogan:  { icone: '🦁', nom: 'Ògán', couleur: '#E67E22', desc: 'Niveau avancé' },
  axosu: { icone: '👑', nom: 'Axɔ́sú', couleur: '#9B59B6', desc: 'Niveau expert' }
};

(async function () {
  profilJeux = await requireRole('eleve');
  if (!profilJeux) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilJeux.id, badgeHtml: `🟢 ${echapperJeux(profilJeux.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await chargerJeuxEducatifs();
})();

async function chargerJeuxEducatifs() {
  const conteneur = document.getElementById('contenu');
  const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilJeux.id).single();
  if (!fiche?.classe_id) {
    conteneur.innerHTML = '<p style="text-align:center;color:var(--text-gris)">Aucune classe ne t\'est encore associée — demande à un adulte de vérifier ton inscription.</p>';
    return;
  }

  const { data: niveauActuel } = await supabaseClient.rpc('niveau_agilite_actuel', { p_eleve_id: profilJeux.id });

  // Séances publiées de la classe contenant au moins un bloc à palier —
  // même cheminement en 3 étapes (noeuds → SA → séances) que
  // js/pages/eleve-tableau-de-bord.js pour calculer la progression.
  const { data: noeudsClasse } = await supabaseClient.from('noeuds_parcours').select('id').eq('classe_id', fiche.classe_id);
  const idsNoeuds = (noeudsClasse || []).map(n => n.id);
  const { data: saClasse } = idsNoeuds.length ? await supabaseClient.from('sa').select('id').in('noeud_id', idsNoeuds) : { data: [] };
  const idsSA = (saClasse || []).map(s => s.id);
  const { data: seancesClasse } = idsSA.length
    ? await supabaseClient.from('seances').select('id, titre, titre_contenu, discipline').eq('statut', 'publie').in('sa_id', idsSA)
    : { data: [] };
  const seancesParId = {};
  (seancesClasse || []).forEach(s => { seancesParId[s.id] = s; });
  const idsSeances = Object.keys(seancesParId).map(Number);

  const { data: blocsPalier } = idsSeances.length
    ? await supabaseClient.from('blocs_seance').select('seance_id, palier').in('seance_id', idsSeances).not('palier', 'is', null)
    : { data: [] };

  // Regroupe par palier, sans doublon de séance (une séance peut avoir
  // plusieurs blocs du même palier).
  const seancesParPalier = {};
  (blocsPalier || []).forEach(b => {
    if (!seancesParId[b.seance_id]) return;
    const liste = (seancesParPalier[b.palier] ??= []);
    if (!liste.some(s => s.id === b.seance_id)) liste.push(seancesParId[b.seance_id]);
  });

  const aDuContenu = Object.values(seancesParPalier).some(l => l.length);

  conteneur.innerHTML = `
    <div class="carte-bienvenue">
      <h1 style="margin:0">🎮 Jeux éducatifs</h1>
      <p>Relève des défis à ton rythme, palier après palier — ${niveauActuel ? `ton niveau actuel : <strong>${LIBELLES_PALIER_JEUX[niveauActuel]?.nom || niveauActuel}</strong>` : "commence par le niveau Azɔ̀ví."}</p>
    </div>

    ${aDuContenu ? Object.entries(LIBELLES_PALIER_JEUX).map(([code, info]) => {
      const seances = seancesParPalier[code] || [];
      if (!seances.length) return '';
      const estNiveauActuel = niveauActuel === code;
      return `
        <div class="section-title-eleve" style="display:flex;align-items:center;gap:8px">
          ${info.icone} ${info.nom} <span style="font-size:12px;font-weight:600;color:var(--text-gris)">— ${info.desc}${estNiveauActuel ? ' · Ton niveau actuel' : ''}</span>
        </div>
        <div class="grille-paliers-eleve" style="margin-bottom:24px">
          ${seances.map(s => `
            <div class="palier-card-eleve" style="border-top-color:${info.couleur};text-align:left">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div style="font-weight:800">${echapperJeux(s.titre_contenu || s.titre)}</div>
                  ${s.discipline ? `<div style="font-size:11px;color:var(--text-gris)">${echapperJeux(s.discipline)}</div>` : ''}
                </div>
                <div class="palier-icon-eleve" style="margin:0;font-size:1.4rem">${info.icone}</div>
              </div>
              <a href="seance.html?id=${s.id}" class="btn-palier-eleve" style="background:${info.couleur}">🎮 Jouer</a>
            </div>`).join('')}
        </div>`;
    }).join('') : `<p style="color:var(--text-gris)">Aucune activité à palier n'est encore disponible pour ta classe — reviens plus tard !</p>`}
  `;
}

function echapperJeux(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
