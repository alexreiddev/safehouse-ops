-- SAFEHOUSE multi-region schema. Every player-facing table carries region_slug.
-- Exported from the live database's migration history (applied 31 Oct 2026); not yet used by this app's code.

create table public.sh_regions (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  pack jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table public.sh_admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table public.sh_nodes (
  id text not null,
  region_slug text not null references public.sh_regions on delete cascade,
  chapter_id text not null,
  secret text not null,
  host_name text,
  last_service date,
  primary key (region_slug, id)
);

create table public.sh_players (
  id uuid not null references auth.users on delete cascade,
  region_slug text not null references public.sh_regions on delete cascade,
  agent_id text not null check (agent_id ~ '^[A-Z2-9]{4}$'),
  team_id uuid,
  created_at timestamptz not null default now(),
  primary key (id, region_slug),
  unique (region_slug, agent_id)
);

create table public.sh_teams (
  id uuid primary key default gen_random_uuid(),
  region_slug text not null references public.sh_regions on delete cascade,
  name text not null,
  mode text not null default 'team' check (mode in ('solo', 'team')),
  created_at timestamptz not null default now()
);

create table public.sh_progress (
  player_id uuid not null references auth.users on delete cascade,
  region_slug text not null references public.sh_regions on delete cascade,
  chapter_id text not null,
  task_id text not null,
  task_type text not null,
  value text,
  verified boolean not null default true,
  completed_at timestamptz not null default now(),
  primary key (player_id, task_id)
);

create table public.sh_node_claims (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users on delete cascade,
  region_slug text not null,
  node_id text not null,
  code text not null,
  claimed_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  flagged boolean not null default false,
  unique (player_id, region_slug, node_id),
  foreign key (region_slug, node_id) references public.sh_nodes (region_slug, id) on delete cascade
);

create table public.sh_interviews (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users on delete cascade,
  region_slug text not null references public.sh_regions on delete cascade,
  chapter_id text not null,
  task_id text not null,
  storyteller text,
  consent_given boolean not null check (consent_given),
  media_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.sh_is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.sh_admins where user_id = auth.uid()) $$;

alter table public.sh_regions enable row level security;
alter table public.sh_admins enable row level security;
alter table public.sh_nodes enable row level security;
alter table public.sh_players enable row level security;
alter table public.sh_teams enable row level security;
alter table public.sh_progress enable row level security;
alter table public.sh_node_claims enable row level security;
alter table public.sh_interviews enable row level security;

create policy "live regions are public, drafts for admins" on public.sh_regions
  for select using (status = 'live' or public.sh_is_admin());
create policy "admins manage regions" on public.sh_regions
  for all using (public.sh_is_admin()) with check (public.sh_is_admin());

create policy "sh own player rows" on public.sh_players
  for select using (id = auth.uid());
create policy "register self" on public.sh_players
  for insert with check (id = auth.uid());

create policy "teams readable in region" on public.sh_teams for select using (true);

create policy "own progress" on public.sh_progress
  for select using (player_id = auth.uid());
create policy "write own progress" on public.sh_progress
  for insert with check (player_id = auth.uid() and task_type <> 'relay');
create policy "update own progress" on public.sh_progress
  for update using (player_id = auth.uid()) with check (player_id = auth.uid() and task_type <> 'relay');

create policy "own claims" on public.sh_node_claims
  for select using (player_id = auth.uid());

create policy "submit own interviews" on public.sh_interviews
  for insert with check (player_id = auth.uid());
create policy "own or approved interviews" on public.sh_interviews
  for select using (player_id = auth.uid() or status = 'approved' or public.sh_is_admin());
create policy "admins review interviews" on public.sh_interviews
  for update using (public.sh_is_admin());

create or replace function public.sh_leaderboard(p_region text)
returns table (agent_id text, score bigint)
language sql stable security definer set search_path = public
as $$
  with pts as (
    select player_id,
      sum(case task_type when 'interview' then 30 when 'puzzle' then 20 else 10 end) as p
    from public.sh_progress where region_slug = p_region group by player_id
    union all
    select player_id, count(*) * 50 from public.sh_node_claims
    where region_slug = p_region and not flagged group by player_id
  )
  select pl.agent_id, sum(pts.p)::bigint as score
  from pts join public.sh_players pl on pl.id = pts.player_id and pl.region_slug = p_region
  group by pl.agent_id
  order by score desc
  limit 50
$$;
grant execute on function public.sh_leaderboard(text) to anon, authenticated;

insert into storage.buckets (id, name, public) values ('sh-interviews', 'sh-interviews', false)
  on conflict (id) do nothing;
create policy "sh upload own interview media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sh-interviews' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "sh read own interview media" on storage.objects
  for select to authenticated
  using (bucket_id = 'sh-interviews' and ((storage.foldername(name))[2] = auth.uid()::text or public.sh_is_admin()));
