"use client";

// PROTOTYPE (throwaway): 시안들이 함께 쓰는 읽기 전용 데이터. 최근 한마디까지 미리 불러온다.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category, Comment, Place } from "@/lib/domain";

export type ProtoPlace = Place & { latestComment: Comment | null; comments: Comment[] };

export function usePrototypeData() {
  const [places, setPlaces] = useState<ProtoPlace[] | null>(null);
  useEffect(() => {
    (async () => {
      const { places } = await api.places();
      const withComments = await Promise.all(
        places.map(async (p) => {
          const { comments } = await api.comments(p.id);
          return { ...p, latestComment: comments.at(-1) ?? null, comments };
        }),
      );
      setPlaces(withComments.sort((a, b) => (a.walking_seconds ?? 1e9) - (b.walking_seconds ?? 1e9)));
    })();
  }, []);
  return places;
}

export const CATEGORY_COLOR: Record<Category, string> = {
  한식: "#ff6b3d",
  중식: "#e5383b",
  일식: "#4361ee",
  양식: "#f4a261",
  아시안: "#2a9d8f",
  분식: "#ff4d8d",
  패스트푸드: "#fca311",
  카페: "#8d5b4c",
  기타: "#6c757d",
};

export function minutes(p: Place): number {
  return Math.max(1, Math.round((p.walking_seconds ?? 0) / 60));
}

export function firstLine(c: Comment | null, max = 60): string {
  if (!c) return "";
  const t = c.body.split("\n")[0];
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
