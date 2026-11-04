import { makeGuessService } from '../services/game.service';
import { prisma } from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    gameSession: {
      findUnique: jest.fn(),
    },
    guess: {
      count: jest.fn(),
      create: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
    },
  },
}));

describe('makeGuessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws "Game already finished" for a finished session', async () => {
    (prisma.gameSession.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      secretPlayerId: 10,
      attempts: 1,
      isFinished: true,
      isWin: true,
      score: 100,
    });

    await expect(makeGuessService(1, 123)).rejects.toThrow(
      'Game already finished',
    );
  });

  it('throws "Game already finished" when atomic claim fails (count 0)', async () => {
    (prisma.gameSession.findUnique as jest.Mock).mockImplementation(
      (args: any) => {
        if (args?.where?.id === 1) {
          return Promise.resolve({
            id: 1,
            secretPlayerId: 10,
            attempts: 5,
            isFinished: false,
            isWin: false,
            score: null,
          });
        }
        return Promise.resolve(null);
      },
    );

    (prisma.player.findUnique as jest.Mock).mockImplementation((args: any) => {
      if (args?.where?.id === 123) {
        return Promise.resolve({
          name: 'Test Player',
          position: 'QB',
          jerseyNumber: 12,
          teamId: 1,
          team: { name: 'Test', division: 'A', conference: 'NFC' },
        });
      }
      if (args?.where?.id === 10) {
        return Promise.resolve({
          name: 'Secret',
          position: 'QB',
          jerseyNumber: 1,
          teamId: 2,
          team: { division: 'B', conference: 'AFC' },
        });
      }
      return Promise.resolve(null);
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      const tx = {
        gameSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        guess: {
          create: jest.fn(),
        },
      };
      return fn(tx);
    });

    await expect(makeGuessService(1, 123)).rejects.toThrow(
      'Game already finished',
    );
  });
});
