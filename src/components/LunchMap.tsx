"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, loadWalkDraft, saveWalkDraft, type WalkResponse } from "@/lib/api";
import {
  MAX_COURSE_STOPS,
  courseTime,
  legKey,
  rankPlaces,
  type KeywordKey,
  type MyVote,
  type Place,
  type RankingPeriod,
  type TeamSummary,
  type Tip,
  type WalkCourseStop,
  type WalkLeg,
  type WalkSpot,
} from "@/lib/domain";
import type { PlaceTab } from "@/lib/naverPlaceId";
import { NaverMap } from "@/components/map/NaverMap";
import { usePlaceRouteLine, useWalkRouteLine } from "@/components/map/routeLine";
import { PlaceList, applyFilters, isFiltered, DEFAULT_FILTERS, type Filters } from "@/components/place/PlaceList";
import { RankingList } from "@/components/place/RankingList";
import { TipFeed } from "@/components/place/TipFeed";
import { WalkPanel } from "@/components/walk/WalkPanel";
import { CourseDetail } from "@/components/walk/CourseDetail";
import { SpotDetail } from "@/components/walk/SpotDetail";
import { PlaceDetail } from "@/components/place/PlaceDetail";
import { AddPlace } from "@/components/place/AddPlace";
import { BottomSheet, type SheetSnap } from "@/components/ui/BottomSheet";
import { NaverPlacePanel } from "@/components/map/NaverPlacePanel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DrawTab } from "@/components/draw/DrawTab";

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

type Tab = "rank" | "list" | "tips" | "draw" | "walk";
const TAB_LABEL: Record<Tab, string> = { rank: "🏆 랭킹", list: "📍 목록", tips: "💡 꿀팁", draw: "🎟️ 추첨", walk: "🚶 산책" };

// 추첨 탭에서 마지막으로 본 팀. 초대 링크(/?team=…)로 들어오면 그 팀을 연다.
const TEAM_KEY = "lm_team";

// detail.tab: 네이버 플레이스(메뉴·사진·리뷰) 패널이 열려 있으면 그 탭
// spot: 산책 장소 보기, course: 산책 코스 보기 (courseId가 null이면 내 코스)
type Mode =
  | { kind: "browse" }
  | { kind: "detail"; id: string; tab?: PlaceTab }
  | { kind: "add" }
  | { kind: "spot"; id: string }
  | { kind: "course"; courseId: string | null };

export function LunchMap() {
  const isDesktop = useIsDesktop();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [myKeywords, setMyKeywords] = useState<Record<string, KeywordKey[]>>({});
  const [recentTips, setRecentTips] = useState<Tip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rank");
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<Mode>({ kind: "browse" });
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [rolling, setRolling] = useState(false);
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamId, setTeamIdState] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkResponse | null>(null);
  const [walkError, setWalkError] = useState<string | null>(null);
  const [walkDraft, setWalkDraft] = useState<string[]>([]);
  const [walkMaxMinutes, setWalkMaxMinutes] = useState<30 | 45 | null>(null);
  const queue = useRef(new Map<string, Promise<unknown>>());

  const reload = useCallback(async () => {
    try {
      const [data, tips] = await Promise.all([api.places(), api.recentTips()]);
      setPlaces(data.places);
      setMyVotes(data.myVotes);
      setMyKeywords(data.myKeywords);
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

  useEffect(() => {
    // 마운트 시 산책 장소·코스를 불러오고, 이 브라우저에 기억해 둔 내 코스를 연다 (localStorage는 서버 렌더 때 읽을 수 없다)
    api
      .walk()
      .then((data) => setWalk(data))
      .catch((e: Error) => setWalkError(e.message));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWalkDraft(loadWalkDraft());
  }, []);

  const reloadTeams = useCallback(async () => {
    try {
      setTeams((await api.teams()).teams);
      setTeamsError(null);
    } catch (e) {
      setTeamsError((e as Error).message);
    }
  }, []);

  const setTeamId = useCallback((id: string | null) => {
    setTeamIdState(id);
    try {
      if (id) localStorage.setItem(TEAM_KEY, id);
      else localStorage.removeItem(TEAM_KEY);
    } catch {
      // 저장 못 해도 동작에는 문제 없음
    }
  }, []);

  useEffect(() => {
    // 마운트 시 팀 목록을 불러오고, 초대 링크나 지난번에 본 팀을 연다 (localStorage·URL은 서버 렌더 때 읽을 수 없다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadTeams();
    const invited = new URLSearchParams(location.search).get("team");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(TEAM_KEY);
    } catch {
      // 무시
    }
    setTeamIdState(invited ?? saved);
    if (invited) {
      setTab("draw");
      setSnap("full");
      history.replaceState(null, "", location.pathname);
    }
  }, [reloadTeams]);

  const addToBox = async (id: string, placeId: string) => {
    await api.addEntry(id, placeId);
    await reloadTeams();
  };

  const all = useMemo(() => places ?? [], [places]);

  // 산책: 장소·추천 코스·구간 (코스 시간은 courseTime이 구간을 더해서 구한다)
  const walkSpotList = useMemo(() => walk?.spots ?? [], [walk]);
  const spotMap = useMemo(() => new Map<string, WalkSpot>(walkSpotList.map((sp) => [sp.id, sp])), [walkSpotList]);
  const legMap = useMemo(() => new Map<string, WalkLeg>((walk?.legs ?? []).map((l) => [legKey(l.a, l.b), l])), [walk]);
  // 지워진 장소가 내 코스에 남아 있으면 화면에서 거른다
  const draftIds = useMemo(() => walkDraft.filter((id) => spotMap.has(id)), [walkDraft, spotMap]);
  const draftStops = useMemo<WalkCourseStop[]>(() => draftIds.map((id) => ({ spot_id: id, stay_minutes: null })), [draftIds]);
  const draftSet = useMemo(() => new Set(draftIds), [draftIds]);
  const draftTime = useMemo(() => courseTime(draftStops, spotMap, legMap), [draftStops, spotMap, legMap]);
  const openedCourse = mode.kind === "course" ? (mode.courseId === null ? null : (walk?.courses.find((c) => c.id === mode.courseId) ?? undefined)) : undefined;
  const courseStops = useMemo<WalkCourseStop[]>(
    () => (mode.kind !== "course" ? [] : openedCourse === null ? draftStops : (openedCourse?.stops.filter((st) => spotMap.has(st.spot_id)) ?? [])),
    [mode.kind, openedCourse, draftStops, spotMap],
  );
  const openedSpot = mode.kind === "spot" ? (spotMap.get(mode.id) ?? null) : null;
  const routeIds = useMemo(() => (mode.kind === "spot" ? (openedSpot ? [openedSpot.id] : []) : courseStops.map((st) => st.spot_id)), [mode.kind, openedSpot, courseStops]);
  const openedTime = useMemo(() => courseTime(courseStops, spotMap, legMap), [courseStops, spotMap, legMap]);
  // 장소 보기는 그 장소 하나의 코스 시간에서 캠퍼스 → 장소 구간을 쓴다
  const spotTime = useMemo(() => courseTime(routeIds.map((id) => ({ spot_id: id, stay_minutes: null })), spotMap, legMap), [routeIds, spotMap, legMap]);
  const walkRoute = useWalkRouteLine({ stopIds: routeIds, spots: spotMap, time: mode.kind === "spot" ? spotTime : openedTime, oneWay: mode.kind === "spot" });

  const updateDraft = (ids: string[]) => {
    setWalkDraft(ids);
    saveWalkDraft(ids);
  };
  const draftFull = draftIds.length >= MAX_COURSE_STOPS;
  const toggleDraftSpot = (id: string) => {
    if (draftSet.has(id)) updateDraft(draftIds.filter((x) => x !== id));
    else if (!draftFull) updateDraft([...draftIds, id]);
  };
  const moveDraftSpot = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= draftIds.length) return;
    const next = [...draftIds];
    [next[index], next[to]] = [next[to], next[index]];
    updateDraft(next);
  };
  const raiseSheet = () => setSnap((s) => (s === "peek" ? "half" : s));
  const openSpot = (id: string) => {
    setMode({ kind: "spot", id });
    raiseSheet();
  };
  const openCourse = (courseId: string | null) => {
    setMode({ kind: "course", courseId });
    raiseSheet();
  };
  const listed = useMemo(() => applyFilters(all, filters), [all, filters]);
  const latestTip = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of recentTips ?? []) m[t.place_id] ??= t.body.split("\n")[0];
    return m;
  }, [recentTips]);
  const selectedId = mode.kind === "detail" ? mode.id : null;
  const selected = selectedId ? all.find((p) => p.id === selectedId) ?? null : null;
  const placeTab = mode.kind === "detail" ? mode.tab : undefined;
  const mapPlaces = tab === "list" ? listed : all;
  const placeRoute = usePlaceRouteLine(selected);

  const select = useCallback((id: string | null) => {
    if (id) {
      setMode({ kind: "detail", id });
      setSnap((s) => (s === "peek" ? "half" : s));
    } else {
      setMode((m) => (m.kind === "add" ? m : { kind: "browse" }));
    }
  }, []);
  const setPlaceTab = (t: PlaceTab | undefined) => setMode((m) => (m.kind === "detail" ? { ...m, tab: t } : m));

  // 같은 가게에 연달아 누르면 요청이 순서대로 가도록 이어 붙인다
  const enqueue = (key: string, fn: () => Promise<unknown>) => {
    const next = (queue.current.get(key) ?? Promise.resolve()).then(fn).catch(() => reload());
    queue.current.set(key, next);
  };

  const vote = (placeId: string, value: MyVote) => {
    const prev = myVotes[placeId] ?? 0;
    const next: MyVote = prev === value ? 0 : value;
    setMyVotes((v) => ({ ...v, [placeId]: next }));
    setPlaces((ps) =>
      (ps ?? []).map((p) =>
        p.id !== placeId
          ? p
          : { ...p, likes: p.likes - (prev === 1 ? 1 : 0) + (next === 1 ? 1 : 0), dislikes: p.dislikes - (prev === -1 ? 1 : 0) + (next === -1 ? 1 : 0) },
      ),
    );
    enqueue(`vote:${placeId}`, () => api.vote(placeId, next));
  };

  const setKeywords = (placeId: string, next: KeywordKey[]) => {
    const prev = myKeywords[placeId] ?? [];
    setMyKeywords((m) => ({ ...m, [placeId]: next }));
    setPlaces((ps) =>
      (ps ?? []).map((p) => {
        if (p.id !== placeId) return p;
        const keywords = { ...p.keywords };
        for (const k of prev) keywords[k] = (keywords[k] ?? 1) - 1;
        for (const k of next) keywords[k] = (keywords[k] ?? 0) + 1;
        return { ...p, keywords };
      }),
    );
    enqueue(`kw:${placeId}`, () => api.setKeywords(placeId, next));
  };

  const onTipAdded = (tip: Tip) => {
    setRecentTips((ts) => [tip, ...(ts ?? [])]);
    setPlaces((ps) => (ps ?? []).map((p) => (p.id === tip.place_id ? { ...p, tip_count: p.tip_count + 1 } : p)));
  };

  // 🎲 오늘 뭐 먹지: 목록 탭에서 필터를 걸었으면 그 안에서 고른다
  const pool = tab === "list" ? listed : all;
  const roll = () => {
    if (!pool.length || rolling) return;
    setRolling(true);
    let n = 0;
    const t = setInterval(() => {
      setMode({ kind: "detail", id: pool[Math.floor(Math.random() * pool.length)].id });
      if (++n > 10) {
        clearInterval(t);
        setRolling(false);
        setSnap("full");
      }
    }, 90);
  };

  const startAdd = () => {
    setMode({ kind: "add" });
    setSnap("full");
  };
  const endAdd = (newId?: string) => {
    setPickMode(false);
    setPicked(null);
    if (newId) void reload().then(() => select(newId));
    else setMode({ kind: "browse" });
  };

  const naverPanel =
    selected?.naver_place_id && placeTab ? (
      <NaverPlacePanel name={selected.name} naverPlaceId={selected.naver_place_id} tab={placeTab} onTab={setPlaceTab} onClose={() => setPlaceTab(undefined)} />
    ) : null;

  const rank = selected ? rankPlaces(all, period === "week" && all.every((p) => p.weekly_score === 0) ? "all" : period).findIndex((p) => p.id === selected.id) + 1 : 0;

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="shrink-0 px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setMode({ kind: "browse" })} className="text-left">
            <p className="text-[11px] font-bold tracking-widest text-brand">MYEONGJEONG LUNCH</p>
            <h1 className="text-xl font-black">명정 점심 지도</h1>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {mode.kind !== "add" && (
              <button onClick={startAdd} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface">
                + 맛집 추가
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
        {mode.kind !== "add" && tab === "walk" && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface px-3.5 py-3 text-sm">
            {draftStops.length === 0 ? (
              <span className="text-muted">🚶 장소를 골라 내 코스를 짜 보세요</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate font-bold">
                  내 코스 {draftStops.length}곳 · {draftTime.rough ? "약 " : ""}
                  {draftTime.totalMinutes}분
                </span>
                <button onClick={() => openCourse(null)} className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-black text-brand-ink">
                  보기
                </button>
                <button onClick={() => updateDraft([])} className="shrink-0 text-xs font-bold text-muted hover:text-foreground">
                  비우기
                </button>
              </>
            )}
          </div>
        )}
        {mode.kind !== "add" && tab !== "walk" && (
          <button
            onClick={roll}
            disabled={!pool.length}
            className="mt-3 w-full rounded-2xl bg-brand py-3.5 text-lg font-black text-brand-ink shadow-[0_0_30px_rgba(3,199,90,0.3)] transition active:scale-[0.98] disabled:opacity-40"
          >
            🎲 {rolling ? "고르는 중…" : tab === "list" && isFiltered(filters) ? `조건 안에서 뭐 먹지? (${listed.length}곳)` : "오늘 뭐 먹지?"}
          </button>
        )}
        {mode.kind === "browse" && (
          <div className="mt-3 grid grid-cols-5 rounded-xl bg-surface p-1 text-xs font-bold">
            {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2 ${tab === k ? "bg-foreground text-background" : "text-muted"}`}>
                {TAB_LABEL[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadError ? (
          <p className="p-6 text-center text-sm text-danger">{loadError}</p>
        ) : places == null ? (
          <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>
        ) : mode.kind === "add" ? (
          <AddPlace
            picked={picked}
            onStartPick={() => {
              setPickMode(true);
              setSnap("peek");
            }}
            onCancel={() => endAdd()}
            onDone={(id) => endAdd(id)}
            onOpenExisting={(id) => {
              endAdd();
              select(id);
            }}
          />
        ) : selected ? (
          <PlaceDetail
            key={selected.id}
            place={selected}
            rank={rank}
            backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
            myVote={myVotes[selected.id] ?? 0}
            myKeywords={myKeywords[selected.id] ?? []}
            onVote={(v) => vote(selected.id, v)}
            onKeywords={(k) => setKeywords(selected.id, k)}
            onBack={() => setMode({ kind: "browse" })}
            onTipAdded={onTipAdded}
            openTab={placeTab}
            onOpenTab={(t) => setPlaceTab(t)}
            drawTeams={(teams ?? []).filter((t) => t.open_box && !t.open_box.locked)}
            onAddToBox={(id) => addToBox(id, selected.id)}
          />
        ) : mode.kind === "course" ? (
          <CourseDetail
            key={mode.courseId ?? "draft"}
            name={openedCourse === null ? null : (openedCourse?.name ?? "산책 코스")}
            summary={openedCourse?.summary ?? null}
            stops={courseStops}
            spots={spotMap}
            time={openedTime}
            backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
            onBack={() => setMode({ kind: "browse" })}
            onOpenSpot={openSpot}
            onMove={openedCourse === null ? moveDraftSpot : undefined}
            onRemove={openedCourse === null ? toggleDraftSpot : undefined}
            onCopy={
              openedCourse
                ? () => {
                    updateDraft(courseStops.map((st) => st.spot_id));
                    openCourse(null);
                  }
                : undefined
            }
          />
        ) : mode.kind === "spot" ? (
          openedSpot ? (
            <SpotDetail
              key={openedSpot.id}
              spot={openedSpot}
              legs={legMap}
              backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
              inDraft={draftSet.has(openedSpot.id)}
              draftFull={draftFull}
              onToggleDraft={() => toggleDraftSpot(openedSpot.id)}
              onBack={() => setMode({ kind: "browse" })}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted">산책 장소를 찾을 수 없어요.</p>
          )
        ) : tab === "walk" ? (
          walkError ? (
            <p className="p-6 text-center text-sm text-danger">{walkError}</p>
          ) : !walk ? (
            <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>
          ) : (
            <WalkPanel
              courses={walk.courses}
              spots={spotMap}
              spotList={walkSpotList}
              legs={legMap}
              draft={draftSet}
              draftFull={draftFull}
              maxMinutes={walkMaxMinutes}
              onMaxMinutes={setWalkMaxMinutes}
              onOpenCourse={openCourse}
              onOpenSpot={openSpot}
              onToggleSpot={toggleDraftSpot}
            />
          )
        ) : tab === "rank" ? (
          <RankingList places={all} period={period} onPeriod={setPeriod} onSelect={select} />
        ) : tab === "list" ? (
          <PlaceList places={listed} total={all.length} filters={filters} onFilters={setFilters} onSelect={select} latestTip={latestTip} />
        ) : tab === "tips" ? (
          <TipFeed tips={recentTips} places={all} onSelect={select} />
        ) : (
          <DrawTab
            places={all}
            teams={teams}
            teamsError={teamsError}
            teamId={teamId}
            onTeamId={setTeamId}
            onTeamsChanged={reloadTeams}
            onShowPlace={(id) => {
              select(id);
              setSnap("full");
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background">
      {isDesktop && <aside className="z-10 flex h-full w-[400px] shrink-0 flex-col border-r border-line">{panel}</aside>}
      {isDesktop && naverPanel && <aside className="z-10 flex h-full w-[400px] shrink-0 flex-col border-r border-line">{naverPanel}</aside>}
      {/* 네이버 지도 컨트롤보다 위에 오도록 z-index를 크게 둔다 */}
      {!isDesktop && naverPanel && <div className="fixed inset-0 z-[1000] bg-background pt-[env(safe-area-inset-top)]">{naverPanel}</div>}
      <main className="relative h-full flex-1">
        <NaverMap
          places={tab === "walk" ? [] : mapPlaces}
          spots={tab === "walk" ? walkSpotList : []}
          selectedSpotId={mode.kind === "spot" ? mode.id : null}
          onSelectSpot={openSpot}
          route={tab === "walk" ? walkRoute : placeRoute}
          selectedId={selectedId}
          onSelect={select}
          pickMode={pickMode}
          picked={picked}
          onPick={(p) => {
            setPicked(p);
            setPickMode(false);
            setSnap("full");
          }}
          bottomInset={!isDesktop && snap === "half" ? window.innerHeight * 0.5 : 0}
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
            className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-background px-5 py-3 text-sm font-bold shadow-lg"
          >
            위치 고르기 취소
          </button>
        )}
      </main>
    </div>
  );
}
