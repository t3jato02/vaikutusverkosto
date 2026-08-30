import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = rateLimit(clientIp(req), 120);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });
  }
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const perPage = Math.min(Number(searchParams.get("per_page") ?? 50), 100);

  const where: Prisma.EntityWhereInput = {
    ...(type ? { type: type as Prisma.EntityWhereInput["type"] } : {}),
    ...(q
      ? {
          OR: [
            { canonicalName: { contains: q, mode: "insensitive" as const } },
            { aliases: { some: { name: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [total, entities] = await Promise.all([
    db.entity.count({ where }),
    db.entity.findMany({
      where,
      orderBy: [{ sourceCount: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, type: true, canonicalName: true, description: true, municipality: true, sourceCount: true, lastVerifiedAt: true },
    }),
  ]);
  return NextResponse.json({ page, perPage, total, entities });
}