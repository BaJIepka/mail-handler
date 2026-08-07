import { Client } from "pg";

const WORKER_LOCK_KEY = 727_001;

/**
 * Postgres advisory lock на всё время работы worker'а. Сессионный (не
 * транзакционный) специально: страницы ленты коммитятся по одной, лок не
 * должен зависеть от их границ. Держится на отдельном соединении и
 * освобождается автоматически при его закрытии, даже если процесс упадёт.
 */
export async function withWorkerLock<T>(databaseUrl: string, fn: () => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [WORKER_LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await client.query("select pg_advisory_unlock($1)", [WORKER_LOCK_KEY]).catch(() => {});
    await client.end();
  }
}
