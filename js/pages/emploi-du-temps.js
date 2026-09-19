// Page pages/emploi-du-temps.html — emploi du temps hebdomadaire officiel
// d'une classe, accessible à TOUS les rôles liés à cette classe (élève,
// parent, enseignant, admin, autorité pédagogique), voir js/navigation-config.js.
//
// 19 septembre 2026 : demande explicite ("Ajoute la page emploi du temps à
// tous les rôles liés au CM1 et CM2. Rends ça modifiable"), à partir d'une
// maquette HTML statique fournie par le porteur du projet. Décisions prises
// avec lui (AskUserQuestion) : (1) seuls l'admin et l'enseignant de la classe
// peuvent modifier — même modèle de permission que registre_eleves_manuels
// (fonction peut_gerer_classe), (2) CM1 et CM2 ont chacun LEUR PROPRE emploi
// du temps, modifiable séparément (tous deux initialement identiques au
// contenu de la maquette fournie, libres de diverger ensuite).
//
// Cette page vit à la racine de pages/ (comme pages/seances.html) et est
// donc partagée par tous les rôles : le thème (clair admin / public) est
// choisi dynamiquement, voir css/emploi-du-temps.css pour le choix inverse
// (couleurs fixes, indépendantes du thème) sur la feuille de style dédiée à
// cette page.
//
// Table emplois_du_temps (une ligne par classe, colonne `contenu` en JSONB) :
// la grille (lignes, colonnes, horaires-types, fusions repos/récréation) est
// STRUCTURELLEMENT FIXE (même esprit que la "Planification mensuelle"
// enseignant : "grille fixe du document administratif officiel, éditable
// seulement dans son contenu") — seul le TEXTE (intitulés d'activité,
// horaires, libellés de ligne spéciale, textes du bloc repos, remarques,
// titre/sous-titre) est modifiable, jamais la structure (nombre de lignes,
// jours couverts par une fusion). Schéma de `contenu` :
//   {
//     jours: ["Lundi", ..., "Vendredi"],
//     titre, sousTitre,
//     lignes: [
//       { type: "cours", horaire, cellules: { [jour]: ["Texte (durée)", ...] },
//         repos?: { jour, span, emoji, titre, sousTexte } },
//       { type: "special", style: "recreation"|"interclasse", horaire,
//         groupes: [{ jours: [...], libelle }] }
//     ],
//     remarques: ["...", ...]
//   }
// Un jour absent de `cellules` (ligne "cours") ou d'aucun `groupe` (ligne
// "special") signifie qu'il est recouvert par le rowspan d'un bloc `repos`
// démarré sur une ligne précédente : aucune cellule n'est alors émise pour ce
// jour sur cette ligne (le rowspan HTML de la ligne d'origine s'en charge).
// "**texte**" à l'intérieur d'une ligne d'activité = mise en accent (gras,
// couleur), parsé/retiré à l'affichage — jamais du vrai Markdown ailleurs.

let profilEdt = null;
let roleEdt = null; // 'admin' | 'eleve' | 'parent' | 'enseignant' | 'autorite'
let estSuperAdminEdt = false;
let classesAssigneesEnseignantEdt = []; // ids de classe (enseignant uniquement)
let lignesEdtDisponibles = []; // [{ classeId, nom, ordre, contenu, modifieLe }]
let classeSelectionneeEdt = null;

(async function () {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const profilAdmin = await chargerProfilAdmin(session.user.id);
  if (profilAdmin) {
    profilEdt = profilAdmin;
    roleEdt = 'admin';
    estSuperAdminEdt = !!profilAdmin.est_super_admin;
  } else {
    const profilGenerique = await chargerProfil(session.user.id);
    const cle = profilGenerique?.role === 'autorite_pedagogique' ? 'autorite' : profilGenerique?.role;
    if (!profilGenerique || !LIENS_PAR_ROLE[cle]) { window.location.href = 'index.html'; return; }
    profilEdt = profilGenerique;
    roleEdt = cle;
  }

  const feuille = document.createElement('link');
  feuille.rel = 'stylesheet';
  feuille.href = roleEdt === 'admin' ? '../css/style.css' : '../css/style-public.css';
  document.head.appendChild(feuille);

  const badgeHtml = roleEdt === 'admin'
    ? `${estSuperAdminEdt ? '👑 Super admin' : '🛠️ Admin'} : ${echapperEdt(profilEdt.prenom)}`
    : `🟢 ${echapperEdt(profilEdt.prenom)}`;

  await initEnteteNavigation({
    role: roleEdt, utilisateurId: profilEdt.id, badgeHtml,
    liens: liensAvecPrefixe(roleEdt, roleEdt === 'admin' ? 'admin/' : roleEdt + '/', { superAdmin: estSuperAdminEdt })
  });

  if (roleEdt === 'enseignant') {
    const { data: enseignant } = await supabaseClient.from('enseignants').select('classes_assignees').eq('id', profilEdt.id).single();
    classesAssigneesEnseignantEdt = enseignant?.classes_assignees || [];
  }

  await chargerEmploisDuTempsEdt();
})();

// Les policies RLS d'emplois_du_temps_lecture filtrent déjà exactement selon
// le rôle connecté (élève -> sa classe, parent -> classe(s) de ses enfants,
// enseignant -> classes qui lui sont assignées via peut_gerer_classe, admin
// -> tout, autorité pédagogique -> tout) : pas besoin de reproduire cette
// logique côté client pour savoir quelles classes proposer, la requête ne
// renvoie que ce à quoi ce compte a déjà droit.
async function chargerEmploisDuTempsEdt() {
  const { data, error } = await supabaseClient.from('emplois_du_temps')
    .select('classe_id, contenu, modifie_le, classes(nom, ordre)');

  if (error) {
    document.getElementById('contenu').innerHTML = `<p class="message-erreur" style="text-align:center;padding:30px 0">Erreur de chargement : ${echapperEdt(error.message)}</p>`;
    return;
  }

  lignesEdtDisponibles = (data || [])
    .map(d => ({ classeId: d.classe_id, nom: d.classes?.nom || `Classe #${d.classe_id}`, ordre: d.classes?.ordre ?? 0, contenu: d.contenu || {}, modifieLe: d.modifie_le }))
    .sort((a, b) => a.ordre - b.ordre);

  if (!lignesEdtDisponibles.length) {
    document.getElementById('contenu').innerHTML = `<p class="message-erreur" style="text-align:center;padding:30px 0">Aucun emploi du temps n'est encore disponible pour votre classe.</p>`;
    return;
  }

  classeSelectionneeEdt = lignesEdtDisponibles[0].classeId;
  afficherEdt();
}

function ligneCouranteEdt() {
  return lignesEdtDisponibles.find(l => l.classeId === classeSelectionneeEdt);
}

function peutEditerClasseEdt(classeId) {
  if (roleEdt === 'admin') return true;
  if (roleEdt === 'enseignant') return classesAssigneesEnseignantEdt.includes(classeId);
  return false;
}

// --- Affichage en lecture ------------------------------------------------

function afficherEdt() {
  const ligne = ligneCouranteEdt();
  const peutEditer = peutEditerClasseEdt(classeSelectionneeEdt);

  const selecteurClasse = lignesEdtDisponibles.length > 1
    ? `<select id="selectClasseEdt" class="edt-select-classe">${lignesEdtDisponibles.map(l => `<option value="${l.classeId}" ${l.classeId === classeSelectionneeEdt ? 'selected' : ''}>${echapperEdt(l.nom)}</option>`).join('')}</select>`
    : `<span class="edt-top-bar-titre">${echapperEdt(ligne.nom)}</span>`;

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">🗓️ Emploi du temps</div>
    <div class="sous-titre-page">Emploi du temps hebdomadaire officiel de la classe.</div>

    <div class="edt-carte">
      <div class="edt-entete">
        <h2>${echapperEdt(ligne.contenu.titre || 'Emploi du temps')}</h2>
        ${ligne.contenu.sousTitre ? `<p>${echapperEdt(ligne.contenu.sousTitre)}</p>` : ''}
      </div>

      <div class="edt-top-bar">
        ${selecteurClasse}
        <div class="edt-actions">
          ${peutEditer ? `<button type="button" class="edt-btn edt-btn-primaire" id="btnEditerEdt">✏️ Modifier</button>` : ''}
        </div>
      </div>

      ${!peutEditer ? `<div class="edt-info-lecture-seule">Emploi du temps en lecture seule.</div>` : ''}

      <div class="edt-table-scroll">${rendreTableauEdt(ligne.contenu)}</div>

      ${rendreRemarquesEdt(ligne.contenu)}

      <div class="edt-maj-info">Dernière modification : ${formaterDateHeureEdt(ligne.modifieLe)}</div>
    </div>
  `;

  const selectClasse = document.getElementById('selectClasseEdt');
  if (selectClasse) {
    selectClasse.addEventListener('change', (e) => {
      classeSelectionneeEdt = parseInt(e.target.value, 10);
      afficherEdt();
    });
  }
  const btnEditer = document.getElementById('btnEditerEdt');
  if (btnEditer) btnEditer.addEventListener('click', afficherFormulaireEditionEdt);
}

function rendreTableauEdt(contenu) {
  const jours = contenu.jours || [];
  const theadJours = jours.map(j => `<th${j === 'Mercredi' ? ' class="edt-th-mercredi"' : ''}>${echapperEdt(j)}</th>`).join('');

  const corpsLignes = (contenu.lignes || []).map(ligne => {
    const tdHoraire = `<td class="edt-col-horaire">${echapperEdt(ligne.horaire || '')}</td>`;
    let tds = '';

    if (ligne.type === 'special') {
      const groupes = ligne.groupes || [];
      const classeSpeciale = ligne.style === 'interclasse' ? 'edt-special-interclasse' : 'edt-special-recreation';
      jours.forEach(j => {
        // Seul le PREMIER jour d'un groupe déclenche un <td> (colspan couvre
        // le reste du groupe) ; un jour absent de tout groupe est recouvert
        // par le rowspan d'un bloc repos démarré sur une ligne précédente —
        // dans les deux autres cas, rien à émettre pour ce jour ici.
        const groupe = groupes.find(g => (g.jours || [])[0] === j);
        if (groupe) tds += `<td class="${classeSpeciale}" colspan="${groupe.jours.length}">${echapperEdt(groupe.libelle || '')}</td>`;
      });
    } else {
      jours.forEach(j => {
        if (ligne.repos && ligne.repos.jour === j) {
          tds += `<td class="edt-repos-cell" rowspan="${ligne.repos.span || 1}">${echapperEdt(ligne.repos.emoji || '')}<br><strong>${echapperEdt(ligne.repos.titre || '')}</strong>${ligne.repos.sousTexte ? `<span class="edt-repos-sous">${echapperEdt(ligne.repos.sousTexte)}</span>` : ''}</td>`;
        } else if (ligne.cellules && Object.prototype.hasOwnProperty.call(ligne.cellules, j)) {
          tds += `<td>${(ligne.cellules[j] || []).map(rendrePuceEdt).join('')}</td>`;
        }
        // sinon : jour recouvert par le rowspan d'un bloc repos précédent —
        // aucune cellule à émettre sur cette ligne pour ce jour.
      });
    }

    return `<tr>${tdHoraire}${tds}</tr>`;
  }).join('');

  return `<table class="edt-table"><thead><tr><th>Horaires</th>${theadJours}</tr></thead><tbody>${corpsLignes}</tbody></table>`;
}

// "Français (60 min)" -> puce avec la durée en gris ; "**Dictée** (60 min)"
// -> le texte principal (hors durée) entre ** est mis en accent.
function rendrePuceEdt(texte) {
  const m = String(texte || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const principal = m ? m[1] : String(texte || '');
  const duree = m ? m[2] : '';
  const html = echapperEdt(principal).replace(/\*\*(.+?)\*\*/g, '<span class="edt-accent">$1</span>');
  return `<div class="edt-ligne-puce">• ${html}${duree ? ` <span class="edt-duree">(${echapperEdt(duree)})</span>` : ''}</div>`;
}

function rendreRemarquesEdt(contenu) {
  const remarques = contenu.remarques || [];
  if (!remarques.length) return '';
  return `<div class="edt-remarques"><h3>📌 Remarques officielles :</h3><ul>${remarques.map(r => `<li>${echapperEdt(r)}</li>`).join('')}</ul></div>`;
}

function formaterDateHeureEdt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function echapperEdt(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

// --- Édition (admin + enseignant de la classe) ---------------------------
//
// La grille reste structurellement fixe : ce formulaire permet uniquement de
// modifier des TEXTES (horaires, lignes d'activité, libellés de ligne
// spéciale, textes du bloc repos, remarques, titre/sous-titre) — jamais
// d'ajouter/retirer une ligne ou de changer quel jour est fusionné avec quel
// autre (même principe que "Planification mensuelle").

function afficherFormulaireEditionEdt() {
  const ligne = ligneCouranteEdt();
  const contenu = ligne.contenu;
  const jours = contenu.jours || [];

  const blocsLignes = (contenu.lignes || []).map((l, i) => {
    let champsJours;

    if (l.type === 'special') {
      champsJours = `<div class="edt-edit-ligne-grille">${(l.groupes || []).map((g, gi) => `
        <div class="edt-edit-champ">
          <span class="edt-edit-groupe-label">${echapperEdt((g.jours || []).join(', '))}</span>
          <input type="text" data-ligne="${i}" data-groupe="${gi}" data-champ="groupe-libelle" value="${echapperEdt(g.libelle || '')}">
        </div>`).join('')}</div>`;
    } else {
      champsJours = `<div class="edt-edit-ligne-grille">${jours.map(j => {
        if (l.repos && l.repos.jour === j) {
          return `
            <div class="edt-edit-champ">
              <label>${echapperEdt(j)} — bloc repos</label>
              <input type="text" data-ligne="${i}" data-champ="repos-emoji" value="${echapperEdt(l.repos.emoji || '')}" placeholder="Emoji (ex : 🏠)">
              <input type="text" data-ligne="${i}" data-champ="repos-titre" value="${echapperEdt(l.repos.titre || '')}" placeholder="Titre (ex : REPOS)" style="margin-top:6px">
              <input type="text" data-ligne="${i}" data-champ="repos-sousTexte" value="${echapperEdt(l.repos.sousTexte || '')}" placeholder="Sous-texte" style="margin-top:6px">
            </div>`;
        }
        if (l.cellules && Object.prototype.hasOwnProperty.call(l.cellules, j)) {
          return `
            <div class="edt-edit-champ">
              <label>${echapperEdt(j)} <span class="edt-edit-astuce">(une activité par ligne, **texte** = accent)</span></label>
              <textarea data-ligne="${i}" data-jour="${echapperEdt(j)}" data-champ="cellule">${echapperEdt((l.cellules[j] || []).join('\n'))}</textarea>
            </div>`;
        }
        return ''; // recouvert par un bloc repos d'une ligne précédente : rien à éditer ici
      }).join('')}</div>`;
    }

    return `
      <div class="edt-edit-bloc">
        <div class="edt-edit-bloc-titre">${l.type === 'special' ? '⏸️ Ligne spéciale' : '📚 Ligne de cours'}</div>
        <div class="edt-edit-champ">
          <label>Horaire</label>
          <input type="text" data-ligne="${i}" data-champ="horaire" value="${echapperEdt(l.horaire || '')}">
        </div>
        ${champsJours}
      </div>`;
  }).join('');

  document.getElementById('contenu').innerHTML = `
    <div class="titre-page">🗓️ Emploi du temps — modification</div>
    <div class="sous-titre-page">La structure du tableau (lignes, colonnes, fusions) est fixe ; seul le contenu (textes, horaires) est modifiable.</div>

    <div class="edt-carte">
      <div class="edt-edit-zone">
        <div class="edt-edit-bloc">
          <div class="edt-edit-bloc-titre">🏷️ En-tête</div>
          <div class="edt-edit-champ"><label>Titre</label><input type="text" id="edtChampTitre" value="${echapperEdt(contenu.titre || '')}"></div>
          <div class="edt-edit-champ"><label>Sous-titre</label><input type="text" id="edtChampSousTitre" value="${echapperEdt(contenu.sousTitre || '')}"></div>
        </div>

        ${blocsLignes}

        <div class="edt-edit-bloc">
          <div class="edt-edit-bloc-titre">📌 Remarques officielles</div>
          <div class="edt-edit-champ">
            <label>Une remarque par ligne</label>
            <textarea id="edtChampRemarques" style="min-height:100px">${echapperEdt((contenu.remarques || []).join('\n'))}</textarea>
          </div>
        </div>

        <div class="edt-edit-actions">
          <button type="button" class="edt-btn edt-btn-secondaire" id="btnAnnulerEditionEdt">Annuler</button>
          <button type="button" class="edt-btn edt-btn-succes" id="btnEnregistrerEditionEdt">💾 Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnAnnulerEditionEdt').addEventListener('click', afficherEdt);
  document.getElementById('btnEnregistrerEditionEdt').addEventListener('click', enregistrerEditionEdt);
}

async function enregistrerEditionEdt() {
  // Vérification défensive côté client (en plus de la policy RLS
  // emplois_du_temps_ecriture, seule vraie barrière) : évite un aller-retour
  // réseau inutile si le rôle courant ne peut de toute façon pas éditer
  // cette classe (ex. changement d'onglet resté ouvert après un retrait de
  // classe assignée côté admin).
  if (!peutEditerClasseEdt(classeSelectionneeEdt)) { alert("Vous n'avez plus le droit de modifier cet emploi du temps."); afficherEdt(); return; }

  const ligne = ligneCouranteEdt();
  const contenu = JSON.parse(JSON.stringify(ligne.contenu)); // clone profond

  contenu.titre = document.getElementById('edtChampTitre').value.trim();
  contenu.sousTitre = document.getElementById('edtChampSousTitre').value.trim();
  contenu.remarques = document.getElementById('edtChampRemarques').value.split('\n').map(s => s.trim()).filter(Boolean);

  document.querySelectorAll('[data-champ="horaire"]').forEach(input => {
    const i = parseInt(input.dataset.ligne, 10);
    if (contenu.lignes[i]) contenu.lignes[i].horaire = input.value.trim();
  });
  document.querySelectorAll('[data-champ="cellule"]').forEach(textarea => {
    const i = parseInt(textarea.dataset.ligne, 10);
    const jour = textarea.dataset.jour;
    if (contenu.lignes[i]?.cellules) contenu.lignes[i].cellules[jour] = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
  });
  document.querySelectorAll('[data-champ="repos-emoji"]').forEach(input => {
    const i = parseInt(input.dataset.ligne, 10);
    if (contenu.lignes[i]?.repos) contenu.lignes[i].repos.emoji = input.value.trim();
  });
  document.querySelectorAll('[data-champ="repos-titre"]').forEach(input => {
    const i = parseInt(input.dataset.ligne, 10);
    if (contenu.lignes[i]?.repos) contenu.lignes[i].repos.titre = input.value.trim();
  });
  document.querySelectorAll('[data-champ="repos-sousTexte"]').forEach(input => {
    const i = parseInt(input.dataset.ligne, 10);
    if (contenu.lignes[i]?.repos) contenu.lignes[i].repos.sousTexte = input.value.trim();
  });
  document.querySelectorAll('[data-champ="groupe-libelle"]').forEach(input => {
    const i = parseInt(input.dataset.ligne, 10);
    const gi = parseInt(input.dataset.groupe, 10);
    if (contenu.lignes[i]?.groupes?.[gi]) contenu.lignes[i].groupes[gi].libelle = input.value.trim();
  });

  const bouton = document.getElementById('btnEnregistrerEditionEdt');
  bouton.disabled = true;
  bouton.textContent = 'Enregistrement...';

  const { error } = await supabaseClient.from('emplois_du_temps')
    .update({ contenu, modifie_par: profilEdt.id, modifie_le: new Date().toISOString() })
    .eq('classe_id', classeSelectionneeEdt);

  if (error) {
    alert("Erreur lors de l'enregistrement : " + error.message);
    bouton.disabled = false;
    bouton.textContent = '💾 Enregistrer';
    return;
  }

  ligne.contenu = contenu;
  ligne.modifieLe = new Date().toISOString();
  afficherEdt();
}
