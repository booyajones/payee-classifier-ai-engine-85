-- Enable trigram extension for fuzzy text search
create extension if not exists "pg_trgm";

-- Trigram index to accelerate similarity checks
create index if not exists idx_upload_rows_trgm
  on upload_rows using gin (normalized_name gin_trgm_ops);

-- Materialized view listing potential duplicate name pairs
create materialized view if not exists mv_dupe_candidates as
select
  r1.id as row1_id,
  r2.id as row2_id,
  r1.payee_name as payee_name_1,
  r2.payee_name as payee_name_2,
  r1.normalized_name as normalized_name_1,
  r2.normalized_name as normalized_name_2,
  similarity(r1.normalized_name, r2.normalized_name) as similarity
from upload_rows r1
join upload_rows r2
  on r1.id < r2.id
where similarity(r1.normalized_name, r2.normalized_name) > 0.78;
