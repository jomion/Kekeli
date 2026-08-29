// ============================================================
// Bulle d'aperçu au survol d'une carte — réutilisée sur les tableaux de
// bord et les pages "matières" pour déployer automatiquement le contenu
// important d'une carte (ex: survoler "Mes matières" montre la liste des
// matières, survoler une classe montre ses élèves...).
//
// Usage : ajouter la classe "carte-apercu-hover" sur l'élément parent
// (position relative — déjà géré par la classe), puis insérer le HTML
// retourné par bulleApercuHtml() À L'INTÉRIEUR de cet élément.
// Voir .carte-apercu-hover / .bulle-apercu-hover dans css/style.css et
// css/style-public.css pour le rendu (fondu + glissement en CSS pur,
// aucun JS nécessaire pour l'ouverture/fermeture).
// ============================================================

function bulleApercuHtml(titre, items, echapper) {
  const ech = typeof echapper === 'function' ? echapper : (v) => {
    const d = document.createElement('div');
    d.textContent = v ?? '';
    return d.innerHTML;
  };
  if (!items || !items.length) return '';
  return `
    <div class="bulle-apercu-hover">
      <div class="bulle-apercu-hover-titre">${ech(titre)}</div>
      <ul>${items.map(t => `<li>${ech(t)}</li>`).join('')}</ul>
    </div>`;
}
