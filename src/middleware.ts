import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMicroclimate = pathname.startsWith("/api/microclimate");

  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/login") ||
    isMicroclimate
  ) {
    // #region agent log
    if (isMicroclimate) {
      fetch("http://127.0.0.1:7926/ingest/86f94468-743f-4211-ad1e-a630cc67636d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ca9006",
        },
        body: JSON.stringify({
          sessionId: "ca9006",
          runId: "pre-fix",
          hypothesisId: "D",
          location: "middleware.ts:publicPass",
          message: "microclimate allowed through middleware",
          data: { pathname },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const ok = token ? await verifySessionToken(token) : false;

  if (!ok) {
    if (pathname.startsWith("/api/")) {
      // #region agent log
      fetch("http://127.0.0.1:7926/ingest/86f94468-743f-4211-ad1e-a630cc67636d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ca9006",
        },
        body: JSON.stringify({
          sessionId: "ca9006",
          runId: "pre-fix",
          hypothesisId: "D",
          location: "middleware.ts:apiUnauthorized",
          message: "middleware returned 401 for API",
          data: { pathname },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return NextResponse.json(
        { error: "Unauthorized", debugCode: "middleware_session" },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
