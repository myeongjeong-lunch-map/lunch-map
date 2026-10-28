import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "./auth";
import { db } from "./supabase";

const WINDOW_MINUTES = 10;
const MAX_WRITES_PER_WINDOW = 20;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function ipHash(req: NextRequest): string {
  return createHash("sha256")
    .update(`${clientIp(req)}:${process.env.ADMIN_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

// 로그인 없는 쓰기를 위한 최소 방어: 허니팟 + IP별 속도 제한
export async function guardWrite(req: NextRequest, body: Record<string, unknown>): Promise<void> {
  if (typeof body.website === "string" && body.website.trim() !== "") {
    throw new HttpError(400, "잘못된 요청입니다.");
  }
  const hash = ipHash(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await db()
    .from("write_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= MAX_WRITES_PER_WINDOW) {
    throw new HttpError(429, "잠시 후 다시 시도해 주세요. 짧은 시간에 너무 많이 작성했어요.");
  }
  await db().from("write_events").insert({ ip_hash: hash });
}

// 로컬 개발(http://localhost)에서도 쿠키가 저장되도록 Secure는 배포 환경에서만 켠다
const SECURE_COOKIE = process.env.NODE_ENV === "production";

// 나(평가·키워드·팀원·즐겨찾기의 주인) ID. 로그인했으면 계정 ID('u:' + auth.users id),
// 아니면 웹 브라우저 하나를 한 명으로 보고 httpOnly 쿠키에 둔 브라우저 ID를 쓴다 (docs/adr/0008).
// 동시에 여러 요청이 브라우저 ID를 새로 만들지 않도록 첫 목록 조회(GET /api/places) 때 미리 발급한다.
const VOTER_COOKIE = "lm_voter";
const ACCOUNT_PREFIX = "u:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 쿠키의 브라우저 ID. 쿠키를 고쳐 계정 ID인 척하지 못하게 우리가 발급한 모양(UUID)만 받는다 */
export function readBrowserId(req: NextRequest): string | null {
  const v = req.cookies.get(VOTER_COOKIE)?.value;
  return v && UUID_RE.test(v) ? v : null;
}

export function accountKey(userId: string): string {
  return ACCOUNT_PREFIX + userId;
}

export async function readVoterId(req: NextRequest): Promise<string | null> {
  const userId = await currentUserId();
  return userId ? accountKey(userId) : readBrowserId(req);
}

export async function ensureVoterId(req: NextRequest, res: NextResponse): Promise<string> {
  const existing = await readVoterId(req);
  if (existing) return existing;
  const id = randomUUID();
  res.cookies.set(VOTER_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: SECURE_COOKIE, path: "/", maxAge: 60 * 60 * 24 * 365 * 5 });
  return id;
}

// 관리자 세션: ADMIN_SECRET의 해시를 httpOnly 쿠키에 둔다.
const ADMIN_COOKIE = "lm_admin";

function adminToken(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new HttpError(500, "ADMIN_SECRET이 설정되지 않았습니다.");
  return createHash("sha256").update(`admin:${secret}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkAdminSecret(input: string): boolean {
  const secret = process.env.ADMIN_SECRET ?? "";
  return secret.length > 0 && safeEqual(input, secret);
}

export function setAdminCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, adminToken(), { httpOnly: true, sameSite: "strict", secure: SECURE_COOKIE, path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && safeEqual(token, adminToken());
}

export function requireAdmin(req: NextRequest): void {
  if (!isAdmin(req)) throw new HttpError(401, "관리자만 할 수 있어요.");
}

export function errorResponse(e: unknown): Response {
  // 프리렌더 중단 같은 Next 내부 신호는 잡지 않고 다시 던진다
  unstable_rethrow(e);
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
}

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// Vercel Cron이 Authorization: Bearer $CRON_SECRET 으로 호출한다. 맞지 않으면 401.
export function requireCron(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "unauthorized");
}
