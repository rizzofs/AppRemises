/*
  Warnings:

  - You are about to drop the column `activo` on the `choferes` table. All the data in the column will be lost.
  - You are about to drop the column `licencia` on the `choferes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[numeroChofer]` on the table `choferes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoriaLicencia` to the `choferes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numeroChofer` to the `choferes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vtoLicencia` to the `choferes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `capacidad` to the `vehiculos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propietario` to the `vehiculos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `vehiculos` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChoferEstado" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'DADO_DE_BAJA');

-- AlterTable
ALTER TABLE "choferes" DROP COLUMN "activo",
DROP COLUMN "licencia",
ADD COLUMN     "categoriaLicencia" TEXT NOT NULL,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "estado" "ChoferEstado" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "numeroChofer" TEXT NOT NULL,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "vehiculoId" TEXT,
ADD COLUMN     "vtoLicencia" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "vehiculos" ADD COLUMN     "capacidad" INTEGER NOT NULL,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "propietario" TEXT NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "vtoMatafuego" TIMESTAMP(3),
ADD COLUMN     "vtoSeguro" TIMESTAMP(3),
ADD COLUMN     "vtoVtv" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "choferes_numeroChofer_key" ON "choferes"("numeroChofer");

-- AddForeignKey
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
