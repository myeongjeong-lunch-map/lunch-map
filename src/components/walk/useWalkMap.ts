"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, loadWalkDraft, saveWalkDraft, type WalkResponse } from "@/lib/api";
import {
  MAX_COURSE_STOPS,
  campusWalk as campusWalkOf,
  courseTime,
  legKey,
  type CourseTime,
  type WalkCourseStop,
  type WalkLeg,
  type WalkSpot,
} from "@/lib/domain";

/** 코스 하나를 화면에 그리는 데 필요한 것: 지워진 장소를 걸러 낸 정류장과 코스 시간 */
export type CourseView = {
  /** 추천 코스의 id. 내 코스면 null */
  id: string | null;
  /** 추천 코스 이름. 내 코스면 null */
  name: string | null;
  summary: string | null;
  stops: { stop: WalkCourseStop; spot: WalkSpot }[];
  /** 경로선에 넘길 정류장 id 순서 */
  stopIds: string[];
  time: CourseTime;
};

export type CampusWalk = ReturnType<typeof campusWalkOf>;

const EMPTY: WalkResponse = { spots: [], courses: [], legs: [] };

/** 산책 응답 하나와 내 코스 id 목록에서 화면이 쓸 값을 모두 계산한다 (순수 함수) */
export function buildWalkMap(walk: WalkResponse, draftSaved: string[]) {
  const spotMap = new Map<string, WalkSpot>(walk.spots.map((sp) => [sp.id, sp]));
  const legMap = new Map<string, WalkLeg>(walk.legs.map((l) => [legKey(l.a, l.b), l]));
  const view = (id: string | null, name: string | null, summary: string | null, raw: WalkCourseStop[]): CourseView => {
    // 지워진 장소가 코스에 남아 있으면 화면에서 거른다
    const stops = raw.filter((st) => spotMap.has(st.spot_id)).map((stop) => ({ stop, spot: spotMap.get(stop.spot_id)! }));
    return { id, name, summary, stops, stopIds: stops.map((s) => s.spot.id), time: courseTime(stops.map((s) => s.stop), spotMap, legMap) };
  };
  const draftIds = draftSaved.filter((id) => spotMap.has(id));
  const draftCourse = view(null, null, null, draftIds.map((id) => ({ spot_id: id, stay_minutes: null })));
  const recommended = walk.courses.map((c) => view(c.id, c.name, c.summary, c.stops)).filter((c) => c.stops.length > 0);
  return {
    spots: walk.spots,
    spotMap,
    recommended,
    draftIds,
    draftCourse,
    /** courseId가 null이면 내 코스. 없는 추천 코스는 빈 코스로 돌려준다 */
    course(courseId: string | null): CourseView {
      if (courseId === null) return draftCourse;
      const c = walk.courses.find((x) => x.id === courseId);
      return c ? view(c.id, c.name, c.summary, c.stops) : view(courseId, "산책 코스", null, []);
    },
    campusWalk: (spot: WalkSpot): CampusWalk => campusWalkOf(spot, legMap),
    /** 캠퍼스에서 이 장소까지의 구간 (지도 칩용) */
    campusLeg: (spotId: string): WalkLeg | undefined => legMap.get(legKey(null, spotId)),
  };
}

/**
 * 산책 지도: 산책 응답과 내 코스를 한 번 받아, 정류장·코스 시간·캠퍼스에서 걷는 시간과 내 코스 편집을 돌려준다.
 * 내 코스는 이 브라우저(localStorage)에만 남고, 저장은 이 안에서 처리한다.
 */
export function useWalkMap() {
  const [walk, setWalk] = useState<WalkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [maxMinutes, setMaxMinutes] = useState<30 | 45 | null>(null);

  useEffect(() => {
    // 마운트 시 산책 장소·코스를 불러오고, 이 브라우저에 기억해 둔 내 코스를 연다 (localStorage는 서버 렌더 때 읽을 수 없다)
    api
      .walk()
      .then((data) => setWalk(data))
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loadWalkDraft());
  }, []);

  const built = useMemo(() => buildWalkMap(walk ?? EMPTY, saved), [walk, saved]);
  const { draftIds } = built;

  const replace = useCallback((ids: string[]) => {
    setSaved(ids);
    saveWalkDraft(ids);
  }, []);

  const draft = useMemo(() => {
    const set = new Set(draftIds);
    const full = draftIds.length >= MAX_COURSE_STOPS;
    return {
      ids: draftIds,
      has: (id: string) => set.has(id),
      /** 가득 차면 더 담을 수 없다 */
      full,
      /** 담았으면 빼고, 아니면 담는다 (가득 찼으면 무시) */
      toggle: (id: string) => {
        if (set.has(id)) replace(draftIds.filter((x) => x !== id));
        else if (!full) replace([...draftIds, id]);
      },
      move: (index: number, delta: -1 | 1) => {
        const to = index + delta;
        if (to < 0 || to >= draftIds.length) return;
        const next = [...draftIds];
        [next[index], next[to]] = [next[to], next[index]];
        replace(next);
      },
      clear: () => replace([]),
      /** 내 코스를 통째로 바꾼다 (추천 코스 복사) */
      replace,
    };
  }, [draftIds, replace]);

  return {
    /** "loading" | "error" | "ready" */
    status: error ? ("error" as const) : walk ? ("ready" as const) : ("loading" as const),
    error,
    ...built,
    draft,
    /** 코스 시간 칩: 30·45분 이내만 보기 */
    maxMinutes,
    setMaxMinutes,
    /** 추천 코스 가운데 칩 조건에 맞는 것 */
    visibleCourses: useMemo(() => built.recommended.filter((c) => maxMinutes == null || c.time.totalMinutes <= maxMinutes), [built.recommended, maxMinutes]),
  };
}

export type WalkMap = ReturnType<typeof useWalkMap>;
