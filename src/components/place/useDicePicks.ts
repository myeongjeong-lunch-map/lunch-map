"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "@/lib/domain";

// 🎲 후보로 담은 가게도 이 브라우저에만 기억한다
const PICKS_KEY = "lm_dice_picks";

function load(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PICKS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(PICKS_KEY, JSON.stringify(ids));
    else localStorage.removeItem(PICKS_KEY);
  } catch {
    // 저장 못 해도 동작에는 문제 없음
  }
}

/**
 * 🎲 후보 모듈: "오늘 뭐 먹지"에서 고를 가게를 담아 둔다.
 * 담은 순서대로 이 브라우저(localStorage)에 남고, 담기·빼기·비우기와 저장은 이 안에서 처리한다.
 * 가게 목록(places)에 없는 가게(지워졌거나 숨겨진 가게)는 picks에서 빠진다(저장값은 비우기 때 함께 정리된다).
 */
export function useDicePicks(places: Place[]) {
  const [ids, setIds] = useState<string[]>([]);
  // 연달아 눌러도 앞의 선택이 남도록, 가장 최근 값을 따로 들고 있는다
  const latest = useRef<string[]>([]);

  useEffect(() => {
    // 마운트 시 이 브라우저에 담아 둔 후보를 연다 (localStorage는 서버 렌더 때 읽을 수 없다)
    latest.current = load();
    setIds(latest.current);
  }, []);

  const picks = useMemo(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }, [places, ids]);

  const replace = useCallback((next: string[]) => {
    latest.current = next;
    setIds(next);
    save(next);
  }, []);

  const picked = useMemo(() => new Set(picks.map((p) => p.id)), [picks]);

  return {
    /** 담은 가게 (담은 순서) */
    picks,
    has: (id: string) => picked.has(id),
    /** 담았으면 빼고, 아니면 담는다 */
    toggle: (id: string) => {
      const cur = latest.current;
      replace(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
    clear: () => replace([]),
  };
}

export type DicePicks = ReturnType<typeof useDicePicks>;
