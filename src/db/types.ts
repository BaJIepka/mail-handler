import type { ColumnType, Generated } from "kysely";

export interface MessagesTable {
  external_id: string;
  in_reply_to: string | null;
  refs: string[];
  subject: string;
  from_addr: string;
  to_addrs: string[];
  sent_at: ColumnType<Date, string, string>;
  thread_key: string | null;
  parent_id: string | null;
}

export interface FetchProgressTable {
  id: Generated<boolean>;
  next_cursor: string | null;
  started: boolean;
  done: boolean;
}

export interface SchemaMigrationsTable {
  name: string;
  applied_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  messages: MessagesTable;
  fetch_progress: FetchProgressTable;
  schema_migrations: SchemaMigrationsTable;
}
