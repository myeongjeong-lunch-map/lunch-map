-- 시안 E: 한마디 → 꿀팁, 혼밥 칸 → 키워드, 이번 주 랭킹용 평가 시각 (GLOSSARY.md 참고)

-- 1) 한마디(comments) → 꿀팁(tips)
alter table public.comments rename to tips;
alter index if exists public.comments_place_id_idx rename to tips_place_id_idx;

-- 2) 키워드: 브라우저 하나가 가게마다 최대 5개 (개수 제한은 서버에서 확인)
create table if not exists public.place_keywords (
  place_id uuid not null references public.places(id) on delete cascade,
  voter_id text not null,
  keyword text not null check (keyword in ('tasty','value','portion','fast','solo','group','nowait','takeout')),
  created_at timestamptz not null default now(),
  primary key (place_id, voter_id, keyword)
);
create index if not exists place_keywords_place_idx on public.place_keywords(place_id);
alter table public.place_keywords enable row level security;

-- 노션에서 옮긴 "혼밥 가능" 가게는 '혼밥 OK' 1표로 시작한다
insert into public.place_keywords (place_id, voter_id, keyword)
select id, 'notion-import', 'solo' from public.places where solo_dining = 'yes'
on conflict do nothing;

-- 3) 이번 주 랭킹: 평가를 바꾼 시각도 남긴다
alter table public.votes add column if not exists updated_at timestamptz not null default now();

-- 4) 혼밥 칸을 없애고 뷰를 다시 만든다
drop view if exists public.place_summaries;
alter table public.places drop column if exists solo_dining;
create view public.place_summaries
with (security_invoker = true) as
select
  p.*,
  coalesce(v.likes, 0)::int as likes,
  coalesce(v.dislikes, 0)::int as dislikes,
  coalesce(t.tip_count, 0)::int as tip_count
from public.places p
left join (
  select place_id,
    count(*) filter (where value = 1) as likes,
    count(*) filter (where value = -1) as dislikes
  from public.votes group by place_id
) v on v.place_id = p.id
left join (
  select place_id, count(*) as tip_count from public.tips group by place_id
) t on t.place_id = p.id;

grant select, insert, update, delete on public.tips, public.place_keywords to service_role;
grant select on public.place_summaries to service_role;
