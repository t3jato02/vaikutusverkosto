-- CreateEnum
CREATE TYPE "VaikutaUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VaikutaSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VaikutaCheckoutStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VaikutaPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VaikutaCampaignStatus" AS ENUM ('DRAFT', 'RECIPIENTS_SELECTED', 'MESSAGE_READY', 'APPROVED', 'CHECKOUT_READY', 'PAYMENT_COMPLETED', 'DELIVERED', 'CLOSED', 'SUSPENDED', 'REQUIRES_MODERATION');

-- CreateEnum
CREATE TYPE "VaikutaCampaignDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'ACCEPTED', 'SIMULATED_DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "entityId" UUID;

-- CreateTable
CREATE TABLE "VaikutaUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "identityLevel" TEXT NOT NULL DEFAULT 'email_verified',
    "status" "VaikutaUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaikutaUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaPlan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL DEFAULT 'one_time',
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "recipientLimit" INTEGER,
    "campaignAllowance" INTEGER,
    "aiAssist" BOOLEAN NOT NULL DEFAULT true,
    "monitoring" BOOLEAN NOT NULL DEFAULT false,
    "features" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaikutaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "VaikutaSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaikutaSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaCheckoutSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "campaignId" UUID,
    "planId" UUID,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "VaikutaCheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerSessionId" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaikutaCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "checkoutSessionId" UUID,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "VaikutaPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerPaymentId" TEXT,
    "providerChargeId" TEXT,
    "receiptUrl" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaikutaPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfluenceCampaign" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "status" "VaikutaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "messageSubject" TEXT,
    "messageBody" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paymentStatus" "VaikutaPaymentStatus",
    "deliveryStatus" "VaikutaCampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "planCode" TEXT NOT NULL DEFAULT 'FREE',
    "planSnapshot" JSONB,
    "pricingVersion" TEXT,
    "publicVisibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "publicStatement" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "abuseFlaggedAt" TIMESTAMP(3),
    "abuseReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "deliveryProvider" TEXT,
    "deliveryProviderState" JSONB,
    "preparedMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluenceCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "recipientRole" TEXT,
    "recipientReason" TEXT,
    "relevanceDimension" TEXT NOT NULL,
    "isMedia" BOOLEAN NOT NULL DEFAULT false,
    "relationshipType" TEXT,
    "sourceId" UUID,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verifiedAt" TIMESTAMP(3),
    "contactMethod" TEXT,
    "contactAvailability" TEXT NOT NULL DEFAULT 'not_verified',
    "contactVerifiedAt" TIMESTAMP(3),
    "deliveryStatus" "VaikutaCampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" UUID,
    "campaignId" UUID,
    "decisionId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaikutaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaContactMethod" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "sourceId" UUID,
    "isPublicProfessional" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaikutaContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaikutaVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'email_verification',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaikutaVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignResponse" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "recipientEntityId" UUID,
    "kind" TEXT NOT NULL DEFAULT 'delivery',
    "summary" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionStage" (
    "id" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "stageType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" DATE,
    "detail" TEXT,
    "sourceId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaikutaUser_email_key" ON "VaikutaUser"("email");

-- CreateIndex
CREATE INDEX "VaikutaUser_status_idx" ON "VaikutaUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VaikutaPlan_code_key" ON "VaikutaPlan"("code");

-- CreateIndex
CREATE INDEX "VaikutaSubscription_userId_status_idx" ON "VaikutaSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "VaikutaCheckoutSession_userId_status_idx" ON "VaikutaCheckoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "VaikutaCheckoutSession_providerSessionId_idx" ON "VaikutaCheckoutSession"("providerSessionId");

-- CreateIndex
CREATE INDEX "VaikutaPayment_userId_idx" ON "VaikutaPayment"("userId");

-- CreateIndex
CREATE INDEX "VaikutaPayment_checkoutSessionId_idx" ON "VaikutaPayment"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "InfluenceCampaign_userId_createdAt_idx" ON "InfluenceCampaign"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InfluenceCampaign_decisionId_idx" ON "InfluenceCampaign"("decisionId");

-- CreateIndex
CREATE INDEX "InfluenceCampaign_status_idx" ON "InfluenceCampaign"("status");

-- CreateIndex
CREATE INDEX "InfluenceCampaign_isDemo_idx" ON "InfluenceCampaign"("isDemo");

-- CreateIndex
CREATE INDEX "CampaignRecipient_entityId_idx" ON "CampaignRecipient"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_entityId_key" ON "CampaignRecipient"("campaignId", "entityId");

-- CreateIndex
CREATE INDEX "CampaignEvent_campaignId_createdAt_idx" ON "CampaignEvent"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "VaikutaEvent_eventType_createdAt_idx" ON "VaikutaEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "VaikutaEvent_userId_idx" ON "VaikutaEvent"("userId");

-- CreateIndex
CREATE INDEX "VaikutaContactMethod_entityId_idx" ON "VaikutaContactMethod"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "VaikutaContactMethod_entityId_contactType_value_key" ON "VaikutaContactMethod"("entityId", "contactType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "VaikutaVerificationToken_tokenHash_key" ON "VaikutaVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VaikutaVerificationToken_userId_purpose_idx" ON "VaikutaVerificationToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "CampaignResponse_campaignId_receivedAt_idx" ON "CampaignResponse"("campaignId", "receivedAt");

-- CreateIndex
CREATE INDEX "DecisionStage_decisionId_date_idx" ON "DecisionStage"("decisionId", "date");

-- CreateIndex
CREATE INDEX "DecisionStage_stageType_idx" ON "DecisionStage"("stageType");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_entityId_key" ON "Decision"("entityId");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaSubscription" ADD CONSTRAINT "VaikutaSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaSubscription" ADD CONSTRAINT "VaikutaSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VaikutaPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaCheckoutSession" ADD CONSTRAINT "VaikutaCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaCheckoutSession" ADD CONSTRAINT "VaikutaCheckoutSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InfluenceCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaPayment" ADD CONSTRAINT "VaikutaPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluenceCampaign" ADD CONSTRAINT "InfluenceCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfluenceCampaign" ADD CONSTRAINT "InfluenceCampaign_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InfluenceCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InfluenceCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaEvent" ADD CONSTRAINT "VaikutaEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaEvent" ADD CONSTRAINT "VaikutaEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InfluenceCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaContactMethod" ADD CONSTRAINT "VaikutaContactMethod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaContactMethod" ADD CONSTRAINT "VaikutaContactMethod_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaikutaVerificationToken" ADD CONSTRAINT "VaikutaVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VaikutaUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignResponse" ADD CONSTRAINT "CampaignResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InfluenceCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionStage" ADD CONSTRAINT "DecisionStage_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionStage" ADD CONSTRAINT "DecisionStage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

