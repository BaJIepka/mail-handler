import { sql, type Kysely } from "kysely";
import type { Database } from "./db/types.js";
import { computeThreadKeys, resolveParentId } from "./thread/compute.js";

/**
 * Один batch-проход по уже вычитанным письмам: строит компоненты связности
 * (union-find) и parent_id по правилу задания, затем одним UPDATE проставляет
 * их всем строкам. Полностью детерминированный пересчёт от текущего состояния
 * таблицы — безопасно гонять сколько угодно раз (в т.ч. повторно после рестарта).
 */
export async function computeAndStoreThreads(db: Kysely<Database>): Promise<void> {
  const rows = await db
    .selectFrom("messages")
    .select(["external_id", "in_reply_to", "refs"])
    .execute();

  if (rows.length === 0) {
    console.log("[threading] писем нет, нечего считать");
    return;
  }

  const threadKeyById = computeThreadKeys(rows);
  const knownIds = new Set(rows.map((r) => r.external_id));

  const externalIds: string[] = [];
  const threadKeys: string[] = [];
  const parentIds: (string | null)[] = [];

  for (const row of rows) {
    externalIds.push(row.external_id);
    threadKeys.push(threadKeyById.get(row.external_id)!);
    parentIds.push(resolveParentId(row, knownIds));
  }

  await sql`
    update messages as m
    set thread_key = data.thread_key, parent_id = data.parent_id
    from (
      select *
      from unnest(${externalIds}::text[], ${threadKeys}::text[], ${parentIds}::text[])
        as t(external_id, thread_key, parent_id)
    ) as data
    where m.external_id = data.external_id
  `.execute(db);

  console.log(`[threading] обработано писем: ${rows.length}`);
}
