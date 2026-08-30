-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'ORGANIZATION', 'COMPANY', 'GOVERNMENT_BODY', 'POLITICAL_PARTY', 'ASSOCIATION', 'FOUNDATION', 'UNION', 'MEDIA_ORGANIZATION', 'EDUCATIONAL_INSTITUTION', 'COURT', 'PUBLIC_AUTHORITY', 'PENSION_INSTITUTION', 'PROJECT', 'CAMPAIGN', 'ASSET', 'CONTRACT', 'DECISION', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('VERIFIED', 'HIGH', 'MEDIUM', 'LOW', 'DISPUTED');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FORMER', 'PROPOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('OWNS', 'BENEFICIAL_OWNER_OF', 'BOARD_MEMBER_OF', 'CHAIRS', 'EMPLOYED_BY', 'APPOINTED_BY', 'APPOINTED_TO', 'MEMBER_OF', 'FORMER_MEMBER_OF', 'ADVISER_TO', 'DONATED_TO', 'FUNDED_BY', 'FUNDS', 'RECEIVED_GRANT_FROM', 'PAID', 'CONTRACTED_WITH', 'SUPPLIER_TO', 'INVESTED_IN', 'SHAREHOLDER_OF', 'REPRESENTS', 'LOBBIED', 'MET_WITH', 'SUPPORTED', 'PARTNERED_WITH', 'VOTED_FOR', 'VOTED_AGAINST', 'ABSTAINED', 'INTRODUCED', 'SIGNED', 'DECIDED', 'SUPERVISES', 'REGULATES', 'AUDITS', 'OWNS_MEDIA', 'FAMILY_RELATION', 'PART_OF', 'CANDIDATE_OF', 'SITS_IN');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('PENDING', 'PROPOSED', 'PUBLISHED', 'REJECTED', 'CONFLICTED');

-- CreateEnum
CREATE TYPE "FlowType" AS ENUM ('POLITICAL_DONATION', 'CAMPAIGN_FUNDING', 'PUBLIC_GRANT', 'GOVERNMENT_SUBSIDY', 'MUNICIPAL_GRANT', 'EU_FUNDING', 'PROCUREMENT', 'CONSULTING_PAYMENT', 'BOARD_REMUNERATION', 'SALARY', 'EXECUTIVE_COMPENSATION', 'INVESTMENT', 'OWNERSHIP', 'SPONSORSHIP', 'RESEARCH_FUNDING', 'FOUNDATION_GRANT', 'ASSOCIATION_FUNDING', 'PUBLIC_PROJECT_FUNDING', 'OTHER');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('FOR', 'AGAINST', 'ABSTAIN', 'ABSENT');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_PRIMARY', 'OFFICIAL_REGISTER', 'COURT_DOCUMENT', 'PARLIAMENTARY_RECORD', 'COMPANY_DISCLOSURE', 'ANNUAL_REPORT', 'PROCUREMENT_RECORD', 'ORGANIZATION_DISCLOSURE', 'ACADEMIC_SOURCE', 'REPUTABLE_MEDIA', 'SECONDARY_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeEventType" AS ENUM ('RELATIONSHIP_ADDED', 'RELATIONSHIP_ENDED', 'AMOUNT_CHANGED', 'POSITION_CHANGED', 'OWNER_CHANGED', 'NEW_APPOINTMENT', 'NEW_GRANT', 'NEW_CONTRACT', 'NEW_VOTE', 'ENTITY_ADDED', 'ENTITY_UPDATED', 'SOURCE_ADDED', 'IDENTITY_MERGED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Entity" (
    "id" UUID NOT NULL,
    "type" "EntityType" NOT NULL,
    "subtype" TEXT,
    "canonicalName" TEXT NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "jurisdiction" TEXT,
    "municipality" TEXT,
    "region" TEXT,
    "country" TEXT,
    "officialUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "entityId" UUID NOT NULL,
    "birthYear" INTEGER,
    "profession" TEXT,
    "partyEntityId" UUID,
    "electoralDistrict" TEXT,
    "education" TEXT,
    "imageUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "hetekaId" INTEGER,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "Organization" (
    "entityId" UUID NOT NULL,
    "registrationNumber" TEXT,
    "legalForm" TEXT,
    "foundingYear" INTEGER,
    "headquarters" TEXT,
    "employeeCount" INTEGER,
    "revenueEur" DECIMAL(18,2),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "EntityAlias" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT,
    "aliasType" TEXT NOT NULL DEFAULT 'NAME_VARIANT',

    CONSTRAINT "EntityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentifier" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL,
    "sourceEntityId" UUID NOT NULL,
    "targetEntityId" UUID NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "amount" DECIMAL(18,2),
    "currency" TEXT,
    "percentage" DECIMAL(6,2),
    "role" TEXT,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "evidenceStrength" TEXT,
    "verificationState" "VerificationState" NOT NULL DEFAULT 'PUBLISHED',
    "firstSeen" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialFlow" (
    "id" UUID NOT NULL,
    "payerEntityId" UUID NOT NULL,
    "recipientEntityId" UUID NOT NULL,
    "intermediaryEntityId" UUID,
    "ultimateBeneficiaryEntityId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "flowDate" DATE,
    "periodStart" DATE,
    "periodEnd" DATE,
    "flowType" "FlowType" NOT NULL,
    "purpose" TEXT,
    "description" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "verificationState" "VerificationState" NOT NULL DEFAULT 'PUBLISHED',
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "organizationEntityId" UUID,
    "role" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "sourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "institutionEntityId" UUID,
    "decisionDate" DATE,
    "decisionType" TEXT,
    "description" TEXT,
    "legalBasis" TEXT,
    "financialValue" DECIMAL(18,2),
    "currency" TEXT,
    "affectedSectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceId" UUID,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "personEntityId" UUID NOT NULL,
    "choice" "VoteChoice" NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATE,
    "description" TEXT,
    "sourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publisher" TEXT,
    "publicationDate" DATE,
    "retrievedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "documentTitle" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'OTHER',
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "archivedHash" TEXT,
    "parserVersion" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "relationshipId" UUID,
    "flowId" UUID,
    "entityId" UUID,
    "sourceId" UUID NOT NULL,
    "quotedFragment" TEXT,
    "page" TEXT,
    "documentTitle" TEXT,
    "parserVersion" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" UUID NOT NULL,
    "agent" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "sourceId" UUID,
    "recordsScanned" INTEGER NOT NULL DEFAULT 0,
    "factsProposed" INTEGER NOT NULL DEFAULT 0,
    "factsAccepted" INTEGER NOT NULL DEFAULT 0,
    "factsRejected" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFinding" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "findingType" TEXT NOT NULL,
    "summary" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationQueue" (
    "id" UUID NOT NULL,
    "relationshipId" UUID,
    "flowId" UUID,
    "entityId" UUID,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "VerificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" UUID NOT NULL,
    "eventType" "ChangeEventType" NOT NULL,
    "entityId" UUID,
    "relationshipId" UUID,
    "flowId" UUID,
    "sourceId" UUID,
    "description" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" UUID NOT NULL,
    "entityId" UUID,
    "reporter" TEXT,
    "reporterEmail" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "moderationHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RightOfReply" (
    "id" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "responder" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEntityResponse" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RightOfReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entity_canonicalName_idx" ON "Entity"("canonicalName");

-- CreateIndex
CREATE INDEX "Entity_type_status_idx" ON "Entity"("type", "status");

-- CreateIndex
CREATE INDEX "Entity_municipality_idx" ON "Entity"("municipality");

-- CreateIndex
CREATE INDEX "Entity_country_idx" ON "Entity"("country");

-- CreateIndex
CREATE INDEX "Person_hetekaId_idx" ON "Person"("hetekaId");

-- CreateIndex
CREATE INDEX "Person_partyEntityId_idx" ON "Person"("partyEntityId");

-- CreateIndex
CREATE INDEX "Organization_registrationNumber_idx" ON "Organization"("registrationNumber");

-- CreateIndex
CREATE INDEX "EntityAlias_name_idx" ON "EntityAlias"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EntityAlias_entityId_name_aliasType_key" ON "EntityAlias"("entityId", "name", "aliasType");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_provider_idx" ON "ExternalIdentifier"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentifier_provider_identifier_key" ON "ExternalIdentifier"("provider", "identifier");

-- CreateIndex
CREATE INDEX "Relationship_sourceEntityId_idx" ON "Relationship"("sourceEntityId");

-- CreateIndex
CREATE INDEX "Relationship_targetEntityId_idx" ON "Relationship"("targetEntityId");

-- CreateIndex
CREATE INDEX "Relationship_relationshipType_idx" ON "Relationship"("relationshipType");

-- CreateIndex
CREATE INDEX "Relationship_sourceEntityId_relationshipType_idx" ON "Relationship"("sourceEntityId", "relationshipType");

-- CreateIndex
CREATE INDEX "FinancialFlow_payerEntityId_idx" ON "FinancialFlow"("payerEntityId");

-- CreateIndex
CREATE INDEX "FinancialFlow_recipientEntityId_idx" ON "FinancialFlow"("recipientEntityId");

-- CreateIndex
CREATE INDEX "FinancialFlow_flowType_idx" ON "FinancialFlow"("flowType");

-- CreateIndex
CREATE INDEX "FinancialFlow_flowDate_idx" ON "FinancialFlow"("flowDate");

-- CreateIndex
CREATE INDEX "FinancialFlow_currency_idx" ON "FinancialFlow"("currency");

-- CreateIndex
CREATE INDEX "Position_personEntityId_idx" ON "Position"("personEntityId");

-- CreateIndex
CREATE INDEX "Position_organizationEntityId_idx" ON "Position"("organizationEntityId");

-- CreateIndex
CREATE INDEX "Decision_institutionEntityId_idx" ON "Decision"("institutionEntityId");

-- CreateIndex
CREATE INDEX "Decision_decisionDate_idx" ON "Decision"("decisionDate");

-- CreateIndex
CREATE INDEX "Vote_personEntityId_idx" ON "Vote"("personEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_decisionId_personEntityId_key" ON "Vote"("decisionId", "personEntityId");

-- CreateIndex
CREATE INDEX "Event_entityId_eventDate_idx" ON "Event"("entityId", "eventDate");

-- CreateIndex
CREATE INDEX "Source_sourceType_idx" ON "Source"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Source_sourceUrl_key" ON "Source"("sourceUrl");

-- CreateIndex
CREATE INDEX "Evidence_relationshipId_idx" ON "Evidence"("relationshipId");

-- CreateIndex
CREATE INDEX "Evidence_flowId_idx" ON "Evidence"("flowId");

-- CreateIndex
CREATE INDEX "Evidence_entityId_idx" ON "Evidence"("entityId");

-- CreateIndex
CREATE INDEX "Evidence_sourceId_idx" ON "Evidence"("sourceId");

-- CreateIndex
CREATE INDEX "AgentRun_agent_startedAt_idx" ON "AgentRun"("agent", "startedAt");

-- CreateIndex
CREATE INDEX "ChangeLog_occurredAt_idx" ON "ChangeLog"("occurredAt");

-- CreateIndex
CREATE INDEX "ChangeLog_entityId_idx" ON "ChangeLog"("entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_eventType_idx" ON "ChangeLog"("eventType");

-- CreateIndex
CREATE INDEX "Correction_status_idx" ON "Correction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MethodologyVersion_version_key" ON "MethodologyVersion"("version");

-- CreateIndex
CREATE INDEX "RightOfReply_entityId_idx" ON "RightOfReply"("entityId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAlias" ADD CONSTRAINT "EntityAlias_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialFlow" ADD CONSTRAINT "FinancialFlow_payerEntityId_fkey" FOREIGN KEY ("payerEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialFlow" ADD CONSTRAINT "FinancialFlow_recipientEntityId_fkey" FOREIGN KEY ("recipientEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_institutionEntityId_fkey" FOREIGN KEY ("institutionEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_personEntityId_fkey" FOREIGN KEY ("personEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "FinancialFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFinding" ADD CONSTRAINT "AgentFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationQueue" ADD CONSTRAINT "VerificationQueue_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationQueue" ADD CONSTRAINT "VerificationQueue_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "FinancialFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "FinancialFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightOfReply" ADD CONSTRAINT "RightOfReply_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
