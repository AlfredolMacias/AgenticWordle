import Request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { startGame } from './helpers/game';

describe('Game API', () => {
  it('should create a new game', async () => {
    const res = await Request(app).post('/api/game/start');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('should allow a guess', async () => {
    const gameId = await startGame(app);
    const player = await prisma.player.findFirst();

    if (!player) {
      throw new Error('No players seeded');
    }

    const resGuess = await Request(app)
      .post(`/api/game/${gameId}/guess`)
      .send({ playerId: player.id });

    expect(resGuess.status).toBe(200);
    expect(resGuess.body).toHaveProperty('result');
    expect(resGuess.body).toHaveProperty('isWinner');
  });

  it('should search players', async () => {
    const res = await Request(app).get('/api/players/search?q=ma');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
