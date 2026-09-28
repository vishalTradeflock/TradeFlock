import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editorialDek,
  isFutureHoldStamp,
  isHoldCopy,
  publishedAtForStudioPublish,
  stripHoldNote,
  withHoldNote,
} from "./hold-copy.ts";

describe("hold copy", () => {
  it("recognizes pipeline failure text and leaves a real dek alone", () => {
    assert.equal(
      isHoldCopy("too_short — below Forbes length bar (~184 words, need ≥550); voice: remove em dashes"),
      true,
    );
    assert.equal(isHoldCopy("Held as draft. House style: headings: template heading."), true);
    assert.equal(isHoldCopy("voice: remove em dashes; headings: use at least 2 story-specific subheadings"), true);
    assert.equal(
      isHoldCopy("Acme agreed to buy Northwind for $4.2 billion, the companies said."),
      false,
    );
    assert.equal(isHoldCopy("The source: CNBC reported the cash and stock terms."), false);
  });

  it("stores the reason in a comment and builds a public dek from the story", () => {
    const body = "<p>Acme agreed to buy Northwind for $4.2 billion in cash and stock.</p>";
    const withNote = withHoldNote(body, "too_short — below Forbes length bar (~184 words, need ≥550)");
    assert.match(withNote, /tradeflock-hold:/);
    assert.equal(withNote.includes("\u2014"), false);
    assert.equal(stripHoldNote(withNote), body);
    assert.equal(
      editorialDek("too_short — below Forbes length bar", body, "Acme Buys Northwind"),
      "Acme agreed to buy Northwind for $4.2 billion in cash and stock.",
    );
    assert.equal(
      editorialDek("Acme agreed to buy Northwind for $4.2 billion.", body, "Acme Buys Northwind"),
      "Acme agreed to buy Northwind for $4.2 billion.",
    );
  });

  it("resets a future hold stamp when Studio publishes", () => {
    const now = Date.parse("2026-09-28T12:00:00.000Z");
    const future = "2027-09-28T12:00:00.000Z";
    assert.equal(isFutureHoldStamp(future, now), true);
    assert.equal(isFutureHoldStamp("2026-09-28T11:00:00.000Z", now), false);
    assert.equal(
      publishedAtForStudioPublish({
        previousStatus: "draft",
        previousPublishedAt: future,
        now,
      }),
      "2026-09-28T12:00:00.000Z",
    );
    assert.equal(
      publishedAtForStudioPublish({
        previousStatus: "published",
        previousPublishedAt: future,
        now,
      }),
      "2026-09-28T12:00:00.000Z",
    );
    assert.equal(
      publishedAtForStudioPublish({
        previousStatus: "published",
        previousPublishedAt: "2026-09-20T12:00:00.000Z",
        now,
      }),
      undefined,
    );
  });
});
