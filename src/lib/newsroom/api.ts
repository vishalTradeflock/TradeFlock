import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { newsroomDb } from "@/lib/newsroom/db";
import { can, deskForRole, roleForToken, type NewsroomRole, type Permission } from "@/lib/newsroom/roles";
import { checkVerdict, DECISIONS, type Decision, type Scores } from "@/lib/newsroom/scorecard";

const DESKS = ["macro", "markets", "ma", "strategy", "tech", "retail", "features"];
const SIGNAL_STATUSES = ["new", "triaged", "claimed", "monitor", "timeline", "rejected", "duplicate", "expired"];
const PACKET_RECS = ["PUBLISH", "ESCALATE_TO_FEATURES", "HOLD_MONITOR", "UPDATE_EXISTING", "CONSOLIDATE", "REJECT"];

type Json = Record<string, unknown>;

function json(status: number, body: Json) {
  return NextResponse.json(body, { status });
}

function str(value: unknown, max = 5000): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function authorize(request: Request, permission: Permission):
  | { ok: true; role: NewsroomRole }
  | { ok: false; response: NextResponse } {
  const role = roleForToken(request.headers.get("authorization"));
  if (!role) return { ok: false, response: json(401, { error: "Unauthorized" }) };
  if (!can(role, permission)) {
    return { ok: false, response: json(403, { error: `Role ${role} may not ${permission}` }) };
  }
  return { ok: true, role };
}

const LISTS: Record<string, { table: string; order: string }> = {
  signals: { table: "story_signals", order: "signal_score" },
  claims: { table: "story_claims", order: "claimed_at" },
  packets: { table: "reporting_packets", order: "created_at" },
  verdicts: { table: "editorial_verdicts", order: "created_at" },
};

export async function handleGet(request: Request, resource: string) {
  const auth = authorize(request, "read");
  if (!auth.ok) return auth.response;
  const list = LISTS[resource];
  if (!list) return json(404, { error: "Unknown resource" });
  const url = new URL(request.url);
  const db = newsroomDb();
  let query = db.from(list.table).select("*").order(list.order, { ascending: false }).limit(
    Math.min(Number(url.searchParams.get("limit")) || 50, 200),
  );
  const status = url.searchParams.get("status");
  if (status) query = query.eq(resource === "claims" ? "claim_status" : resource === "verdicts" ? "decision" : "status", status);
  const desk = url.searchParams.get("desk");
  if (desk && resource !== "signals") query = query.eq("desk", desk);
  const { data, error } = await query;
  if (error) return json(500, { error: error.message });
  return json(200, { ok: true, role: auth.role, items: data ?? [] });
}

async function triageSignal(role: NewsroomRole, body: Json) {
  const id = str(body.signal_id, 64);
  const status = str(body.status, 32);
  if (!id || !status || !SIGNAL_STATUSES.includes(status)) {
    return json(400, { error: "signal_id and a valid status are required" });
  }
  const db = newsroomDb();
  const { data, error } = await db
    .from("story_signals")
    .update({ status, triage_note: str(body.note, 1000), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) return json(400, { error: error.message });
  return json(200, { ok: true, role, signal: data });
}

async function createClaim(role: NewsroomRole, body: Json) {
  const ownDesk = deskForRole(role);
  const desk = role === "signal_desk" ? str(body.desk, 32) : ownDesk;
  if (!desk || !DESKS.includes(desk)) return json(400, { error: "valid desk required" });
  if (ownDesk && str(body.desk, 32) && str(body.desk, 32) !== ownDesk) {
    return json(403, { error: `Role ${role} can only claim for desk ${ownDesk}` });
  }
  const entity = str(body.entity, 200);
  const eventType = str(body.event_type, 64);
  if (!entity || !eventType) return json(400, { error: "entity and event_type are required" });
  const db = newsroomDb();
  const signalId = str(body.signal_id, 64);
  const { data, error } = await db
    .from("story_claims")
    .insert({ signal_id: signalId, desk, entity, event_type: eventType, claimed_by: role, note: str(body.note, 1000) })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: owner } = await db
        .from("story_claims")
        .select("id, desk, claimed_at")
        .ilike("entity", entity)
        .ilike("event_type", eventType)
        .in("claim_status", ["open", "packet_filed"])
        .maybeSingle();
      return json(409, { error: "This entity+event already has an owning desk", owner });
    }
    return json(400, { error: error.message });
  }
  if (signalId) {
    await db.from("story_signals").update({ status: "claimed", updated_at: new Date().toISOString() }).eq("id", signalId);
  }
  return json(201, { ok: true, claim: data });
}

async function createPacket(role: NewsroomRole, body: Json) {
  const desk = deskForRole(role);
  if (!desk) return json(403, { error: "Only desks file packets" });
  const required = ["headline_working", "what_happened", "what_is_new", "why_tradeflock", "why_tradeflock_type", "recommended_content_type", "recommendation"];
  const missing = required.filter((k) => !str(body[k]));
  if (missing.length) return json(400, { error: `missing: ${missing.join(", ")}` });
  if (!PACKET_RECS.includes(String(body.recommendation))) return json(400, { error: "invalid recommendation" });
  const sources = Array.isArray(body.primary_sources) ? body.primary_sources : [];
  const validSources = sources.filter((s) => s && typeof s === "object" && isHttpUrl((s as Json).url));
  if (validSources.length === 0) return json(400, { error: "at least one primary source {url,...} is required" });
  const db = newsroomDb();
  const claimId = str(body.claim_id, 64);
  if (claimId) {
    const { data: claim } = await db.from("story_claims").select("id, desk, claim_status").eq("id", claimId).maybeSingle();
    if (!claim) return json(404, { error: "claim not found" });
    if (claim.desk !== desk) return json(403, { error: `claim belongs to desk ${claim.desk}` });
  }
  const draftId = str(body.draft_article_id, 64);
  if (draftId) {
    const { data: art } = await db.from("articles").select("id, status").eq("id", draftId).maybeSingle();
    if (!art) return json(404, { error: "draft article not found" });
    if (art.status === "published") return json(409, { error: "draft_article_id is already published; use UPDATE_EXISTING" });
  }
  const row = {
    claim_id: claimId,
    signal_id: str(body.signal_id, 64),
    desk,
    submitted_by: role,
    headline_working: str(body.headline_working, 300),
    what_happened: str(body.what_happened),
    what_is_new: str(body.what_is_new),
    why_tradeflock: str(body.why_tradeflock),
    why_tradeflock_type: str(body.why_tradeflock_type, 64),
    primary_sources: validSources,
    verified_facts: Array.isArray(body.verified_facts) ? body.verified_facts : [],
    key_numbers: Array.isArray(body.key_numbers) ? body.key_numbers : [],
    entities: strArray(body.entities),
    existing_coverage: Array.isArray(body.existing_coverage) ? body.existing_coverage : [],
    open_questions: str(body.open_questions),
    search_intent: str(body.search_intent, 1000),
    recommended_content_type: str(body.recommended_content_type, 64),
    recommendation: body.recommendation,
    draft_article_id: draftId,
    packet: typeof body.packet === "object" && body.packet ? body.packet : {},
  };
  const { data, error } = await db.from("reporting_packets").insert(row).select("*").single();
  if (error) return json(400, { error: error.message });
  if (claimId) {
    await db.from("story_claims").update({ claim_status: "packet_filed", updated_at: new Date().toISOString() }).eq("id", claimId);
  }
  return json(201, { ok: true, packet: data });
}

const CLAIM_STATUS_FOR: Partial<Record<Decision, string>> = {
  REJECT: "rejected",
  HOLD_MONITOR: "released",
  CONSOLIDATE: "merged",
  UPDATE_EXISTING: "merged",
};

async function createVerdict(role: NewsroomRole, body: Json) {
  const decision = str(body.decision, 32) as Decision | null;
  if (!decision || !DECISIONS.includes(decision)) return json(400, { error: `decision must be one of ${DECISIONS.join(", ")}` });
  const s = (typeof body.scores === "object" && body.scores ? body.scores : {}) as Partial<Scores>;
  const scores = s as Scores;
  const unresolved = strArray(body.hard_fails_unresolved);
  const isBreaking = body.is_breaking === true;
  const capOverrideReason = str(body.cap_override_reason, 1000);
  const check = checkVerdict({ decision, scores, hardFailsUnresolved: unresolved, isBreaking, capOverrideReason });
  if (!check.ok) return json(422, { error: "verdict rejected by scorecard", details: check.errors });
  const packetId = str(body.packet_id, 64);
  if (!packetId) return json(400, { error: "packet_id is required" });
  const db = newsroomDb();
  const { data: packet } = await db.from("reporting_packets").select("id, claim_id, draft_article_id").eq("id", packetId).maybeSingle();
  if (!packet) return json(404, { error: "packet not found" });
  const articleId = str(body.article_id, 64) ?? packet.draft_article_id ?? null;
  if (decision === "PUBLISH" && !articleId) return json(400, { error: "PUBLISH needs article_id (the Studio draft)" });
  const { data, error } = await db
    .from("editorial_verdicts")
    .insert({
      packet_id: packetId,
      article_id: articleId,
      decision,
      s_added_value: scores.added_value,
      s_accuracy: scores.accuracy,
      s_sourcing: scores.sourcing,
      s_news_value: scores.news_value,
      s_context: scores.context,
      s_reader_value: scores.reader_value,
      s_search_fit: scores.search_fit,
      s_style: scores.style,
      hard_fails_checked: strArray(body.hard_fails_checked),
      hard_fails_unresolved: unresolved,
      figure_checks: typeof body.figure_checks === "object" && body.figure_checks ? body.figure_checks : {},
      seo_decision: typeof body.seo_decision === "object" && body.seo_decision ? body.seo_decision : {},
      duplicate_check: str(body.duplicate_check, 2000),
      is_breaking: isBreaking,
      cap_override_reason: capOverrideReason,
      notes: str(body.notes),
      decided_by: role,
    })
    .select("*")
    .single();
  if (error) return json(422, { error: error.message });
  await db.from("reporting_packets").update({ status: "verdicted", updated_at: new Date().toISOString() }).eq("id", packetId);
  const claimStatus = CLAIM_STATUS_FOR[decision];
  if (claimStatus && packet.claim_id) {
    await db
      .from("story_claims")
      .update({ claim_status: claimStatus, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", packet.claim_id);
  }
  return json(201, { ok: true, verdict: data });
}

async function publishArticle(role: NewsroomRole, body: Json) {
  const articleId = str(body.article_id, 64);
  if (!articleId) return json(400, { error: "article_id is required" });
  const db = newsroomDb();
  const { data: article } = await db.from("articles").select("id, slug, status").eq("id", articleId).maybeSingle();
  if (!article) return json(404, { error: "article not found" });
  if (article.status === "published") return json(409, { error: "already published" });
  // The DB editorial gate decides. This route has no override and no force path.
  const { data, error } = await db
    .from("articles")
    .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", articleId)
    .select("id, slug, status, verdict_id")
    .single();
  if (error) return json(409, { ok: false, error: error.message, outcome: "REJECTED" });
  if (data?.verdict_id) {
    const { data: v } = await db.from("editorial_verdicts").select("packet_id").eq("id", data.verdict_id).maybeSingle();
    if (v?.packet_id) {
      const { data: p } = await db.from("reporting_packets").select("claim_id").eq("id", v.packet_id).maybeSingle();
      if (p?.claim_id) {
        await db.from("story_claims").update({ claim_status: "published", closed_at: new Date().toISOString() }).eq("id", p.claim_id);
      }
    }
  }
  revalidatePath("/", "layout");
  revalidatePath(`/${article.slug}`);
  return json(200, { ok: true, role, article: data });
}

export async function handlePost(request: Request, resource: string) {
  const permission: Record<string, Permission> = {
    signals: "signal_write",
    claims: "claim",
    packets: "packet",
    verdicts: "verdict",
    publish: "publish",
  };
  const needed = permission[resource];
  if (!needed) return json(404, { error: "Unknown resource" });
  const auth = authorize(request, needed);
  if (!auth.ok) return auth.response;
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return json(400, { error: "JSON body required" });
  }
  switch (resource) {
    case "signals":
      return triageSignal(auth.role, body);
    case "claims":
      return createClaim(auth.role, body);
    case "packets":
      return createPacket(auth.role, body);
    case "verdicts":
      return createVerdict(auth.role, body);
    default:
      return publishArticle(auth.role, body);
  }
}
