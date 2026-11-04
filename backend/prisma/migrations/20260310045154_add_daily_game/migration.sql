/*
  Warnings:

  - You are about to drop the column `birthday` on the `Player` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[abr]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "birthday";

-- CreateIndex
CREATE UNIQUE INDEX "Team_abr_key" ON "Team"("abr");
