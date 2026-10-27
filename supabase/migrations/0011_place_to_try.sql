-- 가 볼 곳: 아직 아무도 안 가 본 채로 등록한 가게 (GLOSSARY.md 「가 볼 곳」)
-- 첫 꿀팁이 달리면 정식 가게가 되므로 칸은 "그렇게 등록했다"만 남기고, 지금 가 볼 곳인지는 꿀팁 수와 함께 계산한다.
-- place_summaries 뷰는 p.*를 만들 때의 칸만 알므로 이 칸은 places에서 따로 읽는다 (preorder와 같다).
alter table public.places add column if not exists to_try boolean not null default false;
