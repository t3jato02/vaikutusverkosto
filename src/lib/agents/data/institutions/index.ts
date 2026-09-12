// Public-institutions data manifest — aggregated sections.
//
// Each section is a stable "document" for the ingestion pipeline (collector
// change-detection keys off the section payload hash, so re-runs are no-ops
// until the manifest changes).

import type { ManifestSection } from "./types";
import { governmentSection } from "./government";
import { municipalitiesSection } from "./municipalities";
import { civilSocietySection } from "./civilSociety";

export type { ManifestOrg, ManifestRole, ManifestSection } from "./types";

export const publicInstitutionSections: ManifestSection[] = [
  governmentSection,
  municipalitiesSection,
  civilSocietySection,
];