import { Request, Response } from 'express';
import {
  startGameService,
  getDailyGameService,
  getTopGamesService,
  makeGuessService,
  getGameService,
} from '../services/game.service';
import { guessSchema } from '../validations/game.validation';

export async function startGame(req: Request, res: Response, next: Function) {
  try {
    const game = await startGameService();
    res.json(game);
  } catch (err) {
    next(err);
  }
}

export async function getDailyGame(req: Request, res: Response, next: Function) {
  try {
    const game = await getDailyGameService();
    res.json(game);
  } catch (err) {
    next(err);
  }
}

export async function getTopGames(req: Request, res: Response, next: Function) {
  try {
    const result = await getTopGamesService();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function makeGuess(req: Request, res: Response, next: Function) {
  try {
    const gameId = Number(req.params.id);
    const parsed = guessSchema.parse(req.body);
    const { playerId } = parsed;

    const guess = await makeGuessService(gameId, playerId);
    res.json(guess);
  } catch (err) {
    next(err);
  }
}

export async function getGame(req: Request, res: Response, next: Function) {
  try {
    const id = Number(req.params.id);
    const result = await getGameService(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
