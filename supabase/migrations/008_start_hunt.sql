-- Start uses the server clock (phones' clocks drift) and checks the squad is valid.
create or replace function start_hunt(p_lobby uuid) returns void language plpgsql security definer set search_path=public as $$
declare l lobbies%rowtype; n int; h int; begin
 select * into l from lobbies where id=p_lobby and host_id=auth.uid() for update;
 if not found then raise exception 'Only the host can start.'; end if;
 if l.status<>'waiting' then return; end if;
 select count(*),count(*) filter(where role='hunter') into n,h from players where lobby_id=p_lobby;
 if n<2 or h<1 or h>3 or n=h then raise exception 'Needs 2+ agents, 1-3 hunters and at least 1 shadow.'; end if;
 update lobbies set status='hiding',started_at=now(),shrink_step=0 where id=p_lobby;
end$$;
revoke all on function start_hunt(uuid) from public, anon;
grant execute on function start_hunt(uuid) to authenticated;
