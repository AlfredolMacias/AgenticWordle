import request from 'supertest';
import type { Express } from 'express';
import type { Player } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const trackedSessionIds = new Set<number>();

export function trackSession(id: number): number {
  trackedSessionIds.add(id);
  return id;
}

export function getTrackedSessionIds(): number[] {
  return [...trackedSessionIds];
}

export function clearTrackedSessions(): void {
  trackedSessionIds.clear();
}

export async function cleanupTrackedSessions(): Promise<void> {
  const ids = getTrackedSessionIds();

  if (ids.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.guess.deleteMany({ where: { gameSessionId: { in: ids } } }),
    prisma.gameSession.deleteMany({ where: { id: { in: ids } } }),
  ]);

  clearTrackedSessions();
}

export async function startGame(app: Express): Promise<number> {
  const res = await request(app).post('/api/game/start');
  const body = res.body as { id?: unknown };
  const id = body.id;

  if (res.status !== 200 || typeof id !== 'number') {
    throw new Error(`Failed to start a game (status ${res.status})`);
  }

  return trackSession(id);
}

export async function getSecretPlayer(gameId: number): Promise<Player> {
  trackSession(gameId);

  const session = await prisma.gameSession.findUnique({
    where: { id: gameId },
    include: { secret: true },
  });

  if (!session) {
    throw new Error(`Game session ${gameId} not found`);
  }

  return session.secret;
}

export async function getDistinctPlayers(
  secret: Player,
  count: number,
): Promise<Player[]> {
  const players = await prisma.player.findMany({
    where: {
      id: { not: secret.id },
      teamId: { not: secret.teamId },
      position: { not: secret.position },
      jerseyNumber: { not: secret.jerseyNumber },
    },
    take: count,
  });

  if (players.length < count) {
    throw new Error(
      `Found ${players.length} players distinct from secret ${secret.id}; expected ${count}`,
    );
  }

  return players;
}

afterAll(async () => {
  await cleanupTrackedSessions();
});
