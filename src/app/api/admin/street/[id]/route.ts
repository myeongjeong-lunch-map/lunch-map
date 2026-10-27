import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, requireAdmin } from "@/lib/server/guard";

// 관리자가 길거리 제보를 내린다. 지우지 않고 removed_at만 남긴다 (docs/adr/0007)
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/street/[id]">) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const { error } = await db().from("street_stalls").update({ removed_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
