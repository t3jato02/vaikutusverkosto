// Finance data manifest — aggregated sections.
//
// Each section is a stable "document" for the ingestion pipeline (collector
// change-detection keys off the section payload hash, so re-runs are no-ops
// until the manifest changes).

import type { ManifestSection } from "./types";
import { banksSection } from "./banks";
import { insuranceSection } from "./insurance";
import { investmentSection } from "./investment";
import { infrastructureSection } from "./infrastructure";
import { listedSection } from "./listed";
import { pensionSection } from "./pension";

export type { ManifestOrg, ManifestRole, ManifestScale, ManifestSection } from "./types";

// Sections ingested by the FinanceInstitutionAgent.
export const financeSections: ManifestSection[] = [
  banksSection,
  insuranceSection,
  investmentSection,
  infrastructureSection,
  listedSection,
];

// Section ingested by the PensionGovernanceAgent.
export const pensionSections: ManifestSection[] = [pensionSection];