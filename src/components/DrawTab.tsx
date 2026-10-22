"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loadNickname, saveNickname } from "@/lib/api";
import { DRAW_ANIMATIONS, DRAW_LIMITS, drawWeights, MIN_DRAW_PLACES, type DrawAnimation, type DrawBox, type DrawLimit, type Place, type TeamDetail, type TeamSummary } from "@/lib/domain";
import { CategoryDot } from "./PlaceList";
import { DrawShow, type ShowEntry } from "./DrawShow";

// 추첨 탭: 팀 목록 → 팀 화면(추첨통, 추첨 기록). 팀 화면은 몇 초마다 다시 불러
// 조장이 추첨을 시작하면 지금 이 탭을 보고 있는 팀원 모두가 같은 연출을 본다.

const POLL_MS = 3000;

type Props = {
  places: Place[];
  teams: TeamSummary[] | null;
  teamsError: string | null;
  teamId: string | null;
  onTeamId: (id: string | null) => void;
  onTeamsChanged: () => Promise<void>;
  onShowPlace: (id: string) => void;
};

type Show = { box: DrawBox; entries: ShowEntry[] };

function showOf(box: DrawBox, byId: Map<string, Place>): Show | null {
  if (!box.result_place_id || !box.animation) return null;
  const entries = drawWeights(box.entries).flatMap((w) => {
    const place = byId.get(w.place_id);
    return place ? [{ place, weight: w.weight }] : [];
  });
  return entries.some((e) => e.place.id === box.result_place_id) ? { box, entries } : null;
}

export function DrawTab({ places, teams, teamsError, teamId, onTeamId, onTeamsChanged, onShowPlace }: Props) {
  if (teams == null)
    return teamsError ? (
      <p className="p-5 text-sm text-danger">
        {teamsError}{" "}
        <button onClick={() => void onTeamsChanged()} className="font-bold underline">
          다시 시도
        </button>
      </p>
    ) : (
      <p className="p-5 text-sm text-muted">불러오는 중…</p>
    );
  const summary = teams.find((t) => t.id === teamId);
  if (!teamId || !summary) return <TeamList teams={teams} onTeamId={onTeamId} onTeamsChanged={onTeamsChanged} />;
  return (
    <TeamView
      key={teamId}
      places={places}
      teams={teams}
      summary={summary}
      onTeamId={onTeamId}
      onTeamsChanged={onTeamsChanged}
      onShowPlace={onShowPlace}
    />
  );
}

function NicknameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={20}
      placeholder="내 닉네임"
      className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-brand"
    />
  );
}

function TeamList({ teams, onTeamId, onTeamsChanged }: { teams: TeamSummary[]; onTeamId: (id: string) => void; onTeamsChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      const id = await fn();
      saveNickname(nickname.trim());
      await onTeamsChanged();
      onTeamId(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => (await api.createTeam({ name, nickname, website })).id);
  };
  const join = (id: string) =>
    run(async () => {
      await api.joinTeam(id, nickname);
      return id;
    });

  const mine = teams.filter((t) => t.is_member);
  const others = teams.filter((t) => !t.is_member);

  return (
    <div className="space-y-6 px-5 pb-28 pt-1">
      <p className="text-sm text-muted">어디 갈지 의견이 나뉘면 팀 추첨통에 가게를 넣고 추첨해요. 많이 넣은 가게일수록 잘 뽑혀요.</p>

      {mine.length > 0 && (
        <section>
          <h3 className="text-sm font-black">내 팀</h3>
          <ul className="mt-2 space-y-1.5">
            {mine.map((t) => (
              <li key={t.id}>
                <button onClick={() => onTeamId(t.id)} className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left hover:bg-surface-2">
                  <span className="font-bold">
                    {t.is_leader && "👑 "}
                    {t.name}
                  </span>
                  <span className="text-xs font-bold text-muted">
                    {t.open_box ? <span className="text-brand">🎟️ 추첨통 열림 · </span> : null}
                    {t.member_count}명
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={create} className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <h3 className="text-sm font-black">팀 만들기</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="팀 이름 (예: 3층 점심팟)"
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-brand"
        />
        {/* 봇만 채우는 숨은 칸 */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <div className="flex gap-2">
          <NicknameInput value={nickname} onChange={setNickname} />
          <button disabled={busy || !name.trim() || !nickname.trim()} className="rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-40">
            만들기
          </button>
        </div>
        <p className="text-xs text-muted">만든 사람이 조장이 돼요. 조장만 추첨통을 만들고 추첨을 시작할 수 있어요.</p>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section>
        <h3 className="text-sm font-black">팀 목록</h3>
        {others.length === 0 && <p className="mt-2 text-sm text-muted">아직 들어갈 수 있는 다른 팀이 없어요.</p>}
        <ul className="mt-2 space-y-1.5">
          {others.map((t) => (
            <li key={t.id} className="rounded-xl border border-line px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-bold">{t.name}</span>
                <span className="flex items-center gap-2 text-xs font-bold text-muted">
                  {t.member_count}명
                  <button onClick={() => setJoining(joining === t.id ? null : t.id)} className="rounded-full border border-line px-3 py-1 text-foreground hover:bg-surface">
                    들어가기
                  </button>
                </span>
              </div>
              {joining === t.id && (
                <div className="mt-2 flex gap-2">
                  <NicknameInput value={nickname} onChange={setNickname} />
                  <button onClick={() => void join(t.id)} disabled={busy || !nickname.trim()} className="rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-40">
                    팀원 되기
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type ViewProps = Omit<Props, "teams" | "teamsError" | "teamId"> & { teams: TeamSummary[]; summary: TeamSummary };

function TeamView({ places, teams, summary, onTeamId, onTeamsChanged, onShowPlace }: ViewProps) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<DrawLimit>(2);
  const [animation, setAnimation] = useState<DrawAnimation>("race");
  const [query, setQuery] = useState("");
  const [nickname, setNickname] = useState(loadNickname);
  const [show, setShow] = useState<Show | null>(null);
  const [copied, setCopied] = useState(false);
  const watchingBox = useRef<string | null>(null);
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const refresh = useCallback(async () => {
    try {
      const { team } = await api.team(summary.id);
      setTeam(team);
      setError(null);
      // 보고 있던 추첨통이 추첨되면 연출을 띄운다
      const latest = team.records[0];
      if (watchingBox.current && !team.open_box && latest?.id === watchingBox.current) {
        const s = showOf(latest, byId);
        if (s) setShow(s);
      }
      watchingBox.current = team.open_box?.id ?? null;
    } catch (e) {
      setError((e as Error).message);
    }
  }, [summary.id, byId]);

  useEffect(() => {
    // 처음 한 번, 그 뒤로 몇 초마다 다시 불러온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([refresh(), onTeamsChanged()]);
    } catch (e) {
      setError((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    const url = `${location.origin}/?team=${summary.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("초대 링크를 복사하세요", url);
    }
  };

  const myTeams = teams.filter((t) => t.is_member);
  const box = team?.open_box ?? null;
  const weights = box ? drawWeights(box.entries) : [];
  const total = box?.entries.length ?? 0;
  const myUsed = box ? box.entries.filter((e) => e.is_mine).length : 0;
  const remaining = box ? box.per_member_limit - myUsed : 0;
  const memberCount = team?.members.length ?? 0;
  const putCount = box ? new Set(box.entries.map((e) => e.nickname)).size : 0;
  const q = query.trim();
  const found = q ? places.filter((p) => p.name.includes(q)).slice(0, 8) : [];
  const latest = team?.records[0];

  return (
    <div className="space-y-5 px-5 pb-28 pt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => onTeamId(null)} className="rounded-full border border-line px-3 py-1 text-xs font-bold text-muted hover:bg-surface">
          ← 팀 목록
        </button>
        {myTeams.map((t) => (
          <button
            key={t.id}
            onClick={() => onTeamId(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${t.id === summary.id ? "bg-foreground text-background" : "bg-surface text-muted"}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-black">{summary.name}</h2>
          <button onClick={() => void copyInvite()} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-surface">
            {copied ? "복사했어요" : "🔗 초대 링크"}
          </button>
        </div>
        <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
          {team?.members.map((m, i) => (
            <span key={i} className={`rounded-full px-2 py-0.5 ${m.is_me ? "bg-brand/20 text-brand" : "bg-surface-2"}`}>
              {m.is_leader && "👑 "}
              {m.nickname}
              {m.is_me && " (나)"}
            </span>
          ))}
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!team ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : !team.is_member ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <p className="text-sm font-bold">이 팀에 들어가서 추첨에 참여할까요?</p>
          <div className="flex gap-2">
            <NicknameInput value={nickname} onChange={setNickname} />
            <button
              onClick={() =>
                void act(async () => {
                  await api.joinTeam(summary.id, nickname);
                  saveNickname(nickname.trim());
                })
              }
              disabled={busy || !nickname.trim()}
              className="rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-40"
            >
              팀원 되기
            </button>
          </div>
        </div>
      ) : !box ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="font-black">🎟️ 추첨통</h3>
          {team.is_leader ? (
            <>
              <p className="mt-1 text-sm text-muted">한 사람이 몇 번까지 넣을 수 있게 할까요? 같은 가게에 여러 번 넣으면 그만큼 잘 뽑혀요.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {DRAW_LIMITS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setLimit(n)}
                    className={`rounded-lg py-2 text-sm font-bold ${limit === n ? "bg-foreground text-background" : "bg-surface-2"}`}
                  >
                    {n}번
                  </button>
                ))}
              </div>
              <button
                onClick={() => void act(() => api.openBox(summary.id, limit))}
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-brand py-3 font-black text-brand-ink disabled:opacity-40"
              >
                추첨통 만들기
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">조장이 추첨통을 만들면 가게를 넣을 수 있어요.</p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-brand/50 bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-black">🎟️ 추첨통</h3>
            <span className="text-xs font-bold text-muted">
              한 사람당 {box.per_member_limit}번 · {memberCount}명 중 {putCount}명 넣었어요
            </span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {weights.length === 0 && <li className="text-sm text-muted">아직 들어간 가게가 없어요.</li>}
            {weights.map((w) => {
              const p = byId.get(w.place_id);
              const who = box.entries.filter((e) => e.place_id === w.place_id);
              const mine = who.filter((e) => e.is_mine).length;
              return (
                <li key={w.place_id} className="relative overflow-hidden rounded-lg bg-background px-3 py-2">
                  <span className="absolute inset-y-0 left-0 bg-brand/20" style={{ width: `${(w.weight / total) * 100}%` }} />
                  <div className="relative flex items-center gap-2">
                    {p && <CategoryDot category={p.category} />}
                    <button onClick={() => p && onShowPlace(p.id)} className="min-w-0 flex-1 truncate text-left text-sm font-bold">
                      {p?.name ?? "삭제된 가게"}
                    </button>
                    <span className="shrink-0 text-xs font-bold text-brand">
                      🎟️×{w.weight} · {Math.round((w.weight / total) * 100)}%
                    </span>
                    {mine > 0 && (
                      <button onClick={() => void act(() => api.removeEntry(summary.id, w.place_id))} disabled={busy} className="h-6 w-6 shrink-0 rounded-full bg-surface-2 text-sm font-black">
                        −
                      </button>
                    )}
                    {remaining > 0 && (
                      <button onClick={() => void act(() => api.addEntry(summary.id, w.place_id))} disabled={busy} className="h-6 w-6 shrink-0 rounded-full bg-brand text-sm font-black text-brand-ink">
                        +
                      </button>
                    )}
                  </div>
                  <p className="relative mt-0.5 text-[11px] text-muted">{who.map((e) => e.nickname).join(", ")}</p>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs font-bold text-muted">{remaining > 0 ? `내가 더 넣을 수 있는 횟수: ${remaining}번` : "넣을 수 있는 만큼 다 넣었어요"}</p>
          {remaining > 0 && (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="가게 이름으로 찾아 넣기"
                className="mt-2 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-brand"
              />
              <ul className="mt-1">
                {found.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() =>
                        void act(async () => {
                          await api.addEntry(summary.id, p.id);
                          setQuery("");
                        })
                      }
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <CategoryDot category={p.category} />
                      <span className="flex-1 truncate font-bold">{p.name}</span>
                      <span className="text-xs font-bold text-brand">넣기</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted">가게 화면의 「추첨통에 넣기」로도 넣을 수 있어요.</p>
            </>
          )}

          {team.is_leader && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-bold text-muted">연출</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DRAW_ANIMATIONS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAnimation(a.key)}
                    className={`rounded-lg py-2 text-sm font-bold ${animation === a.key ? "bg-foreground text-background" : "bg-surface-2"}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void act(() => api.draw(summary.id, animation))}
                disabled={busy || weights.length < MIN_DRAW_PLACES}
                className="mt-3 w-full rounded-xl bg-brand py-3 text-lg font-black text-brand-ink shadow-[0_0_30px_rgba(3,199,90,0.3)] disabled:opacity-40"
              >
                {weights.length < MIN_DRAW_PLACES ? `가게가 ${MIN_DRAW_PLACES}곳 이상 있어야 해요` : "🎲 추첨 시작"}
              </button>
              <button
                onClick={() => confirm("추첨통을 취소할까요? 넣은 가게는 모두 사라져요.") && void act(() => api.cancelBox(summary.id))}
                disabled={busy}
                className="mt-2 w-full text-xs font-bold text-muted underline"
              >
                추첨통 취소
              </button>
            </div>
          )}
        </section>
      )}

      {latest && (
        <section>
          <h3 className="text-sm font-black">🏆 추첨 기록</h3>
          <ul className="mt-2 space-y-1.5">
            {team!.records.map((r, i) => {
              const p = r.result_place_id ? byId.get(r.result_place_id) : undefined;
              const replay = i === 0 ? showOf(r, byId) : null;
              return (
                <li key={r.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${i === 0 ? "border border-gold/60 bg-surface" : ""}`}>
                  <span className="w-12 shrink-0 text-xs font-bold text-muted">{r.drawn_at ? new Date(r.drawn_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : ""}</span>
                  {p && <CategoryDot category={p.category} />}
                  <button onClick={() => p && onShowPlace(p.id)} className="min-w-0 flex-1 truncate text-left text-sm font-bold">
                    {p?.name ?? "삭제된 가게"}
                  </button>
                  {replay && (
                    <button onClick={() => setShow(replay)} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-surface-2">
                      ▶ 다시 보기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {team?.is_member && (
        <button
          onClick={() => {
            const warn = team.is_leader ? "조장이 나가면 이 팀에서는 아무도 추첨을 시작할 수 없어요. 그래도 나갈까요?" : "이 팀에서 나갈까요?";
            if (!confirm(warn)) return;
            void act(async () => {
              await api.leaveTeam(summary.id);
              onTeamId(null);
            });
          }}
          className="text-xs font-bold text-muted underline"
        >
          팀 나가기
        </button>
      )}

      {show && (
        <DrawShow
          animation={show.box.animation!}
          entries={show.entries}
          winnerId={show.box.result_place_id!}
          seed={show.box.id}
          onClose={() => setShow(null)}
          onShowPlace={(id) => {
            setShow(null);
            onShowPlace(id);
          }}
        />
      )}
    </div>
  );
}
