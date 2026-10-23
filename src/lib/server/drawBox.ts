import "server-only";
import { randomInt } from "node:crypto";
import { drawBoxRules, isLocked, remainingEntries } from "@/lib/drawBox";
import { MIN_DRAW_PLACES, type DrawAnimation, type DrawBox, type DrawLimit, type DrawResult } from "@/lib/domain";
import { db } from "./supabase";
import { HttpError } from "./guard";
import { requireLeader, requireMember } from "./teams";

// 추첨통 모듈: 열기·취소·넣기·빼기·뽑기·결정·나가기. 규칙 검사와 DB 순서는 모두 이 안에 있고,
// 라우트는 요청을 읽어 아래 함수를 부르기만 한다. 순수한 "지금 할 수 있는가" 계산은 src/lib/drawBox.ts.
// 규칙 검사 순서: 조장/팀원 → 열린 추첨통 → 잠김 → 횟수/후보. DB 작업이 두 번 이상인 것(취소, 나가기)도
// 여기서만 순서를 정한다. 나중에 DB 트랜잭션(RPC)으로 바꿔도 이 파일 안에서만 바뀐다.

export const BOX_COLUMNS = "id, team_id, per_member_limit, status, result_place_id, drawn_at, created_at";

export type BoxRow = { id: string; team_id: string; per_member_limit: number; status: DrawBox["status"]; result_place_id: string | null; drawn_at: string | null };
type ResultRow = DrawResult & { box_id: string };
type EntryRow = { id: string; member_id: string; place_id: string };

// ---------- 쓰기 ----------

/** 추첨통 만들기: 조장만. 팀마다 열린 추첨통은 하나뿐이다. */
export async function openBox(teamId: string, me: string | null, limit: DrawLimit): Promise<void> {
  await requireLeader(teamId, me);
  const { error } = await db().from("draw_boxes").insert({ team_id: teamId, per_member_limit: limit });
  if (error) {
    if (error.code === "23505") throw new HttpError(409, "이미 열린 추첨통이 있어요.");
    throw error;
  }
}

/** 추첨통 취소: 조장만. 넣은 내용은 사라지고 추첨 기록에도 남지 않는다. */
export async function cancelBox(teamId: string, me: string | null): Promise<void> {
  await requireLeader(teamId, me);
  const box = await requireOpenBox(teamId);
  const { error } = await db().from("draw_boxes").update({ status: "cancelled" }).eq("id", box.id).eq("status", "open");
  if (error) throw error;
  const { error: delErr } = await db().from("draw_entries").delete().eq("box_id", box.id);
  if (delErr) throw delErr;
}

/** 가게 넣기: 팀원만, 첫 추첨 전에만, 한 사람당 정해진 횟수까지. 같은 가게를 여러 번 넣을 수 있다. */
export async function putEntry(teamId: string, me: string | null, placeId: string): Promise<void> {
  await requireMember(teamId, me);
  const box = await requireOpenBox(teamId);
  await requireUnlocked(box.id);
  const over = () => new HttpError(409, `한 사람당 ${box.per_member_limit}번까지 넣을 수 있어요.`);
  if (remainingEntries(box.per_member_limit, await myEntryCount(box.id, me!)) <= 0) throw over();

  const { data, error } = await db().from("draw_entries").insert({ box_id: box.id, member_id: me, place_id: placeId }).select("id").single();
  if (error) {
    if (error.code === "23503" || error.code === "22P02") throw new HttpError(404, "가게를 찾을 수 없어요.");
    throw error;
  }
  // 연달아 눌러 동시에 들어간 요청이 횟수를 넘겼으면 방금 넣은 것을 되돌린다
  if ((await myEntryCount(box.id, me!)) > box.per_member_limit) {
    await db().from("draw_entries").delete().eq("id", data.id);
    throw over();
  }
}

/** 내가 넣은 가게 한 번 빼기: 팀원만, 첫 추첨 전에만. 넣은 적이 없으면 아무 일도 없다. */
export async function takeEntry(teamId: string, me: string | null, placeId: string): Promise<void> {
  await requireMember(teamId, me);
  const box = await requireOpenBox(teamId);
  await requireUnlocked(box.id);
  const { data, error } = await db().from("draw_entries").select("id").eq("box_id", box.id).eq("member_id", me!).eq("place_id", placeId).limit(1);
  if (error) throw error;
  if (data?.[0]) {
    const { error: delErr } = await db().from("draw_entries").delete().eq("id", data[0].id);
    if (delErr) throw delErr;
  }
}

/**
 * 추첨(다시 뽑기 포함): 조장만. 후보 항목 가운데 넣은 한 번 한 번을 고르게 뽑으므로
 * 가게별 확률은 가중치 ÷ 가중치 합이다. 앞 회차에 뽑힌 가게는 뺀다 (ADR 0004).
 */
export async function draw(teamId: string, me: string | null, animation: DrawAnimation): Promise<DrawResult> {
  await requireLeader(teamId, me);
  const box = await requireOpenBox(teamId);
  const [entries, results] = await Promise.all([boxEntryRows(box.id), boxResults([box.id])]);
  const done = results.get(box.id) ?? [];
  const rules = drawBoxRules({ perMemberLimit: box.per_member_limit, entries, myEntryCount: 0, results: done });
  if (rules.drawBlock) {
    throw new HttpError(409, rules.drawBlock === "onlyOneLeft" ? "남은 가게가 1곳뿐이라 다시 뽑을 수 없어요." : `서로 다른 가게가 ${MIN_DRAW_PLACES}곳 이상 들어 있어야 추첨할 수 있어요.`);
  }

  const winner = rules.candidates[randomInt(rules.candidates.length)];
  const { data, error } = await db()
    .from("draw_results")
    .insert({ box_id: box.id, round: done.length + 1, place_id: winner.place_id, animation })
    .select("id, round, place_id, animation, drawn_at")
    .single();
  if (error) {
    // 같은 회차를 동시에 두 번 뽑으려 하면 하나만 남는다
    if (error.code === "23505") throw new HttpError(409, "방금 다른 추첨이 먼저 끝났어요. 다시 확인해 주세요.");
    throw error;
  }
  return data as DrawResult;
}

/** 결정: 조장만. 마지막 회차에 뽑힌 가게로 정하면 추첨통이 닫히고 추첨 기록에 남는다. */
export async function decide(teamId: string, me: string | null): Promise<void> {
  await requireLeader(teamId, me);
  const box = await requireOpenBox(teamId);
  const last = (await boxResults([box.id])).get(box.id)?.at(-1);
  if (!last) throw new HttpError(409, "먼저 추첨해 주세요.");
  const { data, error } = await db()
    .from("draw_boxes")
    .update({ status: "drawn", result_place_id: last.place_id, animation: last.animation, drawn_at: new Date().toISOString() })
    .eq("id", box.id)
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(409, "이미 결정했거나 취소된 추첨통이에요.");
}

/** 팀 나가기: 열린 추첨통에 넣은 것도 함께 뺀다. 팀원이 아니어도(쿠키가 없어도) 오류 없이 끝난다. */
export async function leaveTeam(teamId: string, me: string | null): Promise<void> {
  if (!me) return;
  const box = await findOpenBox(teamId);
  if (box) {
    const { error } = await db().from("draw_entries").delete().eq("box_id", box.id).eq("member_id", me);
    if (error) throw error;
  }
  const { error } = await db().from("team_members").delete().eq("team_id", teamId).eq("member_id", me);
  if (error) throw error;
}

// ---------- 읽기 (팀 화면이 쓴다) ----------

export async function findOpenBox(teamId: string): Promise<BoxRow | null> {
  const { data, error } = await db().from("draw_boxes").select(BOX_COLUMNS).eq("team_id", teamId).eq("status", "open").maybeSingle();
  if (error) throw error;
  return data as BoxRow | null;
}

/** 팀 목록용: 모든 팀의 열린 추첨통과, 내가 거기 넣은 횟수(추첨통 ID별) */
export async function openBoxSummaries(me: string | null, myTeamIds: Set<string>) {
  const { data, error } = await db().from("draw_boxes").select("id, team_id, per_member_limit").eq("status", "open");
  if (error) throw error;
  const mine = (data ?? []).filter((b) => myTeamIds.has(b.team_id));
  const used = new Map<string, number>();
  if (me && mine.length) {
    const { data: entries, error: entErr } = await db()
      .from("draw_entries")
      .select("box_id")
      .eq("member_id", me)
      .in(
        "box_id",
        mine.map((b) => b.id),
      );
    if (entErr) throw entErr;
    for (const e of entries ?? []) used.set(e.box_id, (used.get(e.box_id) ?? 0) + 1);
  }
  return { boxes: mine, used, locked: new Map([...(await boxResults(mine.map((b) => b.id)))].map(([id, r]) => [id, isLocked(r.length)])) };
}

/** 추첨 기록: 결정으로 닫힌 추첨통, 최근 것부터 */
export async function decidedBoxes(teamId: string, limit: number): Promise<BoxRow[]> {
  const { data, error } = await db().from("draw_boxes").select(BOX_COLUMNS).eq("team_id", teamId).eq("status", "drawn").order("drawn_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as BoxRow[];
}

export async function boxEntryRows(boxId: string): Promise<EntryRow[]> {
  const { data, error } = await db().from("draw_entries").select("id, member_id, place_id").eq("box_id", boxId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** 추첨통들의 회차별 결과. 추첨통 ID별로 1회차부터 */
export async function boxResults(boxIds: string[]): Promise<Map<string, DrawResult[]>> {
  const out = new Map<string, DrawResult[]>();
  if (!boxIds.length) return out;
  const { data, error } = await db().from("draw_results").select("id, box_id, round, place_id, animation, drawn_at").in("box_id", boxIds).order("round");
  if (error) throw error;
  for (const { box_id, ...r } of (data ?? []) as ResultRow[]) out.set(box_id, [...(out.get(box_id) ?? []), r]);
  return out;
}

// ---------- 안쪽 ----------

async function requireOpenBox(teamId: string): Promise<BoxRow> {
  const box = await findOpenBox(teamId);
  if (!box) throw new HttpError(409, "열린 추첨통이 없어요.");
  return box;
}

async function requireUnlocked(boxId: string): Promise<void> {
  const { count, error } = await db().from("draw_results").select("id", { count: "exact", head: true }).eq("box_id", boxId);
  if (error) throw error;
  if (isLocked(count ?? 0)) throw new HttpError(409, "이미 추첨을 해서 가게를 넣거나 뺄 수 없어요.");
}

async function myEntryCount(boxId: string, me: string): Promise<number> {
  const { count, error } = await db().from("draw_entries").select("id", { count: "exact", head: true }).eq("box_id", boxId).eq("member_id", me);
  if (error) throw error;
  return count ?? 0;
}
