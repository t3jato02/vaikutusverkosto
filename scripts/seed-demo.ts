// Demo data — ONLY clearly marked, fictional entities and flows.
// Purpose: demonstrate the money-flow feature with data that cannot be
// mistaken for production facts. Every demo row is marked in the UI and
// its source URL is a non-resolving demo URL.
//
// Run: npm run ingest:seed

import { PrismaClient, EntityType, FlowType } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_TAG = "DEMO";

async function demoEntity(name: string, type: EntityType, subtype?: string) {
  const existing = await prisma.entity.findFirst({
    where: { canonicalName: name, description: { contains: DEMO_TAG } },
  });
  if (existing) return existing.id;
  const e = await prisma.entity.create({
    data: {
      type,
      subtype,
      canonicalName: name,
      description: `${DEMO_TAG}: fiktiivinen esimerkkitoimija demonstraatiota varten. Ei ole todellinen toimija.`,
      jurisdiction: "FI",
      country: "FI",
      confidence: "LOW",
      sourceCount: 1,
    },
  });
  return e.id;
}

async function demoSource(id: string) {
  const url = `https://demo.vaikutusverkosto.fi/example/${id}`;
  const existing = await prisma.source.findUnique({ where: { sourceUrl: url } });
  if (existing) return existing;
  return prisma.source.create({
    data: {
      sourceUrl: url,
      sourceName: "DEMO-lähde (fiktiivinen)",
      publisher: "Vaikutusverkosto (demo)",
      sourceType: "OTHER",
      confidence: "LOW",
      documentTitle: "Demonstraatio: esimerkki rahavirta",
    },
  });
}

async function addFlow(opts: {
  payerId: string;
  recipientId: string;
  amount: number;
  flowType: FlowType;
  purpose: string;
  date: string;
  sourceId: string;
}) {
  const existing = await prisma.financialFlow.findFirst({
    where: { payerEntityId: opts.payerId, recipientEntityId: opts.recipientId, purpose: { contains: "demo" } },
  });
  if (existing) return;
  const flow = await prisma.financialFlow.create({
    data: {
      payerEntityId: opts.payerId,
      recipientEntityId: opts.recipientId,
      amount: opts.amount,
      currency: "EUR",
      flowDate: new Date(opts.date),
      flowType: opts.flowType,
      purpose: `${opts.purpose} (demo)`,
      description: "DEMO: fiktiivinen esimerkkirahavirta.",
      confidence: "LOW",
      sourceCount: 1,
      evidence: { create: [{ sourceId: opts.sourceId, confidence: "LOW" }] },
    },
  });
  console.log(`  + demo flow: ${flow.flowType} ${opts.amount} EUR`);
}

async function main() {
  const source = await demoSource("demo-flows");

  const kunta = await demoEntity("DemoKunta (demo)", "GOVERNMENT_BODY");
  const rakennus = await demoEntity("DemoRakennus Oy (demo)", "COMPANY");
  const yhdistys = await demoEntity("DemoYhdistys ry (demo)", "ASSOCIATION");
  const puolue = await demoEntity("DemoPuolue (demo)", "POLITICAL_PARTY");
  const kampanja = await demoEntity("DemoVaalikampanja (demo)", "CAMPAIGN");
  const saatio = await demoEntity("DemoSäätiö (demo)", "FOUNDATION");
  const yliopisto = await demoEntity("DemoYliopisto (demo)", "EDUCATIONAL_INSTITUTION");
  const yritys2 = await demoEntity("DemoLogistiikka Oy (demo)", "COMPANY");

  await addFlow({ payerId: kunta, recipientId: rakennus, amount: 2400000, flowType: "PROCUREMENT", purpose: "Koulurakennuksen urakka", date: "2024-06-15", sourceId: source.id });
  await addFlow({ payerId: kunta, recipientId: yhdistys, amount: 45000, flowType: "MUNICIPAL_GRANT", purpose: "Kulttuuriavustus", date: "2025-01-10", sourceId: source.id });
  await addFlow({ payerId: kampanja, recipientId: puolue, amount: 50000, flowType: "POLITICAL_DONATION", purpose: "Vaalirahoitus", date: "2023-08-01", sourceId: source.id });
  await addFlow({ payerId: saatio, recipientId: yliopisto, amount: 300000, flowType: "RESEARCH_FUNDING", purpose: "Tutkimusapuraha", date: "2025-03-20", sourceId: source.id });
  await addFlow({ payerId: kunta, recipientId: yritys2, amount: 120000, flowType: "CONSULTING_PAYMENT", purpose: "Digikonsultointi", date: "2024-11-05", sourceId: source.id });
  await addFlow({ payerId: puolue, recipientId: kampanja, amount: 80000, flowType: "CAMPAIGN_FUNDING", purpose: "Vaalikampanjan rahoitus", date: "2023-07-01", sourceId: source.id });

  console.log("Demo-data valmis. Kaikki demo-tiedot on merkitty selkeästi.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});