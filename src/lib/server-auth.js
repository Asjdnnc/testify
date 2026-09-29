import jwt from "jsonwebtoken";
import { resolveCollegeSubscription } from "./middlewares/subscription.middleware.js";

// ---------------------------------------------------------------------------
// Server-side authentication for API routes.
//
// Every route MUST go through requireAuth() — never decode the JWT payload
// without verifying its signature, otherwise anyone can forge a token with an
// arbitrary role / collegeId.
// ---------------------------------------------------------------------------

export const TOKEN_COOKIE = "testify-token";

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

function readToken(req) {
  const header = req?.headers?.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer && bearer !== "null" && bearer !== "undefined") return bearer;
  }

  const cookieHeader = req?.headers?.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Returns the verified token payload, or null if missing/invalid/expired.
 */
export function getAuth(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

/**
 * Verifies the caller and (optionally) their role and their college's
 * subscription state. Throws HttpError on failure.
 *
 * @param {Request} req
 * @param {object}  opts
 * @param {string[]} [opts.roles]        allowed roles
 * @param {boolean}  [opts.subscription] enforce the SaaS subscription gate
 *                                       (skipped for SUPER_ADMIN)
 */
export async function requireAuth(req, { roles, subscription = false } = {}) {
  const auth = getAuth(req);
  if (!auth?.userId) throw new HttpError(401, "Unauthorized");

  if (roles && !roles.includes(auth.role)) {
    throw new HttpError(403, "Forbidden: insufficient permissions");
  }

  if (auth.role !== "SUPER_ADMIN" && !auth.collegeId) {
    throw new HttpError(403, "No college context");
  }

  if (subscription && auth.role !== "SUPER_ADMIN") {
    await assertSubscriptionAccess(auth.collegeId, req.method);
  }

  return auth;
}

/**
 * SaaS gate:
 *  - deleted college                → 404
 *  - TRIAL / ACTIVE                 → full access
 *  - TRIAL_EXPIRED / SUSPENDED /
 *    CANCELLED (grace period)       → read-only (GET/HEAD), writes get 402
 */
export async function assertSubscriptionAccess(collegeId, method = "GET") {
  let college;
  try {
    college = await resolveCollegeSubscription(collegeId);
  } catch (err) {
    throw new HttpError(err.statusCode || 500, err.message);
  }

  const status = college.subscriptionStatus;
  if (status === "TRIAL" || status === "ACTIVE") return college;

  const isRead = method === "GET" || method === "HEAD";
  if (isRead) return college;

  const message =
    status === "TRIAL_EXPIRED"
      ? "Your free trial has ended. Please upgrade to continue."
      : status === "SUSPENDED"
        ? "Your subscription is suspended. Please renew to continue."
        : "This account has been cancelled.";

  throw new HttpError(402, message, { subscriptionStatus: status });
}

/**
 * Converts any thrown error into a JSON Response.
 */
export function errorResponse(error, fallbackStatus = 400) {
  const status = error?.status || error?.statusCode || fallbackStatus;
  if (status >= 500) console.error("[API ERROR]", error);
  const body = { success: false, message: error?.message || "Something went wrong" };
  if (error?.subscriptionStatus) body.subscriptionStatus = error.subscriptionStatus;
  // Expose app error codes (e.g. PLAN_LIMIT_EXCEEDED) but not Prisma internals (P2002…)
  if (typeof error?.code === "string" && !/^P\d{4}$/.test(error.code)) body.code = error.code;
  return Response.json(body, { status });
}

/**
 * For SUPER_ADMIN the college can be chosen explicitly; everyone else is
 * pinned to the college in their verified token.
 */
export function resolveCollegeId(auth, requestedCollegeId) {
  if (auth.role === "SUPER_ADMIN") {
    if (!requestedCollegeId) throw new HttpError(400, "collegeId is required");
    return requestedCollegeId;
  }
  return auth.collegeId;
}
