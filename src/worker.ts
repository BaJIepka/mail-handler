import { createDb } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { ingestFeed } from "./ingest.js";
import { computeAndStoreThreads } from "./threading.js";
import { withWorkerLock } from "./lock.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`переменная окружения ${name} не задана`);
  return value;
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const providerBaseUrl = process.env.PROVIDER_URL ?? "http://provider:8080";

  const db = createDb();
  try {
    await withWorkerLock(databaseUrl, async () => {
      await runMigrations(db);
      await ingestFeed(db, { baseUrl: providerBaseUrl });
      await computeAndStoreThreads(db);
    });
  } finally {
    await db.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
