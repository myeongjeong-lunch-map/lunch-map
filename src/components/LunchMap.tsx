"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { MyVote, Place } from "@/lib/domain";
import { NaverMap } from "./NaverMap";
import { PlaceList, applyFilters, DEFAULT_FILTERS, type Filters } from "./PlaceList";
import { PlaceDetail } from "./PlaceDetail";
import { AddPlace } from "./AddPlace";
import { BottomSheet, type SheetSnap } from "./BottomSheet";
import { NaverPlacePanel } from "./NaverPlacePanel";
import type { PlaceTab } from "@/lib/naverPlaceId";

const DESKTOP_QUERY = "(min-width: 768px)";

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

// detail.tab: 네이버 플레이스(메뉴·사진·리뷰) 패널이 열려 있으면 그 탭
type Mode = { kind: "list" } | { kind: "detail"; id: string; tab?: PlaceTab } | { kind: "add" };

export function LunchMap() {
  const isDesktop = useIsDesktop();
  const [places, setPlaces] = useState<Place[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const voteQueue = useRef(new Map<string, Promise<unknown>>());

  const reload = useCallback(async () => {
    try {
      const data = await api.places();
      setPlaces(data.places);
      setMyVotes(data.myVotes);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 마운트 시 한 번 불러온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const visible = useMemo(() => applyFilters(places, filters), [places, filters]);
  const selectedId = mode.kind === "detail" ? mode.id : null;
  const selected = selectedId ? places.find((p) => p.id === selectedId) ?? null : null;
  const placeTab = mode.kind === "detail" ? mode.tab : undefined;
  const setPlaceTab = (tab: PlaceTab | undefined) => setMode((m) => (m.kind === "detail" ? { ...m, tab } : m));

  const naverPanel =
    selected?.naver_place_id && placeTab ? (
      <NaverPlacePanel
        name={selected.name}
        naverPlaceId={selected.naver_place_id}
        tab={placeTab}
        onTab={(t) => setPlaceTab(t)}
        onClose={() => setPlaceTab(undefined)}
      />
    ) : null;

  const select = useCallback((id: string | null) => {
    if (id) {
      setMode({ kind: "detail", id });
      setSnap((s) => (s === "full" ? "full" : "half"));
    } else {
      setMode((m) => (m.kind === "add" ? m : { kind: "list" }));
    }
  }, []);

  const startAdd = () => {
    setMode({ kind: "add" });
    setSnap("full");
  };

  const endAdd = (newId?: string) => {
    setPickMode(false);
    setPicked(null);
    if (newId) {
      void reload().then(() => select(newId));
    } else {
      setMode({ kind: "list" });
    }
  };

  const startPick = () => {
    setPickMode(true);
    setSnap("peek");
  };

  const handlePick = (p: { lat: number; lng: number }) => {
    setPicked(p);
    setPickMode(false);
    setSnap("full");
  };

  const vote = async (placeId: string, value: MyVote) => {
    const prev = myVotes[placeId] ?? 0;
    const next: MyVote = prev === value ? 0 : value;
    // 낙관적 반영
    setMyVotes((v) => ({ ...v, [placeId]: next }));
    setPlaces((ps) =>
      ps.map((p) =>
        p.id !== placeId
          ? p
          : {
              ...p,
              likes: p.likes - (prev === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
              dislikes: p.dislikes - (prev === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
            },
      ),
    );
    // 같은 가게에 연달아 누르면 요청이 순서대로 가도록 이어 붙인다
    const prevRequest = voteQueue.current.get(placeId) ?? Promise.resolve();
    const request = prevRequest.then(() => api.vote(placeId, next)).catch(() => reload());
    voteQueue.current.set(placeId, request);
    await request;
  };

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <button className="flex items-center gap-2 text-left" onClick={() => setMode({ kind: "list" })}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-lg">🍱</span>
          <span>
            <span className="block text-[15px] font-extrabold leading-tight">명정 점심 지도</span>
            <span className="block text-xs text-muted">함께 채우는 캠퍼스 맛집 {places.length}곳</span>
          </span>
        </button>
        {mode.kind !== "add" && (
          <button onClick={startAdd} className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-dark">
            + 맛집 추가
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode.kind === "add" ? (
          <AddPlace
            picked={picked}
            onStartPick={startPick}
            onCancel={() => endAdd()}
            onDone={(id) => endAdd(id)}
            onOpenExisting={(id) => {
              endAdd();
              select(id);
            }}
          />
        ) : selected ? (
          <PlaceDetail
            place={selected}
            myVote={myVotes[selected.id] ?? 0}
            onVote={(v) => vote(selected.id, v)}
            onBack={() => setMode({ kind: "list" })}
            onCommentAdded={reload}
            openTab={placeTab}
            onOpenTab={(t) => setPlaceTab(t)}
          />
        ) : (
          <PlaceList
            places={visible}
            total={places.length}
            loading={loading}
            error={loadError}
            filters={filters}
            onFilters={setFilters}
            onSelect={(id) => select(id)}
            myVotes={myVotes}
          />
        )}
      </div>
    </div>
  );

  const sheetInset = !isDesktop ? (snap === "peek" ? 0 : snap === "half" ? window.innerHeight * 0.5 : 0) : 0;

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {isDesktop && <aside className="z-10 flex h-full w-[400px] shrink-0 flex-col border-r border-line bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)]">{panel}</aside>}
      {isDesktop && naverPanel && <aside className="z-10 flex h-full w-[400px] shrink-0 flex-col border-r border-line bg-white">{naverPanel}</aside>}
      {/* 네이버 지도 컨트롤보다 위에 오도록 z-index를 크게 둔다 */}
      {!isDesktop && naverPanel && <div className="fixed inset-0 z-[1000] bg-white pt-[env(safe-area-inset-top)]">{naverPanel}</div>}
      <main className="relative h-full flex-1">
        <NaverMap
          places={visible}
          selectedId={selectedId}
          onSelect={select}
          pickMode={pickMode}
          picked={picked}
          onPick={handlePick}
          bottomInset={sheetInset}
        />
        {!isDesktop && !pickMode && (
          <BottomSheet snap={snap} onSnap={setSnap}>
            {panel}
          </BottomSheet>
        )}
        {!isDesktop && pickMode && (
          <button
            onClick={() => {
              setPickMode(false);
              setSnap("full");
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-3 text-sm font-bold shadow-lg"
          >
            위치 고르기 취소
          </button>
        )}
      </main>
    </div>
  );
}
