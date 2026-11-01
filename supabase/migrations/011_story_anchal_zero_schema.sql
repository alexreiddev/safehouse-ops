-- Anchal Zero story layer: files, per-agent progress, safety check-outs, and the RPCs the app calls.
create table if not exists story_files(
 id text primary key, case_key text not null, ord int not null,
 title text not null, place text not null,
 briefing text not null, archive text, theory text, archivist_note text,
 hold_prompt text, cliffhanger text, unlock_line text,
 requires text[] not null default '{}',
 squad_only boolean not null default false,
 collective_min int not null default 0, collective_of text,
 hold_sec int not null default 120, xp int not null default 150,
 lat float8, lng float8, radius int not null default 30,
 active boolean not null default false, frozen boolean not null default false,
 release_at timestamptz
);
create table if not exists story_progress(
 agent_id uuid not null references agents(id) on delete cascade,
 file_id text not null references story_files(id) on delete cascade,
 unlocked_at timestamptz not null default now(),
 opened_at timestamptz, lost_lines int not null default 0,
 hold_started_at timestamptz, secured_at timestamptz,
 primary key(agent_id,file_id)
);
create table if not exists story_checkouts(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references agents(id) on delete cascade,
 file_id text references story_files(id),
 squad uuid[] not null default '{}',
 due_at timestamptz not null, created_at timestamptz not null default now(),
 closed_at timestamptz
);
alter table story_files enable row level security;
alter table story_progress enable row level security;
alter table story_checkouts enable row level security;

create or replace function _story_window() returns boolean language sql stable set search_path=public as $$
 select (now() at time zone 'Asia/Kolkata')::time between time '06:00' and time '17:30' $$;

create or replace function _story_redact(t text, p_agent uuid) returns text language plpgsql stable security definer set search_path=public as $$
declare m text[]; r text := t; begin
 if t is null then return null; end if;
 for m in select regexp_matches(t, '\[\[([^|\]]+)\|([A-Z0-9]+)\]\]', 'g') loop
  if exists(select 1 from story_progress where agent_id=p_agent and file_id=m[2] and secured_at is not null)
   then r := replace(r, '[['||m[1]||'|'||m[2]||']]', m[1]);
   else r := replace(r, '[['||m[1]||'|'||m[2]||']]', repeat('█', greatest(4,length(m[1])))); end if;
 end loop;
 return replace(r,'{CALLSIGN}', coalesce((select callsign from agents where id=p_agent),'RUNNER'));
end $$;

create or replace function _story_decay(t text, lost int) returns text language plpgsql immutable as $$
declare a text[]; n int; i int; begin
 if t is null or lost is null or lost<=0 then return t; end if;
 a := string_to_array(t, E'\n'); n := array_length(a,1);
 lost := least(lost, n-1); if lost<=0 then return t; end if;
 for i in (n-lost+1)..n loop a[i] := '▇▇▇▇▇▇▇▇▇▇▇▇▇▇ [line lost]'; end loop;
 return array_to_string(a, E'\n'); end $$;

create or replace function _story_unlock(v uuid) returns void language sql security definer set search_path=public as $$
 insert into story_progress(agent_id,file_id)
 select v, f.id from story_files f
 where (f.release_at is null or f.release_at<=now())
  and not exists(select 1 from unnest(f.requires) r where not exists(
       select 1 from story_progress p where p.agent_id=v and p.file_id=r and p.secured_at is not null))
  and (f.collective_min=0 or (select count(distinct q.agent_id) from story_progress q
       where q.file_id=f.collective_of and q.secured_at is not null)>=f.collective_min)
 on conflict do nothing $$;

create or replace function _story_squad(v uuid, p_lat float8, p_lng float8) returns uuid[] language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(agent_id),'{}') from agent_pos
 where agent_id<>v and at>now()-interval '5 minutes' and dist_m(p_lat,p_lng,lat,lng)<=100 $$;

create or replace function _story_me() returns uuid language plpgsql stable security definer set search_path=public as $$
declare v uuid := auth.uid(); begin
 if v is null or not exists(select 1 from agents where id=v) then raise exception 'Register as an agent first.'; end if;
 return v; end $$;

create or replace function story_board() returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); files jsonb; begin
 perform _story_unlock(v);
 select jsonb_agg(jsonb_build_object(
   'id',f.id,'case',f.case_key,'ord',f.ord,
   'title',case when p.file_id is null then null else f.title end,
   'place',case when p.file_id is null then null else f.place end,
   'status',case when p.file_id is null then 'locked' when p.secured_at is not null then 'secured' when p.opened_at is null then 'new' else 'open' end,
   'squad',f.squad_only,'live',(f.active and not f.frozen and f.lat is not null),'frozen',f.frozen,
   'decay_in_h',case when p.file_id is not null and p.opened_at is null and p.secured_at is null then round((6-extract(epoch from now()-p.unlocked_at)/3600)::numeric,1) end,
   'lost',case when p.file_id is null then 0 when p.opened_at is null then greatest(0,floor(extract(epoch from now()-p.unlocked_at)/3600)::int-6) else p.lost_lines end,
   'collective',case when f.collective_min>0 and p.file_id is null then jsonb_build_object('have',(select count(distinct q.agent_id) from story_progress q where q.file_id=f.collective_of and q.secured_at is not null),'need',f.collective_min,'of',f.collective_of) end,
   'release_at',case when p.file_id is null and f.release_at>now() then f.release_at end
  ) order by f.case_key, f.ord) into files
 from story_files f left join story_progress p on p.agent_id=v and p.file_id=f.id;
 return jsonb_build_object(
  'files',coalesce(files,'[]'),
  'window',_story_window(),
  'callsign',(select callsign from agents where id=v),
  'admin',is_admin(),
  'handler_silent_until',(select secured_at+interval '24 hours' from story_progress where agent_id=v and file_id='B2' and secured_at>now()-interval '24 hours'),
  'checkout',(select jsonb_build_object('file',c.file_id,'due_at',c.due_at) from story_checkouts c where c.agent_id=v and c.closed_at is null order by created_at desc limit 1),
  'alerts',(select coalesce(jsonb_agg(jsonb_build_object('callsign',a.callsign,'file',f.title,'due_at',c.due_at)),'[]')
            from story_checkouts c join agents a on a.id=c.agent_id left join story_files f on f.id=c.file_id
            where c.closed_at is null and c.due_at<now() and v=any(c.squad) and c.agent_id<>v and c.due_at>now()-interval '24 hours')
 ); end $$;

create or replace function _story_reveal(f story_files, v uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('archive',_story_redact(f.archive,v),'theory',_story_redact(f.theory,v),
  'cliffhanger',_story_redact(f.cliffhanger,v),'unlock_line',_story_redact(f.unlock_line,v),'xp',f.xp) $$;

create or replace function story_open(p_file text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); f story_files; p story_progress; n int; lost int; begin
 select * into f from story_files where id=p_file;
 select * into p from story_progress where agent_id=v and file_id=p_file;
 if f.id is null or p.file_id is null then raise exception 'This file is still locked.'; end if;
 if p.opened_at is null then
  n := coalesce(array_length(string_to_array(f.briefing,E'\n'),1),1);
  lost := least(greatest(0,floor(extract(epoch from now()-p.unlocked_at)/3600)::int-6), n-1);
  update story_progress set opened_at=now(), lost_lines=lost where agent_id=v and file_id=p_file returning * into p;
 end if;
 return jsonb_build_object('id',f.id,'case',f.case_key,'title',f.title,'place',f.place,
  'briefing',_story_redact(_story_decay(f.briefing,p.lost_lines),v),'lost',p.lost_lines,
  'squad',f.squad_only,'hold_sec',f.hold_sec,'radius',f.radius,'frozen',f.frozen,
  'live',(f.active and not f.frozen and f.lat is not null),
  'lat',case when f.active and not f.frozen then f.lat end,'lng',case when f.active and not f.frozen then f.lng end,
  'secured',p.secured_at is not null,
  'reveal',case when p.secured_at is not null then _story_reveal(f,v) end); end $$;

create or replace function story_ping(p_file text, p_lat float8, p_lng float8) returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); f story_files; d float8; near boolean; begin
 perform _track(v,p_lat,p_lng);
 select * into f from story_files where id=p_file;
 if f.id is null or not exists(select 1 from story_progress where agent_id=v and file_id=p_file) then raise exception 'This file is still locked.'; end if;
 if f.lat is not null then d := dist_m(p_lat,p_lng,f.lat,f.lng); end if;
 near := d is not null and d<=f.radius;
 return jsonb_build_object('dist',round(d::numeric),'bell',d is not null and d<=200,'near',near,
  'live',(f.active and not f.frozen and f.lat is not null),'window',_story_window(),
  'squad_near',coalesce(array_length(_story_squad(v,p_lat,p_lng),1),0),
  'checkout',exists(select 1 from story_checkouts where agent_id=v and closed_at is null and due_at>now()),
  'archivist',case when near then _story_redact(f.archivist_note,v) end,
  'hold_prompt',case when near then f.hold_prompt end); end $$;

create or replace function story_hold_start(p_file text, p_lat float8, p_lng float8) returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); f story_files; p story_progress; d float8; sq int; begin
 select * into f from story_files where id=p_file;
 select * into p from story_progress where agent_id=v and file_id=p_file;
 if p.file_id is null then raise exception 'This file is still locked.'; end if;
 if p.secured_at is not null then raise exception 'You already secured this file.'; end if;
 if f.frozen then raise exception 'HQ has frozen this drop. Stand down.'; end if;
 if not f.active or f.lat is null then raise exception 'This drop is not in the field yet.'; end if;
 if not _story_window() then raise exception 'Field hours are 06:00 to 17:30. Come back in daylight.'; end if;
 d := dist_m(p_lat,p_lng,f.lat,f.lng);
 if d>f.radius then raise exception 'You are % m away. Get within % m.', round(d), f.radius; end if;
 if f.squad_only then
  sq := coalesce(array_length(_story_squad(v,p_lat,p_lng),1),0);
  if sq<2 then raise exception 'Squad-only file. % of 2 squadmates are within 100 m.', sq; end if;
  if not exists(select 1 from story_checkouts where agent_id=v and closed_at is null and due_at>now()) then raise exception 'Check out before you start this file.'; end if;
 end if;
 update story_progress set hold_started_at=now() where agent_id=v and file_id=p_file;
 return jsonb_build_object('hold_sec',f.hold_sec,'hold_prompt',f.hold_prompt); end $$;

create or replace function story_hold_done(p_file text, p_lat float8, p_lng float8) returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); f story_files; p story_progress; begin
 select * into f from story_files where id=p_file;
 select * into p from story_progress where agent_id=v and file_id=p_file;
 if p.file_id is null then raise exception 'This file is still locked.'; end if;
 if p.secured_at is not null then return _story_reveal(f,v)||jsonb_build_object('xp',0); end if;
 if p.hold_started_at is null then raise exception 'Start the hold first.'; end if;
 if now()-p.hold_started_at < make_interval(secs=>greatest(0,f.hold_sec-5)) then
  raise exception 'Hold position. % seconds left.', ceil(f.hold_sec-extract(epoch from now()-p.hold_started_at)); end if;
 if dist_m(p_lat,p_lng,f.lat,f.lng) > f.radius*3+30 then raise exception 'You left the spot. Go back and hold again.'; end if;
 update story_progress set secured_at=now() where agent_id=v and file_id=p_file;
 perform _award(v,'story',f.xp);
 perform _story_unlock(v);
 return _story_reveal(f,v); end $$;

create or replace function story_checkout(p_file text, p_minutes int, p_lat float8, p_lng float8) returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid := _story_me(); sq uuid[]; c story_checkouts; begin
 if p_minutes not between 15 and 600 then raise exception 'Pick a return time between 15 minutes and 10 hours.'; end if;
 update story_checkouts set closed_at=now() where agent_id=v and closed_at is null;
 sq := _story_squad(v,p_lat,p_lng);
 insert into story_checkouts(agent_id,file_id,squad,due_at) values(v,p_file,sq,now()+make_interval(mins=>p_minutes)) returning * into c;
 return jsonb_build_object('due_at',c.due_at,'squad',(select coalesce(jsonb_agg(callsign),'[]') from agents where id=any(sq))); end $$;

create or replace function story_checkin() returns boolean language sql security definer set search_path=public as $$
 update story_checkouts set closed_at=now() where agent_id=_story_me() and closed_at is null; select true $$;

create or replace function story_admin_list() returns jsonb language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'HQ only.'; end if;
 return (select jsonb_agg(to_jsonb(f)||jsonb_build_object(
   'unlocked',(select count(*) from story_progress p where p.file_id=f.id),
   'secured',(select count(*) from story_progress p where p.file_id=f.id and p.secured_at is not null)) order by f.case_key,f.ord) from story_files f); end $$;

create or replace function story_admin_set(p_file text, p jsonb) returns boolean language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'HQ only.'; end if;
 update story_files set
  lat=case when p ? 'lat' then nullif(p->>'lat','')::float8 else lat end,
  lng=case when p ? 'lng' then nullif(p->>'lng','')::float8 else lng end,
  radius=case when p ? 'radius' then (p->>'radius')::int else radius end,
  active=case when p ? 'active' then (p->>'active')::boolean else active end,
  frozen=case when p ? 'frozen' then (p->>'frozen')::boolean else frozen end,
  release_at=case when p ? 'release_at' then nullif(p->>'release_at','')::timestamptz else release_at end,
  collective_min=case when p ? 'collective_min' then (p->>'collective_min')::int else collective_min end
 where id=p_file;
 return found; end $$;

create or replace function story_admin_freeze_all(p_frozen boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'HQ only.'; end if;
 update story_files set frozen=p_frozen; return true; end $$;

revoke all on function _story_window(), _story_redact(text,uuid), _story_decay(text,int), _story_unlock(uuid), _story_squad(uuid,float8,float8), _story_me(), _story_reveal(story_files,uuid) from public, anon, authenticated;
revoke all on function story_board(), story_open(text), story_ping(text,float8,float8), story_hold_start(text,float8,float8), story_hold_done(text,float8,float8), story_checkout(text,int,float8,float8), story_checkin(), story_admin_list(), story_admin_set(text,jsonb), story_admin_freeze_all(boolean) from public, anon;
grant execute on function story_board(), story_open(text), story_ping(text,float8,float8), story_hold_start(text,float8,float8), story_hold_done(text,float8,float8), story_checkout(text,int,float8,float8), story_checkin(), story_admin_list(), story_admin_set(text,jsonb), story_admin_freeze_all(boolean) to authenticated;
