import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEntityBySlug } from "@/lib/queries";
import OrganizationProfile from "../../organization/_shared/OrganizationProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  return {
    title: entity?.canonicalName ?? "Instituutio",
    description: entity ? `Instituutioprofiili: ${entity.canonicalName} — johto, suhteet, rahoitus ja lähteet.` : undefined,
  };
}

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await resolveEntityBySlug(slug);
  if (!entity) notFound();
  return <OrganizationProfile entity={entity} />;
}