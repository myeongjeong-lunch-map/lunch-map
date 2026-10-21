import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/supabase";
import { errorResponse, requireAdmin } from "@/lib/server/guard";

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/comments/[id]">) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const { error } = await db().from("comments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
