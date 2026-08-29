// ============================================================
// Système de modales KEKELI — formulaires dynamiques réutilisables
// Remplace les popups natifs prompt()/confirm() par de vraies boîtes
// de dialogue en HTML, stylées et plus flexibles (plusieurs champs,
// select, textarea...).
// ============================================================

// ouvrirModal({ titre, champs, texteValider, onValider })
// champs: [{ nom, label, type: 'text'|'textarea'|'select'|'number'|'checkboxes', options, requis, valeur, placeholder,
//            dependDe, optionsSelonDependance, toutCocherLabel }]
// Un select peut dépendre d'un autre (cascade, ex. Commune selon Département) :
// dependDe = nom du champ dont il dépend, optionsSelonDependance = fonction
// (valeurDuChampDontIlDepend) => [{valeur, label}, ...] appelée à chaque changement.
// Un champ 'checkboxes' (ex. choisir des destinataires) : options = [{valeur, label}, ...],
// valeur = tableau des valeurs cochées par défaut, toutCocherLabel (optionnel) affiche
// une case "Tout cocher" au-dessus de la liste. onValider reçoit un TABLEAU pour ce champ.
function ouvrirModal({ titre, champs, texteValider = 'Enregistrer', onValider }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite">
      <h3>${titre}</h3>
      <form id="formModalDynamique">
        ${champs.map(champHtmlModal).join('')}
        <div class="modal-actions">
          <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
          <button type="submit" class="btn btn-primaire">${texteValider}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  document.addEventListener('keydown', function echap(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } });

  // Cascades select → select (ex. Commune qui se recalcule selon Département).
  champs.filter(c => c.dependDe && c.optionsSelonDependance).forEach(c => {
    const champDependant = overlay.querySelector(`[name="${c.nom}"]`);
    const champDont = overlay.querySelector(`[name="${c.dependDe}"]`);
    if (!champDependant || !champDont) return;
    champDont.addEventListener('change', () => {
      const options = c.optionsSelonDependance(champDont.value) || [];
      champDependant.innerHTML = options.map(o => `<option value="${o.valeur}">${o.label}</option>`).join('');
      // Redéclenche un "change" sur le champ qu'on vient de recalculer, pour
      // qu'une éventuelle cascade à un niveau de plus (ex. Commune →
      // Arrondissement quand c'est Département qui vient de changer) se
      // remette aussi à jour — sinon elle garde ses anciennes options.
      champDependant.dispatchEvent(new Event('change'));
    });
  });

  // Case "Tout cocher" de chaque champ checkboxes : coche/décoche toute la
  // liste, et se met elle-même à jour si l'utilisateur coche/décoche les
  // cases une à une (cochée seulement quand tout l'est déjà).
  champs.filter(c => c.type === 'checkboxes' && c.toutCocherLabel).forEach(c => {
    const conteneur = overlay.querySelector(`[data-liste-checkboxes="${c.nom}"]`);
    const toutCocher = overlay.querySelector(`[data-tout-cocher="${c.nom}"]`);
    if (!conteneur || !toutCocher) return;
    const cases = () => Array.from(conteneur.querySelectorAll(`input[name="${c.nom}"]`));
    const majToutCocher = () => { toutCocher.checked = cases().every(ch => ch.checked); };
    majToutCocher();
    toutCocher.addEventListener('change', () => { cases().forEach(ch => { ch.checked = toutCocher.checked; }); });
    cases().forEach(ch => ch.addEventListener('change', majToutCocher));
  });

  overlay.querySelector('#formModalDynamique').addEventListener('submit', (e) => {
    e.preventDefault();
    const valeurs = {};
    champs.forEach(c => {
      valeurs[c.nom] = c.type === 'checkboxes'
        ? Array.from(overlay.querySelectorAll(`input[name="${c.nom}"]:checked`)).map(el => el.value)
        : overlay.querySelector(`[name="${c.nom}"]`).value;
    });
    fermer();
    onValider(valeurs);
  });

  const premierChamp = overlay.querySelector('input, select, textarea');
  if (premierChamp) premierChamp.focus();
}

function champHtmlModal(c) {
  const requis = c.requis !== false ? 'required' : '';
  if (c.type === 'select') {
    return `<label class="champ-modal">${c.label}
      <select name="${c.nom}" ${requis}>
        ${c.options.map(o => `<option value="${o.valeur}" ${o.valeur === c.valeur ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select></label>`;
  }
  if (c.type === 'textarea') {
    return `<label class="champ-modal">${c.label}
      <textarea name="${c.nom}" ${requis} placeholder="${c.placeholder || ''}">${c.valeur || ''}</textarea></label>`;
  }
  if (c.type === 'checkboxes') {
    const valeursCochees = (Array.isArray(c.valeur) ? c.valeur : []).map(String);
    return `<div class="champ-modal champ-modal-checkboxes">
      <span class="champ-modal-checkboxes-titre">${c.label}</span>
      ${c.toutCocherLabel ? `<label class="checkbox-modal checkbox-modal-tout"><input type="checkbox" data-tout-cocher="${c.nom}"> ${c.toutCocherLabel}</label>` : ''}
      <div class="liste-checkboxes-modal" data-liste-checkboxes="${c.nom}">
        ${(c.options || []).length ? c.options.map(o => `<label class="checkbox-modal"><input type="checkbox" name="${c.nom}" value="${o.valeur}" ${valeursCochees.includes(String(o.valeur)) ? 'checked' : ''}> ${o.label}</label>`).join('') : '<p class="note-future">Aucune option disponible.</p>'}
      </div>
    </div>`;
  }
  return `<label class="champ-modal">${c.label}
    <input type="${c.type || 'text'}" name="${c.nom}" value="${c.valeur ?? ''}" ${requis} placeholder="${c.placeholder || ''}"></label>`;
}

// confirmerAction(message, onConfirme) — remplace confirm()
function confirmerAction(message, onConfirme) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-boite modal-confirmation">
      <p>${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-discret" data-fermer-modal>Annuler</button>
        <button type="button" class="btn btn-danger" data-confirmer-modal>Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-fermer-modal]').addEventListener('click', fermer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  overlay.querySelector('[data-confirmer-modal]').addEventListener('click', () => { fermer(); onConfirme(); });
}
