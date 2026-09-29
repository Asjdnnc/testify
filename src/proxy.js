import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Routing-layer guard. The JWT signature IS verified here (HS256 via Web
// Crypto, works in both Edge and Node runtimes) so a forged token can't be
// used to reach role-restricted pages. API routes verify independently via
// src/lib/server-auth.js.
// ---------------------------------------------------------------------------

function base64UrlToBytes(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
  if (header.alg !== "HS256") return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

function kickToLogin(req) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.delete("testify-token");
  return response;
}

export async function proxy(req) {
  const token = req.cookies.get("testify-token")?.value;
  const path = req.nextUrl.pathname;

  // Self-registration is disabled — users are provisioned by their college.
  if (path === "/register") {
    return NextResponse.redirect(new URL("/get-started", req.url));
  }

  let payload = null;
  if (token) {
    try {
      payload = await verifyJwt(token, process.env.JWT_SECRET);
    } catch {
      payload = null;
    }
  }

  // --- Public Paths ---
  if (path === "/login" || path.startsWith("/auth/")) {
    if (payload && path === "/login") return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // --- Protected Paths ---
  if (path.startsWith("/dashboard")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (!payload) return kickToLogin(req);

    const role = payload.role;

    if (path.startsWith("/dashboard/super-admin") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/dashboard/admin") && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/dashboard/teacher") && role !== "TEACHER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/dashboard/student") && role !== "STUDENT") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Redirect blank /dashboard to role-specific dashboard
    if (path === "/dashboard") {
      if (role === "STUDENT") {
        return NextResponse.redirect(new URL("/dashboard/student", req.url));
      } else if (role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/dashboard/super-admin/colleges", req.url));
      } else if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard/admin/branches", req.url));
      } else if (role === "TEACHER") {
        return NextResponse.redirect(new URL("/dashboard/teacher", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/auth/:path*",
  ],
};
