import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getDailyGame,
  getGame,
  getTopGames,
  makeGuess,
  startGame,
} from '../controllers/game.controller';

export const gameRouter = Router();

gameRouter.post('/start', asyncHandler(startGame));

gameRouter.post('/:id/guess', asyncHandler(makeGuess));

gameRouter.get('/:id', asyncHandler(getGame));

gameRouter.get('/daily/today', asyncHandler(getDailyGame));

gameRouter.get('/leaderboard/top', asyncHandler(getTopGames));
