import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`переменная окружения ${name} не задана`);
  return value;
}

export function createDb(): Kysely<Database> {
  const pool = new Pool({
    connectionString: requireEnv("DATABASE_URL"),
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
