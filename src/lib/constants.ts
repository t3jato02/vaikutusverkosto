import { EntityType, RelationshipType, FlowType, Confidence, ChangeEventType, FundingType, RoleType, Sector, CriticalFunction, ProcurementProcedure, OwnershipCalculationStatus } from "@prisma/client";

type Label = { fi: string; en: string; sv?: string };

export const FUNDING_TYPE_LABELS: Record<FundingType, Label> = {
  GRANT: { fi: "Avustus", en: "Grant" },
  DONATION: { fi: "Lahjoitus", en: "Donation" },
  INVESTMENT: { fi: "Sijoitus", en: "Investment" },
  PROCUREMENT: { fi: "Hankinta", en: "Procurement" },
  LOAN: { fi: "Laina", en: "Loan" },
  SPONSORSHIP: { fi: "Sponsorointi", en: "Sponsorship" },
  MEMBERSHIP_FEE: { fi: "Jäsenmaksu", en: "Membership fee" },
  OTHER: { fi: "Muu rahoitus", en: "Other funding" },
};

export function fundingTypeLabel(type: FundingType | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!type) return "";
  return FUNDING_TYPE_LABELS[type as FundingType]?.[lang] ?? String(type);
}

// Common ISO-3166 alpha-2 → Finnish country name. Fallback: the code itself.
const COUNTRY_FI: Record<string, string> = {
  FI: "Suomi", SE: "Ruotsi", NO: "Norja", DK: "Tanska", EE: "Viro", LV: "Latvia", LT: "Liettua",
  DE: "Saksa", FR: "Ranska", GB: "Britannia", NL: "Alankomaat", BE: "Belgia", LU: "Luxemburg",
  IE: "Irlanti", ES: "Espanja", PT: "Portugali", IT: "Italia", AT: "Itävalta", PL: "Puola",
  CZ: "Tšekki", SK: "Slovakia", HU: "Unkari", RO: "Romania", BG: "Bulgaria", GR: "Kreikka",
  HR: "Kroatia", SI: "Slovenia", CH: "Sveitsi", IS: "Islanti", US: "Yhdysvallat", CA: "Kanada",
  RU: "Venäjä", UA: "Ukraina", CN: "Kiina", JP: "Japani", EU: "Euroopan unioni",
};

export function countryLabel(code: string | null | undefined, lang: "fi" | "en" = "fi"): string {
  if (!code) return "";
  const c = code.toUpperCase();
  if (lang === "fi") return COUNTRY_FI[c] ?? c;
  return c;
}

export const ENTITY_TYPE_LABELS: Record<EntityType, Label> = {
  PERSON: { fi: "Henkilö", en: "Person" },
  ORGANIZATION: { fi: "Organisaatio", en: "Organization" },
  COMPANY: { fi: "Yritys", en: "Company" },
  GOVERNMENT_BODY: { fi: "Julkisyhteisö", en: "Government body" },
  POLITICAL_PARTY: { fi: "Puolue", en: "Political party" },
  ASSOCIATION: { fi: "Yhdistys", en: "Association" },
  FOUNDATION: { fi: "Säätiö", en: "Foundation" },
  UNION: { fi: "Ammattiliitto", en: "Trade union" },
  MEDIA_ORGANIZATION: { fi: "Media", en: "Media organization" },
  EDUCATIONAL_INSTITUTION: { fi: "Oppilaitos", en: "Educational institution" },
  COURT: { fi: "Tuomioistuin", en: "Court" },
  PUBLIC_AUTHORITY: { fi: "Viranomainen", en: "Public authority" },
  PENSION_INSTITUTION: { fi: "Eläkelaitos", en: "Pension institution" },
  PROJECT: { fi: "Hanke", en: "Project" },
  CAMPAIGN: { fi: "Kampanja", en: "Campaign" },
  ASSET: { fi: "Omaisuus", en: "Asset" },
  CONTRACT: { fi: "Sopimus", en: "Contract" },
  DECISION: { fi: "Päätös", en: "Decision" },
  EVENT: { fi: "Tapahtuma", en: "Event" },
  OTHER: { fi: "Muu", en: "Other" },
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, Label> = {
  OWNS: { fi: "omistaa", en: "owns" },
  BENEFICIAL_OWNER_OF: { fi: "tosiasiallinen omistaja", en: "beneficial owner of" },
  BOARD_MEMBER_OF: { fi: "hallituksen jäsen", en: "board member of" },
  CHAIRS: { fi: "puheenjohtaja", en: "chairs" },
  EMPLOYED_BY: { fi: "työsuhteessa", en: "employed by" },
  APPOINTED_BY: { fi: "nimittämä", en: "appointed by" },
  APPOINTED_TO: { fi: "nimitetty", en: "appointed to" },
  MEMBER_OF: { fi: "jäsen", en: "member of" },
  FORMER_MEMBER_OF: { fi: "entinen jäsen", en: "former member of" },
  ADVISER_TO: { fi: "neuvonantaja", en: "adviser to" },
  DONATED_TO: { fi: "lahjoittanut", en: "donated to" },
  FUNDED_BY: { fi: "rahoittama", en: "funded by" },
  FUNDS: { fi: "rahoittaa", en: "funds" },
  RECEIVED_GRANT_FROM: { fi: "saanut avustusta", en: "received grant from" },
  PAID: { fi: "maksanut", en: "paid" },
  CONTRACTED_WITH: { fi: "sopimussuhteessa", en: "contracted with" },
  SUPPLIER_TO: { fi: "toimittaja", en: "supplier to" },
  INVESTED_IN: { fi: "sijoittanut", en: "invested in" },
  SHAREHOLDER_OF: { fi: "osakkeenomistaja", en: "shareholder of" },
  REPRESENTS: { fi: "edustaa", en: "represents" },
  LOBBIED: { fi: "lobannut", en: "lobbied" },
  MET_WITH: { fi: "tavannut", en: "met with" },
  SUPPORTED: { fi: "tukenut", en: "supported" },
  PARTNERED_WITH: { fi: "kumppanuus", en: "partnered with" },
  VOTED_FOR: { fi: "äänesti puolesta", en: "voted for" },
  VOTED_AGAINST: { fi: "äänesti vastaan", en: "voted against" },
  ABSTAINED: { fi: "äänesti tyhjää", en: "abstained" },
  INTRODUCED: { fi: "jättänyt", en: "introduced" },
  SIGNED: { fi: "allekirjoittanut", en: "signed" },
  DECIDED: { fi: "päätti", en: "decided" },
  SUPERVISES: { fi: "valvoo", en: "supervises" },
  REGULATES: { fi: "sääntelee", en: "regulates" },
  AUDITS: { fi: "tilintarkastaa", en: "audits" },
  OWNS_MEDIA: { fi: "omistaa median", en: "owns media" },
  FAMILY_RELATION: { fi: "perhesuhde", en: "family relationship" },
  PART_OF: { fi: "kuuluu", en: "part of" },
  CANDIDATE_OF: { fi: "ehdokas", en: "candidate of" },
  SITS_IN: { fi: "istuu", en: "sits in" },
  EDUCATED_AT: { fi: "opiskellut", en: "educated at" },
  REGISTERED_LOBBY_ORGANIZATION: { fi: "rekisteröity avoimuusrekisteriin", en: "registered in the transparency register" },
  REPRESENTS_INTERESTS_OF: { fi: "edustaa tahon etuja", en: "represents interests of" },
  CLIENT_OF: { fi: "asiakassuhde", en: "client of" },
  DECLARED_EU_INTEREST: { fi: "ilmoitettu EU-etuyhteys", en: "declared EU interest" },
  ACCREDITED_REPRESENTATIVE_OF: { fi: "akkreditoitu edustaja", en: "accredited representative of" },
  WORKS_FOR: { fi: "työskentelee", en: "works for" },
  WORKED_FOR: { fi: "työskennellyt", en: "worked for" },
  PREVIOUSLY_WORKED_FOR: { fi: "työskennellyt aiemmin", en: "previously worked for" },
  EDITOR_OF: { fi: "toimitussihteeri", en: "editor of" },
  EDITOR_IN_CHIEF_OF: { fi: "päätoimittaja", en: "editor-in-chief of" },
  FOUNDED: { fi: "perustaja", en: "founded" },
  OWNED_BY: { fi: "omistuksessa", en: "owned by" },
  PARTIALLY_OWNS: { fi: "osittain omistaa", en: "partially owns" },
  PUBLISHES: { fi: "julkaisee", en: "publishes" },
  PART_OF_MEDIA_GROUP: { fi: "osa mediakonsernia", en: "part of media group" },
  SISTER_PUBLICATION_OF: { fi: "sisarjulkaisu", en: "sister publication of" },
  INTERVIEWED: { fi: "haastatteli", en: "interviewed" },
  CITED: { fi: "siteerannut", en: "cited" },
  CITED_AS_EXPERT: { fi: "siteerannut asiantuntijana", en: "cited as expert" },
  WROTE_ABOUT: { fi: "kirjoittanut", en: "wrote about" },
  PERSONAL_RELATIONSHIP: { fi: "henkilökohtainen suhde", en: "personal relationship" },
  POLITICAL_CANDIDATE_FOR: { fi: "ehdokkaana", en: "political candidate for" },
  WORKED_FOR_PARTY: { fi: "työskennellyt puolueelle", en: "worked for party" },
  POLITICAL_AIDE_TO: { fi: "poliittinen avustaja", en: "political aide to" },
  RECEIVED_FUNDING_FROM: { fi: "saanut rahoitusta", en: "received funding from" },
};

export const FLOW_TYPE_LABELS: Record<FlowType, Label> = {
  POLITICAL_DONATION: { fi: "Poliittinen lahjoitus", en: "Political donation" },
  CAMPAIGN_FUNDING: { fi: "Vaalirahoitus", en: "Campaign funding" },
  PUBLIC_GRANT: { fi: "Julkinen avustus", en: "Public grant" },
  GOVERNMENT_SUBSIDY: { fi: "Valtiontuki", en: "Government subsidy" },
  MUNICIPAL_GRANT: { fi: "Kunnallinen avustus", en: "Municipal grant" },
  EU_FUNDING: { fi: "EU-rahoitus", en: "EU funding" },
  PROCUREMENT: { fi: "Julkinen hankinta", en: "Procurement" },
  CONSULTING_PAYMENT: { fi: "Konsultointimaksu", en: "Consulting payment" },
  BOARD_REMUNERATION: { fi: "Hallituspalkkio", en: "Board remuneration" },
  SALARY: { fi: "Palkka", en: "Salary" },
  EXECUTIVE_COMPENSATION: { fi: "Johdon palkkio", en: "Executive compensation" },
  INVESTMENT: { fi: "Sijoitus", en: "Investment" },
  OWNERSHIP: { fi: "Omistus", en: "Ownership" },
  SPONSORSHIP: { fi: "Sponsorointi", en: "Sponsorship" },
  RESEARCH_FUNDING: { fi: "Tutkimusrahoitus", en: "Research funding" },
  FOUNDATION_GRANT: { fi: "Säätiöapuraha", en: "Foundation grant" },
  ASSOCIATION_FUNDING: { fi: "Yhdistysrahoitus", en: "Association funding" },
  PUBLIC_PROJECT_FUNDING: { fi: "Julkishankkeen rahoitus", en: "Public project funding" },
  OTHER: { fi: "Muu rahavirta", en: "Other financial flow" },
};

export const CONFIDENCE_LABELS: Record<Confidence, Label> = {
  VERIFIED: { fi: "Varmennettu", en: "Verified" },
  HIGH: { fi: "Korkea", en: "High" },
  MEDIUM: { fi: "Keskitaso", en: "Medium" },
  LOW: { fi: "Matala", en: "Low" },
  DISPUTED: { fi: "Riitautettu", en: "Disputed" },
};

// ---------------------------------------------------------------- institutional power (foundation)

export const ROLE_TYPE_LABELS: Record<RoleType, Label> = {
  MP: { fi: "Kansanedustaja", en: "Member of Parliament" },
  MINISTER: { fi: "Ministeri", en: "Minister" },
  MUNICIPAL_POLITICIAN: { fi: "Kuntapoliitikko", en: "Municipal politician" },
  CIVIL_SERVANT: { fi: "Virkamies", en: "Civil servant" },
  CEO: { fi: "Toimitusjohtaja", en: "CEO" },
  DEPUTY_CEO: { fi: "Varatoimitusjohtaja", en: "Deputy CEO" },
  EXECUTIVE: { fi: "Johtaja", en: "Executive" },
  BOARD_CHAIR: { fi: "Hallituksen puheenjohtaja", en: "Board chair" },
  BOARD_VICE_CHAIR: { fi: "Hallituksen varapuheenjohtaja", en: "Board vice chair" },
  BOARD_MEMBER: { fi: "Hallituksen jäsen", en: "Board member" },
  SUPERVISORY_BOARD: { fi: "Hallintoneuvoston jäsen", en: "Supervisory board member" },
  ADVISORY_BOARD: { fi: "Neuvottelukunnan jäsen", en: "Advisory board member" },
  COUNCIL_MEMBER: { fi: "Valtuuston jäsen", en: "Council member" },
  DIRECTOR_GENERAL: { fi: "Pääjohtaja", en: "Director General" },
  SECRETARY_GENERAL: { fi: "Pääsihteeri", en: "Secretary General" },
  CHAIR: { fi: "Puheenjohtaja", en: "Chair" },
  PRESIDENT: { fi: "Presidentti", en: "President" },
  TRUSTEE: { fi: "Luottamushenkilö", en: "Trustee" },
  REGULATOR: { fi: "Sääntelijä", en: "Regulator" },
  POLITICAL_APPOINTEE: { fi: "Poliittinen virkanimitys", en: "Political appointee" },
  OWNER_REPRESENTATIVE: { fi: "Omistajan edustaja", en: "Owner representative" },
  COMMITTEE_MEMBER: { fi: "Valiokunnan jäsen", en: "Committee member" },
  SECTOR_COUNCIL: { fi: "Toimialaneuvosto", en: "Sector council member" },
  ORGANISATION_LEADER: { fi: "Järjestön johtaja", en: "Organisation leader" },
  UNION_LEADER: { fi: "Ammattiliiton johtaja", en: "Union leader" },
  NGO_LEADER: { fi: "Järjestöjohtaja", en: "NGO leader" },
  FOUNDATION_EXECUTIVE: { fi: "Säätiön johtaja", en: "Foundation executive" },
  JOURNALIST: { fi: "Toimittaja", en: "Journalist" },
  MEDIA_EXECUTIVE: { fi: "Mediajohtaja", en: "Media executive" },
  ACADEMIC_EXECUTIVE: { fi: "Tiedejohtaja", en: "Academic executive" },
  PROFESSOR: { fi: "Professori", en: "Professor" },
  INVESTOR: { fi: "Sijoittaja", en: "Investor" },
  BANKER: { fi: "Pankkiiri", en: "Banker" },
  INVESTMENT_BANKER: { fi: "Investointipankkiiri", en: "Investment banker" },
  INSTITUTIONAL_INVESTOR_EXECUTIVE: { fi: "Instituutiosijoittajan johtaja", en: "Institutional investor executive" },
  PUBLIC_AGENCY_EXECUTIVE: { fi: "Viranomaisjohtaja", en: "Public agency executive" },
  INFRASTRUCTURE_EXECUTIVE: { fi: "Infrastruktuurijohtaja", en: "Infrastructure executive" },
  DEFENCE_INDUSTRY_EXECUTIVE: { fi: "Puolustusteollisuuden johtaja", en: "Defence industry executive" },
  LOBBYIST: { fi: "Edunvalvoja", en: "Lobbyist" },
  OTHER: { fi: "Muu tehtävä", en: "Other role" },
};

export const SECTOR_LABELS: Record<Sector, Label> = {
  ENERGY: { fi: "Energia", en: "Energy" },
  ELECTRICITY_TRANSMISSION: { fi: "Sähkönsiirto", en: "Electricity transmission" },
  ELECTRICITY_DISTRIBUTION: { fi: "Sähkönjakelu", en: "Electricity distribution" },
  DISTRICT_HEATING: { fi: "Kaukolämpö", en: "District heating" },
  GAS: { fi: "Kaasu", en: "Gas" },
  WATER: { fi: "Vesi", en: "Water" },
  WASTE: { fi: "Jätehuolto", en: "Waste" },
  FOOD: { fi: "Elintarvikkeet", en: "Food" },
  AGRICULTURE: { fi: "Maatalous", en: "Agriculture" },
  FOOD_LOGISTICS: { fi: "Elintarvikelogistiikka", en: "Food logistics" },
  BANKING: { fi: "Pankkitoiminta", en: "Banking" },
  INVESTMENT: { fi: "Sijoittaminen", en: "Investment" },
  INSURANCE: { fi: "Vakuutus", en: "Insurance" },
  PENSION: { fi: "Eläke", en: "Pension" },
  PAYMENTS: { fi: "Maksuliikenne", en: "Payments" },
  TRANSPORT: { fi: "Liikenne", en: "Transport" },
  RAIL: { fi: "Rautatiet", en: "Rail" },
  AVIATION: { fi: "Ilmailu", en: "Aviation" },
  ROAD_TRANSPORT: { fi: "Tieliikenne", en: "Road transport" },
  PUBLIC_TRANSIT: { fi: "Joukkoliikenne", en: "Public transit" },
  PORT: { fi: "Satama", en: "Port" },
  MARITIME: { fi: "Meriliikenne", en: "Maritime" },
  LOGISTICS: { fi: "Logistiikka", en: "Logistics" },
  TELECOM: { fi: "Televiestintä", en: "Telecom" },
  DATA_NETWORK: { fi: "Datuverkot", en: "Data networks" },
  CLOUD: { fi: "Pilvipalvelut", en: "Cloud" },
  CYBERSECURITY: { fi: "Kyberturvallisuus", en: "Cybersecurity" },
  TECHNOLOGY: { fi: "Teknologia", en: "Technology" },
  PUBLIC_IT: { fi: "Julkinen tietohallinto", en: "Public IT" },
  HEALTHCARE: { fi: "Terveydenhuolto", en: "Healthcare" },
  PHARMA: { fi: "Lääketeollisuus", en: "Pharma" },
  SOCIAL_SECURITY: { fi: "Sosiaaliturva", en: "Social security" },
  EMERGENCY_SUPPLY: { fi: "Huoltovarmuus", en: "Emergency supply" },
  AID_ORGANISATION: { fi: "Apu- ja kehitysjärjestö", en: "Aid organisation" },
  NGO: { fi: "Järjestö", en: "NGO" },
  FOUNDATION: { fi: "Säätiö", en: "Foundation" },
  EMPLOYER_ORGANISATION: { fi: "Työnantajajärjestö", en: "Employer organisation" },
  LABOUR_ORGANISATION: { fi: "Työmarkkinajärjestö", en: "Labour organisation" },
  MEDIA: { fi: "Media", en: "Media" },
  EDUCATION: { fi: "Koulutus", en: "Education" },
  RESEARCH: { fi: "Tutkimus", en: "Research" },
  DEFENCE: { fi: "Puolustus", en: "Defence" },
  SECURITY: { fi: "Turvallisuus", en: "Security" },
  STATE_OWNED: { fi: "Valtion omistama", en: "State-owned" },
  MUNICIPAL_OWNED: { fi: "Kunnan omistama", en: "Municipal-owned" },
  PUBLIC_AGENCY: { fi: "Julkinen viranomainen", en: "Public agency" },
  SPECIAL_ASSIGNMENT: { fi: "Erityistehtäväyhtiö", en: "Special-assignment company" },
  ALCOHOL_MONOPOLY: { fi: "Alkoholimonopoli", en: "Alcohol monopoly" },
  GAMBLING: { fi: "Rahapelit", en: "Gambling" },
  OTHER: { fi: "Muu toimiala", en: "Other sector" },
};

export const CRITICAL_FUNCTION_LABELS: Record<CriticalFunction, Label> = {
  NATIONAL_GRID: { fi: "Valtakunnan kantaverkko", en: "National grid" },
  LOCAL_GRID: { fi: "Paikallinen sähköverkko", en: "Local grid" },
  GAS_TRANSMISSION: { fi: "Kaasun siirtoverkko", en: "Gas transmission" },
  TELECOMMUNICATIONS: { fi: "Televiestintä", en: "Telecommunications" },
  PAYMENT_INFRASTRUCTURE: { fi: "Maksuinfrastruktuuri", en: "Payment infrastructure" },
  FOOD_DISTRIBUTION: { fi: "Elintarvikejakelu", en: "Food distribution" },
  RAIL_NETWORK: { fi: "Rautatieverkko", en: "Rail network" },
  AVIATION: { fi: "Ilmailu", en: "Aviation" },
  PORT_LOGISTICS: { fi: "Satamalogistiikka", en: "Port logistics" },
  WATER: { fi: "Vesihuolto", en: "Water" },
  HEALTHCARE_SUPPLY: { fi: "Terveydenhuollon huoltovarmuus", en: "Healthcare supply" },
  DEFENCE_SUPPLY: { fi: "Puolustushuolto", en: "Defence supply" },
  GOVERNMENT_IT: { fi: "Valtion tietohallinto", en: "Government IT" },
};

export const PROCUREMENT_PROCEDURE_LABELS: Record<ProcurementProcedure, Label> = {
  OPEN: { fi: "Avoin menettely", en: "Open procedure" },
  RESTRICTED: { fi: "Rajoitettu menettely", en: "Restricted procedure" },
  NEGOTIATED: { fi: "Neuvottelumenettely", en: "Negotiated procedure" },
  COMPETITIVE_DIALOGUE: { fi: "Kilpailullinen neuvottelumenettely", en: "Competitive dialogue" },
  INNOVATION_PARTNERSHIP: { fi: "Innovaatiokumppanuus", en: "Innovation partnership" },
  DIRECT_AWARD: { fi: "Suorahankinta", en: "Direct award" },
  FRAMEWORK_AGREEMENT: { fi: "Puitesopimus", en: "Framework agreement" },
  OTHER: { fi: "Muu menettely", en: "Other procedure" },
};

export const OWNERSHIP_CALCULATION_STATUS_LABELS: Record<OwnershipCalculationStatus, Label> = {
  REPORTED: { fi: "Lähteen ilmoittama", en: "Reported by source" },
  CALCULATED: { fi: "Laskennallinen", en: "Calculated" },
  UNKNOWN: { fi: "Tarkkuus ei tiedossa", en: "Precision unknown" },
};

export function roleTypeLabel(type: RoleType | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  return ROLE_TYPE_LABELS[type as RoleType]?.[lang] ?? String(type ?? "").toLowerCase();
}

export function sectorLabel(type: Sector | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  return SECTOR_LABELS[type as Sector]?.[lang] ?? String(type ?? "").toLowerCase();
}

export function criticalFunctionLabel(type: CriticalFunction | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  return CRITICAL_FUNCTION_LABELS[type as CriticalFunction]?.[lang] ?? String(type ?? "").toLowerCase();
}

export function procurementProcedureLabel(type: ProcurementProcedure | string | null | undefined, lang: "fi" | "en" = "fi"): string {
  return PROCUREMENT_PROCEDURE_LABELS[type as ProcurementProcedure]?.[lang] ?? String(type ?? "").toLowerCase();
}

export const CHANGE_EVENT_LABELS: Record<ChangeEventType, Label> = {
  RELATIONSHIP_ADDED: { fi: "Uusi yhteys", en: "New relationship" },
  RELATIONSHIP_ENDED: { fi: "Yhteys päättyi", en: "Relationship ended" },
  AMOUNT_CHANGED: { fi: "Summa muuttui", en: "Amount changed" },
  POSITION_CHANGED: { fi: "Tehtävä muuttui", en: "Position changed" },
  OWNER_CHANGED: { fi: "Omistaja muuttui", en: "Owner changed" },
  NEW_APPOINTMENT: { fi: "Uusi nimitys", en: "New appointment" },
  NEW_GRANT: { fi: "Uusi avustus", en: "New grant" },
  NEW_CONTRACT: { fi: "Uusi sopimus", en: "New contract" },
  NEW_VOTE: { fi: "Uusi äänestys", en: "New vote" },
  ENTITY_ADDED: { fi: "Uusi toimija", en: "New entity" },
  ENTITY_UPDATED: { fi: "Toimija päivittyi", en: "Entity updated" },
  SOURCE_ADDED: { fi: "Uusi lähde", en: "New source" },
  IDENTITY_MERGED: { fi: "Identiteetit yhdistetty", en: "Identities merged" },
};

// Descriptive tiers (section 8) — algorithmic, explainable, not moral judgments.
export const TIERS = [
  { id: 1, fi: "Valtakunnallinen järjestelmätason vaikutus", en: "National system-level influence" },
  { id: 2, fi: "Merkittävä institutionaalinen vaikutus", en: "Major institutional influence" },
  { id: 3, fi: "Alueellinen / sektorikohtainen vaikutus", en: "Regional / sector influence" },
  { id: 4, fi: "Paikallinen / erikoisalavaikutus", en: "Local / specialist influence" },
  { id: 5, fi: "Dokumentoitu verkoston jäsen", en: "Documented network participant" },
];

export const NODE_COLORS: Record<EntityType, string> = {
  PERSON: "#3b82c4",
  ORGANIZATION: "#7d8b96",
  COMPANY: "#1f6f6a",
  GOVERNMENT_BODY: "#5b5f7a",
  POLITICAL_PARTY: "#b0652f",
  ASSOCIATION: "#8a7a4d",
  FOUNDATION: "#6d5a8f",
  UNION: "#a33b3b",
  MEDIA_ORGANIZATION: "#2f7fa8",
  EDUCATIONAL_INSTITUTION: "#3f7a4e",
  COURT: "#54616b",
  PUBLIC_AUTHORITY: "#46505c",
  PENSION_INSTITUTION: "#0f5ea8",
  PROJECT: "#7c7c7c",
  CAMPAIGN: "#9c5a7c",
  ASSET: "#8a8a5c",
  CONTRACT: "#5c6a8a",
  DECISION: "#373d45",
  EVENT: "#4f4f4f",
  OTHER: "#777777",
};

export const RELATIONSHIP_COLORS: Partial<Record<RelationshipType, string>> = {
  OWNS: "#1f6f6a",
  SHAREHOLDER_OF: "#1f6f6a",
  BENEFICIAL_OWNER_OF: "#1f6f6a",
  OWNS_MEDIA: "#1f6f6a",
  BOARD_MEMBER_OF: "#3b82c4",
  CHAIRS: "#0f4c81",
  MEMBER_OF: "#3b82c4",
  EMPLOYED_BY: "#5b5f7a",
  APPOINTED_BY: "#5b5f7a",
  APPOINTED_TO: "#5b5f7a",
  DONATED_TO: "#b0652f",
  FUNDED_BY: "#b0652f",
  FUNDS: "#b0652f",
  RECEIVED_GRANT_FROM: "#b0652f",
  PAID: "#b0652f",
  CONTRACTED_WITH: "#7d8b96",
  SUPPLIER_TO: "#7d8b96",
  PARTNERED_WITH: "#7d8b96",
  LOBBIED: "#6d5a8f",
  MET_WITH: "#6d5a8f",
  // Journalism & media relations
  WORKS_FOR: "#2f7fa8",
  WORKED_FOR: "#2f7fa8",
  PREVIOUSLY_WORKED_FOR: "#2f7fa8",
  EDITOR_OF: "#2f7fa8",
  EDITOR_IN_CHIEF_OF: "#0f4c81",
  FOUNDED: "#1f6f6a",
  OWNED_BY: "#1f6f6a",
  PARTIALLY_OWNS: "#1f6f6a",
  PUBLISHES: "#7d8b96",
  PART_OF_MEDIA_GROUP: "#7d8b96",
  SISTER_PUBLICATION_OF: "#7d8b96",
  INTERVIEWED: "#8a7a4d",
  CITED: "#8a7a4d",
  CITED_AS_EXPERT: "#8a7a4d",
  WROTE_ABOUT: "#4dd0c2",
  PERSONAL_RELATIONSHIP: "#c2185b",
  POLITICAL_CANDIDATE_FOR: "#b0652f",
  WORKED_FOR_PARTY: "#b0652f",
  POLITICAL_AIDE_TO: "#b0652f",
  RECEIVED_FUNDING_FROM: "#b0652f",
};

export const FLOW_COLOR = "#b0652f";
export const DEMO_BADGE = { fi: "Demodata", en: "Demo data" };

export const ENTITY_URL_PREFIXES: Record<EntityType, string> = {
  PERSON: "/person",
  ORGANIZATION: "/organization",
  COMPANY: "/company",
  GOVERNMENT_BODY: "/institution",
  POLITICAL_PARTY: "/institution",
  ASSOCIATION: "/organization",
  FOUNDATION: "/organization",
  UNION: "/organization",
  MEDIA_ORGANIZATION: "/institution",
  EDUCATIONAL_INSTITUTION: "/institution",
  COURT: "/institution",
  PUBLIC_AUTHORITY: "/institution",
  PENSION_INSTITUTION: "/institution",
  PROJECT: "/institution",
  CAMPAIGN: "/organization",
  ASSET: "/organization",
  CONTRACT: "/institution",
  DECISION: "/decision",
  EVENT: "/institution",
  OTHER: "/organization",
};

export function entityUrlPrefix(type: EntityType): string {
  return ENTITY_URL_PREFIXES[type] ?? "/organization";
}

export function entityLabel(type: EntityType, lang: "fi" | "en" = "fi"): string {
  return ENTITY_TYPE_LABELS[type]?.[lang] ?? type;
}

export function relationshipLabel(type: RelationshipType, lang: "fi" | "en" = "fi"): string {
  return RELATIONSHIP_TYPE_LABELS[type]?.[lang] ?? type;
}

export function flowLabel(type: FlowType, lang: "fi" | "en" = "fi"): string {
  return FLOW_TYPE_LABELS[type]?.[lang] ?? type;
}