import "server-only";
import type { DrawBox, DrawLimit, TeamDetail, TeamSummary } from "@/lib/domain";
import { db } from "./supabase";
import { HttpError } from "./guard";

// 팀원은 평가와 같은 브라우저 쿠키(lm_voter)로 구분한다 (ADR 0003).

const RECORD_LIMIT = 20;
const BOX_COLUMNS = "id, team_id, per_member_limit, status, animation, result_place_id, drawn_at, created_at";

type BoxRow = { id: string; team_id: string; per_member_limit: number; status: DrawBox["status"]; animation: DrawBox["animation"]; result_place_id: string | null; drawn_at: string | null };

function toBox(row: BoxRow, entries: DrawBox["entries"]): DrawBox {
  return {
    id: row.id,
    per_member_limit: row.per_member_limit as DrawLimit,
    status: row.status,
    animation: row.animation,
    result_place_id: row.result_place_id,
    drawn_at: row.drawn_at,
    entries,
  };
}

export async function listTeams(me: string | null): Promise<TeamSummary[]> {
  const [teams, members, boxes] = await Promise.all([
    db().from("teams").select("id, name, leader_id, created_at").order("created_at", { ascending: false }),
    db().from("team_members").select("team_id, member_id"),
    db().from("draw_boxes").select("id, team_id, per_member_limit").eq("status", "open"),
  ]);
  for (const r of [teams, members, boxes]) if (r.error) throw r.error;

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const m of members.data ?? []) {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
    if (me && m.member_id === me) mine.add(m.team_id);
  }
  const myBoxes = (boxes.data ?? []).filter((b) => mine.has(b.team_id));
  const used = new Map<string, number>();
  if (me && myBoxes.length) {
    const { data, error } = await db()
      .from("draw_entries")
      .select("box_id")
      .eq("member_id", me)
      .in(
        "box_id",
        myBoxes.map((b) => b.id),
      );
    if (error) throw error;
    for (const e of data ?? []) used.set(e.box_id, (used.get(e.box_id) ?? 0) + 1);
  }
  const boxByTeam = new Map(myBoxes.map((b) => [b.team_id, b]));

  return (teams.data ?? []).map((t) => {
    const box = boxByTeam.get(t.id);
    return {
      id: t.id,
      name: t.name,
      member_count: counts.get(t.id) ?? 0,
      is_member: mine.has(t.id),
      is_leader: !!me && t.leader_id === me,
      open_box: box ? { id: box.id, remaining: Math.max(0, box.per_member_limit - (used.get(box.id) ?? 0)) } : null,
    };
  });
}

export async function getTeam(teamId: string): Promise<{ id: string; name: string; leader_id: string }> {
  const { data, error } = await db().from("teams").select("id, name, leader_id").eq("id", teamId).maybeSingle();
  if (error) {
    if (error.code === "22P02") throw new HttpError(404, "팀을 찾을 수 없어요.");
    throw error;
  }
  if (!data) throw new HttpError(404, "팀을 찾을 수 없어요.");
  return data;
}

export async function isMember(teamId: string, me: string | null): Promise<boolean> {
  if (!me) return false;
  const { count, error } = await db().from("team_members").select("member_id", { count: "exact", head: true }).eq("team_id", teamId).eq("member_id", me);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function requireMember(teamId: string, me: string | null): Promise<void> {
  await getTeam(teamId);
  if (!(await isMember(teamId, me))) throw new HttpError(403, "팀원만 할 수 있어요.");
}

export async function requireLeader(teamId: string, me: string | null): Promise<void> {
  const team = await getTeam(teamId);
  if (!me || team.leader_id !== me) throw new HttpError(403, "조장만 할 수 있어요.");
}

export async function findOpenBox(teamId: string): Promise<BoxRow | null> {
  const { data, error } = await db().from("draw_boxes").select(BOX_COLUMNS).eq("team_id", teamId).eq("status", "open").maybeSingle();
  if (error) throw error;
  return data as BoxRow | null;
}

export async function requireOpenBox(teamId: string): Promise<BoxRow> {
  const box = await findOpenBox(teamId);
  if (!box) throw new HttpError(409, "열린 추첨통이 없어요.");
  return box;
}

export async function boxEntryRows(boxId: string): Promise<{ id: string; member_id: string; place_id: string }[]> {
  const { data, error } = await db().from("draw_entries").select("id, member_id, place_id").eq("box_id", boxId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function teamDetail(teamId: string, me: string | null): Promise<TeamDetail> {
  const team = await getTeam(teamId);
  const [members, open, records] = await Promise.all([
    db().from("team_members").select("member_id, nickname, joined_at").eq("team_id", teamId).order("joined_at"),
    findOpenBox(teamId),
    db().from("draw_boxes").select(BOX_COLUMNS).eq("team_id", teamId).eq("status", "drawn").order("drawn_at", { ascending: false }).limit(RECORD_LIMIT),
  ]);
  if (members.error) throw members.error;
  if (records.error) throw records.error;

  const isMe = (id: string) => !!me && id === me;
  // 팀을 나간 사람이 넣은 것도 남을 수 있어 닉네임이 없으면 "나간 팀원"으로 보인다
  const nicknames = new Map((members.data ?? []).map((m) => [m.member_id, m.nickname]));
  const memberList = (members.data ?? []).map((m) => ({ nickname: m.nickname, is_leader: m.member_id === team.leader_id, is_me: isMe(m.member_id) }));
  const recordRows = (records.data ?? []) as BoxRow[];
  // 다시 보기를 위해 가장 최근 추첨의 넣은 내용도 함께 보낸다
  const [openRows, latestRows] = await Promise.all([open ? boxEntryRows(open.id) : [], recordRows[0] ? boxEntryRows(recordRows[0].id) : []]);
  const entries = (rows: typeof openRows) =>
    rows.map((e) => ({ id: e.id, place_id: e.place_id, nickname: nicknames.get(e.member_id) ?? "나간 팀원", is_mine: isMe(e.member_id) }));
  const openEntries = entries(openRows);
  const latestEntries = entries(latestRows);

  return {
    id: team.id,
    name: team.name,
    members: memberList,
    is_member: memberList.some((m) => m.is_me),
    is_leader: isMe(team.leader_id),
    open_box: open ? toBox(open, openEntries) : null,
    records: recordRows.map((r, i) => toBox(r, i === 0 ? latestEntries : [])),
  };
}
