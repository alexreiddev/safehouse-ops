-- GPS accuracy on squad positions (used for fair tagging at short ranges)
alter table locs add column if not exists acc float8;

-- new entry point with accuracy (old 3-arg update_pos stays for older clients)
create or replace function update_pos_acc(p_player uuid,p_lat float8,p_lng float8,p_acc float8) returns void
language plpgsql security definer set search_path=public as $$
declare o locs%rowtype; p players%rowtype; l lobbies%rowtype; v_d float8:=0; v_h timestamptz; v_r float8; begin
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
 v_r:=(l.config->>'radius')::float8*power(.75,floor(extract(epoch from now()-v_h)/600));
 if dist_m(p_lat,p_lng,(l.config->>'zone_lat')::float8,(l.config->>'zone_lng')::float8)<=v_r then
  if p.out_since is not null then update players set out_since=null where id=p.id; end if; return; end if;
 if p.out_since is null then update players set out_since=now() where id=p.id; return; end if;
 if now()-p.out_since<interval '30 seconds' then return; end if;
 update players set status='out',role='hunter',out_since=null where id=p.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(p.lobby_id,null,p.id,p_lat,p_lng);
 if not exists(select 1 from players where lobby_id=p.lobby_id and role='shadow' and status='alive')
  then update lobbies set status='finished' where id=p.lobby_id; end if;
end$$;
revoke all on function update_pos_acc(uuid,float8,float8,float8) from public, anon;
grant execute on function update_pos_acc(uuid,float8,float8,float8) to authenticated;

-- Adaptive pings: the closer the nearest hunter, the more often a shadow is revealed.
--   hunter <=50 m: every 15 s · <=150 m: 30 s · <=300 m: 60 s (or base if shorter) · else: base interval
-- Client calls this every 10 s; the server decides whether a ping is due.
create or replace function ping_tick(p_player uuid) returns json
language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; s locs%rowtype; v_base int; v_near float8; v_every int; v_last timestamptz; v_ping boolean:=false; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then return null; end if;
 if p.role<>'shadow' or p.status<>'alive' then return json_build_object('pinged',false); end if;
 select * into l from lobbies where id=p.lobby_id;
 if l.status not in ('hiding','hunting') or now()<l.started_at+((l.config->>'hide_time')::int*interval '1 minute') then return json_build_object('pinged',false); end if;
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
revoke all on function ping_tick(uuid) from public, anon;
grant execute on function ping_tick(uuid) to authenticated;

-- Fair tagging: tolerance follows the two phones' GPS accuracy (3-15 m), positions must be fresh (<20 s).
create or replace function verify_catch(p_shadow uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare h players%rowtype; s players%rowtype; l lobbies%rowtype; hl locs%rowtype; sl locs%rowtype; v_tol float8; begin
 select * into s from players where id=p_shadow and role='shadow' and status='alive' for update; if not found then return false; end if;
 select * into h from players where lobby_id=s.lobby_id and user_id=auth.uid() and role='hunter'; if not found then return false; end if;
 select * into l from lobbies where id=s.lobby_id;
 if l.status not in ('hiding','hunting') or now()<l.started_at+((l.config->>'hide_time')::int*interval '1 minute') then return false; end if;
 select * into hl from locs where player_id=h.id; select * into sl from locs where player_id=s.id;
 if hl.player_id is null or sl.player_id is null or hl.updated_at<now()-interval '20 seconds' or sl.updated_at<now()-interval '20 seconds' then return false; end if;
 v_tol:=least(15,greatest(3,coalesce((hl.acc+sl.acc)/2,10)));
 if dist_m(hl.lat,hl.lng,sl.lat,sl.lng)>(l.config->>'catch_radius')::float8+v_tol then return false; end if;
 update players set status='caught',role='hunter',out_since=null where id=s.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(s.lobby_id,h.id,s.id,sl.lat,sl.lng);
 if not exists(select 1 from players where lobby_id=s.lobby_id and role='shadow' and status='alive') then update lobbies set status='finished' where id=s.lobby_id; end if;
 return true; end$$;

-- Home radar: nearby active drops as coarse blips (distance to 25 m, bearing to 15 deg) and a count of
-- other agents active within 2 km in the last 10 min (count only, never positions). Also logs movement.
create or replace function radar_scan(p_lat float8,p_lng float8) returns json
language plpgsql security definer set search_path=public as $$
declare v_drops json; v_agents int; begin
 if not exists(select 1 from agents where id=auth.uid()) then return null; end if;
 perform _track(auth.uid(),p_lat,p_lng);
 select coalesce(json_agg(x order by x.dist),'[]') into v_drops from (
  select d.id,(round(dist_m(d.lat,d.lng,p_lat,p_lng)/25)*25)::int dist,(mod((round(bearing_deg(p_lat,p_lng,d.lat,d.lng)/15)*15)::int,360)) brg
  from drops d where d.active and dist_m(d.lat,d.lng,p_lat,p_lng)<=3000
   and not exists(select 1 from drop_runs r where r.drop_id=d.id and r.agent_id=auth.uid() and r.status='secured' and r.finished_at>now()-interval '24 hours')
  order by 2 limit 20) x;
 select count(*) into v_agents from agent_pos a where a.agent_id<>auth.uid() and a.at>now()-interval '10 minutes' and dist_m(a.lat,a.lng,p_lat,p_lng)<=2000;
 return json_build_object('drops',v_drops,'agents',v_agents);
end$$;
revoke all on function radar_scan(float8,float8) from public, anon;
grant execute on function radar_scan(float8,float8) to authenticated;
