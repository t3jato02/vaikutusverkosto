import { NextResponse } from "next/server";
import { activePlans, pricingVersion, VAIKUTA_PRECISE_LABEL, type PlanConfig } from "@/lib/vaikuta/pricing";

// Public pricing — prices come ONLY from the central pricing config. A
// client can never influence the server's price (entitlements re-derive it).
export async function GET() {
  const plans: Array<Pick<PlanConfig, "code" | "name" | "billingPeriod" | "priceMinor" | "currency" | "recipientLimit" | "campaignAllowance" | "tagline" | "features" | "contactSales">> =
    activePlans().map((p) => ({
      code: p.code,
      name: p.name,
      billingPeriod: p.billingPeriod,
      priceMinor: p.priceMinor,
      currency: p.currency,
      recipientLimit: p.recipientLimit,
      campaignAllowance: p.campaignAllowance,
      tagline: p.tagline,
      features: p.features,
      contactSales: p.contactSales,
    }));
  return NextResponse.json({ pricingVersion: pricingVersion(), note: VAIKUTA_PRECISE_LABEL, plans });
}