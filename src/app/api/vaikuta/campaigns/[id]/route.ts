import { NextResponse } from "next/server";
import { authedGet, apiError } from "@/lib/vaikuta/http";
import { getOwnedCampaign } from "@/lib/vaikuta/campaigns";

// GET /api/vaikuta/campaigns/[id] — full wizard state for the owner.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authedGet(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const campaign = await getOwnedCampaign(auth.ctx.userId, id);
  if (!campaign) return apiError(404, "campaign_not_found");

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      status: campaign.status,
      title: campaign.title,
      decisionId: campaign.decisionId,
      decisionTitle: campaign.decision.title,
      institutionName: campaign.decision.institutionEntity?.canonicalName ?? null,
      messageSubject: campaign.messageSubject,
      messageBody: campaign.messageBody,
      approvedAt: campaign.approvedAt,
      paymentStatus: campaign.paymentStatus,
      deliveryStatus: campaign.deliveryStatus,
      planCode: campaign.planCode,
      pricingVersion: campaign.pricingVersion,
      publicVisibility: campaign.publicVisibility,
      abuseFlagged: campaign.abuseFlaggedAt !== null,
      abuseReason: campaign.abuseReason,
      isDemo: campaign.isDemo,
      createdAt: campaign.createdAt.toISOString(),
      recipients: campaign.recipients.map((r) => ({
        entityId: r.entityId,
        name: r.entity.canonicalName,
        role: r.recipientRole,
        reason: r.recipientReason,
        dimension: r.relevanceDimension,
        isMedia: r.isMedia,
        sourceName: r.source?.sourceName ?? null,
        sourceUrl: r.source?.sourceUrl ?? null,
        verifiedAt: r.verifiedAt,
        contactAvailability: r.contactAvailability,
        deliveryStatus: r.deliveryStatus,
        responseStatus: r.responseStatus,
      })),
      events: campaign.events.map((e) => ({ type: e.type, createdAt: e.createdAt.toISOString() })),
    },
  });
}