create index if not exists pings_player_time_idx on pings(player_id,created_at desc);
create index if not exists pings_lobby_idx on pings(lobby_id);
create index if not exists drop_runs_agent_status_idx on drop_runs(agent_id,status);
create index if not exists drop_runs_drop_idx on drop_runs(drop_id);
create index if not exists catches_lobby_idx on catches(lobby_id);
create index if not exists shelters_lobby_idx on shelters(lobby_id);
create index if not exists xp_events_agent_idx on xp_events(agent_id,created_at);
create index if not exists players_lobby_idx on players(lobby_id);
create index if not exists agent_pos_at_idx on agent_pos(at);
