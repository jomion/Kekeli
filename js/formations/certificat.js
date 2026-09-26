// Certificat de réussite (pages/formations/certificat.html?code=KEK-XXXX-XXXX),
// 27 septembre 2026. Page PUBLIQUE : n'importe qui peut vérifier un certificat
// avec son code (formation_verifier_certificat). L'apprenant peut l'imprimer
// ou l'enregistrer en PDF. Si le formateur est Formateur Pro ou Premium, son
// logo, sa signature, son signataire et sa couleur personnalisent le certificat.
// ?apercu=1 : aperçu du certificat personnalisé pour le formateur connecté.

(async function () {
  await fkInitPage('catalogue');
  const main = document.getElementById('fkContenu');
  const e = fkEchapper;
  const code = (fkParam('code') || '').trim().toUpperCase();
  let c = null;

  if (fkParam('apercu')) {
    const s = await fkSession();
    if (!s || !s.formateur) { main.innerHTML = '<div class="fk-page"><div class="fk-container"><p class="fk-alerte fk-alerte-erreur">Connectez-vous avec votre compte formateur pour voir l\'aperçu.</p></div></div>'; return; }
    const { data: fo } = await supabaseClient.from('formateurs').select('nom_affiche, certificat_logo_url, certificat_signature_url, certificat_signataire, certificat_couleur').eq('id', s.formateur.id).maybeSingle();
    const { data: niv } = await supabaseClient.rpc('formation_niveau_formateur', { p_id: s.formateur.id });
    c = { ok: true, apercu: true, code: 'KEK-APER-CU00', nom: 'Nom de l\'apprenant', formation: 'Titre de votre formation', formateur: fo?.nom_affiche || s.formateur.nom_affiche, date: new Date().toISOString(),
      perso: Number(niv) >= 2 && fo ? { logo: fo.certificat_logo_url, signature: fo.certificat_signature_url, signataire: fo.certificat_signataire, couleur: fo.certificat_couleur } : null };
  } else if (code) {
    const { data, error } = await supabaseClient.rpc('formation_verifier_certificat', { p_code: code });
    if (!error) c = data;
  }

  if (!c || !c.ok) {
    main.innerHTML = `<div class="fk-page"><div class="fk-container" style="max-width:560px">
      <h1 class="fk-titre-page">🎓 Vérifier un certificat</h1>
      ${code ? `<p class="fk-alerte fk-alerte-erreur">Aucun certificat ne correspond au code <b>${e(code)}</b>.</p>` : '<p class="fk-sous-titre">Saisissez le code inscrit en bas du certificat.</p>'}
      <form class="fk-carte" method="get"><label class="fk-champ"><span>Code du certificat</span><input type="text" name="code" required placeholder="KEK-XXXX-XXXX" value="${e(code)}" style="text-transform:uppercase"></label>
        <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" type="submit">Vérifier</button></div></form>
    </div></div>`;
    return;
  }

  const p = c.perso || {};
  const couleur = /^#[0-9a-f]{6}$/i.test(p.couleur || '') ? p.couleur : '#1d6b3c';
  const img = (url, alt) => url && /^https:\/\//.test(url) ? `<img src="${e(url)}" alt="${alt}">` : '';
  const lienVerif = `${location.origin}${location.pathname}?code=${encodeURIComponent(c.code)}`;
  document.body.classList.add('fk-impression-cert');
  main.innerHTML = `<div class="fk-page"><div class="fk-container">
    <div class="fk-cert-verif fk-no-print">
      ${c.apercu ? `<p class="fk-alerte fk-alerte-info">👁️ Aperçu : voici comment vos apprenants verront leur certificat.${c.perso ? '' : ' La personnalisation (logo, signature, couleur) est incluse avec Formateur Pro et Premium.'}</p>`
        : `<p class="fk-alerte fk-alerte-info">✅ Certificat authentique, délivré par KEKELI Formation le ${fkDate(c.date)}.</p>`}
      <div class="fk-actions-form" style="justify-content:flex-start">
        <button type="button" class="fk-btn fk-btn-primary" data-imprimer>🖨️ Imprimer / Enregistrer en PDF</button>
        ${c.apercu ? '' : `<button type="button" class="fk-btn fk-btn-ghost" data-copier>🔗 Copier le lien de vérification</button>
        <a class="fk-btn fk-btn-ghost" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(lienVerif)}">in Partager sur LinkedIn</a>
        <a class="fk-btn fk-btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`🎓 J'ai obtenu mon certificat « ${c.formation} » sur KEKELI Formation ! ${lienVerif}`)}">💬 WhatsApp</a>`}
      </div>
    </div>
    <div class="fk-certificat" style="--cert-couleur:${couleur}">
      <div class="cert-logos"><img src="${FK_RACINE_LOGO()}" alt="KEKELI">${img(p.logo, 'Logo du formateur')}</div>
      <p class="cert-titre">Certificat de réussite</p>
      <p style="margin:0">Ce certificat est décerné à</p>
      <div><span class="cert-nom">${e(c.nom)}</span></div>
      <p style="margin:0">pour avoir suivi avec succès la formation</p>
      <p class="cert-formation">« ${e(c.formation)} »</p>
      <p style="margin:0;font-size:15px">proposée par <b>${e(c.formateur || '')}</b> sur KEKELI Formation${c.duree_minutes ? ` — durée : ${Math.max(1, Math.round(c.duree_minutes / 60))} h` : ''}</p>
      <div class="cert-pied">
        <div class="cert-code">Délivré le ${fkDate(c.date)}<br>Code : <b>${e(c.code)}</b><br><small>Vérifiable sur ${e(location.host || 'kekeli')}</small></div>
        <div class="cert-signature">${img(p.signature, 'Signature')}${e(p.signataire || c.formateur || 'Le formateur')}</div>
      </div>
    </div>
  </div></div>`;
  main.querySelector('[data-imprimer]').addEventListener('click', () => window.print());
  const cp = main.querySelector('[data-copier]');
  if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(lienVerif); fkToast('Lien copié !', 'succes'); } catch (_e) { fkToast(lienVerif); } });
})();

function FK_RACINE_LOGO() { return `${typeof RACINE_SITE === 'string' ? RACINE_SITE : '../../'}assets/logo/logo.png`; }
