import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { hashJson, hashText, contentHash } from "@/lib/ingestion/hash";
import { collect, markDocumentProcessed } from "@/lib/ingestion/collector";
import type { DocumentDescriptor } from "@/lib/ingestion/types";
import { db } from "@/lib/db";

describe("canonical hashing (Phase 3)", () => {
  it("is stable across object key order", () => {
    expect(hashJson({ a: 1, b: 2 })).toBe(hashJson({ b: 2, a: 1 }));
    expect(hashJson({ x: { p: 1, q: 2 } })).toBe(hashJson({ x: { q: 2, p: 1 } }));
  });
  it("ignores insignificant whitespace in text", () => {
    expect(hashText("hello   world")).toBe(hashText("hello world"));
    expect(hashText("a\r\nb")).toBe(hashText("a\nb"));
    expect(hashText("x\n\n\n\ny")).toBe(hashText("x\ny"));
  });
  it("changes when meaningful content changes", () => {
    expect(hashJson({ a: 1 })).not.toBe(hashJson({ a: 2 }));
    expect(hashText("real change")).not.toBe(hashText("real  change!"));
  });
  it("contentHash dispatches on payload shape", () => {
    expect(contentHash({ json: { a: 1 } })).toBe(hashJson({ a: 1 }));
    expect(contentHash({ text: "t" })).toBe(hashText("t"));
  });
});

const hasDb = !!process.env.DATABASE_URL;
const SRC_ID = "test-collector-source";

describe.skipIf(!hasDb)("collector change detection (Phase 3)", () => {
  beforeAll(async () => {
    await db.sourceDocument.deleteMany({ where: { ingestionSourceId: SRC_ID } });
    await db.ingestionSource.deleteMany({ where: { id: SRC_ID } });
    await db.ingestionSource.create({
      data: {
        id: SRC_ID,
        name: "Test Collector Source",
        publisher: "test",
        baseUrl: "https://example.test/",
        sourceType: "OTHER",
        adapter: SRC_ID,
      },
    });
  });
  afterAll(async () => {
    await db.sourceDocument.deleteMany({ where: { ingestionSourceId: SRC_ID } });
    await db.ingestionSource.deleteMany({ where: { id: SRC_ID } });
  });

  const desc = (payload: unknown, err?: string): DocumentDescriptor => ({
    externalId: "doc-1",
    url: "https://example.test/doc-1",
    fetch: async () => {
      if (err) throw new Error(err);
      return { json: payload };
    },
  });

  it("first sight → new, PENDING, payload present", async () => {
    const s = await collect(SRC_ID, [desc({ v: 1, items: ["a", "b"] })]);
    expect(s.new).toBe(1);
    expect(s.documents[0].change).toBe("new");
    expect(s.documents[0].payload).toBeTruthy();
    const row = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    expect(row?.processingStatus).toBe("PENDING");
    expect(row?.revision).toBe(1);
  });

  it("identical content (reordered keys) → unchanged, no payload, no new revision", async () => {
    const before = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    const s = await collect(SRC_ID, [desc({ items: ["a", "b"], v: 1 })]);
    expect(s.unchanged).toBe(1);
    expect(s.documents[0].change).toBe("unchanged");
    expect(s.documents[0].payload).toBeUndefined();
    const after = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    expect(after?.revision).toBe(before?.revision);
    expect(after!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before!.lastSeenAt.getTime());
  });

  it("changed content → changed, revision++, lastChangedAt advances, back to PENDING, payload present", async () => {
    await db.sourceDocument.updateMany({ where: { ingestionSourceId: SRC_ID }, data: { processingStatus: "PROCESSED" } });
    const before = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    const s = await collect(SRC_ID, [desc({ v: 2, items: ["a", "b", "c"] })]);
    expect(s.changed).toBe(1);
    const after = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    expect(after!.revision).toBe(before!.revision + 1);
    expect(after!.lastChangedAt.getTime()).toBeGreaterThan(before!.lastChangedAt.getTime());
    expect(after!.processingStatus).toBe("PENDING");
    expect(s.documents[0].payload).toBeTruthy();
  });

  it("fetch failure → error, old row untouched", async () => {
    const before = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    const s = await collect(SRC_ID, [desc(null, "network unreachable")]);
    expect(s.errors).toBe(1);
    expect(s.documents[0].change).toBe("error");
    expect(s.documents[0].error).toContain("network unreachable");
    const after = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    expect(after!.contentHash).toBe(before!.contentHash);
    expect(after!.revision).toBe(before!.revision);
  });

  it("markDocumentProcessed records terminal state", async () => {
    const row = await db.sourceDocument.findFirst({ where: { ingestionSourceId: SRC_ID } });
    await markDocumentProcessed(row!.id, { ok: true, parserVersion: "test-1" });
    let after = await db.sourceDocument.findUnique({ where: { id: row!.id } });
    expect(after?.processingStatus).toBe("PROCESSED");
    expect(after?.parserVersion).toBe("test-1");
    await markDocumentProcessed(row!.id, { ok: false, error: "boom" });
    after = await db.sourceDocument.findUnique({ where: { id: row!.id } });
    expect(after?.processingStatus).toBe("FAILED");
    expect(after?.processingError).toContain("boom");
  });
});
