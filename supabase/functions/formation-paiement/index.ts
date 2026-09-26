// Supabase Edge Function « formation-paiement » (26 septembre 2026).
// Paiement des formations payantes de KEKELI Formation, par FedaPay ou KkiaPay.
//
// Principe de sécurité : le navigateur ne décide JAMAIS qu'un paiement est
// réussi. Il demande seulement à cette fonction de vérifier ; elle interroge
// elle-même FedaPay / KkiaPay avec les clés secrètes (jamais envoyées au
// navigateur), contrôle le montant, puis ouvre l'accès à la formation
// (formation_confirmer_paiement, exécutable uniquement avec la clé service).
//
// Actions (POST JSON) :
//   config   — moyens de paiement disponibles (sans connexion)
//   initier  — crée le paiement ; FedaPay : renvoie l'adresse de la page de
//              paiement ; KkiaPay : renvoie de quoi ouvrir le widget
//   verifier — revérifie le paiement auprès du prestataire et ouvre l'accès
// Webhooks (notifications des prestataires) : ?webhook=fedapay | ?webhook=kkiapay
//   → la transaction est TOUJOURS revérifiée auprès du prestataire.
//
// Secrets à renseigner dans Supabase (Edge Functions → Secrets) :
//   FEDAPAY_SECRET_KEY, FEDAPAY_ENV (sandbox|live), FEDAPAY_WEBHOOK_SECRET (facultatif)
//   KKIAPAY_PUBLIC_KEY, KKIAPAY_PRIVATE_KEY, KKIAPAY_SECRET, KKIAPAY_ENV (sandbox|live),
//   KKIAPAY_WEBHOOK_SECRET (facultatif), SITE_ORIGINES (ex. https://jomion.github.io)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string, d = "") => (Deno.env.get(k) || d).trim();
const SUPABASE_URL = env("SUPABASE_URL");
const ANON = env("SUPABASE_ANON_KEY");
const SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");

const FEDA_KEY = env("FEDAPAY_SECRET_KEY");
const FEDA_LIVE = env("FEDAPAY_ENV", "sandbox") === "live";
const FEDA_API = FEDA_LIVE ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
const FEDA_WH = env("FEDAPAY_WEBHOOK_SECRET");

const KKIA_PUB = env("KKIAPAY_PUBLIC_KEY");
const KKIA_PRIV = env("KKIAPAY_PRIVATE_KEY");
const KKIA_SECRET = env("KKIAPAY_SECRET");
const KKIA_LIVE = env("KKIAPAY_ENV", "sandbox") === "live";
const KKIA_API = KKIA_LIVE ? "https://api.kkiapay.me" : "https://api-sandbox.kkiapay.me";
const KKIA_WH = env("KKIAPAY_WEBHOOK_SECRET");

const ORIGINES = env("SITE_ORIGINES", "https://jomion.github.io").split(",").map((s) => s.trim()).filter(Boolean);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const admin = createClient(SUPABASE_URL, SERVICE);

const fedaOk = () => !!FEDA_KEY;
const kkiaOk = () => !!(KKIA_PUB && KKIA_PRIV && KKIA_SECRET);

async function parametres() {
  const { data } = await admin.from("formation_parametres_paiement").select("*").eq("id", 1).single();
  return data || { commission_pct: 15, fedapay_actif: true, kkiapay_actif: true };
}

async function avecDelai(url: string, init: RequestInit, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

// ----- FedaPay -----
function fedaObjet(d: Record<string, unknown>) {
  // L'API renvoie selon les versions { "v1/transaction": {...} } ou directement l'objet.
  return (d?.["v1/transaction"] || d?.transaction || d) as Record<string, unknown>;
}
async function fedaCreer(p: Record<string, unknown>, titre: string, retour: string, client: Record<string, string>) {
  const r = await avecDelai(`${FEDA_API}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FEDA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: `KEKELI Formation — ${titre}`.slice(0, 250),
      amount: p.montant, currency: { iso: "XOF" }, callback_url: retour,
      customer: client.email ? client : undefined,
      custom_metadata: { paiement_id: p.id },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`FedaPay a refusé la création du paiement (${r.status}).`);
  const t = fedaObjet(d);
  const id = t?.id;
  if (!id) throw new Error("Réponse FedaPay inattendue.");
  const r2 = await avecDelai(`${FEDA_API}/transactions/${id}/token`, { method: "POST", headers: { Authorization: `Bearer ${FEDA_KEY}` } });
  const d2 = await r2.json().catch(() => ({}));
  if (!r2.ok || !d2?.url) throw new Error("Impossible d'obtenir la page de paiement FedaPay.");
  return { reference: String(id), url: String(d2.url) };
}
async function fedaStatut(reference: string) {
  const r = await avecDelai(`${FEDA_API}/transactions/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${FEDA_KEY}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`FedaPay : vérification impossible (${r.status}).`);
  const t = fedaObjet(d);
  return { statut: String(t?.status || ""), montant: Number(t?.amount || 0), brut: { status: t?.status, amount: t?.amount, mode: t?.mode, reference: t?.reference } };
}

// ----- KkiaPay -----
async function kkiaStatut(transactionId: string) {
  const r = await avecDelai(`${KKIA_API}/api/v1/transactions/status`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-API-KEY": KKIA_PUB, "X-PRIVATE-KEY": KKIA_PRIV, "X-SECRET-KEY": KKIA_SECRET },
    body: JSON.stringify({ transactionId }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`KkiaPay : vérification impossible (${r.status}).`);
  return { statut: String(d?.status || ""), montant: Number(d?.amount || 0), brut: { status: d?.status, amount: d?.amount, source: d?.source, reason: d?.reason, state: d?.state } };
}

// Revérifie un paiement auprès du prestataire et met à jour la base.
async function verifierPaiement(p: Record<string, unknown>, transactionKkia?: string) {
  if (p.statut !== "en_attente") return { statut: p.statut };
  if (p.prestataire === "fedapay") {
    if (!p.reference_externe) return { statut: "en_attente" };
    const s = await fedaStatut(String(p.reference_externe));
    if (["approved", "transferred"].includes(s.statut)) {
      const { data, error } = await admin.rpc("formation_confirmer_paiement", { p_paiement_id: p.id, p_reference: String(p.reference_externe), p_montant_recu: s.montant, p_details: { fedapay: s.brut } });
      if (error) throw new Error(error.message);
      return data;
    }
    if (["declined", "canceled", "refunded"].includes(s.statut)) {
      await admin.rpc("formation_clore_paiement", { p_paiement_id: p.id, p_statut: s.statut === "canceled" ? "annule" : "echoue", p_details: { fedapay: s.brut } });
      return { statut: s.statut === "canceled" ? "annule" : "echoue" };
    }
    return { statut: "en_attente" };
  }
  // KkiaPay : l'identifiant de transaction vient du widget ou du webhook.
  const tx = transactionKkia || (p.reference_externe as string);
  if (!tx) return { statut: "en_attente" };
  const s = await kkiaStatut(tx);
  if (s.statut === "SUCCESS") {
    const { data, error } = await admin.rpc("formation_confirmer_paiement", { p_paiement_id: p.id, p_reference: tx, p_montant_recu: s.montant, p_details: { kkiapay: s.brut } });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("Cette transaction a déjà servi pour un autre paiement.");
      throw new Error(error.message);
    }
    return data;
  }
  if (["FAILED", "INSUFFICIENT_FUND", "TRANSACTION_NOT_FOUND"].includes(s.statut) && transactionKkia) {
    await admin.rpc("formation_clore_paiement", { p_paiement_id: p.id, p_statut: "echoue", p_details: { kkiapay: s.brut } });
    return { statut: "echoue" };
  }
  return { statut: "en_attente" };
}

async function hmacHex(secret: string, message: string) {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = new URL(req.url);

  // ===== Webhooks des prestataires =====
  const wh = url.searchParams.get("webhook");
  if (wh) {
    const brut = await req.text();
    let corps: Record<string, unknown> = {};
    try { corps = JSON.parse(brut); } catch { return json({ ok: false }, 400); }
    try {
      if (wh === "fedapay") {
        if (FEDA_WH) {
          const entete = req.headers.get("x-fedapay-signature") || "";
          const parts = Object.fromEntries(entete.split(",").map((x) => x.trim().split("=")) as [string, string][]);
          const attendu = parts.t ? await hmacHex(FEDA_WH, `${parts.t}.${brut}`) : "";
          if (!attendu || attendu !== parts.s) return json({ ok: false, erreur: "signature" }, 400);
        }
        const ent = (corps.entity || {}) as Record<string, unknown>;
        const ref = ent.id ? String(ent.id) : "";
        if (!ref) return json({ ok: true });
        const { data: p } = await admin.from("formation_paiements").select("*").eq("prestataire", "fedapay").eq("reference_externe", ref).maybeSingle();
        if (p) await verifierPaiement(p);
        return json({ ok: true });
      }
      if (wh === "kkiapay") {
        if (KKIA_WH && req.headers.get("x-kkiapay-secret") !== KKIA_WH) return json({ ok: false, erreur: "secret" }, 400);
        const tx = corps.transactionId ? String(corps.transactionId) : "";
        let pid = 0;
        const sd = corps.stateData as unknown;
        try { pid = Number(typeof sd === "string" ? (JSON.parse(sd)?.paiementId ?? sd) : (sd as Record<string, unknown>)?.paiementId); } catch { pid = Number(sd); }
        let p = null;
        if (pid) ({ data: p } = await admin.from("formation_paiements").select("*").eq("id", pid).eq("prestataire", "kkiapay").maybeSingle());
        if (!p && tx) ({ data: p } = await admin.from("formation_paiements").select("*").eq("prestataire", "kkiapay").eq("reference_externe", tx).maybeSingle());
        if (p && tx) await verifierPaiement(p, tx);
        return json({ ok: true });
      }
    } catch (e) {
      console.error("webhook", wh, (e as Error).message);
      return json({ ok: false }, 500);
    }
    return json({ ok: false }, 400);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const action = String(body.action || "");

  if (action === "config") {
    const par = await parametres();
    return json({
      fedapay: { disponible: fedaOk() && par.fedapay_actif, test: !FEDA_LIVE },
      kkiapay: { disponible: kkiaOk() && par.kkiapay_actif, test: !KKIA_LIVE },
      commission_pct: par.commission_pct,
    });
  }

  // ===== Actions d'un utilisateur connecté =====
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Connectez-vous pour payer." }, 401);
  const client = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await client.auth.getUser();
  if (!u?.user) return json({ error: "Session expirée : reconnectez-vous." }, 401);
  const uid = u.user.id;

  try {
    if (action === "initier") {
      const prestataire = String(body.prestataire || "");
      const par = await parametres();
      if (prestataire === "fedapay" && !(fedaOk() && par.fedapay_actif)) return json({ error: "FedaPay n'est pas disponible pour le moment." }, 400);
      if (prestataire === "kkiapay" && !(kkiaOk() && par.kkiapay_actif)) return json({ error: "KkiaPay n'est pas disponible pour le moment." }, 400);
      if (!["fedapay", "kkiapay"].includes(prestataire)) return json({ error: "Moyen de paiement inconnu." }, 400);
      const { data: prof } = await admin.from("profils").select("role, prenom, nom, email, actif").eq("id", uid).single();
      if (!prof || prof.actif === false) return json({ error: "Profil introuvable." }, 403);
      if (prof.role === "eleve") return json({ error: "Les formations sont réservées aux comptes adultes." }, 403);
      const test = prestataire === "fedapay" ? !FEDA_LIVE : !KKIA_LIVE;
      const objet = ["ia_pack", "ia_abonnement"].includes(String(body.objet)) ? String(body.objet) : "formation";
      let ligne: Record<string, unknown>; let titre: string;
      if (objet === "formation") {
        const formationId = Number(body.formationId);
        const { data: f } = await admin.from("formations").select("id, titre, prix, devise, statut, formateur_id").eq("id", formationId).single();
        if (!f || f.statut !== "publiee") return json({ error: "Cette formation n'est pas disponible." }, 400);
        if (!(f.prix > 0)) return json({ error: "Cette formation est gratuite." }, 400);
        if (f.formateur_id === uid) return json({ error: "Vous êtes le formateur de cette formation." }, 400);
        const { data: ins } = await admin.from("formation_inscriptions").select("id, statut").eq("formation_id", f.id).eq("apprenant_id", uid).maybeSingle();
        if (ins && ins.statut !== "annulee") return json({ error: "Vous êtes déjà inscrit(e) à cette formation." }, 400);
        ligne = { formation_id: f.id, formateur_id: f.formateur_id, montant: f.prix, devise: f.devise || "XOF" };
        titre = f.titre;
      } else {
        // Crédits IA (26 septembre 2026) : pack prépayé ou abonnement mensuel.
        const table = objet === "ia_pack" ? "formation_ia_packs" : "formation_ia_offres";
        const { data: o } = await admin.from(table).select("*").eq("id", Number(body.produitId)).eq("actif", true).maybeSingle();
        if (!o) return json({ error: "Cette offre n'est plus disponible." }, 400);
        ligne = objet === "ia_pack"
          ? { objet, ia_pack_id: o.id, credits: o.credits, montant: o.prix, devise: "XOF" }
          : { objet, ia_offre_id: o.id, credits: o.credits_mensuels, montant: o.prix, devise: "XOF" };
        titre = `Crédits IA — ${o.nom}`;
      }
      const { data: p, error } = await admin.from("formation_paiements").insert({
        ...ligne, apprenant_id: uid, prestataire, mode: test ? "test" : "live",
      }).select("*").single();
      if (error || !p) throw new Error(error?.message || "Création du paiement impossible.");

      if (prestataire === "fedapay") {
        let retour = String(body.retour || "");
        try { const r = new URL(retour); if (!ORIGINES.includes(r.origin)) retour = ""; } catch { retour = ""; }
        if (!retour) return json({ error: "Adresse de retour non autorisée (SITE_ORIGINES)." }, 400);
        const r = new URL(retour); r.searchParams.set("paiement", String(p.id));
        const { reference, url: payUrl } = await fedaCreer(p, titre, r.toString(), { email: prof.email || "", firstname: prof.prenom || "", lastname: prof.nom || "" });
        await admin.from("formation_paiements").update({ reference_externe: reference, maj_le: new Date().toISOString() }).eq("id", p.id);
        return json({ paiementId: p.id, url: payUrl, test });
      }
      return json({ paiementId: p.id, montant: p.montant, cle: KKIA_PUB, sandbox: test, email: prof.email || "", nom: `${prof.prenom || ""} ${prof.nom || ""}`.trim(), test });
    }

    if (action === "verifier") {
      const { data: p } = await admin.from("formation_paiements").select("*").eq("id", Number(body.paiementId)).eq("apprenant_id", uid).maybeSingle();
      if (!p) return json({ error: "Paiement introuvable." }, 404);
      const tx = body.transactionId ? String(body.transactionId).slice(0, 100) : undefined;
      const res = await verifierPaiement(p, tx);
      return json({ ...res, formationId: p.formation_id, objet: p.objet, credits: p.credits });
    }
  } catch (e) {
    return json({ error: (e as Error).message || "Erreur de paiement." }, 500);
  }
  return json({ error: "Action inconnue." }, 400);
});
