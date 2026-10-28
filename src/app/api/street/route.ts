import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { isStallKind, MAX_STALL_KINDS } from "@/lib/domain";
import { db } from "@/lib/server/supabase";
import { cleanText, ensureVoterId, errorResponse, guardWrite, HttpError, readVoterId } from "@/lib/server/guard";
import { readStreetStalls } from "@/lib/server/street";
import { findDuplicate, withinReportRadius } from "@/lib/street";

// 길거리 제보: 지금 지도에 보이는 노점 (GLOSSARY.md 길거리 제보·노점, docs/adr/0007)
export async function GET(req: NextRequest) {
  try {
    await connection();
    const res = NextResponse.json({ stalls: await readStreetStalls(await readVoterId(req)) });
    await ensureVoterId(req, res);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

// 제보하기. 30m 안에 종류가 겹치는 노점이 이미 보이면 409와 그 노점 id를 돌려준다 (force면 그래도 새로 올린다)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    // 처음 고른 것이 대표 종류다. 예전 화면은 kind 하나만 보낸다
    const kinds = [...new Set(Array.isArray(body.kinds) ? body.kinds : [body.kind])];
    if (!kinds.length || !kinds.every(isStallKind)) throw new HttpError(400, "무엇을 봤는지 골라 주세요.");
    if (kinds.length > MAX_STALL_KINDS) throw new HttpError(400, `종류는 ${MAX_STALL_KINDS}개까지 고를 수 있어요.`);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "위치가 필요해요.");
    if (!withinReportRadius(lat, lng)) throw new HttpError(400, "캠퍼스에서 2km 안의 노점만 제보할 수 있어요.");
    const fixed = body.fixed === true;
    const res = NextResponse.json({ ok: true });
    const voterId = await ensureVoterId(req, res);

    if (body.force !== true) {
      const dup = findDuplicate(await readStreetStalls(voterId), kinds, lat, lng);
      if (dup) return NextResponse.json({ error: "근처에 같은 노점 제보가 있어요.", stallId: dup.id }, { status: 409 });
    }
    await guardWrite(req, body);
    const now = new Date().toISOString();
    const { data: stall, error } = await db()
      .from("street_stalls")
      .insert({
        kind: kinds[0],
        kinds,
        memo: cleanText(body.memo, 60),
        nickname: cleanText(body.nickname, 20),
        lat,
        lng,
        fixed,
        reporter_id: voterId,
        created_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single();
    if (error) throw error;
    // 제보한 사람은 처음부터 "있다"로 확인한 것으로 친다
    const { error: cErr } = await db()
      .from("stall_checks")
      .insert({ stall_id: stall.id, voter_id: voterId, value: fixed ? "open" : "here", updated_at: now });
    if (cErr) throw cErr;
    const out = NextResponse.json({ id: stall.id }, { status: 201 });
    for (const c of res.cookies.getAll()) out.cookies.set(c);
    return out;
  } catch (e) {
    return errorResponse(e);
  }
}
