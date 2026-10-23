"use client";

import { useMemo, useState } from "react";
import { LUNCH_START, clock, lunchStart, type LunchCourse, type LunchMode, type Place } from "@/lib/domain";
import type { WalkMap } from "@/components/walk/useWalkMap";

/** 카드 제목 옆에 붙이는 기준 시각: 포장해서 먹기는 점심시간 중이면 "지금 나가면", 그 밖에는 "12:50에 나가면" */
function basisLabel(mode: LunchMode, now: Date): string {
  return mode === "takeout" && lunchStart(now).fromNow ? "지금 나가면" : `${clock(LUNCH_START.h * 60 + LUNCH_START.m)}에 나가면`;
}

/**
 * 점심 코스 목록. 시계는 이 훅을 쓰는 화면이 열릴 때 한 번만 읽는다 (1분마다 다시 그리지 않는다. docs/design/lunch-walk.md 3-5).
 * mode가 "all"이면 두 방식을 합쳐 복귀 시각 순으로 돌려준다. placeId를 주면 그 가게의 것만.
 */
export function useLunchCourses(walk: WalkMap, places: Place[], mode: LunchMode | "all", placeId?: string): { courses: LunchCourse[]; basis: string } {
  const [now] = useState(() => new Date());
  return useMemo(() => {
    const pool = placeId ? places.filter((p) => p.id === placeId) : places;
    const modes: LunchMode[] = mode === "all" ? ["dine", "takeout"] : [mode];
    const courses = modes
      .flatMap((m) => walk.lunch(m, pool, now))
      .sort((a, b) => a.startMinutes + a.totalMinutes - (b.startMinutes + b.totalMinutes));
    return { courses, basis: basisLabel(mode === "all" ? "dine" : mode, now) };
  }, [walk, places, mode, placeId, now]);
}
