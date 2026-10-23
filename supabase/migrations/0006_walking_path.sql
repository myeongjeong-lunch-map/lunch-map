-- 캠퍼스 → 가게 보행 경로 좌표 ([경도, 위도] 배열). 지도에 경로선을 그릴 때 쓴다.
-- 도보 시간과 같이 TMAP에서 받으므로 매일 다시 계산해 덮어쓴다 (docs/adr/0001).
-- place_summaries 뷰에는 넣지 않는다: 목록 응답이 커지지 않도록 가게를 고를 때만 따로 받는다.
alter table public.places add column if not exists walking_path jsonb;
