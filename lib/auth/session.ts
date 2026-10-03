import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, users } from "@/lib/db";

export const SESSION_COOKIE = "mre_session";
const SESSION_TTL_SECONDS = 30 * 24 * 3600;

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET manquant ou trop court — voir .env.example");
  }
  return Buffer.from(s);
}

function sign(payload: string): string {
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}

export function verifySessionToken(token: string): number | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      exp?: unknown;
    };
    if (typeof data.userId !== "number" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now() / 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

export type SessionUser = typeof users.$inferSelect;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (userId == null) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user ?? null;
}

/** À appeler dans les pages et actions protégées : redirige vers /login si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function createSession(userId: number): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  const store = await cookies();
  store.set(SESSION_COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    // Secure en production par défaut. Opt-out explicite SESSION_SECURE=false
    // pour un déploiement en HTTP clair sur un réseau local de confiance :
    // un cookie Secure envoyé en HTTP est rejeté par le navigateur et la
    // session ne tient pas.
    secure: process.env.NODE_ENV === "production" && process.env.SESSION_SECURE !== "false",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
