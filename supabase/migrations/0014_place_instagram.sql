-- 가게 인스타그램 계정 (GLOSSARY.md 「인스타 오늘의 메뉴」): 오늘의 메뉴를 인스타그램에 올리는 가게의 계정 아이디.
-- '@'와 주소 없이 아이디만 소문자로 둔다. 누구나 등록·수정할 수 있다.
-- place_summaries 뷰는 p.*를 만들 때의 칸만 알므로 이 칸은 places에서 따로 읽는다 (preorder·to_try와 같다).
alter table public.places add column if not exists instagram text;
alter table public.places drop constraint if exists places_instagram_check;
alter table public.places add constraint places_instagram_check check (instagram ~ '^[a-z0-9._]{1,30}$');
