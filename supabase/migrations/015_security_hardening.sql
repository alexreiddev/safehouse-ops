-- Security hardening from the 1 Nov 2026 audit.
-- 1. Lobbies, players and catches are readable only by people in that game (and admins), not by every agent.
--    Joining by code goes through find_lobby(), which returns only the id of an open squad.
-- 9. lobbies.config must be a well-formed object with values in the ranges the app offers.
-- 10/11. start_drop clamps its search range and serialises per agent so two taps can't open two runs.

create or replace function _lobby_member(p_lobby uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from players where lobby_id=p_lobby and user_id=auth.uid())
     or exists(select 1 from lobbies where id=p_lobby and host_id=auth.uid())
     or is_admin() $$;
revoke all on function _lobby_member(uuid) from public, anon;
grant execute on function _lobby_member(uuid) to authenticated;

drop policy if exists l_sel on lobbies;
create policy l_sel on lobbies for select to authenticated using (host_id = auth.uid() or _lobby_member(id));

drop policy if exists p_sel on players;
create policy p_sel on players for select to authenticated using (user_id = auth.uid() or _lobby_member(lobby_id));

drop policy if exists c_sel on catches;
create policy c_sel on catches for select to authenticated using (_lobby_member(lobby_id));

create or replace function find_lobby(p_code text) returns uuid
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from agents where id=auth.uid()) then raise exception 'Create your agent first.'; end if;
 return (select id from lobbies where code=upper(trim(p_code)) and status='waiting' limit 1);
end $$;
revoke all on function find_lobby(text) from public, anon;
grant execute on function find_lobby(text) to authenticated;

create or replace function _num_between(j jsonb, k text, lo numeric, hi numeric) returns boolean
language sql immutable as $$
 select coalesce(jsonb_typeof(j->k)='number' and (j->>k)::numeric between lo and hi, false) $$;  -- a missing key must fail, not pass as NULL

alter table lobbies drop constraint if exists config_valid;
alter table lobbies add constraint config_valid check (
 jsonb_typeof(config)='object'
 and _num_between(config,'zone_lat',-90,90) and _num_between(config,'zone_lng',-180,180)
 and _num_between(config,'radius',50,3000) and _num_between(config,'duration',5,120)
 and _num_between(config,'ping_interval',1,10) and _num_between(config,'catch_radius',3,50)
 and _num_between(config,'hide_time',0,10) and _num_between(config,'hunters',1,10));

create or replace function public.start_drop(p_lat double precision, p_lng double precision, p_min double precision, p_max double precision)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare a agents%rowtype; d drops%rowtype; r drop_runs%rowtype; v_dd float8; v_zr float8; v_off float8; v_t float8; v_min float8; v_max float8; begin
 -- Row lock: a second simultaneous call waits here, then abandons the run this one created.
 select * into a from agents where id=auth.uid() for update; if not found then raise exception 'Create your agent first.'; end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'No valid position.'; end if;
 v_min:=greatest(0,least(coalesce(p_min,0),5000)); v_max:=greatest(v_min,least(coalesce(p_max,3000),5000));
 update drop_runs set status='abandoned',finished_at=now() where agent_id=a.id and status='active';
 perform _track(a.id,p_lat,p_lng);
 select * into d from drops where active and dist_m(lat,lng,p_lat,p_lng) between v_min and v_max order by random() limit 1;
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
end$function$;
