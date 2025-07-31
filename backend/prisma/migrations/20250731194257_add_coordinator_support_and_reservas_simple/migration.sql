-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoReserva" AS ENUM ('UNICA', 'PERIODICA');

-- CreateEnum
CREATE TYPE "ReservaEstado" AS ENUM ('ACTIVA', 'CANCELADA', 'COMPLETADA');

-- AlterEnum
ALTER TYPE "UserRol" ADD VALUE 'COORDINADOR';

-- DropForeignKey
ALTER TABLE "viajes" DROP CONSTRAINT "viajes_choferId_fkey";

-- DropForeignKey
ALTER TABLE "viajes" DROP CONSTRAINT "viajes_vehiculoId_fkey";

-- AlterTable
ALTER TABLE "vehiculos" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "ultimaUbicacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "viajes" ADD COLUMN     "clienteEmail" TEXT,
ADD COLUMN     "clienteNombre" TEXT,
ADD COLUMN     "clienteTelefono" TEXT,
ADD COLUMN     "destinoDetallado" TEXT,
ADD COLUMN     "origenDetallado" TEXT,
ADD COLUMN     "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE',
ALTER COLUMN "choferId" DROP NOT NULL,
ALTER COLUMN "vehiculoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT,
    "diasSemana" TEXT,
    "tipo" "TipoReserva" NOT NULL DEFAULT 'UNICA',
    "estado" "ReservaEstado" NOT NULL DEFAULT 'ACTIVA',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remiseriaId" TEXT NOT NULL,
    "choferId" TEXT,
    "vehiculoId" TEXT,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_remiseriaId_fkey" FOREIGN KEY ("remiseriaId") REFERENCES "remiserias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
