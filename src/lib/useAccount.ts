"use client";

import { useCallback, useEffect, useState } from "react";
import { api, loadNickname, saveNickname, setNicknameSync, type Account } from "@/lib/api";

/**
 * 로그인 상태 모듈. 처음에 한 번 /api/me를 묻는다. account가 undefined면 아직 묻는 중, null이면 로그인하지 않았다.
 *
 * - 계정 닉네임이 있으면 이 브라우저의 닉네임 칸을 그것으로 채운다.
 * - 계정 닉네임이 없고 이 브라우저에 닉네임이 있으면 그것을 계정에 올린다 (처음 로그인).
 */
export function useAccount() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ account: a }) => {
        if (cancelled) return;
        // 계정 닉네임을 브라우저에 내려받을 때는 계정에 다시 올리지 않도록 동기화를 켜기 전에 저장한다
        if (a?.nickname) saveNickname(a.nickname);
        setNicknameSync(!!a);
        const local = loadNickname().trim();
        if (a && !a.nickname && local) saveNickname(local);
        setAccount(a && { nickname: a.nickname ?? (local || null) });
      })
      .catch(() => !cancelled && setAccount(null));
    return () => {
      cancelled = true;
    };
  }, []);

  /** 로그아웃하면 화면 전체를 다시 불러 브라우저 기록으로 돌아간다 */
  const logout = useCallback(async () => {
    await api.logout();
    location.reload();
  }, []);

  const setNickname = useCallback((nickname: string) => {
    saveNickname(nickname);
    setAccount((a) => a && { nickname });
  }, []);

  return { account, logout, setNickname };
}
