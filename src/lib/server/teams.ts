import "server-only";
import { db } from "./supabase";
import { HttpError } from "./guard";

// 팀원은 평가와 같은 브라우저 쿠키(lm_voter)로 구분한다 (ADR 0003).

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
