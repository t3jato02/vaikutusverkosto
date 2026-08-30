import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEntityBySlug } from "@/lib/queries";
import OrganizationProfile from "../_shared/OrganizationProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  return {
    title: entity?.canonicalName ?? "Organisaatio",
    description: entity ? `Profiili: ${entity.canonicalName} — dokumentoidut suhteet, rahavirrat ja lähteet.` : undefined,
  };
}

export default async function OrganizationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) notFound();
  return <OrganizationProfile entity={entity} />;
}