import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEntityBySlug } from "@/lib/queries";
import OrganizationProfile from "../../organization/_shared/OrganizationProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  return {
    title: entity?.canonicalName ?? "Yritys",
    description: entity ? `Yritysprofiili: ${entity.canonicalName} — omistus, hallitus, rahavirrat ja lähteet.` : undefined,
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity || entity.type !== "COMPANY") notFound();
  return <OrganizationProfile entity={entity} />;
}