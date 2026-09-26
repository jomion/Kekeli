// Supabase Edge Function « formation-ia-image » (27 septembre 2026, v2).
// Génère une image pour une formation (illustration de leçon ou couverture).
// Le formateur choisit l'IA et la qualité parmi les options réglées par
// l'admin (formation_ia_parametres.images_options) :
//   • ChatGPT Images (OpenAI, appel direct) : qualité basse / moyenne / haute ;
//   • Gemini (Google) : Imagen (…:predict) ou modèle image Gemini
//     (…:generateContent), clé gratuite puis clé payante.
// Chaque option a son prix en crédits (débités AVANT l'appel, rendus si la
// génération échoue) et son coût réel estimé (suivi du solde OpenAI). Les
// gestionnaires KEKELI et les accès offerts ne paient pas. Limite :
// limite_images_jour par 24 h.
// L'image est enregistrée dans le stockage public « formations-public »
// (lecons/{formation}/ ou couvertures/{formation}/) et son adresse renvoyée.
//
// Actions (POST JSON, utilisateur connecté, formateur de la formation) :
//   estimer — { formationId } : options (IA, qualité, crédits), crédits disponibles
//   generer — { formationId, option, description, style, format, cible: "lecon"|"couverture" }
// Secrets : OPENAI_API_KEY ; GEMINI_API_KEY (gratuit) et GEMINI_API_KEY_PAYANT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_KEY_PAYANT = Deno.env.get("GEMINI_API_KEY_PAYANT");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const txt = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const STYLES: Record<string, string> = {
  illustration: "illustration pédagogique moderne, couleurs vives et douces, style dessin vectoriel propre",
  photo: "photographie réaliste, lumière naturelle, cadrage professionnel",
  schema: "schéma ou infographie simple et clair, fond blanc, formes nettes, très lisible",
  dessin: "dessin à la main façon carnet, traits simples, couleurs aquarelle légères",
  "3d": "rendu 3D doux et arrondi, style moderne et chaleureux",
};
const FORMATS: Record<string, string> = { carre: "1024x1024", paysage: "1536x1024", portrait: "1024x1536" };
const RATIOS: Record<string, string> = { carre: "1:1", paysage: "16:9", portrait: "3:4" };
const QUALITE_OPENAI: Record<string, string> = { basse: "low", moyenne: "medium", haute: "high" };
type Option = { id: string; fournisseur: string; qualite: string; libelle: string; modele: string; credits: number; cout_usd: number; actif: boolean };

function decoder(b64: string): Uint8Array {
  const bin = atob(b64);
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}

// Appel direct à l'API Images d'OpenAI. Essaie d'abord un fichier WEBP
// compressé (plus léger pour les apprenants), sinon PNG par défaut.
async function genererImage(prompt: string, modele: string, taille: string, qualite: string): Promise<{ octets: Uint8Array; type: string }> {
  if (!OPENAI_API_KEY) throw Object.assign(new Error("La génération d'images n'est pas encore configurée (clé OpenAI manquante)."), { statut: 503 });
  const essais: Record<string, unknown>[] = [
    { model: modele, prompt, size: taille, quality: qualite, n: 1, output_format: "webp", output_compression: 85 },
    { model: modele, prompt, size: taille, n: 1 },
  ];
  let derniere = "";
  for (const corps of essais) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 140000);
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", signal: c.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const item = d?.data?.[0] || {};
        if (item.b64_json) return { octets: decoder(item.b64_json), type: corps.output_format === "webp" ? "image/webp" : "image/png" };
        if (item.url) {
          const img = await fetch(item.url);
          if (img.ok) return { octets: new Uint8Array(await img.arrayBuffer()), type: img.headers.get("content-type") || "image/png" };
        }
        derniere = "Réponse d'OpenAI sans image.";
        continue;
      }
      const code = d?.error?.code || d?.error?.type || "";
      derniere = String(d?.error?.message || r.status);
      console.error("openai image", r.status, code, derniere);
      if (code === "insufficient_quota") throw Object.assign(new Error("QUOTA"), { quota: true, message_openai: derniere });
      if (code === "moderation_blocked" || /safety|moderation/i.test(derniere)) {
        throw Object.assign(new Error("Cette description a été refusée par le filtre de sécurité d'OpenAI. Reformulez-la (sans violence, contenu choquant ou personne célèbre)."), { statut: 400 });
      }
      if (r.status !== 400) break; // 400 : on réessaie sans les options de format.
    } catch (e) {
      if ((e as { quota?: boolean }).quota || (e as { statut?: number }).statut) throw e;
      if ((e as Error).name === "AbortError") { derniere = "OpenAI met trop de temps à répondre."; break; }
      derniere = (e as Error).message;
    } finally { clearTimeout(t); }
  }
  throw Object.assign(new Error(`La génération de l'image a échoué (${derniere.slice(0, 160)}). Réessayez.`), { statut: 502 });
}

// Gemini : Imagen (modèles « imagen-… », API predict) ou modèle image Gemini
// (API generateContent). Clé gratuite d'abord, puis clé payante.
async function genererImageGemini(prompt: string, modele: string, format: string): Promise<{ octets: Uint8Array; type: string; fournisseur: string }> {
  const cles: [string, string][] = [];
  if (GEMINI_API_KEY) cles.push([GEMINI_API_KEY, "gemini_gratuit"]);
  if (GEMINI_API_KEY_PAYANT) cles.push([GEMINI_API_KEY_PAYANT, "gemini_payant"]);
  if (!cles.length) throw Object.assign(new Error("Gemini n'est pas encore configuré sur KEKELI (clé manquante)."), { statut: 503 });
  const imagen = /^imagen/i.test(modele);
  let derniere = "";
  for (const [cle, fournisseur] of cles) {
    const corpsListe: Record<string, unknown>[] = imagen
      ? [{ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: RATIOS[format] || "16:9" } }]
      : [{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: RATIOS[format] || "16:9" } } },
         { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }];
    for (const corps of corpsListe) {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 140000);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:${imagen ? "predict" : "generateContent"}`, {
          method: "POST", signal: c.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": cle }, body: JSON.stringify(corps),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          if (imagen) {
            const pr = d?.predictions?.[0];
            if (pr?.bytesBase64Encoded) return { octets: decoder(pr.bytesBase64Encoded), type: pr.mimeType || "image/png", fournisseur };
          } else {
            const part = (d?.candidates?.[0]?.content?.parts || []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
            if (part) return { octets: decoder(part.inlineData.data), type: part.inlineData.mimeType || "image/png", fournisseur };
          }
          derniere = "Gemini n'a pas renvoyé d'image (description peut-être refusée par son filtre de sécurité).";
          break;
        }
        derniere = String(d?.error?.message || r.status);
        console.error("gemini image", fournisseur, r.status, derniere);
        if (r.status === 400 && corps !== corpsListe[corpsListe.length - 1]) continue; // on réessaie sans l'option de format
        break; // clé suivante
      } catch (e) {
        derniere = (e as Error).name === "AbortError" ? "Gemini met trop de temps à répondre." : (e as Error).message;
        break;
      } finally { clearTimeout(t); }
    }
  }
  throw Object.assign(new Error(`La génération de l'image avec Gemini a échoué (${derniere.slice(0, 160)}). Réessayez ou choisissez ChatGPT.`), { statut: 502 });
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
  const formationId = Number(body.formationId);
  if (!formationId) return json({ error: "Formation manquante." }, 400);

  const [{ data: peut }, { data: gestion }, { data: par }] = await Promise.all([
    client.rpc("peut_editer_formation", { p_id: uid, p_formation_id: formationId }),
    admin.rpc("peut_gerer_formations", { p_id: uid }),
    admin.from("formation_ia_parametres").select("actif, credits_image, modele_image, qualite_image, limite_images_jour, images_options").eq("id", 1).maybeSingle(),
  ]);
  if (peut !== true) return json({ error: "Vous ne pouvez pas modifier cette formation." }, 403);
  const gratuit = gestion === true;
  const cleOk = (f: string) => f === "openai" ? !!OPENAI_API_KEY : !!(GEMINI_API_KEY || GEMINI_API_KEY_PAYANT);
  const options = ((Array.isArray(par?.images_options) ? par.images_options : []) as Option[])
    .filter((o) => o && o.actif !== false && (o.fournisseur === "openai" || o.fournisseur === "gemini"))
    .map((o) => ({ ...o, credits: Math.max(0, Number(o.credits) || 0), configure: cleOk(o.fournisseur) }));

  if (action === "estimer") {
    const publiques = options.map(({ id, fournisseur, qualite, libelle, credits, configure }) => ({ id, fournisseur, qualite, libelle, credits, configure }));
    if (gratuit) return json({ ok: true, gratuit: true, options: publiques, configure: publiques.some((o) => o.configure) });
    const { data: est } = await admin.rpc("formation_ia_estimer", { p_formateur: uid, p_type: "image", p_questions: 0 });
    return json({ ...(est || {}), options: publiques, configure: publiques.some((o) => o.configure) });
  }
  if (action !== "generer") return json({ error: "Action inconnue." }, 400);

  if (par && par.actif === false) return json({ error: "La génération par IA est momentanément désactivée." }, 503);
  const opt = options.find((o) => o.id === String(body.option)) || options.find((o) => o.configure);
  if (!opt) return json({ error: "Aucune IA d'image n'est disponible pour le moment." }, 503);
  if (!opt.configure) return json({ error: `${opt.fournisseur === "openai" ? "ChatGPT" : "Gemini"} n'est pas encore configuré sur KEKELI : choisissez une autre IA.` }, 503);
  const cout = opt.credits;
  const description = txt(body.description, 1000);
  if (description.length < 8) return json({ error: "Décrivez l'image souhaitée (8 caractères au moins)." }, 400);
  const style = STYLES[String(body.style)] ? String(body.style) : "illustration";
  const format = FORMATS[String(body.format)] ? String(body.format) : "paysage";
  const cible = body.cible === "couverture" ? "couverture" : "lecon";

  // Limite quotidienne (images non remboursées des dernières 24 h).
  if (!gratuit) {
    const depuis = new Date(Date.now() - 864e5).toISOString();
    const { data: recents } = await admin.from("formation_ia_mouvements").select("details").eq("formateur_id", uid).eq("type", "usage_image").gte("cree_le", depuis);
    const nb = (recents || []).filter((m) => !(m.details || {}).rembourse).length;
    const limite = Number(par?.limite_images_jour ?? 20);
    if (nb >= limite) return json({ error: `Limite atteinte : ${limite} images par 24 heures. Réessayez demain.` }, 429);
  }

  // Débit AVANT l'appel, rendu si l'image n'est pas produite.
  let mouvement: number | null = null;
  if (!gratuit) {
    const { data: d, error } = await admin.rpc("formation_ia_debiter", { p_formateur: uid, p_type: "image", p_questions: cout, p_details: { formation_id: formationId, cible, description: description.slice(0, 200), option: opt.id, ia: opt.libelle } });
    if (error) return json({ error: String(error.message || "").replace(/^CREDITS_INSUFFISANTS:\s*/, ""), code: "CREDITS" }, 402);
    mouvement = d?.mouvement_id ?? null;
  }
  const rendre = async (motif: string) => { if (mouvement) await admin.rpc("formation_ia_rembourser", { p_mouvement: mouvement, p_motif: motif }); };

  const { data: f } = await admin.from("formations").select("titre").eq("id", formationId).maybeSingle();
  const prompt = `${description}

Style : ${STYLES[style]}.
Contexte : image pour la formation en ligne « ${f?.titre || ""} » (KEKELI Formation, adultes en Afrique francophone). Si des personnes ou des lieux apparaissent, représente de préférence un contexte d'Afrique de l'Ouest, de façon positive et respectueuse.
${cible === "couverture" ? "C'est l'image de couverture de la formation : composition claire et attrayante, sujet principal bien visible." : "C'est une illustration à l'intérieur d'une leçon : simple, claire, qui aide à comprendre."}
N'écris aucun texte, mot, lettre ni logo dans l'image.`;

  const modele = opt.modele || (opt.fournisseur === "openai" ? "gpt-image-1" : "gemini-2.5-flash-image");
  let image: { octets: Uint8Array; type: string; fournisseur?: string };
  try {
    image = opt.fournisseur === "gemini"
      ? await genererImageGemini(prompt, modele, format)
      : await genererImage(prompt, modele, FORMATS[format], QUALITE_OPENAI[opt.qualite] || "medium");
  } catch (e) {
    await rendre("échec de l'image");
    const err = e as { quota?: boolean; statut?: number; message_openai?: string; message: string };
    if (err.quota) {
      await Promise.resolve(admin.rpc("formation_ia_signaler_quota_openai", { p_message: String(err.message_openai || "insufficient_quota") })).catch(() => {});
      return json({ error: "Le service d'images de KEKELI est momentanément indisponible. L'équipe KEKELI a été prévenue. Vos crédits ont été rendus." }, 503);
    }
    return json({ error: err.message + (mouvement ? " Vos crédits ont été rendus." : "") }, err.statut || 502);
  }
  // Coût réel estimé (suivi du solde OpenAI de KEKELI).
  await Promise.resolve(admin.rpc("formation_ia_enregistrer_image", { p_formateur: uid, p_modele: modele, p_nb: 1, p_cout_usd: Number(opt.cout_usd) || 0, p_fournisseur: image.fournisseur || "openai" })).catch(() => {});

  const ext = image.type.includes("webp") ? "webp" : image.type.includes("jpeg") || image.type.includes("jpg") ? "jpg" : "png";
  if (image.type.includes("jpg") && !image.type.includes("jpeg")) image.type = "image/jpeg";
  const chemin = `${cible === "couverture" ? "couvertures" : "lecons"}/${formationId}/ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: eUp } = await admin.storage.from("formations-public").upload(chemin, image.octets, { contentType: image.type, upsert: false });
  if (eUp) {
    await rendre("enregistrement impossible");
    return json({ error: `Image créée mais impossible à enregistrer (${eUp.message}). Vos crédits ont été rendus.` }, 500);
  }
  const url = admin.storage.from("formations-public").getPublicUrl(chemin).data.publicUrl;
  if (mouvement) {
    const { data: mv } = await admin.from("formation_ia_mouvements").select("details").eq("id", mouvement).maybeSingle();
    await admin.from("formation_ia_mouvements").update({ details: { ...(mv?.details || {}), url } }).eq("id", mouvement);
  }
  return json({ ok: true, url, alt: description.slice(0, 150), cout: gratuit ? 0 : cout, ia: opt.libelle });
});
