-- CreateEnum
CREATE TYPE "UserRol" AS ENUM ('ADMIN', 'DUENIO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "UserRol" NOT NULL DEFAULT 'DUENIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duenios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remiserias" (
    "id" TEXT NOT NULL,
    "nombreFantasia" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remiserias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remiseria_duenio" (
    "id" TEXT NOT NULL,
    "remiseriaId" TEXT NOT NULL,
    "duenioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remiseria_duenio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "duenios_userId_key" ON "duenios"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "remiseria_duenio_remiseriaId_duenioId_key" ON "remiseria_duenio"("remiseriaId", "duenioId");

-- AddForeignKey
ALTER TABLE "duenios" ADD CONSTRAINT "duenios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remiseria_duenio" ADD CONSTRAINT "remiseria_duenio_remiseriaId_fkey" FOREIGN KEY ("remiseriaId") REFERENCES "remiserias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remiseria_duenio" ADD CONSTRAINT "remiseria_duenio_duenioId_fkey" FOREIGN KEY ("duenioId") REFERENCES "duenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
