import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const playersRoute = Router();

playersRoute.get('/', async (req, res) => {
  try {
    const players = await prisma.player.findMany();
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching players' });
  }
});

playersRoute.get('/random', async (req, res) => {
  try {
    const players = await prisma.player.findMany();
    const random = players[Math.floor(Math.random() * players.length)];
    res.json(random);
  } catch (error) {
    res.status(500).json({ error: 'Error selecting player' });
  }
});

playersRoute.get('/search', async (req, res) => {
  const query = String(req.query.q || '');
  if (!query) {
    return res.json([]);
  }

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      position: true,
      team: {
        select: {
          name: true,
        },
      },
    },
    where: {
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    take: 10,
  });

  res.json(players);
});
