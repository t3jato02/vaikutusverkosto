import { describe, it, expect } from "vitest";
import {
  assistClarify,
  assistShorten,
  assistFormal,
  assistQuestion,
  assistAddReferences,
  assistCheckFactualClaims,
} from "@/lib/vaikuta/assist";

const POSITION = "Haluan, että digitaalisen infrastruktuurin rahoituksesta keskustellaan avoimesti ja läpinäkyvästi. Se on tärkeää kansalaisten luottamukselle.";

const REFS = {
  title: "TEST — Esimerkkipäätös (demo)",
  sources: [
    { sourceName: "DEMO-lähde (fiktiivinen)", sourceUrl: "https://demo.vaikutusverkosto.fi/x" },
    { sourceName: "Eduskunta — valiokunnat", sourceUrl: "https://avoindata.eduskunta.fi/api/v1/committees" },
  ],
};

describe("VAIKUTA AI assistance (section 4.3 / 5)", () => {
  it("clarify preserves the position verbatim in meaning", () => {
    const out = assistClarify(`Tämä on  ihan   tärkeä asia.   ${POSITION}`);
    expect(out.changed).toBe(true);
    expect(out.text).toContain("tärkeä asia");
    expect(out.text).toContain(POSITION.slice(0, 40));
    // No invented facts or arguments.
    expect(out.text).not.toContain("väite");
  });

  it("shorten keeps whole sentences and the core position", () => {
    const long = Array.from({ length: 40 }, () => POSITION).join(" ");
    const out = assistShorten(long, 300);
    expect(out.changed).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(500);
    expect(out.text).toContain("avoimesti");
  });

  it("returns unchanged when already short enough", () => {
    const out = assistShorten("Lyhyt viesti tässä.", 1000);
    expect(out.changed).toBe(false);
  });

  it("formal makes neutral substitutions without changing position", () => {
    const out = assistFormal("Meidän on ihan tärkeä asia, että niinku rahoitus menee oikein.");
    expect(out.text).toContain("varsin tärkeä");
    expect(out.text).not.toContain("niinku");
  });

  it("question frames the message without altering the words", () => {
    const out = assistQuestion(POSITION);
    expect(out.changed).toBe(true);
    expect(out.text).toContain("Olisin kiitollinen");
    expect(out.text).toContain(POSITION);
  });

  it("question is unchanged when already a question", () => {
    const out = assistQuestion("Onko tämä rahoitus riittävä?");
    expect(out.changed).toBe(false);
  });

  it("addReferences appends only existing decision sources", () => {
    const out = assistAddReferences(POSITION, REFS);
    expect(out.text).toContain("DEMO-lähde");
    expect(out.text).toContain("avoindata.eduskunta.fi");
    expect(out.text).toContain(POSITION);
  });

  it("checkFactualClaims lists only figure-bearing sentences", () => {
    const text = `${POSITION} Ehdotuksen kustannusarvio on 1,2 miljardia euroa ja vaikuttaa 300 kuntaan.`;
    const check = assistCheckFactualClaims(text, REFS);
    expect(check.claimsToVerify.length).toBeGreaterThan(0);
    expect(check.claimsToVerify[0]).toContain("miljardia");
  });

  it("never invents numbers that are not in the text", () => {
    const check = assistCheckFactualClaims("Tämä asia on tärkeä ilman lukuja.", REFS);
    expect(check.claimsToVerify).toEqual([]);
  });
});