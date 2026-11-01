-- Safehouses: admin-placed truce spots for ShadowHunt. A shadow who reaches one inside the zone during the hunt
-- gets a truce (no pings, can't be tagged, zone rule paused) for that safehouse's truce_sec. Harder-to-reach
-- spots get longer truces. Each safehouse works once per shadow per game.
create table if not exists safehouses(id uuid primary key default gen_random_uuid(),name text not null,
 lat float8 not null,lng float8 not null,radius int not null default 25,truce_sec int not null default 120,
 district text,active boolean not null default false,created_at timestamptz default now());
alter table safehouses enable row level security;
create policy sh_sel on safehouses for select to authenticated using(active or is_admin());
create policy sh_adm on safehouses for all to authenticated using(is_admin()) with check(is_admin());

create table if not exists shelters(lobby_id uuid not null references lobbies on delete cascade,
 player_id uuid not null references players on delete cascade,safehouse_id uuid not null references safehouses on delete cascade,
 started_at timestamptz not null default now(),ends_at timestamptz not null,primary key(player_id,safehouse_id));
alter table shelters enable row level security;
create policy shel_sel on shelters for select to authenticated
 using(exists(select 1 from players p where p.lobby_id=shelters.lobby_id and p.user_id=auth.uid()));

create or replace function _truce_until(p_player uuid) returns timestamptz language sql stable security definer set search_path=public as
$$ select max(ends_at) from shelters where player_id=p_player and ends_at>now() $$;

create or replace function update_pos_acc(p_player uuid,p_lat float8,p_lng float8,p_acc float8) returns void
language plpgsql security definer set search_path=public as $$
declare o locs%rowtype; p players%rowtype; l lobbies%rowtype; sh safehouses%rowtype; v_d float8:=0; v_h timestamptz; v_r float8; v_zl float8; v_zg float8; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then raise exception 'Not your agent.'; end if;
 perform _track(auth.uid(),p_lat,p_lng);
 select * into o from locs where player_id=p_player;
 if found then v_d:=dist_m(o.lat,o.lng,p_lat,p_lng); if v_d>100 or v_d<3 then v_d:=0; end if; end if;
 insert into locs(player_id,lat,lng,acc) values(p_player,p_lat,p_lng,p_acc)
  on conflict(player_id) do update set lat=excluded.lat,lng=excluded.lng,acc=excluded.acc,total_distance=locs.total_distance+v_d,updated_at=now();
 if p.role<>'shadow' or p.status<>'alive' then return; end if;
 select * into l from lobbies where id=p.lobby_id for update;
 if l.status not in ('hiding','hunting') then return; end if;
 v_h:=l.started_at+((l.config->>'hide_time')::int*interval '1 minute');
 if now()<v_h or now()>v_h+((l.config->>'duration')::int*interval '1 minute') then return; end if;
 v_zl:=(l.config->>'zone_lat')::float8; v_zg:=(l.config->>'zone_lng')::float8;
 v_r:=(l.config->>'radius')::float8*power(.75,floor(extract(epoch from now()-v_h)/600));
 -- safehouse: start a truce on arrival (inside the current zone, not used before by this shadow)
 if _truce_until(p.id) is null then
  select s.* into sh from safehouses s where s.active and dist_m(s.lat,s.lng,p_lat,p_lng)<=s.radius and dist_m(s.lat,s.lng,v_zl,v_zg)<=v_r
   and not exists(select 1 from shelters x where x.player_id=p.id and x.safehouse_id=s.id) order by dist_m(s.lat,s.lng,p_lat,p_lng) limit 1;
  if found then insert into shelters(lobby_id,player_id,safehouse_id,ends_at) values(p.lobby_id,p.id,sh.id,now()+make_interval(secs=>sh.truce_sec)); end if;
 end if;
 if _truce_until(p.id) is not null then
  if p.out_since is not null then update players set out_since=null where id=p.id; end if; return; end if;
 if dist_m(p_lat,p_lng,v_zl,v_zg)<=v_r then
  if p.out_since is not null then update players set out_since=null where id=p.id; end if; return; end if;
 if p.out_since is null then update players set out_since=now() where id=p.id; return; end if;
 if now()-p.out_since<interval '30 seconds' then return; end if;
 update players set status='out',role='hunter',out_since=null where id=p.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(p.lobby_id,null,p.id,p_lat,p_lng);
 if not exists(select 1 from players where lobby_id=p.lobby_id and role='shadow' and status='alive')
  then update lobbies set status='finished' where id=p.lobby_id; end if;
end$$;

create or replace function ping_tick(p_player uuid) returns json
language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; s locs%rowtype; v_base int; v_near float8; v_every int; v_last timestamptz; v_ping boolean:=false; v_safe timestamptz; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then return null; end if;
 if p.role<>'shadow' or p.status<>'alive' then return json_build_object('pinged',false); end if;
 select * into l from lobbies where id=p.lobby_id;
 if l.status not in ('hiding','hunting') or now()<l.started_at+((l.config->>'hide_time')::int*interval '1 minute') then return json_build_object('pinged',false); end if;
 v_safe:=_truce_until(p.id);
 if v_safe is not null then return json_build_object('pinged',false,'safe_until',v_safe); end if;
 select * into s from locs where player_id=p.id; if not found then return json_build_object('pinged',false); end if;
 v_base:=(l.config->>'ping_interval')::int*60;
 select min(dist_m(s.lat,s.lng,h.lat,h.lng)) into v_near from players q join locs h on h.player_id=q.id
  where q.lobby_id=p.lobby_id and q.role='hunter' and h.updated_at>now()-interval '30 seconds';
 v_every:=case when v_near<=50 then 15 when v_near<=150 then 30 when v_near<=300 then least(v_base,60) else v_base end;
 select max(created_at) into v_last from pings where player_id=p.id;
 if v_last is null or now()-v_last>=make_interval(secs=>v_every-2) then
  insert into pings(lobby_id,player_id,lat,lng) values(p.lobby_id,p.id,s.lat,s.lng); v_ping:=true; v_last:=now(); end if;
 return json_build_object('pinged',v_ping,'every',v_every,'near',case when v_near is null then null else round(v_near) end,
  'next',greatest(0,round(extract(epoch from v_last+make_interval(secs=>v_every)-now()))));
end$$;

create or replace function verify_catch(p_shadow uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare h players%rowtype; s players%rowtype; l lobbies%rowtype; hl locs%rowtype; sl locs%rowtype; v_tol float8; begin
 select * into s from players where id=p_shadow and role='shadow' and status='alive' for update; if not found then return false; end if;
 select * into h from players where lobby_id=s.lobby_id and user_id=auth.uid() and role='hunter'; if not found then return false; end if;
 select * into l from lobbies where id=s.lobby_id;
 if l.status not in ('hiding','hunting') or now()<l.started_at+((l.config->>'hide_time')::int*interval '1 minute') then return false; end if;
 if _truce_until(s.id) is not null then return false; end if;
 select * into hl from locs where player_id=h.id; select * into sl from locs where player_id=s.id;
 if hl.player_id is null or sl.player_id is null or hl.updated_at<now()-interval '20 seconds' or sl.updated_at<now()-interval '20 seconds' then return false; end if;
 v_tol:=least(15,greatest(3,coalesce((hl.acc+sl.acc)/2,10)));
 if dist_m(hl.lat,hl.lng,sl.lat,sl.lng)>(l.config->>'catch_radius')::float8+v_tol then return false; end if;
 update players set status='caught',role='hunter',out_since=null where id=s.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(s.lobby_id,h.id,s.id,sl.lat,sl.lng);
 if not exists(select 1 from players where lobby_id=s.lobby_id and role='shadow' and status='alive') then update lobbies set status='finished' where id=s.lobby_id; end if;
 return true; end$$;
