-- Parc Auto — Lot 1 : SQL additif appliqué au boot par 'prisma db push' (server/Dockerfile).
-- Généré par: prisma migrate diff (schéma main -> branche feat/parc-auto-lot1), 2026-11-17.
-- 100% additif : CREATE TYPE / TABLE / INDEX / FOREIGN KEY. Aucun DROP, aucune ALTER sur une table existante.
-- Appliqué automatiquement au déploiement ; ce fichier sert à relire / appliquer manuellement si besoin.

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('en_service', 'en_panne', 'retire');

-- CreateEnum
CREATE TYPE "VehicleOwnerType" AS ENUM ('actionnaire', 'toole');

-- CreateTable
CREATE TABLE "Shareholder" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "plate" TEXT,
    "photoUrl" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'en_service',
    "ownerType" "VehicleOwnerType" NOT NULL DEFAULT 'toole',
    "shareholderId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedBy" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shareholder_fullName_idx" ON "Shareholder"("fullName");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_shareholderId_idx" ON "Vehicle"("shareholderId");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicleId_idx" ON "VehicleAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_driverId_idx" ON "VehicleAssignment"("driverId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_endedAt_idx" ON "VehicleAssignment"("endedAt");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "Shareholder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

