-- Leave a running ShadowHunt. Host leaving ends the op for everyone.
-- A non-host is marked 'left'; if no shadows remain alive, the op finishes.
create or replace function leave_hunt(p_lobby uuid) returns text
language plpgsql security definer set search_path=public as $$
declare p players%rowtype; l lobbies%rowtype; begin
 select * into p from players where lobby_id=p_lobby and user_id=auth.uid(); if not found then return 'none'; end if;
 select * into l from lobbies where id=p_lobby for update;
 if l.host_id=auth.uid() then
  if l.status='waiting' then delete from lobbies where id=p_lobby; else update lobbies set status='finished' where id=p_lobby; end if;
  return 'ended';
 end if;
 if l.status='waiting' then delete from players where id=p.id; return 'left'; end if;
 update players set status='left' where id=p.id;
 if l.status<>'finished' and not exists(select 1 from players where lobby_id=p_lobby and role='shadow' and status='alive')
  then update lobbies set status='finished' where id=p_lobby; end if;
 return 'left';
end $$;
revoke all on function leave_hunt(uuid) from public, anon;
grant execute on function leave_hunt(uuid) to authenticated;
