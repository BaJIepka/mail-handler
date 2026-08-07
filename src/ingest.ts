import type { Kysely } from "kysely";
import type { Database } from "./db/types.js";
import { fetchPage, type ProviderClientOptions } from "./provider/client.js";
import type { ProviderMessage } from "./provider/types.js";

function toRow(m: ProviderMessage) {
  return {
    external_id: m.message_id,
    in_reply_to: m.in_reply_to ?? null,
    refs: m.references ?? [],
    subject: m.subject,
    from_addr: m.from,
    to_addrs: m.to,
    sent_at: m.sent_at,
  };
}

/**
 * Вычитывает ленту до конца, продолжая с сохранённого курсора при рестарте.
 * Вставка страницы и сдвиг курсора — одна транзакция: крах между ними
 * в худшем случае повторяет страницу (безвредно, вставка идемпотентна),
 * но никогда не теряет и не задваивает уже подтверждённый прогресс.
 */
export async function ingestFeed(db: Kysely<Database>, provider: ProviderClientOptions): Promise<void> {
  const progress = await db
    .selectFrom("fetch_progress")
    .selectAll()
    .where("id", "=", true)
    .executeTakeFirstOrThrow();

  if (progress.done) {
    console.log("[ingest] лента уже вычитана полностью, пропускаем");
    return;
  }

  let cursor = progress.started ? progress.next_cursor : null;
  let totalFetched = 0;

  for (;;) {
    const page = await fetchPage(provider, cursor);
    totalFetched += page.items.length;

    await db.transaction().execute(async (trx) => {
      if (page.items.length > 0) {
        await trx
          .insertInto("messages")
          .values(page.items.map(toRow))
          .onConflict((oc) => oc.column("external_id").doNothing())
          .execute();
      }
      await trx
        .updateTable("fetch_progress")
        .set({
          next_cursor: page.next_cursor,
          started: true,
          done: page.next_cursor === null,
        })
        .where("id", "=", true)
        .execute();
    });

    console.log(
      `[ingest] +${page.items.length} писем (всего получено за этот запуск: ${totalFetched}), курсор=${page.next_cursor ?? "(конец)"}`,
    );

    if (page.next_cursor === null) break;
    cursor = page.next_cursor;
  }

  console.log("[ingest] лента вычитана до конца");
}
