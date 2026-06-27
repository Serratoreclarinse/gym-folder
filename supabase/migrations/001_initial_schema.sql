-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum ('coach', 'client');
create type public.package_type as enum ('30min', '45min', '1hr');
create type public.package_status as enum ('active', 'expired');
create type public.email_trigger_type as enum ('2_remaining', '1_remaining');

-- ============================================================
-- TABLES
-- ============================================================

-- profiles extends auth.users (auto-created on signup via trigger)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        public.user_role not null default 'client',
  phone       text,
  created_at  timestamptz not null default now()
);

-- packages: a client purchases a block of sessions from a coach
create table public.packages (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id) on delete cascade,
  coach_id           uuid not null references public.profiles(id) on delete cascade,
  package_type       public.package_type not null,
  total_sessions     integer not null check (total_sessions > 0),
  sessions_used      integer not null default 0 check (sessions_used >= 0),
  sessions_remaining integer not null generated always as (total_sessions - sessions_used) stored,
  start_date         date not null default current_date,
  status             public.package_status not null default 'active',
  created_at         timestamptz not null default now(),

  constraint sessions_used_lte_total check (sessions_used <= total_sessions)
);

-- workout_sessions: records each completed coaching session
create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  package_id       uuid not null references public.packages(id) on delete restrict,
  client_id        uuid not null references public.profiles(id) on delete cascade,
  coach_id         uuid not null references public.profiles(id) on delete cascade,
  session_date     date not null default current_date,
  duration_minutes integer not null check (duration_minutes > 0),
  -- JSON array of { exercise_name, sets, reps, weight, notes }
  exercises        jsonb not null default '[]'::jsonb,
  notes            text,
  created_at       timestamptz not null default now()
);

-- email_logs: deduplication guard for automated reminder emails
create table public.email_logs (
  id           uuid primary key default gen_random_uuid(),
  package_id   uuid not null references public.packages(id) on delete cascade,
  trigger_type public.email_trigger_type not null,
  sent_at      timestamptz not null default now(),

  -- only one email per trigger type per package
  unique (package_id, trigger_type)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.packages (coach_id);
create index on public.packages (client_id);
create index on public.packages (status);
create index on public.workout_sessions (package_id);
create index on public.workout_sessions (coach_id);
create index on public.workout_sessions (client_id);
create index on public.workout_sessions (session_date);
create index on public.email_logs (package_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- AUTO-INCREMENT sessions_used WHEN A SESSION IS LOGGED
-- ============================================================

create or replace function public.increment_sessions_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.packages
  set sessions_used = sessions_used + 1
  where id = new.package_id;
  return new;
end;
$$;

create trigger on_workout_session_created
  after insert on public.workout_sessions
  for each row execute procedure public.increment_sessions_used();

-- When a workout session is deleted, roll back the counter
create or replace function public.decrement_sessions_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.packages
  set sessions_used = greatest(0, sessions_used - 1)
  where id = old.package_id;
  return old;
end;
$$;

create trigger on_workout_session_deleted
  after delete on public.workout_sessions
  for each row execute procedure public.decrement_sessions_used();

-- Auto-expire packages when sessions_used reaches total_sessions
create or replace function public.auto_expire_package()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sessions_used >= new.total_sessions then
    new.status := 'expired';
  end if;
  return new;
end;
$$;

create trigger on_package_updated
  before update on public.packages
  for each row execute procedure public.auto_expire_package();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.packages        enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.email_logs      enable row level security;

-- Helper: returns the role of the currently authenticated user
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── profiles ────────────────────────────────────────────────

-- Users can always read and update their own profile
create policy "profiles: own row"
  on public.profiles
  for all
  using (id = auth.uid());

-- Coaches can read profiles of their own clients
create policy "profiles: coach reads own clients"
  on public.profiles
  for select
  using (
    public.current_user_role() = 'coach'
    and exists (
      select 1 from public.packages p
      where p.client_id = profiles.id
        and p.coach_id  = auth.uid()
    )
  );

-- ── packages ────────────────────────────────────────────────

-- Coaches can fully manage packages they created
create policy "packages: coach full access"
  on public.packages
  for all
  using  (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Clients can read their own packages
create policy "packages: client read own"
  on public.packages
  for select
  using (client_id = auth.uid());

-- ── workout_sessions ────────────────────────────────────────

-- Coaches can manage sessions they created, but only for packages they own.
-- The with check prevents a coach from logging sessions on another coach's
-- client or package even if they supply their own coach_id.
create policy "workout_sessions: coach full access"
  on public.workout_sessions
  for all
  using  (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.packages p
      where p.id       = package_id
        and p.coach_id = auth.uid()
    )
  );

-- Clients can read their own sessions
create policy "workout_sessions: client read own"
  on public.workout_sessions
  for select
  using (client_id = auth.uid());

-- ── email_logs ──────────────────────────────────────────────

-- Coaches can read & insert email logs for their packages
create policy "email_logs: coach access"
  on public.email_logs
  for all
  using (
    exists (
      select 1 from public.packages p
      where p.id       = email_logs.package_id
        and p.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.packages p
      where p.id       = email_logs.package_id
        and p.coach_id = auth.uid()
    )
  );
