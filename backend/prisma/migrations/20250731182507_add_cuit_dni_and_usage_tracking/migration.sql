/*
  Warnings:

  - A unique constraint covering the columns `[dni]` on the table `duenios` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cuit]` on the table `remiserias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dni` to the `duenios` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cuit` to the `remiserias` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "duenios" ADD COLUMN     "dni" TEXT;

-- AlterTable
ALTER TABLE "remiserias" ADD COLUMN     "cuit" TEXT;

-- Update existing records with default values
UPDATE "duenios" SET "dni" = 'PENDIENTE_' || "id" WHERE "dni" IS NULL;
UPDATE "remiserias" SET "cuit" = 'PENDIENTE_' || "id" WHERE "cuit" IS NULL;

-- Make columns NOT NULL after updating
ALTER TABLE "duenios" ALTER COLUMN "dni" SET NOT NULL;
ALTER TABLE "remiserias" ALTER COLUMN "cuit" SET NOT NULL;

-- CreateTable
CREATE TABLE "app_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duenios_dni_key" ON "duenios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "remiserias_cuit_key" ON "remiserias"("cuit");
