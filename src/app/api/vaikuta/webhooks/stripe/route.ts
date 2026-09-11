import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPaymentProvider } from "@/lib/vaikuta/payments";

// POST /api/vaikuta/webhooks/stripe — webhook receiver architecture.
//
// Safe by construction while PAYMENTS_ENABLED=false: the provider returns
// "ignored" before any signature check and no processing happens. Once Stripe
// is activated, the flow is: verify signature → idempotently process
// `checkout.session.completed` by `providerSessionId`. Duplicate events are
// recognized by an existing SUCCEEDED payment for the same session.
export async function POST(req: Request) {
  const rawBody = await req.arrayBuffer();
  const signature = req.headers.get("stripe-signature");

  const provider = getPaymentProvider();
  const outcome = await provider.handleWebhook(rawBody, signature);

  if (outcome.status === "processed") {
    const session = await db.vaikutaCheckoutSession.findFirst({
      where: { providerSessionId: outcome.sessionId, provider: "stripe", status: "IN_PROGRESS" },
      include: { campaign: { select: { id: true, planCode: true } } },
    });
    if (!session || !session.campaign) {
      return NextResponse.json({ received: true, outcome: "processed_without_session" });
    }
    const alreadyPaid = await db.vaikutaPayment.findFirst({
      where: { checkoutSessionId: session.id, status: { in: ["SUCCEEDED", "PENDING"] } },
    });
    if (alreadyPaid) {
      // Idempotent — duplicate webhook.
      return NextResponse.json({ received: true, outcome: "duplicate" });
    }
    await db.$transaction(async (tx) => {
      await tx.vaikutaPayment.create({
        data: {
          userId: session.userId,
          checkoutSessionId: session.id,
          amountMinor: session.amountMinor,
          currency: session.currency,
          status: "SUCCEEDED",
          provider: "stripe",
          providerPaymentId: outcome.eventId,
          isMock: false,
          metadata: { provider: "stripe", chargedVia: "webhook" } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.vaikutaCheckoutSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.influenceCampaign.update({ where: { id: session.campaignId! }, data: { paymentStatus: "SUCCEEDED", status: "PAYMENT_COMPLETED" } });
      await tx.campaignEvent.create({ data: { campaignId: session.campaignId!, type: "checkout_started" } });
    });
  }

  // Always 200 for the provider; signature failures are logged via outcome.
  return NextResponse.json({ received: true, outcome: outcome.status, reason: outcome.status === "rejected" ? outcome.reason : undefined });
}