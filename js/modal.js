// ============================================================
// Système de modales KEKELI — formulaires dynamiques réutilisables
// Remplace les popups natifs prompt()/confirm() par de vraies boîtes
// de dialogue en HTML, stylées et plus flexibles (plusieurs champs,
// select, textarea...).
// ============================================================

// ouvrirModal({ titre, champs, texteValider, onValider })
// champs: [{ nom, label, type: 'text'|'textarea'|'select'|'number', options, requis, valeur, placeholder }]
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

  overlay.querySelector('#formModalDynamique').addEventListener('submit', (e) => {
    e.preventDefault();
    const valeurs = {};
    champs.forEach(c => { valeurs[c.nom] = overlay.querySelector(`[name="${c.nom}"]`).value; });
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
