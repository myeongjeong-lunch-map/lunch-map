"use client";

import { useEffect, useState } from "react";
import { api, loginUrl, type Account } from "@/lib/api";
import { GoogleLoginButton } from "@/components/me/GoogleLoginButton";
import { KEYWORD_LABEL, timeAgo, type KeywordKey, type MyVote, type Place, type Tip } from "@/lib/domain";
import { CategoryDot, Walking } from "@/components/place/PlaceList";

type Props = {
  /** undefined면 아직 로그인 상태를 묻는 중, null이면 로그인하지 않았다 */
  account: Account | null | undefined;
  onLogout: () => Promise<void>;
  onNickname: (nickname: string) => void;
  places: Place[];
  myFavorites: string[];
  myVotes: Record<string, MyVote>;
  myKeywords: Record<string, KeywordKey[]>;
  onSelect: (id: string) => void;
  onBack: () => void;
};

// 나: 로그인, 닉네임, 즐겨찾기, 내 기록(평가·키워드·꿀팁). 로그인하지 않으면 이 브라우저의 기록을 보여 준다.
export function MePanel({ account, onLogout, onNickname, places, myFavorites, myVotes, myKeywords, onSelect, onBack }: Props) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const favorites = myFavorites.flatMap((id) => byId.get(id) ?? []);
  const voted = places.filter((p) => myVotes[p.id]);
  const keyworded = places.filter((p) => myKeywords[p.id]?.length);
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [nickname, setNickname] = useState(account?.nickname ?? "");
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .myTips()
      .then((d) => !cancelled && setTips(d.tips))
      .catch(() => !cancelled && setTips([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const saveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onNickname(nickname.trim());
    setSaved(true);
  };

  const logout = async () => {
    setLeaving(true);
    try {
      await onLogout();
    } catch {
      setLeaving(false);
    }
  };

  return (
    <div className="px-5 pb-28 pt-1">
      <button onClick={onBack} className="text-sm font-bold text-muted hover:text-foreground">
        ← 돌아가기
      </button>
      <h2 className="mt-3 text-2xl font-black">👤 나</h2>

      <section className="mt-4 rounded-2xl bg-surface p-4">
        {account === undefined ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : account ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">구글 계정으로 로그인했어요</p>
            <button
              onClick={() => void logout()}
              disabled={leaving}
              className="shrink-0 text-xs font-bold text-muted hover:text-foreground disabled:opacity-40"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold">로그인하면 다른 기기에서도 내 기록이 이어져요</p>
            <p className="mt-1 text-xs text-muted">
              지금 이 브라우저에 남긴 평가·키워드·즐겨찾기·팀은 계정으로 옮겨요. 로그인하지 않아도 모든 기능을 쓸 수 있어요.
            </p>
            <GoogleLoginButton href={loginUrl()} />
            <p className="mt-2 text-[11px] text-muted">
              계정을 구분하는 ID만 저장하고, 이메일·이름·사진은 화면에 쓰지 않아요.{" "}
              <a href="/privacy" className="underline">
                개인정보처리방침
              </a>
            </p>
          </>
        )}
      </section>

      {account && (
        <form onSubmit={saveNickname} className="mt-3 flex gap-2">
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setSaved(false);
            }}
            maxLength={20}
            placeholder="닉네임"
            aria-label="닉네임"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          />
          <button disabled={!nickname.trim() || saved} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-40">
            {saved ? "저장했어요" : "닉네임 저장"}
          </button>
        </form>
      )}

      <Section title="⭐ 즐겨찾기" empty="가게 카드의 ☆를 누르면 여기에 모여요." places={favorites} onSelect={onSelect} />
      <Section
        title="👍 내 평가"
        empty="아직 평가한 가게가 없어요."
        places={voted}
        onSelect={onSelect}
        note={(p) => (myVotes[p.id] === 1 ? "👍 좋아요" : "👎 싫어요")}
      />
      <Section
        title="🏷️ 내 키워드"
        empty="아직 키워드를 고른 가게가 없어요."
        places={keyworded}
        onSelect={onSelect}
        note={(p) => (myKeywords[p.id] ?? []).map((k) => KEYWORD_LABEL[k]).join(" · ")}
      />

      <h3 className="mt-6 pb-1.5 text-sm font-black">💡 내 꿀팁</h3>
      {tips == null ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : tips.length === 0 ? (
        <p className="text-sm text-muted">아직 남긴 꿀팁이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {tips.map((t) => {
            const p = byId.get(t.place_id);
            if (!p) return null;
            return (
              <li key={t.id}>
                <button onClick={() => onSelect(p.id)} className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:bg-surface-2">
                  <span className="text-xs font-bold">{p.name}</span>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/85">{t.body}</p>
                  <p className="mt-1 text-xs text-muted">{timeAgo(t.created_at)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  places,
  onSelect,
  note,
}: {
  title: string;
  empty: string;
  places: Place[];
  onSelect: (id: string) => void;
  note?: (p: Place) => string;
}) {
  return (
    <section className="mt-6">
      <h3 className="pb-1.5 text-sm font-black">
        {title} {places.length > 0 && <span className="text-muted">{places.length}</span>}
      </h3>
      {places.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul>
          {places.map((p) => (
            <li key={p.id}>
              <button onClick={() => onSelect(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface">
                <CategoryDot category={p.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{note ? note(p) : <Walking place={p} />}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
