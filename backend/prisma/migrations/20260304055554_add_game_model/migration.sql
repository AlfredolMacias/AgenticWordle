-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_secretPlayerId_fkey" FOREIGN KEY ("secretPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
