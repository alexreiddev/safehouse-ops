-- 1) Zone enforcement: a shadow outside the shrinking zone for 30 s during the hunt is out and joins the hunters.
alter table players add column if not exists out_since timestamptz;

create or replace function update_pos(p_player uuid,p_lat float8,p_lng float8) returns void
language plpgsql security definer set search_path=public as $$
declare o locs%rowtype; p players%rowtype; l lobbies%rowtype; v_d float8:=0; v_h timestamptz; v_r float8; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then raise exception 'Not your agent.'; end if;
 perform _track(auth.uid(),p_lat,p_lng);
 select * into o from locs where player_id=p_player;
 if found then v_d:=dist_m(o.lat,o.lng,p_lat,p_lng); if v_d>100 or v_d<3 then v_d:=0; end if; end if;
 insert into locs(player_id,lat,lng) values(p_player,p_lat,p_lng)
  on conflict(player_id) do update set lat=excluded.lat,lng=excluded.lng,total_distance=locs.total_distance+v_d,updated_at=now();
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

-- 2) Drop radar: active drops within range of the player, distance only (never coordinates).
--    Skips drops this agent secured in the last 24 h.
create or replace function nearby_drops(p_lat float8,p_lng float8,p_range float8 default 3000)
returns table(id uuid,dist int) language sql stable security definer set search_path=public as $$
 select d.id,round(dist_m(d.lat,d.lng,p_lat,p_lng))::int from drops d
 where d.active and dist_m(d.lat,d.lng,p_lat,p_lng)<=least(p_range,5000)
  and exists(select 1 from agents where agents.id=auth.uid())
  and not exists(select 1 from drop_runs r where r.drop_id=d.id and r.agent_id=auth.uid() and r.status='secured' and r.finished_at>now()-interval '24 hours')
 order by 2 limit 20$$;
revoke all on function nearby_drops(float8,float8,float8) from public, anon;
grant execute on function nearby_drops(float8,float8,float8) to authenticated;
