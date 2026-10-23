import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { cleanText, ensureVoterId, errorResponse, guardWrite, HttpError, readVoterId } from "@/lib/server/guard";
import { listTeams } from "@/lib/server/teamViews";

// 팀 목록: 누구나 보고 골라서 들어올 수 있다
export async function GET(req: NextRequest) {
  try {
    return Response.json({ teams: await listTeams(readVoterId(req)) });
  } catch (e) {
    return errorResponse(e);
  }
}

// 팀 만들기: 만든 사람이 조장이 되고 첫 팀원이 된다
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = cleanText(body.name, 30);
    const nickname = cleanText(body.nickname, 20);
    if (!name) throw new HttpError(400, "팀 이름을 적어 주세요.");
    if (!nickname) throw new HttpError(400, "닉네임을 적어 주세요.");
    await guardWrite(req, body);

    const res = NextResponse.json({ ok: true });
    const me = ensureVoterId(req, res);
    const { data, error } = await db().from("teams").insert({ name, leader_id: me }).select("id").single();
    if (error) throw error;
    const { error: memErr } = await db().from("team_members").insert({ team_id: data.id, member_id: me, nickname });
    if (memErr) throw memErr;
    const out = NextResponse.json({ id: data.id as string });
    for (const c of res.cookies.getAll()) out.cookies.set(c);
    return out;
  } catch (e) {
    return errorResponse(e);
  }
}
