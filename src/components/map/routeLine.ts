import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CAMPUS, formatMeters, type CourseTime, type Place, type WalkLeg, type WalkSpot } from "@/lib/domain";

/**
 * 지도에 그릴 경로 하나. 가게 경로선이든 산책 경로선이든 이 모양으로 만들어 NaverMap에 넘긴다.
 * - stops: 지도를 맞출 때 쓰는 들를 곳(캠퍼스 제외)
 * - path: 선을 이루는 점(경도, 위도). null이면 아직 받는 중이라 선은 나중에 그린다
 * - dashed: 저장된 보행 경로가 없어 직선으로 대신한 구간이 있으면 true
 * - chip: 선 가운데에 띄우는 "거리 · 도보 N분" 문구. 없으면 null
 */
export type RouteLine = { stops: { lat: number; lng: number }[]; path: [number, number][] | null; dashed: boolean; chip: string | null };

type LngLat = [number, number];
const CAMPUS_POINT: LngLat = [CAMPUS.lng, CAMPUS.lat];

/** 두 경로선의 칩이 같은 문구 형식을 쓰도록 여기서 한 번만 만든다: "640m · 도보 약 8분" */
export function routeChip(meters: number, seconds: number, rough: boolean): string {
  return `${formatMeters(meters)} · 도보 ${rough ? "약 " : ""}${Math.max(1, Math.round(seconds / 60))}분`;
}

/** key가 바뀌면 load를 다시 부른다. 늦게 온 이전 key의 응답은 버린다. undefined = 받는 중, null = 불러오지 못함 */
function useLoaded<T>(key: string | null, load: () => Promise<T>): T | null | undefined {
  const [state, setState] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load()
      .then((value) => !cancelled && setState({ key, value }))
      .catch(() => !cancelled && setState({ key, value: null }));
    return () => {
      cancelled = true;
    };
    // load는 key로 정해지므로 key가 바뀔 때만 다시 받는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state.value : undefined;
}

/** 선택한 가게까지의 경로선. 저장된 경로가 없으면(추정값, 아직 계산 전) 직선 점선으로 대신한다 */
export function usePlaceRouteLine(place: Place | null): RouteLine | null {
  const id = place?.id ?? null;
  const stored = useLoaded(id, async () => (await api.placePath(id!)).path);
  const lat = place?.lat;
  const lng = place?.lng;
  // 평가·꿀팁이 바뀌어도 선을 다시 그리지 않도록 칩 문구까지 값으로 뽑아 의존한다
  const chip =
    place && place.walking_seconds != null && place.walking_meters != null
      ? routeChip(place.walking_meters, place.walking_seconds, place.walking_source !== "tmap")
      : null;
  return useMemo(() => {
    if (id == null || lat == null || lng == null) return null;
    const stops = [{ lat, lng }];
    if (stored === undefined) return { stops, path: null, dashed: false, chip: null };
    return { stops, path: [CAMPUS_POINT, ...(stored ?? []), [lng, lat]], dashed: !stored, chip };
  }, [id, lat, lng, stored, chip]);
}

type WalkRouteInput = {
  /** 코스에서 들르는 순서대로 산책 장소 id. 캠퍼스는 넣지 않는다 */
  stopIds: string[];
  spots: Map<string, WalkSpot>;
  /** 코스를 볼 때: 이 코스의 시간 (칩은 걷는 시간만) */
  time: CourseTime | null;
  /** 장소 하나를 볼 때: 캠퍼스 → 그 장소 구간 (칩에 쓴다). 저장된 구간이 없으면 undefined */
  leg?: WalkLeg;
  /** true면 캠퍼스 → 첫 장소 한 구간만 그린다(장소 보기). false면 캠퍼스 → … → 캠퍼스 */
  oneWay: boolean;
};

/** 산책 코스·장소 경로선. 구간별 보행 경로를 받아 이어 붙인다 */
export function useWalkRouteLine({ stopIds, spots, time, leg, oneWay }: WalkRouteInput): RouteLine | null {
  const key = stopIds.length ? stopIds.join(",") : null;
  const stored = useLoaded(key, async () => (await api.walkPath(stopIds)).legs);

  // 칩은 값(문구)으로 뽑아 의존한다. 코스 시간 객체가 새로 만들어져도 선을 다시 그리지 않게
  let chip: string | null = null;
  if (oneWay) {
    if (leg) chip = routeChip(leg.meters, leg.seconds, leg.source !== "tmap");
  } else if (time) {
    chip = routeChip(time.meters, time.walkSeconds, time.rough);
  }

  return useMemo(() => {
    if (!key) return null;
    const onRoute = key.split(",").map((id) => spots.get(id)!);
    // 아직 받는 중이면 마커와 지도 맞춤만 하고 선은 나중에 그린다
    if (stored === undefined) return { stops: onRoute, path: null, dashed: false, chip: null };
    const points = [CAMPUS, ...onRoute, CAMPUS];
    const legCount = oneWay ? 1 : points.length - 1;
    const path: LngLat[] = [];
    let dashed = false;
    for (let i = 0; i < legCount; i++) {
      const from = points[i];
      const to = points[i + 1];
      const p = stored?.[i]?.path ?? null;
      if (!p) dashed = true;
      path.push([from.lng, from.lat], ...(p ?? []), [to.lng, to.lat]);
    }
    return { stops: onRoute, path, dashed, chip };
  }, [key, spots, stored, oneWay, chip]);
}
