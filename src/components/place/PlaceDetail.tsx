"use client";

import { useEffect, useRef, useState } from "react";
import { api, loadNickname, saveNickname } from "@/lib/api";
import { KEYWORDS, MAX_KEYWORDS_PER_PLACE, naverMapUrl, timeAgo, type KeywordKey, type MyVote, type Place, type TeamSummary, type Tip } from "@/lib/domain";
import { canPutIntoBox } from "@/lib/drawBox";
import type { PlaceTab } from "@/lib/naverPlaceId";
import { CATEGORY_COLOR, CATEGORY_EMOJI } from "@/components/place/categoryStyle";
import { CategoryDot, Walking } from "@/components/place/PlaceList";

const NAVER_TABS: { key: PlaceTab; label: string }[] = [
  { key: "menu", label: "📋 메뉴판" },
  { key: "photo", label: "📷 사진" },
  { key: "review", label: "⭐ 리뷰" },
];

type Props = {
  place: Place;
  rank: number;
  backLabel: string;
  myVote: MyVote;
  myKeywords: KeywordKey[];
  onVote: (v: MyVote) => void;
  onKeywords: (k: KeywordKey[]) => void;
  onBack: () => void;
  onTipAdded: (tip: Tip) => void;
  /** 열려 있는 네이버 플레이스 탭 */
  openTab: PlaceTab | undefined;
  onOpenTab: (t: PlaceTab) => void;
  /** 추첨통이 열려 있는 내 팀들. 비어 있으면 추첨통에 넣기 버튼을 숨긴다. */
  drawTeams: TeamSummary[];
  onAddToBox: (teamId: string) => Promise<void>;
  /** 🎲 후보로 담았는지 */
  dicePicked: boolean;
  onDicePick: () => void;
};

export function PlaceDetail({ place, rank, backLabel, myVote, myKeywords, onVote, onKeywords, onBack, onTipAdded, openTab, onOpenTab, drawTeams, onAddToBox, dicePicked, onDicePick }: Props) {
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bodyMissing, setBodyMissing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [boxError, setBoxError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  // 방금 넣은 팀. at은 연달아 넣을 때 효과를 다시 틀기 위한 key
  const [added, setAdded] = useState<{ teamId: string; at: number } | null>(null);
  const addSeq = useRef(0);

  const addToBox = async (t: TeamSummary) => {
    setBoxError(null);
    setAdding(t.id);
    try {
      await onAddToBox(t.id);
      const at = ++addSeq.current;
      setAdded({ teamId: t.id, at });
      navigator.vibrate?.(40);
      setTimeout(() => setAdded((a) => (a?.at === at ? null : a)), 2500);
    } catch (err) {
      setBoxError((err as Error).message);
    } finally {
      setAdding(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .tips(place.id)
      .then((d) => !cancelled && setTips(d.tips))
      .catch(() => !cancelled && setTips([]));
    return () => {
      cancelled = true;
    };
  }, [place.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 버튼을 막아 두지 않고, 눌렀을 때 무엇이 빠졌는지 알려 준다
    if (!body.trim()) {
      setBodyMissing(true);
      bodyRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { tip } = await api.addTip(place.id, { body, nickname, website });
      setTips((t) => [tip, ...(t ?? [])]);
      setBody("");
      saveNickname(nickname);
      onTipAdded(tip);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const toggleKeyword = (k: KeywordKey) => {
    if (myKeywords.includes(k)) onKeywords(myKeywords.filter((x) => x !== k));
    else if (myKeywords.length < MAX_KEYWORDS_PER_PLACE) onKeywords([...myKeywords, k]);
  };

  const keywordRows = KEYWORDS.map((k) => ({ ...k, n: place.keywords[k.key] ?? 0 }))
    .filter((k) => k.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxKeyword = Math.max(1, ...keywordRows.map((r) => r.n));

  return (
    <div className="px-5 pb-28 pt-1">
      <button onClick={onBack} className="text-sm font-bold text-muted hover:text-foreground">
        ← {backLabel}
      </button>
      <p className="mt-3 flex items-center gap-2 text-xs font-extrabold" style={{ color: CATEGORY_COLOR[place.category] }}>
        <CategoryDot category={place.category} /> {place.category}
        {place.naver_category ? ` · ${place.naver_category.split(">").pop()}` : ""} · #{rank}위
      </p>
      <h2 className="mt-1 text-2xl font-black leading-tight">
        {CATEGORY_EMOJI[place.category]} {place.name}
      </h2>
      <p className="mt-1 text-sm text-muted">
        <Walking place={place} />
        {place.walking_meters != null && ` · ${place.walking_meters.toLocaleString()}m`}
      </p>
      <p className="text-sm text-muted/70">{place.road_address}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => onVote(1)}
          className={`rounded-xl py-3 font-bold transition ${myVote === 1 ? "bg-brand text-brand-ink" : "bg-surface-2 hover:bg-line"}`}
        >
          👍 좋아요 {place.likes}
        </button>
        <button
          onClick={() => onVote(-1)}
          className={`rounded-xl py-3 font-bold transition ${myVote === -1 ? "bg-danger text-white" : "bg-surface-2 hover:bg-line"}`}
        >
          👎 싫어요 {place.dislikes}
        </button>
      </div>
      <button
        onClick={onDicePick}
        className={`mt-2 w-full rounded-xl py-2.5 text-sm font-bold ${dicePicked ? "bg-brand/15 text-brand" : "bg-surface-2 hover:bg-line"}`}
      >
        {dicePicked ? "🎲 후보에 담았어요 · 빼기" : "🎲 오늘 뭐 먹지 후보에 담기"}
      </button>
      {drawTeams.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {drawTeams.map((t) => {
            const just = added?.teamId === t.id;
            const name = drawTeams.length > 1 ? `${t.name} ` : "";
            const left = t.open_box?.remaining ? `남은 ${t.open_box.remaining}번` : "다 넣었어요";
            return (
              <button
                key={just ? `${t.id}-${added.at}` : t.id}
                onClick={() => void addToBox(t)}
                disabled={!canPutIntoBox(t.open_box) || adding === t.id}
                className={`relative w-full rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                  just ? "lm-pop border-brand bg-brand text-brand-ink" : "border-brand/60 text-brand hover:bg-brand/10"
                } ${just ? "" : "disabled:opacity-40"}`}
              >
                {just ? `✓ ${name}추첨통에 쏙! (${left})` : `🎟️ ${name}추첨통에 넣기 (${left})`}
                {just && (
                  <span aria-hidden className="lm-float-up pointer-events-none absolute -top-1 right-6 text-lg font-black text-brand">
                    🎟️+1
                  </span>
                )}
              </button>
            );
          })}
          {boxError && <p className="text-center text-xs font-bold text-danger">{boxError}</p>}
        </div>
      )}
      {place.naver_place_id ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm font-bold">
          {NAVER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onOpenTab(t.key)}
              className={`rounded-xl py-2.5 ${openTab === t.key ? "bg-foreground text-background" : "bg-surface-2 hover:bg-line"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        // 네이버 플레이스와 아직 연결되지 않은 가게: 앱 안에 띄울 수 없어 새 창으로 연다
        <a href={naverMapUrl(place)} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl bg-surface-2 py-2.5 text-center text-sm font-bold hover:bg-line">
          📋 네이버에서 메뉴·사진 보기 ↗
        </a>
      )}

      <h3 className="mt-7 text-lg font-black">이런 점이 좋았어요</h3>
      <ul className="mt-2 space-y-1.5">
        {keywordRows.length === 0 && <li className="text-sm text-muted">아직 고른 사람이 없어요. 첫 키워드를 남겨 주세요!</li>}
        {keywordRows.map((r) => (
          <li key={r.key} className="relative overflow-hidden rounded-lg bg-surface px-3 py-2 text-sm">
            <span className="absolute inset-y-0 left-0 bg-brand/25" style={{ width: `${(r.n / maxKeyword) * 100}%` }} />
            <span className="relative flex justify-between font-bold">
              <span>{r.label}</span>
              <span className="text-brand">{r.n}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs font-bold text-muted">
        내 키워드 ({myKeywords.length}/{MAX_KEYWORDS_PER_PLACE})
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {KEYWORDS.map((k) => {
          const on = myKeywords.includes(k.key);
          const full = !on && myKeywords.length >= MAX_KEYWORDS_PER_PLACE;
          return (
            <button
              key={k.key}
              onClick={() => toggleKeyword(k.key)}
              disabled={full}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${
                on ? "border-brand bg-brand text-brand-ink" : "border-line text-foreground/75 hover:bg-surface-2"
              } disabled:opacity-35`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <h3 className="mt-7 text-lg font-black">💡 꿀팁 {tips ? tips.length : ""}</h3>
      <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-line bg-surface p-3">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (bodyMissing) setBodyMissing(false);
          }}
          maxLength={1000}
          rows={2}
          aria-label="꿀팁 내용"
          aria-invalid={bodyMissing}
          placeholder="추천 메뉴, 가격, 가는 길, 웨이팅… 꿀팁 남기기"
          className={`w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted ${
            bodyMissing ? "border-danger" : "border-line focus:border-brand"
          }`}
        />
        {/* 봇만 채우는 숨은 칸 */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <div className="flex gap-2">
          {/* 닉네임 칸에 꿀팁을 적는 실수가 잦아서, 값을 넣어도 "닉네임" 라벨이 남게 한다 */}
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-background px-3 focus-within:border-brand">
            <span className="shrink-0 text-xs font-bold text-muted">닉네임</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              aria-label="닉네임"
              placeholder="선택"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <button disabled={sending} className="shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-40">
            {sending ? "등록 중" : "남기기"}
          </button>
        </div>
        {bodyMissing && <p className="text-xs font-bold text-danger">위 칸에 꿀팁 내용을 먼저 적어 주세요.</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>
      <ul className="mt-2 space-y-2">
        {tips == null && <li className="text-sm text-muted">불러오는 중…</li>}
        {tips?.length === 0 && <li className="text-sm text-muted">아직 꿀팁이 없어요</li>}
        {tips?.map((t) => (
          <li key={t.id} className="rounded-xl border border-line bg-surface p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{t.body}</p>
            <p className="mt-1.5 text-xs text-muted">
              {t.nickname || "익명"} · {timeAgo(t.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
