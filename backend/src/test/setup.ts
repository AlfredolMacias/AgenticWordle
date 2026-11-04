import 'dotenv/config';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL is not set. Tests require the local development database.',
  );
}

const hostname = hostnameOf(databaseUrl);

if (!hostname || !LOCAL_HOSTNAMES.has(hostname)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL host "${hostname ?? 'unparseable'}" is not local. ` +
      'Tests must run against the local development database, never a deployed one.',
  );
}
