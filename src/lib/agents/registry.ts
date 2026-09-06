// Agent registry + orchestrator logic (which agents are due).

import type { SourceAdapter } from "./types";
import { eduskuntaAdapter } from "./eduskunta";
import { procurementAdapter } from "./procurement";
import { prhAdapter } from "./prh";
import { sidonnaisuudetAdapter } from "./sidonnaisuudet";

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

export const SCHEDULES: Record<string, string> = {
  daily: "0 4 * * *", // 04:00 UTC
  weekly: "0 4 * * 1", // 04:00 UTC Mondays
};