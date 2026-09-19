// Rendu d'UNE séance publiée en LECTURE SEULE, partagé entre les pages de
// consultation enseignant (js/pages/enseignant-consulter-seance.js) et
// parent (js/pages/parent-consulter-seance.js) — 19 septembre 2026 (25e lot),
// en réponse à la demande explicite : « Je veux tout simplement que les
// autres rôles puissent accéder au contenu et pouvoir lire, mais ils
// n'auront pas accès aux activités de correction automatique — ils pourront
// accéder à l'exercice [tel qu'affiché, en lecture] librement ». Adapté de
// ouvrirApercu() (js/pages/editeur-seance.js, réservé à l'admin, qui ouvre le
// même rendu dans un nouvel onglet pendant l'édition) : mêmes classes CSS que
// la vraie page élève (css/style-public.css) pour un rendu visuellement
// identique, mais avec les champs de question DÉSACTIVÉS (disabled) — aucune
// soumission possible, donc aucun appel à la Edge Function corriger-exercice
// ni écriture dans reponses_exercices/rendus_activites : l'enseignant ou le
// parent voit l'énoncé de l'exercice et peut le parcourir librement, sans
// jamais déclencher de correction automatique ni laisser de trace de
// tentative. Se limite volontairement aux blocs déjà PUBLIÉS (statut_bloc =
// 'publie') — voir le filtre côté appelant — cette vue n'est pas un outil de
// relecture de brouillon comme l'aperçu admin.
const TYPES_TRAVAIL_LECTURE_SEULE = ['quiz', 'evaluation', 'activite'];
const LIBELLES_PALIER_LECTURE_SEULE = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const COULEURS_PALIER_LECTURE_SEULE = { azovi: '#15803D', devi: '#1D4ED8', ogan: '#C2410C', axosu: '#9B59B6' };

function rendreLectureSeuleEnonce(q) {
  if (typeof TYPES_ENONCE_PLAT !== 'undefined' && TYPES_ENONCE_PLAT.includes(q.type)) return echapper(q.enonce);
  return contenuRicheInitial(q.enonce);
}

function rendreLectureSeuleChampQuestion(q, i) {
  if (q.type === 'texte_a_trous') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<input type="text" class="champ-trou" disabled style="width:110px;display:inline-block;margin:0 4px">`;
    }).join('');
    return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p></div>`;
  }
  if (q.type === 'texte_a_trous_glisser') {
    let idxTrou = -1;
    const morceaux = echapper(q.enonce).split('___');
    const enonceAvecTrous = morceaux.map((morceau, k) => {
      if (k === morceaux.length - 1) return morceau;
      idxTrou++;
      return `${morceau}<span class="zone-trou-glisser" style="display:inline-block;min-width:70px"></span>`;
    }).join('');
    const banque = Array.isArray(q.banqueMots) ? q.banqueMots : [];
    return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${enonceAvecTrous}</p>
      <div class="banque-mots-glisser">${banque.map(m => `<span class="chip-glisser">${echapper(m)}</span>`).join('')}</div></div>`;
  }
  if (q.type === 'selection_mots') {
    const mots = typeof tokeniserMots === 'function' ? tokeniserMots(q.enonce || '') : (q.enonce || '').split(/\s+/);
    return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${mots.map(m => `<button type="button" class="chip-mot" disabled>${echapper(m)}</button>`).join(' ')}</p></div>`;
  }
  if (q.type === 'intrus_lexical') {
    const series = Array.isArray(q.series) ? q.series : [];
    return `<div class="question-lecture">
      <p class="question-enonce">${i + 1}. ${rendreLectureSeuleEnonce(q)}</p>
      ${series.map(s => `<div class="serie-intrus">${(Array.isArray(s?.mots) ? s.mots : []).map(m => `<label class="chip-mot-choix"><input type="radio" disabled> ${echapper(m)}</label>`).join('')}</div>`).join('')}
    </div>`;
  }
  let champ = '';
  if (q.type === 'qcm') {
    champ = (q.options || []).map(opt => `<label><input type="radio" disabled> ${echapper(opt)}</label>`).join('');
  } else if (q.type === 'vrai_faux') {
    champ = `<div class="vf-choix"><label><input type="radio" disabled> Vrai</label><label><input type="radio" disabled> Faux</label></div>`;
  } else if (q.type === 'vrai_faux_justifie') {
    champ = `<div class="vf-choix"><label><input type="radio" disabled> Vrai</label><label><input type="radio" disabled> Faux</label></div><textarea disabled placeholder="Explique pourquoi..." style="margin-top:8px"></textarea>`;
  } else if (q.type === 'reponse_courte') {
    champ = `<input type="text" disabled placeholder="Réponse...">`;
  } else if (q.type === 'reponse_numerique') {
    champ = `<input type="number" disabled placeholder="Réponse (un nombre)...">`;
  } else if (q.type === 'remise_en_ordre') {
    champ = `<ol>${(q.options || []).map(opt => `<li>${echapper(opt)}</li>`).join('')}</ol>`;
  } else if (q.type === 'association') {
    const gauche = Array.isArray(q.gauche) ? q.gauche : [];
    const droite = Array.isArray(q.droite) ? q.droite : [];
    champ = gauche.map(g => `
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <span style="flex:1">${echapper(g)}</span>
        <select disabled><option>— Choisis —</option>${droite.map(d => `<option>${echapper(d)}</option>`).join('')}</select>
      </div>`).join('');
  } else if (q.type === 'qcm_multiple') {
    champ = (q.options || []).map(opt => `<label><input type="checkbox" disabled> ${echapper(opt)}</label>`).join('');
  } else if (q.type === 'classement') {
    const mots = Array.isArray(q.motsAClasser) ? q.motsAClasser : [];
    const categories = Array.isArray(q.categories) ? q.categories : [];
    champ = mots.map(mot => `
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <span style="flex:1">${echapper(mot)}</span>
        <select disabled><option>— Choisis —</option>${categories.map(c2 => `<option>${echapper(c2)}</option>`).join('')}</select>
      </div>`).join('');
  } else {
    champ = `<textarea disabled placeholder="Réponse..."></textarea>`;
  }
  return `<div class="question-lecture"><p class="question-enonce">${i + 1}. ${rendreLectureSeuleEnonce(q)}</p>${q.consigne ? `<p class="consigne-question" style="font-size:13px;color:var(--text-gris)">${echapper(q.consigne)}</p>` : ''}${champ}</div>`;
}

function rendreLectureSeuleExercice(c) {
  const questions = Array.isArray(c.questions) ? c.questions : [];
  if (!questions.length) return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}<p style="color:var(--text-gris);font-style:italic">Aucune question pour l'instant.</p>`;
  return `${c.consigne ? `<p>${echapper(c.consigne)}</p>` : ''}${questions.map((q, i) => rendreLectureSeuleChampQuestion(q, i)).join('')}`;
}

function rendreBlocLectureSeuleTravail(b) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || 'var(--bleu-kekeli)';
  const couleurFond = c.couleurBloc || info.couleur || '#0000D1';
  const libelle = c.libelle || info.label;
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">
    <div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>
    ${rendreLectureSeuleExercice(c)}
  </div>`;
}

function rendreBlocLectureSeule(b, tousLesBlocs, estEnfant = false) {
  const info = infoType(b.type_bloc);
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || 'var(--bleu-kekeli)';
  const couleurFond = c.couleurBloc || info.couleur || '#0000D1';
  const afficherTitre = typeof c.afficherTitre === 'boolean' ? c.afficherTitre : b.type_bloc !== 'titre';
  const libelle = c.libelle || info.label;
  let corps = '';
  if (TYPES_TEXTE_LIBRE.includes(b.type_bloc)) corps = `<div class="contenu-riche-lecture">${contenuRicheInitial(c.texte)}</div>`;
  else if (b.type_bloc === 'titre') corps = `<h3 style="margin:0">${echapper(c.texte)}</h3>`;
  else if (b.type_bloc === 'consigne') corps = `<p>${echapper(c.texte)}</p>`;
  else if (b.type_bloc === 'autre') corps = `${c.nom ? `<p style="font-weight:700">${echapper(c.nom)}</p>` : ''}<p>${echapper(c.texte)}</p>`;
  else if (b.type_bloc === 'image') corps = `<img src="${echapper(c.url)}" alt=""><p><em>${echapper(c.legende)}</em></p>`;
  else if (b.type_bloc === 'video') corps = `<p>🎬 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.legende) || c.url}</a></p>`;
  else if (b.type_bloc === 'ressource') corps = `<p>📎 <a href="${echapper(c.url)}" target="_blank" rel="noopener">${echapper(c.nom)}</a></p>`;
  else if (b.type_bloc === 'formule') corps = `<p style="font-family:serif;font-size:18px">${echapper(c.formule)}</p>`;
  else if (b.type_bloc === 'tableau') {
    const fusions = c.fusions || [];
    const masquee = (i, j) => fusions.some(f => f.ligne === i && j > f.colonneDebut && j <= f.colonneFin);
    const colspan = (i, j) => { const f = fusions.find(f => f.ligne === i && f.colonneDebut === j); return f ? (f.colonneFin - f.colonneDebut + 1) : 1; };
    const couleurEntete = c.couleurEntete || '#F4F7F9';
    const texteEntete = c.couleurEntete ? texteContrastant(c.couleurEntete) : '#003366';
    const lignesHtml = (c.lignes || []).map((l, i) => {
      const style = c.entete && i === 0 ? ` style="background:${couleurEntete};font-weight:800;color:${texteEntete}"` : '';
      return `<tr${style}>${l.map((cel, j) => masquee(i, j) ? '' : `<td ${colspan(i, j) > 1 ? `colspan="${colspan(i, j)}"` : ''}>${echapper(cel)}</td>`).join('')}</tr>`;
    }).join('');
    corps = `${c.titre ? `<p style="font-weight:700;margin-bottom:6px">${echapper(c.titre)}</p>` : ''}<table>${lignesHtml}</table>`;
  }
  else if (b.type_bloc === 'html_libre') corps = html_blocHtmlLibre(c.code, libelle);
  else if (b.type_bloc === 'probleme') corps = html_lectureProbleme(c, b.id);
  else corps = `<p>${echapper(c.consigne || c.texte || '')}</p>`;

  const enfants = tousLesBlocs.filter(x => x.parent_bloc_id === b.id).sort((a, b2) => a.ordre - b2.ordre);
  const contenuInterieur = `
    ${afficherTitre ? `<div class="bloc-lecture-titre" style="color:${couleur}">${info.icone} ${echapper(libelle)}</div>` : ''}
    ${corps}
    ${enfants.length ? `<div style="margin-top:10px">${enfants.filter(x => !TYPES_TRAVAIL_LECTURE_SEULE.includes(x.type_bloc)).map(x => rendreBlocLectureSeule(x, tousLesBlocs, true)).join('')}</div>` : ''}
  `;
  if (estEnfant) return contenuInterieur;
  return `<div class="bloc-lecture" style="border-left-color:${couleur};background:${teinteClaire(couleurFond, 0.04)}">${contenuInterieur}</div>`;
}

function html_sectionPaliersLectureSeule(blocsParPalier) {
  const paliersPresents = ['azovi', 'devi', 'ogan', 'axosu'].filter(p => (blocsParPalier[p] || []).length);
  if (!paliersPresents.length) return '';
  return `
    <div class="section-title-eleve" style="margin-top:24px">🎯 Paliers de cette séance</div>
    <p style="font-size:12px;color:var(--text-gris);margin-top:-10px">Aperçu en lecture seule : les paliers sont montrés ici tous déverrouillés — un élève réel les débloque progressivement, palier après palier.</p>
    ${paliersPresents.map(p => {
      const blocsPalier = (blocsParPalier[p] || []).sort((a, b) => a.ordre - b.ordre);
      const couleurPalier = COULEURS_PALIER_LECTURE_SEULE[p] || 'var(--bleu-kekeli)';
      return `<div class="carte-palier-eleve" style="--couleur-palier:${couleurPalier};margin-top:14px">
        <div class="entete-carte-palier-eleve"><span>${LIBELLES_PALIER_LECTURE_SEULE[p] || p}</span></div>
        <div class="corps-carte-palier-eleve">
          ${blocsPalier.map(b => TYPES_TRAVAIL_LECTURE_SEULE.includes(b.type_bloc) ? rendreBlocLectureSeuleTravail(b) : rendreBlocLectureSeule(b, blocsPalier)).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

// Point d'entrée : construit le HTML complet (bandeau + fil d'ariane + corps)
// d'une séance en lecture seule, à insérer tel quel dans le conteneur de la
// page appelante. `blocs` : TOUS les blocs top-level ET enfants de cette
// séance (déjà filtrés côté appelant sur statut_bloc = 'publie'). `filArianeHtml`
// : fil d'ariane déjà construit et échappé par l'appelant (chemin propre à
// chaque rôle). `bandeauTexte` : phrase affichée dans le bandeau jaune en
// tête de page, à adapter selon le rôle qui consulte.
function html_seanceLectureSeule(seance, blocs, filArianeHtml, bandeauTexte) {
  const tousBlocsTop = blocs.filter(b => !b.parent_bloc_id).sort((a, b) => a.ordre - b.ordre);
  const blocsGeneraux = tousBlocsTop.filter(b => !b.palier);
  const blocsLecture = blocsGeneraux.filter(b => !TYPES_TRAVAIL_LECTURE_SEULE.includes(b.type_bloc));
  const blocsTravail = blocsGeneraux.filter(b => TYPES_TRAVAIL_LECTURE_SEULE.includes(b.type_bloc));
  const blocsParPalier = {};
  tousBlocsTop.filter(b => b.palier).forEach(b => { (blocsParPalier[b.palier] ??= []).push(b); });
  const aDesPaliers = Object.keys(blocsParPalier).length > 0;
  const colonneExerciceVide = blocsTravail.length === 0 && aDesPaliers;

  const enTete = `
    <div style="background:#FFF7DA;border:1px solid #F5D77A;border-radius:8px;padding:6px 12px;font-size:12px;color:#7A5A00;margin-bottom:14px;text-align:center">
      🔍 ${echapper(bandeauTexte || 'Lecture seule — vous consultez cette séance telle qu\'affichée à un élève, sans pouvoir y répondre.')}
    </div>
    <div class="entete-seance-eleve">
      <p style="margin:0" class="miniature-arborescence-eleve">${filArianeHtml}</p>
      ${seance.discipline ? `<span class="badge-discipline-seance">${echapper(seance.discipline)}</span>` : ''}
      <h1 class="titre-seance-eleve">${echapper(seance.titre_contenu || seance.titre)}</h1>
    </div>`;

  const corpsHtml = `
    <div class="zone-travail-seance"${colonneExerciceVide ? ' style="grid-template-columns:1fr"' : ''}>
      <div class="colonne-lecture-seance">
        ${blocsLecture.length ? blocsLecture.map(b => rendreBlocLectureSeule(b, blocs)).join('') : '<p style="color:var(--text-gris)">Aucun support de cours pour cette séance.</p>'}
      </div>
      ${colonneExerciceVide ? '' : `<div class="colonne-exercice-seance">
        ${blocsTravail.length ? blocsTravail.map(rendreBlocLectureSeuleTravail).join('') : '<div class="bloc-lecture" style="border-left-color:#94A3B8"><p style="color:var(--text-gris);margin:0">Aucun exercice ni activité pour cette séance.</p></div>'}
      </div>`}
    </div>
    ${html_sectionPaliersLectureSeule(blocsParPalier)}
  `;

  return enTete + corpsHtml;
}
