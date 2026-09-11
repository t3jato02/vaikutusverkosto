import { describe, it, expect } from "vitest";
import "dotenv/config";
import { sidonnaisuudetAdapter } from "@/lib/agents/sidonnaisuudet";
import type { RunContext, NormalizedFact } from "@/lib/agents/types";

const ctx = { log: () => {}, stats: {} } as unknown as RunContext;

function detail(declarations: { RyhmaOtsikko?: string; Sidonta?: string }[]) {
  return { jsonNode: { Henkilo: { Sidonnaisuudet: { Sidonnaisuus: declarations } } } };
}
const doc = {
  id: "sidonnaisuus:999",
  url: "https://avoindata.eduskunta.fi/api/v1/memberofparliament/999/fi",
  title: "Sidonnaisuudet — Testi Edustaja",
  hash: "",
  meta: { hetekaId: 999, name: "Testi Edustaja" },
};

describe("sidonnaisuudet rule extraction (B.5 Phase 6)", () => {
  it("emits rule-based candidates only for clearly-parseable board/council roles", async () => {
const facts = (await sidonnaisuudetAdapter.parse(
      ctx,
      doc,
      detail([
        { RyhmaOtsikko: "Hallinto- ja luottamustehtävät", Sidonta: "Kalevi Sorsa -säätiö hallituksen puheenjohtaja" },
        { RyhmaOtsikko: "Hallinto- ja luottamustehtävät", Sidonta: "Helsingin kaupunginvaltuuston jäsen." },
        { RyhmaOtsikko: "Palkatut toimet", Sidonta: "Ei ilmoitettavia sidonnaisuuksia" },
        { RyhmaOtsikko: "Muut sidonnaisuudet", Sidonta: "-" },
        { RyhmaOtsikko: "Ammatin harjoittaminen", Sidonta: "Toimin freelancer-toimittajana." },
]),
    )) as NormalizedFact[];
    expect(facts.length).toBe(2);
    expect(facts.every((f) => f.extractionMethod === "rule")).toBe(true);
    expect(facts.every((f) => f.confidence === "MEDIUM")).toBe(true);
    expect(facts.every((f) => f.evidenceUrl === doc.url)).toBe(true);
    const chair = facts.find((f) => f.role?.includes("puheenjohtaja"));
    expect(chair?.relationshipType).toBe("CHAIRS");
    expect(chair?.target.name).toContain("Kalevi Sorsa");
    const council = facts.find((f) => f.role?.includes("kaupunginvaltuuston"));
    expect(council?.relationshipType).toBe("MEMBER_OF");
  });

  it("emits nothing when there are no declared interests", async () => {
    const facts = await sidonnaisuudetAdapter.parse(
      ctx,
      doc,
      detail([{ RyhmaOtsikko: "Kaikki", Sidonta: "Ei ilmoitettavia sidonnaisuuksia" }]),
    );
    expect(facts).toEqual([]);
  });

  it("registry metadata marks it a PUBLIC_DISCLOSURE weekly source", () => {
    expect(sidonnaisuudetAdapter.reliabilityTier).toBe("PUBLIC_DISCLOSURE");
    expect(sidonnaisuudetAdapter.schedule).toBe("weekly");
    expect(sidonnaisuudetAdapter.sourceType).toBe("OFFICIAL_PRIMARY");
  });
});
