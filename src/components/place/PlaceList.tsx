"use client";

import { CATEGORIES, KEYWORD_LABEL, KEYWORDS, topKeyword, walkingMinutes, type Category, type KeywordKey, type Place } from "@/lib/domain";
import { CATEGORY_COLOR, CATEGORY_EMOJI } from "@/components/place/categoryStyle";

export type Filters = {
  /** 고른 카테고리. 하나라도 맞으면 보여 주고, 비어 있으면 전체 */
  categories: Category[];
  /** 고른 키워드. 모두 가진 가게만 보여 준다 */
  keywords: KeywordKey[];
  maxMinutes: number | null;
  text: string;
};

export const DEFAULT_FILTERS: Filters = { categories: [], keywords: [], maxMinutes: null, text: "" };

export function isFiltered(f: Filters): boolean {
  return f.categories.length > 0 || f.keywords.length > 0 || f.maxMinutes != null || f.text.trim() !== "";
}

/** 칩 하나를 켜고 끈다 */
function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// 목록은 가까운 순. 카테고리는 고른 것 중 하나라도 맞으면, 키워드는 고른 키워드를 모두 한 명 이상 고른 가게만 남긴다.
export function applyFilters(places: Place[], f: Filters): Place[] {
  const text = f.text.trim().toLowerCase();
  return places
    .filter((p) => {
      if (f.categories.length && !f.categories.includes(p.category)) return false;
      if (f.keywords.some((k) => !(p.keywords[k] ?? 0))) return false;
      if (f.maxMinutes != null) {
        const m = walkingMinutes(p);
        if (m == null || m > f.maxMinutes) return false;
      }
      if (text && !`${p.name} ${p.naver_category ?? ""}`.toLowerCase().includes(text)) return false;
      return true;
    })
    .sort((a, b) => (a.walking_seconds ?? Infinity) - (b.walking_seconds ?? Infinity));
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${on ? "bg-brand text-brand-ink" : "bg-surface-2 text-foreground/75 hover:bg-line"}`}
    >
      {children}
    </button>
  );
}

export function CategoryDot({ category }: { category: Category }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[category] }} />;
}

export function Walking({ place }: { place: Place }) {
  const m = walkingMinutes(place);
  return <>🚶 {m == null ? "?" : `${place.walking_source === "estimate" ? "약 " : ""}${m}분`}</>;
}

type Props = {
  places: Place[];
  total: number;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onSelect: (id: string) => void;
  latestTip: Record<string, string>;
};

export function PlaceList({ places, total, filters, onFilters, onSelect, latestTip }: Props) {
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  return (
    <div className="pb-28">
      <div className="space-y-2 px-4 pb-3">
        <input
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="가게 이름으로 찾기"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
        />
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          <Chip on={filters.categories.length === 0} onClick={() => set({ categories: [] })}>
            전체
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} on={filters.categories.includes(c)} onClick={() => set({ categories: toggle(filters.categories, c) })}>
              {CATEGORY_EMOJI[c]} {c}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {KEYWORDS.map((k) => (
            <Chip key={k.key} on={filters.keywords.includes(k.key)} onClick={() => set({ keywords: toggle(filters.keywords, k.key) })}>
              {k.label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[5, 10].map((m) => (
            <Chip key={m} on={filters.maxMinutes === m} onClick={() => set({ maxMinutes: filters.maxMinutes === m ? null : m })}>
              🚶 {m}분 이내
            </Chip>
          ))}
          {isFiltered(filters) && (
            <button onClick={() => onFilters(DEFAULT_FILTERS)} className="ml-auto text-xs font-bold text-muted hover:text-foreground">
              초기화 ({places.length}/{total})
            </button>
          )}
        </div>
      </div>
      <ul>
        {places.length === 0 && <li className="p-8 text-center text-sm text-muted">{total ? "조건에 맞는 가게가 없어요" : "아직 등록된 가게가 없어요. 첫 맛집을 추가해 보세요!"}</li>}
        {places.map((p) => {
          const top = topKeyword(p);
          return (
            <li key={p.id}>
              <button onClick={() => onSelect(p.id)} className="flex w-full items-start gap-3 border-t border-line/60 px-4 py-3.5 text-left hover:bg-surface">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${CATEGORY_COLOR[p.category]}33` }}>
                  {CATEGORY_EMOJI[p.category]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate font-bold">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted">{p.category}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    <b className="text-foreground">
                      <Walking place={p} />
                    </b>
                    {top && ` · ${KEYWORD_LABEL[top.key]} ${top.count}`}
                  </span>
                  {latestTip[p.id] && <span className="mt-1 block truncate text-[13px] text-muted/80">“{latestTip[p.id]}”</span>}
                </span>
                <span className="shrink-0 text-right text-xs font-bold leading-5 text-muted">
                  👍 {p.likes}
                  <br />💡 {p.tip_count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
