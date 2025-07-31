/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `coordinadores` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "coordinadores" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "coordinadores_userId_key" ON "coordinadores"("userId");

-- AddForeignKey
ALTER TABLE "coordinadores" ADD CONSTRAINT "coordinadores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
