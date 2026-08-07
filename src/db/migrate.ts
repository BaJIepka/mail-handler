import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sql, type Kysely } from "kysely";
import type { Database } from "./types.js";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `.execute(db);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRows = await db.selectFrom("schema_migrations").select("name").execute();
  const applied = new Set(appliedRows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction().execute(async (trx) => {
      await sql.raw(content).execute(trx);
      await sql`insert into schema_migrations (name) values (${file})`.execute(trx);
    });
    console.log(`[migrate] применена ${file}`);
  }
}
