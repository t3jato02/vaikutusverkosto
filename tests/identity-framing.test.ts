// Identity-framing regression tests (luku 19). The nine required cases plus
// the absolute safety guardrails (luku 7). DB-backed cases self-seed a test
// person and clean up afterwards; files run serially against the shared DB.

import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/lib/db";
import { analyzeArticle, parseExplicitBirthStatements, snapshotHash } from "@/lib/analysis/identity/classifier";
import { writeBirthOriginFact, writeCitizenshipFact } from "@/lib/analysis/identity/facts";
import { checkSensitiveFact, UNKNOWN_VALUE, sampleSufficient, MIN_ANALYSIS_SAMPLE } from "@/lib/analysis/identity/safety";
import { getPersonIdentityFacts } from "@/lib/analysis/identity/queries";
import { reviewIdentityFact, listIdentityReviewQueue } from "@/lib/analysis/identity/review";
import { identityRunScopeHash } from "@/lib/analysis/identity/engine";
import { computeReverseComparison } from "@/lib/analysis/identity/reverse";
import { matchCohorts, type ReversePersonProfile } from "@/lib/analysis/identity/reverse";

const createdIds: string[] = [];

async function makePerson(name: string, birthYear?: number): Promise<string> {
  const e = await db.entity.create({
    data: {
      type: "PERSON",
      canonicalName: name,
      jurisdiction: "FI",
      entityCategory: "OTHER",
      confidence: "HIGH",
      sourceCount: 0,
    },
  });
  await db.person.create({ data: { entityId: e.id, birthYear: birthYear ?? null } });
  createdIds.push(e.id);
  return e.id;
}

afterAll(async () => {
  await db.entity.deleteMany({ where: { id: { in: createdIds } } });
  await db.$disconnect();
});

const SRC = { url: "https://example.com/bio", name: "Julkinen elämäkerta", type: "REPUTABLE_MEDIA" };

function personRef(id: string, name: string) {
  return { entityId: id, names: [name] };
}

describe("1 — Nepalissa syntynyt + Suomen kansalainen pysyvät erillisinä", () => {
  it("birthCountry=NP ja citizenship=FI säilyvät molemmat eri tietoina", async () => {
    const id = await makePerson("Testi Nepal 1", 1985);
    await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "NP", displayValue: "Nepal", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    await writeCitizenshipFact({ personEntityId: id, countryCode: "FI", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    const f = await getPersonIdentityFacts(id);
    expect(f.birthCountry?.value).toBe("NP");
    expect(f.citizenships.map((c) => c.countryCode)).toContain("FI");
    // syntymämaa EI muutu kansalaisuudeksi eikä päinvastoin
    expect(f.birthCountry?.value).not.toBe("FI");
  });
});

describe("2 — Suomessa syntynyt + USA:n kansalainen", () => {
  it("birthCountry=FI ja citizenship=US säilyvät", async () => {
    const id = await makePerson("Testi Suomi-US 1", 1980);
    await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "FI", displayValue: "Suomi", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    await writeCitizenshipFact({ personEntityId: id, countryCode: "US", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    const f = await getPersonIdentityFacts(id);
    expect(f.birthCountry?.value).toBe("FI");
    expect(f.citizenships.map((c) => c.countryCode)).toContain("US");
  });
});

describe("3 — Kaksoiskansalainen", () => {
  it("molemmat kansalaisuudet säilyvät erillisinä", async () => {
    const id = await makePerson("Testi Kaksois 1");
    await writeCitizenshipFact({ personEntityId: id, countryCode: "FI", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    await writeCitizenshipFact({ personEntityId: id, countryCode: "US", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    const f = await getPersonIdentityFacts(id);
    const codes = f.citizenships.map((c) => c.countryCode).sort();
    expect(codes).toEqual(["FI", "US"]);
  });
});

describe("4 — Tuntematon syntymämaa: EI arvata nimestä", () => {
  it("ilman lähdettä syntymämaata ei voi kirjata (guardi hylkää)", () => {
    const violations = checkSensitiveFact({ sourceUrl: "", sourceName: "nimipohjainen arvaus", sourceType: "REPUTABLE_MEDIA", confidence: "LOW" });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("sosiaalisen median viesti ei yksin vahvista syntymämaata", () => {
    const violations = checkSensitiveFact({ sourceUrl: "https://x.com/u/status/1", sourceName: "some", sourceType: "REPUTABLE_MEDIA", confidence: "HIGH" });
    expect(violations.some((v) => /sosiaalisen/i.test(v))).toBe(true);
  });

  it("ilman 'syntyi X' -ilmausta ei synny syntymäpaikkahavaintoa", () => {
    expect(parseExplicitBirthStatements("Nepalilainen näköinen henkilö puhui tilaisuudessa.")).toEqual([]);
  });

  it("puuttuva tieto on UNKNOWN, ei arvaus", () => {
    expect(UNKNOWN_VALUE).toBe("Ei vahvistettua tietoa");
  });
});

describe("5 — Media käyttää 'suomalaista' Nepalissa syntyneestä: termi säilyy, syntymämaa pysyy NP", () => {
  it("luokittelija poimii 'suomalainen' sanatarkasti ja syntymämaa säilyy NP", async () => {
    const id = await makePerson("Testi Nepal Media 1");
    await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "NP", displayValue: "Nepal", sourceUrl: SRC.url, sourceName: SRC.name, sourceType: SRC.type, confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    const res = analyzeArticle({
      title: "Testi Nepal Media 1 valittiin kaupunginvaltuustoon",
      excerpt: "Kauan Suomessa asunut Testi Nepal Media 1 on nyt suomalainen luottamushenkilö.",
      persons: [personRef(id, "Testi Nepal Media 1")],
      headlinePersonEntityIds: [id],
    });
    const suomalainen = res.mentions.find((m) => m.expressionNormalized === "suomalainen");
    expect(suomalainen).toBeTruthy();
    expect(suomalainen!.expression).toBe("suomalainen");
    expect(suomalainen!.termCategory).toBe("NATIONALITY");
    const f = await getPersonIdentityFacts(id);
    expect(f.birthCountry?.value).toBe("NP");
  });
});

describe("6 — Media käyttää 'nepalilaista': termi säilyy sanatarkasti", () => {
  it("poimii 'nepalilainen' eikä muunna sitä syntymämaaksi", () => {
    const id = "p-0000-0000-0000-000000000001";
    const res = analyzeArticle({
      title: "Nepalilainen vieraana",
      excerpt: "Nepalilainen asiantuntija vieraili Helsingissä.",
      persons: [personRef(id, "Testi Nepal Media 2")],
    });
    // Attribution-guard: henkilön nimeä ei mainita → ei mainintaa (ei arvausta)
    expect(res.mentions.length).toBe(0);
  });

  it("kun henkilö mainitaan, 'nepalilainen' tallennetaan sanatarkasti", () => {
    const id = "p-0000-0000-0000-000000000002";
    const res = analyzeArticle({
      title: "Testi Nepal Media 2 -haastattelu",
      excerpt: "Testi Nepal Media 2 on nepalilainen juristi, joka on asunut Suomessa kymmenen vuotta.",
      persons: [personRef(id, "Testi Nepal Media 2")],
    });
    const m = res.mentions.find((x) => x.expressionNormalized === "nepalilainen");
    expect(m).toBeTruthy();
    expect(m!.expression).toBe("nepalilainen");
    expect(m!.termCategory).toBe("NATIONALITY");
  });
});

describe("7 — Ristiriitaiset lähteet → tarkistusjono, ei automaattista julkaisua", () => {
  it("kaksi eri syntymämaatietoa pysyvät PENDING ja eivät julkistu faktana", async () => {
    const id = await makePerson("Testi Konflikti 1");
    await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "NP", displayValue: "Nepal", sourceUrl: "https://a.example.com/x", sourceName: "Lähde A", sourceType: "REPUTABLE_MEDIA", confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PENDING_REVIEW" });
    await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "IN", displayValue: "Intia", sourceUrl: "https://b.example.com/y", sourceName: "Lähde B", sourceType: "REPUTABLE_MEDIA", confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PENDING_REVIEW" });
    // julkistamaton (vain PUBLISHED näytetään) → ei automaattista faktan julkaisua
    const f = await getPersonIdentityFacts(id);
    expect(f.birthCountry).toBeNull();
    // jonossa on ristiriitaiset ehdotukset
    const queue = await listIdentityReviewQueue(100);
    const birthItems = queue.filter((q) => q.table === "birth_origin" && q.personName === "Testi Konflikti 1");
    expect(birthItems.length).toBeGreaterThanOrEqual(2);
    // ihmisen hyväksyntä julkaisee yhden
    const approve = await reviewIdentityFact("birth_origin", birthItems[0].id, "approve");
    expect(approve.ok).toBe(true);
    const f2 = await getPersonIdentityFacts(id);
    expect(f2.birthCountry).not.toBeNull();
  });
});

describe("8 — Pieni otos → ei vahvaa bias-väitettä", () => {
  it("MIN_ANALYSIS_SAMPLE=5 ja alle sen ei riitä", () => {
    expect(MIN_ANALYSIS_SAMPLE).toBe(5);
    expect(sampleSufficient(4)).toBe(false);
    expect(sampleSufficient(5)).toBe(true);
  });

  it("käänteisvertailu palauttaa INSUFFICIENT_SAMPLE pienellä aineistolla", async () => {
    const r = await computeReverseComparison();
    expect(r.status).toBe("INSUFFICIENT_SAMPLE");
    expect(r.outcome).toBeNull();
    expect(r.matchedPairs).toBeLessThan(MIN_ANALYSIS_SAMPLE);
  });
});

describe("9 — Uudelleenlaskenta: sama versio tuottaa deterministisesti saman tuloksen", () => {
  it("analyzeArticle on deterministinen (samat syötteet → samat maininnat + snapshot)", () => {
    const input = {
      title: "Linus Torvalds",
      excerpt: "Linus Torvalds syntyi Helsingissä ja on suomalais-amerikkalainen kehittäjä, jota on kutsuttu amerikkalaiseksi.",
      persons: [personRef("p-linus", "Linus Torvalds")],
      headlinePersonEntityIds: ["p-linus"],
    };
    const a = analyzeArticle(input);
    const b = analyzeArticle(input);
    expect(a).toEqual(b);
    expect(a.snapshot).toBe(b.snapshot);
  });

  it("scopeHash on deterministinen", () => {
    const base = { scope: "CORPUS", entityId: null, periodStart: "2021-01-01", periodEnd: "2021-12-31" };
    expect(identityRunScopeHash(base)).toBe(identityRunScopeHash(base));
    expect(identityRunScopeHash(base)).not.toBe(identityRunScopeHash({ ...base, periodEnd: "2022-12-31" }));
  });

  it("snapshotHash on deterministinen", () => {
    expect(snapshotHash("a", "b")).toBe(snapshotHash("a", "b"));
    expect(snapshotHash("a", "b")).not.toBe(snapshotHash("a", "c"));
  });
});

describe("matching — samankaltaisten tapausten paritus (luku 12)", () => {
  const prof = (id: string, by: number, role: boolean, citizenships: number, tenure: number | null): ReversePersonProfile => ({
    personEntityId: id, name: id, birthCountry: "FI", birthYear: by, citizenships: [], citizenshipCount: citizenships,
    residenceCountry: null, residenceTenureBucket: tenure, hasPublicRole: role, mentionCount: 0, suomalainenMentions: 0, hostEthnonymMentions: 0,
  });
  it("parittaa saman ikävuosikymmenen ja roolin tapaukset", () => {
    const A = [prof("a1", 1980, true, 1, 1), prof("a2", 1970, false, 1, 0)];
    const B = [prof("b1", 1982, true, 1, 1), prof("b2", 1965, false, 2, 0)];
    const pairs = matchCohorts(A, B);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    // a1 (1980, role, single, tenure1) vastaa parhaiten b1 (1982, role, single, tenure1)
    const best = pairs.find((p) => p.a.personEntityId === "a1");
    expect(best?.b.personEntityId).toBe("b1");
  });
});

describe("absoluuttiset turvarajat (luku 7) — ei päätelmiä", () => {
  it("heikko lähde + matala luottamus ei riitä herkkään henkilötietoon", () => {
    const violations = checkSensitiveFact({ sourceUrl: "https://example.com/u", sourceName: "Arvaus sukunimestä", sourceType: "SECONDARY_MEDIA", confidence: "LOW" });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("syntymämaata ei voi kirjata ilman osoitettavaa lähdettä", async () => {
    const id = await makePerson("Testi Ei Lähdettä 1");
    const r = await writeBirthOriginFact({ personEntityId: id, factKind: "BIRTH_COUNTRY", value: "NP", displayValue: "Nepal", sourceUrl: "", sourceName: "", sourceType: "REPUTABLE_MEDIA", confidence: "HIGH", evidenceGrade: "C", reviewStatus: "PUBLISHED" });
    expect(r.ok).toBe(false);
  });

  it("media-ilmaus ei muutu faktaksi: luokittelija ei kirjoita syntymämaata", async () => {
    // vain luokittelija (mentions) — ei koskaan faktaa
    const id = await makePerson("Testi Ei Faktaksi 1");
    const res = analyzeArticle({
      title: "Testi Ei Faktaksi 1 -juttu",
      excerpt: "Testi Ei Faktaksi 1 on suomalainen asiantuntija.",
      persons: [personRef(id, "Testi Ei Faktaksi 1")],
    });
    expect(res.mentions.some((m) => m.termCategory === "NATIONALITY")).toBe(true);
    const f = await getPersonIdentityFacts(id);
    expect(f.birthCountry).toBeNull();
  });
});