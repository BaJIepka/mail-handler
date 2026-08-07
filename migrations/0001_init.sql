create table if not exists messages (
  external_id   text primary key,
  in_reply_to   text,
  refs          text[] not null default '{}',
  subject       text not null,
  from_addr     text not null,
  to_addrs      text[] not null default '{}',
  sent_at       timestamptz not null,
  thread_key    text,
  parent_id     text
);

create index if not exists messages_thread_key_idx on messages (thread_key);

create table if not exists fetch_progress (
  id          boolean primary key default true check (id),
  next_cursor text,
  started     boolean not null default false,
  done        boolean not null default false
);

insert into fetch_progress (id, next_cursor, started, done)
values (true, null, false, false)
on conflict (id) do nothing;
