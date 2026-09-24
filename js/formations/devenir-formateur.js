// Devenir formateur (pages/formations/devenir-formateur.html) : présentation,
// puis formulaire de candidature (fonction serveur candidater_formateur),
// validée ensuite par un administrateur (pages/admin/formations.html).

(async function () {
  await fkInitPage('devenir');
  const main = document.getElementById('fkContenu');
  const s = await fkSession();
  const fo = s.formateur;

  const presentation = `
    <section class="fk-hero" style="padding:52px 0">
      <div class="fk-container fk-hero-grid">
        <div>
          <span class="fk-badge">DEVENEZ FORMATEUR</span>
          <h1 style="font-size:clamp(34px,4.5vw,52px)">Votre savoir peut devenir <span>une formation.</span></h1>
          <p>Enseignant, artisan, entrepreneur, agronome, développeur… Partagez ce que vous maîtrisez avec des apprenants motivés, à votre rythme.</p>
        </div>
        <div class="fk-trainer-box">
          <h2 style="margin-top:0">Comment ça se passe ?</h2>
          <div class="fk-check">1. Vous présentez votre profil et votre expertise</div>
          <div class="fk-check">2. L'équipe KEKELI valide votre profil</div>
          <div class="fk-check">3. Vous créez vos modules, leçons et quiz</div>
          <div class="fk-check">4. Vous soumettez : KEKELI vérifie puis publie</div>
          <div class="fk-check">5. Vous suivez vos apprenants et leurs progrès</div>
        </div>
      </div>
    </section>`;

  let bloc;
  if (!s.profil) {
    bloc = `<div class="fk-carte" style="text-align:center">
      <h2>Commencez par vous connecter</h2>
      <p style="color:var(--f-muted)">Un compte KEKELI (apprenant, parent ou enseignant) suffit pour déposer votre candidature.</p>
      <div class="fk-hero-actions" style="justify-content:center">
        <a class="fk-btn fk-btn-primary" href="${fkUrlInscription()}">Créer un compte</a>
        <a class="fk-btn fk-btn-outline" href="${fkUrlConnexion()}">Se connecter</a>
      </div></div>`;
  } else if (s.profil.role === 'eleve') {
    bloc = `<div class="fk-alerte fk-alerte-info">Un compte élève ne peut pas devenir formateur. Demandez à un adulte de créer son propre compte.</div>`;
  } else if (fo && fo.statut === 'valide') {
    bloc = `<div class="fk-carte" style="text-align:center"><h2>✅ Vous êtes formateur KEKELI</h2>
      <p style="color:var(--f-muted)">Votre profil est validé. Créez et gérez vos formations depuis votre espace.</p>
      <a class="fk-btn fk-btn-primary" href="${FK_BASE}formateur/tableau-de-bord.html">Accéder à mon espace formateur</a></div>`;
  } else if (fo && fo.statut === 'suspendu') {
    bloc = `<div class="fk-alerte fk-alerte-erreur">⛔ Votre profil formateur est suspendu${fo.motif_refus ? ` : ${fkEchapper(fo.motif_refus)}` : ''}. Contactez l'administration KEKELI.</div>`;
  } else if (fo && fo.statut === 'en_attente') {
    bloc = `<div class="fk-carte"><h2>⏳ Candidature en cours d'examen</h2>
      <p style="color:var(--f-muted)">Vous recevrez une notification dès que l'équipe KEKELI aura étudié votre profil. Vous pouvez encore compléter vos informations ci-dessous.</p></div>
      ${formulaire(fo)}`;
  } else {
    bloc = `${fo && fo.statut === 'refuse' ? `<div class="fk-alerte fk-alerte-attention">Votre précédente candidature n'a pas été retenue${fo.motif_refus ? ` : « ${fkEchapper(fo.motif_refus)} »` : ''}. Vous pouvez la compléter et la renvoyer.</div>` : ''}${formulaire(fo)}`;
  }

  main.innerHTML = `${presentation}<div class="fk-page" style="padding-top:28px"><div class="fk-container" style="max-width:760px">${bloc}</div></div>`;

  const form = document.getElementById('formCandidature');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      const fd = new FormData(form);
      const liens = {};
      ['linkedin', 'facebook', 'youtube'].forEach(k => { const v = (fd.get(k) || '').trim(); if (v) liens[k] = v; });
      const invalide = Object.values(liens).find(v => !/^https?:\/\//i.test(v));
      if (invalide) { fkToast('Les liens doivent commencer par https://', 'erreur'); btn.disabled = false; return; }
      const { error } = await supabaseClient.rpc('candidater_formateur', {
        p_titre: fd.get('titre'), p_biographie: fd.get('biographie'), p_expertise: fd.get('expertise'),
        p_experience: fd.get('experience'), p_site_web: fd.get('site_web'), p_liens: liens
      });
      btn.disabled = false;
      if (error) { fkToast(fkMessageErreur(error), 'erreur'); return; }
      fkToast('Candidature envoyée ! Vous serez notifié(e) de la décision.', 'succes');
      setTimeout(() => window.location.reload(), 1200);
    });
  }

  function formulaire(f) {
    const l = (f && f.liens_sociaux) || {};
    return `<form class="fk-carte" id="formCandidature">
      <h2>Ma candidature</h2>
      <label class="fk-champ"><span>Titre professionnel</span><input type="text" name="titre" maxlength="120" placeholder="Ex. Enseignant de mathématiques, Comptable, Agronome…" value="${fkEchapper(f?.titre_professionnel || '')}"></label>
      <label class="fk-champ"><span>Domaine d'expertise *</span><input type="text" name="expertise" required maxlength="160" placeholder="Ex. Bureautique, Pédagogie, Agriculture bio…" value="${fkEchapper(f?.expertise || '')}"></label>
      <label class="fk-champ"><span>Présentez-vous *</span><textarea name="biographie" required minlength="30" maxlength="3000" placeholder="Votre parcours, ce que vous aimez transmettre, à qui s'adressent vos formations…">${fkEchapper(f?.biographie || '')}</textarea><small>30 caractères minimum. Ce texte apparaîtra sur votre profil public.</small></label>
      <label class="fk-champ"><span>Expérience</span><textarea name="experience" maxlength="3000" placeholder="Postes, diplômes, réalisations…">${fkEchapper(f?.experience || '')}</textarea></label>
      <div class="fk-grille-2">
        <label class="fk-champ"><span>Site web</span><input type="url" name="site_web" placeholder="https://…" value="${fkEchapper(f?.site_web || '')}"></label>
        <label class="fk-champ"><span>LinkedIn</span><input type="url" name="linkedin" placeholder="https://…" value="${fkEchapper(l.linkedin || '')}"></label>
        <label class="fk-champ"><span>Facebook</span><input type="url" name="facebook" placeholder="https://…" value="${fkEchapper(l.facebook || '')}"></label>
        <label class="fk-champ"><span>YouTube</span><input type="url" name="youtube" placeholder="https://…" value="${fkEchapper(l.youtube || '')}"></label>
      </div>
      <label class="fk-case"><input type="checkbox" required> Je certifie être l'auteur des contenus que je publierai ou disposer des droits nécessaires, et j'accepte les <a class="fk-link" href="${FK_RACINE}pages/conditions-utilisation.html" target="_blank" rel="noopener">conditions d'utilisation</a>.</label>
      <div class="fk-actions-form"><button class="fk-btn fk-btn-primary" type="submit">${f ? 'Mettre à jour et envoyer' : 'Envoyer ma candidature'}</button></div>
    </form>`;
  }
})();
