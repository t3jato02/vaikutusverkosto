import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { setCampaignModeration } from "@/lib/vaikuta/campaigns";

interface AdminActionBody {
  action: "suspend" | "resume" | "clear_moderation" | "close" | "force_delivery_off";
}

// PATCH /api/admin/vaikuta/campaigns/[id] — privileged campaign management.
// Every action is audited through CampaignEvent. Admin session required.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionFromCookie())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: AdminActionBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });

  switch (body.action) {
    case "suspend":
      await db.influenceCampaign.update({ where: { id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
      await db.campaignEvent.create({ data: { campaignId: id, type: "campaign_suspended", metadata: { by: "admin" } } });
      break;
    case "resume":
      await db.influenceCampaign.update({
        where: { id },
        data: { status: campaign.paymentStatus === "SUCCEEDED" ? "PAYMENT_COMPLETED" : "APPROVED", suspendedAt: null },
      });
      await db.campaignEvent.create({ data: { campaignId: id, type: "campaign_closed", metadata: { by: "admin", resumed: true } } });
      break;
    case "clear_moderation": {
      await setCampaignModeration({ campaignId: id, status: "MESSAGE_READY" });
      break;
    }
    case "close":
      await db.influenceCampaign.update({ where: { id }, data: { status: "CLOSED" } });
      await db.campaignEvent.create({ data: { campaignId: id, type: "campaign_closed", metadata: { by: "admin" } } });
      break;
    case "force_delivery_off": {
      await db.influenceCampaign.update({ where: { id }, data: { deliveryProvider: "mock", deliveryProviderState: { disabledByAdmin: true } } });
      await db.campaignEvent.create({ data: { campaignId: id, type: "campaign_suspended", metadata: { by: "admin", deliveryOff: true } } });
      break;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}