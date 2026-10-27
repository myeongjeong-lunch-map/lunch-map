import { db } from "@/lib/server/supabase";
import { FIXED_DAYS, viewStall, type CheckRow, type StallRow, type StreetStall } from "@/lib/street";

const COLUMNS = "id, kind, memo, nickname, lat, lng, fixed, reporter_id, created_at, last_seen_at, removed_at";

/** 지금 지도에 보이는 노점. 화면(/api/street)과 MCP가 같이 쓴다. 최근 확인 순 */
export async function readStreetStalls(me: string | null, now = Date.now()): Promise<StreetStall[]> {
  // 고정 노점이 버티는 14일보다 오래 확인이 없는 제보는 어느 쪽이든 보이지 않는다
  const since = new Date(now - FIXED_DAYS * 24 * 3600_000).toISOString();
  const { data: rows, error } = await db().from("street_stalls").select(COLUMNS).is("removed_at", null).gte("last_seen_at", since);
  if (error) throw error;
  if (!rows?.length) return [];
  const { data: checks, error: cErr } = await db()
    .from("stall_checks")
    .select("stall_id, voter_id, value, updated_at")
    .in(
      "stall_id",
      rows.map((r) => r.id),
    );
  if (cErr) throw cErr;
  const byStall = new Map<string, CheckRow[]>();
  for (const c of (checks ?? []) as CheckRow[]) (byStall.get(c.stall_id) ?? byStall.set(c.stall_id, []).get(c.stall_id)!).push(c);
  return (rows as StallRow[])
    .map((r) => viewStall(r, byStall.get(r.id) ?? [], now, me))
    .filter((s): s is StreetStall => s !== null)
    .sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
}

export async function getStallRow(id: string): Promise<StallRow | null> {
  const { data, error } = await db().from("street_stalls").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as StallRow | null) ?? null;
}
