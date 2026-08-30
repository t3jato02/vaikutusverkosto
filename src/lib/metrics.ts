import type { Confidence, RelationshipType } from "@prisma/client";

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

// ---------------------------------------------------------------- helpers

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export { round };