-- 다시 뽑기: 추첨통 하나에서 회차마다 뽑힌 가게를 남긴다 (GLOSSARY.md, docs/adr/0004 참고)
-- 추첨통은 조장이 결정할 때까지 열려 있고, 결정하면 draw_boxes.status = 'drawn'과 result_place_id(결정한 가게)가 된다.

create table if not exists public.draw_results (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.draw_boxes(id) on delete cascade,
  round int not null check (round >= 1),
  place_id uuid references public.places(id) on delete set null,
  animation text not null check (animation in ('race', 'plinko')),
  drawn_at timestamptz not null default now(),
  unique (box_id, round)
);

-- 이미 끝난 추첨은 1회차 결과로 옮겨 둔다 (다시 보기에 쓴다)
insert into public.draw_results (box_id, round, place_id, animation, drawn_at)
select id, 1, result_place_id, animation, drawn_at
from public.draw_boxes
where status = 'drawn' and animation is not null and drawn_at is not null
on conflict (box_id, round) do nothing;

alter table public.draw_results enable row level security;
grant select, insert, update, delete on public.draw_results to service_role;
