// Insurance — life and non-life insurers operating in Finland, plus the
// pension/life group Mandatum. Pension insurers live in `pension.ts`.
//
// Facts transcribed from official governance pages (September 2026).

import type { ManifestSection } from "./types";

export const insuranceSection: ManifestSection = {
  id: "insurance",
  url: "https://www.finanssivalvonta.fi/rekisterit/",
  title: "Vakuutusyhtiöt",
  orgs: [
    {
      id: "lahitapiola-keskinainen",
      name: "LähiTapiola Keskinäinen Vakuutusyhtiö",
      type: "ORGANIZATION",
      financeTypes: ["NON_LIFE_INSURANCE_COMPANY"],
      entityCategory: "OTHER",
      aliases: ["LähiTapiola", "LähiTapiola-ryhmä"],
      officialUrl: "https://www.lahitapiola.fi",
      lei: "743700CYELIITVDWUZ26",
      supervisedByFinFsa: true,
      sectors: ["INSURANCE", "PENSION", "INVESTMENT"],
      evidenceUrl: "https://www.lahitapiola.fi/tietoa-lahitapiolasta/lahitapiola-ryhma/yhtiot/lahitapiola-vahinkoyhtio/",
      sourceName: "LähiTapiola (lahitapiola.fi)",
      evidenceGrade: "A",
    },
    {
      id: "if-vahinkovakuutus",
      name: "If Vahinkovakuutus Oyj",
      type: "COMPANY",
      financeTypes: ["NON_LIFE_INSURANCE_COMPANY"],
      entityCategory: "COMPANY",
      aliases: ["If", "If Skadeförsäkring"],
      description: "If P&C Insurance -konsernin Suomen toiminta (Sampo-konserni)",
      officialUrl: "https://www.if.fi",
      lei: "5493000HIT9G4VHYFR25",
      supervisedByFinFsa: true,
      parent: { name: "If Skadeförsäkring Holding AB (publ)", lei: "54930050EIFH3WMNHK29", type: "COMPANY", countryCode: "SE", sourceUrl: "https://www.sampo.com/governance/management/" },
      sectors: ["INSURANCE", "INVESTMENT"],
      evidenceUrl: "https://www.if.fi/tietoa-ifista/tietoa-meista/johto",
      sourceName: "If (if.fi)",
      evidenceGrade: "A",
    },
    {
      id: "fennia",
      name: "Keskinäinen Vakuutusyhtiö Fennia",
      type: "ORGANIZATION",
      financeTypes: ["NON_LIFE_INSURANCE_COMPANY"],
      entityCategory: "OTHER",
      aliases: ["Fennia"],
      officialUrl: "https://www.fennia.fi",
      supervisedByFinFsa: true,
      sectors: ["INSURANCE"],
      evidenceUrl: "https://www.fennia.fi/tietoa-fenniasta/fennian-johto",
      sourceName: "Fennia (fennia.fi)",
      evidenceGrade: "A",
    },
    {
      id: "mandatum",
      name: "Mandatum Oyj",
      type: "COMPANY",
      financeTypes: ["LIFE_INSURANCE_COMPANY", "ASSET_MANAGER"],
      entityCategory: "COMPANY",
      aliases: ["Mandatum-konserni", "Mandatum Life"],
      officialUrl: "https://www.mandatum.fi",
      lei: "743700OAJK6L28Y2NN56",
      supervisedByFinFsa: true,
      sectors: ["INSURANCE", "INVESTMENT"],
      scaleStatements: [
        { metric: "ASSETS_UNDER_MANAGEMENT", value: 15300000000, currency: "EUR", year: 2025, note: "Konsernin asiakasvarat (31.12.2025)", sourceUrl: "https://www.mandatum.fi/en/group/about-the-company/mandatum-in-brief/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
      ],
      evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/hallitus/",
      sourceName: "Mandatum (mandatum.fi)",
      evidenceGrade: "A",
    },
  ],
  roles: [
    // LähiTapiola
    { person: "Sari Heinonen", org: "lahitapiola-keskinainen", role: "Pääjohtaja", roleType: "CEO", current: true, evidenceUrl: "https://www.lahitapiola.fi/tietoa-lahitapiolasta/lahitapiola-ryhma/yhtiot/lahitapiola-vahinkoyhtio/", sourceName: "LähiTapiola (lahitapiola.fi)", evidenceGrade: "A" },
    { person: "Antti Pulkkanen", org: "lahitapiola-keskinainen", role: "Toimitusjohtaja (LähiTapiola Keskinäinen Vakuutusyhtiö)", roleType: "CEO", current: true, evidenceUrl: "https://www.lahitapiola.fi/tietoa-lahitapiolasta/lahitapiola-ryhma/yhtiot/lahitapiola-vahinkoyhtio/", sourceName: "LähiTapiola (lahitapiola.fi)", evidenceGrade: "A" },
    { person: "Eeva Ahdekivi", org: "lahitapiola-keskinainen", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.lahitapiola.fi/tietoa-lahitapiolasta/lahitapiola-ryhma/yhtiot/lahitapiola-vahinkoyhtio/", sourceName: "LähiTapiola (lahitapiola.fi)", evidenceGrade: "A" },
    { person: "Birgitta Forsström", org: "lahitapiola-keskinainen", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.lahitapiola.fi/tietoa-lahitapiolasta/lahitapiola-ryhma/yhtiot/lahitapiola-vahinkoyhtio/", sourceName: "LähiTapiola (lahitapiola.fi)", evidenceGrade: "A" },
    // If
    { person: "Morten Thorsrud", org: "if-vahinkovakuutus", role: "Konsernin toimitusjohtaja (Sampo Group)", roleType: "CEO", current: true, evidenceUrl: "https://www.if.fi/tietoa-ifista/tietoa-meista/johto", sourceName: "If (if.fi)", evidenceGrade: "A" },
    { person: "Anders Nilsson", org: "if-vahinkovakuutus", role: "Sijoitusjohtaja (CIO)", roleType: "INSTITUTIONAL_INVESTOR_EXECUTIVE", current: true, evidenceUrl: "https://www.if.fi/tietoa-ifista/tietoa-meista/johto", sourceName: "If (if.fi)", evidenceGrade: "A" },
    // Fennia
    { person: "Hanna Hartikainen", org: "fennia", role: "Toimitusjohtaja", roleType: "CEO", current: true, evidenceUrl: "https://www.fennia.fi/tietoa-fenniasta/fennian-johto", sourceName: "Fennia (fennia.fi)", evidenceGrade: "A" },
    { person: "Risto Tornivaara", org: "fennia", role: "Hallituksen puheenjohtaja", roleType: "BOARD_CHAIR", current: true, evidenceUrl: "https://www.fennia.fi/tietoa-fenniasta/fennian-johto", sourceName: "Fennia (fennia.fi)", evidenceGrade: "A" },
    { person: "Anna-Riikka Hovi-Taunila", org: "fennia", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.fennia.fi/tietoa-fenniasta/fennian-johto", sourceName: "Fennia (fennia.fi)", evidenceGrade: "A" },
    { person: "Rolf Jansson", org: "fennia", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.fennia.fi/tietoa-fenniasta/fennian-johto", sourceName: "Fennia (fennia.fi)", evidenceGrade: "A" },
    // Mandatum
    { person: "Petri Niemisvirta", org: "mandatum", role: "Konsernin toimitusjohtaja", roleType: "CEO", current: true, evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/yhtion-johto/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
    { person: "Patrick Lapveteläinen", org: "mandatum", role: "Hallituksen puheenjohtaja", roleType: "BOARD_CHAIR", current: true, evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/hallitus/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
    { person: "Juhani Lehtonen", org: "mandatum", role: "Sijoitusjohtaja", roleType: "INSTITUTIONAL_INVESTOR_EXECUTIVE", current: true, evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/yhtion-johto/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
    { person: "Jannica Fagerholm", org: "mandatum", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/hallitus/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
    { person: "Markus Aho", org: "mandatum", role: "Hallituksen jäsen", roleType: "BOARD_MEMBER", current: true, evidenceUrl: "https://www.mandatum.fi/konserni/hallinnointi/hallitus/", sourceName: "Mandatum (mandatum.fi)", evidenceGrade: "A" },
  ],
};