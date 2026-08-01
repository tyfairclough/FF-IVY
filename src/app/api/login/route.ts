import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;
  const password = body?.password ?? "";
  const expected = process.env.APP_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
