import { describe, it, expect } from "vitest";
import { hasMojibake, repairMojibake } from "@/lib/encoding";

// Build a mojibake string the way the DB actually held it: real UTF-8 bytes
// re-interpreted as Latin-1.
function mojibake(correct: string): string {
  return Buffer.from(correct, "utf8").toString("latin1");
}

const FINNISH = [
  "Työelämä- ja tasa-arvovaliokunta",
  "Ympäristövaliokunta",
  "Maa- ja metsätalousvaliokunta",
  "Jäsen",
  "Varajäsen",
  "Närpiö",
  "Kankaanpää",
  "Ville Väyrynen",
  "Peter Östman",
  "Åland",
  "Lindén",
  "Ammatti: diplomi-insinööri",
  "Hämeenlinna",
  "Lempäälä",
];

describe("repairMojibake", () => {
  it("reverses UTF-8→Latin-1 corruption for Finnish text", () => {
    for (const correct of FINNISH) {
      expect(repairMojibake(mojibake(correct))).toBe(correct);
    }
  });

  it("is idempotent — already-correct text is never altered", () => {
    for (const correct of FINNISH) {
      expect(repairMojibake(correct)).toBe(correct);
      expect(repairMojibake(repairMojibake(mojibake(correct)))).toBe(correct);
    }
  });

  it("preserves every Finnish diacritic and dash exactly", () => {
    const s = "ä ö å Ä Ö Å é è ü – — … 'quote' ’";
    expect(repairMojibake(s)).toBe(s);
    expect(hasMojibake(s)).toBe(false);
  });

  it("repairs a run while preserving an adjacent correctly-stored em dash", () => {
    // "Sidonnaisuudet — <name>": the em dash was stored correctly, the name was not.
    const input = "Sidonnaisuudet — " + mojibake("Ville Väyrynen");
    expect(repairMojibake(input)).toBe("Sidonnaisuudet — Ville Väyrynen");
  });

  it("handles the lone C1-control variant (Ö → U+00C3 U+0096)", () => {
    expect(repairMojibake("Peter Ãstman")).toBe("Peter Östman");
  });

  it("leaves genuinely non-repairable text untouched", () => {
    for (const s of ["", "plain ascii", "1 + 2 = 3", "Café Ø", "naïve", "€50 000"]) {
      expect(repairMojibake(s)).toBe(s);
    }
  });

  it("never emits the U+FFFD replacement character", () => {
    for (const correct of FINNISH) {
      expect(repairMojibake(mojibake(correct))).not.toContain("�");
    }
  });
});

describe("hasMojibake", () => {
  it("flags corrupted Finnish and passes clean Finnish", () => {
    for (const correct of FINNISH) {
      expect(hasMojibake(mojibake(correct))).toBe(true);
      expect(hasMojibake(correct)).toBe(false);
    }
  });
});
