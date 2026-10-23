import "server-only";
import { remainingEntries } from "@/lib/drawBox";
import type { DrawBox, DrawLimit, TeamDetail, TeamSummary } from "@/lib/domain";
import { db } from "./supabase";
import { boxEntryRows, boxResults, decidedBoxes, findOpenBox, openBoxSummaries, type BoxRow } from "./drawBox";
import { getTeam } from "./teams";

// 팀 화면에 보여 줄 모양으로 팀·추첨통을 읽는 곳 (쓰기와 규칙은 teams.ts, drawBox.ts).

const RECORD_LIMIT = 20;

function toBox(row: BoxRow, entries: DrawBox["entries"], results: DrawBox["results"]): DrawBox {
  return {
    id: row.id,
    per_member_limit: row.per_member_limit as DrawLimit,
    status: row.status,
    result_place_id: row.result_place_id,
    drawn_at: row.drawn_at,
    entries,
    results,
  };
}

export async function listTeams(me: string | null): Promise<TeamSummary[]> {
  const [teams, members] = await Promise.all([
    db().from("teams").select("id, name, leader_id, created_at").order("created_at", { ascending: false }),
    db().from("team_members").select("team_id, member_id"),
  ]);
  for (const r of [teams, members]) if (r.error) throw r.error;

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const m of members.data ?? []) {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
    if (me && m.member_id === me) mine.add(m.team_id);
  }
  const { boxes, used, locked } = await openBoxSummaries(me, mine);
  const boxByTeam = new Map(boxes.map((b) => [b.team_id, b]));

  return (teams.data ?? []).map((t) => {
    const box = boxByTeam.get(t.id);
    return {
      id: t.id,
      name: t.name,
      member_count: counts.get(t.id) ?? 0,
      is_member: mine.has(t.id),
      is_leader: !!me && t.leader_id === me,
      open_box: box ? { id: box.id, remaining: remainingEntries(box.per_member_limit, used.get(box.id) ?? 0), locked: locked.get(box.id) ?? false } : null,
    };
  });
}

export async function teamDetail(teamId: string, me: string | null): Promise<TeamDetail> {
  const team = await getTeam(teamId);
  const [members, open, recordRows] = await Promise.all([
    db().from("team_members").select("member_id, nickname, joined_at").eq("team_id", teamId).order("joined_at"),
    findOpenBox(teamId),
    decidedBoxes(teamId, RECORD_LIMIT),
  ]);
  if (members.error) throw members.error;

  const isMe = (id: string) => !!me && id === me;
  // 팀을 나간 사람이 넣은 것도 남을 수 있어 닉네임이 없으면 "나간 팀원"으로 보인다
  const nicknames = new Map((members.data ?? []).map((m) => [m.member_id, m.nickname]));
  const memberList = (members.data ?? []).map((m) => ({ nickname: m.nickname, is_leader: m.member_id === team.leader_id, is_me: isMe(m.member_id) }));
  // 다시 보기를 위해 가장 최근 추첨의 넣은 내용도 함께 보낸다
  const [openRows, latestRows] = await Promise.all([open ? boxEntryRows(open.id) : [], recordRows[0] ? boxEntryRows(recordRows[0].id) : []]);
  const entries = (rows: typeof openRows) =>
    rows.map((e) => ({ id: e.id, place_id: e.place_id, nickname: nicknames.get(e.member_id) ?? "나간 팀원", is_mine: isMe(e.member_id) }));
  const openEntries = entries(openRows);
  const latestEntries = entries(latestRows);
  const results = await boxResults([...(open ? [open.id] : []), ...recordRows.map((r) => r.id)]);

  return {
    id: team.id,
    name: team.name,
    members: memberList,
    is_member: memberList.some((m) => m.is_me),
    is_leader: isMe(team.leader_id),
    open_box: open ? toBox(open, openEntries, results.get(open.id) ?? []) : null,
    records: recordRows.map((r, i) => toBox(r, i === 0 ? latestEntries : [], results.get(r.id) ?? [])),
  };
}
