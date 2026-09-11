import type { Confidence, RelationshipType, RoleType } from "@prisma/client";
import { ROLE_TYPE_LABELS } from "@/lib/constants";

// Transparent, explainable analytics (sections 7 and 8).
// Every metric returns { value, methodology, inputs } so it can be linked
// from the methodology page. Never a single opaque "power score".

export interface MetricResult {
  name: string;
  value: number;
  methodologyVersion: string;
  inputs: Record<string, number | string | string[]>;
  interpretation: string;
}

const CONFIDENCE_WEIGHTS: Record<Confidence, number> = {
  VERIFIED: 1.0,
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.4,
  DISPUTED: 0.2,
};

// ---------------------------------------------------------------- inputs

export interface RelationshipInput {
  type: RelationshipType;
  confidence: Confidence;
  startDate: Date | null;
  endDate: Date | null;
  amount: { value: number | null; flowType?: string } | null;
}

export interface PersonMetricInput {
  positions: { role: string; isCurrent: boolean; orgType?: string }[];
  relationships: RelationshipInput[];
  incomingFlows: { amount: number; confidence: Confidence; flowType: string }[];
  outgoingFlows: { amount: number; confidence: Confidence; flowType: string }[];
  sources: number;
}

// ---------------------------------------------------------------- metrics

/** Institutional power — documented formal positions, weighted by currentness. */
export function institutionalPower(input: PersonMetricInput): MetricResult {
  const current = input.positions.filter((p) => p.isCurrent);
  const value = current.length + 0.5 * (input.positions.length - current.length);
  return {
    name: "institutional_power",
    value: round(value),
    methodologyVersion: "1.0",
    inputs: {
      currentPositions: current.length,
      allPositions: input.positions.length,
      weightCurrent: 1,
      weightFormer: 0.5,
    },
    interpretation:
      "Perustuu dokumentoituihin virallisiin tehtäviin. Nykyiset tehtävät painavat 1, entiset 0,5. Ei arvostelma vallan käytöstä.",
  };
}

/** Network centrality — degree centrality on documented relationships. */
export function networkCentrality(
  relationships: RelationshipInput[],
  totalNodesInNetwork: number,
): MetricResult {
  const degree = relationships.length;
  const normalized = totalNodesInNetwork > 1 ? degree / (totalNodesInNetwork - 1) : 0;
  return {
    name: "network_centrality",
    value: round(normalized),
    methodologyVersion: "1.0",
    inputs: {
      degree,
      totalNodesInNetwork,
    },
    interpretation:
      "Aste-keskeisyys dokumentoitujen yhteyksien lukumääränä suhteutettuna verkon kokoon. Kuvaa verkostoasemaa, ei toimintaa.",
  };
}

/** Board reach — number of documented board memberships (current). */
export function boardReach(input: PersonMetricInput): MetricResult {
  const boards = input.relationships.filter(
    (r) => r.type === "BOARD_MEMBER_OF" || r.type === "CHAIRS",
  ).length;
  return {
    name: "board_reach",
    value: boards,
    methodologyVersion: "1.0",
    inputs: { boardMemberships: boards },
    interpretation: "Dokumentoitujen hallitusjäsenyyksien lukumäärä.",
  };
}

/** Appointment reach — positions obtained through documented appointments. */
export function appointmentReach(input: PersonMetricInput): MetricResult {
  const appt = input.relationships.filter(
    (r) => r.type === "APPOINTED_TO" || r.type === "APPOINTED_BY",
  ).length;
  return {
    name: "appointment_reach",
    value: appt,
    methodologyVersion: "1.0",
    inputs: { appointments: appt },
    interpretation: "Dokumentoitujen nimitysten kautta syntyneiden tehtävien lukumäärä.",
  };
}

/** Financial network — documented flows (incoming + outgoing), confidence-weighted. */
export function financialNetwork(input: PersonMetricInput): MetricResult {
  const inSum = input.incomingFlows.reduce(
    (s, f) => s + (f.amount || 0) * CONFIDENCE_WEIGHTS[f.confidence],
    0,
  );
  const outSum = input.outgoingFlows.reduce(
    (s, f) => s + (f.amount || 0) * CONFIDENCE_WEIGHTS[f.confidence],
    0,
  );
  return {
    name: "financial_network",
    value: round(inSum + outSum),
    methodologyVersion: "1.0",
    inputs: {
      incomingFlowCount: input.incomingFlows.length,
      outgoingFlowCount: input.outgoingFlows.length,
      totalAmount: round(inSum + outSum),
    },
    interpretation:
      "Dokumentoitujen rahavirtojen summa luottamuspainotettuna. Kuvaa rahoitusvirtoja, ei rikkomusta.",
  };
}

/** Data confidence — quality and quantity of evidence (0..1). */
export function dataConfidence(input: PersonMetricInput): MetricResult {
  if (input.sources === 0) {
    return {
      name: "data_confidence",
      value: 0,
      methodologyVersion: "1.0",
      inputs: { sources: 0 },
      interpretation: "Ei vielä riippumattomia lähteitä.",
    };
  }
  const avgConf =
    input.relationships.reduce((s, r) => s + CONFIDENCE_WEIGHTS[r.confidence], 0) /
    Math.max(input.relationships.length, 1);
  const sourceScore = Math.min(input.sources / 5, 1);
  const value = 0.6 * avgConf + 0.4 * sourceScore;
  return {
    name: "data_confidence",
    value: round(value),
    methodologyVersion: "1.0",
    inputs: {
      sources: input.sources,
      averageRelationshipConfidence: round(avgConf),
      sourceCoverageFactor: round(sourceScore, 3),
    },
    interpretation: "Yhdistelmä suhteiden luottamuksesta ja lähteiden määrästä (0–1).",
  };
}

// ---------------------------------------------------------------- tier

export interface TierInput {
  positions: PersonMetricInput["positions"];
  relationships: PersonMetricInput["relationships"];
  municipal: boolean;
  national: boolean;
}

/** Descriptive tier based on structural reach (section 8). Explainable, not a moral judgment. */
export function computeTier(input: TierInput): number {
  let score = 0;
  for (const r of input.relationships) {
    if (
      (r.type === "MEMBER_OF" || r.type === "BOARD_MEMBER_OF" || r.type === "CHAIRS" || r.type === "SITS_IN") &&
      r.confidence !== "LOW"
    ) {
      score += 1;
    }
    if (r.type === "CHAIRS") score += 1;
  }
  if (input.national) score += 2;
  if (input.municipal) score += 1;

  if (score >= 8) return 1;
  if (score >= 5) return 2;
  if (score >= 3) return 3;
  if (score >= 1) return 4;
  return 5;
}

// ---------------------------------------------------------------- institutional influence (foundation, section 7)
//
// An EXPLAINABLE "institutional influence" score (0-100). Structural only: role
// authority, organisation scale, public-resource control, appointment
// authority, ownership/control, board centrality and cross-sector reach. It is
// NOT a political-ideology score, and it never implies wrongdoing. Every point
// is decomposable into `components` (each with a human-readable basis), so the
// UI can render exactly:
//
//   Institutionaalinen vaikutus 73/100
//     – Toimitusjohtaja, valtakunnallinen infrastruktuurityönantaja: +24
//     – Hallituksen puheenjohtaja, merkittävä yritys: +20
//     – Kaksi lisähallituspaikkaa: +6
//     – Valtion kriittistä infrastruktuuria hallinnoiva organisaatio: +5
//
// When evidence coverage is insufficient the score is NOT shown; the UI must
// display "Ei riittävästi dataa pisteytykseen." (coverageNote).

export interface InfluenceRole {
  roleType: RoleType | null;
  isCurrent: boolean;
  organizationName?: string | null;
  organizationSectors?: string[] | null;
  organizationIsPublic?: boolean | null;
  organizationEmployeeCount?: number | null;
  organizationRevenueEur?: number | null;
}

export interface InfluenceOwnershipStake {
  percentage: number | null;
  isIndirect: boolean;
  calculationStatus?: "REPORTED" | "CALCULATED" | "UNKNOWN" | null;
}

export interface InfluenceInput {
  roles: InfluenceRole[];
  ownershipStakes?: InfluenceOwnershipStake[];
  /** Positions where this person is the documented appointing body. */
  appointmentAuthorityCount?: number;
  /** Number of distinct documented evidence sources behind this person. */
  evidenceSources: number;
}

export interface InfluenceComponent {
  key: string;
  /** Human decomposition line (fi), e.g. "Toimitusjohtaja, yritys X". */
  label: string;
  points: number;
  /** Why these points were awarded (fi), shown alongside the score. */
  basis: string;
}

export interface InfluenceMetricResult {
  name: "institutional_influence";
  value: number | null; // null when coverage is insufficient
  coverageSufficient: boolean;
  coverageNote: string;
  methodologyVersion: string;
  components: InfluenceComponent[];
  interpretation: string;
}

// Role authority weights — documented-role based, capped so no single role
// dominates. Weights are structural, not moral.
const ROLE_AUTHORITY_POINTS: Partial<Record<RoleType, number>> = {
  MINISTER: 30,
  PRESIDENT: 28,
  CEO: 24,
  DIRECTOR_GENERAL: 22,
  BOARD_CHAIR: 20,
  REGULATOR: 18,
  MP: 18,
  SECRETARY_GENERAL: 16,
  DEPUTY_CEO: 14,
  UNION_LEADER: 14,
  CHAIR: 12,
  BOARD_VICE_CHAIR: 12,
  POLITICAL_APPOINTEE: 12,
  ORGANISATION_LEADER: 12,
  INFRASTRUCTURE_EXECUTIVE: 12,
  DEFENCE_INDUSTRY_EXECUTIVE: 12,
  EXECUTIVE: 10,
  MEDIA_EXECUTIVE: 10,
  NGO_LEADER: 10,
  INSTITUTIONAL_INVESTOR_EXECUTIVE: 10,
  PUBLIC_AGENCY_EXECUTIVE: 10,
  CIVIL_SERVANT: 8,
  BANKER: 8,
  INVESTMENT_BANKER: 8,
  BOARD_MEMBER: 8,
  OWNER_REPRESENTATIVE: 8,
  FOUNDATION_EXECUTIVE: 8,
  MUNICIPAL_POLITICIAN: 6,
  ACADEMIC_EXECUTIVE: 8,
  SUPERVISORY_BOARD: 6,
  PROFESSOR: 6,
  INVESTOR: 6,
  COMMITTEE_MEMBER: 5,
  SECTOR_COUNCIL: 5,
  ADVISORY_BOARD: 4,
  COUNCIL_MEMBER: 4,
  TRUSTEE: 4,
  JOURNALIST: 4,
  LOBBYIST: 4,
  OTHER: 0,
};

const BOARD_KEYS = new Set<RoleType | string>([
  "BOARD_CHAIR",
  "BOARD_VICE_CHAIR",
  "BOARD_MEMBER",
  "SUPERVISORY_BOARD",
  "ADVISORY_BOARD",
  "CHAIRS",
  "TRUSTEE",
]);

function orgScalePoints(role: InfluenceRole): number {
  let points = 0;
  if (role.organizationEmployeeCount !== null && role.organizationEmployeeCount !== undefined) {
    const n = role.organizationEmployeeCount;
    points = Math.max(points, n >= 10000 ? 6 : n >= 1000 ? 4 : n >= 100 ? 2 : n >= 10 ? 1 : 0);
  }
  if (role.organizationRevenueEur !== null && role.organizationRevenueEur !== undefined) {
    const r = role.organizationRevenueEur;
    points = Math.max(points, r >= 1e9 ? 6 : r >= 1e8 ? 4 : r >= 1e7 ? 2 : 0);
  }
  return points;
}

/** Explainable institutional influence, decomposable into components (0-100). */
export function institutionalInfluence(input: InfluenceInput): InfluenceMetricResult {
  const currentRoles = input.roles.filter((r) => r.isCurrent);
  const coverageSufficient = input.evidenceSources >= 1 && currentRoles.length >= 1;

  const components: InfluenceComponent[] = [];

  // 1. Role authority (cap 40).
  const rolePoints = currentRoles.reduce((s, r) => s + (ROLE_AUTHORITY_POINTS[r.roleType ?? "OTHER"] ?? 0), 0);
  const roleCapped = Math.min(rolePoints, 40);
  if (currentRoles.length > 0) {
    components.push({
      key: "role_authority",
      label: "Tehtävävalta (dokumentoidut tehtävät)",
      points: roleCapped,
      basis: currentRoles
        .map((r) => `${ROLE_TYPE_LABELS[r.roleType ?? "OTHER"]?.fi ?? "Tehtävä"}${r.organizationName ? `, ${r.organizationName}` : ""}`)
        .join("; "),
    });
  }

  // 2. Organisation scale (cap 15).
  const scaleByOrg = new Map<string, number>();
  for (const r of currentRoles) {
    const key = r.organizationName ?? r.organizationSectors?.join(",") ?? "unknown";
    scaleByOrg.set(key, Math.max(scaleByOrg.get(key) ?? 0, orgScalePoints(r)));
  }
  const scalePoints = Math.min([...scaleByOrg.values()].reduce((s, p) => s + p, 0), 15);
  if (scalePoints > 0) {
    components.push({
      key: "organisation_scale",
      label: "Organisaation koko",
      points: scalePoints,
      basis: "Henkilöstömäärä ja/tai liikevaihto (dokumentoitu).",
    });
  }

  // 3. Public-resource control (cap 15).
  const publicRoles = currentRoles.filter((r) => r.organizationIsPublic === true);
  const publicPoints = Math.min(publicRoles.length * 5, 15);
  if (publicRoles.length > 0) {
    components.push({
      key: "public_resource_control",
      label: "Julkisen organisaation johto/ohjaus",
      points: publicPoints,
      basis: `${publicRoles.length} julkisen tai valtion omistaman organisaation dokumentoitu tehtävä.`,
    });
  }

  // 4. Appointment authority (cap 12).
  const apptCount = input.appointmentAuthorityCount ?? 0;
  const apptPoints = Math.min(apptCount * 4, 12);
  if (apptCount > 0) {
    components.push({
      key: "appointment_authority",
      label: "Nimitysvalta",
      points: apptPoints,
      basis: `${apptCount} dokumentoitu nimitys/käytettävissä oleva nimitysrooli.`,
    });
  }

  // 5. Ownership / control (cap 10) — only REPORTED or CALCULATED direct stakes.
  const ownedPercent = (input.ownershipStakes ?? [])
    .filter((s) => !s.isIndirect && (s.calculationStatus === "REPORTED" || s.calculationStatus === "CALCULATED"))
    .reduce((sum, s) => sum + Math.min(Math.max(s.percentage ?? 0, 0), 100) / 100, 0);
  const ownershipPoints = Math.min(Math.round(ownedPercent * 10), 10);
  if (ownedPercent > 0) {
    components.push({
      key: "ownership_control",
      label: "Omistus/omistusohjaus",
      points: ownershipPoints,
      basis: "Dokumentoitujen suorien omistusosuuksien osuus (vain lähteen ilmoittama tai laskennallinen).",
    });
  }

  // 6. Board centrality (cap 12).
  const boardCount = currentRoles.filter((r) => BOARD_KEYS.has(r.roleType ?? "")).length;
  const boardPoints = Math.min(boardCount * 3, 12);
  if (boardCount > 0) {
    components.push({
      key: "board_centrality",
      label: "Hallituspaikat",
      points: boardPoints,
      basis: `${boardCount} samanaikaista dokumentoitua hallitus-/luottamustehtävää.`,
    });
  }

  // 7. Cross-sector reach (cap 10).
  const sectors = new Set<string>();
  for (const r of currentRoles) for (const s of r.organizationSectors ?? []) sectors.add(s);
  const sectorPoints = Math.min(sectors.size * 2, 10);
  if (sectors.size > 0) {
    components.push({
      key: "cross_sector_reach",
      label: "Toimialojen kattavuus",
      points: sectorPoints,
      basis: `${sectors.size} dokumentoitua toimialaa nykyisissä tehtävissä.`,
    });
  }

  const total = Math.min(components.reduce((s, c) => s + c.points, 0), 100);

  return {
    name: "institutional_influence",
    value: coverageSufficient ? total : null,
    coverageSufficient,
    coverageNote: coverageSufficient ? "" : "Ei riittävästi dataa pisteytykseen.",
    methodologyVersion: "1.0",
    components,
    interpretation:
      "Rakenteellinen, lähdepohjainen mittari (0–100): tehtävävalta, organisaation koko, julkisten resurssien ohjaus, nimitysvalta, omistus/omistusohjaus, hallituspaikat ja toimialojen kattavuus. Ei arvostelma vallan käytöstä eikä poliittinen kannanotto.",
  };
}

// ---------------------------------------------------------------- helpers

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export { round };