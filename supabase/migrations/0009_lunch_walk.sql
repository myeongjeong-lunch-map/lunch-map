-- 점심 코스 (GLOSSARY.md: 점심 코스, 가게 구간, 미리 주문, docs/design/lunch-walk.md)

-- 1) 산책 장소: 포장해서 먹을 수 있는 곳 (벤치·광장이 있고 음식을 먹어도 되는 곳)
alter table public.walk_spots add column if not exists picnic boolean not null default false;

-- 2) 가게: 앱으로 미리 주문해 두고 받기만 하는 곳 (관리자가 표시)
alter table public.places add column if not exists preorder boolean not null default false;

-- 3) 가게 구간: 최소치로라도 점심 코스에 들어올 수 있는 가게 ↔ 산책 장소 쌍만. TMAP 약관에 따라 매일 다시 계산해 덮어쓴다 (docs/adr/0001)
--    path는 가게 → 산책 장소 방향 [경도, 위도] 배열
create table if not exists public.walk_place_legs (
  place_id uuid not null references public.places(id) on delete cascade,
  spot_id uuid not null references public.walk_spots(id) on delete cascade,
  seconds integer not null check (seconds >= 0),
  meters integer not null check (meters >= 0),
  path jsonb,
  updated_at timestamptz not null default now(),
  primary key (place_id, spot_id)
);
alter table public.walk_place_legs enable row level security;
grant select, insert, update, delete on public.walk_place_legs to service_role;

-- 4) 서리풀공원 지점을 공원 초입(명달로 끝)으로. 좌표는 2026-10-23 지도 그림에서 읽은 임시 값. 현장 답사 뒤 고친다 (docs/design/lunch-walk.md 남은 것 1)
update public.walk_spots set lat = 37.48835, lng = 127.00420, summary = '명달로 끝 초입. 숲길이 방배·서초역 방향으로 길게 이어진다'
where name = '서리풀공원';

-- 5) 포장해서 먹을 수 있는 산책 장소 (2026-10-23 사용자 확인)
update public.walk_spots set picnic = true where name in ('예술의전당', '서리풀공원');

-- 6) 미리 주문 가게
update public.places set preorder = true where name = '맥도날드 서초GS점';
