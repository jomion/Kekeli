// Accueil mixte (index.html, 25 septembre 2026) : chiffres des deux offres,
// dernières formations, bouton « Continuer mon espace » pour un visiteur déjà
// connecté, bannière du super admin. Tout est facultatif : en cas d'erreur,
// la page reste entièrement lisible avec son contenu statique.

(function () {
  const e = v => (v ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function chiffres() {
    try {
      const [{ count: nbSeances }, { count: nbFormations }] = await Promise.all([
        supabaseClient.from('seances').select('id', { count: 'exact', head: true }).eq('statut', 'publie'),
        supabaseClient.from('formations').select('id', { count: 'exact', head: true }).eq('statut', 'publiee').eq('visibilite', 'publique')
      ]);
      if (nbSeances) document.getElementById('chiffrePrimaire').innerHTML = `<b>${nbSeances}</b> séances publiées`;
      document.getElementById('chiffreFormation').innerHTML = nbFormations
        ? `<b>${nbFormations}</b> formation${nbFormations > 1 ? 's' : ''} disponible${nbFormations > 1 ? 's' : ''}`
        : 'Les premières formations arrivent bientôt';
    } catch (_e) { /* chiffres facultatifs */ }
  }

  async function dernieresFormations() {
    try {
      const { data } = await supabaseClient.from('formations')
        .select('slug, titre, sous_titre, nb_lecons, prix, image_couverture, formation_categories(nom, icone), formateurs(nom_affiche)')
        .eq('statut', 'publiee').eq('visibilite', 'publique').order('publiee_le', { ascending: false }).limit(4);
      if (!data || !data.length) return;
      document.getElementById('listeFormations').innerHTML = data.map(f => `
        <a class="mixte-formation" href="pages/formations/formation.html?slug=${encodeURIComponent(f.slug)}">
          <span class="mixte-formation-img" style="${f.image_couverture ? `background-image:url('${e(f.image_couverture)}')` : ''}">${f.image_couverture ? '' : e(f.formation_categories?.icone || '🎓')}</span>
          <span class="mixte-formation-corps">
            <small>${e(f.formation_categories?.nom || 'Formation')}</small>
            <strong>${e(f.titre)}</strong>
            <span>${f.formateurs ? 'par ' + e(f.formateurs.nom_affiche) + ' · ' : ''}${f.nb_lecons} leçon${f.nb_lecons > 1 ? 's' : ''} · ${f.prix ? Number(f.prix).toLocaleString('fr-FR') + ' FCFA' : 'Gratuit'}</span>
          </span>
        </a>`).join('');
      document.getElementById('sectionFormations').hidden = false;
    } catch (_e) { /* section masquée */ }
  }

  async function session() {
    let role = 'visiteur';
    try {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      const profil = s ? await chargerProfil(s.user.id) : null;
      if (profil && profil.actif) {
        role = profil.role === 'super_admin' ? 'admin' : profil.role;
        const derniere = (() => { try { return localStorage.getItem('kekeli_derniere_page'); } catch (_e) { return null; } })();
        const url = derniere || urlTableauDeBord(profil.role);
        document.getElementById('zoneAuth').innerHTML = `<a href="${e(url)}" class="btn btn-filled">Continuer mon espace →</a>`;
        const zone = document.getElementById('zoneContinuer');
        zone.innerHTML = `👋 Bonjour ${e(profil.prenom)} — <a href="${e(url)}">reprendre là où vous vous êtes arrêté(e) →</a>`;
        zone.hidden = false;
        // Comptes élèves (enfants) : KEKELI Formation leur est fermée.
        if (profil.role === 'eleve') {
          document.querySelector('.offre-formation')?.remove();
          document.getElementById('sectionFormations')?.remove();
          document.getElementById('navFormation')?.parentElement.remove();
          document.querySelector('.mixte-offres')?.classList.add('une-seule');
        }
      }
    } catch (_e) { /* visiteur */ }
    try { initBanniereSite(role); } catch (_e) { /* bannière facultative */ }
    return role;
  }

  session().then(role => { chiffres(); if (role !== 'eleve') dernieresFormations(); });
})();
