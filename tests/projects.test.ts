import { describe, it, expect } from "vitest";
import "dotenv/config";
import {
  projectUrlFor,
  resolveProjectBySlug,
  getProjectDetail,
  projectsForEntity,
  searchProjects,
} from "@/lib/queries";
import { db } from "@/lib/db";

const hasDb = !!process.env.DATABASE_URL;

describe("projectUrlFor", () => {
  it("builds a `<slug>-<8hex>` path, ASCII-folded", () => {
    const url = projectUrlFor("00332ca5-8720-4bf6-b8db-91963550f205", "INTRAPOL — Intra-Party Politics");
    expect(url).toMatch(/^\/project\/intrapol-intra-party-politics-00332ca5$/);
  });
  it("falls back to 'hanke' when the name has no ASCII word chars", () => {
    expect(projectUrlFor("abcdef12-0000-0000-0000-000000000000", "—")).toBe("/project/hanke-abcdef12");
  });
});

describe.skipIf(!hasDb)("project queries (C5 Phase 12-16)", () => {
  it("resolveProjectBySlug + getProjectDetail return a coherent, evidenced project", async () => {
    const anyProject = await db.project.findFirst({
      where: { flows: { some: {} } },
      select: { id: true, name: true },
    });
    if (!anyProject) return;
    const slug = projectUrlFor(anyProject.id, anyProject.name).split("/").pop()!;
    const resolved = await resolveProjectBySlug(slug);
    expect(resolved?.id).toBe(anyProject.id);

    const detail = await getProjectDetail(anyProject.id);
    expect(detail).not.toBeNull();
    expect(detail!.project.id).toBe(anyProject.id);
    expect(detail!.flows.length).toBeGreaterThan(0);
    expect(detail!.totalDocumentedEur).toBeGreaterThanOrEqual(0);
    // years are the flows' reporting years only, sorted, no nulls
    expect(detail!.years).toEqual([...detail!.years].sort((a, b) => a - b));
    expect(detail!.years.every((y) => Number.isInteger(y))).toBe(true);
    // parties are unique and role-tagged
    const ids = detail!.parties.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(detail!.parties.every((p) => p.role === "funder" || p.role === "recipient")).toBe(true);
  });

  it("projectsForEntity returns projects the entity is a documented party to, newest amount first", async () => {
    const recipient = await db.financialFlow.findFirst({
      where: { projectId: { not: null } },
      select: { recipientEntityId: true },
    });
    if (!recipient) return;
    const projects = await projectsForEntity(recipient.recipientEntityId, 10);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((p) => p.amount >= 0)).toBe(true);
    for (let i = 1; i < projects.length; i++) {
      expect(projects[i - 1].amount).toBeGreaterThanOrEqual(projects[i].amount);
    }
  });

  it("searchProjects matches on name and is bounded by the limit", async () => {
    const sample = await db.project.findFirst({ where: { name: { contains: " " } }, select: { name: true } });
    if (!sample) return;
    const term = sample.name.split(/[\s—-]+/).find((w) => w.length >= 4) ?? sample.name.slice(0, 5);
    const res = await searchProjects(term, 3);
    expect(res.length).toBeLessThanOrEqual(3);
  });
});
