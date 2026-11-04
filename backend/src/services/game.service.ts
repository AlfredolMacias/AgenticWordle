import { prisma } from '../lib/prisma';

type hint = 'correct' | 'incorrect' | 'higher' | 'lower';

export const MAX_ATTEMPTS = 6;

export function isGameFinished(session: {
  isFinished: boolean;
  attempts: number;
}): boolean {
  return session.isFinished || session.attempts >= MAX_ATTEMPTS;
}

export function comparePlayers(secret: any, guess: any) {
  const result = {
    team: guess.teamId === secret?.teamId ? 'correct' : 'incorrect',
    position: guess.position === secret?.position ? 'correct' : 'incorrect',
    jersey:
      guess.jerseyNumber === secret?.jerseyNumber
        ? 'correct'
        : guess.jerseyNumber > secret?.jerseyNumber
          ? 'lower'
          : 'higher',
    conference:
      guess.team.conference === secret?.team.conference
        ? 'correct'
        : 'incorrect',
    division:
      guess.team.division === secret?.team.division ? 'correct' : 'incorrect',
  };

  const isWinner =
    result.team === 'correct' &&
    result.position === 'correct' &&
    result.jersey === 'correct';

  return { result, isWinner };
}

export async function startGameService() {
  const players = await prisma.player.findMany();

  const random = players[Math.floor(Math.random() * players.length)];

  const game = await prisma.gameSession.create({
    data: {
      secretPlayerId: random.id,
    },
  });

  return game;
}

export async function getGameService(req: number) {
  const gameId = Number(req);
  const game = await prisma.gameSession.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return { error: 'Game not found' };
  }

  return game;
}

export async function getTopGamesService() {
  const topGames = await prisma.gameSession.findMany({
    where: {
      isFinished: true,
      score: { not: null },
    },
    orderBy: { score: 'desc' },
    take: 10,
  });

  return topGames;
}

export async function getDailyGameService() {
  const today = new Date().toISOString().split('T')[0];
  let dailyGame = await prisma.dailyGame.findUnique({
    where: { date: today },
  });

  if (!dailyGame) {
    const players = await prisma.player.findMany();
    const random = players[Math.floor(Math.random() * players.length)];

    dailyGame = await prisma.dailyGame.create({
      data: {
        date: today,
        secretPlayerId: random.id,
      },
    });
  }

  return { dailyGameId: dailyGame.id };
}

export async function makeGuessService(gameId: number, playerId: number) {
  const game = await prisma.gameSession.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return { error: 'Game not found' };
  }

  if (isGameFinished(game)) {
    throw new Error('Game already finished');
  }

  const guessedPlayer = await prisma.player.findUnique({
    select: {
      name: true,
      position: true,
      jerseyNumber: true,
      teamId: true,
      team: {
        select: {
          name: true,
          division: true,
          conference: true,
        },
      },
    },
    where: { id: playerId },
  });

  if (!guessedPlayer) {
    return { error: 'Player not found' };
  }

  const secret = await prisma.player.findUnique({
    select: {
      name: true,
      position: true,
      jerseyNumber: true,
      teamId: true,
      team: {
        select: {
          division: true,
          conference: true,
        },
      },
    },
    where: { id: game.secretPlayerId },
  });

  if (!secret) {
    return { error: 'Game not found' };
  }

  const { result, isWinner } = comparePlayers(secret, guessedPlayer);

  const scoreTable = [100, 80, 60, 40, 20, 10, 0];

  const resultSession = await prisma.$transaction(async (tx) => {
    const claim = await tx.gameSession.updateMany({
      where: {
        id: gameId,
        isFinished: false,
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: {
        attempts: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      throw new Error('Game already finished');
    }

    const current = await tx.gameSession.findUnique({
      where: { id: gameId },
    });

    if (!current) {
      throw new Error('Game not found');
    }

    const attemptsAfter = current.attempts;

    if (isWinner) {
      const score = scoreTable[attemptsAfter - 1] ?? 0;
      const updated = await tx.gameSession.update({
        where: { id: gameId },
        data: {
          attempts: attemptsAfter,
          isFinished: true,
          isWin: true,
          score,
        },
      });

      await tx.guess.create({
        data: {
          gameSessionId: gameId,
          playerId: playerId,
          result: result,
        },
      });

      return updated;
    }

    if (attemptsAfter >= MAX_ATTEMPTS) {
      const updated = await tx.gameSession.update({
        where: { id: gameId },
        data: {
          attempts: attemptsAfter,
          isFinished: true,
          isWin: false,
          score: 0,
        },
      });

      await tx.guess.create({
        data: {
          gameSessionId: gameId,
          playerId: playerId,
          result: result,
        },
      });

      return updated;
    }

    await tx.guess.create({
      data: {
        gameSessionId: gameId,
        playerId: playerId,
        result: result,
      },
    });

    return current;
  });

  const score = resultSession.score ?? 0;

  return {
    player: guessedPlayer.name,
    position: guessedPlayer.position,
    jersey: guessedPlayer.jerseyNumber,
    team: guessedPlayer.team.name,
    conference: guessedPlayer.team.conference,
    division: guessedPlayer.team.division,
    result,
    isWinner,
    score,
    isFinished: resultSession.isFinished,
    secretPlayer: resultSession.isFinished ? secret.name : '',
  };
}
