// Profil formateur modifiable (pages/formations/formateur/profil.html).
// Le statut de validation n'est jamais modifiable ici (protégé en base).

(async function () {
  const s = await fkExigerConnexion();
  if (!s) return;
  await fkInitPage('formateur');
  const main = document.getElementById('fkContenu');
  const fo = s.formateur;
  if (!fo || fo.statut !== 'valide') { window.location.href = `${FK_BASE}devenir-formateur.html`; return; }
  const l = fo.liens_sociaux || {};

  main.innerHTML = `
    <div class="fk-page"><div class="fk-container" style="max-width:820px">
      <a class="fk-link" href="tableau-de-bord.html">← Espace formateur</a>
      <h1 class="fk-titre-page" style="margin-top:10px">Mon profil formateur</h1>
      <p class="fk-sous-titre">Ces informations apparaissent sur votre <a class="fk-link" href="${FK_BASE}formateur.html?slug=${encodeURIComponent(fo.slug)}">profil public</a>.</p>
      <section class="fk-carte">
        <div class="fk-profil-tete">
          <div class="fk-avatar" id="avatar" style="${fo.photo_url ? `background-image:url('${fkEchapper(fo.photo_url)}')` : ''}">${fo.photo_url ? '' : fkEchapper(fo.nom_affiche[0])}</div>
          <div>
            <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer">📷 Changer la photo<input type="file" id="photo" accept="image/png,image/jpeg,image/webp" hidden></label>
            <p style="font-size:12px;color:var(--f-muted);margin:6px 0 0">PNG, JPG ou WEBP, 5 Mo maximum.</p>
          </div>
        </div>
      </section>
      <form class="fk-carte" id="formProfil">
        <label class="fk-champ"><span>Nom affiché *</span><input type="text" name="nom_affiche" required maxlength="80" value="${fkEchapper(fo.nom_affiche)}"></label>
        <label class="fk-champ"><span>Titre professionnel</span><input type="text" name="titre_professionnel" maxlength="120" value="${fkEchapper(fo.titre_professionnel || '')}"></label>
        <label class="fk-champ"><span>Domaine d'expertise</span><input type="text" name="expertise" maxlength="160" value="${fkEchapper(fo.expertise || '')}"></label>
        <label class="fk-champ"><span>Biographie *</span><textarea name="biographie" required minlength="30" maxlength="3000">${fkEchapper(fo.biographie || '')}</textarea></label>
        <label class="fk-champ"><span>Expérience</span><textarea name="experience" maxlength="3000">${fkEchapper(fo.experience || '')}</textarea></label>
        <div class="fk-grille-2">
          <label class="fk-champ"><span>Site web</span><input type="url" name="site_web" value="${fkEchapper(fo.site_web || '')}"></label>
          <label class="fk-champ"><span>LinkedIn</span><input type="url" name="linkedin" value="${fkEchapper(l.linkedin || '')}"></label>
          <label class="fk-champ"><span>Facebook</span><input type="url" name="facebook" value="${fkEchapper(l.facebook || '')}"></label>
          <label class="fk-champ"><span>YouTube</span><input type="url" name="youtube" value="${fkEchapper(l.youtube || '')}"></label>
        </div>
        <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
      </form>
      <section class="fk-carte fk-perso-cert" id="certificatPerso">
        <h2 style="margin-top:0">🎓 Certificat personnalisé ${fkBadgePro({ niveau_pro: 2, pro_fin: '2999-01-01' })}</h2>
        <div data-cert-contenu><div class="fk-chargement">…</div></div>
      </section>
    </div></div>`;

  // Certificat personnalisé (avantage Formateur Pro et Premium) : logo,
  // signature, nom du signataire et couleur, visibles sur les certificats
  // de vos apprenants tant que votre niveau est Pro ou plus.
  const zoneCert = main.querySelector('[data-cert-contenu]');
  const { data: niv } = await supabaseClient.rpc('formation_niveau_formateur', { p_id: fo.id });
  const niveau = Number(niv) || 0;
  const { data: fc } = await supabaseClient.from('formateurs').select('certificat_logo_url, certificat_signature_url, certificat_signataire, certificat_couleur').eq('id', fo.id).maybeSingle();
  const cert = fc || {};
  const envoyerImage = async (fichier, nom) => {
    const err = fkVerifierFichier(fichier, 'image');
    if (err) { fkToast(err, 'erreur'); return null; }
    const chemin = `formateurs/${fo.id}/certificat-${nom}-${Date.now()}-${fkNomFichierSur(fichier.name)}`;
    const { error } = await supabaseClient.storage.from(FK_BUCKET_PUBLIC).upload(chemin, fichier, { contentType: fichier.type });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return null; }
    return supabaseClient.storage.from(FK_BUCKET_PUBLIC).getPublicUrl(chemin).data.publicUrl;
  };
  const dessinerCert = () => {
    if (niveau < 2) {
      zoneCert.innerHTML = `<p style="margin-top:0">Ajoutez <b>votre logo</b>, <b>votre signature</b> et <b>votre couleur</b> sur les certificats de vos apprenants.</p>
        <p class="fk-verrou-txt">🔒 Inclus avec le niveau <b>Formateur Pro</b> (Pack Formateur, Pack Pro) et <b>Premium</b> (abonnement mensuel).</p>
        <a class="fk-btn fk-btn-primary fk-btn-petit" href="credits-ia.html#offres">Voir les offres</a>`;
      return;
    }
    zoneCert.innerHTML = `<p style="margin-top:0;color:var(--f-muted);font-size:14px">Ces éléments apparaissent sur les certificats de vos apprenants (image PNG ou JPG, fond transparent conseillé pour la signature).</p>
      <div class="fk-grille-2">
        <div><b>Logo</b><br>${cert.certificat_logo_url ? `<img src="${fkEchapper(cert.certificat_logo_url)}" alt="Logo">` : '<small>Aucun</small>'}<br>
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer;margin-top:6px">📷 Choisir<input type="file" data-cert-img="logo" accept="image/png,image/jpeg,image/webp" hidden></label>
          ${cert.certificat_logo_url ? '<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-cert-retirer="logo">Retirer</button>' : ''}</div>
        <div><b>Signature</b><br>${cert.certificat_signature_url ? `<img src="${fkEchapper(cert.certificat_signature_url)}" alt="Signature">` : '<small>Aucune</small>'}<br>
          <label class="fk-btn fk-btn-outline fk-btn-petit" style="cursor:pointer;margin-top:6px">✍️ Choisir<input type="file" data-cert-img="signature" accept="image/png,image/jpeg,image/webp" hidden></label>
          ${cert.certificat_signature_url ? '<button type="button" class="fk-btn fk-btn-ghost fk-btn-petit" data-cert-retirer="signature">Retirer</button>' : ''}</div>
      </div>
      <form data-cert-form style="margin-top:12px">
        <div class="fk-grille-2">
          <label class="fk-champ"><span>Nom et fonction du signataire</span><input type="text" name="signataire" maxlength="120" value="${fkEchapper(cert.certificat_signataire || '')}" placeholder="Ex. Awa Mensah, fondatrice"></label>
          <label class="fk-champ"><span>Couleur du certificat</span><input type="color" name="couleur" value="${fkEchapper(cert.certificat_couleur || '#1d6b3c')}"></label>
        </div>
        <div class="fk-actions-form"><a class="fk-btn fk-btn-ghost" href="${FK_BASE}certificat.html?apercu=1" target="_blank" rel="noopener">👁️ Aperçu</a><button class="fk-btn fk-btn-primary" type="submit">Enregistrer</button></div>
      </form>`;
    zoneCert.querySelectorAll('[data-cert-img]').forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      const url = await envoyerImage(f, inp.dataset.certImg);
      if (!url) return;
      const col = inp.dataset.certImg === 'logo' ? 'certificat_logo_url' : 'certificat_signature_url';
      const { error } = await supabaseClient.from('formateurs').update({ [col]: url }).eq('id', fo.id);
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      cert[col] = url; dessinerCert(); fkToast('Image enregistrée.', 'succes');
    }));
    zoneCert.querySelectorAll('[data-cert-retirer]').forEach(b => b.addEventListener('click', async () => {
      const col = b.dataset.certRetirer === 'logo' ? 'certificat_logo_url' : 'certificat_signature_url';
      const { error } = await supabaseClient.from('formateurs').update({ [col]: null }).eq('id', fo.id);
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      cert[col] = null; dessinerCert();
    }));
    zoneCert.querySelector('[data-cert-form]').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const couleur = String(fd.get('couleur') || '');
      const maj = { certificat_signataire: String(fd.get('signataire') || '').trim() || null, certificat_couleur: /^#[0-9a-f]{6}$/i.test(couleur) ? couleur : null };
      const { error } = await supabaseClient.from('formateurs').update(maj).eq('id', fo.id);
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      Object.assign(cert, maj); fkToast('Certificat personnalisé enregistré.', 'succes');
    });
  };
  dessinerCert();

  document.getElementById('formProfil').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const liens = {};
    ['linkedin', 'facebook', 'youtube'].forEach(k => { const v = (fd.get(k) || '').trim(); if (v) liens[k] = v; });
    const urls = [fd.get('site_web'), ...Object.values(liens)].filter(Boolean);
    if (urls.some(u => !/^https?:\/\//i.test(u))) { fkToast('Les liens doivent commencer par https://', 'erreur'); return; }
    if ((fd.get('biographie') || '').trim().length < 30) { fkToast('Biographie : 30 caractères minimum.', 'erreur'); return; }
    const { error } = await supabaseClient.from('formateurs').update({
      nom_affiche: fd.get('nom_affiche').trim(), titre_professionnel: fd.get('titre_professionnel').trim() || null,
      expertise: fd.get('expertise').trim() || null, biographie: fd.get('biographie').trim(), experience: fd.get('experience').trim() || null,
      site_web: (fd.get('site_web') || '').trim() || null, liens_sociaux: liens
    }).eq('id', fo.id);
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    fkToast('Profil enregistré.', 'succes');
  });

  document.getElementById('photo').addEventListener('change', async e => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    const err = fkVerifierFichier(fichier, 'image');
    if (err) { fkToast(err, 'erreur'); return; }
    const chemin = `formateurs/${fo.id}/${fkNomFichierSur(fichier.name)}`;
    const { error } = await supabaseClient.storage.from(FK_BUCKET_PUBLIC).upload(chemin, fichier, { contentType: fichier.type });
    if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
    const url = supabaseClient.storage.from(FK_BUCKET_PUBLIC).getPublicUrl(chemin).data.publicUrl;
    const { error: e2 } = await supabaseClient.from('formateurs').update({ photo_url: url }).eq('id', fo.id);
    if (e2) { fkToast(fkMessageErreur(e2), 'erreur'); return; }
    const av = document.getElementById('avatar');
    av.style.backgroundImage = `url('${url}')`; av.textContent = '';
    fkToast('Photo mise à jour.', 'succes');
  });
})();
