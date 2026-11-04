import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { getDistinctPlayers, getSecretPlayer, startGame } from './helpers/game';

type GuessResponse = {
  isWinner?: unknown;
  isFinished?: unknown;
  secretPlayer?: unknown;
};

async function submitGuess(gameId: number, playerId: number) {
  const res = await request(app)
    .post(`/api/game/${gameId}/guess`)
    .send({ playerId });

  return { status: res.status, body: res.body as GuessResponse };
}

describe('Game state integrity', () => {
  describe('AC-1 — win on attempt 1', () => {
    it('reports the win, persists it, and reveals the secret', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);

      const { status, body } = await submitGuess(gameId, secret.id);

      expect(status).toBe(200);
      expect(body.isWinner).toBe(true);
      expect(body.isFinished).toBe(true);
      expect(body.secretPlayer).toBe(secret.name);

      const session = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });

      expect(session).not.toBeNull();
      expect(session?.isWin).toBe(true);
      expect(session?.isFinished).toBe(true);
      expect(session?.attempts).toBe(1);
      expect(session?.score).toBe(100);
    });
  });

  describe('AC-8 — state derived from the persisted session', () => {
    it('derives isFinished and secretPlayer from the session on an early win', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);

      const { status, body } = await submitGuess(gameId, secret.id);

      expect(status).toBe(200);

      const session = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });

      expect(session?.isFinished).toBe(true);
      expect(body.isFinished).toBe(session?.isFinished);
      expect(body.secretPlayer).toBe(secret.name);
    });
  });

  describe('AC-2 — win on attempt 6', () => {
    it('scores 10 and reveals the secret on the final attempt', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 5);

      for (const wrongPlayer of wrongPlayers) {
        const { status, body } = await submitGuess(gameId, wrongPlayer.id);

        expect(status).toBe(200);
        expect(body.isWinner).toBe(false);
      }

      const { status, body } = await submitGuess(gameId, secret.id);

      expect(status).toBe(200);
      expect(body.isWinner).toBe(true);
      expect(body.isFinished).toBe(true);
      expect(body.secretPlayer).toBe(secret.name);

      const session = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });

      expect(session?.isWin).toBe(true);
      expect(session?.isFinished).toBe(true);
      expect(session?.attempts).toBe(6);
      expect(session?.score).toBe(10);
    });
  });

  describe('AC-3 — loss on attempt 6', () => {
    it('scores 0 and reveals the secret on the final attempt', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 6);

      for (const wrongPlayer of wrongPlayers.slice(0, 5)) {
        const { status, body } = await submitGuess(gameId, wrongPlayer.id);

        expect(status).toBe(200);
        expect(body.isWinner).toBe(false);
      }

      const finalGuess = await submitGuess(gameId, wrongPlayers[5].id);

      expect(finalGuess.status).toBe(200);
      expect(finalGuess.body.isWinner).toBe(false);
      expect(finalGuess.body.isFinished).toBe(true);
      expect(finalGuess.body.secretPlayer).toBe(secret.name);

      const session = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });

      expect(session?.isWin).toBe(false);
      expect(session?.isFinished).toBe(true);
      expect(session?.attempts).toBe(6);
      expect(session?.score).toBe(0);
    });
  });

  describe('AC-4 — guess after winning', () => {
    it('rejects further guesses with 400 Game already finished', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);

      const first = await submitGuess(gameId, secret.id);
      expect(first.status).toBe(200);

      const sessionBefore = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountBefore = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      const wrongPlayers = await getDistinctPlayers(secret, 1);
      const second = await request(app)
        .post(`/api/game/${gameId}/guess`)
        .send({ playerId: wrongPlayers[0].id });

      expect(second.status).toBe(400);
      expect(second.body.error).toBe('Game already finished');

      const sessionAfter = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountAfter = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      expect(sessionAfter?.attempts).toBe(sessionBefore?.attempts);
      expect(guessCountAfter).toBe(guessCountBefore);
    });
  });

  describe('AC-5 — guess after losing', () => {
    it('rejects further guesses with 400 Game already finished', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 6);

      for (const wrongPlayer of wrongPlayers.slice(0, 5)) {
        const res = await submitGuess(gameId, wrongPlayer.id);
        expect(res.status).toBe(200);
      }

      const final = await submitGuess(gameId, wrongPlayers[5].id);
      expect(final.status).toBe(200);

      const sessionBefore = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountBefore = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      const extra = await request(app)
        .post(`/api/game/${gameId}/guess`)
        .send({ playerId: secret.id });

      expect(extra.status).toBe(400);
      expect(extra.body.error).toBe('Game already finished');

      const sessionAfter = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountAfter = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      expect(sessionAfter?.attempts).toBe(sessionBefore?.attempts);
      expect(guessCountAfter).toBe(guessCountBefore);
    });
  });

  describe('AC-6 — attempts increment per accepted guess', () => {
    it('increments persisted attempts after each guess in progress', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 3);

      for (let i = 0; i < wrongPlayers.length; i += 1) {
        const { status, body } = await submitGuess(gameId, wrongPlayers[i].id);
        expect(status).toBe(200);

        const session = await prisma.gameSession.findUnique({
          where: { id: gameId },
        });
        expect(session?.attempts).toBe(i + 1);
      }
    });
  });

  describe('AC-9 — in-progress derivation', () => {
    it('derives isFinished false and secretPlayer empty for non-final guesses', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 1);

      const { status, body } = await submitGuess(gameId, wrongPlayers[0].id);
      expect(status).toBe(200);
      expect(body.isWinner).toBe(false);
      expect(body.isFinished).toBe(false);
      expect(body.secretPlayer).toBe('');
    });
  });

  describe('AC-7 — persisted result shape', () => {
    it('persists Guess.result as a hint object', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 1);

      const { status } = await submitGuess(gameId, wrongPlayers[0].id);
      expect(status).toBe(200);

      const guess = await prisma.guess.findFirst({
        where: { gameSessionId: gameId },
      });

      expect(guess).not.toBeNull();
      expect(typeof guess?.result).toBe('object');
      expect(guess?.result).not.toBeNull();
      expect(Array.isArray(guess?.result)).toBe(false);

      const result = guess?.result as Record<string, unknown>;
      expect(result).toHaveProperty('team');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('jersey');
      expect(result).toHaveProperty('conference');
      expect(result).toHaveProperty('division');

      const hints = new Set(['correct', 'incorrect', 'higher', 'lower']);
      expect(hints.has(result.team as string)).toBe(true);
      expect(hints.has(result.position as string)).toBe(true);
      expect(hints.has(result.jersey as string)).toBe(true);
      expect(hints.has(result.conference as string)).toBe(true);
      expect(hints.has(result.division as string)).toBe(true);
    });
  });

  describe('T-09 — nonexistent playerId does not consume an attempt', () => {
    // NOTE: Returning 200 with { error: "Player not found" } is current behavior;
    // this will be reviewed in spec 003.
    it('never mutates attempts or inserts a Guess on unknown playerId', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);

      const sessionBefore = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountBefore = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      const res = await request(app)
        .post(`/api/game/${gameId}/guess`)
        .send({ playerId: 999999 });

      expect(res.status).toBe(200);

      const sessionAfter = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      const guessCountAfter = await prisma.guess.count({
        where: { gameSessionId: gameId },
      });

      expect(sessionAfter?.attempts).toBe(sessionBefore?.attempts);
      expect(guessCountAfter).toBe(guessCountBefore);
      expect(sessionAfter?.isFinished).toBe(sessionBefore?.isFinished);
      expect(sessionAfter?.isWin).toBe(sessionBefore?.isWin);
      expect(sessionAfter?.score).toBe(sessionBefore?.score);
    });
  });

  describe('T-21 — concurrency (optional)', () => {
    it('submits two guesses concurrently against 5-attempt session', async () => {
      const gameId = await startGame(app);
      const secret = await getSecretPlayer(gameId);
      const wrongPlayers = await getDistinctPlayers(secret, 6);

      for (const wrongPlayer of wrongPlayers.slice(0, 5)) {
        const res = await submitGuess(gameId, wrongPlayer.id);
        expect(res.status).toBe(200);
      }

      const [first, second] = await Promise.all([
        request(app)
          .post(`/api/game/${gameId}/guess`)
          .send({ playerId: secret.id }),
        request(app)
          .post(`/api/game/${gameId}/guess`)
          .send({ playerId: wrongPlayers[0].id }),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 400]);
      const errorBody = first.status === 400 ? first.body : second.body;
      expect(errorBody.error).toBe('Game already finished');

      const session = await prisma.gameSession.findUnique({
        where: { id: gameId },
      });
      expect(session?.attempts).toBe(6);
    });
  });
});
