// Supabase Edge Function « formation-ia-outils » (26 septembre 2026).
// Outils IA réservés aux avantages des packs / de l'abonnement (niveau du
// formateur : formation_niveau_effectif ; les gestionnaires KEKELI ont tout).
//   niveau 1 « Formateur Plus »  : vente (texte de vente + messages réseaux),
//                                  corriger (orthographe et style), resume
//   niveau 2 « Formateur Pro »   : tests (tests en leçon), diaporama
// Inclus dans l'avantage : aucun crédit décompté ; limite quotidienne
// (formation_ia_parametres.limite_outils_jour).
// IA : Gemini clé GRATUITE → clé PAYANTE si quota dépassé (429) → ChatGPT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_KEY_PAYANT = Deno.env.get("GEMINI_API_KEY_PAYANT");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const txt = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const NIVEAU_REQUIS: Record<string, number> = { vente: 1, corriger: 1, resume: 1, tests: 2, diaporama: 2 };
const NOM_NIVEAU = ["", "Formateur Plus", "Formateur Pro", "Formateur Premium"];

type Admin = ReturnType<typeof createClient>;
async function suivre(admin: Admin, uid: string, source: string, fournisseur: string, modele: string, entree: number, sortie: number) {
  await Promise.resolve(admin.rpc("formation_ia_enregistrer_usage", { p_source: source, p_modele: modele, p_entree: entree, p_sortie: sortie, p_formateur: uid, p_fournisseur: fournisseur })).catch(() => {});
}
function lireJSON(brut: string): Record<string, unknown> | null {
  try { const m = brut.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : brut); } catch { return null; }
}
async function genererJSON(prompt: string, maxTokens: number, admin: Admin, uid: string, source: string, modeleOpenAI: string): Promise<Record<string, unknown>> {
  const cles: [string, string][] = [];
  if (GEMINI_API_KEY) cles.push([GEMINI_API_KEY, "gemini_gratuit"]);
  if (GEMINI_API_KEY_PAYANT) cles.push([GEMINI_API_KEY_PAYANT, "gemini_payant"]);
  for (const [cle, fournisseur] of cles) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 120000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST", signal: c.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const d = await r.json().catch(() => ({}));
      const brut = (d?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      if (r.ok && brut.trim()) {
        const um = d?.usageMetadata || {};
        await suivre(admin, uid, source, fournisseur, GEMINI_MODEL, Number(um.promptTokenCount) || 0, Number(um.candidatesTokenCount) || 0);
        const j = lireJSON(brut);
        if (j) return j;
        break;
      }
      console.error("gemini", fournisseur, r.status, d?.error?.message);
      if (!(r.status === 429 || d?.error?.status === "RESOURCE_EXHAUSTED")) break;
    } catch (e) { console.error("gemini", fournisseur, (e as Error).message); break; } finally { clearTimeout(t); }
  }
  if (!OPENAI_API_KEY) throw new Error("L'IA est momentanément indisponible. Réessayez dans un instant.");
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 120000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: c.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: modeleOpenAI || "gpt-6-sol", messages: [{ role: "user", content: prompt }], reasoning_effort: "low", max_completion_tokens: maxTokens, response_format: { type: "json_object" } }),
    });
    const d = await r.json().catch(() => ({}));
    if (d?.usage) await suivre(admin, uid, source, "openai", String(d.model || modeleOpenAI), Number(d.usage.prompt_tokens) || 0, Number(d.usage.completion_tokens) || 0);
    if (!r.ok) {
      if (d?.error?.code === "insufficient_quota") await Promise.resolve(admin.rpc("formation_ia_signaler_quota_openai", { p_message: String(d?.error?.message || "insufficient_quota") })).catch(() => {});
      throw new Error("L'IA est momentanément indisponible. Réessayez dans un instant.");
    }
    const j = lireJSON(d?.choices?.[0]?.message?.content || "");
    if (!j) throw new Error("Réponse de l'IA illisible. Réessayez.");
    return j;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("L'IA met trop de temps à répondre. Réessayez.");
    throw e;
  } finally { clearTimeout(t); }
}

function texteBrut(html: string): string {
  return String(html || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
function htmlSur(h: string): string {
  return String(h || "").slice(0, 80000)
    .replace(/<(script|style|iframe|object|embed|form|input|button|link|meta)[\s\S]*?(<\/\1>|>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}
const FORMAT_HTML = "HTML simple UNIQUEMENT avec les balises h2, h3, p, ul, ol, li, strong, em, blockquote, table, tr, th, td ; pas de CSS, pas de script, pas d'image.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Connectez-vous." }, 401);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await client.auth.getUser();
  if (!u?.user) return json({ error: "Session expirée : reconnectez-vous." }, 401);
  const uid = u.user.id;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const action = String(body.action || "");
  if (!NIVEAU_REQUIS[action]) return json({ error: "Outil inconnu." }, 400);
  const formationId = Number(body.formationId);
  if (!formationId) return json({ error: "Formation manquante." }, 400);
  const { data: peut } = await client.rpc("peut_editer_formation", { p_id: uid, p_formation_id: formationId });
  if (peut !== true) return json({ error: "Vous ne pouvez pas modifier cette formation." }, 403);

  const [{ data: niveau }, { data: par }] = await Promise.all([
    admin.rpc("formation_niveau_effectif", { p_id: uid }),
    admin.from("formation_ia_parametres").select("modele, actif, limite_outils_jour").eq("id", 1).maybeSingle(),
  ]);
  const requis = NIVEAU_REQUIS[action];
  if ((Number(niveau) || 0) < requis) return json({ error: `Cet outil fait partie des avantages « ${NOM_NIVEAU[requis]} ». Découvrez les packs dans « Mes crédits IA ».`, code: "NIVEAU", requis }, 403);
  if (par && par.actif === false) return json({ error: "L'IA est momentanément désactivée par KEKELI." }, 503);
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("formation_ia_usage").select("*", { count: "exact", head: true }).eq("utilisateur_id", uid).not("outil", "is", null).gte("cree_le", depuis);
  const limite = Number(par?.limite_outils_jour ?? 30);
  if ((count || 0) >= limite) return json({ error: `Limite atteinte : ${limite} utilisations des outils IA par 24 heures.` }, 429);
  const modele = par?.modele || "gpt-6-sol";
  const source = `outil_${action}`;
  const html = String(body.html || "").slice(0, 60000);
  const titreLecon = txt(body.titre, 200);

  try {
    let res: Record<string, unknown> = {};
    if (action === "vente") {
      const { data: f } = await admin.from("formations").select("titre, sous_titre, description, niveau, prix, devise").eq("id", formationId).single();
      const [{ data: mods }, { data: les }] = await Promise.all([
        admin.from("formation_modules").select("id, titre, position").eq("formation_id", formationId).order("position"),
        admin.from("formation_lecons").select("titre, module_id, position").eq("formation_id", formationId).order("position"),
      ]);
      const plan = (mods || []).map((m) => `- ${m.titre} : ${(les || []).filter((l) => l.module_id === m.id).map((l) => l.titre).join(" ; ")}`).join("\n");
      const j = await genererJSON(`Tu es un expert en marketing de formations en ligne en Afrique francophone (Bénin, Togo, Côte d'Ivoire, Sénégal…).
Formation KEKELI : « ${f?.titre} »${f?.sous_titre ? ` — ${f.sous_titre}` : ""}. Prix : ${f?.prix ? `${f.prix} FCFA` : "gratuit"}.
Description actuelle : ${texteBrut(f?.description || "").slice(0, 3000)}
Programme :
${plan.slice(0, 4000)}
Rédige en FRANÇAIS, ton chaleureux, concret et crédible (pas de promesses exagérées) :
{"titres":["3 titres accrocheurs (max 90 caractères)"],"sous_titre":"(une phrase)","description_html":"(3 à 5 paragraphes + une liste « Ce que vous saurez faire » ; ${FORMAT_HTML})",
 "whatsapp":"(message WhatsApp de 60 à 110 mots avec 2-4 émojis et un appel à l'action ; mettre [LIEN] pour le lien)",
 "facebook":"(publication Facebook de 80 à 150 mots avec émojis, 3-5 hashtags, et [LIEN])",
 "statut":"(statut WhatsApp ou SMS très court, max 160 caractères, avec [LIEN])"}
Réponds UNIQUEMENT avec cet objet JSON strict.`, 4000, admin, uid, source, modele);
      res = {
        titres: (Array.isArray(j.titres) ? j.titres : []).map((x) => txt(x, 120)).filter(Boolean).slice(0, 3),
        sous_titre: txt(j.sous_titre, 200), description_html: htmlSur(String(j.description_html || "")),
        whatsapp: txt(j.whatsapp, 1500), facebook: txt(j.facebook, 2000), statut: txt(j.statut, 300),
      };
    } else if (action === "corriger") {
      if (texteBrut(html).length < 30) return json({ error: "La leçon est vide." }, 400);
      const j = await genererJSON(`Tu es correcteur professionnel en français. Corrige l'orthographe, la grammaire, la ponctuation et améliore légèrement le style (clarté, phrases plus fluides) du HTML ci-dessous, SANS changer le sens ni la structure.
RÈGLES ABSOLUES : garde EXACTEMENT toutes les balises et tous leurs attributs (en particulier data-activite, data-bloc, data-presentation, style, class, href, src) ; ne supprime, n'ajoute ni ne déplace aucun élément ; modifie seulement le texte.
Réponds UNIQUEMENT avec un objet JSON strict : {"html":"…le HTML corrigé…","nb_corrections":12,"resume":"(1 phrase sur les principales corrections)"}
HTML :
${html}`, 16000, admin, uid, source, modele);
      const sortie = htmlSur(String(j.html || ""));
      const compter = (h: string, re: RegExp) => (h.match(re) || []).length;
      const reperes = [/data-activite=/g, /data-bloc=/g, /data-presentation=/g, /<img\b/g];
      if (!sortie || reperes.some((re) => compter(sortie, re) !== compter(html, re))) {
        return json({ error: "La correction a modifié la structure de la leçon : elle n'a pas été appliquée. Réessayez." }, 502);
      }
      res = { html: sortie, nb_corrections: Number(j.nb_corrections) || null, resume: txt(j.resume, 400) };
    } else if (action === "resume") {
      if (texteBrut(html).length < 80) return json({ error: "La leçon est trop courte pour être résumée." }, 400);
      const j = await genererJSON(`Résume en FRANÇAIS la leçon « ${titreLecon} » ci-dessous pour des apprenants adultes : 4 à 7 points essentiels, phrases courtes, fidèles au contenu.
Réponds UNIQUEMENT avec un objet JSON strict : {"points":["…","…"]}
LEÇON :
${texteBrut(html).slice(0, 20000)}`, 2000, admin, uid, source, modele);
      const points = (Array.isArray(j.points) ? j.points : []).map((x) => txt(x, 300)).filter(Boolean).slice(0, 8);
      if (!points.length) return json({ error: "Résumé impossible. Réessayez." }, 502);
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      res = { html: `<div data-bloc="encadre" style="background-color: #e8f5e9"><p><strong>📌 En résumé</strong></p><ul>${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`, points };
    } else if (action === "tests") {
      if (texteBrut(html).length < 80) return json({ error: "La leçon est trop courte pour créer des tests." }, 400);
      const nb = Math.min(4, Math.max(1, Number(body.nombre) || 3));
      const j = await genererJSON(`Crée ${nb} « points de contrôle » (petits tests corrigés immédiatement) en FRANÇAIS pour vérifier la compréhension de la leçon « ${titreLecon} » ci-dessous.
Varie : questions à choix unique (3 ou 4 choix, UNE seule bonne réponse) et vrai/faux. Chaque test a une explication courte qui justifie la bonne réponse.
Réponds UNIQUEMENT avec un objet JSON strict :
{"tests":[{"type":"choix_unique","titre":"(3 à 6 mots)","enonce":"…","choix":[{"texte":"…","correcte":true},{"texte":"…","correcte":false}],"explication":"…"},
          {"type":"vrai_faux","titre":"…","enonce":"affirmation","choix":[{"texte":"Vrai","correcte":false},{"texte":"Faux","correcte":true}],"explication":"…"}]}
LEÇON :
${texteBrut(html).slice(0, 20000)}`, 4000, admin, uid, source, modele);
      const tests = (Array.isArray(j.tests) ? j.tests : []).map((t: Record<string, unknown>) => {
        const type = t?.type === "vrai_faux" ? "vrai_faux" : "choix_unique";
        let choix = (Array.isArray(t?.choix) ? t.choix : []).map((c: Record<string, unknown>) => ({ texte: txt(c?.texte, 300), correcte: c?.correcte === true || c?.correcte === "true" })).filter((c: { texte: string }) => c.texte).slice(0, 6);
        if (type === "vrai_faux") { const v = choix.find((c: { texte: string }) => /^vrai$/i.test(c.texte))?.correcte ?? true; choix = [{ texte: "Vrai", correcte: !!v }, { texte: "Faux", correcte: !v }]; }
        if (!txt(t?.enonce) || choix.length < 2 || choix.filter((c: { correcte: boolean }) => c.correcte).length !== 1) return null;
        return { type, titre: txt(t?.titre, 80) || null, enonce: txt(t?.enonce, 1000), choix, explication: txt(t?.explication, 1000) || null };
      }).filter(Boolean).slice(0, nb);
      if (!tests.length) return json({ error: "L'IA n'a pas produit de test exploitable. Réessayez." }, 502);
      res = { tests };
    } else if (action === "diaporama") {
      if (texteBrut(html).length < 80) return json({ error: "La leçon est trop courte pour un diaporama." }, 400);
      const nb = Math.min(15, Math.max(3, Number(body.nombre) || 7));
      const j = await genererJSON(`Transforme la leçon « ${titreLecon} » ci-dessous en diaporama de ${nb} diapositives environ, en FRANÇAIS, fidèle au contenu.
Chaque diapositive : un titre court et 3 à 5 puces concises (ou un court paragraphe / un exemple). Première diapositive = titre + objectif ; dernière = « À retenir ».
Réponds UNIQUEMENT avec un objet JSON strict : {"diapos":[{"titre":"…","puces":["…"],"texte":"(facultatif)"}]}
LEÇON :
${texteBrut(html).slice(0, 20000)}`, 6000, admin, uid, source, modele);
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const diapos = (Array.isArray(j.diapos) ? j.diapos : []).map((d: Record<string, unknown>) => {
        const titre = txt(d?.titre, 150); const puces = (Array.isArray(d?.puces) ? d.puces : []).map((x) => txt(x, 300)).filter(Boolean).slice(0, 7); const t = txt(d?.texte, 800);
        if (!titre && !puces.length && !t) return null;
        return `${titre ? `<h2>${esc(titre)}</h2>` : ""}${t ? `<p>${esc(t)}</p>` : ""}${puces.length ? `<ul>${puces.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}`;
      }).filter(Boolean).slice(0, 20);
      if (diapos.length < 2) return json({ error: "Diaporama impossible. Réessayez." }, 502);
      res = { html: diapos.join('<div data-bloc="diapo"></div>'), nb: diapos.length };
    }
    await admin.from("formation_ia_usage").insert({ utilisateur_id: uid, formation_id: formationId, nb_questions: 0, outil: action });
    return json(res);
  } catch (e) {
    return json({ error: (e as Error).message || "Erreur de l'IA." }, 500);
  }
});
