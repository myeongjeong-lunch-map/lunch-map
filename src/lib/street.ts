// 길거리 제보의 규칙 (GLOSSARY.md: 길거리 제보, 노점, 노점 확인 / docs/adr/0007).
// 지도에 보일지는 저장하지 않고 확인 기록으로 그때그때 계산한다. 서버와 화면이 같이 쓴다.
import { CAMPUS, haversine, type StallKind } from "./domain";

export type StallCheckValue = "here" | "gone" | "open" | "closed" | "quit";
export const DAILY_CHECKS = ["here", "gone"] as const satisfies readonly StallCheckValue[];
export const FIXED_CHECKS = ["open", "closed", "quit"] as const satisfies readonly StallCheckValue[];

/** 일일 노점이 마지막 "있다" 확인 뒤 보이는 시간 */
export const DAILY_HOURS = 6;
/** 고정 노점이 "오늘 열었어요" 없이 버티는 날 수 */
export const FIXED_DAYS = 14;
/** 일일 노점을 모두 내리는 시각 (한국 시각) */
export const DAILY_RESET_HOUR = 5;
/** 이만큼 쌓이면 내린다 (일일 "없어졌어요", 고정 "이제 안 나와요") */
export const REMOVE_VOTES = 2;
/** 제보할 수 있는 거리 (캠퍼스에서) */
export const REPORT_RADIUS_M = 2000;
/** 이 안에 종류가 하나라도 겹치는 노점이 있으면 새로 올리기 전에 그 노점인지 묻는다 */
export const DUPLICATE_RADIUS_M = 30;

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;

/** now 기준 가장 최근의 한국 시각 05:00 (일일 노점 정리 시각이자 "오늘"의 시작) */
export function dayStart(now: number): number {
  const shift = DAILY_RESET_HOUR * HOUR;
  return Math.floor((now + KST - shift) / DAY) * DAY + shift - KST;
}

export function isCheckFor(fixed: boolean, v: unknown): v is StallCheckValue {
  return (fixed ? (FIXED_CHECKS as readonly unknown[]) : (DAILY_CHECKS as readonly unknown[])).includes(v);
}

export function withinReportRadius(lat: number, lng: number): boolean {
  return haversine(CAMPUS.lat, CAMPUS.lng, lat, lng) <= REPORT_RADIUS_M;
}

export type StallRow = {
  id: string;
  /** 대표 종류 (kinds[0]) */
  kind: StallKind;
  kinds: StallKind[];
  memo: string | null;
  nickname: string | null;
  lat: number;
  lng: number;
  fixed: boolean;
  reporter_id: string;
  created_at: string;
  last_seen_at: string;
  removed_at: string | null;
};
export type CheckRow = { stall_id: string; voter_id: string; value: StallCheckValue; updated_at: string };

/** 화면으로 보내는 노점 하나. 제보한 브라우저 ID는 보내지 않는다 */
export type StreetStall = {
  id: string;
  /** 대표 종류: 처음 고른 것. 아이콘으로 쓴다 */
  kind: StallKind;
  /** 고른 종류 모두 (대표 종류가 맨 앞, 최대 3개) */
  kinds: StallKind[];
  memo: string | null;
  nickname: string | null;
  lat: number;
  lng: number;
  fixed: boolean;
  created_at: string;
  last_seen_at: string;
  /** 고정 노점의 오늘 상태: 누가 열었다고 했는지, 안 열었다고만 했는지, 아직 모르는지 */
  today: "open" | "closed" | null;
  /** 마지막 "있다" 확인 뒤에 쌓인 내리기 표 수 (일일 없어졌어요 / 고정 이제 안 나와요) */
  remove_votes: number;
  /** 오늘 열었어요 수 (고정) / 마지막 확인 뒤 아직 있어요 수 (일일) */
  seen_votes: number;
  /** 내 확인. 오늘 열었어요·오늘은 안 열었어요는 오늘 누른 것만 */
  my_check: StallCheckValue | null;
  /** 내가 제보한 노점인지 */
  is_mine: boolean;
};

/**
 * 노점이 지금 지도에 보이는지와 화면에 보낼 모습. 안 보이면 null.
 * - 일일: 마지막 "있다" 뒤 6시간, 오늘 05:00 이후에 본 것만. 그 뒤 "없어졌어요" 2번(제보한 사람은 1번)이면 내린다
 * - 고정: 마지막 "오늘 열었어요" 뒤 14일. 그 뒤 "이제 안 나와요" 2번이면 내린다
 */
export function viewStall(row: StallRow, checks: CheckRow[], now: number, me: string | null): StreetStall | null {
  if (row.removed_at) return null;
  const seen = Date.parse(row.last_seen_at);
  const today = dayStart(now);
  const after = (c: CheckRow) => Date.parse(c.updated_at) > seen;

  let removeVotes: number;
  let seenVotes: number;
  let status: StreetStall["today"] = null;
  if (row.fixed) {
    if (now - seen > FIXED_DAYS * DAY) return null;
    const quits = checks.filter((c) => c.value === "quit" && after(c));
    removeVotes = quits.length;
    if (removeVotes >= REMOVE_VOTES) return null;
    const todays = checks.filter((c) => Date.parse(c.updated_at) >= today);
    seenVotes = todays.filter((c) => c.value === "open").length;
    status = seenVotes > 0 ? "open" : todays.some((c) => c.value === "closed") ? "closed" : null;
  } else {
    if (now - seen > DAILY_HOURS * HOUR || seen < today) return null;
    const gones = checks.filter((c) => c.value === "gone" && after(c));
    removeVotes = gones.length;
    if (removeVotes >= REMOVE_VOTES || gones.some((c) => c.voter_id === row.reporter_id)) return null;
    seenVotes = checks.filter((c) => c.value === "here").length;
  }

  const mine = me ? checks.find((c) => c.voter_id === me) : undefined;
  const myCheck = mine && (mine.value === "open" || mine.value === "closed") && Date.parse(mine.updated_at) < today ? null : (mine?.value ?? null);
  return {
    id: row.id,
    kind: row.kind,
    kinds: row.kinds,
    memo: row.memo,
    nickname: row.nickname,
    lat: row.lat,
    lng: row.lng,
    fixed: row.fixed,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    today: status,
    remove_votes: removeVotes,
    seen_votes: seenVotes,
    my_check: myCheck,
    is_mine: !!me && row.reporter_id === me,
  };
}

/** 종류가 하나라도 겹치면서 30m 안에 이미 보이는 노점 */
export function findDuplicate(stalls: Pick<StreetStall, "id" | "kinds" | "lat" | "lng">[], kinds: readonly StallKind[], lat: number, lng: number) {
  return stalls.find((s) => s.kinds.some((k) => kinds.includes(k)) && haversine(s.lat, s.lng, lat, lng) <= DUPLICATE_RADIUS_M) ?? null;
}
