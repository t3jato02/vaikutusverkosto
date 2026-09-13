// GLEIF LEI index — curated Legal Entity Identifier records for the covered
// Finnish finance institutions and their documented parents.
//
// LEIs were resolved from the GLEIF database (api.gleif.org / search.gleif.org)
// in September 2026. GLEIF is SUPPORTING evidence: it maps legal identity,
// aliases, BIC and recorded parent-child consolidation — it never replaces the
// organisation's own governance pages as the source for roles or ownership.

import type { EntityType } from "@prisma/client";

export interface GleifRecord {
  /** GLEIF Legal Entity Identifier (20 chars). */
  lei: string;
  /** Registered legal name in GLEIF. */
  legalName: string;
  /** Documented alternative names / trading names. */
  aliases?: string[];
  /** SWIFT/BIC code when GLEIF or the entity's own footer states one. */
  bic?: string;
  /** ISO-3166 alpha-2 jurisdiction of the legal entity. */
  countryCode: string;
  entityType: EntityType;
  /** Direct parent's LEI (GLEIF-recorded relationship). */
  parentLei?: string;
  /** Public URL where the GLEIF record (or the relationship) is shown. */
  sourceUrl: string;
  /** Free-text operator note (e.g. GLEIF relationship exception). */
  note?: string;
}

export const GLEIF_INDEX: GleifRecord[] = [
  {
    lei: "7437003B5WFBOIEFY714",
    legalName: "OP Osuuskunta",
    aliases: ["OP Ryhmä", "OP Financial Group"],
    bic: "OKOYFIHH",
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/7437003B5WFBOIEFY714",
  },
  {
    lei: "529900ODI3047E2LIV03",
    legalName: "Nordea Bank Abp",
    aliases: ["Nordea Bank Oyj"],
    bic: "NDEAFIHH",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/529900ODI3047E2LIV03",
    note: "GLEIF ei tallenna emoyhtiösuhdetta (reporting exception); Nordea-konsernilla ei ole erillistä ruotsalaista GLEIF-tietuetta.",
  },
  {
    lei: "MAES062Z21O4RZ2U7M96",
    legalName: "Danske Bank A/S",
    countryCode: "DK",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/MAES062Z21O4RZ2U7M96",
    note: "Suomen toiminta siirtyi Danske Bank Oyj:stä emoyhtiön sivuliikkeeksi (GLEIF successor).",
  },
  {
    lei: "743700GC62JLHFBUND16",
    legalName: "Aktia Bank Abp",
    aliases: ["Aktia"],
    bic: "HELSFIHH",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700GC62JLHFBUND16",
  },
  {
    lei: "7437006WYM821IJ3MN73",
    legalName: "Ålandsbanken Abp",
    aliases: ["Bank of Åland"],
    bic: "AABAFI22",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/7437006WYM821IJ3MN73",
  },
  {
    lei: "743700LE1ECAPXC5UT18",
    legalName: "Oma Säästöpankki Oyj",
    aliases: ["OmaSp"],
    bic: "OMSAFI2S",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700LE1ECAPXC5UT18",
  },
  {
    lei: "743700FTBNXAUN57RH30",
    legalName: "S-Pankki Oyj",
    bic: "SBANFIHH",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700FTBNXAUN57RH30",
  },
  {
    lei: "549300TKX5J0BKJ3RZ21",
    legalName: "Keskinäinen Eläkevakuutusyhtiö Ilmarinen",
    aliases: ["Ilmarinen"],
    bic: "IMPIFIH1",
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/549300TKX5J0BKJ3RZ21",
  },
  {
    lei: "COX5BEJOY2G46TDYM587",
    legalName: "Keskinäinen työeläkevakuutusyhtiö Varma",
    aliases: ["Varma"],
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/COX5BEJOY2G46TDYM587",
  },
  {
    lei: "549300XTMGRU0YGNX539",
    legalName: "Keskinäinen Työeläkevakuutusyhtiö Elo",
    aliases: ["Elo"],
    bic: "EMPNFI2E",
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/549300XTMGRU0YGNX539",
  },
  {
    lei: "743700V68U1BNBFM7Z73",
    legalName: "Pensionsförsäkringsaktiebolaget Veritas",
    aliases: ["Veritas", "Keskinäinen Työeläkevakuutusyhtiö Veritas"],
    bic: "VEPFFI21",
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/743700V68U1BNBFM7Z73",
  },
  {
    lei: "PP1HQNTLFMXIFPD8YP43",
    legalName: "Keva",
    countryCode: "FI",
    entityType: "PENSION_INSTITUTION",
    sourceUrl: "https://search.gleif.org/legal-entity/PP1HQNTLFMXIFPD8YP43",
    note: "Julkisoikeudellinen eläkelaitos; GLEIF-luokka RESIDENT_GOVERNMENT_ENTITY.",
  },
  {
    lei: "549300LNEDPRE1XBGM50",
    legalName: "Valtion Eläkerahasto",
    aliases: ["VER"],
    countryCode: "FI",
    entityType: "PENSION_INSTITUTION",
    sourceUrl: "https://search.gleif.org/legal-entity/549300LNEDPRE1XBGM50",
  },
  {
    lei: "743700CYELIITVDWUZ26",
    legalName: "LähiTapiola Keskinäinen Vakuutusyhtiö",
    aliases: ["LähiTapiola"],
    countryCode: "FI",
    entityType: "ORGANIZATION",
    sourceUrl: "https://search.gleif.org/legal-entity/743700CYELIITVDWUZ26",
    note: "GLEIF ei tallenna LähiTapiola-ryhmän konsernisuhdetta (exception: NO_KNOWN_PERSON).",
  },
  {
    lei: "5493000HIT9G4VHYFR25",
    legalName: "If Skadeförsäkring AB (publ)",
    aliases: ["If Vahinkovakuutus", "If P&C Insurance"],
    countryCode: "SE",
    entityType: "COMPANY",
    parentLei: "54930050EIFH3WMNHK29",
    sourceUrl: "https://search.gleif.org/legal-entity/5493000HIT9G4VHYFR25",
    note: "If Vahinkovakuutusyhtiö Oy fuusioitui If Skadeförsäkring AB:hen 2017 (GLEIF successor).",
  },
  {
    lei: "54930050EIFH3WMNHK29",
    legalName: "If Skadeförsäkring Holding AB (publ)",
    countryCode: "SE",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/54930050EIFH3WMNHK29",
  },
  {
    lei: "743700OAJK6L28Y2NN56",
    legalName: "Mandatum Oyj",
    aliases: ["Mandatum", "Mandatum-konserni"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700OAJK6L28Y2NN56",
    note: "GLEIF ei tallenna Sampo Oyj:n emoyhtiösuhdetta (exception: NO_KNOWN_PERSON).",
  },
  {
    lei: "743700UF3RL386WIDA22",
    legalName: "Sampo Oyj",
    aliases: ["Sampo Group", "Sampo plc"],
    bic: "SAHOFIH1",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700UF3RL386WIDA22",
  },
  {
    lei: "74370020ZOTVC5EOAA37",
    legalName: "Euroclear Nordics Oy",
    aliases: ["Euroclear Finland Oy"],
    bic: "APKEFIHH",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/74370020ZOTVC5EOAA37",
    note: "Euroclear Finland Oy:n uusi nimi Euroclear Nordics Oy (1.5.2026).",
  },
  {
    lei: "743700NAXLL4Q86IEX32",
    legalName: "Nasdaq Helsinki Oy",
    aliases: ["Helsingin Pörssi", "OMXH"],
    countryCode: "FI",
    entityType: "COMPANY",
    parentLei: "549300L8X1Q78ERXFD06",
    sourceUrl: "https://search.gleif.org/legal-entity/743700NAXLL4Q86IEX32",
  },
  {
    lei: "549300L8X1Q78ERXFD06",
    legalName: "NASDAQ, INC.",
    countryCode: "US",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/549300L8X1Q78ERXFD06",
  },
  {
    lei: "743700BSM3ND4YE7GJ80",
    legalName: "Solidium Oy",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700BSM3ND4YE7GJ80",
  },
  {
    lei: "743700L3JBGJEWEDPV40",
    legalName: "Suomen Teollisuussijoitus Oy",
    aliases: ["Tesi", "Finnish Industry Investment"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700L3JBGJEWEDPV40",
  },
  {
    lei: "529900HEKOENJHPNN480",
    legalName: "Kuntarahoitus Oyj",
    aliases: ["MuniFin", "Municipality Finance Plc"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/529900HEKOENJHPNN480",
  },
  {
    lei: "743700T69OBBJO7TCA15",
    legalName: "Finnvera Oyj",
    aliases: ["Finnvera"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700T69OBBJO7TCA15",
  },
  {
    lei: "743700AVXTHX1NX6QZ08",
    legalName: "Business Finland Oy",
    aliases: ["Business Finland"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700AVXTHX1NX6QZ08",
  },
  {
    lei: "984500F4CCF3AD74F766",
    legalName: "Evli Oyj",
    aliases: ["Evli Plc"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/984500F4CCF3AD74F766",
  },
  {
    lei: "743700R4FA6AVH5J3D68",
    legalName: "eQ Oyj",
    aliases: ["eQ Plc"],
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700R4FA6AVH5J3D68",
  },
  {
    lei: "743700LSJBDD7TMLAD92",
    legalName: "Taaleri Oyj",
    aliases: ["Taaleri Plc"],
    bic: "TAALFIHH",
    countryCode: "FI",
    entityType: "COMPANY",
    sourceUrl: "https://search.gleif.org/legal-entity/743700LSJBDD7TMLAD92",
  },
];

export const GLEIF_BY_LEI = new Map(GLEIF_INDEX.map((r) => [r.lei, r]));

export const GLEIF_SOURCE_URL = "https://api.gleif.org/api/v1/lei-records";