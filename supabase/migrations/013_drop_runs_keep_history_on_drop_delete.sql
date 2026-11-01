alter table drop_runs drop constraint drop_runs_drop_id_fkey;
alter table drop_runs add constraint drop_runs_drop_id_fkey foreign key (drop_id) references drops(id) on delete set null;
