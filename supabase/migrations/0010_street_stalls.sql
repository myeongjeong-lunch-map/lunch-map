-- 길거리 제보 (GLOSSARY.md: 길거리 제보, 노점, 노점 확인 / docs/adr/0007)
-- 제보 한 건이 곧 노점 하나다. 지도에 보일지는 확인 기록으로 그때그때 계산하고, 내린 제보도 지우지 않는다.

create table if not exists public.street_stalls (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bungeoppang', 'hotteok', 'goguma', 'gunbam', 'eomuk', 'truck', 'etc')),
  memo text check (char_length(memo) <= 60),
  nickname text check (char_length(nickname) <= 20),
  lat double precision not null,
  lng double precision not null,
  -- 고정 노점(매일 나오는 곳)인지. 일일 노점에서 누구나 고정으로 바꿀 수 있고, 거꾸로는 없다
  fixed boolean not null default false,
  -- 제보한 브라우저(lm_voter). 제보한 사람의 "없어졌어요"는 한 번으로 내린다
  reporter_id text not null,
  created_at timestamptz not null default now(),
  -- 마지막으로 "있다"는 확인을 받은 시각 (제보, 아직 있어요, 오늘 열었어요)
  last_seen_at timestamptz not null default now(),
  -- 관리자가 내린 시각
  removed_at timestamptz
);
create index if not exists street_stalls_seen_idx on public.street_stalls(last_seen_at desc) where removed_at is null;

-- 노점 확인: 브라우저 하나가 노점 하나에 하나. 바꾸거나 취소할 수 있다.
-- here=아직 있어요, gone=없어졌어요 (일일) / open=오늘 열었어요, closed=오늘은 안 열었어요, quit=이제 안 나와요 (고정)
create table if not exists public.stall_checks (
  stall_id uuid not null references public.street_stalls(id) on delete cascade,
  voter_id text not null,
  value text not null check (value in ('here', 'gone', 'open', 'closed', 'quit')),
  updated_at timestamptz not null default now(),
  primary key (stall_id, voter_id)
);

alter table public.street_stalls enable row level security;
alter table public.stall_checks enable row level security;
grant select, insert, update, delete on public.street_stalls, public.stall_checks to service_role;
