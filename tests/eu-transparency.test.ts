import { describe, it, expect } from "vitest";
import "dotenv/config";
import { euTransparencyAdapter } from "@/lib/agents/euTransparency";
import type { RunContext } from "@/lib/agents/types";

const ctx = { log: () => {}, stats: {} } as unknown as RunContext;

const orgMeta = {
  code: "12345678901-23",
  name: "Testijärjestö ry",
  acronym: "TJ",
  entityForm: "Yhdistys",
  category: "Trade and business associations",
  registrationDate: "2019-01-01T00:00:00.000Z",
  city: "Helsinki",
  interests: ["Public health", "Environment"],
  clients: ["Big Client Oy", "Another Client GmbH"],
  levels: ["european", "national"],
};
const doc = { id: "eu-tr:12345678901-23", url: "https://transparency-register.europa.eu/odplastorganisationxml_en#x", title: "t", hash: "", meta: orgMeta };

describe("EU Transparency Register parser (Sprint C4)", () => {
  it("emits a deterministic SOURCE_CONFIRMED registration relationship", async () => {
    const facts = await euTransparencyAdapter.parse(ctx, doc, orgMeta);
    const reg = facts.find((f) => f.relationshipType === "REGISTERED_LOBBY_ORGANIZATION");
    expect(reg).toBeTruthy();
    expect(reg!.source.name).toBe("Testijärjestö ry");
    expect(reg!.source.externalId).toEqual({ provider: "eu-tr", identifier: "12345678901-23" });
    expect(reg!.target.name).toBe("EU:n avoimuusrekisteri");
    expect(reg!.extractionMethod).toBe("deterministic-parser");
    expect(reg!.confidence).toBe("VERIFIED");
    expect(reg!.assertedCurrent).toBe(true);
    expect(reg!.startDate).toBeInstanceOf(Date);
    expect(reg!.role).toContain("Trade and business associations");
  });

  it("clients become rule candidates (REPRESENTS_INTERESTS_OF), never auto-published", async () => {
    const facts = await euTransparencyAdapter.parse(ctx, doc, orgMeta);
    const clientFacts = facts.filter((f) => f.relationshipType === "REPRESENTS_INTERESTS_OF");
    expect(clientFacts.length).toBe(2);
    for (const c of clientFacts) {
      expect(c.extractionMethod).toBe("rule");
      expect(c.confidence).toBe("MEDIUM");
    }
  });

  it("never produces an INFLUENCES relationship", async () => {
    const facts = await euTransparencyAdapter.parse(ctx, doc, orgMeta);
    expect(facts.every((f) => String(f.relationshipType) !== "INFLUENCES")).toBe(true);
  });

  it("registry metadata: OFFICIAL_REGISTER, EU parliament/commission", () => {
    expect(euTransparencyAdapter.sourceType).toBe("OFFICIAL_REGISTER");
    expect(euTransparencyAdapter.reliabilityTier).toBe("OFFICIAL_REGISTER");
    expect(euTransparencyAdapter.id).toBe("eu-transparency-register");
  });
});
