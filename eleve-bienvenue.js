// Page pages/eleve/bienvenue.html — écran d'accueil juste après connexion
// (léger, orienté action rapide) ; le tableau de bord complet (paliers,
// récompenses, progression) reste accessible via la 3e carte.

(async function () {
  const profil = await requireRole('eleve');
  if (!profil) return;

  document.getElementById('badgeUtilisateur').textContent = `🟢 ${profil.prenom}`;
  initClocheNotifications('zoneCloche', profil.id);

  const { data: fiche } = await supabaseClient.from('eleves').select('mascotte, classe_id').eq('id', profil.id).single();
  const mascotte = fiche?.mascotte || '🦁';

  // Dernière séance travaillée (pour "Continuer ma leçon").
  const { data: derniere } = await supabaseClient
    .from('seances_terminees').select('seance_id, termine_le, seances(titre)')
    .eq('eleve_id', profil.id).order('termine_le', { ascending: false }).limit(1).maybeSingle();

  // Série de jours consécutifs d'apprentissage (calculée à partir des
  // séances terminées — pas de compteur factice).
  const { data: toutesDates } = await supabaseClient
    .from('seances_terminees').select('termine_le').eq('eleve_id', profil.id).order('termine_le', { ascending: false });
  const serie = calculerSerieJours((toutesDates || []).map(d => d.termine_le));

  document.getElementById('contenu').innerHTML = `
    <div class="welcome-card-eleve">
      <div class="mascot-avatar-eleve">${mascotte}</div>
      <h1 style="color:var(--bleu-kekeli);margin:0 0 8px">Bienvenue, ${echapperBv(profil.prenom)} !</h1>
      <p style="color:var(--text-gris);margin:0">Prêt(e) à illuminer tes connaissances aujourd'hui ?</p>
      ${serie > 0 ? `<div class="streak-info-eleve">🔥 Série actuelle : ${serie} jour${serie > 1 ? 's' : ''} consécutif${serie > 1 ? 's' : ''} !</div>` : ''}
    </div>

    <div class="section-title-eleve">Que souhaites-tu faire aujourd'hui ?</div>
    <div class="actions-grid-eleve">
      <a href="${derniere ? `seance.html?id=${derniere.seance_id}` : 'matiere.html'}" class="action-card-eleve">
        <div class="action-icon-eleve">📖</div>
        <div class="action-title-eleve">Continuer ma leçon</div>
        <div class="action-desc-eleve">${derniere ? `Reprends : <strong>${echapperBv(derniere.seances?.titre || '')}</strong>` : "Commence ta première leçon."}</div>
        <div class="btn-start-eleve" style="background:#3498DB">${derniere ? 'Reprendre ⏳' : 'Commencer 🚀'}</div>
      </a>
      <a href="matiere.html" class="action-card-eleve">
        <div class="action-icon-eleve">🎯</div>
        <div class="action-title-eleve">Relever un défi</div>
        <div class="action-desc-eleve">Choisis ta matière et ton palier (Azɔ̀ví, Dèví, Ògán, Axɔ́sú).</div>
        <div class="btn-start-eleve" style="background:#2ECC71">Lancer un défi 🚀</div>
      </a>
      <a href="tableau-de-bord.html" class="action-card-eleve">
        <div class="action-icon-eleve">📊</div>
        <div class="action-title-eleve">Voir mon tableau de bord</div>
        <div class="action-desc-eleve">Ta progression, tes badges et tes notes.</div>
        <div class="btn-start-eleve" style="background:var(--bleu-kekeli)">Mon tableau de bord 📊</div>
      </a>
    </div>
  `;
})();

function calculerSerieJours(horodatages) {
  if (!horodatages.length) return 0;
  const jours = [...new Set(horodatages.map(h => new Date(h).toISOString().slice(0, 10)))].sort().reverse();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (jours[0] !== aujourdhui && jours[0] !== hier) return 0;
  let serie = 1;
  for (let i = 0; i < jours.length - 1; i++) {
    const diff = (new Date(jours[i]) - new Date(jours[i + 1])) / 86400000;
    if (diff === 1) serie++; else break;
  }
  return serie;
}

function echapperBv(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}
