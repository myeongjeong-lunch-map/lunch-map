import type { StallCheckValue, StreetStall } from "./street";
import type { DrawAnimation, DrawLimit, DrawResult, KeywordKey, LunchMode, MyVote, Place, PlaceLeg, TeamDetail, TeamSummary, Tip, WalkCourse, WalkLeg, WalkSpot } from "./domain";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, (data.error as string) ?? "요청에 실패했어요.", data);
  return data as T;
}

/** 가게 검색 결과. meters는 캠퍼스에서의 직선거리 */
export type SearchResult = { name: string; roadAddress: string; naverCategory: string; lat: number; lng: number; meters: number };

export type PlacesResponse = {
  places: Place[];
  myVotes: Record<string, MyVote>;
  myKeywords: Record<string, KeywordKey[]>;
  /** 즐겨찾기한 가게 id, 최근에 담은 것부터 */
  myFavorites: string[];
};

/** 로그인한 계정. 로그인하지 않았으면 null */
export type Account = { nickname: string | null };

export type WalkResponse = { spots: WalkSpot[]; courses: WalkCourse[]; legs: WalkLeg[]; placeLegs: PlaceLeg[] };

export type WalkPathResponse = { legs: { path: [number, number][] | null }[] };

/** 점심 코스의 세 구간 경로: 캠퍼스 → 가게, 가게 → 산책 장소, 산책 장소 → 캠퍼스 */
export type LunchPathResponse = WalkPathResponse;

export const api = {
  places: () => request<PlacesResponse>("/api/places"),
  addPlace: (body: Record<string, unknown>) => request<{ id: string }>("/api/places", { method: "POST", body: JSON.stringify(body) }),
  placePath: (placeId: string) => request<{ path: [number, number][] | null }>(`/api/places/${placeId}/path`),
  walk: () => request<WalkResponse>("/api/walk"),
  walkPath: (stopIds: string[]) => request<WalkPathResponse>(`/api/walk/path?stops=${stopIds.join(",")}`),
  lunchPath: (placeId: string, spotId: string, mode: LunchMode) => request<LunchPathResponse>(`/api/walk/lunch-path?place=${placeId}&spot=${spotId}&mode=${mode}`),
  tips: (placeId: string) => request<{ tips: Tip[] }>(`/api/places/${placeId}/tips`),
  recentTips: () => request<{ tips: Tip[] }>("/api/tips?limit=60"),
  addTip: (placeId: string, body: Record<string, unknown>) => request<{ tip: Tip }>(`/api/places/${placeId}/tips`, { method: "POST", body: JSON.stringify(body) }),
  vote: (placeId: string, value: MyVote) => request<{ ok: true }>(`/api/places/${placeId}/vote`, { method: "PUT", body: JSON.stringify({ value }) }),
  setKeywords: (placeId: string, keywords: KeywordKey[]) =>
    request<{ ok: true }>(`/api/places/${placeId}/keywords`, { method: "PUT", body: JSON.stringify({ keywords }) }),
  favorite: (placeId: string, on: boolean) => request<{ ok: true }>(`/api/places/${placeId}/favorite`, { method: "PUT", body: JSON.stringify({ on }) }),
  setInstagram: (placeId: string, instagram: string, website: string) =>
    request<{ instagram: string | null }>(`/api/places/${placeId}/instagram`, { method: "PUT", body: JSON.stringify({ instagram, website }) }),
  me: () => request<{ account: Account | null }>("/api/me"),
  saveAccountNickname: (nickname: string) => request<{ ok: true }>("/api/me", { method: "PUT", body: JSON.stringify({ nickname }) }),
  myTips: () => request<{ tips: Tip[] }>("/api/me/tips"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  search: (q: string) => request<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lng: number) => request<{ roadAddress: string | null }>(`/api/reverse?lat=${lat}&lng=${lng}`),
  adminStatus: () => request<{ admin: boolean }>("/api/admin"),
  adminLogin: (secret: string) => request<{ admin: boolean }>("/api/admin", { method: "POST", body: JSON.stringify({ secret }) }),
  adminUpdatePlace: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/admin/places/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminDeletePlace: (id: string) => request<{ ok: true }>(`/api/admin/places/${id}`, { method: "DELETE" }),
  adminDeleteTip: (id: string) => request<{ ok: true }>(`/api/admin/tips/${id}`, { method: "DELETE" }),
  teams: () => request<{ teams: TeamSummary[] }>("/api/teams"),
  team: (id: string) => request<{ team: TeamDetail }>(`/api/teams/${id}`),
  createTeam: (body: { name: string; nickname: string; website: string }) => request<{ id: string }>("/api/teams", { method: "POST", body: JSON.stringify(body) }),
  joinTeam: (id: string, nickname: string) => request<{ ok: true }>(`/api/teams/${id}/members`, { method: "PUT", body: JSON.stringify({ nickname }) }),
  leaveTeam: (id: string) => request<{ ok: true }>(`/api/teams/${id}/members`, { method: "DELETE" }),
  openBox: (id: string, limit: DrawLimit) => request<{ ok: true }>(`/api/teams/${id}/box`, { method: "POST", body: JSON.stringify({ limit }) }),
  cancelBox: (id: string) => request<{ ok: true }>(`/api/teams/${id}/box`, { method: "DELETE" }),
  addEntry: (id: string, placeId: string) => request<{ ok: true }>(`/api/teams/${id}/box/entries`, { method: "POST", body: JSON.stringify({ placeId }) }),
  removeEntry: (id: string, placeId: string) => request<{ ok: true }>(`/api/teams/${id}/box/entries`, { method: "DELETE", body: JSON.stringify({ placeId }) }),
  draw: (id: string, animation: DrawAnimation) => request<{ result: DrawResult }>(`/api/teams/${id}/box/draw`, { method: "POST", body: JSON.stringify({ animation }) }),
  decide: (id: string) => request<{ ok: true }>(`/api/teams/${id}/box/decide`, { method: "POST" }),
  street: () => request<{ stalls: StreetStall[] }>("/api/street"),
  reportStall: (body: Record<string, unknown>) => request<{ id: string }>("/api/street", { method: "POST", body: JSON.stringify(body) }),
  checkStall: (id: string, value: StallCheckValue | null) => request<{ ok: true }>(`/api/street/${id}/check`, { method: "PUT", body: JSON.stringify({ value }) }),
  fixStall: (id: string) => request<{ ok: true }>(`/api/street/${id}`, { method: "PATCH", body: JSON.stringify({ fixed: true, website: "" }) }),
  adminRemoveStall: (id: string) => request<{ ok: true }>(`/api/admin/street/${id}`, { method: "DELETE" }),
};

const NICKNAME_KEY = "lm_nickname";

/** 구글 로그인 주소. 로그인 뒤 지금 보던 화면으로 돌아온다 */
export function loginUrl(): string {
  return `/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

// 로그인했으면 닉네임을 정할 때 계정에도 저장해 다른 기기에서 채운다 (useAccount가 켠다)
let syncNicknameToAccount = false;

export function setNicknameSync(on: boolean): void {
  syncNicknameToAccount = on;
}

export function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(v: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, v);
  } catch {
    // 저장 못 해도 동작에는 문제 없음
  }
  // 계정 저장이 실패해도 이 브라우저에는 남았으므로 알리지 않는다
  if (syncNicknameToAccount && v.trim()) api.saveAccountNickname(v.trim()).catch(() => {});
}

// 내 코스(산책 장소 id, 순서대로)도 이 브라우저에만 기억한다
const WALK_DRAFT_KEY = "lm_walk_draft";

export function loadWalkDraft(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(WALK_DRAFT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveWalkDraft(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(WALK_DRAFT_KEY, JSON.stringify(ids));
    else localStorage.removeItem(WALK_DRAFT_KEY);
  } catch {
    // 저장 못 해도 동작에는 문제 없음
  }
}

// 점심 코스에서 마지막으로 고른 방식도 이 브라우저에만 기억한다
const LUNCH_MODE_KEY = "lm_lunch_mode";

export function loadLunchMode(): LunchMode {
  try {
    return localStorage.getItem(LUNCH_MODE_KEY) === "takeout" ? "takeout" : "dine";
  } catch {
    return "dine";
  }
}

export function saveLunchMode(mode: LunchMode): void {
  try {
    localStorage.setItem(LUNCH_MODE_KEY, mode);
  } catch {
    // 저장 못 해도 동작에는 문제 없음
  }
}
