-- Enable Row Level Security (RLS)
-- We will enable RLS but create open policies for the "Shared Workspace" model initially.

-- 1. USERS (Synced via Supabase Auth Trigger usually, but simple table for metadata here)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. REQUISITIONS
create table public.requisitions (
  req_id text primary key, -- Use the actual string ID from ATS (e.g. "REQ-123")
  req_title text not null,
  recruiter_id text, -- ID string, might map to user_id or external ID
  hiring_manager_id text,
  status text, -- 'Open', 'Closed', etc.
  level text,
  function text,
  job_family text,
  business_unit text,
  location_region text,
  location_type text,
  opened_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz default now(),
  raw_data jsonb -- Store original CSV row for safety
);

alter table public.requisitions enable row level security;
-- Shared Workspace: Authenticated users (and anon for dev) can read/write everything
create policy "Users can view requisitions." on public.requisitions for select using (true);
create policy "Users can insert requisitions." on public.requisitions for insert with check (true);
create policy "Users can update requisitions." on public.requisitions for update using (true);
create policy "Users can delete requisitions." on public.requisitions for delete using (true);

-- 3. CANDIDATES
create table public.candidates (
  candidate_id text primary key, -- "CAND-XYZ"
  name text,
  req_id text references public.requisitions(req_id),
  current_stage text,
  applied_at timestamptz,
  first_contacted_at timestamptz,
  screened_at timestamptz,
  interview_scheduled_at timestamptz,
  interview_completed_at timestamptz,
  offer_extended_at timestamptz,
  offer_accepted_at timestamptz,
  offer_rejected_at timestamptz,
  hired_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  disposition text, -- 'In Process', 'Hired', 'Rejected', etc.
  updated_at timestamptz default now(),
  raw_data jsonb
);

alter table public.candidates enable row level security;
create policy "Users can view candidates." on public.candidates for select using (true);
create policy "Users can insert candidates." on public.candidates for insert with check (true);
create policy "Users can update candidates." on public.candidates for update using (true);
create policy "Users can delete candidates." on public.candidates for delete using (true);

-- 4. EVENTS
create table public.events (
  event_id uuid default gen_random_uuid() primary key,
  candidate_id text references public.candidates(candidate_id),
  req_id text references public.requisitions(req_id),
  event_type text not null, -- 'STAGE_CHANGE', 'INTERVIEW', etc.
  from_stage text,
  to_stage text,
  actor_user_id text,
  event_at timestamptz not null,
  metadata jsonb
);

alter table public.events enable row level security;
create policy "Users can view events." on public.events for select using (true);
create policy "Users can insert events." on public.events for insert with check (true);
create policy "Users can delete events." on public.events for delete using (true);

-- 5. SNAPSHOTS (History)
create table public.snapshots (
  id uuid default gen_random_uuid() primary key,
  period_start date,
  period_end date,
  metrics jsonb, -- JSON blob of calculations
  created_at timestamptz default now()
);

alter table public.snapshots enable row level security;
create policy "Users can view snapshots." on public.snapshots for select using (true);
create policy "Users can insert snapshots." on public.snapshots for insert with check (true);

-- 6. USERS (Domain Users like Recruiters/HMs, distinct from Auth Profiles)
create table public.users (
  user_id text primary key,
  name text,
  role text,
  team text,
  manager_user_id text,
  email text,
  updated_at timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can view users." on public.users for select using (true);
create policy "Users can insert users." on public.users for insert with check (true);
create policy "Users can update users." on public.users for update using (true);
create policy "Users can delete users." on public.users for delete using (true);


