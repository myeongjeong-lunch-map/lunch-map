-- 할로윈 이벤트: 추첨 연출에 마녀의 솥(cauldron)을 더한다. 이벤트가 끝나도 기록 다시 보기에 쓰므로 값은 남겨 둔다.
alter table public.draw_boxes drop constraint if exists draw_boxes_animation_check;
alter table public.draw_boxes add constraint draw_boxes_animation_check check (animation in ('race', 'plinko', 'cauldron'));

alter table public.draw_results drop constraint if exists draw_results_animation_check;
alter table public.draw_results add constraint draw_results_animation_check check (animation in ('race', 'plinko', 'cauldron'));
