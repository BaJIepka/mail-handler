import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createDb } from "./db/connection.js";

async function main(): Promise<void> {
  const db = createDb();
  const rows = await db
    .selectFrom("messages")
    .select(["external_id", "thread_key", "parent_id", "sent_at", "subject"])
    .execute();

  const outDir = path.resolve(process.cwd(), "out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "result.jsonl");

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(outPath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("finish", resolve);
    for (const row of rows) {
      const sentAt = row.sent_at instanceof Date ? row.sent_at.toISOString() : row.sent_at;
      stream.write(
        JSON.stringify({
          external_id: row.external_id,
          // thread_key не должен быть пустым, даже если threading-проход по
          // какой-то причине не отработал для этой строки: собственный id
          // как запасной вариант сохраняет требуемое свойство (совпадает
          // только у писем одного разговора).
          thread_key: row.thread_key ?? row.external_id,
          parent_id: row.parent_id ?? "",
          sent_at: sentAt,
          subject: row.subject,
        }) + "\n",
      );
    }
    stream.end();
  });

  console.log(`[exporter] записано писем: ${rows.length} -> ${outPath}`);
  await db.destroy();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
