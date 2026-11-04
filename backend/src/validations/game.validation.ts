import { z } from 'zod';

export const guessSchema = z.object({
  playerId: z.number().int().positive(),
});
