import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireVerifiedUser } from "@/lib/vaikuta/session";
import { db } from "@/lib/db";
import CheckoutForm from "@/components/vaikuta/CheckoutForm";
import { PrototypeBanner } from "@/components/vaikuta/PrototypeBanner";

export const metadata: Metadata = { title: "Prototyyppikassa" };
export const dynamic = "force-dynamic";

export default async function MockCheckoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await requireVerifiedUser();
  const checkout = await db.vaikutaCheckoutSession.findUnique({
    where: { id: sessionId },
    include: { campaign: { select: { id: true, userId: true, decisionId: true, planCode: true } } },
  });
  if (!checkout || checkout.userId !== session.user!.id) notFound();
  if (checkout.status === "COMPLETED") {
    redirect(`/vaikuta/${encodeURIComponent(checkout.campaign?.decisionId ?? "")}/confirmation?campaign=${encodeURIComponent(checkout.campaignId ?? "")}`);
  }
  if (checkout.status === "EXPIRED" || checkout.status === "CANCELLED") {
    redirect(`/vaikuta/${encodeURIComponent(checkout.campaign?.decisionId ?? "")}/checkout?campaign=${encodeURIComponent(checkout.campaignId ?? "")}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <p className="label">PROTOTYYPPIKASSA</p>
        <h1 className="mt-1 text-entity-title">Vahvista maksusimulaatio</h1>
      </header>

      <PrototypeBanner compact />

      <CheckoutForm
        sessionId={checkout.id}
        campaignId={checkout.campaign?.id ?? ""}
        decisionId={checkout.campaign?.decisionId ?? ""}
        amountMinor={checkout.amountMinor}
        currency={checkout.currency}
        isMock={checkout.isMock}
        planCode={checkout.campaign?.planCode ?? "VAIKUTA_PASS"}
        coveredBySubscription={checkout.amountMinor === 0}
      />
    </div>
  );
}