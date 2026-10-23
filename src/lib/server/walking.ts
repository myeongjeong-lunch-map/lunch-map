import "server-only";
import { CAMPUS, haversine } from "@/lib/domain";

/** 경로 좌표 [경도, 위도] 목록. 추정값이면 경로가 없다. */
export type WalkingPath = [number, number][];

export type Walking = { seconds: number; meters: number; source: "tmap" | "estimate"; path: WalkingPath | null };

type TmapFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { totalTime?: number; totalDistance?: number };
};

// 도보 시간은 TMAP 보행자 경로로 구한다. TMAP 약관상 저장 후 24시간이 지나면 다시 계산해야 한다.
// (docs/adr/0001-walking-time-daily-refresh.md)
export type LatLng = { lat: number; lng: number };

/** from → to 보행 경로. TMAP이 실패하면 직선거리 × 1.3 추정값 */
export async function computeRoute(from: LatLng, to: LatLng): Promise<Walking> {
  try {
    const res = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
      method: "POST",
      headers: { appKey: process.env.TMAP_APP_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        startX: String(from.lng),
        startY: String(from.lat),
        endX: String(to.lng),
        endY: String(to.lat),
        startName: "start",
        endName: "end",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`TMAP ${res.status}`);
    const json = (await res.json()) as { features?: TmapFeature[] };
    const props = json.features?.[0]?.properties;
    if (props?.totalTime == null || props.totalDistance == null) throw new Error("TMAP 응답에 경로가 없음");
    return { seconds: props.totalTime, meters: props.totalDistance, source: "tmap", path: tmapPath(json.features ?? []) };
  } catch {
    return estimateRoute(from, to);
  }
}

// TMAP이 실패하면 직선거리 × 1.3 을 시속 4km로 걸은 값으로 임시 추정한다.
export function estimateRoute(from: LatLng, to: LatLng): Walking {
  const meters = Math.round(haversine(from.lat, from.lng, to.lat, to.lng) * 1.3);
  return { seconds: Math.round(meters / (4000 / 3600)), meters, source: "estimate", path: null };
}

// 가게의 도보 시간은 늘 캠퍼스에서 잰다
export const computeWalking = (lat: number, lng: number) => computeRoute(CAMPUS, { lat, lng });
export const estimateWalking = (lat: number, lng: number) => estimateRoute(CAMPUS, { lat, lng });

// TMAP 응답은 갈림길(Point)과 구간(LineString)이 번갈아 온다. 구간 좌표를 이어 붙이고 겹치는 끝점은 뺀다.
function tmapPath(features: TmapFeature[]): WalkingPath | null {
  const path: WalkingPath = [];
  for (const f of features) {
    if (f.geometry?.type !== "LineString" || !Array.isArray(f.geometry.coordinates)) continue;
    for (const c of f.geometry.coordinates as [number, number][]) {
      const pt: [number, number] = [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];
      const last = path[path.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) path.push(pt);
    }
  }
  return path.length >= 2 ? path : null;
}
