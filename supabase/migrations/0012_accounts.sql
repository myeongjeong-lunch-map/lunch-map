-- 구글 로그인과 개인화 (GLOSSARY.md: 계정, 나, 즐겨찾기 / docs/adr/0008)
-- 사람은 "나" ID 하나로 구분한다. 로그인하면 'u:<auth.users.id>', 아니면 브라우저 쿠키(lm_voter) 값이다.
-- 평가·키워드·노점 확인·팀원처럼 이미 브라우저 ID를 담는 칸에 계정 ID를 그대로 넣으므로 그 칸들은 바꾸지 않는다.
-- 개인정보는 계정 ID와 사용자가 직접 정한 닉네임만 우리 테이블에 둔다. 이메일·이름·사진은 복사하지 않는다.

-- 1) 꿀팁을 쓴 사람: 내 기록에서 내 꿀팁을 모아 보려고 남긴다. 화면·API에는 내보내지 않는다.
--    이 칸이 생기기 전에 쓴 꿀팁은 누가 썼는지 모르므로 비워 둔다.
alter table public.tips add column if not exists author_id text;
create index if not exists tips_author_idx on public.tips(author_id) where author_id is not null;

-- 2) 즐겨찾기: 나 하나가 가게마다 하나
create table if not exists public.favorites (
  owner_id text not null,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, place_id)
);

-- 3) 계정 닉네임: 다른 기기에서도 같은 닉네임을 채운다. 계정을 지우면 같이 지워진다.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text check (char_length(nickname) between 1 and 20),
  updated_at timestamptz not null default now()
);

alter table public.favorites enable row level security;
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.favorites, public.profiles to service_role;

-- 4) 로그인할 때 이 브라우저(p_from)에 쌓인 기록을 계정(p_to)으로 옮긴다.
--    같은 가게·노점·팀에 둘 다 기록이 있으면 계정 것을 남긴다. 한 트랜잭션으로 돈다.
create or replace function public.claim_browser(p_from text, p_to text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;

  delete from votes b using votes a where b.voter_id = p_from and a.voter_id = p_to and a.place_id = b.place_id;
  update votes set voter_id = p_to where voter_id = p_from;

  -- 키워드는 가게마다 묶음으로 본다. 합치면 5개를 넘을 수 있으므로 계정에 하나라도 있으면 계정 묶음을 남긴다
  delete from place_keywords b
    where b.voter_id = p_from and exists (select 1 from place_keywords a where a.voter_id = p_to and a.place_id = b.place_id);
  update place_keywords set voter_id = p_to where voter_id = p_from;

  delete from favorites b using favorites a where b.owner_id = p_from and a.owner_id = p_to and a.place_id = b.place_id;
  update favorites set owner_id = p_to where owner_id = p_from;

  delete from stall_checks b using stall_checks a where b.voter_id = p_from and a.voter_id = p_to and a.stall_id = b.stall_id;
  update stall_checks set voter_id = p_to where voter_id = p_from;
  update street_stalls set reporter_id = p_to where reporter_id = p_from;

  update tips set author_id = p_to where author_id = p_from;

  -- 팀: 둘 다 팀원인 팀은 계정 쪽 팀원(닉네임)을 남긴다. 조장 자리와 추첨통에 넣은 가게는 계정으로 옮긴다
  delete from team_members b using team_members a where b.member_id = p_from and a.member_id = p_to and a.team_id = b.team_id;
  update team_members set member_id = p_to where member_id = p_from;
  update teams set leader_id = p_to where leader_id = p_from;
  update draw_entries set member_id = p_to where member_id = p_from;
end;
$$;

-- 함수는 기본으로 누구나 부를 수 있으므로 서버(service_role)만 부르게 막는다
revoke execute on function public.claim_browser(text, text) from public, anon, authenticated;
grant execute on function public.claim_browser(text, text) to service_role;
