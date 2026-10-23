"use client";

import { Fragment } from "react";
import { WALK_KIND_EMOJI, formatMeters, naverMapUrl, type CourseTime, type WalkCourseStop, type WalkSpot } from "@/lib/domain";
import { courseBreakdown } from "./WalkPanel";

type Props = {
  /** 추천 코스 이름. 내 코스면 null */
  name: string | null;
  summary: string | null;
  stops: WalkCourseStop[];
  spots: Map<string, WalkSpot>;
  time: CourseTime;
  backLabel: string;
  onBack: () => void;
  onOpenSpot: (spotId: string) => void;
  /** 내 코스일 때만: 순서 바꾸기·빼기 */
  onMove?: (index: number, delta: -1 | 1) => void;
  onRemove?: (spotId: string) => void;
  /** 추천 코스일 때만: 이 코스를 내 코스로 복사 */
  onCopy?: () => void;
};

const mins = (seconds: number) => Math.max(1, Math.round(seconds / 60));

export function CourseDetail({ name, summary, stops, spots, time, backLabel, onBack, onOpenSpot, onMove, onRemove, onCopy }: Props) {
  const editable = !!onMove && !!onRemove;
  const leg = (i: number) => {
    const l = time.legs[i];
    return (
      <li className="ml-3 border-l-2 border-dashed border-line py-2 pl-4 text-xs text-muted">
        걸어서 {l.source === "tmap" ? "" : "약 "}
        {mins(l.seconds)}분 · {formatMeters(l.meters)}
      </li>
    );
  };
  return (
    <div className="px-5 pb-8 pt-1">
      <button onClick={onBack} className="py-2 text-sm font-bold text-muted hover:text-foreground">
        ← {backLabel}
      </button>
      <h2 className="text-xl font-black">{name ?? "내 코스"}</h2>
      {summary && <p className="mt-1 text-sm text-muted">{summary}</p>}
      {stops.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface p-6 text-center text-sm text-muted">아직 담은 장소가 없어요. 산책 목록에서 ＋를 눌러 보세요.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            <b className="text-lg font-black text-brand">약 {time.totalMinutes}분</b>
            <span className="text-muted"> · {courseBreakdown(time)}</span>
          </p>
          <ol className="mt-4 text-sm">
            <li className="font-bold">🏫 캠퍼스 출발</li>
            {leg(0)}
            {stops.map((st, i) => {
              const sp = spots.get(st.spot_id)!;
              const stay = st.stay_minutes ?? sp.stay_minutes;
              return (
                <Fragment key={st.spot_id}>
                  <li className="flex items-center gap-2">
                    <button onClick={() => onOpenSpot(sp.id)} className="min-w-0 flex-1 text-left font-bold hover:underline">
                      <span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-full bg-brand text-xs text-brand-ink">{i + 1}</span>
                      {WALK_KIND_EMOJI[sp.kind]} {sp.name}
                      <span className="ml-1.5 text-xs font-normal text-muted">{stay > 0 ? `둘러보기 ${stay}분` : "지나가기만"}</span>
                    </button>
                    <a
                      href={naverMapUrl({ name: sp.name, road_address: "서울 서초구", naver_place_id: sp.naver_place_id })}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-surface"
                    >
                      네이버 지도
                    </a>
                    {editable && (
                      <span className="flex shrink-0 gap-1">
                        <button onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`${sp.name} 앞으로`} className="h-7 w-7 rounded-full border border-line text-xs disabled:opacity-30">
                          ↑
                        </button>
                        <button
                          onClick={() => onMove(i, 1)}
                          disabled={i === stops.length - 1}
                          aria-label={`${sp.name} 뒤로`}
                          className="h-7 w-7 rounded-full border border-line text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button onClick={() => onRemove(sp.id)} aria-label={`${sp.name} 빼기`} className="h-7 w-7 rounded-full border border-line text-xs">
                          ✕
                        </button>
                      </span>
                    )}
                  </li>
                  {leg(i + 1)}
                </Fragment>
              );
            })}
            <li className="font-bold">🏫 캠퍼스 도착</li>
          </ol>
          {time.rough && <p className="mt-3 text-xs text-muted">일부 구간은 어림값이에요</p>}
        </>
      )}
      {onCopy && (
        <button onClick={onCopy} className="mt-5 w-full rounded-2xl bg-brand py-3 text-sm font-black text-brand-ink active:scale-[0.98]">
          이 코스로 내 코스 만들기
        </button>
      )}
    </div>
  );
}
