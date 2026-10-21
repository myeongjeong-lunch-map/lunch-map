-- 명정 캠퍼스 점심 지도: 가게, 한마디, 평가
-- 모든 읽기/쓰기는 서버(service role)에서만 한다. RLS를 켜고 정책을 두지 않아 anon 접근은 막힌다.

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  road_address text not null check (char_length(road_address) between 1 and 200),
  lat double precision not null,
  lng double precision not null,
  category text not null check (category in ('한식','중식','일식','양식','아시안','분식','패스트푸드','카페','기타')),
  solo_dining text not null default 'unknown' check (solo_dining in ('yes','no','unknown')),
  naver_category text,
  walking_seconds integer,
  walking_meters integer,
  walking_source text check (walking_source in ('tmap','estimate')),
  walking_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name, road_address)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  nickname text check (char_length(nickname) <= 20),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_place_id_idx on public.comments(place_id, created_at);

create table if not exists public.votes (
  place_id uuid not null references public.places(id) on delete cascade,
  voter_id text not null,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (place_id, voter_id)
);

-- 속도 제한용 쓰기 기록 (IP는 해시로만 저장)
create table if not exists public.write_events (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists write_events_ip_idx on public.write_events(ip_hash, created_at);

alter table public.places enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.write_events enable row level security;

create or replace view public.place_summaries
with (security_invoker = true) as
select
  p.*,
  coalesce(v.likes, 0)::int as likes,
  coalesce(v.dislikes, 0)::int as dislikes,
  coalesce(c.comment_count, 0)::int as comment_count
from public.places p
left join (
  select place_id,
    count(*) filter (where value = 1) as likes,
    count(*) filter (where value = -1) as dislikes
  from public.votes group by place_id
) v on v.place_id = p.id
left join (
  select place_id, count(*) as comment_count from public.comments group by place_id
) c on c.place_id = p.id;

grant select, insert, update, delete on public.places, public.comments, public.votes, public.write_events to service_role;
grant select on public.place_summaries to service_role;
grant usage, select on all sequences in schema public to service_role;
