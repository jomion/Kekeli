// Aperçu en LECTURE SEULE du contenu d'une séance, bloc par bloc, regroupé
// par palier quand il y en a (5 septembre 2026, 3e passe — demande explicite :
// "adapter l'affichage des activités à celle des séquences ... avec les
// blocs clairement identifiables. Crée carrément un champ pour les titres
// [...]"). Reprend le même principe visuel que la vue "Paliers de cette
// séance" côté élève (js/pages/eleve-seance.js) et l'aperçu élève de
// l'éditeur (js/pages/editeur-seance.js) — un bandeau de couleur à gauche
// par bloc, un badge type + icône, regroupement par palier — mais en version
// compacte et strictement passive : aucune question interactive, aucun champ
// de réponse, aucun appel réseau vers la correction ou vers un corrigé (les
// corrigés vivent dans une table séparée, `corriges_exercices`, jamais
// chargée ici). Sert uniquement à voir d'un coup d'œil ce que contient une
// séance, depuis un listing.
//
// Fichier volontairement partagé (contrairement à d'autres bouts de logique
// dupliqués sur ce projet faute de module commun) car cette fonctionnalité
// est neuve : appelé depuis plusieurs pages qui n'ont pas de module commun
// (pages/seances.html, pages/admin/gestion-seances.html). Dépend de
// `infoType`/`teinteClaire` (js/editeur/blocs.js) — à charger avant ce
// fichier dans chaque page qui l'utilise.

const ORDRE_PALIER_APERCU_BLOCS = ['azovi', 'devi', 'ogan', 'axosu'];
const LIBELLES_PALIER_APERCU_BLOCS = { azovi: '🌱 Azɔ̀ví', devi: '🪘 Dèví', ogan: '🦁 Ògán', axosu: '👑 Axɔ́sú' };
const TYPES_TRAVAIL_APERCU_BLOCS = ['exercice', 'quiz', 'evaluation', 'activite'];
const TYPES_MASQUES_APERCU_BLOCS = ['titre', 'consigne']; // sections : seul leur contenu compte, comme le compteur "● N blocs" déjà en place

function echapperApercuBlocs(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Un court extrait textuel selon le type de bloc, pour les blocs de lecture
// (pas les exercices/activités, traités à part ci-dessous).
function extraitTexteApercuBloc(type, c) {
  if (type === 'image') return c.legende || '';
  if (type === 'video' || type === 'ressource') return c.nom || c.legende || '';
  if (type === 'formule') return c.formule || '';
  if (type === 'autre') return [c.nom, c.texte].filter(Boolean).join(' — ');
  return c.texte || '';
}

function rendreCarteApercuBloc(b) {
  const info = (typeof infoType === 'function') ? infoType(b.type_bloc) : { label: b.type_bloc, icone: '❔' };
  const c = b.contenu || {};
  const couleur = c.couleurBloc || info.couleur || '#64748B';
  const fond = (typeof teinteClaire === 'function') ? teinteClaire(couleur, 0.05) : `${couleur}0D`;
  const libelle = c.libelle || info.label;

  let corps;
  if (TYPES_TRAVAIL_APERCU_BLOCS.includes(b.type_bloc)) {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    corps = `${c.consigne ? `<p style="margin:4px 0 6px">${echapperApercuBlocs(c.consigne)}</p>` : ''}`
      + `<p style="margin:0;font-size:12px;color:#64748B">${questions.length ? `${questions.length} question${questions.length > 1 ? 's' : ''}` : 'Aucune question pour l\'instant'}</p>`;
  } else {
    const texte = extraitTexteApercuBloc(b.type_bloc, c).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const extrait = texte.slice(0, 160);
    corps = extrait
      ? `<p style="margin:4px 0 0">${echapperApercuBlocs(extrait)}${texte.length > 160 ? '…' : ''}</p>`
      : `<p style="margin:4px 0 0;font-style:italic;color:#94A3B8">(vide)</p>`;
  }

  return `<div style="border-left:3px solid ${couleur};background:${fond};border-radius:8px;padding:8px 12px;margin-bottom:8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.02em;color:${couleur};text-transform:uppercase">${info.icone} ${echapperApercuBlocs(libelle)}</div>
    ${corps}
  </div>`;
}

// blocsBruts : lignes de blocs_seance d'UNE séance (id, type_bloc, contenu,
// palier, parent_bloc_id, ordre) — un simple select() suffit, aucune jointure
// nécessaire. Ne traite que les blocs de premier niveau (les enfants d'une
// section Contenu/Consigne ne sont pas dépliés ici, pour rester un aperçu
// rapide plutôt qu'une reconstruction complète de la séance).
function rendreApercuContenuSeance(blocsBruts) {
  const blocs = (blocsBruts || [])
    .filter(b => !b.parent_bloc_id && !TYPES_MASQUES_APERCU_BLOCS.includes(b.type_bloc))
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  if (!blocs.length) return '<p style="color:#94A3B8;font-style:italic;padding:8px 2px">Aucun contenu pour l\'instant.</p>';

  const sansPalier = blocs.filter(b => !b.palier);
  const parPalier = {};
  blocs.filter(b => b.palier).forEach(b => { (parPalier[b.palier] ??= []).push(b); });

  let html = sansPalier.map(rendreCarteApercuBloc).join('');
  ORDRE_PALIER_APERCU_BLOCS.filter(p => parPalier[p]).forEach(p => {
    html += `<div style="font-size:12px;font-weight:700;color:#003366;margin:10px 0 6px">${LIBELLES_PALIER_APERCU_BLOCS[p]}</div>`
      + parPalier[p].map(rendreCarteApercuBloc).join('');
  });
  return `<div style="padding:10px 4px 2px">${html}</div>`;
}
