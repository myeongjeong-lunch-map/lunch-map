"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api, type SearchResult } from "@/lib/api";
import { acceptsEntries } from "@/lib/drawBox";
import { ranking, type LunchCourse, type RankingPeriod, type TeamSummary } from "@/lib/domain";
import { usePlaceList } from "@/lib/usePlaceList";
import type { PlaceTab } from "@/lib/naverPlaceId";
import { NaverMap } from "@/components/map/NaverMap";
import { useLunchRouteLine, usePlaceRouteLine, useWalkRouteLine } from "@/components/map/routeLine";
import { useDicePicks } from "@/components/place/useDicePicks";
import { PlaceList, applyFilters, isFiltered, DEFAULT_FILTERS, type Filters } from "@/components/place/PlaceList";
import { RankingList } from "@/components/place/RankingList";
import { TipFeed } from "@/components/place/TipFeed";
import { WalkPanel } from "@/components/walk/WalkPanel";
import { CourseDetail } from "@/components/walk/CourseDetail";
import { LunchCourseDetail } from "@/components/walk/LunchCourseDetail";
import { SpotDetail } from "@/components/walk/SpotDetail";
import { useWalkMap } from "@/components/walk/useWalkMap";
import { PlaceDetail } from "@/components/place/PlaceDetail";
import { AddPlace } from "@/components/place/AddPlace";
import { BottomSheet, type SheetSnap } from "@/components/ui/BottomSheet";
import { NaverPlacePanel } from "@/components/map/NaverPlacePanel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DrawTab } from "@/components/draw/DrawTab";
import { useHalloween } from "@/components/ui/useHalloween";
import { isGhost, TRICK_CHANCE, TRICKS, type Trick } from "@/lib/halloween";

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
// spot: 산책 장소 보기, course: 산책 코스 보기 (courseId가 null이면 내 코스), lunch: 점심 코스 보기
type Mode =
  | { kind: "browse" }
  | { kind: "detail"; id: string; tab?: PlaceTab }
  | { kind: "add" }
  | { kind: "spot"; id: string }
  | { kind: "course"; courseId: string | null }
  | { kind: "lunch"; course: LunchCourse };

export function LunchMap() {
  const isDesktop = useIsDesktop();
  const { places, myVotes, myKeywords, recentTips, loadError, reload, vote, setKeywords, addTip } = usePlaceList();
  const [tab, setTab] = useState<Tab>("rank");
  // 고르기 전에는 이벤트 기간이면 할로윈 순위, 아니면 이번 주
  const [pickedPeriod, setPeriod] = useState<RankingPeriod | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<Mode>({ kind: "browse" });
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  // 가게 추가: 장소 검색 결과(지도에 번호 핀), 고른 번호, 지도에서 누른 번호 핀
  const [candidates, setCandidates] = useState<SearchResult[] | null>(null);
  const [chosenCandidate, setChosenCandidate] = useState<number | null>(null);
  const [mapChoice, setMapChoice] = useState<{ index: number; n: number } | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [rolling, setRolling] = useState(false);
  // 할로윈 Trick or Treat: 마지막으로 뽑은 가게와 그때 나온 트릭(없으면 트릿)
  const [rolled, setRolled] = useState<{ id: string; trick: Trick | null } | null>(null);
  const halloween = useHalloween();
  const period: RankingPeriod = pickedPeriod ?? (halloween ? "halloween" : "week");
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamId, setTeamIdState] = useState<string | null>(null);
  const walk = useWalkMap();

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

  useEffect(() => {
    // 할로윈 테마 색은 <html data-event>로 바꾼다 (globals.css)
    if (halloween) document.documentElement.dataset.event = "halloween";
    else delete document.documentElement.dataset.event;
  }, [halloween]);

  const all = useMemo(() => places ?? [], [places]);
  const ghosts = useMemo(() => all.filter(isGhost), [all]);
  const dice = useDicePicks(all);

  // 산책: 지금 열린 코스(내 코스면 courseId가 null)와 열린 장소. 경로선은 산책 지도 모듈이 계산한 값을 그대로 쓴다
  const openedCourse = useMemo(() => (mode.kind === "course" ? walk.course(mode.courseId) : null), [mode, walk]);
  const openedSpot = mode.kind === "spot" ? (walk.spotMap.get(mode.id) ?? null) : null;
  const routeIds = useMemo(
    () => (mode.kind === "spot" ? (openedSpot ? [openedSpot.id] : []) : (openedCourse?.stopIds ?? [])),
    [mode.kind, openedSpot, openedCourse],
  );
  const walkRoute = useWalkRouteLine({
    stopIds: routeIds,
    spots: walk.spotMap,
    time: openedCourse?.time ?? null,
    leg: openedSpot ? walk.campusLeg(openedSpot.id) : undefined,
    oneWay: mode.kind === "spot",
  });

  // 점심 코스는 산책 탭뿐 아니라 가게 카드·추첨 결과에서도 열리므로 탭과 상관없이 가게와 산책 장소 마커, 세 구간 경로선을 그린다
  const openedLunch = mode.kind === "lunch" ? mode.course : null;
  const lunchRoute = useLunchRouteLine(openedLunch);

  const raiseSheet = () => setSnap((s) => (s === "peek" ? "half" : s));
  const openSpot = (id: string) => {
    setMode({ kind: "spot", id });
    raiseSheet();
  };
  const openLunch = (course: LunchCourse) => {
    setMode({ kind: "lunch", course });
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
  const selected = selectedId ? (all.find((p) => p.id === selectedId) ?? null) : null;
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

  // 🎲 오늘 뭐 먹지: 후보를 담았으면 그 안에서, 아니면 목록 탭에서 필터를 걸었을 때 그 안에서 고른다
  const pool = dice.picks.length ? dice.picks : tab === "list" ? listed : all;
  const roll = () => {
    if (!pool.length || rolling) return;
    setRolling(true);
    setRolled(null);
    const trick = halloween && Math.random() < TRICK_CHANCE ? TRICKS[Math.floor(Math.random() * TRICKS.length)] : null;
    let n = 0;
    const t = setInterval(() => {
      let id = pool[Math.floor(Math.random() * pool.length)].id;
      if (++n > 10) {
        clearInterval(t);
        if (trick?.pick === "farthest") id = [...pool].sort((a, b) => (b.walking_seconds ?? 0) - (a.walking_seconds ?? 0))[0].id;
        if (halloween) setRolled({ id, trick });
        setRolling(false);
        setSnap("full");
      }
      setMode({ kind: "detail", id });
    }, 90);
  };

  const startAdd = () => {
    setMode({ kind: "add" });
    setSnap("full");
  };
  const endAdd = (newId?: string) => {
    setPickMode(false);
    setPicked(null);
    setCandidates(null);
    setChosenCandidate(null);
    setMapChoice(null);
    if (newId) void reload().then(() => select(newId));
    else setMode({ kind: "browse" });
  };

  const naverPanel =
    selected?.naver_place_id && placeTab ? (
      <NaverPlacePanel name={selected.name} naverPlaceId={selected.naver_place_id} tab={placeTab} onTab={setPlaceTab} onClose={() => setPlaceTab(undefined)} />
    ) : null;

  const rank = selected ? ranking(all, period).ranked.findIndex((p) => p.id === selected.id) + 1 : 0;

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="relative shrink-0 overflow-hidden px-5 pb-3 pt-4">
        {halloween && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1 h-10">
            <span className="lm-bat top-1">🦇</span>
            <span className="lm-bat top-5 [animation-delay:-3s] [animation-duration:11s]">🦇</span>
            <span className="lm-bat top-2 [animation-delay:-6.5s] [animation-duration:13s]">🦇</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setMode({ kind: "browse" })} className="text-left">
            <p className="text-[11px] font-bold tracking-widest text-brand">{halloween ? "🎃 HAPPY HALLOWEEN" : "MYEONGJEONG LUNCH"}</p>
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
            {walk.draftCourse.stops.length === 0 ? (
              <span className="text-muted">🚶 장소를 골라 내 코스를 짜 보세요</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate font-bold">
                  내 코스 {walk.draftCourse.stops.length}곳 · {walk.draftCourse.time.rough ? "약 " : ""}
                  {walk.draftCourse.time.totalMinutes}분
                </span>
                <button onClick={() => openCourse(null)} className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs font-black text-brand-ink">
                  보기
                </button>
                <button onClick={walk.draft.clear} className="shrink-0 text-xs font-bold text-muted hover:text-foreground">
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
            {halloween ? "🍬" : "🎲"}{" "}
            {rolling
              ? "고르는 중…"
              : dice.picks.length
                ? `후보 ${dice.picks.length}곳 중에 ${halloween ? "Trick or Treat!" : "뭐 먹지?"}`
                : tab === "list" && isFiltered(filters)
                  ? `조건 안에서 ${halloween ? "Trick or Treat!" : "뭐 먹지?"} (${listed.length}곳)`
                  : halloween
                    ? "Trick or Treat!"
                    : "오늘 뭐 먹지?"}
          </button>
        )}
        {halloween && mode.kind === "browse" && tab !== "walk" && all.length > 0 && (
          <button
            onClick={() => ghosts.length && select(ghosts[Math.floor(Math.random() * ghosts.length)].id)}
            className="mt-3 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-left"
          >
            <span className="flex justify-between text-xs font-bold">
              <span>{ghosts.length ? `👻 유령 ${ghosts.length}곳 남음 · 꿀팁으로 퇴치!` : "🎃 유령을 모두 퇴치했어요!"}</span>
              <span className="text-brand">{ghosts.length ? "유령 찾기 →" : ""}</span>
            </span>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${((all.length - ghosts.length) / all.length) * 100}%` }} />
            </span>
            <span className="mt-1 block text-[11px] text-muted">
              퇴치 {all.length - ghosts.length} / {all.length} · 10월 30일(금)까지
            </span>
          </button>
        )}
        {mode.kind !== "add" && tab !== "walk" && dice.picks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {dice.picks.map((p) => (
                <button
                  key={p.id}
                  onClick={() => dice.toggle(p.id)}
                  aria-label={`${p.name} 후보에서 빼기`}
                  className="shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand/25"
                >
                  {p.name} ✕
                </button>
              ))}
            </div>
            <button onClick={dice.clear} className="shrink-0 text-xs font-bold text-muted hover:text-foreground">
              비우기
            </button>
          </div>
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
            onResults={(r) => {
              setCandidates(r);
              setChosenCandidate(null);
              // 모바일은 시트를 반만 내려 번호 핀이 보이게 한다
              if (r?.length) setSnap("half");
            }}
            onChosen={(i) => {
              setChosenCandidate(i);
              if (i != null) setSnap("full");
            }}
            mapChoice={mapChoice}
          />
        ) : selected ? (
          <>
            {rolled?.id === selected.id && (
              <p className="mx-5 mb-2 rounded-xl bg-brand/15 px-3 py-2.5 text-sm font-bold text-brand">
                {rolled.trick ? `${rolled.trick.emoji} Trick! ${rolled.trick.text}` : "🍬 Treat! 오늘의 사탕 같은 가게예요"}
              </p>
            )}
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
              onTipAdded={addTip}
              openTab={placeTab}
              onOpenTab={(t) => setPlaceTab(t)}
              drawTeams={(teams ?? []).filter((t) => acceptsEntries(t.open_box))}
              onAddToBox={(id) => addToBox(id, selected.id)}
              dicePicked={dice.has(selected.id)}
              onDicePick={() => dice.toggle(selected.id)}
              halloween={halloween}
              walk={walk}
              onOpenLunch={openLunch}
            />
          </>
        ) : openedLunch ? (
          <LunchCourseDetail
            key={`${openedLunch.mode}|${openedLunch.place.id}|${openedLunch.spot.id}`}
            course={openedLunch}
            backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
            onBack={() => setMode({ kind: "browse" })}
            onOpenPlace={select}
            onOpenSpot={(id) => {
              setTab("walk");
              openSpot(id);
            }}
          />
        ) : openedCourse ? (
          <CourseDetail
            key={mode.kind === "course" ? (mode.courseId ?? "draft") : "draft"}
            course={openedCourse}
            backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
            onBack={() => setMode({ kind: "browse" })}
            onOpenSpot={openSpot}
            onMove={openedCourse.id === null ? walk.draft.move : undefined}
            onRemove={openedCourse.id === null ? walk.draft.toggle : undefined}
            onCopy={
              openedCourse.id !== null
                ? () => {
                    walk.draft.replace(openedCourse.stopIds);
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
              walk={walk}
              backLabel={`${TAB_LABEL[tab].split(" ")[1]}으로`}
              onBack={() => setMode({ kind: "browse" })}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted">산책 장소를 찾을 수 없어요.</p>
          )
        ) : tab === "walk" ? (
          walk.status === "error" ? (
            <p className="p-6 text-center text-sm text-danger">{walk.error}</p>
          ) : walk.status === "loading" ? (
            <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>
          ) : (
            <WalkPanel walk={walk} places={all} onOpenCourse={openCourse} onOpenSpot={openSpot} onOpenLunch={openLunch} />
          )
        ) : tab === "rank" ? (
          <RankingList places={all} period={period} onPeriod={setPeriod} onSelect={select} halloween={halloween} />
        ) : tab === "list" ? (
          <PlaceList places={listed} total={all.length} filters={filters} onFilters={setFilters} onSelect={select} latestTip={latestTip} dicePicks={dice} />
        ) : tab === "tips" ? (
          <TipFeed tips={recentTips} places={all} onSelect={select} halloween={halloween} />
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
            walk={walk}
            onOpenLunch={openLunch}
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
          places={openedLunch ? [openedLunch.place] : tab === "walk" ? [] : mapPlaces}
          spots={openedLunch ? [openedLunch.spot] : tab === "walk" ? walk.spots : []}
          selectedSpotId={mode.kind === "spot" ? mode.id : null}
          onSelectSpot={openSpot}
          route={openedLunch ? lunchRoute : tab === "walk" ? walkRoute : placeRoute}
          selectedId={selectedId}
          halloween={halloween}
          onSelect={select}
          pickMode={pickMode}
          picked={picked}
          onPick={(p) => {
            setPicked(p);
            setPickMode(false);
            setSnap("full");
          }}
          bottomInset={!isDesktop && snap === "half" ? window.innerHeight * 0.5 : 0}
          candidates={mode.kind === "add" ? candidates : null}
          chosenCandidate={chosenCandidate}
          onPickCandidate={(index) => setMapChoice((c) => ({ index, n: (c?.n ?? 0) + 1 }))}
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
