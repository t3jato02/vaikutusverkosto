// Parliament Agent — ingestion from Eduskunta's official open-data API.
// Source: https://avoindata.eduskunta.fi/api/v1/ (OFFICIAL_PRIMARY).
// Data: current MPs, parliamentary groups (parties), committees, positions.
// Idempotent + incremental: re-running only changes what actually changed.

import { PrismaClient, RelationshipType, Confidence, ChangeEventType } from "@prisma/client";
import { fetchJsonLatin1, mapWithConcurrency } from "../lib/http";

const prisma = new PrismaClient();
const API = "https://avoindata.eduskunta.fi";
const BASE = `${API}/api/v1`;

const PARTY_CODES: Record<string, string> = {
  kok: "Kansallinen Kokoomus",
  sd: "Suomen Sosialidemokraattinen Puolue",
  ps: "Perussuomalaiset",
  kesk: "Suomen Keskusta",
  vas: "Vasemmistoliitto",
  vihr: "Vihreä liitto",
  r: "Svenska folkpartiet i Finland",
  kd: "Suomen Kristillisdemokraatit",
  liik: "Liike Nyt",
};

interface SeatingRow {
  hetekaId: number;
  seatNumber: number;
  lastname: string;
  firstname: string;
  party: string;
  minister: boolean;
  pictureUrl: string;
}

interface GroupMembership {
  Nimi: string;
  Tunnus: string;
  Jasenyys?: { AlkuPvm?: string; LoppuPvm?: string };
}

interface CommitteeMembership {
  Nimi: string;
  Tunnus: string;
  OnkoValiokunta?: boolean;
  Jasenyys?: { Rooli?: string; AlkuPvm?: string; LoppuPvm?: string }[];
}

interface MemberDetail {
  jsonNode: {
    Henkilo: {
      SukuNimi?: string;
      EtunimetNimi?: string;
      KutsumaNimi?: string;
      HenkiloNro?: number;
      SyntymaPvm?: string;
      Ammatti?: string;
      NykyinenKotikunta?: string;
      Eduskuntaryhmat?: {
        NykyinenEduskuntaryhma?: GroupMembership;
        EdellisetEduskuntaryhmat?: { Eduskuntaryhma?: GroupMembership[] };
      };
      NykyisetToimielinjasenyydet?: { Toimielin?: CommitteeMembership[] };
      AiemmatToimielinjasenyydet?: { Toimielin?: CommitteeMembership[] };
      Edustajatoimet?: { Edustajatoimi?: { AlkuPvm?: string; LoppuPvm?: string }[] };
      Vaalipiirit?: unknown;
      Koulutukset?: unknown;
    };
  };
}

function parseDate(ddmmyyyy?: string | null): Date | null {
  if (!ddmmyyyy || !/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) return null;
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// The API returns a single object instead of a 1-element array.
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

async function upsertSource(sourceUrl: string, name: string) {
  return prisma.source.upsert({
    where: { sourceUrl },
    update: { lastCheckedAt: new Date() },
    create: {
      sourceUrl,
      sourceName: name,
      publisher: "Eduskunta",
      sourceType: "OFFICIAL_PRIMARY",
      confidence: "VERIFIED",
      lastCheckedAt: new Date(),
    },
  });
}

async function upsertRelationship(opts: {
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  role?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  confidence: Confidence;
  createdBy: string;
  evidence?: { sourceId: string; documentTitle?: string }[];
  logEvent: ChangeEventType;
  logDescription: string;
}) {
  const existing = await prisma.relationship.findFirst({
    where: {
      sourceEntityId: opts.sourceEntityId,
      targetEntityId: opts.targetEntityId,
      relationshipType: opts.type,
      role: opts.role ?? null,
      startDate: opts.startDate ?? null,
    },
  });
  if (existing) {
    const changed =
      (existing.endDate?.getTime() ?? null) !== (opts.endDate?.getTime() ?? null) ||
      existing.confidence !== opts.confidence;
    if (changed) {
      const rel = await prisma.relationship.update({
        where: { id: existing.id },
        data: { endDate: opts.endDate, confidence: opts.confidence, lastVerifiedAt: new Date() },
      });
      await prisma.changeLog.create({
        data: {
          eventType: opts.logEvent,
          relationshipId: rel.id,
          sourceId: opts.evidence?.[0]?.sourceId,
          description: opts.logDescription,
          occurredAt: new Date(),
        },
      });
    }
    return existing.id;
  }
  const rel = await prisma.relationship.create({
    data: {
      sourceEntityId: opts.sourceEntityId,
      targetEntityId: opts.targetEntityId,
      relationshipType: opts.type,
      role: opts.role,
      startDate: opts.startDate,
      endDate: opts.endDate,
      confidence: opts.confidence,
      verificationState: "PUBLISHED",
      createdBy: opts.createdBy,
      lastVerifiedAt: new Date(),
      evidence: opts.evidence
        ? {
            create: opts.evidence.map((e) => ({
              sourceId: e.sourceId,
              documentTitle: e.documentTitle,
              confidence: opts.confidence,
            })),
          }
        : undefined,
    },
  });
  await prisma.changeLog.create({
    data: {
      eventType: opts.logEvent,
      entityId: opts.sourceEntityId,
      relationshipId: rel.id,
      sourceId: opts.evidence?.[0]?.sourceId,
      description: opts.logDescription,
      occurredAt: new Date(),
    },
  });
  return rel.id;
}

async function getOrCreateCommittee(tunnus: string, nimi: string) {
  // Stable key by committee NAME (Tunnus is inconsistent across responses).
  const key = `name:${nimi.toLowerCase().replace(/[^a-z0-9äöå]+/g, "-").replace(/^-+|-+$/g, "")}`;
  const existing = await prisma.externalIdentifier.findUnique({
    where: { provider_identifier: { provider: "eduskunta-committee", identifier: key } },
  });
  if (existing) return existing.entityId;
  try {
    const org = await prisma.entity.create({
      data: {
        type: "ORGANIZATION",
        subtype: "parliament_committee",
        canonicalName: nimi,
        jurisdiction: "FI",
        country: "FI",
        sourceCount: 1,
        confidence: "VERIFIED",
        externalIds: { create: { provider: "eduskunta-committee", identifier: key } },
      },
    });
    return org.id;
  } catch (e) {
    const p = e as { code?: string };
    if (p.code === "P2002") {
      const again = await prisma.externalIdentifier.findUnique({
        where: { provider_identifier: { provider: "eduskunta-committee", identifier: key } },
      });
      if (again) return again.entityId;
    }
    throw e;
  }
}

async function getOrCreateParty(code: string, name: string) {
  const existing = await prisma.externalIdentifier.findUnique({
    where: { provider_identifier: { provider: "eduskunta-party", identifier: code } },
  });
  if (existing) return existing.entityId;
  try {
    const party = await prisma.entity.create({
      data: {
        type: "POLITICAL_PARTY",
        canonicalName: name,
        jurisdiction: "FI",
        country: "FI",
        confidence: "VERIFIED",
        aliases: { create: [{ name: code.toUpperCase(), aliasType: "COMMON_NAME" }] },
        externalIds: { create: { provider: "eduskunta-party", identifier: code } },
      },
    });
    await prisma.changeLog.create({
      data: {
        eventType: "ENTITY_ADDED",
        entityId: party.id,
        description: `Uusi puolue: ${name}`,
      },
    });
    return party.id;
  } catch (e) {
    const p = e as { code?: string };
    if (p.code === "P2002") {
      const again = await prisma.externalIdentifier.findUnique({
        where: { provider_identifier: { provider: "eduskunta-party", identifier: code } },
      });
      if (again) return again.entityId;
    }
    throw e;
  }
}

async function getParliament() {
  const ext = await prisma.externalIdentifier.findUnique({
    where: { provider_identifier: { provider: "eduskunta", identifier: "parliament" } },
  });
  if (ext) return ext.entityId;
  const org = await prisma.entity.create({
    data: {
      type: "GOVERNMENT_BODY",
      subtype: "parliament",
      canonicalName: "Eduskunta",
      description: "Suomen kansanedustuslaitos",
      jurisdiction: "FI",
      country: "FI",
      officialUrls: ["https://www.eduskunta.fi/"],
      confidence: "VERIFIED",
      externalIds: { create: { provider: "eduskunta", identifier: "parliament" } },
    },
  });
  await prisma.changeLog.create({
    data: { eventType: "ENTITY_ADDED", entityId: org.id, description: "Uusi toimija: Eduskunta" },
  });
  return org.id;
}

async function processMember(row: SeatingRow, parliamentId: string): Promise<void> {
  const detailUrl = `${BASE}/memberofparliament/${row.hetekaId}/fi`;
  const detail = await fetchJsonLatin1<MemberDetail>(detailUrl);
  const h = detail.jsonNode?.Henkilo ?? {};

  const canonicalName = `${h.KutsumaNimi ?? row.firstname} ${h.SukuNimi ?? row.lastname}`.trim();

  // ---- person entity -------------------------------------------------
  const ext = await prisma.externalIdentifier.findUnique({
    where: { provider_identifier: { provider: "eduskunta-heteka", identifier: String(row.hetekaId) } },
  });
  const personData = {
    canonicalName,
    description: h.Ammatti ? `Ammatti: ${h.Ammatti}` : null,
    municipality: h.NykyinenKotikunta ?? null,
    country: "FI",
    confidence: "VERIFIED" as Confidence,
    lastVerifiedAt: new Date(),
    officialUrls: [`https://www.eduskunta.fi/FI/kansanedustajat/Sivut/${row.hetekaId}.aspx`],
  };

  let personId: string;
  let isNewPerson = false;
  if (ext) {
    await prisma.entity.update({ where: { id: ext.entityId }, data: personData });
    personId = ext.entityId;
  } else {
    const created = await prisma.entity.create({
      data: {
        ...personData,
        type: "PERSON",
        externalIds: { create: { provider: "eduskunta-heteka", identifier: String(row.hetekaId) } },
        person: {
          create: {
            firstName: row.firstname,
            lastName: row.lastname,
            hetekaId: row.hetekaId,
            birthYear: parseDate(h.SyntymaPvm)?.getFullYear() ?? null,
            imageUrl: row.pictureUrl ? `${API}/${row.pictureUrl}` : null,
            partyEntityId: null,
          },
        },
      },
    });
    personId = created.id;
    isNewPerson = true;
    await prisma.changeLog.create({
      data: { eventType: "ENTITY_ADDED", entityId: personId, description: `Uusi henkilö: ${canonicalName}` },
    });
  }

  // ---- source for this member ---------------------------------------
  const source = await upsertSource(detailUrl, `Kansanedustaja: ${canonicalName}`);
  const evidence = [{ sourceId: source.id, documentTitle: `Kansanedustajan tiedot (${canonicalName})` }];

  // ---- party relationship -------------------------------------------
  const partyCode = row.party;
  const partyName = PARTY_CODES[partyCode];
  if (partyName) {
    const partyId = await getOrCreateParty(partyCode, partyName);
    await prisma.person.update({
      where: { entityId: personId },
      data: { partyEntityId: partyId },
    });
    await upsertRelationship({
      sourceEntityId: personId,
      targetEntityId: partyId,
      type: "MEMBER_OF",
      role: "Kansanedustaja",
      confidence: "VERIFIED",
      createdBy: "parliament-agent",
      evidence,
      logEvent: "RELATIONSHIP_ADDED",
      logDescription: `${canonicalName} liittynyt puolueeseen ${partyName}`,
    });
  }

  // ---- MP position in Eduskunta -------------------------------------
  const terms = toArray(h.Edustajatoimet?.Edustajatoimi);
  const currentTerm = terms.find((t: { LoppuPvm?: string }) => !t.LoppuPvm);
  const start = parseDate(currentTerm?.AlkuPvm) ?? parseDate(terms[0]?.AlkuPvm);
  const end = parseDate(currentTerm?.LoppuPvm);

  const existingPos = await prisma.position.findFirst({
    where: { personEntityId: personId, organizationEntityId: parliamentId, role: "Kansanedustaja" },
  });
  if (existingPos) {
    await prisma.position.update({
      where: { id: existingPos.id },
      data: { startDate: start, endDate: end, isCurrent: !end, sourceId: source.id, updatedAt: new Date() },
    });
  } else {
    await prisma.position.create({
      data: {
        personEntityId: personId,
        organizationEntityId: parliamentId,
        role: "Kansanedustaja",
        startDate: start,
        endDate: end,
        isCurrent: !end,
        sourceId: source.id,
      },
    });
  }
  await upsertRelationship({
    sourceEntityId: personId,
    targetEntityId: parliamentId,
    type: "MEMBER_OF",
    role: "Kansanedustaja",
    startDate: start,
    endDate: end,
    confidence: "VERIFIED",
    createdBy: "parliament-agent",
    evidence,
    logEvent: "RELATIONSHIP_ADDED",
    logDescription: `${canonicalName} on kansanedustaja`,
  });

  // ---- committee memberships (current + former) ---------------------
  const committees: CommitteeMembership[] = [
    ...toArray(h.NykyisetToimielinjasenyydet?.Toimielin),
    ...toArray(h.AiemmatToimielinjasenyydet?.Toimielin),
  ];
  for (const c of committees) {
    if (!c.Nimi) continue;
    const tunnus = c.Tunnus ?? `by-name:${c.Nimi.toLowerCase().replace(/[^a-z0-9äöå]+/g, "-").slice(0, 60)}`;
    const committeeId = await getOrCreateCommittee(tunnus, c.Nimi);
    for (const m of toArray(c.Jasenyys)) {
      const role = m.Rooli ?? "Jäsen";
      await upsertRelationship({
        sourceEntityId: personId,
        targetEntityId: committeeId,
        type: "MEMBER_OF",
        role,
        startDate: parseDate(m.AlkuPvm),
        endDate: parseDate(m.LoppuPvm),
        confidence: "VERIFIED",
        createdBy: "parliament-agent",
        evidence,
        logEvent: "RELATIONSHIP_ADDED",
        logDescription: `${canonicalName}: ${role} — ${c.Nimi}`,
      });
    }
  }

  if (isNewPerson) {
    await prisma.entity.update({
      where: { id: personId },
      data: { sourceCount: { increment: 1 } },
    });
  }
}

async function main() {
  const startedAt = new Date();
  const run = await prisma.agentRun.create({
    data: { agent: "parliament-agent", status: "RUNNING", details: "Eduskunta avoin data -ingestio" },
  });

  let scanned = 0;
  let accepted = 0;
  let errors = 0;
  try {
    const seatingUrl = `${BASE}/seating/`;
    const seatingSource = await upsertSource(seatingUrl, "Eduskunnan nykyiset kansanedustajat");
    const seating = await fetchJsonLatin1<SeatingRow[]>(seatingUrl);
    scanned = seating.length;

    const parliamentId = await getParliament();

    await mapWithConcurrency(seating, 8, async (row) => {
      try {
        await processMember(row, parliamentId);
        accepted++;
      } catch (e) {
        errors++;
        console.error(`  ! ${row.firstname} ${row.lastname}: ${(e as Error).message}`);
      }
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: errors > 0 ? "PARTIAL" : "SUCCESS",
        sourceId: seatingSource.id,
        recordsScanned: scanned,
        factsProposed: scanned,
        factsAccepted: accepted,
        factsRejected: 0,
        errors,
      },
    });
    console.log(
      `parliament-agent done: ${accepted} members ok, ${errors} errors, in ${(Date.now() - startedAt.getTime()) / 1000}s`,
    );
  } catch (e) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "FAILED", errors: errors + 1, details: String(e) },
    });
    console.error("FATAL:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();