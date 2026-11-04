import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { playersRoute } from './routes/players';
import { gameRouter } from './routes/game';
import { errorHandler } from './middleware/error.middleware';
export const app = express();
console.log('DB URL: ', process.env.DATABASE_URL);

app.use(
  cors({
    origin: ['http://localhost:3001', 'https://findfootballplayer.vercel.app'],
    credentials: true,
  }),
);

app.use(express.json());
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, try again later',
});

app.use(limiter);

app.use('/api/players', playersRoute);
app.use('/api/game', gameRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

app.use(errorHandler);
