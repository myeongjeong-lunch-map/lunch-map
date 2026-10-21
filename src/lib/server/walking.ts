import "server-only";
import { CAMPUS } from "@/lib/domain";

export type Walking = { seconds: number; meters: number; source: "tmap" | "estimate" };

// 도보 시간은 TMAP 보행자 경로로 구한다. TMAP 약관상 저장 후 24시간이 지나면 다시 계산해야 한다.
// (docs/adr/0001-walking-time-daily-refresh.md)
export async function computeWalking(lat: number, lng: number): Promise<Walking> {
  try {
    const res = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
      method: "POST",
      headers: { appKey: process.env.TMAP_APP_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        startX: String(CAMPUS.lng),
        startY: String(CAMPUS.lat),
        endX: String(lng),
        endY: String(lat),
        startName: "campus",
        endName: "place",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`TMAP ${res.status}`);
    const json = (await res.json()) as { features?: { properties?: { totalTime?: number; totalDistance?: number } }[] };
    const props = json.features?.[0]?.properties;
    if (props?.totalTime == null || props.totalDistance == null) throw new Error("TMAP 응답에 경로가 없음");
    return { seconds: props.totalTime, meters: props.totalDistance, source: "tmap" };
  } catch {
    return estimateWalking(lat, lng);
  }
}

// TMAP이 실패하면 직선거리 × 1.3 을 시속 4km로 걸은 값으로 임시 추정한다.
export function estimateWalking(lat: number, lng: number): Walking {
  const meters = Math.round(haversine(CAMPUS.lat, CAMPUS.lng, lat, lng) * 1.3);
  return { seconds: Math.round(meters / (4000 / 3600)), meters, source: "estimate" };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
