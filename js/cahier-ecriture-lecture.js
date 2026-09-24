// Module partagé "Consultation du cahier d'écriture d'un élève" — utilisé
// par pages/parent/suivi-enfant.html (le parent consulte le cahier de son
// enfant) et pages/enseignant/cahier-ecriture.html (l'enseignant consulte le
// cahier d'un élève qui l'y a autorisé via le contrôle parental).
//
// 24 septembre 2026 : demande explicite "Pour l'élève prévois dans le
// contrôle parental qui pourra consulter le cahier en plus de l'élève". La
// lecture s'appuie entièrement sur les policies RLS de la table
// cahiers_ecriture (voir migration cahier_ecriture_sauvegarde_cloud_premium) :
// un simple SELECT filtré par la base elle-même, jamais une vérification
// côté client — si l'appelant n'a pas le droit, la ligne ne revient
// simplement pas (ce n'est pas une erreur).
//
// Choix délibéré : la consultation se fait en LECTURE SEULE, en rejouant
// juste le texte sauvegardé (pas l'outil Seyes interactif complet). Rejouer
// l'outil lui-même dans un second <iframe> partagerait le MÊME localStorage
// (même origine) que le cahier PERSONNEL du parent/enseignant sur cette
// page, et écraserait son propre travail en cours — inacceptable. Le texte
// HTML sauvegardé (seyes-texte-principal / -marge / -marge-complementaire)
// est donc simplement affiché tel quel dans une modale, après un nettoyage
// défensif (on retire scripts/iframes/gestionnaires d'événements avant de
// l'insérer — un cahier d'un AUTRE utilisateur n'est plus "son propre
// contenu de confiance" comme il l'est pour l'outil d'origine).

const BALISES_INTERDITES_LECTURE_CAHIER = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'BASE']);

function _assainirApercuCahierLecture(html) {
  const conteneur = document.createElement('div');
  conteneur.innerHTML = html || '';
  const nettoyer = (noeud) => {
    [...noeud.childNodes].forEach((enfant) => {
      if (enfant.nodeType !== Node.ELEMENT_NODE) return;
      if (BALISES_INTERDITES_LECTURE_CAHIER.has(enfant.tagName)) {
        enfant.remove();
        return;
      }
      [...enfant.attributes].forEach((attr) => {
        const nom = attr.name.toLowerCase();
        const cible = (nom === 'href' || nom === 'src') && /^\s*javascript:/i.test(attr.value || '');
        if (nom.startsWith('on') || cible) enfant.removeAttribute(attr.name);
      });
      nettoyer(enfant);
    });
  };
  nettoyer(conteneur);
  return conteneur.innerHTML;
}

function _formaterDateLectureCahier(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// chargerEtAfficherCahierEleve(eleveId, nomAffiche)
// Charge le cahier sauvegardé de l'élève (via RLS) et l'ouvre dans une
// modale en lecture seule (ouvrirModal, voir js/modal.js — doit être chargé
// sur la page). Affiche un message clair si rien n'est encore sauvegardé, ou
// si l'accès est refusé par la base (jamais présenté comme une erreur).
async function chargerEtAfficherCahierEleve(eleveId, nomAffiche) {
  let ligne = null;
  try {
    const { data } = await supabaseClient.from('cahiers_ecriture').select('contenu, maj_le').eq('profil_id', eleveId).maybeSingle();
    ligne = data || null;
  } catch (_e) { /* traité comme "rien à afficher" ci-dessous */ }

  const contenu = ligne?.contenu || {};
  const texte = contenu['seyes-texte-principal'];
  const marge = contenu['seyes-texte-marge'];
  const margeComplementaire = contenu['seyes-texte-marge-complementaire'];
  const aDuContenu = [texte, marge, margeComplementaire].some(v => typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim().length > 0);

  if (!aDuContenu) {
    ouvrirModal({
      titre: `✍️ Cahier d'écriture — ${nomAffiche || 'élève'}`,
      champs: [{ type: 'html', label: '', valeur: `<p style="color:var(--text-gris)">Aucun cahier sauvegardé en ligne pour l'instant.</p>` }],
      texteValider: 'Fermer',
      onValider: () => {},
    });
    return;
  }

  const blocs = [texte, marge, margeComplementaire]
    .filter(v => typeof v === 'string' && v.trim())
    .map(v => `<div style="border:1px solid var(--bordure,#E2E8F0);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff">${_assainirApercuCahierLecture(v)}</div>`)
    .join('');

  ouvrirModal({
    titre: `✍️ Cahier d'écriture — ${nomAffiche || 'élève'}`,
    champs: [{
      type: 'html', label: '',
      valeur: `<p style="color:var(--text-gris);font-size:12.5px;margin:0 0 10px">Dernière sauvegarde en ligne : ${_formaterDateLectureCahier(ligne.maj_le)} — aperçu en lecture seule.</p>${blocs}`,
    }],
    texteValider: 'Fermer',
    onValider: () => {},
  });
}
