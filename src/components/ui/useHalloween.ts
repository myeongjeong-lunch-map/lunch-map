"use client";

import { useSyncExternalStore } from "react";
import { isHalloween } from "@/lib/halloween";

const noop = () => () => {};

/** 서버 렌더와 첫 화면은 이벤트 없이 그리고, 브라우저에서 날짜를 보고 켠다. */
export function useHalloween(): boolean {
  return useSyncExternalStore(noop, () => isHalloween(), () => false);
}
