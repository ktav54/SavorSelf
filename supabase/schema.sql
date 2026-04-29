create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  preferred_units text not null default 'imperial',
  onboarding_complete boolean not null default false,
  daily_calorie_goal numeric,
  daily_protein_goal numeric,
  daily_carbs_goal numeric,
  daily_fat_goal numeric,
  daily_water_goal numeric,
  timezone text
);

alter table public.users add column if not exists daily_carbs_goal numeric;
alter table public.users add column if not exists daily_fat_goal numeric;
alter table public.users add column if not exists coach_conversation jsonb;
alter table public.users add column if not exists onboarding_goal text;
alter table public.users add column if not exists onboarding_challenge text;

create table if not exists public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  mood_score integer not null check (mood_score between 1 and 5),
  energy_score integer not null check (energy_score between 1 and 5),
  physical_state text[] not null default '{}',
  mental_state text[] not null default '{}',
  notes text
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  food_source text not null check (food_source in ('usda', 'open_food_facts', 'ai_estimate', 'custom')),
  external_food_id text,
  quantity numeric not null,
  unit text not null check (unit in ('g', 'oz', 'ml', 'fl_oz', 'cup', 'serving', 'piece', 'tbsp', 'tsp')),
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  micronutrients jsonb not null default '{}'::jsonb,
  gut_health_tags text[] not null default '{}',
  pre_logged boolean not null default false
);

create table if not exists public.quick_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  water_oz numeric,
  caffeine_mg numeric,
  steps integer,
  sleep_hours numeric,
  exercise_minutes integer,
  exercise_type text
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt_used text,
  body text not null,
  is_grace_mode boolean not null default false
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  messages jsonb not null default '[]'::jsonb,
  conversation_summary text
);

create table if not exists public.food_mood_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  insight_type text not null,
  insight_body text not null,
  supporting_data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false
);

alter table public.users enable row level security;
alter table public.mood_logs enable row level security;
alter table public.food_logs enable row level security;
alter table public.quick_logs enable row level security;
alter table public.journal_entries enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.food_mood_insights enable row level security;

create policy "users can manage own profile" on public.users
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users can manage own mood logs" on public.mood_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own food logs" on public.food_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own quick logs" on public.quick_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own journal entries" on public.journal_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own ai conversations" on public.ai_conversations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own food mood insights" on public.food_mood_insights
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.food_logs drop constraint if exists food_logs_unit_check;
alter table public.food_logs
add constraint food_logs_unit_check
check (unit in ('g', 'oz', 'ml', 'fl_oz', 'cup', 'serving', 'piece', 'tbsp', 'tsp'));

alter table public.food_logs drop constraint if exists food_logs_food_source_check;
alter table public.food_logs
add constraint food_logs_food_source_check
check (food_source in ('usda', 'open_food_facts', 'ai_estimate', 'custom'));

alter table public.quick_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quick_logs'
      and policyname in (
        'users can manage own quick logs',
        'Users can manage their own quick logs'
      )
  ) then
    create policy "Users can manage their own quick logs"
      on public.quick_logs
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
