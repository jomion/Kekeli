// Page de retour après un paiement (pages/formations/app/paiement.html?paiement=ID&formation=ID).
// FedaPay y renvoie l'apprenant ; KkiaPay aussi, après le widget. On demande
// au serveur de VÉRIFIER le paiement auprès du prestataire (jamais d'après
// l'adresse de la page), en réessayant pendant ~30 secondes s'il est encore
// en attente de confirmation.

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('apprentissage');
  const main = document.getElementById('fkContenu');
  const paiementId = Number(fkParam('paiement')) || 0;
  const formationId = Number(fkParam('formation')) || 0;
  const transactionId = fkParam('transaction') || fkParam('transaction_id') || undefined;
  const urlFormation = id => `${FK_BASE}app/formation.html?id=${id}`;

  const cadre = contenu => {
    main.innerHTML = `<div class="fk-page"><div class="fk-container" style="max-width:560px">
      <div class="fk-carte fk-paiement-resultat">${contenu}</div></div></div>`;
  };

  if (!paiementId) {
    cadre(`<span class="fk-vide-icone">❓</span><h1>Paiement introuvable</h1>
      <p>Aucun paiement n'est indiqué dans l'adresse de cette page.</p>
      <a class="fk-btn fk-btn-primary" href="${FK_BASE}app/tableau-de-bord.html">Mon apprentissage</a>`);
    return;
  }

  cadre(`<span class="fk-vide-icone" aria-hidden="true">⏳</span><h1>Vérification du paiement…</h1>
    <p data-msg>Nous confirmons votre paiement auprès du prestataire. Ne fermez pas cette page.</p>`);

  let res = null, erreur = null;
  const debut = Date.now();
  while (Date.now() - debut < 30000) {
    try {
      res = await fkPaiementAppel({ action: 'verifier', paiementId, transactionId });
      erreur = null;
      if (res.statut !== 'en_attente') break;
    } catch (e) { erreur = e; }
    const msg = main.querySelector('[data-msg]');
    if (msg) msg.textContent = 'Le paiement est en cours de confirmation (cela peut prendre quelques secondes avec Mobile Money)…';
    await new Promise(r => setTimeout(r, 4000));
  }
  const fid = (res && res.formationId) || formationId;

  if (res && res.statut === 'reussi') {
    cadre(`<span class="fk-vide-icone" aria-hidden="true">🎉</span><h1>Paiement confirmé !</h1>
      <p>Merci ! Votre accès à la formation est ouvert.</p>
      <a class="fk-btn fk-btn-primary" id="btnCommencer" href="${urlFormation(fid)}">▶ Commencer la formation</a>`);
    return;
  }
  if (res && ['echoue', 'annule', 'rembourse'].includes(res.statut)) {
    cadre(`<span class="fk-vide-icone" aria-hidden="true">❌</span><h1>${res.statut === 'annule' ? 'Paiement annulé' : res.statut === 'rembourse' ? 'Paiement remboursé' : 'Paiement non abouti'}</h1>
      <p>Aucun accès n'a été ouvert. Si votre compte a été débité, contactez-nous en indiquant la référence <b>#${paiementId}</b>.</p>
      ${fid ? `<a class="fk-btn fk-btn-primary" href="${FK_BASE}formation.html?id=${fid}">Réessayer</a>` : ''}`);
    return;
  }
  cadre(`<span class="fk-vide-icone" aria-hidden="true">🕒</span><h1>Paiement en attente</h1>
    <p>${erreur ? fkEchapper(erreur.message) + '<br>' : ''}Votre paiement n'est pas encore confirmé. Si vous avez validé l'opération sur votre téléphone, patientez une minute puis actualisez cette page : l'accès s'ouvrira automatiquement dès la confirmation.</p>
    <p style="font-size:13px;color:var(--f-muted)">Référence : #${paiementId}</p>
    <button class="fk-btn fk-btn-primary" onclick="location.reload()">🔄 Vérifier à nouveau</button>
    <a class="fk-btn fk-btn-ghost" href="${FK_BASE}app/tableau-de-bord.html">Mon apprentissage</a>`);
})();
