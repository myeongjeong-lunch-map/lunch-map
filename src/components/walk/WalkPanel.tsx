"use client";

import { LUNCH_TIGHT_MINUTES, MAX_COURSE_STOPS, WALK_KIND_EMOJI, campusWalk, courseTime, formatMeters, type WalkCourse, type WalkLeg, type WalkSpot } from "@/lib/domain";
import { Chip } from "@/components/place/PlaceList";

type Props = {
  courses: WalkCourse[];
  spots: Map<string, WalkSpot>;
  spotList: WalkSpot[];
  legs: Map<string, WalkLeg>;
  /** 내 코스에 담은 장소 id */
  draft: Set<string>;
  /** 내 코스가 가득 찼으면 더 담을 수 없다 */
  draftFull: boolean;
  maxMinutes: 30 | 45 | null;
  onMaxMinutes: (m: 30 | 45 | null) => void;
  onOpenCourse: (courseId: string) => void;
  onOpenSpot: (spotId: string) => void;
  onToggleSpot: (spotId: string) => void;
};

/** "걷기 20분 + 둘러보기 10분 · 1.3km" */
export function courseBreakdown(ct: ReturnType<typeof courseTime>): string {
  return `걷기 ${Math.round(ct.walkSeconds / 60)}분 + 둘러보기 ${ct.stayMinutes}분 · ${formatMeters(ct.meters)}`;
}

export function WalkPanel({ courses, spots, spotList, legs, draft, draftFull, maxMinutes, onMaxMinutes, onOpenCourse, onOpenSpot, onToggleSpot }: Props) {
  const cards = courses
    .map((c) => {
      const stops = c.stops.filter((s) => spots.has(s.spot_id));
      return { course: c, stops, time: courseTime(stops, spots, legs) };
    })
    .filter((c) => c.stops.length > 0);
  const shown = cards.filter((c) => maxMinutes == null || c.time.totalMinutes <= maxMinutes);

  return (
    <div className="pb-6">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1">
        {([30, 45] as const).map((m) => (
          <Chip key={m} on={maxMinutes === m} onClick={() => onMaxMinutes(maxMinutes === m ? null : m)}>
            ⏱ {m}분 이내
          </Chip>
        ))}
      </div>

      <h2 className="px-5 pb-2 pt-2 text-sm font-black">추천 코스</h2>
      <ul className="space-y-2 px-4">
        {shown.length === 0 && (
          <li className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">
            {cards.length === 0 ? "아직 등록된 산책 코스가 없어요" : `${maxMinutes}분 안에 다녀올 수 있는 코스가 없어요`}
          </li>
        )}
        {shown.map(({ course, stops, time }) => (
          <li key={course.id}>
            <button onClick={() => onOpenCourse(course.id)} className="w-full rounded-2xl border border-line p-4 text-left hover:bg-surface">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{course.name}</span>
                <span className="shrink-0 text-right">
                  {time.totalMinutes > LUNCH_TIGHT_MINUTES && <span className="mr-1.5 text-[11px] font-bold text-muted">점심시간엔 빠듯</span>}
                  <b className="text-lg font-black text-brand">약 {time.totalMinutes}분</b>
                </span>
              </span>
              <span className="mt-1 block text-[13px] text-foreground/80">
                🏫 → {stops.map((s) => `${WALK_KIND_EMOJI[spots.get(s.spot_id)!.kind]} ${spots.get(s.spot_id)!.name}`).join(" → ")} → 🏫
              </span>
              <span className="mt-0.5 block text-xs text-muted">{courseBreakdown(time)}</span>
              {course.summary && <span className="mt-1 block text-[13px] text-muted">{course.summary}</span>}
              {time.rough && <span className="mt-1 block text-[11px] text-muted/80">일부 구간은 어림값이에요</span>}
            </button>
          </li>
        ))}
      </ul>

      <h2 className="px-5 pb-1 pt-5 text-sm font-black">직접 짜기</h2>
      <p className="px-5 pb-2 text-xs text-muted">지도나 아래 목록에서 장소를 골라 내 코스를 만들어요 (최대 {MAX_COURSE_STOPS}곳{draftFull ? " · 다 찼어요" : ""})</p>
      <ul>
        {spotList.length === 0 && <li className="p-8 text-center text-sm text-muted">아직 등록된 산책 장소가 없어요</li>}
        {spotList.map((sp) => {
          const picked = draft.has(sp.id);
          const walk = campusWalk(sp, legs);
          return (
            <li key={sp.id} className="flex items-stretch border-t border-line/60">
              <button onClick={() => onOpenSpot(sp.id)} className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-4 pr-2 text-left hover:bg-surface">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{WALK_KIND_EMOJI[sp.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{sp.name}</span>
                  {sp.summary && <span className="mt-0.5 block text-[13px] text-muted">{sp.summary}</span>}
                  <span className="mt-0.5 block text-xs font-bold text-foreground/80">
                    캠퍼스에서 걸어서 {walk.rough ? "약 " : ""}
                    {walk.minutes}분
                  </span>
                </span>
              </button>
              <button
                onClick={() => onToggleSpot(sp.id)}
                aria-label={picked ? `${sp.name} 내 코스에서 빼기` : `${sp.name} 내 코스에 담기`}
                aria-pressed={picked}
                disabled={!picked && draftFull}
                className="grid w-12 shrink-0 place-items-center hover:bg-surface disabled:opacity-30"
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-black ${picked ? "bg-brand text-brand-ink" : "border border-line text-muted"}`}>
                  {picked ? "✓" : "+"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
