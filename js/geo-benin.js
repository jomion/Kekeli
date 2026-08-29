// ============================================================
// Découpage administratif du Bénin (12 départements, 77 communes),
// utilisé pour les listes déroulantes en cascade Département → Commune
// du formulaire d'inscription (js/pages ou pages/inscription.html).
//
// Source : découpage territorial officiel du Bénin (Loi n°2013-05).
// Si une commune manque ou est mal orthographiée, corrige simplement
// ce fichier — aucune autre partie du site n'a besoin de changer.
// ============================================================

const COMMUNES_PAR_DEPARTEMENT = {
  'Alibori': ['Banikoara', 'Gogounou', 'Kandi', 'Karimama', 'Malanville', 'Ségbana'],
  'Atacora': ['Boukoumbé', 'Cobly', 'Kérou', 'Kouandé', 'Matéri', 'Natitingou', 'Péhunco', 'Tanguiéta', 'Toucountouna'],
  'Atlantique': ['Abomey-Calavi', 'Allada', 'Kpomassè', 'Ouidah', 'Sô-Ava', 'Toffo', 'Tori-Bossito', 'Zè'],
  'Borgou': ['Bembéréké', 'Kalalé', "N'Dali", 'Nikki', 'Parakou', 'Pèrèrè', 'Sinendé', 'Tchaourou'],
  'Collines': ['Bantè', 'Dassa-Zoumè', 'Glazoué', 'Ouèssè', 'Savalou', 'Savè'],
  'Couffo': ['Aplahoué', 'Djakotomey', 'Dogbo', 'Klouékanmè', 'Lalo', 'Toviklin'],
  'Donga': ['Bassila', 'Copargo', 'Djougou', 'Ouaké'],
  'Littoral': ['Cotonou'],
  'Mono': ['Athiémé', 'Bopa', 'Comè', 'Grand-Popo', 'Houéyogbé', 'Lokossa'],
  'Ouémé': ['Adjarra', 'Adjohoun', 'Aguégués', 'Akpro-Missérété', 'Avrankou', 'Bonou', 'Dangbo', 'Porto-Novo', 'Sèmè-Kpodji'],
  'Plateau': ['Adja-Ouèrè', 'Ifangni', 'Kétou', 'Pobè', 'Sakété'],
  'Zou': ['Abomey', 'Agbangnizoun', 'Bohicon', 'Covè', 'Djidja', 'Ouinhi', 'Za-Kpota', 'Zagnanado', 'Zogbodomey']
};

const DEPARTEMENTS_BENIN = Object.keys(COMMUNES_PAR_DEPARTEMENT);

const ZONES_PEDAGOGIQUES = Array.from({ length: 10 }, (_, i) => `Zone ${i + 1}`);

// Remplit un <select> de départements, puis relie un <select> de communes
// pour qu'il se recalcule automatiquement selon le département choisi.
function initialiserSelectDepartementCommune(selectDepartementEl, selectCommuneEl) {
  selectDepartementEl.innerHTML = '<option value="">— Choisir —</option>' +
    DEPARTEMENTS_BENIN.map(d => `<option value="${d}">${d}</option>`).join('');

  function majCommunes() {
    const communes = COMMUNES_PAR_DEPARTEMENT[selectDepartementEl.value] || [];
    selectCommuneEl.innerHTML = '<option value="">— Choisir —</option>' +
      communes.map(c => `<option value="${c}">${c}</option>`).join('');
    selectCommuneEl.disabled = communes.length === 0;
  }

  selectDepartementEl.addEventListener('change', majCommunes);
  majCommunes();
}
