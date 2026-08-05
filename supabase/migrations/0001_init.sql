-- On Air — initial schema
--
-- Demo mode runs against a JSON file (src/lib/store/demo-store.ts) so the whole
-- product works with no keys. This is the same shape in Postgres, for when a
-- real cohort exists.
--
-- The load-bearing constraint is age_band. Cohorts are single-band by
-- construction and membership is checked against the member's own band, so a
-- minor and an adult can never end up in one matching pool. That is a schema
-- guarantee rather than application logic on purpose — the lawsuit that ended
-- Omegle argued the matching itself was the defect.

create type age_band as enum ('under_18', 'adult');
create type level_band as enum ('beginner', 'intermediate', 'advanced');
create type session_status as enum ('live', 'ended', 'scored', 'abandoned');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  target_language text not null default 'en',
  level_band level_band not null,
  first_language text not null,
  age_band age_band not null,
  rules_accepted_at timestamptz,
  -- Falls on reports and abandonments. A low score routes someone into the
  -- shadow pool rather than triggering a ban.
  trust integer not null default 100 check (trust between 0 and 100),
  created_at timestamptz not null default now()
);

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  age_band age_band not null,
  created_at timestamptz not null default now()
);

create table cohort_members (
  cohort_id uuid not null references cohorts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (cohort_id, profile_id)
);

-- Enforced in the database, not just in the join action.
create or replace function assert_matching_age_band() returns trigger as $$
begin
  if (select age_band from cohorts where id = new.cohort_id)
     is distinct from
     (select age_band from profiles where id = new.profile_id) then
    raise exception 'age band mismatch: a profile may only join a cohort of its own age band';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger cohort_members_age_band
  before insert or update on cohort_members
  for each row execute function assert_matching_age_band();

create table sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts (id) on delete restrict,
  topic_id text not null,
  status session_status not null default 'live',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table session_participants (
  session_id uuid not null references sessions (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  level_band level_band not null,
  -- Each participant's OWN microphone, recorded locally. One speaker per file,
  -- so there is no diarization step and no attribution error.
  audio_key text,
  voiced_seconds numeric not null default 0,
  primary key (session_id, profile_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  -- Deterministic metrics computed in code: articulation rate, mean length of
  -- run, filler rate, pause distribution, talk share.
  metrics jsonb not null,
  -- Analytic trait scores plus the derived band.
  scores jsonb not null,
  corrections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create index reports_profile_created on reports (profile_id, created_at desc);
create index sessions_cohort_started on sessions (cohort_id, started_at desc);

alter table profiles enable row level security;
alter table cohorts enable row level security;
alter table cohort_members enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table reports enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own memberships" on cohort_members
  for select using (auth.uid() = profile_id);

-- A report belongs to one person. Your partner never sees your score, which is
-- also what makes collusion pointless.
create policy "own reports" on reports
  for select using (auth.uid() = profile_id);
