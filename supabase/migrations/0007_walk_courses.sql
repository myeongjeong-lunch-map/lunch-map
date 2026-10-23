-- 산책 장소·산책 코스 (GLOSSARY.md, docs/design/walk-routes.md, docs/adr/0005 참고)
-- 가게(places)와 따로 둔다: 평가·키워드·꿀팁·랭킹이 없고 관리자만 추가한다.
-- 모든 읽기/쓰기는 서버(service role)에서만 한다. RLS를 켜고 정책을 두지 않는다.

-- 1) 산책 장소: 지도에 찍히는 대표 지점(입구·광장) 하나
create table if not exists public.walk_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('park', 'culture', 'trail')),  -- 공원, 문화시설, 산책길·다리
  summary text check (char_length(summary) <= 120),                 -- 카드에 한 줄로 보이는 소개
  lat double precision not null,
  lng double precision not null,
  stay_minutes smallint not null default 5 check (stay_minutes between 0 and 60),  -- 둘러보는 시간 기본값
  naver_place_id text check (naver_place_id ~ '^[0-9]{1,20}$'),
  created_at timestamptz not null default now()
);

-- 2) 추천 코스: 관리자가 만든다. 캠퍼스 → 장소들 → 캠퍼스
create table if not exists public.walk_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  summary text check (char_length(summary) <= 200),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.walk_course_stops (
  course_id uuid not null references public.walk_courses(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  -- 코스에 들어간 장소는 지울 수 없다. 코스에서 먼저 뺀다.
  spot_id uuid not null references public.walk_spots(id) on delete restrict,
  stay_minutes smallint check (stay_minutes between 0 and 60),  -- null이면 장소 기본값
  primary key (course_id, position),
  unique (course_id, spot_id)
);

-- 3) 구간: 두 지점 사이의 TMAP 보행 경로. 쌍마다 한 줄, 방향 없음.
--    spot_a가 null이면 캠퍼스. 장소끼리는 spot_a < spot_b. path는 spot_a(캠퍼스) → spot_b 방향 [경도, 위도] 배열.
--    TMAP 약관(저장 후 24시간)에 따라 매일 다시 계산해 덮어쓴다 (docs/adr/0001, 0005).
create table if not exists public.walk_legs (
  spot_a uuid references public.walk_spots(id) on delete cascade,
  spot_b uuid not null references public.walk_spots(id) on delete cascade,
  seconds integer not null,
  meters integer not null,
  source text not null check (source in ('tmap', 'estimate')),
  path jsonb,
  updated_at timestamptz not null default now(),
  constraint walk_legs_pair unique nulls not distinct (spot_a, spot_b),
  constraint walk_legs_order check (spot_a is null or spot_a < spot_b)
);

alter table public.walk_spots enable row level security;
alter table public.walk_courses enable row level security;
alter table public.walk_course_stops enable row level security;
alter table public.walk_legs enable row level security;

grant select, insert, update, delete on public.walk_spots, public.walk_courses, public.walk_course_stops, public.walk_legs to service_role;

-- 4) 처음 장소와 추천 코스 (좌표는 5-1 참고. 구간은 배포 뒤 /api/cron/walk-legs를 한 번 돌려 채운다)
insert into public.walk_spots (name, kind, summary, lat, lng, stay_minutes) values
  ('예술의전당', 'culture', '오페라하우스 앞 광장과 음악분수. 한가람미술관·서예박물관도 여기', 37.4806452, 127.0135598, 10),
  ('국립국악원', 'culture', '예술의전당 옆 국악 공연장. 마당이 조용하다', 37.4775049, 127.0085657, 5),
  ('대성사', 'trail', '예술의전당 뒤 우면산 들머리의 절. 오르막이 있다', 37.4762002, 127.0134966, 5),
  ('서리풀공원', 'park', '서초3동 쪽 숲길. 방배·서초역 방향으로 길게 이어진다', 37.4882590, 127.0019812, 5),
  ('누에다리', 'trail', '서리풀공원과 몽마르뜨공원을 잇는 다리. 반포대로 전망', 37.4967289, 127.0052507, 3),
  ('몽마르뜨공원', 'park', '서래마을 위 잔디 공원', 37.4955415, 127.0038788, 10)
on conflict (name) do nothing;

insert into public.walk_courses (name, summary, sort_order) values
  ('예술의전당 한 바퀴', '밥 먹고 바로 다녀오는 가장 짧은 코스', 1),
  ('국악원 지나 예술의전당', '국립국악원 마당을 지나 예술의전당 광장까지', 2),
  ('서리풀공원 숲길', '나무 그늘 아래로 잠깐 걷고 오기', 3),
  ('누에다리 넘어 몽마르뜨공원', '여유 있는 날. 점심시간엔 빠듯하다', 4)
on conflict (name) do nothing;

insert into public.walk_course_stops (course_id, position, spot_id, stay_minutes)
select c.id, s.position, sp.id, s.stay_minutes
from (values
  ('예술의전당 한 바퀴', 1, '예술의전당', null::smallint),
  ('국악원 지나 예술의전당', 1, '국립국악원', null),
  ('국악원 지나 예술의전당', 2, '예술의전당', 5),
  ('서리풀공원 숲길', 1, '서리풀공원', null),
  ('누에다리 넘어 몽마르뜨공원', 1, '서리풀공원', 0),
  ('누에다리 넘어 몽마르뜨공원', 2, '누에다리', null),
  ('누에다리 넘어 몽마르뜨공원', 3, '몽마르뜨공원', null)
) as s(course, position, spot, stay_minutes)
join public.walk_courses c on c.name = s.course
join public.walk_spots sp on sp.name = s.spot
on conflict do nothing;
