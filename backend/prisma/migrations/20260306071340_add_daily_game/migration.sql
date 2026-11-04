/*
  Warnings:

  - You are about to drop the column `divison` on the `Team` table. All the data in the column will be lost.
  - Added the required column `division` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" DROP COLUMN "divison",
ADD COLUMN     "division" TEXT NOT NULL;
