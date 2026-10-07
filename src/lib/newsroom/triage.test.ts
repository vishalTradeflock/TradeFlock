import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { claimKey, entityFor, triageSignals, type TriageContext, type TriageSignal } from "./triage.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

let n = 0;
const sig = (o: Partial<TriageSignal>): TriageSignal => ({
  id: `s${++n}`, title: "8-K - ACME CORP (0000123456) (Filer)", signal_score: 80, materiality: "high",
  event_type: "m_and_a", source_type: "primary_filing", primary_entity: "ACME CORP", suggested_desk: "markets",
  cluster_key: `c${n}`, ...o,
});
const ctx = (o: Partial<TriageContext> = {}): TriageContext => ({
  openClaimKeys: new Set(), coveredTitles: [], watched: new Set(), clusterSizes: new Map(), claimBudget: 8, ...o,
});

describe("chief of staff triage routine", () => {
  it("assigns a material primary-source event to one desk and ranks highest first", () => {
    const low = sig({ title: "8-K - SMALL CO (0000999999) (Filer)", signal_score: 40, materiality: "low", event_type: "filing" });
    const big = sig({});
    const d = triageSignals([low, big], ctx());
    assert.equal(d[0].signalId, big.id);
    assert.equal(d[0].outcome, "assign");
    assert.equal(d[0].desk, "ma");
    assert.equal(d[0].entity, "ACME CORP");
    assert.equal(d[1].outcome, "reject");
  });
  it("routes by event type: macro, strategy, features, timeline, press release", () => {
    const fed = sig({ title: "FOMC statement", primary_entity: "Federal Reserve", event_type: "monetary_policy", source_type: "regulator" });
    assert.equal(triageSignals([fed], ctx())[0].desk, "macro");
    const theme = sig({ title: "8-K - BIGCO (0000222222) (Filer)", cluster_key: "big|layoffs", event_type: "layoffs" });
    assert.equal(triageSignals([theme], ctx({ clusterSizes: new Map([["big|layoffs", 4]]) }))[0].outcome, "features");
    const covered = sig({ title: "8-K - WIDGETS INC (0000333333) (Filer)", materiality: "medium", event_type: "leadership_change" });
    assert.equal(triageSignals([covered], ctx({ coveredTitles: ["widgets names new ceo"] }))[0].outcome, "timeline");
    const pr = sig({ source_type: "press_release" });
    assert.equal(triageSignals([pr], ctx())[0].outcome, "reject");
  });
  it("respects the daily budget and the per-run cap", () => {
    const many = Array.from({ length: 6 }, (_, i) => sig({ title: `8-K - CO${i} INC (000044444${i}) (Filer)` }));
    assert.equal(triageSignals(many, ctx()).filter((d) => d.outcome === "assign").length, 3);
    const none = triageSignals(many, ctx({ claimBudget: 0 }));
    assert.equal(none.filter((d) => d.outcome === "assign").length, 0);
    assert.ok(none.every((d) => d.outcome === "monitor"));
  });
});

describe("duplicate / claim prevention", () => {
  it("marks a signal duplicate when its entity+event already has an owner", () => {
    const s = sig({ title: "8-K - Ultragenyx Pharmaceutical Inc. (0001515673) (Filer)", event_type: "material_agreement" });
    const owned = new Set([claimKey(entityFor(s)!, "material_agreement")]);
    const d = triageSignals([s], ctx({ openClaimKeys: owned }));
    assert.equal(d[0].outcome, "duplicate");
    assert.equal(d[0].desk, null);
  });
  it("matches today's manual claim despite a different name form and event label", () => {
    const s = sig({ title: "8-K - Ultragenyx Pharmaceutical Inc. (0001515673) (Filer)", event_type: "material_agreement" });
    const d = triageSignals([s], ctx({ openClaimKeys: new Set([claimKey("Ultragenyx Pharmaceutical", "asset_sale")]) }));
    assert.equal(d[0].outcome, "duplicate");
  });
  it("never assigns the same entity+event or cluster twice in one run", () => {
    const a = sig({ cluster_key: "acme|m_and_a" });
    const b = sig({ cluster_key: "acme|m_and_a", signal_score: 70 });
    const c = sig({ cluster_key: "other" }); // same entity+event, different cluster
    const d = triageSignals([a, b, c], ctx());
    assert.equal(d.filter((x) => x.outcome === "assign").length, 1);
    assert.deepEqual(d.filter((x) => x.outcome === "duplicate").map((x) => x.signalId).sort(), [b.id, c.id].sort());
  });
  it("the DB keeps one open owner per entity+event", () => {
    assert.match(read("supabase/migrations/20261007_newsroom_phase1_tables.sql"), /story_claims_one_open_owner[\s\S]*lower\(entity\), lower\(event_type\)/);
  });
});

describe("triage cannot create or publish articles", () => {
  it("only touches story_signals and story_claims, and only status new", () => {
    const run = read("src/lib/newsroom/triage-run.ts");
    assert.doesNotMatch(run, /from\("articles"\)\s*\.(insert|update|upsert|delete)/);
    assert.doesNotMatch(run, /reporting_packets|editorial_verdicts|\/api\/newsroom\/publish/);
    assert.match(run, /\.eq\("status", "new"\)/);
    const wf = read(".github/workflows/chief-of-staff-triage.yml");
    assert.match(wf, /"published":0/);
    assert.match(wf, /"articlesCreated":0/);
    assert.equal((wf.match(/- cron:/g) ?? []).length, 3);
  });
  it("desks discover assignments with desk=mine on the existing claims list", () => {
    assert.match(read("src/lib/newsroom/api.ts"), /deskParam === "mine" \? deskForRole\(auth\.role\)/);
  });
});
