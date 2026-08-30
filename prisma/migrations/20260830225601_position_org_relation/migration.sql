-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_organizationEntityId_fkey" FOREIGN KEY ("organizationEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
