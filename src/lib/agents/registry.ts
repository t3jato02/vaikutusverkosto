// Agent registry + orchestrator logic (which agents are due).

import type { SourceAdapter } from "./types";
import { eduskuntaAdapter } from "./eduskunta";
import { procurementAdapter } from "./procurement";
import { prhAdapter } from "./prh";
import { sidonnaisuudetAdapter } from "./sidonnaisuudet";
import { euFtsAdapter } from "./euFts";
import { euTransparencyAdapter } from "./euTransparency";
import { vnkOwnershipAdapter } from "./vnkOwnership";
import { yleAdapter } from "./yle";
import { awardAdapter } from "./awards";
import { giftBenefitAdapter } from "./gifts";
import { publicInstitutionsAdapter } from "./publicInstitutions";

const REGISTRY: Record<string, SourceAdapter> = {};

export function register(adapter: SourceAdapter) {
  REGISTRY[adapter.id] = adapter;
}

export function getAdapter(id: string): SourceAdapter | null {
  return REGISTRY[id] ?? null;
}

export function listAdapters(): SourceAdapter[] {
  return Object.values(REGISTRY);
}

// Register adapters at import time.
register(eduskuntaAdapter);
register(procurementAdapter);
register(prhAdapter);
register(sidonnaisuudetAdapter);
register(euFtsAdapter);
register(euTransparencyAdapter);
register(vnkOwnershipAdapter);
register(yleAdapter);
register(awardAdapter);
register(giftBenefitAdapter);
register(publicInstitutionsAdapter);

export const SCHEDULES: Record<string, string> = {
  daily: "0 4 * * *", // 04:00 UTC
  weekly: "0 4 * * 1", // 04:00 UTC Mondays
};