"use client";

import { CATEGORIES, SOLO_LABEL, walkingMinutes, type Category, type MyVote, type Place } from "@/lib/domain";
import { CATEGORY_EMOJI } from "./NaverMap";

export type Filters = {
  category: Category | "all";
  soloOnly: boolean;
  maxMinutes: number | null;
  sort: "walking" | "likes";
  text: string;
};

export const DEFAULT_FILTERS: Filters = { category: "all", soloOnly: false, maxMinutes: null, sort: "walking", text: "" };

export function applyFilters(places: Place[], f: Filters): Place[] {
  const text = f.text.trim().toLowerCase();
  const list = places.filter((p) => {
    if (f.category !== "all" && p.category !== f.category) return false;
    if (f.soloOnly && p.solo_dining !== "yes") return false;
    if (f.maxMinutes != null) {
      const m = walkingMinutes(p);
      if (m == null || m > f.maxMinutes) return false;
    }
    if (text && !`${p.name} ${p.naver_category ?? ""}`.toLowerCase().includes(text)) return false;
    return true;
  });
  const walk = (p: Place) => p.walking_seconds ?? Number.MAX_SAFE_INTEGER;
  return list.sort((a, b) => (f.sort === "likes" ? b.likes - b.dislikes - (a.likes - a.dislikes) || walk(a) - walk(b) : walk(a) - walk(b)));
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-foreground hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

type Props = {
  places: Place[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onSelect: (id: string) => void;
  myVotes: Record<string, MyVote>;
};

export function PlaceList({ places, total, loading, error, filters, onFilters, onSelect, myVotes }: Props) {
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });
  const filtered = places.length !== total;

  return (
    <div>
      <div className="sticky top-0 z-10 space-y-2.5 border-b border-line bg-white px-4 pb-3 pt-3">
        <input
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="가게 이름으로 찾기"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
        />
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          <Chip active={filters.category === "all"} onClick={() => set({ category: "all" })}>
            전체
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={filters.category === c} onClick={() => set({ category: filters.category === c ? "all" : c })}>
              {CATEGORY_EMOJI[c]} {c}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={filters.soloOnly} onClick={() => set({ soloOnly: !filters.soloOnly })}>
            🙋 혼밥 가능
          </Chip>
          <select
            value={filters.maxMinutes ?? ""}
            onChange={(e) => set({ maxMinutes: e.target.value ? Number(e.target.value) : null })}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold outline-none ${filters.maxMinutes ? "border-brand text-brand" : "border-line"}`}
          >
            <option value="">🚶 도보 전체</option>
            <option value="5">5분 이내</option>
            <option value="10">10분 이내</option>
            <option value="15">15분 이내</option>
          </select>
          <div className="ml-auto flex overflow-hidden rounded-full border border-line text-[13px] font-semibold">
            <button onClick={() => set({ sort: "walking" })} className={`px-2.5 py-1.5 ${filters.sort === "walking" ? "bg-foreground text-white" : ""}`}>
              가까운순
            </button>
            <button onClick={() => set({ sort: "likes" })} className={`px-2.5 py-1.5 ${filters.sort === "likes" ? "bg-foreground text-white" : ""}`}>
              좋아요순
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>
      ) : error ? (
        <p className="p-6 text-center text-sm text-red-500">{error}</p>
      ) : places.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          {filtered ? (
            <>
              조건에 맞는 가게가 없어요.
              <button className="mt-2 block w-full font-semibold text-brand" onClick={() => onFilters(DEFAULT_FILTERS)}>
                필터 초기화
              </button>
            </>
          ) : (
            "아직 등록된 가게가 없어요. 첫 맛집을 추가해 보세요!"
          )}
        </div>
      ) : (
        <ul>
          {filtered && <li className="px-4 pt-3 text-xs text-muted">{places.length}곳 표시 중 (전체 {total}곳)</li>}
          {places.map((p) => (
            <li key={p.id}>
              <button onClick={() => onSelect(p.id)} className="flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left hover:bg-surface">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#effbf4] text-xl">{CATEGORY_EMOJI[p.category]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-[15px] font-bold">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted">{p.category}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
                    <WalkingBadge place={p} />
                    <span>{SOLO_LABEL[p.solo_dining]}</span>
                    {p.comment_count > 0 && <span>💬 {p.comment_count}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[13px]">
                  <span className={`block ${myVotes[p.id] === 1 ? "font-bold text-brand" : "text-muted"}`}>👍 {p.likes}</span>
                  <span className={`block ${myVotes[p.id] === -1 ? "font-bold text-red-500" : "text-muted"}`}>👎 {p.dislikes}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WalkingBadge({ place }: { place: Place }) {
  const m = walkingMinutes(place);
  if (m == null) return <span>🚶 계산 중</span>;
  return (
    <span className="font-semibold text-foreground">
      🚶 도보 {place.walking_source === "estimate" ? "약 " : ""}
      {m}분
    </span>
  );
}
