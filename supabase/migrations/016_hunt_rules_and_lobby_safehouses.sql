-- 016: configurable ShadowHunt rules (Kallan = shadow, Police = hunter; DB values unchanged)
--  * config.shrink_every   minutes between zone shrinks (2-30, default 10)
--  * config.sh_cooldown    minutes before a Kallan can reuse the same safehouse (0 = once per game, default 0)
--  * config.caught_police  caught / out Kallan turn Police (default true) or just sit out
--  * config.public_sh      admin safehouses also count in this hunt (default true)
--  * per-hunt safehouses placed by the host (safehouses.lobby_id), each with its own truce length
--  * a Kallan in a safehouse is fully concealed: no pings, no live position, and other players can't see the shelter

-- extra config validation (alongside 015's config_valid): new keys are optional so old lobbies stay valid
alter table lobbies add constraint config_rules_valid check (
 (not config ? 'shrink_every' or _num_between(config,'shrink_every',2,30))
 and (not config ? 'sh_cooldown' or _num_between(config,'sh_cooldown',0,60))
 and (not config ? 'caught_police' or jsonb_typeof(config->'caught_police')='boolean')
 and (not config ? 'public_sh' or jsonb_typeof(config->'public_sh')='boolean'));

-- per-hunt safehouses
alter table safehouses add column if not exists lobby_id uuid references lobbies on delete cascade;
create index if not exists safehouses_lobby_idx on safehouses(lobby_id);
alter policy sh_sel on safehouses using(
 (lobby_id is null and (active or is_admin())) or (lobby_id is not null and _lobby_member(lobby_id)));

create or replace function hunt_sh_add(p_lobby uuid,p_name text,p_lat float8,p_lng float8,p_radius int,p_truce_sec int)
returns uuid language plpgsql security definer set search_path=public as $$
declare l lobbies%rowtype; v_id uuid; begin
 select * into l from lobbies where id=p_lobby and host_id=auth.uid() for update;
 if not found then raise exception 'Only the host can place safehouses.'; end if;
 if l.status<>'waiting' then raise exception 'Safehouses can only be changed before the op starts.'; end if;
 if (select count(*) from safehouses where lobby_id=p_lobby and active)>=12 then raise exception 'Up to 12 safehouses per hunt.'; end if;
 if p_lat is null or p_lng is null or dist_m(p_lat,p_lng,(l.config->>'zone_lat')::float8,(l.config->>'zone_lng')::float8)>(l.config->>'radius')::float8
  then raise exception 'Place the safehouse inside the zone.'; end if;
 insert into safehouses(name,lat,lng,radius,truce_sec,active,lobby_id)
 values(left(coalesce(nullif(trim(p_name),''),'Safehouse'),40),p_lat,p_lng,greatest(10,least(coalesce(p_radius,25),100)),
  greatest(30,least(coalesce(p_truce_sec,120),1800)),true,p_lobby) returning id into v_id;
 return v_id; end $$;

create or replace function hunt_sh_del(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 -- removal deactivates, so shelter history stays intact
 update safehouses s set active=false from lobbies l where s.id=p_id and s.lobby_id=l.id and l.host_id=auth.uid() and l.status='waiting';
end $$;

-- zone helpers
create or replace function _shrink_sec(c jsonb) returns float8 language sql immutable as
$$ select greatest(2,least(coalesce((c->>'shrink_every')::float8,10),30))*60 $$;
create or replace function _police(c jsonb) returns boolean language sql immutable as
$$ select coalesce((c->>'caught_police')::boolean,true) $$;

-- only your own shelters are visible (others can't tell who is hiding where)
alter policy shel_sel on shelters
 using(exists(select 1 from players p where p.id=shelters.player_id and p.user_id=auth.uid()));

create or replace function update_pos_acc(p_player uuid,p_lat float8,p_lng float8,p_acc float8) returns void
language plpgsql security definer set search_path=public as $$
declare o locs%rowtype; p players%rowtype; l lobbies%rowtype; sh safehouses%rowtype; v_d float8:=0; v_h timestamptz; v_r float8; v_zl float8; v_zg float8; v_cd int; begin
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
 v_r:=(l.config->>'radius')::float8*power(.75,floor(extract(epoch from now()-v_h)/_shrink_sec(l.config)));
 v_cd:=coalesce((l.config->>'sh_cooldown')::int,0);
 if _truce_until(p.id) is null then
  select s.* into sh from safehouses s where s.active
   and ((s.lobby_id is null and coalesce((l.config->>'public_sh')::boolean,true)) or s.lobby_id=l.id)
   and dist_m(s.lat,s.lng,p_lat,p_lng)<=s.radius and dist_m(s.lat,s.lng,v_zl,v_zg)<=v_r
   and not exists(select 1 from shelters x where x.player_id=p.id and x.safehouse_id=s.id
    and (v_cd=0 or x.ends_at>now()-make_interval(mins=>v_cd)))
   order by dist_m(s.lat,s.lng,p_lat,p_lng) limit 1;
  if found then insert into shelters(lobby_id,player_id,safehouse_id,ends_at) values(p.lobby_id,p.id,sh.id,now()+make_interval(secs=>sh.truce_sec)); end if;
 end if;
 if _truce_until(p.id) is not null then
  if p.out_since is not null then update players set out_since=null where id=p.id; end if; return; end if;
 if dist_m(p_lat,p_lng,v_zl,v_zg)<=v_r then
  if p.out_since is not null then update players set out_since=null where id=p.id; end if; return; end if;
 if p.out_since is null then update players set out_since=now() where id=p.id; return; end if;
 if now()-p.out_since<interval '30 seconds' then return; end if;
 update players set status='out',role=case when _police(l.config) then 'hunter' else role end,out_since=null where id=p.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(p.lobby_id,null,p.id,p_lat,p_lng);
 if not exists(select 1 from players where lobby_id=p.lobby_id and role='shadow' and status='alive')
  then update lobbies set status='finished' where id=p.lobby_id; end if;
end $$;

-- legacy entry point: same rules
create or replace function update_pos(p_player uuid,p_lat float8,p_lng float8) returns void
language sql security definer set search_path=public as $$ select update_pos_acc(p_player,p_lat,p_lng,null) $$;

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
 update players set status='caught',role=case when _police(l.config) then 'hunter' else role end,out_since=null where id=s.id;
 insert into catches(lobby_id,hunter_id,shadow_id,lat,lng) values(s.lobby_id,h.id,s.id,sl.lat,sl.lng);
 if not exists(select 1 from players where lobby_id=s.lobby_id and role='shadow' and status='alive') then update lobbies set status='finished' where id=s.lobby_id; end if;
 return true; end $$;

-- a Kallan under truce is invisible: no last ping, no live out-of-zone position
create or replace function get_visible_pings(p_lobby uuid)
returns table(pid uuid,pname text,plat float8,plng float8,pat timestamptz,plive boolean)
language plpgsql security definer set search_path=public as $$
declare me players%rowtype; l lobbies%rowtype; v_r float8; begin
 select * into me from players where lobby_id=p_lobby and user_id=auth.uid(); if not found then return; end if;
 select * into l from lobbies where id=p_lobby; v_r:=(l.config->>'radius')::float8*power(.75,l.shrink_step);
 return query
  select p.id,p.name,x.lat,x.lng,x.created_at,false from players p
   join lateral(select * from pings g where g.player_id=p.id order by g.created_at desc limit 1) x on true
   where me.role='hunter' and p.lobby_id=p_lobby and p.role='shadow' and p.status='alive' and _truce_until(p.id) is null
    and x.created_at>now()-(((l.config->>'ping_interval')::int*60+30)*interval '1 second')
  union all
  select p.id,p.name,s.lat,s.lng,s.updated_at,true from players p join locs s on s.player_id=p.id
   where l.status='hunting' and p.lobby_id=p_lobby and p.id<>me.id and s.updated_at>now()-interval '30 seconds'
    and _truce_until(p.id) is null
    and dist_m(s.lat,s.lng,(l.config->>'zone_lat')::float8,(l.config->>'zone_lng')::float8)>v_r;
end $$;

create or replace function game_tick(p_player uuid,p_lat float8 default null,p_lng float8 default null,p_acc float8 default null)
returns json language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; v_h timestamptz; v_end timestamptz; v_st text; v_step int; v_ping json; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then return json_build_object('gone',true); end if;
 select * into l from lobbies where id=p.lobby_id; if not found then return json_build_object('gone',true); end if;
 if l.status in ('hiding','hunting') then
  v_h:=l.started_at+((l.config->>'hide_time')::int*interval '1 minute');
  v_end:=v_h+((l.config->>'duration')::int*interval '1 minute');
  v_st:=case when now()<v_h then 'hiding' when now()<v_end then 'hunting' else 'finished' end;
  v_step:=case when now()>v_h then floor(extract(epoch from now()-v_h)/_shrink_sec(l.config))::int else 0 end;
  if v_st<>l.status or v_step>l.shrink_step then
   update lobbies set status=v_st,shrink_step=greatest(shrink_step,v_step) where id=l.id and status in ('hiding','hunting');
  end if;
  if p_lat is not null and v_st<>'finished' then
   perform update_pos_acc(p_player,p_lat,p_lng,p_acc);
   if p.role='shadow' then v_ping:=ping_tick(p_player); end if;
  end if;
  select * into l from lobbies where id=p.lobby_id;
 end if;
 return json_build_object('now',now(),'lobby',row_to_json(l),
  'players',(select coalesce(json_agg(json_build_object('id',q.id,'name',q.name,'role',q.role,'status',q.status,'is_host',q.is_host,'out_since',q.out_since) order by q.joined_at),'[]') from players q where q.lobby_id=l.id),
  'pings',case when l.status='hunting' then (select coalesce(json_agg(v),'[]') from get_visible_pings(l.id) v) else '[]'::json end,
  'shelters',case when l.status in ('hiding','hunting') then (select coalesce(json_agg(json_build_object('player_id',x.player_id,'safehouse_id',x.safehouse_id,'ends_at',x.ends_at)),'[]') from shelters x where x.player_id=p.id) else '[]'::json end,
  'ping',v_ping);
end $$;

-- Dead Drop: start a run on a drop the agent picked from the radar
create or replace function start_drop_pick(p_lat float8,p_lng float8,p_drop uuid) returns json
language plpgsql security definer set search_path=public as $$
declare a agents%rowtype; d drops%rowtype; r drop_runs%rowtype; v_dd float8; v_zr float8; v_off float8; v_t float8; begin
 select * into a from agents where id=auth.uid() for update; if not found then raise exception 'Create your agent first.'; end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'No valid position.'; end if;
 select * into d from drops where id=p_drop and active and dist_m(lat,lng,p_lat,p_lng)<=5000
  and not exists(select 1 from drop_runs x where x.drop_id=drops.id and x.agent_id=a.id and x.status='secured' and x.finished_at>now()-interval '24 hours');
 if not found then raise exception 'That drop is no longer available. Pick another.'; end if;
 update drop_runs set status='abandoned',finished_at=now() where agent_id=a.id and status='active';
 perform _track(a.id,p_lat,p_lng);
 v_dd:=dist_m(d.lat,d.lng,p_lat,p_lng);
 v_zr:=least(400,greatest(120,v_dd*0.35)); v_off:=random()*v_zr*0.6; v_t:=random()*2*pi();
 insert into drop_runs(agent_id,drop_id,codename,deadline,start_dist,meters_start,zone_lat,zone_lng,zone_r)
 values(a.id,d.id,
  (array['MONSOON','IRON','SILENT','COBALT','EMBER','JADE','VELVET','PEPPER','TEAK','SALT','ONYX','AMBER'])[1+floor(random()*12)::int]||' '||
  (array['HERON','LANTERN','TIDE','ORCHID','FALCON','CEDAR','CIPHER','KITE','TUSK','MONGOOSE','DRONGO','KESTREL'])[1+floor(random()*12)::int],
  now()+make_interval(secs=>greatest(600,ceil(v_dd/1.2*1.6)+180)),v_dd,a.meters,
  d.lat+v_off*cos(v_t)/111320,d.lng+v_off*sin(v_t)/(111320*cos(radians(d.lat))),v_zr) returning * into r;
 return json_build_object('run_id',r.id,'codename',r.codename,'deadline',r.deadline,'distance',round(v_dd),'zone_lat',r.zone_lat,'zone_lng',r.zone_lng,'zone_r',r.zone_r);
end $$;

revoke execute on function hunt_sh_add(uuid,text,float8,float8,int,int) from public, anon;
revoke execute on function hunt_sh_del(uuid) from public, anon;
revoke execute on function start_drop_pick(float8,float8,uuid) from public, anon;
revoke execute on function update_pos(uuid,float8,float8) from public, anon;
grant execute on function hunt_sh_add(uuid,text,float8,float8,int,int) to authenticated;
grant execute on function hunt_sh_del(uuid) to authenticated;
grant execute on function start_drop_pick(float8,float8,uuid) to authenticated;
grant execute on function update_pos(uuid,float8,float8) to authenticated;

-- players must not be able to probe who is in a safehouse
revoke execute on function _truce_until(uuid) from public, anon, authenticated;
alter function _shrink_sec(jsonb) set search_path=public;
alter function _police(jsonb) set search_path=public;
