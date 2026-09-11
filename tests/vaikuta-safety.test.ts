import { describe, it, expect } from "vitest";
import {
  checkMessage,
  contentHash,
  cleanText,
  isIdenticalTo,
  MAX_BODY,
  MAX_SUBJECT,
} from "@/lib/vaikuta/safety";

describe("VAIKUTA message validation (section 5)", () => {
  it("accepts a normal citizen message", () => {
    const r = checkMessage("Näkemykseni digi-infrastruktuurista", "Haluan, että digitaalisen infrastruktuurin rahoituksesta keskustellaan avoimesti ja läpinäkyvästi.");
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.flags).toEqual([]);
  });

  it("requires subject and a long enough body", () => {
    expect(checkMessage("", "valid enough body length passes").ok).toBe(false);
    expect(checkMessage("Otsikko", "liian lyhyt").ok).toBe(false);
  });

  it("trims control characters and caps sizes", () => {
    const subject = "a".repeat(500);
    const r = checkMessage(subject, "b".repeat(MAX_BODY + 100));
    expect(r.subject.length).toBe(MAX_SUBJECT);
    expect(r.body.length).toBe(MAX_BODY);
  });

  it("flags phishing-style content (banks/logins + urgency) for moderation", () => {
    const r = checkMessage("Tärkeä viesti", "Vahvista tilisi välittömästi tai pääsy katkeaa. Kirjaudu pankkisi kautta osoitteessa https://bit.ly/x");
    expect(r.flags.some((f) => f.code === "phishing_hint")).toBe(true);
    expect(r.flags.some((f) => f.code === "url_shortener")).toBe(true);
  });

  it("flags url-heavy bodies for moderation", () => {
    const manyLinks = "Kun klikkaat https://a.fi https://b.fi https://c.fi https://d.fi saat lisätietoa tästä asiasta josta haluan keskustella.";
    const r = checkMessage("Otsikko", manyLinks);
    expect(r.flags.some((f) => f.code === "url_heavy")).toBe(true);
  });

  it("flags doxxing patterns (mobile number + private address hint)", () => {
    const r = checkMessage("Otsikko", "Kotiosoite tästä löytyy ja puhelinnumero 040 123 4567 on hänen yksityinen numeronsa. Tämä on vakava asia keskustelulle.");
    expect(r.flags.some((f) => f.code === "doxxing_hint")).toBe(true);
  });

  it("flags impersonation patterns", () => {
    const r = checkMessage("Otsikko", "Kirjoitan sinulle ministerin nimissä ja väitän olevani virkakoneiston edustaja. Tämä asia tarvitsee huomiota keskustelussa.");
    expect(r.flags.some((f) => f.code === "impersonation")).toBe(true);
  });

  it("never flags lawful political disagreement", () => {
    const r = checkMessage("Vastustan lakiehdotusta", "Olen eri mieltä tästä ehdotuksesta. Se olisi mielestäni haitallinen ja kallis. Pyydän, että eduskunta hylkää sen.");
    expect(r.ok).toBe(true);
    expect(r.flags).toEqual([]);
  });

  it("detects repeated identical bodies (one-recipient-overwhelm protection)", () => {
    const body = "Sama näkemys riittävässä pituudessa, jotta tarkistus menee läpi helposti.";
    expect(isIdenticalTo(body, body)).toBe(true);
    expect(isIdenticalTo(body, body + " x")).toBe(false);
    expect(contentHash("  a b  c ")).toBe(contentHash("a b c"));
  });

  it("cleanText rejects non-string input", () => {
    expect(cleanText(123, 10)).toBe("");
    expect(cleanText(undefined, 10)).toBe("");
  });
});