// Supabase Edge Function « formation-quiz-ia » (26 septembre 2026).
// Génère par IA des questions de quiz pour KEKELI Formation, à partir des
// leçons choisies par le formateur (ou d'un texte collé). Les questions sont
// RENVOYÉES au formateur, jamais enregistrées ici : il les relit, coche
// celles qu'il garde, puis l'éditeur les enregistre avec ses propres droits.
// Sécurité : seul un utilisateur qui peut modifier la formation
// (peut_editer_formation) peut appeler la fonction ; 40 générations par
// jour et par utilisateur au maximum (table formation_ia_usage).
// Depuis le 26 septembre 2026 : génération PAYANTE en crédits IA (essai
// gratuit de N questions, puis quota d'abonnement, puis solde — voir
// formation_ia_estimer / formation_ia_debiter). Seules les questions
// réellement produites sont débitées. Les gestionnaires KEKELI ne paient pas.
// IA utilisée : ChatGPT (OpenAI, secret OPENAI_API_KEY, modèle réglé dans
// formation_ia_parametres) ; Gemini puis Groq en secours.
// Chaque appel ChatGPT enregistre son coût réel (formation_ia_enregistrer_usage)
// pour suivre le solde OpenAI de KEKELI et alerter les gestionnaires.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIMITE_JOUR = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const TYPES: Record<string, string> = {
  choix_unique: `{"type":"choix_unique","enonce":"…","reponses":[{"texte":"…","correcte":true},{"texte":"…","correcte":false},…] (3 à 5 réponses, UNE seule correcte)}`,
  choix_multiple: `{"type":"choix_multiple","enonce":"…","reponses":[… 4 ou 5 réponses, AU MOINS DEUX correctes]}`,
  vrai_faux: `{"type":"vrai_faux","enonce":"affirmation","reponses":[{"texte":"Vrai","correcte":true|false},{"texte":"Faux","correcte":true|false}]}`,
  reponse_courte: `{"type":"reponse_courte","enonce":"question à réponse d'un ou deux mots","config":{"acceptees":["réponse","variante"]}}`,
  reponse_numerique: `{"type":"reponse_numerique","enonce":"…","config":{"valeur":12.5,"tolerance":0,"unite":"…"}}`,
  texte_a_trous: `{"type":"texte_a_trous","enonce":"phrase avec ___ à la place de chaque mot manquant","config":{"trous":[["mot","variante"],["mot2"]]}} (autant de listes que de ___)`,
  remise_en_ordre: `{"type":"remise_en_ordre","enonce":"Remettez dans l'ordre …","config":{"elements":["étape 1","étape 2","étape 3","étape 4"]}} (dans le BON ordre)`,
  association: `{"type":"association","enonce":"Associez …","config":{"paires":[{"gauche":"…","droite":"…"},… 3 à 6 paires]}}`,
};

function texteBrut(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

type Suivi = (u: { entree: number; sortie: number; modele: string } | null, quota?: string) => Promise<unknown>;
async function appelIA(prompt: string, modele: string, suivi?: Suivi): Promise<string | null> {
  const avecDelai = async (url: string, init: RequestInit, ms = 90000) => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
  };
  if (OPENAI_API_KEY) {
    try {
      const r = await avecDelai("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: modele || "gpt-6-sol", messages: [{ role: "user", content: prompt }], reasoning_effort: "low", max_completion_tokens: 12000, response_format: { type: "json_object" } }),
      });
      const d = await r.json();
      const t = d?.choices?.[0]?.message?.content || "";
      // Coût réel (jetons) enregistré pour suivre le solde OpenAI de KEKELI.
      if (d?.usage && suivi) await Promise.resolve(suivi({ entree: Number(d.usage.prompt_tokens) || 0, sortie: Number(d.usage.completion_tokens) || 0, modele: String(d.model || modele) })).catch(() => {});
      if (r.ok && t.trim()) return t;
      console.error("openai", r.status, d?.error?.message);
      if (suivi && (d?.error?.code === "insufficient_quota" || d?.error?.type === "insufficient_quota")) await Promise.resolve(suivi(null, d?.error?.message || "insufficient_quota")).catch(() => {});
    } catch (e) { console.error("openai", (e as Error).message); }
  }
  if (GEMINI_API_KEY) {
    try {
      const r = await avecDelai(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const d = await r.json();
      const t = (d?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      if (r.ok && t.trim()) return t;
    } catch { /* on essaie Groq */ }
  }
  if (GROQ_API_KEY) {
    try {
      const r = await avecDelai("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.5, max_tokens: 8192, response_format: { type: "json_object" } }),
      });
      const d = await r.json();
      const t = d?.choices?.[0]?.message?.content || "";
      if (r.ok && t.trim()) return t;
    } catch { /* échec */ }
  }
  return null;
}

type Q = { type: string; enonce: string; points: number; explication: string | null; reponses?: { texte: string; correcte: boolean }[]; config?: Record<string, unknown> };
const txt = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");

// Contrôle et remise en forme de chaque question proposée par l'IA.
function valider(brut: Record<string, unknown>, typesOk: string[]): Q | null {
  const type = txt(brut.type, 40);
  if (!typesOk.includes(type)) return null;
  const enonce = txt(brut.enonce, 2000);
  if (!enonce) return null;
  const q: Q = { type, enonce, points: 1, explication: txt(brut.explication, 1000) || null };
  const cfg = (brut.config && typeof brut.config === "object" ? brut.config : {}) as Record<string, unknown>;
  if (["choix_unique", "choix_multiple", "vrai_faux"].includes(type)) {
    let rep = Array.isArray(brut.reponses) ? (brut.reponses as Record<string, unknown>[]).map((r) => ({ texte: txt(r?.texte, 300), correcte: r?.correcte === true || r?.correcte === "true" })).filter((r) => r.texte) : [];
    if (type === "vrai_faux") {
      const vrai = rep.find((r) => /^vrai$/i.test(r.texte))?.correcte ?? rep[0]?.correcte ?? true;
      rep = [{ texte: "Vrai", correcte: !!vrai }, { texte: "Faux", correcte: !vrai }];
    }
    rep = rep.slice(0, 8);
    const nbOk = rep.filter((r) => r.correcte).length;
    if (rep.length < 2 || nbOk < 1) return null;
    if (type === "choix_unique" && nbOk !== 1) return null;
    if (type === "choix_multiple" && nbOk < 2) q.type = "choix_unique";
    q.reponses = rep;
    return q;
  }
  if (type === "reponse_courte") {
    const a = (Array.isArray(cfg.acceptees) ? cfg.acceptees : []).map((x) => txt(x, 200)).filter(Boolean).slice(0, 10);
    if (!a.length) return null;
    q.config = { acceptees: a }; return q;
  }
  if (type === "reponse_numerique") {
    const v = Number(String(cfg.valeur ?? "").replace(",", "."));
    if (!Number.isFinite(v)) return null;
    q.config = { valeur: v, tolerance: Math.abs(Number(cfg.tolerance) || 0), unite: txt(cfg.unite, 20) }; return q;
  }
  if (type === "texte_a_trous") {
    const n = (enonce.match(/___/g) || []).length;
    const trous = (Array.isArray(cfg.trous) ? cfg.trous : []).map((t) => (Array.isArray(t) ? t : [t]).map((x) => txt(x, 100)).filter(Boolean));
    if (!n || trous.length < n || trous.slice(0, n).some((t) => !t.length)) return null;
    q.config = { trous: trous.slice(0, n) }; return q;
  }
  if (type === "remise_en_ordre") {
    const el = (Array.isArray(cfg.elements) ? cfg.elements : []).map((x) => txt(x, 200)).filter(Boolean).slice(0, 10);
    if (el.length < 3) return null;
    q.config = { elements: el }; return q;
  }
  if (type === "association") {
    const p = (Array.isArray(cfg.paires) ? cfg.paires : []).map((x: Record<string, unknown>) => ({ gauche: txt(x?.gauche, 200), droite: txt(x?.droite, 200) })).filter((x) => x.gauche && x.droite).slice(0, 10);
    if (p.length < 2) return null;
    q.config = { paires: p }; return q;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Authentification requise." }, 401);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await client.auth.getUser();
  if (!u?.user) return json({ error: "Session invalide." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const formationId = Number(body.formationId);
  if (!formationId) return json({ error: "Formation manquante." }, 400);
  const { data: peut } = await client.rpc("peut_editer_formation", { p_id: u.user.id, p_formation_id: formationId });
  if (peut !== true) return json({ error: "Vous ne pouvez pas modifier cette formation." }, 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("formation_ia_usage").select("*", { count: "exact", head: true }).eq("utilisateur_id", u.user.id).gte("cree_le", depuis);
  if ((count || 0) >= LIMITE_JOUR) return json({ error: `Limite atteinte : ${LIMITE_JOUR} générations par 24 heures. Réessayez plus tard.` }, 429);

  const userId = u.user.id;
  const nb = Math.min(20, Math.max(1, Number(body.nombre) || 5));
  // Crédits IA : vérification AVANT d'appeler l'IA (rien n'est débité ici).
  const { data: gestion } = await admin.rpc("peut_gerer_formations", { p_id: u.user.id });
  const gratuit = gestion === true;
  const { data: par } = await admin.from("formation_ia_parametres").select("modele, actif").eq("id", 1).maybeSingle();
  if (!gratuit) {
    const { data: est, error: errEst } = await admin.rpc("formation_ia_estimer", { p_formateur: u.user.id, p_type: "quiz", p_questions: nb });
    if (errEst) return json({ error: "Vérification des crédits impossible." }, 500);
    if (!est?.ok) return json({ error: est?.erreur || "Crédits IA insuffisants.", code: "CREDITS", essai: est?.essai, disponible: est?.disponible, cout: est?.cout }, 402);
  }
  const typesOk = (Array.isArray(body.types) ? body.types : ["choix_unique"]).map(String).filter((t) => TYPES[t]);
  if (!typesOk.length) return json({ error: "Choisissez au moins un type de question." }, 400);
  const niveau = ["debutant", "intermediaire", "avance"].includes(String(body.niveau)) ? String(body.niveau) : "intermediaire";
  const consignes = txt(body.consignes, 800);

  // Source : leçons de la formation choisies par le formateur, et/ou texte collé.
  let source = txt(body.texte, 20000);
  const ids = (Array.isArray(body.leconIds) ? body.leconIds : []).map(Number).filter(Boolean).slice(0, 30);
  if (ids.length) {
    const { data: lecons } = await admin.from("formation_lecons").select("titre, contenu, page_html, description").eq("formation_id", formationId).in("id", ids);
    source += "\n\n" + (lecons || []).map((l) => `### ${l.titre}\n${l.description || ""}\n${texteBrut(l.page_html || l.contenu || "")}`).join("\n\n");
  }
  source = source.trim().slice(0, 24000);
  const { data: f } = await admin.from("formations").select("titre, sous_titre").eq("id", formationId).single();
  if (source.length < 80) return json({ error: "Pas assez de contenu : choisissez des leçons qui ont du texte, ou collez un texte source." }, 400);

  const prompt = `Tu es un concepteur pédagogique pour la plateforme de formation en ligne KEKELI (public : adultes, Afrique francophone).
Formation : « ${f?.titre || ""} »${f?.sous_titre ? ` — ${f.sous_titre}` : ""}.
Crée exactement ${nb} questions de quiz en FRANÇAIS, niveau ${ { debutant: "débutant", intermediaire: "intermédiaire", avance: "avancé" }[niveau] }, qui vérifient la compréhension du CONTENU CI-DESSOUS (pas de culture générale hors contenu).
Varie les types parmi : ${typesOk.join(", ")}. Formulations claires, sans ambiguïté, une seule interprétation possible ; pas de « toutes les réponses ci-dessus ».
Chaque question a une "explication" courte (1 à 2 phrases) qui justifie la bonne réponse en s'appuyant sur le contenu.
${consignes ? `Consignes du formateur : ${consignes}\n` : ""}
Formats exacts attendus (un par type) :
${typesOk.map((t) => "- " + TYPES[t]).join("\n")}
Chaque objet contient aussi "explication".
Réponds UNIQUEMENT avec un objet JSON strict : {"questions":[ … ]}

CONTENU :
"""
${source}
"""`;

  const suivi: Suivi = (conso, quota) => Promise.resolve(quota || !conso
    ? admin.rpc("formation_ia_signaler_quota_openai", { p_message: quota || "quota" })
    : admin.rpc("formation_ia_enregistrer_usage", { p_source: "quiz", p_modele: conso.modele, p_entree: conso.entree, p_sortie: conso.sortie, p_formateur: userId }));
  const brut = await appelIA(prompt, par?.modele || "gpt-6-sol", suivi);
  if (!brut) return json({ error: "Le service d'IA est momentanément indisponible. Réessayez dans quelques instants." }, 503);
  let liste: unknown[] = [];
  try {
    const m = brut.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const p = JSON.parse(m ? m[0] : brut);
    liste = Array.isArray(p) ? p : Array.isArray(p?.questions) ? p.questions : [];
  } catch { return json({ error: "Réponse de l'IA illisible. Réessayez." }, 502); }
  const questions = liste.map((x) => (x && typeof x === "object" ? valider(x as Record<string, unknown>, typesOk) : null)).filter(Boolean).slice(0, nb);
  await admin.from("formation_ia_usage").insert({ utilisateur_id: u.user.id, formation_id: formationId, nb_questions: questions.length });
  if (!questions.length) return json({ error: "L'IA n'a pas produit de question exploitable. Réessayez ou précisez les consignes. Aucun crédit n'a été utilisé." }, 502);
  // Débit des seules questions produites.
  let debit: Record<string, unknown> | null = null;
  if (!gratuit) {
    const { data: d, error: errDebit } = await admin.rpc("formation_ia_debiter", { p_formateur: u.user.id, p_type: "quiz", p_questions: questions.length, p_details: { formation_id: formationId, questions: questions.length } });
    if (errDebit) return json({ error: String(errDebit.message || "").replace(/^CREDITS_INSUFFISANTS:\s*/, ""), code: "CREDITS" }, 402);
    debit = d;
  }
  return json({ questions, debit, gratuit });
});
