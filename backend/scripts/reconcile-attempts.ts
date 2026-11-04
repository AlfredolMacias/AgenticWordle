import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const MAX_ATTEMPTS = 6;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes('--dry-run'),
    confirm: argv.includes('--confirm'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const hostname = hostnameOf(databaseUrl);
  console.log(`Target host: ${hostname ?? 'unparseable'}`);

  if (!hostname || !LOCAL_HOSTNAMES.has(hostname)) {
    if (!args.confirm) {
      throw new Error(
        'Refusing to run against non-local database without --confirm',
      );
    }
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const sessions = await prisma.gameSession.findMany({
      include: { _count: { select: { guesses: true } } },
    });

    let toUpdate = 0;

    for (const session of sessions) {
      const guessCount = session._count.guesses;
      const shouldBeFinished = session.isWin || guessCount >= MAX_ATTEMPTS;
      const needsUpdate =
        session.attempts !== guessCount ||
        session.isFinished !== shouldBeFinished;

      if (needsUpdate) {
        toUpdate += 1;
        console.log(
          `Session ${session.id}: attempts ${session.attempts}->${guessCount}, isFinished ${session.isFinished}->${shouldBeFinished}, isWin ${session.isWin}, score ${session.score}`,
        );

        if (!args.dryRun) {
          await prisma.gameSession.update({
            where: { id: session.id },
            data: {
              attempts: guessCount,
              isFinished: shouldBeFinished,
            },
          });
        }
      }
    }

    if (args.dryRun) {
      console.log(`Dry run complete. Sessions to update: ${toUpdate}`);
    } else {
      console.log(`Reconciliation complete. Sessions updated: ${toUpdate}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
