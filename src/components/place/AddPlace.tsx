"use client";

import { useEffect, useState } from "react";
import { api, ApiError, loadNickname, saveNickname, type SearchResult } from "@/lib/api";
import { CATEGORIES, guessCategory, KEYWORDS, MAX_KEYWORDS_PER_PLACE, type Category, type KeywordKey } from "@/lib/domain";
import { CATEGORY_EMOJI } from "@/components/place/categoryStyle";

type Draft = { name: string; roadAddress: string; lat: number; lng: number; naverCategory: string | null };

type Props = {
  picked: { lat: number; lng: number } | null;
  onStartPick: () => void;
  onCancel: () => void;
  onDone: (id: string) => void;
  onOpenExisting: (id: string) => void;
  /** 검색 결과가 바뀌면 알린다. 지도에 번호 핀으로 찍는다 */
  onResults: (results: SearchResult[] | null) => void;
  /** 고른 검색 결과의 번호(0부터). 고르지 않았거나 직접 고른 위치면 null */
  onChosen: (index: number | null) => void;
  /** 지도에서 번호 핀을 누른 것. n은 같은 핀을 다시 눌러도 알 수 있게 늘어나는 값 */
  mapChoice: { index: number; n: number } | null;
};

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand";

function Pill({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-bold ${on ? "border-brand bg-brand text-brand-ink" : "border-line text-foreground/75 hover:bg-surface-2"} disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

// 가게 추가: 네이버 장소 검색이 기본, 검색에 없으면 지도에 핀을 직접 꽂는다.
export function AddPlace({ picked, onStartPick, onCancel, onDone, onOpenExisting, onResults, onChosen, mapChoice }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [manual, setManual] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [keywords, setKeywords] = useState<KeywordKey[]>([]);
  const [tip, setTip] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [naverLink, setNaverLink] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  // 지도에서 위치를 고르면 주소를 채운다
  useEffect(() => {
    if (!picked) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual(true);
    onChosen(null);
    setDraft((d) => ({ name: d?.name ?? "", roadAddress: "주소 찾는 중…", lat: picked.lat, lng: picked.lng, naverCategory: null }));
    api
      .reverse(picked.lat, picked.lng)
      .then(({ roadAddress }) => {
        if (!cancelled) setDraft((d) => (d ? { ...d, roadAddress: roadAddress ?? "" } : d));
      })
      .catch(() => !cancelled && setDraft((d) => (d ? { ...d, roadAddress: "" } : d)));
    return () => {
      cancelled = true;
    };
    // onChosen은 부모가 매번 새로 만드는 함수라 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const found = (await api.search(query)).results;
      setResults(found);
      onResults(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: SearchResult, index: number) => {
    setDraft({ name: r.name, roadAddress: r.roadAddress, lat: r.lat, lng: r.lng, naverCategory: r.naverCategory });
    setCategory(guessCategory(r.naverCategory));
    setManual(false);
    setDuplicateId(null);
    onChosen(index);
  };

  // 지도에서 번호 핀을 누르면 그 결과를 고른 것과 같다
  useEffect(() => {
    const r = mapChoice && results?.[mapChoice.index];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (r) choose(r, mapChoice.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapChoice]);

  const toggleKeyword = (k: KeywordKey) =>
    setKeywords((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : ks.length < MAX_KEYWORDS_PER_PLACE ? [...ks, k] : ks));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !category) return;
    setSaving(true);
    setError(null);
    setDuplicateId(null);
    try {
      const { id } = await api.addPlace({ ...draft, category, keywords, tip, nickname, naverLink, website });
      saveNickname(nickname);
      onDone(id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && typeof err.data.placeId === "string") setDuplicateId(err.data.placeId);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-5 pb-28 pt-1">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">맛집 추가</h2>
        <button onClick={onCancel} className="text-sm font-bold text-muted hover:text-foreground">
          취소
        </button>
      </div>

      {!draft && (
        <section className="space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="가게 이름 검색 (예: 카츠공방)" className={field} autoFocus />
            <button disabled={searching} className="shrink-0 rounded-xl bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50">
              {searching ? "검색 중" : "검색"}
            </button>
          </form>
          {results && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {results.length === 0 && <li className="p-4 text-sm text-muted">검색 결과가 없어요.</li>}
              {results.map((r, i) => (
                <li key={`${r.name}-${r.roadAddress}`}>
                  <button onClick={() => choose(r, i)} className="flex w-full gap-2.5 px-3 py-3 text-left hover:bg-surface">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-black text-background">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{r.name}</span>
                      <span className="block text-xs text-muted">
                        {r.naverCategory} · {r.roadAddress}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={onStartPick} className="w-full rounded-xl border border-dashed border-line py-3 text-sm font-bold text-muted hover:bg-surface">
            📍 검색에 없어요 — 지도에서 위치 직접 고르기
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </section>
      )}

      {draft && (
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-xl bg-surface p-3">
            {manual ? (
              <div className="space-y-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  maxLength={60}
                  placeholder="가게 이름"
                  className={field}
                  required
                />
                <input
                  value={draft.roadAddress}
                  onChange={(e) => setDraft({ ...draft, roadAddress: e.target.value })}
                  maxLength={200}
                  placeholder="주소"
                  className={field}
                  required
                />
                <button type="button" onClick={onStartPick} className="text-xs font-bold text-brand">
                  위치 다시 고르기
                </button>
              </div>
            ) : (
              <>
                <p className="font-bold">{draft.name}</p>
                <p className="text-xs text-muted">{draft.roadAddress}</p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setManual(false);
                setDuplicateId(null);
                setError(null);
                onChosen(null);
              }}
              className="mt-2 block text-xs font-bold text-muted underline"
            >
              다른 가게 고르기
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-black">카테고리</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Pill key={c} on={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_EMOJI[c]} {c}
                </Pill>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-black">
              이런 점이 좋았어요{" "}
              <span className="font-normal text-muted">
                (선택, {keywords.length}/{MAX_KEYWORDS_PER_PLACE})
              </span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {KEYWORDS.map((k) => (
                <Pill
                  key={k.key}
                  on={keywords.includes(k.key)}
                  disabled={!keywords.includes(k.key) && keywords.length >= MAX_KEYWORDS_PER_PLACE}
                  onClick={() => toggleKeyword(k.key)}
                >
                  {k.label}
                </Pill>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="mb-2 block text-sm font-black" htmlFor="first-tip">
              첫 꿀팁 <span className="font-normal text-muted">(선택)</span>
            </label>
            <textarea
              id="first-tip"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="추천 메뉴, 가격, 가는 길…"
              className={`${field} resize-none`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black" htmlFor="naver-link">
              네이버 지도 공유 링크 <span className="font-normal text-muted">(선택)</span>
            </label>
            <input
              id="naver-link"
              value={naverLink}
              onChange={(e) => setNaverLink(e.target.value)}
              maxLength={500}
              inputMode="url"
              placeholder="https://naver.me/..."
              className={field}
            />
            <p className="mt-1 text-xs text-muted">네이버 지도 앱에서 가게 → 공유 → 링크 복사. 넣으면 메뉴판·사진을 바로 볼 수 있어요.</p>
          </div>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="닉네임 (선택)" className={field} />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          {error && (
            <div className="rounded-xl bg-danger/15 p-3 text-sm text-danger">
              {error}
              {duplicateId && (
                <button type="button" onClick={() => onOpenExisting(duplicateId)} className="mt-1 block font-bold underline">
                  그 가게에 꿀팁 남기러 가기 →
                </button>
              )}
            </div>
          )}

          <button
            disabled={saving || !category || !draft.name.trim() || !draft.roadAddress.trim()}
            className="w-full rounded-2xl bg-brand py-3.5 text-[15px] font-black text-brand-ink disabled:opacity-40"
          >
            {saving ? "등록 중… (도보 시간 계산 중)" : "등록하기"}
          </button>
        </form>
      )}
    </div>
  );
}
