import { NextResponse } from "next/server";
import { getCurrentUser, isEmailVerified } from "@/lib/vaikuta/authUser";
import { getEntitlement } from "@/lib/vaikuta/entitlements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const entitlement = await getEntitlement(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: isEmailVerified(user),
      identityLevel: user.emailVerifiedAt ? "email_verified" : "unverified",
    },
    entitlement: {
      planCode: entitlement.planCode,
      planName: entitlement.plan.name,
      pricingVersion: entitlement.pricingVersion,
      executedInWindow: entitlement.executedInWindow,
      canExecute: entitlement.canExecute,
      recipientLimit: entitlement.recipientLimit,
    },
  });
}