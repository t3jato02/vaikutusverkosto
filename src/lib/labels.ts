// Public-facing text for every enum the UI can show. The public UI must NEVER
// render a raw enum value (EDUCATED_AT, SOURCE_CONFIRMED, CURRENT, …). Admin
// views may show the raw value as a secondary detail.
//
// constants.ts holds the raw label maps; this module adds the richer,
// human-oriented helpers: direction-aware relationship phrasing, verification
// status with tone + description, temporal state, source tiers, and
// change-event sentences.

import type {
  RelationshipType,
  VerificationStatus,
  TemporalState,
  ChangeEventType,
  Confidence,
} from "@prisma/client";
import { RELATIONSHIP_TYPE_LABELS } from "@/lib/constants";

export type Locale = "fi" | "en";

// ---------------------------------------------------------------- verification

export type VerificationTone = "confirmed" | "review" | "disputed" | "stale" | "rejected";

interface VerificationLabel {
  /** Short label for a badge / inline chip. */
  label: string;
  tone: VerificationTone;
  /** One sentence a non-expert can understand. */
  description: string;
}

const VERIFICATION_FI: Record<VerificationStatus, VerificationLabel> = {
  SOURCE_CONFIRMED: {
    label: "Vahvistettu lähteestä",
    tone: "confirmed",
    description: "Alkuperäinen tai riittävän vahva julkinen lähde tukee tätä tietoa.",
  },
  HUMAN_VERIFIED: {
    label: "Ihmisen tarkistama",
    tone: "confirmed",
    description: "Tarkastaja on lukenut lähteen ja hyväksynyt yhteyden.",
  },
  AUTO_DETECTED: {
    label: "Automaattisesti havaittu",
    tone: "review",
    description: "Ohjelma havaitsi yhteyden, mutta lähdettä ei ole vielä vahvistettu.",
  },
  DISPUTED: {
    label: "Kiistanalainen",
    tone: "disputed",
    description: "Yhteydestä on uskottava ristiriita tai avoin korjauspyyntö.",
  },
  STALE: {
    label: "Vanhentunut",
    tone: "stale",
    description: "Tieto oli aiemmin pätevä; nykytila on todennäköisesti muuttunut.",
  },
  REJECTED: {
    label: "Hylätty",
    tone: "rejected",
    description: "Automaattinen havainto todettiin virheelliseksi.",
  },
};

const VERIFICATION_EN: Record<VerificationStatus, VerificationLabel> = {
  SOURCE_CONFIRMED: { label: "Confirmed by source", tone: "confirmed", description: "A primary or sufficiently strong public source supports this." },
  HUMAN_VERIFIED: { label: "Human-checked", tone: "confirmed", description: "A reviewer read the source and accepted the connection." },
  AUTO_DETECTED: { label: "Automatically detected", tone: "review", description: "Detected by software; the source is not yet confirmed." },
  DISPUTED: { label: "Disputed", tone: "disputed", description: "A credible conflict or open correction request exists." },
  STALE: { label: "Outdated", tone: "stale", description: "Was valid; the current state has most likely changed." },
  REJECTED: { label: "Rejected", tone: "rejected", description: "An automated detection was found to be wrong." },
};

export function verificationLabel(status: VerificationStatus, locale: Locale = "fi"): VerificationLabel {
  return (locale === "en" ? VERIFICATION_EN : VERIFICATION_FI)[status] ?? VERIFICATION_FI.AUTO_DETECTED;
}

// ---------------------------------------------------------------- temporal

const TEMPORAL_FI: Record<TemporalState, string> = {
  CURRENT: "Nykyinen",
  HISTORICAL: "Historiallinen",
  UNKNOWN_PERIOD: "Ajankohta epävarma",
};
const TEMPORAL_EN: Record<TemporalState, string> = {
  CURRENT: "Current",
  HISTORICAL: "Historical",
  UNKNOWN_PERIOD: "Period uncertain",
};

export function temporalLabel(state: TemporalState, locale: Locale = "fi"): string {
  return (locale === "en" ? TEMPORAL_EN : TEMPORAL_FI)[state] ?? TEMPORAL_FI.UNKNOWN_PERIOD;
}

// ---------------------------------------------------------------- relationships

/** Which side of the edge the reader is standing on. "out" = the subject is the
 *  relationship's source entity; "in" = the subject is its target. */
export type RelDirection = "out" | "in";

interface DirectionalPhrase {
  out: string;
  in: string;
}

// Direction matters: "A rahoittaa B" must not read the same from both ends.
// Where a single word is correct for both sides it is repeated intentionally.
const REL_PHRASE_FI: Partial<Record<RelationshipType, DirectionalPhrase>> = {
  OWNS: { out: "Omistaa", in: "Omistaja" },
  SHAREHOLDER_OF: { out: "Osakkeenomistaja", in: "Osakkeenomistaja" },
  BENEFICIAL_OWNER_OF: { out: "Tosiasiallinen omistaja", in: "Tosiasiallinen omistaja" },
  OWNS_MEDIA: { out: "Omistaa median", in: "Median omistaja" },
  BOARD_MEMBER_OF: { out: "Hallituksen jäsen", in: "Hallituksen jäsen" },
  CHAIRS: { out: "Puheenjohtaja", in: "Puheenjohtaja" },
  EMPLOYED_BY: { out: "Työsuhteessa", in: "Työnantaja" },
  APPOINTED_BY: { out: "Nimitetty", in: "Nimittäjä" },
  APPOINTED_TO: { out: "Nimitetty tehtävään", in: "Nimitetty tehtävään" },
  MEMBER_OF: { out: "Jäsen", in: "Jäsen" },
  FORMER_MEMBER_OF: { out: "Entinen jäsen", in: "Entinen jäsen" },
  ADVISER_TO: { out: "Neuvonantaja", in: "Neuvonantaja" },
  DONATED_TO: { out: "Lahjoittaja", in: "Lahjoituksen saaja" },
  FUNDED_BY: { out: "Rahoituksen saaja", in: "Rahoittaja" },
  FUNDS: { out: "Rahoittaja", in: "Rahoituksen saaja" },
  RECEIVED_GRANT_FROM: { out: "Avustuksen saaja", in: "Avustuksen myöntäjä" },
  PAID: { out: "Maksaja", in: "Maksun saaja" },
  CONTRACTED_WITH: { out: "Sopimuskumppani", in: "Sopimuskumppani" },
  SUPPLIER_TO: { out: "Toimittaja", in: "Tilaaja" },
  INVESTED_IN: { out: "Sijoittaja", in: "Sijoituksen kohde" },
  REPRESENTS: { out: "Edustaa", in: "Edustettu" },
  LOBBIED: { out: "Vaikuttanut", in: "Vaikuttamisen kohde" },
  MET_WITH: { out: "Tavannut", in: "Tavannut" },
  SUPPORTED: { out: "Tukenut", in: "Saanut tukea" },
  PARTNERED_WITH: { out: "Kumppani", in: "Kumppani" },
  VOTED_FOR: { out: "Äänesti puolesta", in: "Sai puoltoäänen" },
  VOTED_AGAINST: { out: "Äänesti vastaan", in: "Sai vastaäänen" },
  ABSTAINED: { out: "Äänesti tyhjää", in: "Äänesti tyhjää" },
  INTRODUCED: { out: "Jättänyt aloitteen", in: "Aloitteen tekijä" },
  SIGNED: { out: "Allekirjoittanut", in: "Allekirjoittanut" },
  DECIDED: { out: "Päätti", in: "Päätöksen tekijä" },
  SUPERVISES: { out: "Valvoo", in: "Valvonnan kohde" },
  REGULATES: { out: "Sääntelee", in: "Sääntelyn kohde" },
  AUDITS: { out: "Tilintarkastaa", in: "Tilintarkastuksen kohde" },
  FAMILY_RELATION: { out: "Perhesuhde", in: "Perhesuhde" },
  PART_OF: { out: "Kuuluu", in: "Sisältää" },
  CANDIDATE_OF: { out: "Ehdokas", in: "Ehdokas" },
  SITS_IN: { out: "Istuu", in: "Kokoonpanossa" },
  EDUCATED_AT: { out: "Opiskellut", in: "Opiskellut täällä" },
  REGISTERED_LOBBY_ORGANIZATION: { out: "Rekisteröity edunvalvoja", in: "Rekisteröity edunvalvoja" },
  REPRESENTS_INTERESTS_OF: { out: "Edustaa etuja", in: "Edunvalvonnan kohde" },
  CLIENT_OF: { out: "Asiakas", in: "Palveluntarjoaja" },
  DECLARED_EU_INTEREST: { out: "Ilmoittanut EU-intressin", in: "EU-intressin kohde" },
  ACCREDITED_REPRESENTATIVE_OF: { out: "Akkreditoitu edustaja", in: "Edustettu" },
};

/**
 * Human phrase for a relationship, honoring direction. Never returns a raw enum:
 * unknown types fall back to the constants.ts label, then to a readable
 * lowercase form.
 */
export function relationshipPhrase(
  type: RelationshipType,
  direction: RelDirection = "out",
  locale: Locale = "fi",
): string {
  const p = REL_PHRASE_FI[type];
  if (p) return p[direction];
  const fallback = RELATIONSHIP_TYPE_LABELS[type]?.[locale];
  if (fallback) return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  return String(type)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------- confidence

const CONFIDENCE_FI: Record<Confidence, string> = {
  VERIFIED: "Varmennettu",
  HIGH: "Korkea varmuus",
  MEDIUM: "Kohtalainen varmuus",
  LOW: "Matala varmuus",
  DISPUTED: "Kiistanalainen",
};

export function confidenceLabel(c: Confidence, locale: Locale = "fi"): string {
  void locale;
  return CONFIDENCE_FI[c] ?? CONFIDENCE_FI.MEDIUM;
}

// ---------------------------------------------------------------- change events

/**
 * A short, human sentence for a change-feed row. Built from structured fields
 * so the stored `description` (which historically embedded raw enums, e.g.
 * "Uusi yhteys: EDUCATED_AT") is never shown.
 */
export function changeEventSentence(input: {
  eventType: ChangeEventType;
  entityName?: string | null;
  counterpartName?: string | null;
  relationshipType?: RelationshipType | null;
  amountText?: string | null;
}): string {
  const { eventType, entityName, counterpartName, relationshipType, amountText } = input;
  const rel = relationshipType
    ? relationshipPhrase(relationshipType, "out").toLowerCase()
    : "yhteys";
  const subject = entityName ?? "Tuntematon toimija";
  const other = counterpartName;

  switch (eventType) {
    case "RELATIONSHIP_ADDED":
      return other
        ? `Uusi yhteys kohteeseen ${other} (${rel})`
        : `Uusi ${rel}`;
    case "RELATIONSHIP_ENDED":
      return other
        ? `Päättynyt yhteys kohteeseen ${other} (${rel})`
        : `${rel} päättyi`;
    case "NEW_APPOINTMENT":
      return other ? `Nimitettiin: ${other}` : "Uusi nimitys";
    case "POSITION_CHANGED":
      return "Tehtävä muuttui";
    case "AMOUNT_CHANGED":
      return amountText ? `Rahasumma päivittyi (${amountText})` : "Rahasumma päivittyi";
    case "OWNER_CHANGED":
      return "Omistaja muuttui";
    case "NEW_GRANT": {
      const from = other ? ` — ${other}` : "";
      return amountText ? `Uusi rahoitus ${amountText}${from}` : `Uusi rahoitus${from}`;
    }
    case "NEW_CONTRACT":
      return other ? `Uusi sopimus: ${other}` : "Uusi sopimus";
    case "NEW_VOTE":
      return "Uusi äänestys kirjattu";
    case "ENTITY_ADDED":
      return `${subject} lisättiin verkostoon`;
    case "ENTITY_UPDATED":
      return "Tiedot päivittyivät";
    case "SOURCE_ADDED":
      return "Uusi lähde lisätty";
    case "IDENTITY_MERGED":
      return "Päällekkäiset tiedot yhdistettiin";
    default:
      return subject;
  }
}

/** Sentence for a group of same-run, same-entity, same-type changes. */
export function changeEventGroupSentence(input: {
  eventType: ChangeEventType;
  entityName?: string | null;
  count: number;
}): string {
  const subject = input.entityName ?? "Tuntematon toimija";
  const n = input.count;
  switch (input.eventType) {
    case "RELATIONSHIP_ADDED":
      return `${subject} — ${n} uutta yhteyttä`;
    case "RELATIONSHIP_ENDED":
      return `${subject} — ${n} päättynyttä yhteyttä`;
    case "NEW_APPOINTMENT":
      return `${subject} — ${n} uutta nimitystä`;
    case "NEW_GRANT":
      return `${subject} — ${n} uutta avustusta`;
    case "NEW_VOTE":
      return `${subject} — ${n} uutta äänestystä`;
    case "SOURCE_ADDED":
      return `${subject} — ${n} uutta lähdettä`;
    default:
      return `${subject} — ${n} muutosta`;
  }
}
