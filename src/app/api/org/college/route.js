import { createCollege, getColleges } from "@/lib/services/org.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// GET /api/org/college — platform-wide list, SUPER_ADMIN only
export async function GET(req) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const colleges = await getColleges();
    return Response.json({ success: true, colleges });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

// POST /api/org/college — SUPER_ADMIN only (colleges self-onboard via /api/onboarding)
export async function POST(req) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const body = await req.json();
    const college = await createCollege(body);

    return Response.json({ success: true, college }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
