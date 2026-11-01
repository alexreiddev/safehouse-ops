-- Safehouse v0.1 schema
create extension if not exists pgcrypto;

-- ───────── core: agents & tracking ─────────
create table agents(
 id uuid primary key references auth.users on delete cascade,
 callsign text unique not null check (callsign ~ '^[A-Za-z0-9_-]{3,16}$'),
 district text not null check (district in ('Ernakulam','Idukki')),
 adult_confirmed_at timestamptz not null,   -- DOB is checked at signup and never stored
 consent_at timestamptz not null,
 xp int not null default 0, meters float8 not null default 0, active_sec int not null default 0, ops int not null default 0,
 is_admin boolean not null default false, created_at timestamptz default now());
create table agent_pos(agent_id uuid primary key references agents on delete cascade,lat float8,lng float8,at timestamptz);  -- private
create table xp_events(id bigserial primary key,agent_id uuid references agents on delete cascade,kind text,amount int,created_at timestamptz default now());
create index on xp_events(created_at);

-- ───────── dead drop ─────────
create table drops(id uuid primary key default gen_random_uuid(),name text not null,hint text,lat float8 not null,lng float8 not null,
 district text not null check (district in ('Ernakulam','Idukki')),active boolean not null default false,created_at timestamptz default now());
create table drop_runs(id uuid primary key default gen_random_uuid(),agent_id uuid not null references agents on delete cascade,drop_id uuid references drops,
 codename text,started_at timestamptz default now(),deadline timestamptz not null,status text not null default 'active',
 start_dist float8,meters_start float8,zone_lat float8,zone_lng float8,zone_r float8,finished_at timestamptz,xp int default 0);

-- ───────── shadowhunt (squad) ─────────
create table lobbies(id uuid primary key default gen_random_uuid(),code text unique not null,host_id uuid not null references agents,
 status text not null default 'waiting',config jsonb not null,shrink_step int not null default 0,started_at timestamptz,created_at timestamptz default now());
create table players(id uuid primary key default gen_random_uuid(),lobby_id uuid not null references lobbies on delete cascade,user_id uuid not null references agents,
 name text not null default '',role text not null default 'shadow',status text not null default 'alive',is_host boolean default false,
 awarded boolean not null default false,joined_at timestamptz default now(),unique(lobby_id,user_id));
create table locs(player_id uuid primary key references players on delete cascade,lat float8,lng float8,total_distance float8 not null default 0,updated_at timestamptz default now()); -- private
create table pings(id bigserial primary key,lobby_id uuid references lobbies on delete cascade,player_id uuid references players on delete cascade,lat float8,lng float8,created_at timestamptz default now()); -- private
create table catches(id bigserial primary key,lobby_id uuid references lobbies on delete cascade,hunter_id uuid references players,shadow_id uuid references players,lat float8,lng float8,created_at timestamptz default now());

-- ───────── RLS ─────────
alter table agents enable row level security; alter table agent_pos enable row level security; alter table xp_events enable row level security;
alter table drops enable row level security; alter table drop_runs enable row level security;
alter table lobbies enable row level security; alter table players enable row level security; alter table locs enable row level security;
alter table pings enable row level security; alter table catches enable row level security;

create function is_admin() returns boolean language sql stable security definer set search_path=public as
 $$ select coalesce((select is_admin from agents where id=auth.uid()),false) $$;

create policy a_sel on agents for select to authenticated using(id=auth.uid());
create policy x_sel on xp_events for select to authenticated using(agent_id=auth.uid());
create policy d_all on drops for all to authenticated using(is_admin()) with check(is_admin());   -- coordinates hidden from players
create policy r_sel on drop_runs for select to authenticated using(agent_id=auth.uid());
create policy l_sel on lobbies for select to authenticated using(true);
create policy l_ins on lobbies for insert to authenticated with check(host_id=auth.uid());
create policy l_upd on lobbies for update to authenticated using(host_id=auth.uid());
create policy p_sel on players for select to authenticated using(true);
create policy p_ins on players for insert to authenticated with check(user_id=auth.uid());
create policy p_upd on players for update to authenticated using(exists(select 1 from lobbies l where l.id=lobby_id and l.host_id=auth.uid()));
create policy c_sel on catches for select to authenticated using(true);

create function player_defaults() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if (select count(*) from players where lobby_id=new.lobby_id)>=10 then raise exception 'Squad is full (10 agents max).'; end if;
 select callsign into new.name from agents where id=new.user_id; return new; end$$;
create trigger t_player before insert on players for each row execute function player_defaults();

-- ───────── helpers ─────────
create function dist_m(a1 float8,o1 float8,a2 float8,o2 float8) returns float8 language sql immutable as $$
 select 12742000*asin(sqrt(power(sin(radians(a2-a1)/2),2)+cos(radians(a1))*cos(radians(a2))*power(sin(radians(o2-o1)/2),2)))$$;
create function bearing_deg(a1 float8,o1 float8,a2 float8,o2 float8) returns float8 language sql immutable as $$
 select mod((degrees(atan2(sin(radians(o2-o1))*cos(radians(a2)),cos(radians(a1))*sin(radians(a2))-sin(radians(a1))*cos(radians(a2))*cos(radians(o2-o1))))+360)::numeric,360)::float8$$;

-- distance + active time: counts on-foot movement only (≤ 7 m/s ≈ 25 km/h), ignores GPS jitter < 3 m
create function _track(p_agent uuid,p_lat float8,p_lng float8) returns void language plpgsql security definer set search_path=public as $$
declare o agent_pos%rowtype; v_d float8; v_dt float8; v_v float8; begin
 select * into o from agent_pos where agent_id=p_agent;
 if found then
  v_d:=dist_m(o.lat,o.lng,p_lat,p_lng); v_dt:=extract(epoch from now()-o.at);
  if v_d<3 and v_dt<120 then return; end if;
  if v_dt between 1 and 120 then v_v:=v_d/v_dt;
   if v_v<=7 then update agents set meters=meters+v_d,active_sec=active_sec+case when v_v>=0.4 then v_dt::int else 0 end where id=p_agent; end if;
  end if;
 end if;
 insert into agent_pos values(p_agent,p_lat,p_lng,now()) on conflict(agent_id) do update set lat=excluded.lat,lng=excluded.lng,at=excluded.at;
end$$;
create function _award(p_agent uuid,p_kind text,p_amt int) returns void language sql security definer set search_path=public as $$
 insert into xp_events(agent_id,kind,amount) values(p_agent,p_kind,p_amt);
 update agents set xp=xp+p_amt,ops=ops+1 where id=p_agent;$$;

-- ───────── signup ─────────
create function register_agent(p_callsign text,p_dob date,p_district text) returns void language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'Not signed in.'; end if;
 if p_dob is null or p_dob>(current_date-interval '18 years')::date then raise exception 'Safehouse is for agents aged 18 and over.'; end if;
 if p_callsign !~ '^[A-Za-z0-9_-]{3,16}$' then raise exception 'Callsign must be 3–16 letters, numbers, _ or -.'; end if;
 begin insert into agents(id,callsign,district,adult_confirmed_at,consent_at) values(auth.uid(),upper(p_callsign),p_district,now(),now());
 exception when unique_violation then raise exception 'That callsign is taken. Try another.'; end;
end$$;
create function track(p_lat float8,p_lng float8) returns void language sql security definer set search_path=public as $$ select _track(auth.uid(),p_lat,p_lng) $$;

-- ───────── dead drop functions ─────────
create function start_drop(p_lat float8,p_lng float8,p_min float8,p_max float8) returns json language plpgsql security definer set search_path=public as $$
declare a agents%rowtype; d drops%rowtype; r drop_runs%rowtype; v_dd float8; v_zr float8; v_off float8; v_t float8; begin
 select * into a from agents where id=auth.uid(); if not found then raise exception 'Create your agent first.'; end if;
 update drop_runs set status='abandoned',finished_at=now() where agent_id=a.id and status='active';
 perform _track(a.id,p_lat,p_lng);
 select * into d from drops where active and dist_m(lat,lng,p_lat,p_lng) between p_min and p_max order by random() limit 1;
 if not found then return null; end if;
 v_dd:=dist_m(d.lat,d.lng,p_lat,p_lng);
 v_zr:=least(400,greatest(120,v_dd*0.35)); v_off:=random()*v_zr*0.6; v_t:=random()*2*pi();
 insert into drop_runs(agent_id,drop_id,codename,deadline,start_dist,meters_start,zone_lat,zone_lng,zone_r)
 values(a.id,d.id,
  (array['MONSOON','IRON','SILENT','COBALT','EMBER','JADE','VELVET','PEPPER','TEAK','SALT','ONYX','AMBER'])[1+floor(random()*12)::int]||' '||
  (array['HERON','LANTERN','TIDE','ORCHID','FALCON','CEDAR','CIPHER','KITE','TUSK','MONGOOSE','DRONGO','KESTREL'])[1+floor(random()*12)::int],
  now()+make_interval(secs=>greatest(600,ceil(v_dd/1.2*1.6)+180)),v_dd,a.meters,
  d.lat+v_off*cos(v_t)/111320,d.lng+v_off*sin(v_t)/(111320*cos(radians(d.lat))),v_zr) returning * into r;
 return json_build_object('run_id',r.id,'codename',r.codename,'deadline',r.deadline,'distance',round(v_dd),'zone_lat',r.zone_lat,'zone_lng',r.zone_lng,'zone_r',r.zone_r);
end$$;

create function drop_ping(p_run uuid,p_lat float8,p_lng float8) returns json language plpgsql security definer set search_path=public as $$
declare r drop_runs%rowtype; d drops%rowtype; v_dd float8; begin
 select * into r from drop_runs where id=p_run and agent_id=auth.uid(); if not found then return json_build_object('status','missing'); end if;
 perform _track(auth.uid(),p_lat,p_lng);
 if r.status='active' and now()>r.deadline then update drop_runs set status='failed',finished_at=now() where id=r.id; r.status:='failed'; end if;
 select * into d from drops where id=r.drop_id; v_dd:=dist_m(p_lat,p_lng,d.lat,d.lng);
 return json_build_object('status',r.status,'distance',round(v_dd),'bearing',round(bearing_deg(p_lat,p_lng,d.lat,d.lng)),'hint',case when v_dd<200 then d.hint end);
end$$;

create function complete_drop(p_run uuid) returns json language plpgsql security definer set search_path=public as $$
declare r drop_runs%rowtype; d drops%rowtype; p agent_pos%rowtype; v_xp int; v_m float8; begin
 select * into r from drop_runs where id=p_run and agent_id=auth.uid() and status='active' for update;
 if not found then return json_build_object('ok',false,'reason','This op is no longer active.'); end if;
 if now()>r.deadline then update drop_runs set status='failed',finished_at=now() where id=r.id; return json_build_object('ok',false,'reason','Time ran out.'); end if;
 select * into p from agent_pos where agent_id=auth.uid();
 if not found or p.at<now()-interval '30 seconds' then return json_build_object('ok',false,'reason','No recent GPS fix. Hold still in the open for a few seconds and try again.'); end if;
 select * into d from drops where id=r.drop_id;
 if dist_m(p.lat,p.lng,d.lat,d.lng)>35 then return json_build_object('ok',false,'reason','Not close enough. Get within 25 m of the drop.'); end if;
 v_xp:=60+round(r.start_dist/20)::int+least(60,floor(extract(epoch from r.deadline-now())/30))::int;
 update drop_runs set status='secured',finished_at=now(),xp=v_xp where id=r.id;
 perform _award(auth.uid(),'drop',v_xp);
 select meters-r.meters_start into v_m from agents where id=auth.uid();
 return json_build_object('ok',true,'xp',v_xp,'meters',round(v_m),'seconds',round(extract(epoch from now()-r.started_at)));
end$$;

create function abort_drop(p_run uuid) returns void language sql security definer set search_path=public as $$
 update drop_runs set status='abandoned',finished_at=now() where id=p_run and agent_id=auth.uid() and status='active'$$;

-- ───────── shadowhunt functions ─────────
create function update_pos(p_player uuid,p_lat float8,p_lng float8) returns void language plpgsql security definer set search_path=public as $$
declare o locs%rowtype; v_d float8:=0; begin
 if not exists(select 1 from players where id=p_player and user_id=auth.uid()) then raise exception 'Not your agent.'; end if;
 perform _track(auth.uid(),p_lat,p_lng);
 select * into o from locs where player_id=p_player;
 if found then v_d:=dist_m(o.lat,o.lng,p_lat,p_lng); if v_d>100 or v_d<3 then v_d:=0; end if; end if;
 insert into locs(player_id,lat,lng) values(p_player,p_lat,p_lng)
  on conflict(player_id) do update set lat=excluded.lat,lng=excluded.lng,total_distance=locs.total_distance+v_d,updated_at=now();
end$$;

create function ping_now(p_player uuid) returns void language sql security definer set search_path=public as $$
 insert into pings(lobby_id,player_id,lat,lng) select p.lobby_id,p.id,s.lat,s.lng from players p join locs s on s.player_id=p.id
 where p.id=p_player and p.user_id=auth.uid() and p.role='shadow' and p.status='alive'$$;

-- hunters: latest fresh ping per live shadow. everyone: live position of anyone outside the shrinking zone
create function get_visible_pings(p_lobby uuid) returns table(pid uuid,pname text,plat float8,plng float8,pat timestamptz,plive boolean)
language plpgsql security definer set search_path=public as $$
declare me players%rowtype; l lobbies%rowtype; v_r float8; begin
 select * into me from players where lobby_id=p_lobby and user_id=auth.uid(); if not found then return; end if;
 select * into l from lobbies where id=p_lobby; v_r:=(l.config->>'radius')::float8*power(.75,l.shrink_step);
 return query
  select p.id,p.name,x.lat,x.lng,x.created_at,false from players p
   join lateral(select * from pings g where g.player_id=p.id order by g.created_at desc limit 1) x on true
   where me.role='hunter' and p.lobby_id=p_lobby and p.role='shadow' and p.status='alive'
    and x.created_at>now()-(((l.config->>'ping_interval')::int*60+30)*interval '1 second')
  union all
  select p.id,p.name,s.lat,s.lng,s.updated_at,true from players p join locs s on s.player_id=p.id
   where l.status='hunting' and p.lobby_id=p_lobby and p.id<>me.id and s.updated_at>now()-interval '30 seconds'
    and dist_m(s.lat,s.lng,(l.config->>'zone_lat')::float8,(l.config->>'zone_lng')::float8)>v_r;
end$$;

create function verify_catch(p_shadow uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare h players%rowtype; s players%rowtype; l lobbies%rowtype; hl locs%rowtype; sl locs%rowtype; begin
 select * into s from players where id=p_shadow and role='shadow' and status='alive' for update; if not found then return false; end if;
 select * into h from players where lobby_id=s.lobby_id and user_id=auth.uid() and role='hunter'; if not found then return false; end if;
 select * into l from lobbies where id=s.lobby_id; if l.status<>'hunting' then return false; end if;
 select * into hl from locs where player_id=h.id; select * into sl from locs where player_id=s.id;
 if hl.player_id is null or sl.player_id is null then return false; end if;
 if dist_m(hl.lat,hl.lng,sl.lat,sl.lng)>(l.config->>'catch_radius')::float8+20 then return false; end if;
 update players set status='caught',role='hunter' where id=s.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(s.lobby_id,h.id,s.id,sl.lat,sl.lng);
 if not exists(select 1 from players where lobby_id=s.lobby_id and role='shadow' and status='alive') then update lobbies set status='finished' where id=s.lobby_id; end if;
 return true; end$$;

create function get_stats(p_lobby uuid) returns table(pname text,prole text,pdist float8) language sql security definer set search_path=public as $$
 select p.name,p.role,coalesce(s.total_distance,0) from players p left join locs s on s.player_id=p.id
 where p.lobby_id=p_lobby and exists(select 1 from lobbies where id=p_lobby and status='finished')
  and exists(select 1 from players where lobby_id=p_lobby and user_id=auth.uid())$$;

-- XP once per agent per finished op; ops shorter than hide time + 3 min earn nothing (anti-farming)
create function award_hunt(p_lobby uuid) returns int language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; v_sw boolean; v_c int; v_xp int; begin
 select * into l from lobbies where id=p_lobby; if not found or l.status<>'finished' then return 0; end if;
 select * into p from players where lobby_id=p_lobby and user_id=auth.uid() and not awarded for update; if not found then return 0; end if;
 update players set awarded=true where id=p.id;
 if now()<l.started_at+(((l.config->>'hide_time')::int+3)*interval '1 minute') then return 0; end if;
 v_sw:=exists(select 1 from players where lobby_id=p_lobby and role='shadow' and status='alive');
 select count(*) into v_c from catches where lobby_id=p_lobby and hunter_id=p.id;
 v_xp:=30+40*v_c+case when p.role='shadow' and p.status='alive' then 150 when not v_sw and p.status='alive' then 100 when not v_sw then 40 else 0 end;
 perform _award(auth.uid(),'hunt',v_xp); return v_xp; end$$;

-- ───────── leaderboard (week starts Monday, IST) ─────────
create function leaderboard(p_district text,p_week boolean) returns table(callsign text,district text,xp int,total_xp int)
language sql stable security definer set search_path=public as $$
 select a.callsign,a.district,
  case when p_week then coalesce(sum(e.amount),0)::int else a.xp end, a.xp
 from agents a left join xp_events e on e.agent_id=a.id and e.created_at>=(date_trunc('week',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
 where p_district is null or a.district=p_district
 group by a.id
 having (not p_week and a.xp>0) or (p_week and coalesce(sum(e.amount),0)>0)
 order by 3 desc, a.xp desc limit 50 $$;

-- ───────── grants ─────────
revoke execute on all functions in schema public from public, anon;
grant execute on function is_admin,register_agent,track,start_drop,drop_ping,complete_drop,abort_drop,update_pos,ping_now,get_visible_pings,verify_catch,get_stats,award_hunt,leaderboard to authenticated;
revoke execute on function _track,_award from authenticated;
alter publication supabase_realtime add table lobbies,players;
