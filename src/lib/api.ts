import type { KeywordKey, MyVote, Place, Tip } from "./domain";

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

export type SearchResult = { name: string; roadAddress: string; naverCategory: string; lat: number; lng: number };

export type PlacesResponse = { places: Place[]; myVotes: Record<string, MyVote>; myKeywords: Record<string, KeywordKey[]> };

export const api = {
  places: () => request<PlacesResponse>("/api/places"),
  addPlace: (body: Record<string, unknown>) => request<{ id: string }>("/api/places", { method: "POST", body: JSON.stringify(body) }),
  tips: (placeId: string) => request<{ tips: Tip[] }>(`/api/places/${placeId}/tips`),
  recentTips: () => request<{ tips: Tip[] }>("/api/tips?limit=60"),
  addTip: (placeId: string, body: Record<string, unknown>) => request<{ tip: Tip }>(`/api/places/${placeId}/tips`, { method: "POST", body: JSON.stringify(body) }),
  vote: (placeId: string, value: MyVote) => request<{ ok: true }>(`/api/places/${placeId}/vote`, { method: "PUT", body: JSON.stringify({ value }) }),
  setKeywords: (placeId: string, keywords: KeywordKey[]) =>
    request<{ ok: true }>(`/api/places/${placeId}/keywords`, { method: "PUT", body: JSON.stringify({ keywords }) }),
  search: (q: string) => request<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lng: number) => request<{ roadAddress: string | null }>(`/api/reverse?lat=${lat}&lng=${lng}`),
  adminStatus: () => request<{ admin: boolean }>("/api/admin"),
  adminLogin: (secret: string) => request<{ admin: boolean }>("/api/admin", { method: "POST", body: JSON.stringify({ secret }) }),
  adminUpdatePlace: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/admin/places/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  adminDeletePlace: (id: string) => request<{ ok: true }>(`/api/admin/places/${id}`, { method: "DELETE" }),
  adminDeleteTip: (id: string) => request<{ ok: true }>(`/api/admin/tips/${id}`, { method: "DELETE" }),
};

const NICKNAME_KEY = "lm_nickname";

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
}
