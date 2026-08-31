// CLI runner: run a single agent through the ingestion pipeline.
// Usage: npm run agent -- parliament-agent | procurement-agent
// tsx resolves tsconfig "paths" so "@/lib/..." imports work.

import { listAdapters, getAdapter } from "../src/lib/agents/registry";
import { runAgent } from "../src/lib/agents/pipeline";

async function main() {
  const agentId = process.argv[2];
  if (!agentId) {
    console.error("Usage: npm run agent -- <agent-id>");
    console.error("Available agents:");
    for (const a of listAdapters()) console.error(`  - ${a.id} (${a.schedule})`);
    process.exit(1);
  }
  const adapter = getAdapter(agentId);
  if (!adapter) {
    console.error(`Unknown agent: ${agentId}`);
    process.exit(1);
  }
  console.log(`Running agent: ${adapter.id}`);
  const report = await runAgent(adapter);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAILED") process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});