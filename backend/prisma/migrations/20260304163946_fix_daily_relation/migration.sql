-- CreateTable
CREATE TABLE "DailyGame" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "secretPlayerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyGame_date_key" ON "DailyGame"("date");

-- AddForeignKey
ALTER TABLE "DailyGame" ADD CONSTRAINT "DailyGame_secretPlayerId_fkey" FOREIGN KEY ("secretPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
