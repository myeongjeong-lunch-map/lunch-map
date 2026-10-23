"use client";

import { LUNCH_MODES, MAX_COURSE_STOPS, WALK_KIND_EMOJI, formatMeters, type CourseTime, type LunchCourse, type Place } from "@/lib/domain";
import { Chip } from "@/components/place/PlaceList";
import { LunchCourseList } from "@/components/walk/LunchCourseList";
import { useLunchCourses } from "@/components/walk/useLunchCourses";
import type { CourseView, WalkMap } from "@/components/walk/useWalkMap";

type Props = {
  walk: WalkMap;
  places: Place[];
  onOpenCourse: (courseId: string) => void;
  onOpenSpot: (spotId: string) => void;
  onOpenLunch: (course: LunchCourse) => void;
};

/** 산책 장소 하나에 먼저 보이는 점심 코스 수 */
const LUNCH_PER_SPOT = 3;

/** "걷기 20분 + 둘러보기 10분 · 1.3km" */
export function courseBreakdown(ct: CourseTime): string {
  return `걷기 ${Math.round(ct.walkSeconds / 60)}분 + 둘러보기 ${ct.stayMinutes}분 · ${formatMeters(ct.meters)}`;
}

function RecommendedCard({ course, onOpen }: { course: CourseView; onOpen: (courseId: string) => void }) {
  const { stops, time } = course;
  return (
    <li>
      <button onClick={() => onOpen(course.id!)} className="w-full rounded-2xl border border-line p-4 text-left hover:bg-surface">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-bold">{course.name}</span>
          <b className="shrink-0 text-lg font-black text-brand">약 {time.totalMinutes}분</b>
        </span>
        <span className="mt-1 block text-[13px] text-foreground/80">🏫 → {stops.map(({ spot }) => `${WALK_KIND_EMOJI[spot.kind]} ${spot.name}`).join(" → ")} → 🏫</span>
        <span className="mt-0.5 block text-xs text-muted">{courseBreakdown(time)}</span>
        {course.summary && <span className="mt-1 block text-[13px] text-muted">{course.summary}</span>}
        {time.rough && <span className="mt-1 block text-[11px] text-muted/80">일부 구간은 어림값이에요</span>}
      </button>
    </li>
  );
}

export function WalkPanel({ walk, places, onOpenCourse, onOpenSpot, onOpenLunch }: Props) {
  const { draft, lunchMode } = walk;
  const { courses: lunch, basis } = useLunchCourses(walk, places, lunchMode);
  const lunchBySpot = walk.spots.flatMap((sp) => {
    const list = lunch.filter((c) => c.spot.id === sp.id);
    return list.length ? [{ spot: sp, list }] : [];
  });

  return (
    <div className="pb-6">
      <div className="flex items-baseline gap-2 px-5 pb-2 pt-2">
        <h2 className="text-sm font-black">🍱 점심 코스</h2>
        <span className="text-xs text-muted">{basis}</span>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2">
        {LUNCH_MODES.map((m) => (
          <Chip key={m.key} on={lunchMode === m.key} onClick={() => walk.setLunchMode(m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>
      {lunchBySpot.length === 0 ? (
        <p className="mx-4 rounded-2xl bg-surface p-5 text-center text-sm text-muted">점심시간 안에 다녀올 수 있는 점심 코스가 없어요</p>
      ) : (
        <div className="space-y-3 px-4">
          {lunchBySpot.map(({ spot, list }) => (
            <section key={spot.id}>
              <h3 className="pb-1.5 text-[13px] font-black">
                {WALK_KIND_EMOJI[spot.kind]} {spot.name}
              </h3>
              <LunchCourseList courses={list} limit={LUNCH_PER_SPOT} onOpen={onOpenLunch} />
            </section>
          ))}
        </div>
      )}

      <h2 className="px-5 pb-2 pt-6 text-sm font-black">추천 코스</h2>
      {walk.recommended.length === 0 && <p className="mx-4 rounded-2xl bg-surface p-6 text-center text-sm text-muted">아직 등록된 산책 코스가 없어요</p>}
      {walk.inLunchHour.length > 0 && (
        <>
          <h3 className="px-5 pb-1.5 text-[13px] font-black text-muted">점심시간에 다녀오기</h3>
          <ul className="space-y-2 px-4">
            {walk.inLunchHour.map((c) => (
              <RecommendedCard key={c.id} course={c} onOpen={onOpenCourse} />
            ))}
          </ul>
        </>
      )}
      {walk.relaxed.length > 0 && (
        <>
          <h3 className="px-5 pb-1.5 pt-4 text-[13px] font-black text-muted">여유 있는 날</h3>
          <ul className="space-y-2 px-4">
            {walk.relaxed.map((c) => (
              <RecommendedCard key={c.id} course={c} onOpen={onOpenCourse} />
            ))}
          </ul>
        </>
      )}

      <h2 className="px-5 pb-1 pt-5 text-sm font-black">직접 짜기</h2>
      <p className="px-5 pb-2 text-xs text-muted">지도나 아래 목록에서 장소를 골라 내 코스를 만들어요 (최대 {MAX_COURSE_STOPS}곳{draft.full ? " · 다 찼어요" : ""})</p>
      <ul>
        {walk.spots.length === 0 && <li className="p-8 text-center text-sm text-muted">아직 등록된 산책 장소가 없어요</li>}
        {walk.spots.map((sp) => {
          const picked = draft.has(sp.id);
          const campus = walk.campusWalk(sp);
          return (
            <li key={sp.id} className="flex items-stretch border-t border-line/60">
              <button onClick={() => onOpenSpot(sp.id)} className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-4 pr-2 text-left hover:bg-surface">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{WALK_KIND_EMOJI[sp.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{sp.name}</span>
                  {sp.summary && <span className="mt-0.5 block text-[13px] text-muted">{sp.summary}</span>}
                  <span className="mt-0.5 block text-xs font-bold text-foreground/80">
                    캠퍼스에서 걸어서 {campus.rough ? "약 " : ""}
                    {campus.minutes}분
                  </span>
                </span>
              </button>
              <button
                onClick={() => draft.toggle(sp.id)}
                aria-label={picked ? `${sp.name} 내 코스에서 빼기` : `${sp.name} 내 코스에 담기`}
                aria-pressed={picked}
                disabled={!picked && draft.full}
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
