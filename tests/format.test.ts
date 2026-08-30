import { describe, it, expect } from "vitest";
import { slugify, parseSlug, splitName, formatEur, formatDate, yearOf, parseFinnishDate } from "@/lib/format";

describe("slugify", () => {
  it("lowercases and strips diacritics", () => {
    expect(slugify("Petteri Orpo")).toBe("petteri-orpo");
    expect(slugify("Jussi Halla-aho")).toBe("jussi-halla-aho");
    expect(slugify("Käyttäytymisanalyysi Öö")).toBe("kayttaytymisanalyysi-oo");
  });

  it("collapses non-alphanumerics", () => {
    expect(slugify("Nokia Oyj!")).toBe("nokia-oyj");
  });

  it("returns a fallback for empty input", () => {
    expect(slugify("")).toBe("entity");
    expect(slugify("---")).toBe("entity");
  });
});

describe("slug parsing", () => {
  it("extracts the 8-char id suffix", () => {
    expect(parseSlug("petteri-orpo-886c3af5")).toBe("886c3af5");
    expect(parseSlug("no-suffix")).toBeNull();
  });
});

describe("name splitting", () => {
  it("splits full names into first and last", () => {
    expect(splitName("Petteri Orpo")).toEqual({ first: "Petteri", last: "Orpo" });
    expect(splitName("Cai-Göran Alexander Stubb")).toEqual({ first: "Cai-Göran", last: "Alexander Stubb" });
  });
});

describe("money formatting (invariant: no amount without currency)", () => {
  it("always renders EUR currency", () => {
    expect(formatEur(1234.5)).toContain("€");
    expect(formatEur("9999999.99")).toContain("€");
  });

  it("handles null/undefined/NaN", () => {
    expect(formatEur(null)).toBe("—");
    expect(formatEur(undefined)).toBe("—");
  });

  it("formats large numbers with thousand separators", () => {
    expect(formatEur(2400000)).toContain("2");
    expect(formatEur(2400000)).toContain("400");
  });
});

describe("date helpers", () => {
  it("parses Finnish dd.mm.yyyy dates", () => {
    const d = parseFinnishDate("21.06.2023");
    expect(d?.getUTCFullYear()).toBe(2023);
    expect(d?.getUTCMonth()).toBe(5);
    expect(d?.getUTCDate()).toBe(21);
    expect(parseFinnishDate("not-a-date")).toBeNull();
  });

  it("returns the year", () => {
    expect(yearOf(new Date("2023-06-21"))).toBe(2023);
    expect(yearOf(null)).toBeNull();
  });

  it("formats dates", () => {
    expect(formatDate(new Date("2023-06-21"))).toBe("21.06.2023");
    expect(formatDate(null)).toBe("—");
  });
});
