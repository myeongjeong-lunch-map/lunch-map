import "server-only";
import { CAMPUS, estimateWalk, legPair, lunchPairNeeded, placeLegKey, type Category, type PlaceLeg, type WalkLeg } from "@/lib/domain";
import { db } from "./supabase";
import { tmapProvider, type LatLng, type RouteProvider, type WalkingPath } from "./tmap";

/**
 * 보행 경로 저장소: 캠퍼스 → 가게, 캠퍼스·산책 장소 사이 구간, 가게 → 산책 장소 구간의 보행 경로를
 * 계산(TMAP, 실패하면 추정값)하고 저장하고 매일 갱신하고, 읽을 때 24시간 신선도를 검사한다.
 *
 * 규칙 (docs/adr/0001, 0005, 0006)
 * - TMAP 데이터는 저장 후 24시간이 지나면 쓸 수 없다. 읽는 쪽에는 낡은 값이 나가지 않는다:
 *   낡은 시간·거리는 직선거리 추정값(source: "estimate")으로, 낡은 경로 좌표는 null로 대신한다.
 * - 구간의 짝(어느 쪽이 앞인가)과 방향 뒤집기는 이 모듈 안에서만 다룬다.
 */

const DAY_MS = 24 * 3600 * 1000;
const isFresh = (updatedAt: string | null | undefined) => !!updatedAt && Date.now() - new Date(updatedAt).getTime() < DAY_MS;

type Computed = { seconds: number; meters: number; source: "tmap" | "estimate"; path: WalkingPath | null };

// TMAP이 실패하면 추정값. 이때 경로 좌표는 없다.
async function compute(from: LatLng, to: LatLng, provider: RouteProvider): Promise<Computed> {
  try {
    return { ...(await provider(from, to)), source: "tmap" };
  } catch {
    return { ...estimateWalk(from, to), source: "estimate", path: null };
  }
}

export type RefreshReport = { updated: number; tmap: number; estimate: number };
const tally = (report: RefreshReport, w: Computed) => {
  report.updated++;
  report[w.source]++;
};

// ── 가게 (캠퍼스 → 가게) ─────────────────────────────

/** places 테이블에 넣을 walking_* 다섯 칸. 가게를 추가할 때 insert에 펼쳐 넣는다. */
const placeColumns = (w: Computed) => ({
  walking_seconds: w.seconds,
  walking_meters: w.meters,
  walking_source: w.source,
  walking_path: w.path,
  walking_updated_at: new Date().toISOString(),
});

export async function computePlaceWalking(lat: number, lng: number, provider: RouteProvider = tmapProvider) {
  return placeColumns(await compute(CAMPUS, { lat, lng }, provider));
}

/** 모든 가게의 도보 시간을 다시 계산해 저장한다 (매일 한 번). TMAP 호출 제한을 몰라 하나씩 부른다. */
export async function refreshPlaces(provider: RouteProvider = tmapProvider): Promise<RefreshReport> {
  const { data: places, error } = await db().from("places").select("id, lat, lng");
  if (error) throw error;
  const report: RefreshReport = { updated: 0, tmap: 0, estimate: 0 };
  for (const p of places ?? []) {
    const w = await compute(CAMPUS, p, provider);
    const { error: uErr } = await db().from("places").update(placeColumns(w)).eq("id", p.id);
    if (uErr) throw uErr;
    tally(report, w);
  }
  return report;
}

type PlaceWalkingRow = {
  lat: number;
  lng: number;
  walking_seconds: number | null;
  walking_meters: number | null;
  walking_source: "tmap" | "estimate" | null;
  walking_updated_at?: string | null;
};

/**
 * 가게 목록 응답용: 도보 시간이 24시간을 넘었으면 추정값으로 바꾸고, walking_updated_at은 빼서 돌려준다.
 * 아직 계산 전(walking_seconds 없음)인 가게는 그대로 둔다.
 */
export function withFreshWalking<T extends PlaceWalkingRow>(row: T): T {
  const { walking_updated_at, ...rest } = row;
  if (rest.walking_seconds == null || isFresh(walking_updated_at)) return rest as T;
  const w = estimateWalk(CAMPUS, rest);
  return { ...rest, walking_seconds: w.seconds, walking_meters: w.meters, walking_source: "estimate" } as T;
}

/** 캠퍼스 → 가게 경로 좌표. 가게가 없으면 undefined, 경로가 없거나 낡았으면 null. */
export async function readPlacePath(placeId: string): Promise<WalkingPath | null | undefined> {
  const { data, error } = await db().from("places").select("walking_path, walking_updated_at").eq("id", placeId).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return isFresh(data.walking_updated_at) ? (data.walking_path as WalkingPath | null) : null;
}

// ── 구간 (캠퍼스 ↔ 산책 장소, 산책 장소 ↔ 산책 장소) ──────────

type Spot = { id: string; lat: number; lng: number };

/** 모든 구간을 다시 계산해 저장한다 (매일 한 번). 가게 크론과 함수 시간을 나눠 쓰지 않게 따로 돌린다. */
export async function refreshLegs(provider: RouteProvider = tmapProvider): Promise<RefreshReport> {
  const { data, error } = await db().from("walk_spots").select("id, lat, lng");
  if (error) throw error;
  const spots: Spot[] = data ?? [];
  const report: RefreshReport = { updated: 0, tmap: 0, estimate: 0 };
  const save = async (from: string | null, to: string) => {
    const { a, b } = legPair(from, to);
    const point = (id: string | null): LatLng => (id === null ? CAMPUS : spots.find((s) => s.id === id)!);
    const w = await compute(point(a), point(b), provider);
    const { error: uErr } = await db()
      .from("walk_legs")
      .upsert(
        { spot_a: a, spot_b: b, seconds: w.seconds, meters: w.meters, source: w.source, path: w.path, updated_at: new Date().toISOString() },
        { onConflict: "spot_a,spot_b" },
      );
    if (uErr) throw uErr;
    tally(report, w);
  };
  for (const s of spots) await save(null, s.id);
  for (const x of spots) for (const y of spots) if (x.id < y.id) await save(x.id, y.id);
  return report;
}

/** 모든 구간의 시간·거리(경로 좌표 제외). 24시간이 지난 구간은 추정값으로 바꿔서 돌려준다. */
export async function readLegs(): Promise<WalkLeg[]> {
  const [legs, spots] = await Promise.all([
    db().from("walk_legs").select("spot_a, spot_b, seconds, meters, source, updated_at"),
    db().from("walk_spots").select("id, lat, lng"),
  ]);
  if (legs.error) throw legs.error;
  if (spots.error) throw spots.error;
  const byId = new Map((spots.data ?? []).map((s) => [s.id, s]));
  return (legs.data ?? []).flatMap((l): WalkLeg[] => {
    if (isFresh(l.updated_at)) return [{ a: l.spot_a, b: l.spot_b, seconds: l.seconds, meters: l.meters, source: l.source }];
    const from = l.spot_a === null ? CAMPUS : byId.get(l.spot_a);
    const to = byId.get(l.spot_b);
    return from && to ? [{ a: l.spot_a, b: l.spot_b, ...estimateWalk(from, to), source: "estimate" }] : [];
  });
}

/**
 * 캠퍼스 → stops → 캠퍼스, 걷는 방향으로 이은 구간별 경로 좌표 (stops.length + 1개).
 * 구간이 없거나 낡았으면 그 칸은 null. 저장 방향과 반대로 걷는 구간은 좌표를 뒤집어서 준다.
 */
export async function readCoursePaths(stops: string[]): Promise<(WalkingPath | null)[]> {
  // 코스에 든 장소끼리의 구간은 b가 코스 안에 있으면 모두 잡힌다
  const { data, error } = await db().from("walk_legs").select("spot_a, spot_b, path, updated_at").in("spot_b", stops);
  if (error) throw error;
  const byPair = new Map((data ?? []).map((r) => [`${r.spot_a ?? "campus"}|${r.spot_b}`, r]));
  const points: (string | null)[] = [null, ...stops, null];
  return points.slice(0, -1).map((from, i) => {
    const { a, b, forward } = legPair(from, points[i + 1]);
    const row = byPair.get(`${a ?? "campus"}|${b}`);
    const path = row && isFresh(row.updated_at) ? (row.path as WalkingPath | null) : null;
    return path && !forward ? [...path].reverse() : path;
  });
}

// ── 가게 구간 (가게 → 산책 장소) ──────────────────────
// 화면에 나올 수 있는 쌍(가게 구간에 최소치를 넣어도 점심 코스에 들어오는 쌍)만 TMAP으로 계산한다. docs/design/lunch-walk.md 3-3

/**
 * 점심 코스에 들어올 수 있는 가게 ↔ 산책 장소 쌍을 모두 TMAP으로 다시 계산해 저장하고, 들어올 수 없게 된 쌍은 지운다 (매일 한 번).
 * 기준이 가게·장소의 캠퍼스 값에 기대므로 가게 크론과 구간 크론이 끝난 뒤에 돌아야 한다.
 * TMAP이 실패한 쌍은 저장하지 않는다(어림값은 화면에서 계산한다). 보고의 estimate가 그 수다.
 */
export async function refreshPlaceLegs(provider: RouteProvider = tmapProvider): Promise<RefreshReport> {
  const [places, spots, campusLegs, takeoutKeywords, existing] = await Promise.all([
    db().from("places").select("id, lat, lng, category, preorder, walking_seconds"),
    db().from("walk_spots").select("id, lat, lng, stay_minutes, picnic"),
    db().from("walk_legs").select("spot_b, seconds").is("spot_a", null),
    db().from("place_keywords").select("place_id").eq("keyword", "takeout"),
    db().from("walk_place_legs").select("place_id, spot_id"),
  ]);
  for (const r of [places, spots, campusLegs, takeoutKeywords, existing]) if (r.error) throw r.error;
  const csBySpot = new Map((campusLegs.data ?? []).map((l) => [l.spot_b, l.seconds]));
  const withTakeoutKeyword = new Set((takeoutKeywords.data ?? []).map((k) => k.place_id));

  const pairs: { place: { id: string; lat: number; lng: number }; spot: { id: string; lat: number; lng: number } }[] = [];
  for (const p of places.data ?? []) {
    if (p.walking_seconds == null) continue;
    const place = { category: p.category as Category, preorder: !!p.preorder, keywords: withTakeoutKeyword.has(p.id) ? { takeout: 1 } : {} };
    for (const s of spots.data ?? []) {
      const cs = csBySpot.get(s.id);
      if (cs != null && lunchPairNeeded(place, { picnic: !!s.picnic, stay_minutes: s.stay_minutes }, p.walking_seconds, cs)) pairs.push({ place: p, spot: s });
    }
  }

  const report: RefreshReport = { updated: 0, tmap: 0, estimate: 0 };
  for (const { place, spot } of pairs) {
    const w = await compute(place, spot, provider);
    tally(report, w);
    if (w.source !== "tmap") continue;
    const { error: uErr } = await db()
      .from("walk_place_legs")
      .upsert(
        { place_id: place.id, spot_id: spot.id, seconds: w.seconds, meters: w.meters, path: w.path, updated_at: new Date().toISOString() },
        { onConflict: "place_id,spot_id" },
      );
    if (uErr) throw uErr;
  }

  const needed = new Set(pairs.map((x) => placeLegKey(x.place.id, x.spot.id)));
  for (const row of existing.data ?? []) {
    if (needed.has(placeLegKey(row.place_id, row.spot_id))) continue;
    const { error: dErr } = await db().from("walk_place_legs").delete().eq("place_id", row.place_id).eq("spot_id", row.spot_id);
    if (dErr) throw dErr;
  }
  return report;
}

/** 24시간 안의 가게 구간(경로 좌표 제외). 낡은 값은 내보내지 않는다 (화면이 최대치로 판정한다). 테이블이 아직 없으면 빈 목록 */
export async function readPlaceLegs(): Promise<PlaceLeg[]> {
  const { data, error } = await db().from("walk_place_legs").select("place_id, spot_id, seconds, meters, updated_at");
  // 마이그레이션 전에는 테이블이 없다. 점심 코스만 비고 나머지 산책 화면은 그대로 둔다
  if (error) return [];
  return (data ?? []).filter((l) => isFresh(l.updated_at)).map((l): PlaceLeg => ({ place_id: l.place_id, spot_id: l.spot_id, seconds: l.seconds, meters: l.meters, source: "tmap" }));
}

/** 가게 → 산책 장소 경로 좌표. 없거나 낡았으면 null (테이블이 아직 없어도 null) */
export async function readPlaceLegPath(placeId: string, spotId: string): Promise<WalkingPath | null> {
  const { data, error } = await db().from("walk_place_legs").select("path, updated_at").eq("place_id", placeId).eq("spot_id", spotId).maybeSingle();
  if (error) return null;
  return data && isFresh(data.updated_at) ? (data.path as WalkingPath | null) : null;
}
