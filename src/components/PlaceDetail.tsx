"use client";

import { useEffect, useState } from "react";
import { api, loadNickname, saveNickname } from "@/lib/api";
import { naverMapUrl, SOLO_LABEL, type Comment, type MyVote, type Place } from "@/lib/domain";
import type { PlaceTab } from "@/lib/naverPlaceId";
import { CATEGORY_EMOJI } from "./NaverMap";
import { WalkingBadge } from "./PlaceList";

type Props = {
  place: Place;
  myVote: MyVote;
  onVote: (v: MyVote) => void;
  onBack: () => void;
  onCommentAdded: () => void;
  /** 열려 있는 네이버 플레이스 탭 */
  openTab: PlaceTab | undefined;
  onOpenTab: (t: PlaceTab) => void;
};

const NAVER_TABS: { key: PlaceTab; label: string }[] = [
  { key: "menu", label: "📋 메뉴판" },
  { key: "photo", label: "📷 사진" },
  { key: "review", label: "⭐ 리뷰" },
];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function PlaceDetail({ place, myVote, onVote, onBack, onCommentAdded, openTab, onOpenTab }: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .comments(place.id)
      .then((d) => !cancelled && setComments(d.comments))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [place.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { comment } = await api.addComment(place.id, { body, nickname, website });
      setComments((c) => [...(c ?? []), comment]);
      setBody("");
      saveNickname(nickname);
      onCommentAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="px-4 pt-3">
        <button onClick={onBack} className="text-sm font-semibold text-muted hover:text-foreground">
          ← 목록
        </button>
      </div>
      <div className="px-4 pt-2">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#effbf4] text-2xl">{CATEGORY_EMOJI[place.category]}</span>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold leading-tight">{place.name}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {place.category}
              {place.naver_category ? ` · ${place.naver_category.split(">").pop()}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <WalkingBadge place={place} />
          {place.walking_meters != null && <span className="text-muted">{place.walking_meters.toLocaleString()}m</span>}
          <span className="text-muted">{SOLO_LABEL[place.solo_dining]}</span>
        </div>
        <p className="mt-1.5 text-sm text-muted">{place.road_address}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => onVote(1)}
            className={`rounded-xl border py-2.5 text-sm font-bold ${myVote === 1 ? "border-brand bg-brand text-white" : "border-line hover:bg-surface"}`}
          >
            👍 좋아요 {place.likes}
          </button>
          <button
            onClick={() => onVote(-1)}
            className={`rounded-xl border py-2.5 text-sm font-bold ${myVote === -1 ? "border-red-500 bg-red-500 text-white" : "border-line hover:bg-surface"}`}
          >
            👎 싫어요 {place.dislikes}
          </button>
          <a
            href={naverMapUrl(place)}
            target="_blank"
            rel="noreferrer"
            className="grid place-items-center rounded-xl border border-line text-center text-sm font-bold text-brand hover:bg-surface"
          >
            네이버지도 ↗
          </a>
        </div>

        {place.naver_place_id ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {NAVER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => onOpenTab(t.key)}
                className={`rounded-xl py-2.5 text-sm font-bold ${openTab === t.key ? "bg-foreground text-white" : "bg-surface hover:bg-line"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          // 네이버 플레이스와 아직 연결되지 않은 가게: 앱 안에 띄울 수 없어 새 창으로 연다
          <a
            href={naverMapUrl(place)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block rounded-xl bg-surface py-2.5 text-center text-sm font-bold hover:bg-line"
          >
            📋 네이버에서 메뉴·사진 보기 ↗
          </a>
        )}
      </div>

      <div className="mt-6 border-t-8 border-surface px-4 pt-4">
        <h3 className="text-[15px] font-extrabold">한마디 {comments ? comments.length : ""}</h3>
        {comments == null ? (
          <p className="py-4 text-sm text-muted">불러오는 중…</p>
        ) : comments.length === 0 ? (
          <p className="py-4 text-sm text-muted">아직 한마디가 없어요. 추천 메뉴나 가격을 알려 주세요!</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {comments.map((c) => (
              <li key={c.id} className="py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {c.nickname || "익명"} · {timeAgo(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-surface p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="추천 메뉴, 가격, 가는 길… 자유롭게 남겨 주세요"
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          {/* 봇만 채우는 숨은 칸 */}
          <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="닉네임 (선택)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button disabled={sending || !body.trim()} className="rounded-lg bg-brand px-4 text-sm font-bold text-white disabled:opacity-40">
              {sending ? "등록 중" : "남기기"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  );
}
