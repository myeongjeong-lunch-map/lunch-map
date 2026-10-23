"use client";

import { lunchTimeline, type LunchCourse } from "@/lib/domain";

type Props = {
  course: LunchCourse;
  backLabel: string;
  onBack: () => void;
  onOpenPlace: (placeId: string) => void;
  onOpenSpot: (spotId: string) => void;
};

const MODE_EMOJI = { dine: "🚶", takeout: "🥡" } as const;

/** 점심 코스 자세히: 시간표와 지도 연결. 지도에는 세 구간이 그려진다 */
export function LunchCourseDetail({ course, backLabel, onBack, onOpenPlace, onOpenSpot }: Props) {
  const rows = lunchTimeline(course);
  return (
    <div className="px-5 pb-8 pt-1">
      <button onClick={onBack} className="py-2 text-sm font-bold text-muted hover:text-foreground">
        ← {backLabel}
      </button>
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-black">
          {MODE_EMOJI[course.mode]} {course.place.name} → {course.spot.name}
        </h2>
        <b className="shrink-0 text-xl font-black text-brand">
          {course.rough ? "약 " : ""}
          {course.returnAt} 복귀
        </b>
      </div>
      <p className="mt-1 text-xs text-muted">{course.mode === "dine" ? "가게에서 먹고 걷기" : "포장해서 산책 장소에서 먹기"}</p>
      <ol className="mt-4 space-y-2.5 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-3">
            <b className="w-12 shrink-0 tabular-nums">{r.at}</b>
            <span>{r.text}</span>
          </li>
        ))}
      </ol>
      {course.rough && <p className="mt-3 text-xs text-muted">일부 구간은 어림값이에요</p>}
      <div className="mt-5 flex gap-2">
        <button onClick={() => onOpenPlace(course.place.id)} className="flex-1 rounded-2xl border border-line py-3 text-sm font-bold hover:bg-surface">
          가게 카드 보기
        </button>
        <button onClick={() => onOpenSpot(course.spot.id)} className="flex-1 rounded-2xl border border-line py-3 text-sm font-bold hover:bg-surface">
          산책 장소 보기
        </button>
      </div>
    </div>
  );
}
