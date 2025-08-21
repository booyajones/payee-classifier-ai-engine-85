-- Add prompt_version to classifications table and update unique constraint
alter table classifications
  add column prompt_version integer not null default 1;

alter table classifications
  drop constraint if exists classifications_row_id_key;

alter table classifications
  add constraint classifications_row_id_prompt_version_key unique (row_id, prompt_version);

create index if not exists idx_classifications_prompt_version on classifications(prompt_version);
