CREATE TABLE "SenatorialDistrictLga" (
    "senatorialDistrictId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SenatorialDistrictLga_pkey" PRIMARY KEY ("senatorialDistrictId","lgaId")
);

CREATE TABLE "FederalConstituencyLga" (
    "federalConstituencyId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederalConstituencyLga_pkey" PRIMARY KEY ("federalConstituencyId","lgaId")
);

CREATE TABLE "StateConstituencyLga" (
    "stateConstituencyId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateConstituencyLga_pkey" PRIMARY KEY ("stateConstituencyId","lgaId")
);

CREATE INDEX "SenatorialDistrictLga_lgaId_idx" ON "SenatorialDistrictLga"("lgaId");
CREATE INDEX "FederalConstituencyLga_lgaId_idx" ON "FederalConstituencyLga"("lgaId");
CREATE INDEX "StateConstituencyLga_lgaId_idx" ON "StateConstituencyLga"("lgaId");

ALTER TABLE "SenatorialDistrictLga" ADD CONSTRAINT "SenatorialDistrictLga_senatorialDistrictId_fkey" FOREIGN KEY ("senatorialDistrictId") REFERENCES "SenatorialDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SenatorialDistrictLga" ADD CONSTRAINT "SenatorialDistrictLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FederalConstituencyLga" ADD CONSTRAINT "FederalConstituencyLga_federalConstituencyId_fkey" FOREIGN KEY ("federalConstituencyId") REFERENCES "FederalConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FederalConstituencyLga" ADD CONSTRAINT "FederalConstituencyLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StateConstituencyLga" ADD CONSTRAINT "StateConstituencyLga_stateConstituencyId_fkey" FOREIGN KEY ("stateConstituencyId") REFERENCES "StateConstituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StateConstituencyLga" ADD CONSTRAINT "StateConstituencyLga_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "LGA"("id") ON DELETE CASCADE ON UPDATE CASCADE;
