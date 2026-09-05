// Seed / refresh the Source Registry from the code adapters.
// Usage: npm run registry:sync

import "../src/lib/agents/registry";
import { syncRegistry, listRegistry } from "../src/lib/agents/sourceRegistry";

async function main() {
  const n = await syncRegistry();
  const rows = await listRegistry();
  console.log(`Source Registry synced — ${n} adapter(s).`);
  for (const r of rows) {
    console.log(
      `  ${r.enabled ? "●" : "○"} ${r.id.padEnd(20)} ${r.reliabilityTier.padEnd(18)} ` +
        `${r.updateCadence.padEnd(8)} last ok: ${r.lastSuccessAt?.toISOString() ?? "—"}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
