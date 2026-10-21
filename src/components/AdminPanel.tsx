"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, SOLO_DINING, SOLO_LABEL, walkingMinutes, type Comment, type Place } from "@/lib/domain";

// 관리자: 가게와 한마디를 수정·삭제하는 유일한 사람
export function AdminPanel() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  const load = useCallback(async () => {
    setPlaces((await api.places()).places);
  }, []);

  useEffect(() => {
    api
      .adminStatus()
      .then(({ admin }) => {
        setAdmin(admin);
        if (admin) void load();
      })
      .catch(() => setAdmin(false));
  }, [load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.adminLogin(secret);
      setAdmin(true);
      setSecret("");
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const open = async (id: string) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    setComments((await api.comments(id)).comments);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (admin === null) return <p className="p-8 text-center text-sm text-muted">확인 중…</p>;

  if (!admin)
    return (
      <form onSubmit={login} className="mx-auto mt-24 max-w-sm space-y-3 px-4">
        <h1 className="text-xl font-extrabold">관리자 로그인</h1>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand"
          autoFocus
        />
        <button className="w-full rounded-lg bg-brand py-2.5 text-sm font-bold text-white">들어가기</button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">관리자 · 가게 {places.length}곳</h1>
        <Link href="/" className="text-sm font-semibold text-brand">
          지도로 →
        </Link>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {places.map((p) => (
          <li key={p.id} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                defaultValue={p.name}
                onBlur={(e) => e.target.value !== p.name && run(() => api.adminUpdatePlace(p.id, { name: e.target.value }))}
                className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 font-bold hover:border-line focus:border-brand"
              />
              <select
                value={p.category}
                onChange={(e) => run(() => api.adminUpdatePlace(p.id, { category: e.target.value }))}
                className="rounded border border-line px-1.5 py-1 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={p.solo_dining}
                onChange={(e) => run(() => api.adminUpdatePlace(p.id, { soloDining: e.target.value }))}
                className="rounded border border-line px-1.5 py-1 text-sm"
              >
                {SOLO_DINING.map((s) => (
                  <option key={s} value={s}>
                    {SOLO_LABEL[s]}
                  </option>
                ))}
              </select>
              <button onClick={() => open(p.id)} className="rounded border border-line px-2 py-1 text-sm">
                💬 {p.comment_count}
              </button>
              <button
                onClick={() => confirm(`"${p.name}"을(를) 삭제할까요? 한마디와 평가도 함께 지워져요.`) && run(() => api.adminDeletePlace(p.id))}
                className="rounded bg-red-500 px-2 py-1 text-sm font-bold text-white"
              >
                삭제
              </button>
            </div>
            <input
              defaultValue={p.naver_place_id ?? ""}
              placeholder="네이버 지도 링크 또는 플레이스 ID (비우면 연결 해제)"
              onBlur={(e) => e.target.value !== (p.naver_place_id ?? "") && run(() => api.adminUpdatePlace(p.id, { naverLink: e.target.value }))}
              className="mt-1 w-full rounded border border-line px-2 py-1 text-xs outline-none focus:border-brand"
            />
            <p className="mt-1 px-1 text-xs text-muted">
              {p.road_address} · 도보 {walkingMinutes(p) ?? "?"}분({p.walking_source ?? "-"}) · 👍{p.likes} 👎{p.dislikes}
            </p>
            {openId === p.id && (
              <ul className="mt-2 space-y-1 rounded-lg bg-surface p-2">
                {comments.length === 0 && <li className="text-xs text-muted">한마디 없음</li>}
                {comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className="flex-1 whitespace-pre-wrap">
                      {c.body} <span className="text-xs text-muted">— {c.nickname || "익명"}</span>
                    </span>
                    <button
                      onClick={() =>
                        confirm("이 한마디를 삭제할까요?") &&
                        run(async () => {
                          await api.adminDeleteComment(c.id);
                          setComments((cs) => cs.filter((x) => x.id !== c.id));
                        })
                      }
                      className="shrink-0 text-xs font-bold text-red-500"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
