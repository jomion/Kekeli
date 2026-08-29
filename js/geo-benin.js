// ============================================================
// Découpage administratif du Bénin (12 départements, 77 communes,
// 546 arrondissements), utilisé pour les listes déroulantes en cascade
// Département → Commune → Arrondissement du formulaire d'inscription et
// de la page "compléter mon profil" (pages/inscription.html,
// pages/completer-profil.html, et la modale "Inscrire un enfant").
//
// Source Département/Commune : découpage territorial officiel du Bénin
// (Loi n°2013-05). Source Arrondissement : liste fournie par le porteur
// du projet (546 arrondissements, vérifiée : 12 départements, 77 communes,
// 546 arrondissements, chaque commune unique au niveau national).
// Si une entrée manque ou est mal orthographiée, corrige simplement ce
// fichier — aucune autre partie du site n'a besoin de changer.
// ============================================================

const COMMUNES_PAR_DEPARTEMENT = {
  'Alibori': ['Banikoara', 'Gogounou', 'Kandi', 'Karimama', 'Malanville', 'Ségbana'],
  'Atacora': ['Boukoumbé', 'Cobly', 'Kérou', 'Kouandé', 'Matéri', 'Natitingou', 'Péhunco', 'Tanguiéta', 'Toucountouna'],
  'Atlantique': ['Abomey-Calavi', 'Allada', 'Kpomassè', 'Ouidah', 'Sô-Ava', 'Toffo', 'Tori-Bossito', 'Zè'],
  'Borgou': ['Bembéréké', 'Kalalé', "N'Dali", 'Nikki', 'Parakou', 'Pèrèrè', 'Sinendé', 'Tchaourou'],
  'Collines': ['Bantè', 'Dassa-Zoumè', 'Glazoué', 'Ouèssè', 'Savalou', 'Savè'],
  'Couffo': ['Aplahoué', 'Djakotomey', 'Dogbo-Tota', 'Klouékanmè', 'Lalo', 'Toviklin'],
  'Donga': ['Bassila', 'Copargo', 'Djougou', 'Ouaké'],
  'Littoral': ['Cotonou'],
  'Mono': ['Athiémé', 'Bopa', 'Comè', 'Grand-Popo', 'Houéyogbé', 'Lokossa'],
  'Ouémé': ['Adjarra', 'Adjohoun', 'Aguégués', 'Akpro-Missérété', 'Avrankou', 'Bonou', 'Dangbo', 'Porto-Novo', 'Sèmè-Kpodji'],
  'Plateau': ['Adja-Ouèrè', 'Ifangni', 'Kétou', 'Pobè', 'Sakété'],
  'Zou': ['Abomey', 'Agbangnizoun', 'Bohicon', 'Covè', 'Djidja', 'Ouinhi', 'Za-Kpota', 'Zagnanado', 'Zogbodomey']
};

const DEPARTEMENTS_BENIN = Object.keys(COMMUNES_PAR_DEPARTEMENT);

const ZONES_PEDAGOGIQUES = Array.from({ length: 5 }, (_, i) => `Zone ${i + 1}`);

// Arrondissements par commune (clé = nom de commune, unique au niveau
// national — voir vérification dans le commentaire d'en-tête).
const ARRONDISSEMENTS_PAR_COMMUNE = {
  'Banikoara': ['Founougo', 'Gomparou', 'Goumori', 'Kokey', 'Kokiborou', 'Ounet', 'Sompérékou', 'Soroko', 'Toura', 'Banikoara'],
  'Gogounou': ['Bagou', 'Gounarou', 'Ouara', 'Sori', 'Zoungou-Pantrossi', 'Gogounou'],
  'Kandi': ['Angaradébou', 'Bensékou', 'Donwari', 'Kassakou', 'Saah', 'Sam', 'Sonsoro', 'Kandi I', 'Kandi II', 'Kandi III'],
  'Karimama': ['Birni-Lafia', 'Bogo-Bogo', 'Kompa', 'Monsey', 'Karimama'],
  'Malanville': ['Garou', 'Guéné', 'Madécali', 'Toumboutou', 'Malanville'],
  'Ségbana': ['Libantè', 'Liboussou', 'Lougou', 'Sokotindji', 'Ségbana'],
  'Boukoumbé': ['Dipoli', 'Korontière', 'Kossoucoingou', 'Manta', 'Natta', 'Tabota', 'Boukoumbé'],
  'Cobly': ['Datori', 'Kountori', 'Tapoga', 'Cobly'],
  'Kérou': ['Brignamaro', 'Tirou', 'Koabagou', 'Kérou'],
  'Kouandé': ['Birni', 'Chabi-Couma', 'Fô-Tancé', 'Guilmaro', 'Oroukayo', 'Kouandé'],
  'Matéri': ['Dassari', 'Gouandé', 'Nodi', 'Tantéga', 'Tchianhoun-Cossi', 'Matéri'],
  'Natitingou': ['Kotapounga', 'Kouaba', 'Kouandata', 'Perma', 'Tchoumi-Tchoumi', 'Natitingou I', 'Natitingou II', 'Natitingou III', 'Natitingou IV'],
  'Péhunco': ['Gnémasson', 'Tobré', 'Péhunco'],
  'Tanguiéta': ['Cotiakou', "N'Dahonta", 'Taiakou', 'Tanongou', 'Tanguiéta'],
  'Toucountouna': ['Kouarfa', 'Tampégré', 'Toucountouna'],
  'Abomey-Calavi': ['Akassato', 'Godomey', 'Glo-Djigbé', 'Hêvié', 'Kpanroun', 'Ouèdo', 'Togba', 'Zinvié', 'Abomey-Calavi'],
  'Allada': ['Agbanou', 'Ahouannonzoun', 'Attogon', 'Avakpa', 'Ayou', 'Hinvi', 'Lissègazoun', 'Lon-Agonmey', 'Sékou', 'Tokpa-Avagoudo', 'Allada', 'Togoudo'],
  'Kpomassè': ['Aganmalomè', 'Agbanto', 'Agonkanmè', 'Dédomè', 'Dékanmè', 'Sègbèya', 'Sègbohouè', 'Tokpa-Domè', 'Kpomassè'],
  'Ouidah': ['Avlékété', 'Djègbadji', 'Gakpé', 'Ouakpè-Daho', 'Pahou', 'Savi', 'Ouidah I', 'Ouidah II', 'Ouidah III', 'Ouidah IV'],
  'Sô-Ava': ['Ahomey-Lokpo', 'Dékanmey', 'Ganvié I', 'Ganvié II', 'Houédo-Aguékon', 'Vekky', 'Sô-Ava'],
  'Toffo': ['Agué', 'Colli', 'Coussi', 'Damè', 'Djanglanmè', 'Houègbo', 'Kpomè', 'Sè', 'Sèhouè', 'Toffo-Agué'],
  'Tori-Bossito': ['Avamè', 'Azohouè-Aliho', 'Azohouè-Cada', 'Tori-Cada', 'Tori-Gare', 'Tori-Bossito'],
  'Zè': ['Adjan', 'Dawè', 'Djigbé', 'Dodji-Bata', 'Hèkanmé', 'Koundokpoé', 'Sèdjè-Dénou', 'Sèdjè-Houégoudo', 'Tangbo-Djevié', 'Yokpo', 'Zè'],
  'Bembéréké': ['Béroubouay', 'Bouanri', 'Gomia', 'Ina', 'Bembéréké'],
  'Kalalé': ['Basso', 'Bouka', 'Dérassi', 'Dunkassa', 'Péonga', 'Kalalé'],
  "N'Dali": ['Bori', 'Gbégourou', 'Ouénou', 'Sirarou', "N'Dali"],
  'Nikki': ['Biro', 'Gnonkourakali', 'Ouénou', 'Sérékalé', 'Suya', 'Tasso', 'Nikki'],
  'Parakou': ['1er Arrondissement', '2e Arrondissement', '3e Arrondissement'],
  'Pèrèrè': ['Gninsy', 'Guinagourou', 'Kpané', 'Pébié', 'Sontou', 'Pèrèrè'],
  'Sinendé': ['Fô-Bourè', 'Sèkèrè', 'Sikki', 'Sinendé'],
  'Tchaourou': ['Alafiarou', 'Bétérou', 'Goro', 'Kika', 'Sanson', 'Tchatchou', 'Tchaourou'],
  'Bantè': ['Agoua', 'Akpassi', 'Atokoligbé', 'Bobè', 'Gouka', 'Koko', 'Lougba', 'Pira', 'Bantè'],
  'Dassa-Zoumè': ['Akofodjoulè', 'Gbaffo', 'Kéré', 'Kpingni', 'Lèma', 'Paouignan', 'Soclogbo', 'Tré', 'Dassa I', 'Dassa II'],
  'Glazoué': ['Aklankpa', 'Assanté', 'Gomè', 'Kpakpaza', 'Magoumi', 'Ouèdèmè', 'Sokponta', 'Thio', 'Zaffé', 'Glazoué'],
  'Ouèssè': ['Challa-Ogoi', 'Djègbè', 'Gbanlin', 'Kémon', 'Kilibo', 'Laminou', 'Odougba', 'Toui', 'Ouèssè'],
  'Savalou': ['Djaloukou', 'Doumè', 'Gobada', 'Kpataba', 'Lahotan', 'Lèma', 'Logozohoué', 'Monkpa', 'Ouèssè', 'Ottola', 'Tchetti', 'Savalou-Aga', 'Savalou-Agbado', 'Savalou-Attakè'],
  'Savè': ['Bèssè', 'Kaboua', 'Ofè', 'Okpara', 'Sakin', 'Adido', 'Boni', 'Plateau'],
  'Aplahoué': ['Atomè', 'Azovè', 'Dekpo', 'Godohou', 'Kissamey', 'Lonkly', 'Aplahoué'],
  'Djakotomey': ['Adjintimey', 'Bètoumey', 'Gohomey', 'Houègamey', 'Kinkinhoué', 'Kokohoué', 'Kpoba', 'Sokouhoué', 'Djakotomey I', 'Djakotomey II'],
  'Dogbo-Tota': ['Ayomi', 'Dèvè', 'Honton', 'Lokogohoué', 'Madjrè', 'Totchagni', 'Tota'],
  'Klouékanmè': ['Adjanhonmè', 'Ahogbèya', 'Aya-Hohoué', 'Djotto', 'Hondji', 'Lanta', 'Tchikpé', 'Klouékanmè'],
  'Lalo': ['Adoukandji', 'Ahodjinnako', 'Ahomadégbé', 'Banigbé', 'Gnizounmè', 'Hlassamè', 'Lokogba', 'Tchito', 'Tohou', 'Zalli', 'Lalo'],
  'Toviklin': ['Adjido', 'Avédjin', 'Doko', 'Houédogli', 'Missinko', 'Tannou-Gola', 'Toviklin'],
  'Bassila': ['Alédjo', 'Manigri', 'Pénéssoulou', 'Bassila'],
  'Copargo': ['Anandana', 'Pabégou', 'Singré', 'Copargo'],
  'Djougou': ['Barei', 'Bariénou', 'Bèllè', 'Bougou', 'Kolokondé', 'Onklou', 'Patargo', 'Pélébina', 'Sérou', 'Djougou I', 'Djougou II', 'Djougou III'],
  'Ouaké': ['Badjoudè', 'Kondé', 'Sèmèrè I', 'Sèmèrè II', 'Tchalinga', 'Ouaké'],
  'Cotonou': ['1e Arrondissement', '2e Arrondissement', '3e Arrondissement', '4e Arrondissement', '5e Arrondissement', '6e Arrondissement', '7e Arrondissement', '8e Arrondissement', '9e Arrondissement', '10e Arrondissement', '11e Arrondissement', '12e Arrondissement', '13e Arrondissement'],
  'Athiémé': ['Adohoun', 'Atchannou', 'Dédékpoé', 'Kpinnou', 'Athiémé'],
  'Bopa': ['Agbodji', 'Badazoui', 'Gbakpodji', 'Lobogo', 'Possotomè', 'Yégodoé', 'Bopa'],
  'Comè': ['Agatogbo', 'Akodéha', 'Ouèdèmè-Pédah', 'Oumako', 'Comè'],
  'Grand-Popo': ['Adjaha', 'Agoué', 'Avloh', 'Djanglanmey', 'Gbéhoué', 'Sazoué', 'Grand-Popo'],
  'Houéyogbé': ['Dahè', 'Doutou', 'Honhoué', 'Zoungbonou', 'Houéyogbé', 'Sè'],
  'Lokossa': ['Agamè', 'Houin', 'Koudo', 'Ouèdèmè', 'Lokossa'],
  'Adjarra': ['Aglobè', 'Honvié', 'Malanhoui', 'Médédjonou', 'Adjarra I', 'Adjarra II'],
  'Adjohoun': ['Akpadanou', 'Awonou', 'Azowlissè', 'Dèmè', 'Gangban', 'Kodè', 'Togbota', 'Adjohoun'],
  'Aguégués': ['Avagbodji', 'Houédomè', 'Zoungamè'],
  'Akpro-Missérété': ['Gomè-Sota', 'Katagon', 'Vakon', 'Zoungbomè', 'Akpro-Missérété'],
  'Avrankou': ['Atchoukpa', 'Djomon', 'Gbozounmè', 'Kouty', 'Ouanho', 'Sado', 'Avrankou'],
  'Bonou': ['Affamè', 'Atchonsa', 'Damè-Wogon', 'Houinviguè', 'Bonou'],
  'Dangbo': ['Dèkin', 'Gbéko', 'Houédomey', 'Hozin', 'Késsounou', 'Zoungué', 'Dangbo'],
  'Porto-Novo': ['1e Arrondissement', '2e Arrondissement', '3e Arrondissement', '4e Arrondissement', '5e Arrondissement'],
  'Sèmè-Kpodji': ['Agblangandan', 'Aholouyèmè', 'Djèrègbè', 'Ekpè', 'Tohouè', 'Sèmè-Kpodji'],
  'Adja-Ouèrè': ['Ikpinlè', 'Kpoulou', 'Massè', 'Oko-Akarè', 'Totonnoukon', 'Adja-Ouèrè'],
  'Ifangni': ['Banigbé', 'Daagbé', 'Ko-Koumolou', 'Lagbé', 'Tchaada', 'Ifangni'],
  'Kétou': ['Adakplamè', 'Idigny', 'Kpankou', 'Udometa', 'Okpometa', 'Kétou'],
  'Pobè': ['Ahoyéyé', 'Igana', 'Issaba', 'Towé', 'Pobè'],
  'Sakété': ['Aguidi', 'Ita-Djèbou', 'Takon', 'Yoko', 'Sakété I', 'Sakété II'],
  'Abomey': ['Agbokpa', 'Dètohou', 'Sèhoun', 'Zounzounmè', 'Djegbè', 'Hounli', 'Vidolè'],
  'Agbangnizoun': ['Adahondjigon', 'Adingningon', 'Kinta', 'Lissazounmè', 'Sahè', 'Kpota', 'Siwé', 'Tanvé', 'Zoungoudo', 'Agbangnizoun'],
  'Bohicon': ['Agongointo', 'Avogbanna', 'Gnidjazoun', 'Lissèzoun', 'Ouassaho', 'Passagon', 'Saclo', 'Sodohomè', 'Bohicon I', 'Bohicon II'],
  'Covè': ['Adogbé', 'Gounli', 'Houen-Hounso', 'Lanta-Cogbè', 'Naogon', 'Soli', 'Zogba', 'Covè'],
  'Djidja': ['Agondji', 'Agouna', 'Dan', 'Dohouimè', 'Gobaix', 'Mougnon', 'Monsourou', 'Oungbègamè', 'Outo', 'Setto', 'Zoukon', 'Djidja'],
  'Ouinhi': ['Dasso', 'Sagon', 'Tohoué', 'Ouinhi'],
  'Zagnanado': ['Agonli-Houégbo', 'Banamè', 'Don-Tan', 'Dovi', 'Kpédékpo', 'Zagnanado'],
  'Za-Kpota': ['Allahé', 'Assalin', 'Houngomey', 'Kpakpamè', 'Kpozoun', 'Za-Tanta', 'Zèko', 'Za-Kpota'],
  'Zogbodomey': ['Akiza', 'Avlamè', 'Cana I', 'Cana II', 'Domè', 'Koussoukpa', 'Kpokissa', 'Massi', 'Tanwé-Hessou', 'Zoukou', 'Zogbodomey']
};

// Circonscriptions Scolaires par commune (clé = nom de commune). Source :
// liste officielle Circonscription Scolaire 2026 fournie par le porteur du
// projet (289 lignes, 77 communes couvertes — 28 communes ont plusieurs CS,
// ex. Cotonou 1 à 6, Parakou 1 à 3). Trois noms de commune de ce fichier ont
// été alignés sur l'orthographe déjà utilisée dans ce fichier : "Dogbo" →
// "Dogbo-Tota", "N’Dali" (apostrophe courbe) → "N'Dali", "Sèmè-Podji" →
// "Sèmè-Kpodji". Les colonnes "zone_1".."zone_5" de ce même fichier étaient
// identiques sur les 289 lignes (donc inutilisables) et n'ont pas été
// reprises ici — Zone Pédagogique reste la liste générique ZONES_PEDAGOGIQUES
// ci-dessus, à choisir manuellement.
const CIRCONSCRIPTIONS_PAR_COMMUNE = {
  'Abomey': ['Abomey'],
  'Abomey-Calavi': ['Abomey-Calavi 1', 'Abomey-Calavi 2', 'Abomey-Calavi 3', 'Abomey-Calavi 4', 'Abomey-Calavi 5', 'Abomey-Calavi 6'],
  'Adja-Ouèrè': ['Adja-Ouèrè'],
  'Adjarra': ['Adjarra'],
  'Adjohoun': ['Adjohoun'],
  'Agbangnizoun': ['Agbangnizoun'],
  'Aguégués': ['Aguégués'],
  'Akpro-Missérété': ['Akpro-Missérété 1', 'Akpro-Missérété 2'],
  'Allada': ['Allada 1', 'Allada 2'],
  'Aplahoué': ['Aplahoué 1', 'Aplahoué 2'],
  'Athiémé': ['Athiémé'],
  'Avrankou': ['Avrankou 1', 'Avrankou 2'],
  'Banikoara': ['Banikoara 1', 'Banikoara 2'],
  'Bantè': ['Bantè'],
  'Bassila': ['Bassila 1', 'Bassila 2'],
  'Bembéréké': ['Bembéréké 1', 'Bembéréké 2'],
  'Bohicon': ['Bohicon 1', 'Bohicon 2', 'Bohicon 3'],
  'Bonou': ['Bonou'],
  'Bopa': ['Bopa'],
  'Boukoumbé': ['Boukoumbé'],
  'Cobly': ['Cobly'],
  'Comè': ['Comè'],
  'Copargo': ['Copargo'],
  'Cotonou': ['Cotonou 1', 'Cotonou 2', 'Cotonou 3', 'Cotonou 4', 'Cotonou 5', 'Cotonou 6'],
  'Covè': ['Covè'],
  'Dangbo': ['Dangbo'],
  'Dassa-Zoumè': ['Dassa-Zoumè 1', 'Dassa-Zoumè 2'],
  'Djakotomey': ['Djakotomey 1', 'Djakotomey 2'],
  'Djidja': ['Djidja 1', 'Djidja 2'],
  'Djougou': ['Djougou 1', 'Djougou 2', 'Djougou 3'],
  'Dogbo-Tota': ['Dogbo'],
  'Glazoué': ['Glazoué 1', 'Glazoué 2'],
  'Gogounou': ['Gogounou'],
  'Grand-Popo': ['Grand-Popo'],
  'Houéyogbé': ['Houéyogbé 1', 'Houéyogbé 2'],
  'Ifangni': ['Ifangni'],
  'Kalalé': ['Kalalé'],
  'Kandi': ['Kandi 1', 'Kandi 2'],
  'Karimama': ['Karimama'],
  'Klouékanmè': ['Klouékanmè 1', 'Klouékanmè 2'],
  'Kouandé': ['Kouandé'],
  'Kpomassè': ['Kpomassè'],
  'Kérou': ['Kérou'],
  'Kétou': ['Kétou 1', 'Kétou 2'],
  'Lalo': ['Lalo'],
  'Lokossa': ['Lokossa 1', 'Lokossa 2'],
  'Malanville': ['Malanville'],
  'Matéri': ['Matéri'],
  'N\'Dali': ['N’Dali'],
  'Natitingou': ['Natitingou 1', 'Natitingou 2'],
  'Nikki': ['Nikki'],
  'Ouaké': ['Ouaké'],
  'Ouidah': ['Ouidah 1', 'Ouidah 2'],
  'Ouinhi': ['Ouinhi'],
  'Ouèssè': ['Ouèssè'],
  'Parakou': ['Parakou 1', 'Parakou 2', 'Parakou 3'],
  'Pobè': ['Pobè'],
  'Porto-Novo': ['Porto-Novo 1', 'Porto-Novo 2', 'Porto-Novo 3'],
  'Pèrèrè': ['Pèrèrè'],
  'Péhunco': ['Péhunco'],
  'Sakété': ['Sakété'],
  'Savalou': ['Savalou 1', 'Savalou 2'],
  'Savè': ['Savè'],
  'Sinendé': ['Sinendé'],
  'Sèmè-Kpodji': ['Sèmè-Podji 1', 'Sèmè-Podji 2'],
  'Ségbana': ['Ségbana'],
  'Sô-Ava': ['Sô-Ava'],
  'Tanguiéta': ['Tanguiéta'],
  'Tchaourou': ['Tchaourou 1', 'Tchaourou 2', 'Tchaourou 3'],
  'Toffo': ['Toffo'],
  'Tori-Bossito': ['Tori-Bossito'],
  'Toucountouna': ['Toucountouna'],
  'Toviklin': ['Toviklin'],
  'Za-Kpota': ['Za-Kpota 1', 'Za-Kpota 2'],
  'Zagnanado': ['Zagnanado'],
  'Zogbodomey': ['Zogbodomey'],
  'Zè': ['Zè']
};

// Remplit un <select> de départements, puis relie un <select> de communes
// pour qu'il se recalcule automatiquement selon le département choisi.
// Redéclenche aussi un "change" sur le select commune (même si sa valeur
// n'a pas été choisie par l'utilisateur) pour qu'une éventuelle cascade
// Commune → Arrondissement branchée dessus (voir ci-dessous) se remette
// aussi à jour.
function initialiserSelectDepartementCommune(selectDepartementEl, selectCommuneEl) {
  selectDepartementEl.innerHTML = '<option value="">— Choisir —</option>' +
    DEPARTEMENTS_BENIN.map(d => `<option value="${d}">${d}</option>`).join('');

  function majCommunes() {
    const communes = COMMUNES_PAR_DEPARTEMENT[selectDepartementEl.value] || [];
    selectCommuneEl.innerHTML = '<option value="">— Choisir —</option>' +
      communes.map(c => `<option value="${c}">${c}</option>`).join('');
    selectCommuneEl.disabled = communes.length === 0;
    selectCommuneEl.dispatchEvent(new Event('change'));
  }

  selectDepartementEl.addEventListener('change', majCommunes);
  majCommunes();
}

// Relie un <select> d'arrondissements à un <select> de communes, pour
// qu'il se recalcule automatiquement selon la commune choisie.
function initialiserSelectCommuneArrondissement(selectCommuneEl, selectArrondissementEl) {
  function majArrondissements() {
    const arrondissements = ARRONDISSEMENTS_PAR_COMMUNE[selectCommuneEl.value] || [];
    selectArrondissementEl.innerHTML = '<option value="">— Choisir —</option>' +
      arrondissements.map(a => `<option value="${a}">${a}</option>`).join('');
    selectArrondissementEl.disabled = arrondissements.length === 0;
  }

  selectCommuneEl.addEventListener('change', majArrondissements);
  majArrondissements();
}

// Relie un <select> de circonscriptions scolaires à un <select> de communes,
// pour qu'il se recalcule automatiquement selon la commune choisie.
function initialiserSelectCommuneCirconscription(selectCommuneEl, selectCirconscriptionEl) {
  function majCirconscriptions() {
    const circonscriptions = CIRCONSCRIPTIONS_PAR_COMMUNE[selectCommuneEl.value] || [];
    selectCirconscriptionEl.innerHTML = '<option value="">— Choisir —</option>' +
      circonscriptions.map(c => `<option value="${c}">${c}</option>`).join('');
    selectCirconscriptionEl.disabled = circonscriptions.length === 0;
  }

  selectCommuneEl.addEventListener('change', majCirconscriptions);
  majCirconscriptions();
}

// Enchaîne les cascades ci-dessus en un seul appel : Département → Commune
// → Arrondissement, et, si un <select> de circonscription scolaire est
// fourni, Commune → Circonscription Scolaire en parallèle.
function initialiserCascadeGeoBenin(selectDepartementEl, selectCommuneEl, selectArrondissementEl, selectCirconscriptionEl) {
  initialiserSelectCommuneArrondissement(selectCommuneEl, selectArrondissementEl);
  if (selectCirconscriptionEl) {
    initialiserSelectCommuneCirconscription(selectCommuneEl, selectCirconscriptionEl);
  }
  initialiserSelectDepartementCommune(selectDepartementEl, selectCommuneEl);
}
