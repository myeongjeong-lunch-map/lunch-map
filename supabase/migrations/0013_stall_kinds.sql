-- 노점 하나에 제보 종류 여러 개 (최대 3개, GLOSSARY.md 「제보 종류」)
-- kinds가 전체 목록이고, 처음 고른 kinds[1]이 대표 종류다. 대표 종류는 kind에도 그대로 둔다
-- (이 칸만 읽는 예전 코드가 배포 사이에도 동작하도록).
alter table public.street_stalls add column if not exists kinds text[];
update public.street_stalls set kinds = array[kind] where kinds is null;
alter table public.street_stalls alter column kinds set not null;
alter table public.street_stalls drop constraint if exists street_stalls_kinds_check;
alter table public.street_stalls add constraint street_stalls_kinds_check check (
  cardinality(kinds) between 1 and 3
  and kinds <@ array['bungeoppang', 'hotteok', 'goguma', 'gunbam', 'eomuk', 'truck', 'etc']
  and kinds[1] = kind
);
