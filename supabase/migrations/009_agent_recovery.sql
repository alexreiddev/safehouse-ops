-- Agent recovery without personal data: a 6-word cipher (bcrypt-hashed) and/or passkeys (verified by the
-- `passkey` Edge Function). Restoring moves the whole agent (XP, history) onto the new device's account.
create table if not exists agent_keys(agent_id uuid primary key references agents on delete cascade,
 cipher_hash text not null,created_at timestamptz not null default now());
alter table agent_keys enable row level security;   -- no client policies: only definer functions touch it

create table if not exists restore_attempts(id bigserial primary key,callsign text,caller uuid,at timestamptz not null default now());
create index if not exists restore_attempts_cs_idx on restore_attempts(callsign,at);
create index if not exists restore_attempts_caller_idx on restore_attempts(caller,at);
alter table restore_attempts enable row level security;

create table if not exists passkeys(credential_id text primary key,agent_id uuid not null references agents on delete cascade,
 public_key text not null,counter bigint not null default 0,transports text[],label text,created_at timestamptz not null default now(),last_used_at timestamptz);
create index if not exists passkeys_agent_idx on passkeys(agent_id);
alter table passkeys enable row level security;
create policy pk_sel on passkeys for select to authenticated using(agent_id=auth.uid());

create table if not exists webauthn_challenges(user_id uuid primary key,challenge text not null,kind text not null,expires_at timestamptz not null);
alter table webauthn_challenges enable row level security;

-- Move an agent to a new auth user. Service role / definer functions only.
create or replace function _transfer_agent(p_old uuid,p_new uuid) returns text
language plpgsql security definer set search_path=public as $$
declare a agents%rowtype; begin
 select * into a from agents where id=p_old for update; if not found then raise exception 'No such agent.'; end if;
 if exists(select 1 from agents where id=p_new) then raise exception 'This device already has an agent.'; end if;
 update agents set callsign='R'||substr(md5(random()::text),1,12) where id=p_old;
 insert into agents(id,callsign,district,adult_confirmed_at,consent_at,xp,meters,active_sec,ops,is_admin,created_at)
  values(p_new,a.callsign,a.district,a.adult_confirmed_at,a.consent_at,a.xp,a.meters,a.active_sec,a.ops,a.is_admin,a.created_at);
 delete from agent_pos where agent_id=p_new;
 update agent_pos set agent_id=p_new where agent_id=p_old;
 update xp_events set agent_id=p_new where agent_id=p_old;
 update drop_runs set agent_id=p_new where agent_id=p_old;
 update lobbies set host_id=p_new where host_id=p_old;
 update players set user_id=p_new where user_id=p_old;
 update agent_keys set agent_id=p_new where agent_id=p_old;
 update passkeys set agent_id=p_new where agent_id=p_old;
 delete from agents where id=p_old;
 return a.callsign;
end$$;
revoke all on function _transfer_agent(uuid,uuid) from public, anon, authenticated;
grant execute on function _transfer_agent(uuid,uuid) to service_role;

create or replace function _norm_phrase(p text) returns text language sql immutable as
$$ select array_to_string(regexp_split_to_array(lower(trim(p)),'[^a-z]+'),'-') $$;

create or replace function set_cipher(p_phrase text) returns void language plpgsql security definer set search_path=public,extensions as $$
declare v text:=_norm_phrase(p_phrase); begin
 if not exists(select 1 from agents where id=auth.uid()) then raise exception 'Create your agent first.'; end if;
 if v !~ '^[a-z]{3,8}(-[a-z]{3,8}){5}$' then raise exception 'Cipher must be 6 words.'; end if;
 insert into agent_keys(agent_id,cipher_hash) values(auth.uid(),crypt(v,gen_salt('bf',10)))
  on conflict(agent_id) do update set cipher_hash=excluded.cipher_hash,created_at=now();
end$$;
revoke all on function set_cipher(text) from public, anon; grant execute on function set_cipher(text) to authenticated;

create or replace function restore_agent(p_callsign text,p_phrase text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare a agents%rowtype; k agent_keys%rowtype; v_cs text:=upper(trim(p_callsign)); begin
 if auth.uid() is null then raise exception 'Not signed in.'; end if;
 if exists(select 1 from agents where id=auth.uid()) then raise exception 'This device already has an agent.'; end if;
 if (select count(*) from restore_attempts where callsign=v_cs and at>now()-interval '1 hour')>=5
  or (select count(*) from restore_attempts where caller=auth.uid() and at>now()-interval '1 hour')>=10
  then raise exception 'Too many attempts. Try again in an hour.'; end if;
 insert into restore_attempts(callsign,caller) values(v_cs,auth.uid());
 select * into a from agents where callsign=v_cs;
 if found then select * into k from agent_keys where agent_id=a.id; end if;
 if a.id is null or k.agent_id is null or crypt(_norm_phrase(p_phrase),k.cipher_hash)<>k.cipher_hash then
  return json_build_object('ok',false,'reason','Callsign or cipher is wrong.'); end if;
 perform _transfer_agent(a.id,auth.uid());
 delete from restore_attempts where callsign=v_cs;
 return json_build_object('ok',true,'callsign',a.callsign);
end$$;
revoke all on function restore_agent(text,text) from public, anon; grant execute on function restore_agent(text,text) to authenticated;

create or replace function security_status() returns json language sql stable security definer set search_path=public as $$
 select json_build_object('cipher',exists(select 1 from agent_keys where agent_id=auth.uid()),
  'passkeys',(select count(*) from passkeys where agent_id=auth.uid())) $$;
revoke all on function security_status() from public, anon; grant execute on function security_status() to authenticated;
