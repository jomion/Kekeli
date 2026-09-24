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
//
// 24 septembre 2026 (généralisation) : le sélecteur de classe + l'iframe +
// la sauvegarde cloud ont été déplacés dans le module partagé js/cahier-
// ecriture-partage.js (réutilisé par tous les rôles) — cette page ne garde
// plus que ce qui est spécifique à l'élève : le rôle attendu, et le lookup
// de sa VRAIE classe (eleves.classe_id) pour proposer un choix par défaut
// pertinent (étoile "★ ma classe"). Pour l'élève, la sauvegarde cloud est un
// service Premium (cahier_ecriture_cloud) — voir le module partagé pour le
// détail (le vrai contrôle d'accès est fait côté serveur, jamais ici).

let profilCahier = null;

(async function () {
  profilCahier = await requireRole('eleve');
  if (!profilCahier) return;
  await initEnteteNavigation({
    role: 'eleve', utilisateurId: profilCahier.id, badgeHtml: `🟢 ${echapperCahier(profilCahier.prenom)}`,
    liens: liensAvecPrefixe('eleve', '')
  });
  await initialiserCahierEcriturePartage(profilCahier, {
    estEleve: true,
    recupererClasseReelle: async () => {
      try {
        const { data: fiche } = await supabaseClient.from('eleves').select('classe_id').eq('id', profilCahier.id).maybeSingle();
        if (!fiche?.classe_id) return '';
        const { data: classe } = await supabaseClient.from('classes').select('nom').eq('id', fiche.classe_id).maybeSingle();
        return classe?.nom || '';
      } catch (_e) { return ''; }
    },
  });
})();

function echapperCahier(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
