"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StallCheckValue, StreetStall } from "@/lib/street";

/** 지금 보이는 노점을 1분마다 다시 불러온다 (확인·만료가 다른 사람 손에서도 바뀌므로) */
const REFRESH_MS = 60_000;

// 길거리 제보 모듈: 노점 목록, 노점 확인, 고정 노점으로 바꾸기. 확인은 화면에 먼저 반영하고 서버 값으로 덮는다.
export function useStreetStalls() {
  const [stalls, setStalls] = useState<StreetStall[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setStalls((await api.street()).stalls);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // 마운트 시 불러오고 1분마다 다시 불러온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const t = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  /** 노점 확인. 같은 것을 다시 누르면 취소 (오늘 열었어요·오늘은 안 열었어요는 어제 것이면 다시 남긴다) */
  const check = useCallback(
    async (stall: StreetStall, value: StallCheckValue) => {
      const next = stall.my_check === value ? null : value;
      setStalls((list) => (list ?? []).map((s) => (s.id === stall.id ? { ...s, my_check: next } : s)));
      try {
        await api.checkStall(stall.id, next);
      } finally {
        await reload();
      }
    },
    [reload],
  );

  const makeFixed = useCallback(
    async (stall: StreetStall) => {
      await api.fixStall(stall.id);
      await reload();
    },
    [reload],
  );

  return { stalls, error, reload, check, makeFixed };
}

export type StreetStallsModule = ReturnType<typeof useStreetStalls>;
