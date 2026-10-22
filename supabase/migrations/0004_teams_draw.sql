-- 추첨: 팀, 팀원, 추첨통, 추첨통에 넣은 가게 (GLOSSARY.md, docs/adr/0003·0004 참고)
-- 팀원은 로그인이 생기기 전까지 평가와 같은 브라우저 쿠키(lm_voter) 하나로 구분한다.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  leader_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id text not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (team_id, member_id)
);
create index if not exists team_members_member_idx on public.team_members(member_id);

-- 추첨통: 조장이 만들 때 한 사람이 넣을 수 있는 횟수(1~3)를 정한다.
-- 추첨하면 drawn(뽑힌 가게가 곧 추첨 기록), 취소하면 cancelled. 팀마다 열린 추첨통은 하나뿐이다.
create table if not exists public.draw_boxes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  per_member_limit int not null check (per_member_limit between 1 and 3),
  status text not null default 'open' check (status in ('open', 'drawn', 'cancelled')),
  animation text check (animation in ('race', 'plinko')),
  result_place_id uuid references public.places(id) on delete set null,
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists draw_boxes_one_open_per_team on public.draw_boxes(team_id) where status = 'open';
create index if not exists draw_boxes_team_idx on public.draw_boxes(team_id, created_at desc);

-- 넣은 한 번이 한 줄이다. 같은 가게를 여러 번 넣으면 여러 줄이 되고, 줄 수가 곧 가중치다.
create table if not exists public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.draw_boxes(id) on delete cascade,
  member_id text not null,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists draw_entries_box_idx on public.draw_entries(box_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.draw_boxes enable row level security;
alter table public.draw_entries enable row level security;

grant select, insert, update, delete on public.teams, public.team_members, public.draw_boxes, public.draw_entries to service_role;
