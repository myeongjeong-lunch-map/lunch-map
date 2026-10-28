"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { applyKeywords, applyTip, applyVote, type KeywordKey, type MyVote, type Place, type Tip } from "@/lib/domain";

/**
 * 가게 목록 모듈. 가게와 내 평가·키워드·즐겨찾기, 최근 꿀팁을 들고 있다.
 *
 * - 평가·키워드·즐겨찾기·꿀팁은 서버 응답을 기다리지 않고 바로 반영한다(이번 주 점수 포함).
 * - 같은 가게에 연달아 누르면 요청이 순서대로 가도록 안에서 이어 붙인다. 실패하면 서버 값으로 다시 불러온다.
 * - 처음에 한 번 불러온다. places가 null이면 아직 불러오는 중이다.
 */
export function usePlaceList() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [myKeywords, setMyKeywords] = useState<Record<string, KeywordKey[]>>({});
  const [myFavorites, setMyFavorites] = useState<string[]>([]);
  const [recentTips, setRecentTips] = useState<Tip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const queue = useRef(new Map<string, Promise<unknown>>());

  const reload = useCallback(async () => {
    try {
      const [data, tips] = await Promise.all([api.places(), api.recentTips()]);
      setPlaces(data.places);
      setMyVotes(data.myVotes);
      setMyKeywords(data.myKeywords);
      setMyFavorites(data.myFavorites);
      setRecentTips(tips.tips);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // 마운트 시 한 번 불러온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const enqueue = (key: string, fn: () => Promise<unknown>) => {
    const next = (queue.current.get(key) ?? Promise.resolve()).then(fn).catch(() => reload());
    queue.current.set(key, next);
  };

  const patchPlace = (placeId: string, fn: (p: Place) => Place) => setPlaces((ps) => (ps ?? []).map((p) => (p.id === placeId ? fn(p) : p)));

  /** 좋아요·싫어요. 이미 같은 평가면 취소한다 */
  const vote = (placeId: string, value: MyVote) => {
    const prev = myVotes[placeId] ?? 0;
    const next: MyVote = prev === value ? 0 : value;
    setMyVotes((v) => ({ ...v, [placeId]: next }));
    patchPlace(placeId, (p) => applyVote(p, prev, next));
    enqueue(`vote:${placeId}`, () => api.vote(placeId, next));
  };

  const setKeywords = (placeId: string, next: KeywordKey[]) => {
    const prev = myKeywords[placeId] ?? [];
    setMyKeywords((m) => ({ ...m, [placeId]: next }));
    patchPlace(placeId, (p) => applyKeywords(p, prev, next));
    enqueue(`kw:${placeId}`, () => api.setKeywords(placeId, next));
  };

  /** 즐겨찾기에 담거나 뺀다. 새로 담은 가게가 맨 앞에 온다 */
  const toggleFavorite = (placeId: string) => {
    const on = !myFavorites.includes(placeId);
    setMyFavorites((f) => (on ? [placeId, ...f] : f.filter((id) => id !== placeId)));
    enqueue(`fav:${placeId}`, () => api.favorite(placeId, on));
  };

  /** 서버에 이미 저장된 꿀팁을 화면에 반영한다 */
  const addTip = (tip: Tip) => {
    setRecentTips((ts) => [tip, ...(ts ?? [])]);
    patchPlace(tip.place_id, applyTip);
  };

  return { places, myVotes, myKeywords, myFavorites, recentTips, loadError, reload, vote, setKeywords, toggleFavorite, addTip };
}
