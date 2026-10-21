"use client";

import { useEffect, useState } from "react";
import { api, ApiError, loadNickname, saveNickname, type SearchResult } from "@/lib/api";
import { CATEGORIES, guessCategory, SOLO_DINING, SOLO_LABEL, type Category, type SoloDining } from "@/lib/domain";
import { CATEGORY_EMOJI } from "./NaverMap";

type Draft = { name: string; roadAddress: string; lat: number; lng: number; naverCategory: string | null };

type Props = {
  picked: { lat: number; lng: number } | null;
  onStartPick: () => void;
  onCancel: () => void;
  onDone: (id: string) => void;
  onOpenExisting: (id: string) => void;
};

// 가게 추가: 네이버 장소 검색이 기본, 검색에 없으면 지도에 핀을 직접 꽂는다.
export function AddPlace({ picked, onStartPick, onCancel, onDone, onOpenExisting }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [manual, setManual] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [solo, setSolo] = useState<SoloDining>("unknown");
  const [comment, setComment] = useState("");
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
  }, [picked]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults((await api.search(query)).results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: SearchResult) => {
    setDraft({ name: r.name, roadAddress: r.roadAddress, lat: r.lat, lng: r.lng, naverCategory: r.naverCategory });
    setCategory(guessCategory(r.naverCategory));
    setManual(false);
    setDuplicateId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !category) return;
    setSaving(true);
    setError(null);
    setDuplicateId(null);
    try {
      const { id } = await api.addPlace({ ...draft, category, soloDining: solo, comment, nickname, naverLink, website });
      saveNickname(nickname);
      onDone(id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && typeof err.data.placeId === "string") setDuplicateId(err.data.placeId);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">맛집 추가</h2>
        <button onClick={onCancel} className="text-sm font-semibold text-muted hover:text-foreground">
          취소
        </button>
      </div>

      {!draft && (
        <section className="space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="가게 이름 검색 (예: 카츠공방)" className={field} autoFocus />
            <button disabled={searching} className="shrink-0 rounded-lg bg-foreground px-4 text-sm font-bold text-white disabled:opacity-50">
              {searching ? "검색 중" : "검색"}
            </button>
          </form>
          {results && (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {results.length === 0 && <li className="p-4 text-sm text-muted">검색 결과가 없어요.</li>}
              {results.map((r) => (
                <li key={`${r.name}-${r.roadAddress}`}>
                  <button onClick={() => choose(r)} className="w-full px-3 py-3 text-left hover:bg-surface">
                    <span className="block text-sm font-bold">{r.name}</span>
                    <span className="block text-xs text-muted">
                      {r.naverCategory} · {r.roadAddress}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={onStartPick} className="w-full rounded-lg border border-dashed border-line py-3 text-sm font-semibold text-muted hover:bg-surface">
            📍 검색에 없어요 — 지도에서 위치 직접 고르기
          </button>
        </section>
      )}

      {draft && (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-surface p-3">
            {manual ? (
              <div className="space-y-2">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} placeholder="가게 이름" className={field} required />
                <input
                  value={draft.roadAddress}
                  onChange={(e) => setDraft({ ...draft, roadAddress: e.target.value })}
                  maxLength={200}
                  placeholder="주소"
                  className={field}
                  required
                />
                <button type="button" onClick={onStartPick} className="text-xs font-semibold text-brand">
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
              }}
              className="mt-2 block text-xs font-semibold text-muted underline"
            >
              다른 가게 고르기
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">카테고리</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${category === c ? "border-brand bg-brand text-white" : "border-line"}`}
                >
                  {CATEGORY_EMOJI[c]} {c}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">혼밥</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {SOLO_DINING.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSolo(s)}
                  className={`rounded-lg border py-2 text-[13px] font-semibold ${solo === s ? "border-brand bg-brand text-white" : "border-line"}`}
                >
                  {SOLO_LABEL[s].replace("혼밥 ", "")}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="first-comment">
              첫 한마디 <span className="font-normal text-muted">(선택)</span>
            </label>
            <textarea
              id="first-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="추천 메뉴, 가격, 가는 길…"
              className={`${field} resize-none`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="naver-link">
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
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
              {duplicateId && (
                <button type="button" onClick={() => onOpenExisting(duplicateId)} className="mt-1 block font-bold underline">
                  그 가게에 한마디 남기러 가기 →
                </button>
              )}
            </div>
          )}

          <button
            disabled={saving || !category || !draft.name.trim() || !draft.roadAddress.trim()}
            className="w-full rounded-xl bg-brand py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {saving ? "등록 중… (도보 시간 계산 중)" : "등록하기"}
          </button>
        </form>
      )}
    </div>
  );
}
