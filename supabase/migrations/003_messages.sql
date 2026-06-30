-- ============================================================
-- Messages (in-app chat between coach and client)
-- ============================================================

create table if not exists messages (
  id          uuid        primary key default gen_random_uuid(),
  sender_id   uuid        not null references profiles(id) on delete cascade,
  receiver_id uuid        not null references profiles(id) on delete cascade,
  content     text        not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Fast lookup for a conversation between two users
create index if not exists messages_convo_idx on messages (
  least(sender_id::text, receiver_id::text),
  greatest(sender_id::text, receiver_id::text),
  created_at
);

alter table messages enable row level security;

create policy "messages_select" on messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages_insert" on messages
  for insert with check (auth.uid() = sender_id);

create policy "messages_update" on messages
  for update using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Enable real-time for this table
alter publication supabase_realtime add table messages;
