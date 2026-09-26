// Supabase Edge Function « formation-ia-generer » (26 septembre 2026).
// Génère une formation complète par IA (Gemini ou ChatGPT) pour un formateur
// validé de KEKELI Formation : plan (titre, description, modules, leçons)
// puis contenu rédigé de chaque leçon, module par module (plusieurs appels
// courts plutôt qu'un seul très long, pour rester sous la limite de durée
// d'une fonction). La formation est créée en BROUILLON, avec les droits du
// formateur (RLS habituelles) : il relit, modifie, puis la soumet comme
// d'habitude.
//
// Deux façons de générer (27 septembre 2026), selon le pack ou l'abonnement :
//  • « module » (module par module) — tout formateur ayant un pack ou un
//    abonnement actif (niveau ≥ niveau_generation_module) : le plan coûte
//    credits_plan, puis CHAQUE module rédigé coûte credits_module, débité au
//    moment où le formateur le demande (remboursé si l'IA échoue) ;
//  • « complet » (toute la formation d'un coup) — réservé aux packs /
//    abonnements qui l'incluent (formation_ia_peut_generer_complet) : un prix
//    unique credits_formation, moins cher que la somme des modules, débité à
//    l'étape « plan » ; tous les modules sont ensuite inclus (3 essais chacun).
// Les crédits sont remboursés automatiquement en cas d'échec. Les
// gestionnaires KEKELI ne paient pas et ont accès aux deux modes.
//
// Actions (POST JSON, utilisateur connecté) :
//   estimer     — coûts des deux modes, droits et crédits disponibles
//   plan        — { mode, sujet, public, niveau, nbModules, leconsParModule, consignes }
//   module      — { generationId, index }
//   en_cours    — générations inachevées (pour reprendre plus tard)
// IA (26 septembre 2026) : réglage admin formation_ia_parametres.ia_formation.
//   « gemini » (défaut) : Gemini clé GRATUITE → si quota dépassé (429), clé
//                         PAYANTE → sinon ChatGPT en dernier secours ;
//   « chatgpt »         : ChatGPT d'abord, puis Gemini (gratuit → payant).
// Secrets : GEMINI_API_KEY (projet gratuit), GEMINI_API_KEY_PAYANT (projet
// payant), OPENAI_API_KEY (Supabase → Edge Functions → Secrets).
// Chaque appel ChatGPT enregistre son coût réel (formation_ia_enregistrer_usage)
// pour suivre le solde OpenAI de KEKELI et alerter les gestionnaires.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); // projet Google AI Studio GRATUIT (A)
const GEMINI_API_KEY_PAYANT = Deno.env.get("GEMINI_API_KEY_PAYANT"); // projet PAYANT (B), seulement si A dépasse son quota
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
const NIVEAUX: Record<string, string> = { debutant: "débutant", intermediaire: "intermédiaire", avance: "avancé", tous: "tous niveaux" };

type Suivi = { admin: ReturnType<typeof createClient>; uid: string; source: string };
async function openai(prompt: string, modele: string, maxTokens: number, suivi?: Suivi): Promise<Record<string, unknown>> {
  if (!OPENAI_API_KEY) throw new Error("La génération par IA n'est pas encore configurée (aucune clé Gemini ni OpenAI).");
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 140000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: c.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: modele || "gpt-6-sol", messages: [{ role: "user", content: prompt }], reasoning_effort: "low", max_completion_tokens: maxTokens, response_format: { type: "json_object" } }),
    });
    const d = await r.json().catch(() => ({}));
    // Coût réel (jetons) enregistré pour suivre le solde OpenAI de KEKELI.
    if (suivi && d?.usage) await Promise.resolve(suivi.admin.rpc("formation_ia_enregistrer_usage", { p_source: suivi.source, p_modele: String(d.model || modele), p_entree: Number(d.usage.prompt_tokens) || 0, p_sortie: Number(d.usage.completion_tokens) || 0, p_formateur: suivi.uid })).catch(() => {});
    if (!r.ok) {
      console.error("openai", r.status, d?.error?.message);
      if (suivi && (d?.error?.code === "insufficient_quota" || d?.error?.type === "insufficient_quota")) {
        await Promise.resolve(suivi.admin.rpc("formation_ia_signaler_quota_openai", { p_message: String(d?.error?.message || "insufficient_quota") })).catch(() => {});
        throw new Error("Le service d'IA de KEKELI est momentanément indisponible. L'équipe KEKELI a été prévenue.");
      }
      throw new Error(`ChatGPT indisponible (${r.status}). Réessayez dans un instant.`);
    }
    const brut = d?.choices?.[0]?.message?.content || "";
    const m = brut.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : brut);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("ChatGPT met trop de temps à répondre. Réessayez.");
    if (e instanceof SyntaxError) throw new Error("Réponse de ChatGPT illisible. Réessayez.");
    throw e;
  } finally { clearTimeout(t); }
}

// Gemini : clé du projet GRATUIT, puis clé du projet PAYANT uniquement si Google
// répond « quota dépassé » (HTTP 429 / RESOURCE_EXHAUSTED). Renvoie null si
// Gemini n'est pas utilisable (on passe alors à ChatGPT).
async function gemini(prompt: string, maxTokens: number, suivi?: Suivi): Promise<Record<string, unknown> | null> {
  const cles: [string, string][] = [];
  if (GEMINI_API_KEY) cles.push([GEMINI_API_KEY, "gemini_gratuit"]);
  if (GEMINI_API_KEY_PAYANT) cles.push([GEMINI_API_KEY_PAYANT, "gemini_payant"]);
  for (const [cle, fournisseur] of cles) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 140000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST", signal: c.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const d = await r.json().catch(() => ({}));
      const brut = (d?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      if (r.ok && brut.trim()) {
        const um = d?.usageMetadata || {};
        if (suivi) await Promise.resolve(suivi.admin.rpc("formation_ia_enregistrer_usage", { p_source: suivi.source, p_modele: GEMINI_MODEL, p_entree: Number(um.promptTokenCount) || 0, p_sortie: Number(um.candidatesTokenCount) || 0, p_formateur: suivi.uid, p_fournisseur: fournisseur })).catch(() => {});
        try { const m = brut.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : brut); } catch { console.error("gemini", fournisseur, "JSON illisible"); return null; }
      }
      console.error("gemini", fournisseur, r.status, d?.error?.message);
      if (!(r.status === 429 || d?.error?.status === "RESOURCE_EXHAUSTED")) return null;
    } catch (e) { console.error("gemini", fournisseur, (e as Error).message); return null; } finally { clearTimeout(t); }
  }
  return null;
}

// Génère un objet JSON selon l'ordre choisi par l'admin (voir en-tête).
async function genererJSON(prompt: string, modele: string, maxTokens: number, ordre: string, suivi?: Suivi): Promise<Record<string, unknown>> {
  const avecGemini = !!(GEMINI_API_KEY || GEMINI_API_KEY_PAYANT);
  if (ordre !== "chatgpt" && avecGemini) {
    const g = await gemini(prompt, maxTokens, suivi);
    if (g) return g;
    if (!OPENAI_API_KEY) throw new Error("Gemini est indisponible pour le moment. Réessayez dans un instant.");
  }
  try {
    return await openai(prompt, modele, maxTokens, suivi);
  } catch (e) {
    if (ordre === "chatgpt" && avecGemini) { const g = await gemini(prompt, maxTokens, suivi); if (g) return g; }
    throw e;
  }
}

// Nettoyage minimal côté serveur (le site nettoie encore tout HTML à l'affichage).
function htmlSur(h: string): string {
  return String(h || "").slice(0, 60000)
    .replace(/<(script|style|iframe|object|embed|form|input|button|link|meta)[\s\S]*?(<\/\1>|>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

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

  const [{ data: fo }, { data: gestion }, { data: par }] = await Promise.all([
    admin.from("formateurs").select("statut").eq("id", uid).maybeSingle(),
    admin.rpc("peut_gerer_formations", { p_id: uid }),
    admin.from("formation_ia_parametres").select("*").eq("id", 1).maybeSingle(),
  ]);
  const gratuit = gestion === true;
  if (!gratuit && fo?.statut !== "valide") return json({ error: "Réservé aux formateurs validés par KEKELI." }, 403);
  const modele = par?.modele || "gpt-6-sol";
  const ordre = par?.ia_formation === "chatgpt" ? "chatgpt" : "gemini";
  const iaConfiguree = !!(OPENAI_API_KEY || GEMINI_API_KEY || GEMINI_API_KEY_PAYANT);

  try {
    const droits = async () => {
      const [{ data: niv }, { data: complet }] = await Promise.all([
        admin.rpc("formation_niveau_effectif", { p_id: uid }),
        admin.rpc("formation_ia_peut_generer_complet", { p_formateur: uid }),
      ]);
      const niveau = Number(niv) || 0;
      const niveauModule = Number(par?.niveau_generation_module ?? 1);
      return { niveau, niveauModule, module: gratuit || niveau >= niveauModule, complet: gratuit || complet === true };
    };

    if (action === "estimer") {
      const dr = await droits();
      const couts = { coutComplet: Number(par?.credits_formation ?? 80), coutPlan: Number(par?.credits_plan ?? 10), coutModule: Number(par?.credits_module ?? 25) };
      if (gratuit) return json({ ok: true, cout: 0, gratuit: true, disponible: null, configure: iaConfiguree, ...dr, ...couts });
      const { data: est } = await admin.rpc("formation_ia_estimer", { p_formateur: uid, p_type: "plan", p_questions: 0 });
      return json({ ...(est || {}), configure: iaConfiguree, ...dr, ...couts });
    }

    if (action === "en_cours") {
      const { data: gens } = await admin.from("formation_ia_generations").select("id, formation_id, demande, plan, modules_faits, cree_le")
        .eq("formateur_id", uid).eq("statut", "en_cours").order("cree_le", { ascending: false }).limit(10);
      return json({ generations: (gens || []).map((g) => ({
        id: g.id, formationId: g.formation_id, titre: g.plan?.titre, mode: g.demande?.mode || "complet", cree_le: g.cree_le,
        modules: ((g.plan?.modules || []) as Record<string, unknown>[]).map((m, i) => ({ index: i, titre: m.titre, nbLecons: ((m.lecons || []) as unknown[]).length, fait: (g.modules_faits || []).includes(i) })),
      })) });
    }

    if (action === "plan") {
      if (!iaConfiguree) return json({ error: "La génération par IA n'est pas encore configurée (aucune clé Gemini ni OpenAI)." }, 503);
      const sujet = txt(body.sujet, 300);
      if (sujet.length < 5) return json({ error: "Décrivez le sujet de la formation (5 caractères au moins)." }, 400);
      const publicVise = txt(body.public, 300);
      const niveau = NIVEAUX[String(body.niveau)] ? String(body.niveau) : "tous";
      const nbModules = Math.min(8, Math.max(2, Number(body.nbModules) || 4));
      const parModule = Math.min(6, Math.max(2, Number(body.leconsParModule) || 3));
      const consignes = txt(body.consignes, 1500);
      const mode = body.mode === "complet" ? "complet" : "module";
      const dr = await droits();
      if (mode === "complet" && !dr.complet) return json({ error: "La génération complète (toute la formation d'un coup) est réservée au Pack Pro et à l'abonnement mensuel. Vous pouvez générer votre formation module par module.", code: "NIVEAU" }, 403);
      if (mode === "module" && !dr.module) return json({ error: "La création de formation avec l'IA est incluse dans les packs et l'abonnement : choisissez une offre pour l'activer.", code: "NIVEAU" }, 403);

      // Débit AVANT l'appel (remboursé automatiquement en cas d'échec).
      let mouvement: number | null = null;
      if (!gratuit) {
        const { data: d, error } = await admin.rpc("formation_ia_debiter", { p_formateur: uid, p_type: mode === "complet" ? "formation" : "plan", p_questions: 0, p_details: { sujet, mode } });
        if (error) return json({ error: String(error.message || "").replace(/^CREDITS_INSUFFISANTS:\s*/, ""), code: "CREDITS" }, 402);
        mouvement = d?.mouvement_id ?? null;
      }
      const rembourser = async (motif: string) => { if (mouvement) await admin.rpc("formation_ia_rembourser", { p_mouvement: mouvement, p_motif: motif }); };

      let plan: Record<string, unknown>;
      try {
        plan = await genererJSON(`Tu es un concepteur pédagogique expert pour KEKELI Formation, une plateforme de formation en ligne pour adultes en Afrique francophone.
Conçois le PLAN d'une formation en ligne en FRANÇAIS.
Sujet : ${sujet}
${publicVise ? `Public visé : ${publicVise}\n` : ""}Niveau : ${NIVEAUX[niveau]}
Structure : exactement ${nbModules} modules, ${parModule} leçons par module, progression logique du plus simple au plus avancé.
${consignes ? `Consignes du formateur : ${consignes}\n` : ""}Exemples et contextes adaptés à l'Afrique de l'Ouest quand c'est pertinent.
Réponds UNIQUEMENT avec un objet JSON strict :
{"titre":"(5 à 100 caractères)","sous_titre":"(une phrase)","description":"(2 à 4 paragraphes : ce que l'on apprend, pour qui, résultat concret)","objectifs":["…","…","…"],
 "modules":[{"titre":"…","description":"(1 phrase)","lecons":[{"titre":"…","objectif":"(1 phrase : ce que l'apprenant saura faire)","duree_minutes":10}]}]}`, modele, 6000, ordre, { admin, uid, source: "formation_plan" });
      } catch (e) { await rembourser("échec du plan"); return json({ error: (e as Error).message + " Vos crédits ont été rendus." }, 502); }

      const modules = (Array.isArray(plan.modules) ? plan.modules : []).slice(0, nbModules).map((m: Record<string, unknown>) => ({
        titre: txt(m?.titre, 150) || "Module",
        description: txt(m?.description, 1000),
        lecons: (Array.isArray(m?.lecons) ? m.lecons : []).slice(0, parModule).map((l: Record<string, unknown>) => ({
          titre: txt(l?.titre, 150) || "Leçon", objectif: txt(l?.objectif, 400), duree_minutes: Math.min(120, Math.max(3, Number(l?.duree_minutes) || 10)),
        })).filter((l: { titre: string }) => l.titre),
      })).filter((m: { lecons: unknown[] }) => m.lecons.length);
      let titre = txt(plan.titre, 120);
      if (titre.length < 5) titre = sujet.slice(0, 120);
      if (!modules.length) { await rembourser("plan vide"); return json({ error: "L'IA n'a pas produit de plan exploitable. Vos crédits ont été rendus. Réessayez en précisant le sujet." }, 502); }

      // Création de la formation avec les droits du formateur.
      const objectifs = (Array.isArray(plan.objectifs) ? plan.objectifs : []).map((x) => txt(x, 300)).filter(Boolean).slice(0, 8);
      const description = String(txt(plan.description, 4000)).split(/\n{2,}/).map((p) => `<p>${p.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</p>`).join("")
        + (objectifs.length ? `<h3>Ce que vous saurez faire</h3><ul>${objectifs.map((o) => `<li>${o.replace(/[<>&]/g, "")}</li>`).join("")}</ul>` : "");
      const { data: f, error: eF } = await client.from("formations").insert({ formateur_id: uid, titre, niveau }).select("id").single();
      if (eF || !f) { await rembourser("création impossible"); return json({ error: `Création de la formation impossible : ${eF?.message || ""} Vos crédits ont été rendus.` }, 400); }
      await client.from("formations").update({ sous_titre: txt(plan.sous_titre, 200) || null, description }).eq("id", f.id);
      const planFinal: Record<string, unknown>[] = [];
      for (let i = 0; i < modules.length; i++) {
        const m = modules[i];
        const { data: mod, error: eM } = await client.from("formation_modules").insert({ formation_id: f.id, titre: m.titre, description: m.description || null, position: i + 1 }).select("id").single();
        if (eM || !mod) { await rembourser("modules impossibles"); return json({ error: `Création des modules impossible : ${eM?.message || ""} Vos crédits ont été rendus.` }, 400); }
        const lignes = m.lecons.map((l: { titre: string; duree_minutes: number }, j: number) => ({
          formation_id: f.id, module_id: mod.id, titre: l.titre, type_contenu: "texte", position: j + 1, duree_minutes: l.duree_minutes,
          contenu: "<p><em>⏳ Contenu en cours de rédaction par l'IA…</em></p>", est_obligatoire: true, est_apercu: i === 0 && j === 0,
        }));
        const { data: les, error: eL } = await client.from("formation_lecons").insert(lignes).select("id, position").order("position");
        if (eL || !les) { await rembourser("leçons impossibles"); return json({ error: `Création des leçons impossible : ${eL?.message || ""} Vos crédits ont été rendus.` }, 400); }
        planFinal.push({ ...m, id: mod.id, lecons: m.lecons.map((l: Record<string, unknown>, j: number) => ({ ...l, id: les[j]?.id })) });
      }
      const { data: g } = await admin.from("formation_ia_generations").insert({
        formateur_id: uid, formation_id: f.id, mouvement_id: mouvement, demande: { sujet, public: publicVise, niveau, nbModules, parModule, consignes, mode },
        plan: { titre, modules: planFinal },
      }).select("id").single();
      if (mouvement) await admin.from("formation_ia_mouvements").update({ details: { sujet, mode, formation_id: f.id, generation_id: g?.id } }).eq("id", mouvement);
      return json({ generationId: g?.id, formationId: f.id, titre, mode, coutModule: mode === "module" && !gratuit ? Number(par?.credits_module ?? 25) : 0, modules: planFinal.map((m, i) => ({ index: i, titre: m.titre, nbLecons: (m.lecons as unknown[]).length })) });
    }

    if (action === "module") {
      if (!iaConfiguree) return json({ error: "La génération par IA n'est pas encore configurée (aucune clé Gemini ni OpenAI)." }, 503);
      const { data: g } = await admin.from("formation_ia_generations").select("*").eq("id", Number(body.generationId)).eq("formateur_id", uid).maybeSingle();
      if (!g) return json({ error: "Génération introuvable." }, 404);
      const index = Number(body.index);
      const mods = (g.plan?.modules || []) as Record<string, unknown>[];
      const m = mods[index];
      if (!m) return json({ error: "Module introuvable." }, 400);
      if ((g.modules_faits || []).includes(index)) return json({ ok: true, deja: true, index });
      const essais = Number((g.essais || {})[index] || 0);
      if (essais >= 3) return json({ error: "Ce module a déjà échoué 3 fois : rédigez ses leçons vous-même ou contactez KEKELI." }, 429);
      const d = g.demande || {};
      // Mode module par module : chaque module est payé quand on le demande
      // (remboursé si l'IA échoue). Mode complet : modules déjà inclus.
      let mvtModule: number | null = null;
      if (d.mode === "module" && !gratuit) {
        const { data: db, error } = await admin.rpc("formation_ia_debiter", { p_formateur: uid, p_type: "module", p_questions: 0, p_details: { generation_id: g.id, formation_id: g.formation_id, module: index + 1, titre: m.titre } });
        if (error) return json({ error: String(error.message || "").replace(/^CREDITS_INSUFFISANTS:\s*/, ""), code: "CREDITS" }, 402);
        mvtModule = db?.mouvement_id ?? null;
      }
      const rendre = async (motif: string) => { if (mvtModule) await admin.rpc("formation_ia_rembourser", { p_mouvement: mvtModule, p_motif: motif }); };
      await admin.from("formation_ia_generations").update({ essais: { ...(g.essais || {}), [index]: essais + 1 }, maj_le: new Date().toISOString() }).eq("id", g.id);

      const lecons = (m.lecons || []) as Record<string, unknown>[];
      let res: Record<string, unknown>;
      try {
      res = await genererJSON(`Tu es un formateur expert et un excellent rédacteur pédagogique pour KEKELI Formation (adultes, Afrique francophone).
Formation : « ${g.plan?.titre} » — niveau ${NIVEAUX[String(d.niveau)] || "tous niveaux"}${d.public ? `, public : ${d.public}` : ""}.
${d.consignes ? `Consignes du formateur : ${d.consignes}\n` : ""}Plan complet (pour la cohérence, ne rédige QUE le module demandé) :
${mods.map((x, i) => `${i + 1}. ${x.titre}`).join("\n")}

Rédige maintenant le contenu COMPLET des leçons du module ${index + 1} « ${m.titre} » :
${lecons.map((l, j) => `- Leçon ${j + 1} : ${l.titre}${l.objectif ? ` (objectif : ${l.objectif})` : ""}`).join("\n")}

Pour chaque leçon : 500 à 900 mots, ton clair et bienveillant, en FRANÇAIS ; une courte introduction ; des explications structurées avec des sous-titres ;
au moins un exemple concret ou une mise en situation adaptée au contexte africain ; une petite activité ou question de réflexion ;
et un encadré final « À retenir ».
Format du contenu : HTML simple UNIQUEMENT avec les balises h2, h3, p, ul, ol, li, strong, em, blockquote, table, tr, th, td.
Pour l'encadré « À retenir » utilise exactement : <div data-bloc="encadre" style="background-color: #e8f5e9"><p><strong>📌 À retenir</strong></p><ul><li>…</li></ul></div>
Ne répète pas le titre de la leçon en h1. Pas de CSS, pas de script, pas d'image.
Réponds UNIQUEMENT avec un objet JSON strict : {"lecons":[{"titre":"…","contenu_html":"…"}]} dans le même ordre que ci-dessus.`, modele, 16000, ordre, { admin, uid, source: "formation_module" });
      } catch (e) { await rendre("échec du module"); return json({ error: (e as Error).message + (mvtModule ? " Les crédits de ce module vous ont été rendus." : "") }, 502); }

      const sorties = (Array.isArray(res.lecons) ? res.lecons : []) as Record<string, unknown>[];
      let faites = 0;
      for (let j = 0; j < lecons.length; j++) {
        const html = htmlSur(String(sorties[j]?.contenu_html || ""));
        if (!lecons[j].id || html.length < 200) continue;
        const { error } = await client.from("formation_lecons").update({ contenu: html }).eq("id", Number(lecons[j].id));
        if (!error) faites++;
      }
      if (!faites) { await rendre("module vide"); return json({ error: mvtModule ? "L'IA n'a pas rédigé ce module correctement. Les crédits de ce module vous ont été rendus : réessayez." : "L'IA n'a pas rédigé ce module correctement. Réessayez (aucun crédit supplémentaire)." }, 502); }
      const faits = [...new Set([...(g.modules_faits || []), index])];
      const termine = faits.length >= mods.length;
      await admin.from("formation_ia_generations").update({ modules_faits: faits, statut: termine ? "terminee" : "en_cours", maj_le: new Date().toISOString() }).eq("id", g.id);
      return json({ ok: true, index, lecons: faites, termine });
    }
  } catch (e) {
    return json({ error: (e as Error).message || "Erreur de génération." }, 500);
  }
  return json({ error: "Action inconnue." }, 400);
});
