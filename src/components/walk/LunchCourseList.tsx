"use client";

import { useState } from "react";
import { PICNIC_EAT_MINUTES, type LunchCourse } from "@/lib/domain";

type Props = {
  /** lunchCourses()의 결과 (필요하면 한 가게로 거른 것) */
  courses: LunchCourse[];
  /** 이만큼만 먼저 보이고, 더 있으면 "n곳 더 보기". 없으면 모두 */
  limit?: number;
  /** 가게 이름 줄을 뺀다 (가게 카드 안에서) */
  compact?: boolean;
  onOpen: (c: LunchCourse) => void;
};

const MODE_EMOJI = { dine: "🚶", takeout: "🥡" } as const;
const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

/** 카드 둘째 줄 */
function detail(c: LunchCourse): string {
  const [cp, ps, cs] = c.legs.map((l) => l.seconds);
  if (c.mode === "dine") return `먹고 나서 걷기 ${minutes(ps + cs)}분 + 둘러보기 ${c.stayMinutes}분`;
  const wait = c.place.preorder ? "미리 주문 받기" : `포장 ${c.waitMinutes}분`;
  return `${wait} · ${c.spot.name}에서 먹기 ${PICNIC_EAT_MINUTES}분 · 걷기 ${minutes(cp + ps + cs)}분`;
}

/** 점심 코스 카드 목록. 산책 탭, 가게 카드, 추첨 결과가 모두 이 컴포넌트를 쓴다. 0개면 아무것도 그리지 않는다 */
export function LunchCourseList({ courses, limit, compact = false, onOpen }: Props) {
  const [all, setAll] = useState(false);
  if (courses.length === 0) return null;
  const shown = limit && !all ? courses.slice(0, limit) : courses;
  const rest = courses.length - shown.length;
  return (
    <ul className="space-y-2">
      {shown.map((c) => (
        <li key={`${c.mode}|${c.place.id}|${c.spot.id}`}>
          <button onClick={() => onOpen(c)} className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {MODE_EMOJI[c.mode]} {compact ? `→ ${c.spot.name}` : `${c.place.name} → ${c.spot.name}`}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{detail(c)}</span>
            </span>
            <span className="shrink-0 text-right leading-tight">
              <b className="block text-lg font-black text-brand">
                {c.rough ? "약 " : ""}
                {c.returnAt}
              </b>
              <span className="text-[11px] font-bold text-muted">복귀</span>
            </span>
          </button>
        </li>
      ))}
      {rest > 0 && (
        <li>
          <button onClick={() => setAll(true)} className="w-full py-1.5 text-xs font-bold text-muted hover:text-foreground">
            {rest}곳 더 보기
          </button>
        </li>
      )}
    </ul>
  );
}
