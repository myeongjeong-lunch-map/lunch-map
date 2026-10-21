-- 가게의 네이버 플레이스 ID (메뉴판·사진을 띄울 때 사용, docs/adr/0002)
alter table public.places add column if not exists naver_place_id text check (naver_place_id ~ '^[0-9]{1,20}$');

-- place_summaries는 p.* 로 만든 뷰라 새 컬럼을 포함하도록 다시 만든다
drop view if exists public.place_summaries;
create view public.place_summaries
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

grant select on public.place_summaries to service_role;
