/*
  Warnings:

  - Added the required column `age` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthday` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `divison` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "age" INTEGER NOT NULL,
ADD COLUMN     "birthday" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "divison" TEXT NOT NULL;
