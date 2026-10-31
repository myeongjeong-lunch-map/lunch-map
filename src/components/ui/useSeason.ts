"use client";

import { useSyncExternalStore } from "react";
import { seasonAt, type Season } from "@/lib/season";

const noop = () => () => {};

/** 서버 렌더와 첫 화면은 꾸미기 없이 그리고, 브라우저에서 날짜를 보고 켠다 (useHalloween과 같다). */
export function useSeason(): Season | null {
  return useSyncExternalStore(noop, () => seasonAt(), () => null);
}
