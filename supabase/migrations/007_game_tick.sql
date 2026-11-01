-- Campus mode: one round trip per phone. Reports position (optional), advances the game clock on the server
-- (phases, zone shrink, finish) so no phone has to stay awake, handles adaptive pings, and returns everything
-- the screen needs plus server time (phones' clocks drift).
create or replace function game_tick(p_player uuid,p_lat float8 default null,p_lng float8 default null,p_acc float8 default null)
returns json language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; v_h timestamptz; v_end timestamptz; v_st text; v_step int; v_ping json; begin
 select * into p from players where id=p_player and user_id=auth.uid(); if not found then return json_build_object('gone',true); end if;
 select * into l from lobbies where id=p.lobby_id; if not found then return json_build_object('gone',true); end if;
 if l.status in ('hiding','hunting') then
  v_h:=l.started_at+((l.config->>'hide_time')::int*interval '1 minute');
  v_end:=v_h+((l.config->>'duration')::int*interval '1 minute');
  v_st:=case when now()<v_h then 'hiding' when now()<v_end then 'hunting' else 'finished' end;
  v_step:=case when now()>v_h then floor(extract(epoch from now()-v_h)/600)::int else 0 end;
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
  'shelters',case when l.status='hunting' then (select coalesce(json_agg(json_build_object('player_id',x.player_id,'safehouse_id',x.safehouse_id,'ends_at',x.ends_at)),'[]') from shelters x where x.lobby_id=l.id) else '[]'::json end,
  'ping',v_ping);
end$$;
revoke all on function game_tick(uuid,float8,float8,float8) from public, anon;
grant execute on function game_tick(uuid,float8,float8,float8) to authenticated;
